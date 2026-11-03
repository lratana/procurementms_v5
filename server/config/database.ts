import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_NAME = process.env.DB_NAME || 'procurement_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// MySQL pool instance
export const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 2000,
});

let isUsingMysql = false;
let sqliteDb: any = null;
let initialized = false;

// Prepare & clean parameters for SQLite
function cleanParams(params: any[]): any[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'object' && p !== null && !(p instanceof Date)) {
      return JSON.stringify(p);
    }
    return p;
  });
}

// Initialize SQLite relational database fallback
async function initSqlite() {
  if (sqliteDb) return;
  const { DatabaseSync } = await import('node:sqlite');
  const dbPath = path.resolve(process.cwd(), 'procurement.sqlite');
  sqliteDb = new DatabaseSync(dbPath);

  // Register compatibility functions for MySQL queries
  sqliteDb.function('NOW', () => new Date().toISOString().replace('T', ' ').split('.')[0]);
  sqliteDb.function('CURDATE', () => new Date().toISOString().split('T')[0]);
  sqliteDb.function('DATEDIFF', (d1: string, d2: string) => {
    if (!d1 || !d2) return 0;
    const diffMs = new Date(d1).getTime() - new Date(d2).getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  });

  // Enable foreign keys
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  // Create tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      fiscal_year INTEGER,
      procurement_type TEXT,
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
  `);

  // Seed default data if users table is empty
  const userCheck = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCheck.count === 0) {
    console.log('[DB] Seeding default Cambodian Procurement data into relational database...');
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const editorHash = await bcrypt.hash('Editor@123', 10);
    const viewerHash = await bcrypt.hash('Viewer@123', 10);

    const insertUser = sqliteDb.prepare(`
      INSERT INTO users (user_id, username, password_hash, full_name, email, phone_number, role, department, position, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `);
    insertUser.run(1, 'admin', adminHash, 'ឯកឧត្តម សុខ ចិន្តា', 'admin@procurement.gov.kh', '012 888 999', 'admin', 'នាយកដ្ឋានលទ្ធកម្មសាធារណៈ', 'ប្រធាននាយកដ្ឋាន');
    insertUser.run(2, 'editor', editorHash, 'លោកជំទាវ កែវ មុនីរ័ត្ន', 'editor@procurement.gov.kh', '016 777 666', 'editor', 'ការិយាល័យដេញថ្លៃ និងកិច្ចសន្យា', 'អនុប្រធានការិយាល័យ');
    insertUser.run(3, 'viewer', viewerHash, 'លោក ឡុង រតនៈ', 'viewer@procurement.gov.kh', '098 555 444', 'viewer', 'អង្គភាពសវនកម្មផ្ទៃក្នុង', 'មន្ត្រីត្រួតពិនិត្យ និងតាមដាន');

    // Projects
    const insertProj = sqliteDb.prepare(`
      INSERT INTO projects (project_id, title, description, fiscal_year, procurement_type, procurement_method, plan_date, plan_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProj.run('PRJ-001', 'ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ និងបណ្តាញ Network មន្ទីរពេទ្យបង្អែកខេត្តកណ្តាល', 'គម្រោងផ្គត់ផ្គង់កុំព្យូទ័រលើតុ Server និងប្រព័ន្ធបណ្តាញខ្សែកាបល្បឿនលឿនក្នុងមន្ទីរពេទ្យ', 2025, 'ទំនិញ', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-01-15', 7450.00);
    insertProj.run('PRJ-002', 'សាងសង់អគារវេជ្ជសាស្ត្រ និងសង្គ្រោះបន្ទាន់ ៣ជាន់ នៅមន្ទីរពេទ្យបង្អែកខេត្តសៀមរាប', 'អគារបេតុងអាមេ ៣ជាន់ បំពាក់ប្រព័ន្ធអគ្គិសនី ប្រព័ន្ធទឹក និងជណ្តើរយន្តវេជ្ជសាស្ត្រ', 2025, 'សំណង់', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-02-01', 1180000.00);
    insertProj.run('PRJ-003', 'ផ្គត់ផ្គង់ឧបករណ៍វេជ្ជសាស្ត្រទំនើប (Digital X-Ray & Ultrasound)', 'ទិញម៉ាស៊ីនថតកាំរស្មីអ៊ិចឌីជីថល និងម៉ាស៊ីនអេកូសាស្ត្រ 4D សម្រាប់មន្ទីរពេទ្យកុមារ', 2025, 'ទំនិញ', 'ការដេញថ្លៃជាអន្តរជាតិ (ICB)', '2025-03-10', 450000.00);
    insertProj.run('PRJ-004', 'សេវាប្រឹក្សាយោបល់រៀបចំប្រព័ន្ធឌីជីថលសុខាភិបាលថ្នាក់ជាតិ (Health Information System)', 'ការអភិវឌ្ឍប្រព័ន្ធគ្រប់គ្រងអ្នកជំងឺ និងទិន្នន័យសុខាភិបាលអេឡិចត្រូនិក', 2026, 'សេវាកម្មប្រឹក្សា', 'ការជ្រើសរើសផ្អែកលើគុណភាព និងតម្លៃ (QCBS)', '2026-01-20', 185000.00);
    insertProj.run('PRJ-005', 'ជួសជុលកែលម្អប្រព័ន្ធអគ្គិសនី និងប្រព័ន្ធត្រជាក់មន្ទីរពេទ្យខេត្តបាត់ដំបង', 'ការផ្លាស់ប្តូរខ្សែភ្លើងចាស់ៗ ប្តូរម៉ាស៊ីនភ្លើងបម្រុង និងម៉ាស៊ីនត្រជាក់បន្ទប់វះកាត់', 2025, 'សំណង់', 'ការដេញថ្លៃប្រកួតប្រជែងតម្លៃ (Price Quotation)', '2025-04-05', 65000.00);
    insertProj.run('PRJ-006', 'ផ្គត់ផ្គង់រថយន្តសង្គ្រោះបន្ទាន់បំពាក់បរិក្ខារពេញលេញចំនួន ៥គ្រឿង', 'រថយន្តសង្គ្រោះបន្ទាន់ប្រភេទ ICU Mobile សម្រាប់សង្គ្រោះបឋម', 2025, 'ទំនិញ', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-05-12', 250000.00);

    // Project Requests
    const insertReq = sqliteDb.prepare(`
      INSERT INTO project_requests (project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertReq.run('PRJ-001', '2025-01-25', 2025, 7500.00, '2025-02-10', 7450.00);
    insertReq.run('PRJ-002', '2025-02-15', 2025, 1200000.00, '2025-03-01', 1180000.00);
    insertReq.run('PRJ-003', '2025-03-15', 2025, 460000.00, '2025-04-02', 450000.00);
    insertReq.run('PRJ-004', '2026-02-01', 2026, 190000.00, '2026-02-25', 185000.00);
    insertReq.run('PRJ-005', '2025-04-12', 2025, 68000.00, '2025-04-28', 65000.00);
    insertReq.run('PRJ-006', '2025-05-18', 2025, 260000.00, '2025-06-05', 250000.00);

    // Bidders
    const insertBidder = sqliteDb.prepare(`
      INSERT INTO bidders (bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertBidder.run('BID-001', 'ខេមបូឌា អាយធី សូលូសិន ខូអិលធីឌី (Cambodia IT Solutions)', 'លោក ចាន់ ពិសិដ្ឋ', '023 889 900', 'K001-902134567', 'ផ្ទះលេខ ៤៥ មហាវិថីព្រះនរោត្តម សង្កាត់ជ័យជំនះ ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ', 'សកម្ម');
    insertBidder.run('BID-002', 'សុវណ្ណភូមិ ខនស្ត្រាក់សិន គ្រុប (Sovanphum Construction Group)', 'លោកជំទាវ ស៊ុន សុភា', '023 991 223', 'K002-881234901', 'ផ្លូវជាតិលេខ ៦A សង្កាត់ជ្រោយចង្វារ ខណ្ឌជ្រោយចង្វារ រាជធានីភ្នំពេញ', 'សកម្ម');
    insertBidder.run('BID-003', 'មេឌីខល អ៊ីឃ្វីបមេន អាស៊ី (Medical Equipment Asia Co., Ltd)', 'លោក ស៊ឹម វិចិត្រ', '012 445 566', 'K003-776543210', 'មហាវិថីម៉ៅសេទុង សង្កាត់បឹងកេងកង១ ខណ្ឌបឹងកេងកង រាជធានីភ្នំពេញ', 'សកម្ម');
    insertBidder.run('BID-004', 'ហ្គ្រីន ថេកណូឡូជី ឯ.ក (Green Tech Systems)', 'លោក ហេង វណ្ណា', '017 332 211', 'K004-665544332', 'ផ្លូវ ២៧១ សង្កាត់ទឹកល្អក់៣ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ', 'សកម្ម');

    // Bidding Process
    const insertBidding = sqliteDb.prepare(`
      INSERT INTO bidding_process (bid_process_id, project_id, prepare_bid, moh_approval, mef_submit, mef_approval, advertise_date, bid_opening, validity_days, valid_until, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertBidding.run(1, 'PRJ-001', '2025-02-15', '2025-02-28', '2025-03-05', '2025-03-20', '2025-03-25', '2025-04-25', 90, '2025-07-24', 'កំពុងអនុវត្ត');
    insertBidding.run(2, 'PRJ-002', '2025-03-05', '2025-03-18', '2025-03-25', '2025-04-10', '2025-04-15', '2025-05-20', 120, '2025-09-17', 'កំពុងអនុវត្ត');
    insertBidding.run(3, 'PRJ-003', '2025-04-10', '2025-04-25', '2025-05-02', '2025-05-18', '2025-05-25', '2025-07-05', 90, '2025-10-03', 'កំពុងរៀបចំ');

    // Contracts
    const insertContract = sqliteDb.prepare(`
      INSERT INTO contracts (contract_id, project_id, contract_submit_mef, contract_amount, approval_date, end_date, contract_validity, status, handover)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertContract.run(1, 'PRJ-001', '2025-05-18', 7450.00, '2025-05-28', '2025-09-30', 120, 'កំពុងអនុវត្ត', 'ដំណាក់កាលទី ៣');
    insertContract.run(2, 'PRJ-002', '2025-06-20', 1180000.00, '2025-07-05', '2026-07-15', 365, 'កំពុងអនុវត្ត', 'ប្រគល់រួចរាល់');

    // Handovers
    const insertHandover = sqliteDb.prepare(`
      INSERT INTO handovers (handover_id, project_id, contract_amount, handover_amount, stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertHandover.run('HO-001', 'PRJ-001', 7450.00, 5587.50, 1490.00, 2235.00, 1862.50, 0.00, 75.00, 'កំពុងដំណើរការ', 'ដំណាក់កាលទី១ ដល់ ទី៣ បានបញ្ចប់ និងបានត្រួតពិនិត្យរួចរាល់ នៅសល់ដំណាក់កាលចុងក្រោយ');
    insertHandover.run('HO-002', 'PRJ-002', 1180000.00, 1180000.00, 236000.00, 354000.00, 354000.00, 236000.00, 100.00, 'ប្រគល់រួចរាល់', 'សំណង់អគារទាំងមូលបានសាងសង់រួចរាល់១០០% និងបានត្រួតពិនិត្យទទួលជាផ្លូវការ');

    // Warranties
    const insertWarranty = sqliteDb.prepare(`
      INSERT INTO warranties (warranty_id, project_id, existing_handover_date, handover_date, warranty_period_days, expired_years, expired_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertWarranty.run(1, 'PRJ-001', '2025-10-20', '2025-10-20', 365, 2026, '2026-10-20', 'Active');
    insertWarranty.run(2, 'PRJ-002', '2025-08-15', '2025-08-15', 730, 2027, '2027-08-15', 'Active');

    // Devices
    const insertDevice = sqliteDb.prepare(`
      INSERT INTO devices (device_id, user_id, device_name, device_type, operating_system, browser, device_identifier, ip_address, user_agent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);
    insertDevice.run(1, 1, 'Dell Latitude 7440 (Office)', 'Laptop', 'Windows 11 Pro', 'Chrome 122.0', 'DEV-OFFICE-01', '192.168.1.105', 'Chrome / Windows');
    insertDevice.run(2, 2, 'HP EliteBook G9', 'Laptop', 'Windows 11', 'Chrome 121.0', 'DEV-OFFICE-02', '192.168.1.110', 'Chrome / Windows');
    insertDevice.run(3, 3, 'MacBook Pro M2', 'Laptop', 'macOS Sonoma', 'Safari 17.2', 'DEV-OFFICE-03', '192.168.1.115', 'Safari / macOS');

    // Audit Logs
    const insertAudit = sqliteDb.prepare(`
      INSERT INTO audit_logs (audit_id, user_id, device_id, action, module, table_name, record_id, new_data, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(1, 1, 1, 'LOGIN', 'auth', 'user_sessions', '1', '{"status": "success"}', '192.168.1.105');
    insertAudit.run(2, 1, 1, 'CREATE', 'projects', 'projects', 'PRJ-001', '{"title": "ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ..."}', '192.168.1.105');
    insertAudit.run(3, 2, 2, 'UPDATE', 'handovers', 'handovers', 'HO-001', '{"progress": 75}', '192.168.1.110');

    console.log('[DB] Seeding completed successfully.');
  }
}

/**
 * Split a SQL file into individual executable statements while stripping comments.
 */
function parseSqlStatements(sqlContent: string): string[] {
  const withoutBlockComments = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = withoutBlockComments
    .split('\n')
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter((line) => line.length > 0);

  const cleaned = lines.join('\n');
  return cleaned
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

/**
 * Check if an error is a harmless duplicate column / table already exists error
 * so migrations remain idempotent even if partially applied earlier.
 */
function isDuplicateSchemaError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    code === 'ER_DUP_FIELDNAME' ||
    code === 'ER_TABLE_EXISTS_ERROR' ||
    msg.includes('duplicate column name') ||
    msg.includes('already exists')
  );
}

async function ensureConnection(): Promise<void> {
  if (initialized && (isUsingMysql || sqliteDb)) {
    return;
  }

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    isUsingMysql = true;
    initialized = true;
    console.log(`[DB] Successfully connected to MySQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  } catch (err: any) {
    console.warn(`[DB] MySQL unreachable (${err.code || err.message}). Switching to local relational SQLite database...`);
    await initSqlite();
    isUsingMysql = false;
    initialized = true;
    console.log('[DB] Relational SQLite engine active and operational.');
  }
}

/**
 * Runs all SQL migration files from database/migrations in sorted order.
 */
export async function runMigrations(migrationsDir?: string): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureConnection();

  const targetDir = migrationsDir || path.resolve(process.cwd(), 'database/migrations');
  const applied: string[] = [];
  const skipped: string[] = [];

  if (!fs.existsSync(targetDir)) {
    console.log(`[Migrations] Directory not found at ${targetDir}, skipping.`);
    return { applied, skipped };
  }

  // Ensure schema_migrations table exists
  if (isUsingMysql) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Get sorted .sql files
  const files = fs
    .readdirSync(targetDir)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  for (const file of files) {
    // Check if migration was already recorded
    let alreadyExecuted = false;
    if (isUsingMysql) {
      const [rows] = await pool.query('SELECT filename FROM schema_migrations WHERE filename = ? LIMIT 1', [file]);
      alreadyExecuted = Array.isArray(rows) && rows.length > 0;
    } else {
      const row = sqliteDb.prepare('SELECT filename FROM schema_migrations WHERE filename = ? LIMIT 1').get(file);
      alreadyExecuted = !!row;
    }

    if (alreadyExecuted) {
      skipped.push(file);
      continue;
    }

    const filePath = path.join(targetDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    const statements = parseSqlStatements(sqlContent);

    console.log(`[Migrations] Applying migration: ${file} (${statements.length} statement(s))...`);

    for (const statement of statements) {
      try {
        if (isUsingMysql) {
          await pool.query(statement);
        } else {
          sqliteDb.exec(statement);
        }
      } catch (err: any) {
        if (isDuplicateSchemaError(err)) {
          console.log(`[Migrations] Notice in ${file}: schema element already exists (${err.message}), continuing.`);
        } else {
          console.error(`[Migrations] Failed executing statement in ${file}:\n${statement}\nError:`, err.message);
          throw err;
        }
      }
    }

    // Record completed migration
    if (isUsingMysql) {
      await pool.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
    } else {
      sqliteDb.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
    }

    applied.push(file);
    console.log(`[Migrations] Successfully applied: ${file}`);
  }

  return { applied, skipped };
}

let migrationsVerified = false;

// Direct test function for connectivity
export async function testConnection(): Promise<boolean> {
  await ensureConnection();
  if (!migrationsVerified) {
    migrationsVerified = true;
    await runMigrations();
  }
  return true;
}

// SQL helper methods
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await testConnection();

  if (isUsingMysql) {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  }

  // SQLite execution
  const cParams = cleanParams(params);
  const trimmed = sql.trim();
  const isSelect = /^SELECT|^PRAGMA/i.test(trimmed);

  if (isSelect) {
    const stmt = sqliteDb.prepare(sql);
    const rows = stmt.all(...cParams);
    return rows as T[];
  } else {
    const stmt = sqliteDb.prepare(sql);
    stmt.run(...cParams);
    return [] as T[];
  }
}

export async function execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number }> {
  await testConnection();

  if (isUsingMysql) {
    const [result] = await pool.execute(sql, params);
    const res = result as mysql.ResultSetHeader;
    return {
      affectedRows: res.affectedRows,
      insertId: res.insertId,
    };
  }

  // SQLite execution
  const cParams = cleanParams(params);
  const stmt = sqliteDb.prepare(sql);
  const info = stmt.run(...cParams);
  return {
    affectedRows: Number(info.changes || 0),
    insertId: Number(info.lastInsertRowid || 0),
  };
}

export async function getDb() {
  await testConnection();
  return { pool, query, execute, isUsingMysql };
}

export function getDbInfo() {
  return {
    database: isUsingMysql ? 'mysql' : 'sqlite',
    host: isUsingMysql ? DB_HOST : 'local-relational',
    ready: true,
  };
}
