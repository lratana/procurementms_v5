-- Cloudflare D1 schema (SQLite) — synchronized with 0001_initial_schema.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  fiscal_year INTEGER,
  procurement_type TEXT,
  budget_type TEXT DEFAULT 'មូលធន',
  procurement_method TEXT,
  plan_date TEXT,
  plan_amount REAL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_projects_fiscal_year ON projects(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_projects_procurement_type ON projects(procurement_type);
CREATE INDEX IF NOT EXISTS idx_projects_budget_type ON projects(budget_type);
CREATE INDEX IF NOT EXISTS idx_projects_procurement_method ON projects(procurement_method);

CREATE TABLE IF NOT EXISTS project_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  request_date TEXT,
  fiscal_year INTEGER,
  request_amount REAL DEFAULT 0,
  approval_date TEXT,
  approved_amount REAL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_requests_fiscal_year ON project_requests(fiscal_year);

CREATE TABLE IF NOT EXISTS bidding_process (
  bid_process_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  prepare_bid TEXT,
  moh_approval TEXT,
  mef_submit TEXT,
  mef_approval TEXT,
  advertise_date TEXT,
  bid_opening TEXT,
  validity_days INTEGER DEFAULT 90,
  expiry_days INTEGER DEFAULT 30,
  valid_until TEXT,
  status TEXT DEFAULT 'កំពុងមានសុពលភាព',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bidding_process_status ON bidding_process(status);
CREATE INDEX IF NOT EXISTS idx_bidding_process_valid_until ON bidding_process(valid_until);

CREATE TABLE IF NOT EXISTS bidders (
  bidder_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_director TEXT,
  phone_number TEXT,
  tax_identification_number TEXT,
  address TEXT,
  status TEXT DEFAULT 'សកម្ម'
);

CREATE INDEX IF NOT EXISTS idx_bidders_status ON bidders(status);
CREATE INDEX IF NOT EXISTS idx_bidders_tax_id ON bidders(tax_identification_number);

CREATE TABLE IF NOT EXISTS contracts (
  contract_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  contract_submit_mef TEXT,
  contract_amount REAL DEFAULT 0,
  approval_date TEXT,
  end_date TEXT,
  contract_validity INTEGER DEFAULT 180,
  expiry_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'កំពុងអនុវត្ត',
  handover TEXT DEFAULT 'មិនទាន់ប្រគល់',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

CREATE TABLE IF NOT EXISTS handovers (
  handover_id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL,
  contract_amount REAL DEFAULT 0,
  handover_amount REAL DEFAULT 0,
  stage_1 REAL DEFAULT 0,
  stage_2 REAL DEFAULT 0,
  stage_3 REAL DEFAULT 0,
  stage_4 REAL DEFAULT 0,
  progress_percent REAL DEFAULT 0,
  handover_status TEXT DEFAULT 'មិនទាន់ប្រគល់',
  notes TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_handovers_status ON handovers(handover_status);

CREATE TABLE IF NOT EXISTS warranties (
  warranty_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE NOT NULL,
  existing_handover_date TEXT,
  handover_date TEXT,
  warranty_period_days INTEGER DEFAULT 365,
  expired_years INTEGER,
  expired_date TEXT,
  warranty_remaining_days INTEGER DEFAULT 365,
  expired_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'កំពុងធានា',
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_warranties_status ON warranties(status);
CREATE INDEX IF NOT EXISTS idx_warranties_expired_date ON warranties(expired_date);

CREATE TABLE IF NOT EXISTS documents (
  document_id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'planning',
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT UNIQUE NOT NULL,
  uploaded_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_stage ON documents(stage);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  department TEXT,
  position TEXT,
  profile_photo TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS devices (
  device_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  device_name TEXT,
  device_type TEXT,
  operating_system TEXT,
  browser TEXT,
  device_identifier TEXT UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  first_login_at TEXT,
  last_login_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  device_id INTEGER,
  session_token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  login_at TEXT DEFAULT CURRENT_TIMESTAMP,
  logout_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  device_id INTEGER,
  action TEXT NOT NULL,
  module TEXT,
  table_name TEXT,
  record_id TEXT,
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
