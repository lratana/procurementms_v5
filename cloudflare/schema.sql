-- Cloudflare D1 schema (SQLite)
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
      plan_amount REAL
    );

    CREATE TABLE IF NOT EXISTS project_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      request_date TEXT,
      fiscal_year INTEGER,
      request_amount REAL,
      approval_date TEXT,
      approved_amount REAL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bidding_process (
      bid_process_id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      prepare_bid TEXT,
      moh_approval TEXT,
      mef_submit TEXT,
      mef_approval TEXT,
      advertise_date TEXT,
      bid_opening TEXT,
      validity_days INTEGER,
      expiry_days INTEGER,
      valid_until TEXT,
      status TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bidders (
      bidder_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      company_director TEXT,
      phone_number TEXT,
      tax_identification_number TEXT,
      address TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS contracts (
      contract_id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      contract_submit_mef TEXT,
      contract_amount REAL,
      approval_date TEXT,
      end_date TEXT,
      contract_validity INTEGER,
      expiry_days INTEGER,
      status TEXT,
      handover TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS handovers (
      handover_id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL,
      contract_amount REAL,
      handover_amount REAL,
      stage_1 REAL,
      stage_2 REAL,
      stage_3 REAL,
      stage_4 REAL,
      progress_percent REAL,
      handover_status TEXT,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS warranties (
      warranty_id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT UNIQUE NOT NULL,
      existing_handover_date TEXT,
      handover_date TEXT,
      warranty_period_days INTEGER,
      expired_years INTEGER,
      expired_date TEXT,
      warranty_remaining_days INTEGER,
      expired_days INTEGER,
      status TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    );

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
