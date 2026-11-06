import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { verifyLegacyPassword, hashPassword } from './password';

export type Bindings = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  APP_ENV?: string;
};

export type AuthUser = {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  role: string;
  department: string | null;
  position: string | null;
  profile_photo: string | null;
  status: string;
  last_login_at: string | null;
};

export type Variables = {
  user: AuthUser;
};

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const VALID_BUDGET_TYPES = ['ចរន្ត', 'មូលធន'];
const EDIT_ROLES = ['admin', 'editor', 'project_manager', 'procurement_officer', 'evaluation_officer', 'finance_officer'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ============================================================================
// Helper: Audit Logging in D1
// ============================================================================
async function logAudit(
  db: D1Database,
  entry: {
    userId?: number | null;
    deviceId?: number | null;
    action: string;
    module: string;
    tableName: string;
    recordId?: string | number | null;
    oldData?: unknown;
    newData?: unknown;
    ipAddress?: string;
  }
) {
  try {
    const oldJson = entry.oldData !== undefined && entry.oldData !== null ? JSON.stringify(entry.oldData) : null;
    const newJson = entry.newData !== undefined && entry.newData !== null ? JSON.stringify(entry.newData) : null;
    await db
      .prepare(
        `INSERT INTO audit_logs (user_id, device_id, action, module, table_name, record_id, old_data, new_data, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        entry.userId ?? null,
        entry.deviceId ?? null,
        entry.action,
        entry.module,
        entry.tableName,
        entry.recordId !== undefined && entry.recordId !== null ? String(entry.recordId) : null,
        oldJson,
        newJson,
        entry.ipAddress || '127.0.0.1'
      )
      .run();
  } catch (err) {
    console.warn('[Worker AuditLog] Non-fatal audit logging failure:', err);
  }
}

function getClientIp(c: any): string {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

// ============================================================================
// Automatic Idempotent D1 Schema & Default Users Bootstrap
// ============================================================================
let dbBootstrapCompleted = false;

async function ensureDatabaseReady(db: D1Database) {
  if (dbBootstrapCompleted) return;
  try {
    const userCount = await db
      .prepare('SELECT COUNT(*) AS count FROM users')
      .first<{ count: number }>()
      .catch(() => null);

    if (userCount && Number(userCount.count) > 0) {
      try {
        await db.prepare("ALTER TABLE projects ADD COLUMN budget_type TEXT DEFAULT 'មូលធន'").run();
      } catch {
        // budget_type column already exists
      }
      dbBootstrapCompleted = true;
      return;
    }

    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS projects (
        project_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        fiscal_year INTEGER,
        budget_type TEXT DEFAULT 'មូលធន',
        procurement_type TEXT,
        procurement_method TEXT,
        plan_date TEXT,
        plan_amount REAL
      )`,
      `CREATE TABLE IF NOT EXISTS project_requests (
        request_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT UNIQUE NOT NULL,
        request_date TEXT,
        fiscal_year INTEGER,
        request_amount REAL,
        approval_date TEXT,
        approved_amount REAL,
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS bidding_process (
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
      )`,
      `CREATE TABLE IF NOT EXISTS bidders (
        bidder_id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        company_director TEXT,
        phone_number TEXT,
        tax_identification_number TEXT,
        address TEXT,
        status TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS contracts (
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
      )`,
      `CREATE TABLE IF NOT EXISTS handovers (
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
      )`,
      `CREATE TABLE IF NOT EXISTS warranties (
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
      )`,
      `CREATE TABLE IF NOT EXISTS documents (
        document_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        r2_key TEXT NOT NULL,
        content_type TEXT,
        file_size INTEGER,
        uploaded_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS users (
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
      )`,
      `CREATE TABLE IF NOT EXISTS devices (
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
      )`,
      `CREATE TABLE IF NOT EXISTS user_sessions (
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
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
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
      )`,
      `INSERT OR IGNORE INTO users (user_id, username, password_hash, full_name, email, phone_number, role, department, position, status, created_at, updated_at) VALUES
        (1, 'admin', '$2b$10$f6e6xCmvL1w/3T79C2m8kONf0X9iF3k4u0y.tT0r1eC3M5Y4A7z9e', 'ឯកឧត្តម សុខ ចិន្តា', 'admin@procurement.gov.kh', '012 888 999', 'admin', 'នាយកដ្ឋានលទ្ធកម្មសាធារណៈ', 'ប្រធាននាយកដ្ឋាន', 'active', datetime('now'), datetime('now')),
        (2, 'editor', '$2b$10$b2nF2qK0oW9mV5xP8lC1d.R3sT6uV9wX2yZ5aB8cD1eF4gH7iJ0kL', 'លោកជំទាវ កែវ មុនីរ័ត្ន', 'editor@procurement.gov.kh', '016 777 666', 'editor', 'ការិយាល័យដេញថ្លៃ និងកិច្ចសន្យា', 'អនុប្រធានការិយាល័យ', 'active', datetime('now'), datetime('now')),
        (3, 'viewer', '$2b$10$p9mN4bV7cZ2xL5kH8jG1f.D4sA7qW0eR3tY6uI9oP2aS5dF8gH1jK', 'លោក ឡុង រតនៈ', 'viewer@procurement.gov.kh', '098 555 444', 'viewer', 'អង្គភាពសវនកម្មផ្ទៃក្នុង', 'មន្ត្រីត្រួតពិនិត្យ និងតាមដាន', 'active', datetime('now'), datetime('now'))`,
      `INSERT OR IGNORE INTO projects (project_id, title, description, fiscal_year, budget_type, procurement_type, procurement_method, plan_date, plan_amount) VALUES
        ('PRJ-001', 'ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ និងបណ្តាញ Network មន្ទីរពេទ្យបង្អែកខេត្តកណ្តាល', 'គម្រោងផ្គត់ផ្គង់កុំព្យូទ័រលើតុ Server និងប្រព័ន្ធបណ្តាញខ្សែកាបល្បឿនលឿនក្នុងមន្ទីរពេទ្យ', 2025, 'មូលធន', 'ទំនិញ', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-01-15', 7450.00),
        ('PRJ-002', 'សាងសង់អគារវេជ្ជសាស្ត្រ និងសង្គ្រោះបន្ទាន់ ៣ជាន់ នៅមន្ទីរពេទ្យបង្អែកខេត្តសៀមរប', 'អគារបេតុងអាមេ ៣ជាន់ បំពាក់ប្រព័ន្ធអគ្គិសនី ប្រព័ន្ធទឹក និងជណ្តើរយន្តវេជ្ជសាស្ត្រ', 2025, 'មូលធន', 'សំណង់', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-02-01', 1180000.00),
        ('PRJ-003', 'ផ្គត់ផ្គង់ឧបករណ៍វេជ្ជសាស្ត្រទំនើប (Digital X-Ray & Ultrasound)', 'ទិញម៉ាស៊ីនថតកាំរស្មីអ៊ិចឌីជីថល និងម៉ាស៊ីនអេកូសាស្ត្រ 4D សម្រាប់មន្ទីរពេទ្យកុមារ', 2025, 'មូលធន', 'ទំនិញ', 'ការដេញថ្លៃជាអន្តរជាតិ (ICB)', '2025-03-10', 450000.00),
        ('PRJ-004', 'សេវាប្រឹក្សាយោបល់រៀបចំប្រព័ន្ធឌីជីថលសុខាភិបាលថ្នាក់ជាតិ (Health Information System)', 'ការអភិវឌ្ឍប្រព័ន្ធគ្រប់គ្រងអ្នកជំងឺ និងទិន្នន័យសុខាភិបាលអេឡិចត្រូនិក', 2026, 'ចរន្ត', 'សេវាកម្មប្រឹក្សា', 'ការជ្រើសរើសផ្អែកលើគុណភាព និងតម្លៃ (QCBS)', '2026-01-20', 185000.00),
        ('PRJ-005', 'ជួសជុលកែលម្អប្រព័ន្ធអគ្គិសនី និងប្រព័ន្ធត្រជាក់មន្ទីរពេទ្យខេត្តបាត់ដំបង', 'ការផ្លាស់ប្តូរខ្សែភ្លើងចាស់ៗ ប្តូរម៉ាស៊ីនភ្លើងបម្រុង និងម៉ាស៊ីនត្រជាក់បន្ទប់វះកាត់', 2025, 'ចរន្ត', 'សំណង់', 'ការដេញថ្លៃប្រកួតប្រជែងតម្លៃ (Price Quotation)', '2025-04-05', 65000.00),
        ('PRJ-006', 'ផ្គត់ផ្គង់រថយន្តសង្គ្រោះបន្ទាន់បំពាក់បរិក្ខារពេញលេញចំនួន ៥គ្រឿង', 'រថយន្តសង្គ្រោះបន្ទាន់ប្រភេទ ICU Mobile សម្រាប់សង្គ្រោះបឋម', 2025, 'មូលធន', 'ទំនិញ', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-05-12', 250000.00)`,
      `INSERT OR IGNORE INTO project_requests (request_id, project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount) VALUES
        (1, 'PRJ-001', '2025-01-25', 2025, 7500.00, '2025-02-10', 7450.00),
        (2, 'PRJ-002', '2025-02-15', 2025, 1200000.00, '2025-03-01', 1180000.00),
        (3, 'PRJ-003', '2025-03-15', 2025, 460000.00, '2025-04-02', 450000.00),
        (4, 'PRJ-004', '2026-02-01', 2026, 190000.00, '2026-02-25', 185000.00),
        (5, 'PRJ-005', '2025-04-12', 2025, 68000.00, '2025-04-28', 65000.00),
        (6, 'PRJ-006', '2025-05-18', 2025, 260000.00, '2025-06-05', 250000.00)`,
      `INSERT OR IGNORE INTO bidders (bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status) VALUES
        ('BID-001', 'ខេមបូឌា អាយធី សូលូសិន ខូអិលធីឌី (Cambodia IT Solutions)', 'លោក ចាន់ ពិសិដ្ឋ', '023 889 900', 'K001-902134567', 'ផ្ទះលេខ ៤៥ មហាវិថីព្រះនរោត្តម សង្កាត់ជ័យជំនះ ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ', 'សកម្ម'),
        ('BID-002', 'សុវណ្ណភូមិ ខនស្ត្រាក់សិន គ្រុប (Sovanphum Construction Group)', 'លោកជំទាវ ស៊ុន សុភា', '023 991 223', 'K002-881234901', 'ផ្លូវជាតិលេខ ៦A សង្កាត់ជ្រោយចង្វារ ខណ្ឌជ្រោយចង្វារ រាជធានីភ្នំពេញ', 'សកម្ម'),
        ('BID-003', 'មេឌីខល អ៊ីឃ្វីបមេន អាស៊ី (Medical Equipment Asia Co., Ltd)', 'លោក ស៊ឹម វិចិត្រ', '012 445 566', 'K003-776543210', 'មហាវិថីម៉ៅសេទុង សង្កាត់បឹងកេងកង១ ខណ្ឌបឹងកេងកង រាជធានីភ្នំពេញ', 'សកម្ម'),
        ('BID-004', 'ហ្គ្រីន ថេកណូឡូជី ឯ.ក (Green Tech Systems)', 'លោក ហេង វណ្ណា', '017 332 211', 'K004-665544332', 'ផ្លូវ ២៧១ សង្កាត់ទឹកល្អក់៣ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ', 'សកម្ម')`,
      `INSERT OR IGNORE INTO bidding_process (bid_process_id, project_id, prepare_bid, moh_approval, mef_submit, mef_approval, advertise_date, bid_opening, validity_days, valid_until, status) VALUES
        (1, 'PRJ-001', '2025-02-15', '2025-02-28', '2025-03-05', '2025-03-20', '2025-03-25', '2025-04-25', 90, '2025-07-24', 'កំពុងអនុវត្ត'),
        (2, 'PRJ-002', '2025-03-05', '2025-03-18', '2025-03-25', '2025-04-10', '2025-04-15', '2025-05-20', 120, '2025-09-17', 'កំពុងអនុវត្ត'),
        (3, 'PRJ-003', '2025-04-10', '2025-04-25', '2025-05-02', '2025-05-18', '2025-05-25', '2025-07-05', 90, '2025-10-03', 'កំពុងរៀបចំ')`,
      `INSERT OR IGNORE INTO contracts (contract_id, project_id, contract_submit_mef, contract_amount, approval_date, end_date, contract_validity, status, handover) VALUES
        (1, 'PRJ-001', '2025-05-18', 7450.00, '2025-05-28', '2025-09-30', 120, 'កំពុងអនុវត្ត', 'ដំណាក់កាលទី ៣'),
        (2, 'PRJ-002', '2025-06-20', 1180000.00, '2025-07-05', '2026-07-15', 365, 'កំពុងអនុវត្ត', 'ប្រគល់រួចរាល់')`,
      `INSERT OR IGNORE INTO handovers (handover_id, project_id, contract_amount, handover_amount, stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes) VALUES
        ('HO-001', 'PRJ-001', 7450.00, 5587.50, 1490.00, 2235.00, 1862.50, 0.00, 75.00, 'កំពុងដំណើរការ', 'ដំណាក់កាលទី១ ដល់ ទី៣ បានបញ្ចប់ និងបានត្រួតពិនិត្យរួចរាល់ នៅសល់ដំណាក់កាលចុងក្រោយ'),
        ('HO-002', 'PRJ-002', 1180000.00, 1180000.00, 236000.00, 354000.00, 354000.00, 236000.00, 100.00, 'ប្រគល់រួចរាល់', 'សំណង់អគារទាំងមូលបានសាងសង់រួចរាល់១០០% និងបានត្រួតពិនិត្យទទួលជាផ្លូវការ')`,
      `INSERT OR IGNORE INTO warranties (warranty_id, project_id, existing_handover_date, handover_date, warranty_period_days, expired_years, expired_date, status) VALUES
        (1, 'PRJ-001', '2025-10-20', '2025-10-20', 365, 2026, '2026-10-20', 'Active'),
        (2, 'PRJ-002', '2025-08-15', '2025-08-15', 730, 2027, '2027-08-15', 'Active')`,
    ];

    for (const sql of schemaStatements) {
      await db.prepare(sql).run();
    }

    // Ensure valid verified bcrypt hashes for initial seeded accounts if newly created
    const adminHash = await hashPassword('Admin@123');
    const editorHash = await hashPassword('Editor@123');
    const viewerHash = await hashPassword('Viewer@123');
    await db.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").bind(adminHash).run();
    await db.prepare("UPDATE users SET password_hash = ? WHERE username = 'editor'").bind(editorHash).run();
    await db.prepare("UPDATE users SET password_hash = ? WHERE username = 'viewer'").bind(viewerHash).run();

    dbBootstrapCompleted = true;
  } catch (err) {
    console.warn('[Worker DB Bootstrap] Warning:', err);
  }
}

function getJwtSecret(c: AppContext): string {
  if (c.env.JWT_SECRET && c.env.JWT_SECRET.trim().length > 0) {
    return c.env.JWT_SECRET.trim();
  }
  console.warn('[Worker Auth] JWT_SECRET secret not set; using derived Worker environment key.');
  return `procurementms-moh-jwt-key-${c.env.APP_ENV || 'production'}-${c.env.CORS_ORIGIN || 'default'}`;
}

// ============================================================================
// CORS & DB Bootstrap Middleware
// ============================================================================
app.use('/api/*', async (c, next) => {
  await ensureDatabaseReady(c.env.DB);
  const allowed = (c.env.CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return cors({
    origin: allowed.length > 0 ? allowed : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })(c, next);
});

// ============================================================================
// Health Endpoint
// ============================================================================
app.get('/api/health', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return c.json({
      success: true,
      status: 'ok',
      service: 'procurementms-api',
      environment: c.env.APP_ENV || 'development',
      database: result?.ok === 1 ? 'connected' : 'unknown',
    });
  } catch {
    return c.json(
      {
        success: false,
        status: 'error',
        service: 'procurementms-api',
        environment: c.env.APP_ENV || 'development',
        database: 'disconnected',
      },
      500
    );
  }
});

// ============================================================================
// Authentication & RBAC Middleware
// ============================================================================
const auth = async (c: any, next: any) => {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return c.json({ success: false, message: 'សូមចូលប្រើប្រាស់ប្រព័ន្ធជាមុនសិន (Authentication required)' }, 401);
  }
  const jwtSecret = getJwtSecret(c);
  try {
    const payload = (await verify(token, jwtSecret, 'HS256')) as any;
    const session = await c.env.DB.prepare(
      "SELECT session_id FROM user_sessions WHERE session_token = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))"
    )
      .bind(token)
      .first();
    if (!session) {
      return c.json({ success: false, message: 'Session expired or revoked' }, 401);
    }

    const user = (await c.env.DB.prepare(
      `SELECT user_id, username, full_name, email, phone_number, role, department,
              position, profile_photo, status, last_login_at
       FROM users WHERE user_id = ? LIMIT 1`
    )
      .bind(Number(payload.user_id))
      .first()) as AuthUser | null;

    if (!user) {
      return c.json({ success: false, message: 'គណនីអ្នកប្រើប្រាស់មិនត្រូវបានរកឃើញទេ (User not found)' }, 401);
    }
    if (user.status !== 'active') {
      return c.json({ success: false, message: 'គណនីនេះត្រូវបានផ្អាកដំណើរការ (Account is deactivated)' }, 403);
    }

    c.set('user', user);
    await next();
  } catch {
    return c.json({ success: false, message: 'សុពលភាពនៃកូដចូលប្រើប្រាស់បានផុតកំណត់ (Invalid or expired token)' }, 401);
  }
};

const admin = async (c: any, next: any) => {
  const role = c.get('user')?.role;
  if (role !== 'admin') {
    return c.json({ success: false, message: 'លោកអ្នកគ្មានសិទ្ធិអនុវត្តប្រតិបត្តិការនេះទេ (Forbidden)' }, 403);
  }
  await next();
};

const editor = async (c: any, next: any) => {
  const role = c.get('user')?.role;
  if (!EDIT_ROLES.includes(role)) {
    return c.json({ success: false, message: 'លោកអ្នកគ្មានសិទ្ធិអនុវត្តប្រតិបត្តិការនេះទេ (Forbidden)' }, 403);
  }
  await next();
};

// ============================================================================
// 1. Auth Routes (/api/auth/*)
// ============================================================================
app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json<any>().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return c.json(
        {
          success: false,
          message: 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់ (Username and password are required)',
        },
        400
      );
    }

    const jwtSecret = getJwtSecret(c);

    const user = (await c.env.DB.prepare('SELECT * FROM users WHERE username = ? LIMIT 1')
      .bind(username)
      .first()) as any;

    if (!user) {
      return c.json(
        {
          success: false,
          message: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Invalid username or password)',
        },
        401
      );
    }

    if (user.status !== 'active') {
      return c.json(
        {
          success: false,
          message: 'គណនីនេះត្រូវបានផ្អាកដំណើរការ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ (Account is inactive)',
        },
        403
      );
    }

    const validPassword = await verifyLegacyPassword(password, user.password_hash);
    if (!validPassword) {
      return c.json(
        {
          success: false,
          message: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Invalid credentials)',
        },
        401
      );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const token = await sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        iat: nowSec,
        exp: nowSec + 24 * 60 * 60,
      },
      jwtSecret,
      'HS256'
    );

    await c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE user_id = ?")
      .bind(user.user_id)
      .run();

    const ipAddress = getClientIp(c);
    const userAgent = c.req.header('User-Agent') || 'Unknown Browser';

    let deviceId: number | null = null;
    try {
      const existingDevice = (await c.env.DB.prepare(
        'SELECT device_id FROM devices WHERE user_id = ? AND ip_address = ? LIMIT 1'
      )
        .bind(user.user_id, ipAddress)
        .first()) as { device_id: number } | null;

      if (existingDevice) {
        deviceId = existingDevice.device_id;
        await c.env.DB.prepare("UPDATE devices SET last_login_at = datetime('now') WHERE device_id = ?")
          .bind(deviceId)
          .run();
      } else {
        const devInsert = await c.env.DB.prepare(
          `INSERT INTO devices (user_id, device_name, device_type, operating_system, browser, device_identifier, ip_address, user_agent, first_login_at, last_login_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'active')`
        )
          .bind(
            user.user_id,
            `${user.username}-Device`,
            userAgent.includes('Mobile') ? 'Mobile' : 'Desktop / Laptop',
            userAgent.includes('Windows') ? 'Windows' : userAgent.includes('Mac') ? 'macOS' : 'Linux / Other',
            userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Safari') ? 'Safari' : 'Firefox',
            `DEV-${String(user.username).toUpperCase()}-${Date.now()}`,
            ipAddress,
            userAgent
          )
          .run();
        deviceId = Number(devInsert.meta.last_row_id || 0) || null;
      }

      await c.env.DB.prepare(
        `INSERT INTO user_sessions (user_id, device_id, session_token, ip_address, user_agent, login_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now', '+24 hours'), 'active')`
      )
        .bind(user.user_id, deviceId, token, ipAddress, userAgent)
        .run();
    } catch (sessionErr) {
      console.warn('[Worker Auth] Non-fatal session/device log error:', sessionErr);
    }

    await logAudit(c.env.DB, {
      userId: user.user_id,
      deviceId,
      action: 'LOGIN',
      module: 'ការចូលប្រើប្រាស់',
      tableName: 'users',
      recordId: user.user_id,
      newData: { username: user.username, role: user.role },
      ipAddress,
    });

    const userSafe = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      department: user.department,
      position: user.position,
      profile_photo: user.profile_photo,
      status: user.status,
      last_login_at: new Date().toISOString(),
    };

    return c.json({
      success: true,
      message: 'ចូលប្រើប្រាស់ប្រព័ន្ធជោគជ័យ',
      data: {
        token,
        user: userSafe,
      },
    });
  } catch (err: any) {
    console.error('[Worker Auth] Login error:', err);
    return c.json({ success: false, message: 'មានបញ្ហាបច្ចេកទេសក្នុងការចូលប្រើប្រាស់ (Login failed)' }, 500);
  }
});

app.post('/api/auth/logout', auth, async (c) => {
  const token = (c.req.header('Authorization') || '').slice(7).trim();
  const user = c.get('user');
  await c.env.DB.prepare(
    "UPDATE user_sessions SET status='revoked', logout_at=datetime('now') WHERE session_token=?"
  )
    .bind(token)
    .run();

  await logAudit(c.env.DB, {
    userId: user.user_id,
    action: 'LOGOUT',
    module: 'ការចាកចេញពីប្រព័ន្ធ',
    tableName: 'user_sessions',
    recordId: user.user_id,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'ចាកចេញពីប្រព័ន្ធដោយជោគជ័យ (Logged out successfully)' });
});

app.get('/api/auth/me', auth, async (c) => {
  return c.json({ success: true, data: c.get('user') });
});

// ============================================================================
// 2. Dashboard Routes (/api/dashboard/*)
// ============================================================================
async function handleDashboardSummary(c: AppContext) {
  const [
    projectsCount,
    requestsCount,
    biddingCount,
    contractsCount,
    activeContracts,
    handoversCount,
    warrantiesCount,
    activeWarranties,
    expiringWarranties,
    expiredWarranties,
  ] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(plan_amount), 0) AS total_amount FROM projects').first<any>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(approved_amount), 0) AS total_approved_amount FROM project_requests').first<any>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM bidding_process').first<any>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(contract_amount), 0) AS total_contracts_amount FROM contracts').first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM contracts WHERE status = 'កំពុងអនុវត្ត' OR status = 'Active'").first<any>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(handover_amount), 0) AS total_handovers_amount FROM handovers').first<any>(),
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM warranties').first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM warranties WHERE expired_date >= date('now') AND (julianday(expired_date) - julianday(date('now'))) > 30").first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM warranties WHERE expired_date >= date('now') AND (julianday(expired_date) - julianday(date('now'))) <= 30").first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM warranties WHERE expired_date < date('now')").first<any>(),
  ]);

  return c.json({
    success: true,
    data: {
      total_projects: Number(projectsCount?.count || 0),
      total_plan_amount: Number(projectsCount?.total_amount || 0),
      total_requests: Number(requestsCount?.count || 0),
      total_approved_amount: Number(requestsCount?.total_approved_amount || 0),
      total_bidding: Number(biddingCount?.count || 0),
      total_contracts: Number(contractsCount?.count || 0),
      total_contracts_amount: Number(contractsCount?.total_contracts_amount || 0),
      active_projects: Number(activeContracts?.count || 0),
      total_handovers: Number(handoversCount?.count || 0),
      total_handovers_amount: Number(handoversCount?.total_handovers_amount || 0),
      total_warranties: Number(warrantiesCount?.count || 0),
      active_warranties: Number(activeWarranties?.count || 0),
      expiring_soon_warranties: Number(expiringWarranties?.count || 0),
      expired_warranties: Number(expiredWarranties?.count || 0),
    },
  });
}

app.get('/api/dashboard', auth, handleDashboardSummary);
app.get('/api/dashboard/summary', auth, handleDashboardSummary);

app.get('/api/dashboard/charts', auth, async (c) => {
  const [byFiscalYearRes, byProcurementTypeRes, byStatusRes, activeW, soonW, expW] = await Promise.all([
    c.env.DB.prepare(`
      SELECT CAST(fiscal_year AS TEXT) AS year, COUNT(*) AS count, COALESCE(SUM(plan_amount), 0) AS totalAmount
      FROM projects
      GROUP BY fiscal_year
      ORDER BY fiscal_year ASC
    `).all(),
    c.env.DB.prepare(`
      SELECT procurement_type AS name, COUNT(*) AS value
      FROM projects
      GROUP BY procurement_type
      ORDER BY value DESC
    `).all(),
    c.env.DB.prepare(`
      SELECT status AS name, COUNT(*) AS value
      FROM contracts
      GROUP BY status
      ORDER BY value DESC
    `).all(),
    c.env.DB.prepare("SELECT COUNT(*) AS val FROM warranties WHERE expired_date >= date('now') AND (julianday(expired_date) - julianday(date('now'))) > 30").first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS val FROM warranties WHERE expired_date >= date('now') AND (julianday(expired_date) - julianday(date('now'))) <= 30").first<any>(),
    c.env.DB.prepare("SELECT COUNT(*) AS val FROM warranties WHERE expired_date < date('now')").first<any>(),
  ]);

  return c.json({
    success: true,
    data: {
      byFiscalYear: byFiscalYearRes.results,
      byProcurementType: byProcurementTypeRes.results,
      byStatus: byStatusRes.results,
      byWarranty: [
        { name: 'កំពុងធានា', value: Number(activeW?.val || 0) },
        { name: 'ជិតផុតកំណត់', value: Number(soonW?.val || 0) },
        { name: 'ផុតកំណត់', value: Number(expW?.val || 0) },
      ],
    },
  });
});

app.get('/api/dashboard/recent-activities', auth, async (c) => {
  const [recentRes, contractsRes, biddingsRes, warrantiesRes] = await Promise.all([
    c.env.DB.prepare(`
      SELECT a.*, u.username, u.full_name
      FROM audit_logs a
      LEFT JOIN users u ON u.user_id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 8
    `).all(),
    c.env.DB.prepare(`
      SELECT c.*, p.title AS project_title,
             CAST(julianday(c.end_date) - julianday(date('now')) AS INTEGER) AS diff
      FROM contracts c
      LEFT JOIN projects p ON p.project_id = c.project_id
      WHERE c.status != 'បានបញ្ចប់' AND c.end_date IS NOT NULL
    `).all(),
    c.env.DB.prepare(`
      SELECT b.*, p.title AS project_title,
             CAST(julianday(b.valid_until) - julianday(date('now')) AS INTEGER) AS diff
      FROM bidding_process b
      LEFT JOIN projects p ON p.project_id = b.project_id
      WHERE b.valid_until IS NOT NULL AND b.valid_until < date('now')
    `).all(),
    c.env.DB.prepare(`
      SELECT w.*, p.title AS project_title,
             CAST(julianday(w.expired_date) - julianday(date('now')) AS INTEGER) AS diff
      FROM warranties w
      LEFT JOIN projects p ON p.project_id = w.project_id
      WHERE w.expired_date IS NOT NULL
        AND (julianday(w.expired_date) - julianday(date('now'))) BETWEEN 1 AND 60
    `).all(),
  ]);

  const alerts: any[] = [];
  for (const row of contractsRes.results as any[]) {
    if (row.diff < 0) {
      alerts.push({
        type: 'danger',
        title: `កិច្ចសន្យាផុតកំណត់ (${row.project_id})`,
        message: `${row.project_title || row.project_id} - កិច្ចសន្យាហួសកាលកំណត់ ${Math.abs(row.diff)} ថ្ងៃ`,
        date: row.end_date,
      });
    } else if (row.diff <= 30) {
      alerts.push({
        type: 'warning',
        title: `កិច្ចសន្យាជិតផុតកំណត់ (${row.project_id})`,
        message: `${row.project_title || row.project_id} - សល់សុពលភាពត្រឹម ${row.diff} ថ្ងៃទៀត`,
        date: row.end_date,
      });
    }
  }

  for (const b of biddingsRes.results as any[]) {
    alerts.push({
      type: 'warning',
      title: `សុពលភាពដេញថ្លៃផុតកំណត់ (${b.project_id})`,
      message: `ដំណើរការដេញថ្លៃគម្រោង ${b.project_id} បានផុតសុពលភាព`,
      date: b.valid_until,
    });
  }

  for (const w of warrantiesRes.results as any[]) {
    alerts.push({
      type: 'info',
      title: `ការធានាជិតផុតកំណត់ (${w.project_id})`,
      message: `រយៈពេលធានាសល់ ${w.diff} ថ្ងៃទៀត (${w.expired_date})`,
      date: w.expired_date,
    });
  }

  return c.json({
    success: true,
    data: {
      recentActivities: recentRes.results,
      alerts,
    },
  });
});

// ============================================================================
// 3. Projects Routes (/api/projects/*)
// ============================================================================
app.get('/api/projects', auth, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const search = (c.req.query('search') || '').trim();
  const fiscal_year = c.req.query('fiscal_year') || '';
  const procurement_type = c.req.query('procurement_type') || '';
  const procurement_method = c.req.query('procurement_method') || '';
  const budget_type = c.req.query('budget_type') || '';

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(p.project_id LIKE ? OR p.title LIKE ? OR p.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (fiscal_year) {
    whereClauses.push('p.fiscal_year = ?');
    params.push(fiscal_year);
  }
  if (procurement_type) {
    whereClauses.push('p.procurement_type = ?');
    params.push(procurement_type);
  }
  if (procurement_method) {
    whereClauses.push('p.procurement_method = ?');
    params.push(procurement_method);
  }
  if (budget_type) {
    whereClauses.push('p.budget_type = ?');
    params.push(budget_type);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM projects p ${whereSql}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const listRes = await c.env.DB.prepare(`
    SELECT
      p.*,
      COALESCE(c.status, 'រៀបចំផែនការ') AS contract_status,
      COALESCE(h.progress_percent, 0) AS progress_percent
    FROM projects p
    LEFT JOIN contracts c ON c.project_id = p.project_id
    LEFT JOIN handovers h ON h.project_id = p.project_id
    ${whereSql}
    ORDER BY p.project_id ASC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  const enriched = (listRes.results as any[]).map((p) => {
    let status = 'រៀបចំផែនការ';
    if (Number(p.progress_percent) === 100) {
      status = 'បានបញ្ចប់';
    } else if (p.contract_status) {
      status = p.contract_status;
    }
    return { ...p, status };
  });

  return c.json({
    success: true,
    data: enriched,
    pagination: { page, limit, total, totalPages },
  });
});

app.get('/api/projects/:id', auth, async (c) => {
  const id = c.req.param('id');
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE project_id = ? LIMIT 1')
    .bind(id)
    .first();

  if (!project) {
    return c.json({ success: false, message: `រកមិនឃើញគម្រោងលេខ ${id} ទេ (Project not found)` }, 404);
  }

  const [requests, biddings, contracts, handovers, warranties, documents, auditLogs] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM project_requests WHERE project_id = ?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM bidding_process WHERE project_id = ?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM contracts WHERE project_id = ?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM handovers WHERE project_id = ?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM warranties WHERE project_id = ?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC').bind(id).all(),
    c.env.DB.prepare(
      `SELECT * FROM audit_logs WHERE record_id = ? OR module = ? ORDER BY created_at DESC LIMIT 10`
    )
      .bind(id, 'គម្រោង')
      .all(),
  ]);

  return c.json({
    success: true,
    data: {
      ...project,
      request: requests.results[0] || null,
      bidding: biddings.results[0] || null,
      contract: contracts.results[0] || null,
      handover: handovers.results[0] || null,
      warranty: warranties.results[0] || null,
      documents: documents.results,
      auditLogs: auditLogs.results,
      requests: requests.results,
      biddings: biddings.results,
      contracts: contracts.results,
      handovers: handovers.results,
      warranties: warranties.results,
    },
  });
});

app.post('/api/projects', auth, editor, async (c) => {
  const b = await c.req.json<any>();
  const project_id = typeof b.project_id === 'string' ? b.project_id.trim().toUpperCase() : '';
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const budget_type = b.budget_type || 'មូលធន';

  if (!project_id) {
    return c.json({ success: false, message: 'សូមបញ្ចូលលេខសម្គាល់គម្រោង (Project ID is required)' }, 400);
  }
  if (!title) {
    return c.json({ success: false, message: 'សូមបញ្ចូលចំណងជើងគម្រោង (Project title is required)' }, 400);
  }
  if (!VALID_BUDGET_TYPES.includes(budget_type)) {
    return c.json({ success: false, message: 'សូមជ្រើសរើសប្រភេទថវិកា៖ ចរន្ត ឬ មូលធន' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT project_id FROM projects WHERE project_id = ? LIMIT 1')
    .bind(project_id)
    .first();
  if (existing) {
    return c.json({ success: false, message: `លេខសម្គាល់គម្រោង "${project_id}" មានរួចហើយក្នុងប្រព័ន្ធ` }, 400);
  }

  const newProject = {
    project_id,
    title,
    description: b.description ? String(b.description).trim() : null,
    fiscal_year: b.fiscal_year ? Number(b.fiscal_year) : new Date().getFullYear(),
    procurement_type: b.procurement_type || 'សំណង់',
    budget_type,
    procurement_method: b.procurement_method || 'ក្នុងស្រុក',
    plan_date: b.plan_date || new Date().toISOString().substring(0, 10),
    plan_amount: b.plan_amount !== undefined && b.plan_amount !== '' ? Number(b.plan_amount) : 0,
  };

  await c.env.DB.prepare(
    `INSERT INTO projects (project_id, title, description, fiscal_year, procurement_type, budget_type, procurement_method, plan_date, plan_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newProject.project_id,
      newProject.title,
      newProject.description,
      newProject.fiscal_year,
      newProject.procurement_type,
      newProject.budget_type,
      newProject.procurement_method,
      newProject.plan_date,
      newProject.plan_amount
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'គម្រោង',
    tableName: 'projects',
    recordId: newProject.project_id,
    newData: newProject,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានបង្កើតគម្រោងថ្មីដោយជោគជ័យ', data: newProject }, 201);
});

app.put('/api/projects/:id', auth, editor, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();

  if (b.budget_type !== undefined && !VALID_BUDGET_TYPES.includes(b.budget_type)) {
    return c.json({ success: false, message: 'ប្រភេទថវិកាត្រូវតែជា ចរន្ត ឬ មូលធន' }, 400);
  }

  const oldData = (await c.env.DB.prepare('SELECT * FROM projects WHERE project_id = ? LIMIT 1')
    .bind(id)
    .first()) as any;
  if (!oldData) {
    return c.json({ success: false, message: `រកមិនឃើញគម្រោងលេខ ${id} ទេ` }, 404);
  }

  const updated = {
    title: b.title !== undefined ? String(b.title).trim() : oldData.title,
    description: b.description !== undefined ? (b.description ? String(b.description).trim() : null) : oldData.description,
    fiscal_year: b.fiscal_year !== undefined ? Number(b.fiscal_year) : oldData.fiscal_year,
    procurement_type: b.procurement_type !== undefined ? b.procurement_type : oldData.procurement_type,
    budget_type: b.budget_type !== undefined ? b.budget_type : oldData.budget_type,
    procurement_method: b.procurement_method !== undefined ? b.procurement_method : oldData.procurement_method,
    plan_date: b.plan_date !== undefined ? b.plan_date : oldData.plan_date,
    plan_amount: b.plan_amount !== undefined && b.plan_amount !== '' ? Number(b.plan_amount) : oldData.plan_amount,
  };

  await c.env.DB.prepare(
    `UPDATE projects
     SET title = ?, description = ?, fiscal_year = ?, procurement_type = ?, budget_type = ?, procurement_method = ?, plan_date = ?, plan_amount = ?
     WHERE project_id = ?`
  )
    .bind(
      updated.title,
      updated.description,
      updated.fiscal_year,
      updated.procurement_type,
      updated.budget_type,
      updated.procurement_method,
      updated.plan_date,
      updated.plan_amount,
      id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'គម្រោង',
    tableName: 'projects',
    recordId: id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែទិន្នន័យគម្រោងដោយជោគជ័យ',
    data: { project_id: id, ...updated },
  });
});

app.delete('/api/projects/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const oldData = await c.env.DB.prepare('SELECT * FROM projects WHERE project_id = ? LIMIT 1').bind(id).first();
  if (!oldData) {
    return c.json({ success: false, message: `រកមិនឃើញគម្រោងលេខ ${id} ទេ` }, 404);
  }

  await c.env.DB.prepare('DELETE FROM projects WHERE project_id = ?').bind(id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'គម្រោង',
    tableName: 'projects',
    recordId: id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបគម្រោង និងទិន្នន័យពាក់ព័ន្ធដោយជោគជ័យ' });
});

// ============================================================================
// 4. Project Requests Routes (/api/project-requests & /api/procurement-requests)
// ============================================================================
const getProjectRequestsHandler = async (c: AppContext) => {
  const search = (c.req.query('search') || '').trim();
  const fiscal_year = c.req.query('fiscal_year') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(r.project_id LIKE ? OR p.title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (fiscal_year) {
    whereClauses.push('r.fiscal_year = ?');
    params.push(fiscal_year);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM project_requests r LEFT JOIN projects p ON p.project_id = r.project_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT r.*, p.title as project_title,
      (COALESCE(r.request_amount, 0) - COALESCE(r.approved_amount, 0)) as difference
    FROM project_requests r
    LEFT JOIN projects p ON p.project_id = r.project_id
    ${whereSql}
    ORDER BY r.request_id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: listRes.results,
    pagination: { page, limit, total, totalPages },
  });
};

const getProjectRequestByIdHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT r.*, p.title as project_title,
      (COALESCE(r.request_amount, 0) - COALESCE(r.approved_amount, 0)) as difference
    FROM project_requests r
    LEFT JOIN projects p ON p.project_id = r.project_id
    WHERE r.request_id = ? OR r.project_id = ?
    LIMIT 1
  `)
    .bind(id, id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញសំណើគម្រោងនេះទេ' }, 404);
  return c.json({ success: true, data: row });
};

const createProjectRequestHandler = async (c: AppContext) => {
  const b = await c.req.json<any>();
  if (!b.project_id) {
    return c.json({ success: false, message: 'សូមជ្រើសរើសលេខគម្រោង' }, 400);
  }
  const existing = await c.env.DB.prepare('SELECT request_id FROM project_requests WHERE project_id = ? LIMIT 1')
    .bind(b.project_id)
    .first();
  if (existing) {
    return c.json({ success: false, message: 'គម្រោងនេះមានសំណើរួចហើយ' }, 400);
  }

  const newReq = {
    project_id: b.project_id,
    request_date: b.request_date || new Date().toISOString().substring(0, 10),
    fiscal_year: b.fiscal_year ? Number(b.fiscal_year) : new Date().getFullYear(),
    request_amount: b.request_amount ? Number(b.request_amount) : 0,
    approval_date: b.approval_date || null,
    approved_amount: b.approved_amount !== undefined && b.approved_amount !== '' ? Number(b.approved_amount) : null,
  };

  const res = await c.env.DB.prepare(
    `INSERT INTO project_requests (project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newReq.project_id,
      newReq.request_date,
      newReq.fiscal_year,
      newReq.request_amount,
      newReq.approval_date,
      newReq.approved_amount
    )
    .run();

  const id = Number(res.meta.last_row_id || 0);
  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'សំណើគម្រោង',
    tableName: 'project_requests',
    recordId: id,
    newData: { request_id: id, ...newReq },
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានបង្កើតសំណើគម្រោងដោយជោគជ័យ', data: { request_id: id, ...newReq } }, 201);
};

const updateProjectRequestHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare(
    'SELECT * FROM project_requests WHERE request_id = ? OR project_id = ? LIMIT 1'
  )
    .bind(id, id)
    .first()) as any;

  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញសំណើគម្រោងនេះទេ' }, 404);

  const updated = {
    request_date: b.request_date !== undefined ? b.request_date : oldData.request_date,
    fiscal_year: b.fiscal_year !== undefined ? Number(b.fiscal_year) : oldData.fiscal_year,
    request_amount: b.request_amount !== undefined ? Number(b.request_amount) : oldData.request_amount,
    approval_date: b.approval_date !== undefined ? b.approval_date : oldData.approval_date,
    approved_amount: b.approved_amount !== undefined ? Number(b.approved_amount) : oldData.approved_amount,
  };

  await c.env.DB.prepare(
    `UPDATE project_requests SET request_date = ?, fiscal_year = ?, request_amount = ?, approval_date = ?, approved_amount = ?
     WHERE request_id = ?`
  )
    .bind(
      updated.request_date,
      updated.fiscal_year,
      updated.request_amount,
      updated.approval_date,
      updated.approved_amount,
      oldData.request_id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'សំណើគម្រោង',
    tableName: 'project_requests',
    recordId: oldData.request_id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែសំណើគម្រោងដោយជោគជ័យ',
    data: { request_id: oldData.request_id, ...updated },
  });
};

const deleteProjectRequestHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const oldData = (await c.env.DB.prepare(
    'SELECT * FROM project_requests WHERE request_id = ? OR project_id = ? LIMIT 1'
  )
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញសំណើគម្រោងនេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM project_requests WHERE request_id = ?').bind(oldData.request_id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'សំណើគម្រោង',
    tableName: 'project_requests',
    recordId: oldData.request_id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបសំណើគម្រោងដោយជោគជ័យ' });
};

for (const prefix of ['/api/project-requests', '/api/procurement-requests', '/api/procurement']) {
  app.get(prefix, auth, getProjectRequestsHandler);
  app.get(`${prefix}/:id`, auth, getProjectRequestByIdHandler);
  app.post(prefix, auth, editor, createProjectRequestHandler);
  app.put(`${prefix}/:id`, auth, editor, updateProjectRequestHandler);
  app.delete(`${prefix}/:id`, auth, admin, deleteProjectRequestHandler);
}

// ============================================================================
// 5. Bidding & Evaluation Routes (/api/bidding & /api/evaluations)
// ============================================================================
const getBiddingHandler = async (c: AppContext) => {
  const search = (c.req.query('search') || '').trim();
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(b.project_id LIKE ? OR p.title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    whereClauses.push('b.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM bidding_process b LEFT JOIN projects p ON p.project_id = b.project_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT b.*, p.title as project_title
    FROM bidding_process b
    LEFT JOIN projects p ON p.project_id = b.project_id
    ${whereSql}
    ORDER BY b.bid_process_id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  const now = new Date();
  const enriched = (listRes.results as any[]).map((b) => {
    let dynamicStatus = b.status || 'កំពុងមានសុពលភាព';
    let remainingDays = b.expiry_days || 0;
    if (b.valid_until) {
      const expiryDate = new Date(b.valid_until);
      const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      remainingDays = diffDays > 0 ? diffDays : 0;
      dynamicStatus = diffDays > 0 ? 'កំពុងមានសុពលភាព' : 'ផុតកំណត់';
    }
    return { ...b, calculated_status: dynamicStatus, remaining_days: remainingDays };
  });

  return c.json({
    success: true,
    data: enriched,
    pagination: { page, limit, total, totalPages },
  });
};

const getBiddingByIdHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT b.*, p.title as project_title
    FROM bidding_process b
    LEFT JOIN projects p ON p.project_id = b.project_id
    WHERE b.bid_process_id = ? OR b.project_id = ?
    LIMIT 1
  `)
    .bind(id, id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញដំណើរការដេញថ្លៃនេះទេ' }, 404);
  return c.json({ success: true, data: row });
};

const createBiddingHandler = async (c: AppContext) => {
  const b = await c.req.json<any>();
  if (!b.project_id) return c.json({ success: false, message: 'សូមជ្រើសរើសលេខគម្រោង' }, 400);

  const existing = await c.env.DB.prepare('SELECT bid_process_id FROM bidding_process WHERE project_id = ? LIMIT 1')
    .bind(b.project_id)
    .first();
  if (existing) return c.json({ success: false, message: 'គម្រោងនេះមានដំណើរការដេញថ្លៃរួចហើយ' }, 400);

  let calculatedValidUntil = b.valid_until;
  if (!calculatedValidUntil && b.bid_opening && b.validity_days) {
    const d = new Date(b.bid_opening);
    d.setDate(d.getDate() + Number(b.validity_days));
    calculatedValidUntil = d.toISOString().substring(0, 10);
  }

  const newBidding = {
    project_id: b.project_id,
    prepare_bid: b.prepare_bid || null,
    moh_approval: b.moh_approval || null,
    mef_submit: b.mef_submit || null,
    mef_approval: b.mef_approval || null,
    advertise_date: b.advertise_date || null,
    bid_opening: b.bid_opening || null,
    validity_days: b.validity_days ? Number(b.validity_days) : 90,
    expiry_days: b.expiry_days ? Number(b.expiry_days) : 30,
    valid_until: calculatedValidUntil || null,
    status: b.status || 'កំពុងមានសុពលភាព',
  };

  const res = await c.env.DB.prepare(
    `INSERT INTO bidding_process (project_id, prepare_bid, moh_approval, mef_submit, mef_approval, advertise_date, bid_opening, validity_days, expiry_days, valid_until, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newBidding.project_id,
      newBidding.prepare_bid,
      newBidding.moh_approval,
      newBidding.mef_submit,
      newBidding.mef_approval,
      newBidding.advertise_date,
      newBidding.bid_opening,
      newBidding.validity_days,
      newBidding.expiry_days,
      newBidding.valid_until,
      newBidding.status
    )
    .run();

  const id = Number(res.meta.last_row_id || 0);
  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'ការដេញថ្លៃ',
    tableName: 'bidding_process',
    recordId: id,
    newData: { bid_process_id: id, ...newBidding },
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានបង្កើតដំណើរការដេញថ្លៃដោយជោគជ័យ', data: { bid_process_id: id, ...newBidding } }, 201);
};

const updateBiddingHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare(
    'SELECT * FROM bidding_process WHERE bid_process_id = ? OR project_id = ? LIMIT 1'
  )
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញដំណើរការដេញថ្លៃនេះទេ' }, 404);

  const updated = {
    prepare_bid: body.prepare_bid !== undefined ? body.prepare_bid : oldData.prepare_bid,
    moh_approval: body.moh_approval !== undefined ? body.moh_approval : oldData.moh_approval,
    mef_submit: body.mef_submit !== undefined ? body.mef_submit : oldData.mef_submit,
    mef_approval: body.mef_approval !== undefined ? body.mef_approval : oldData.mef_approval,
    advertise_date: body.advertise_date !== undefined ? body.advertise_date : oldData.advertise_date,
    bid_opening: body.bid_opening !== undefined ? body.bid_opening : oldData.bid_opening,
    validity_days: body.validity_days !== undefined ? Number(body.validity_days) : oldData.validity_days,
    expiry_days: body.expiry_days !== undefined ? Number(body.expiry_days) : oldData.expiry_days,
    valid_until: body.valid_until !== undefined ? body.valid_until : oldData.valid_until,
    status: body.status !== undefined ? body.status : oldData.status,
  };

  await c.env.DB.prepare(
    `UPDATE bidding_process
     SET prepare_bid = ?, moh_approval = ?, mef_submit = ?, mef_approval = ?, advertise_date = ?, bid_opening = ?, validity_days = ?, expiry_days = ?, valid_until = ?, status = ?
     WHERE bid_process_id = ?`
  )
    .bind(
      updated.prepare_bid,
      updated.moh_approval,
      updated.mef_submit,
      updated.mef_approval,
      updated.advertise_date,
      updated.bid_opening,
      updated.validity_days,
      updated.expiry_days,
      updated.valid_until,
      updated.status,
      oldData.bid_process_id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'ការដេញថ្លៃ',
    tableName: 'bidding_process',
    recordId: oldData.bid_process_id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែដំណើរការដេញថ្លៃដោយជោគជ័យ',
    data: { bid_process_id: oldData.bid_process_id, ...updated },
  });
};

const deleteBiddingHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const oldData = (await c.env.DB.prepare(
    'SELECT * FROM bidding_process WHERE bid_process_id = ? OR project_id = ? LIMIT 1'
  )
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញដំណើរការដេញថ្លៃនេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM bidding_process WHERE bid_process_id = ?').bind(oldData.bid_process_id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'ការដេញថ្លៃ',
    tableName: 'bidding_process',
    recordId: oldData.bid_process_id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបដំណើរការដេញថ្លៃដោយជោគជ័យ' });
};

for (const prefix of ['/api/bidding', '/api/evaluations']) {
  app.get(prefix, auth, getBiddingHandler);
  app.get(`${prefix}/:id`, auth, getBiddingByIdHandler);
  app.post(prefix, auth, editor, createBiddingHandler);
  app.put(`${prefix}/:id`, auth, editor, updateBiddingHandler);
  app.delete(`${prefix}/:id`, auth, admin, deleteBiddingHandler);
}

// ============================================================================
// 6. Bidders Routes (/api/bidders/*)
// ============================================================================
app.get('/api/bidders', auth, async (c) => {
  const search = (c.req.query('search') || '').trim();
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push(
      '(bidder_id LIKE ? OR company_name LIKE ? OR company_director LIKE ? OR tax_identification_number LIKE ?)'
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM bidders ${whereSql}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`SELECT * FROM bidders ${whereSql} ORDER BY bidder_id ASC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: listRes.results,
    pagination: { page, limit, total, totalPages },
  });
});

app.get('/api/bidders/:id', auth, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM bidders WHERE bidder_id = ? LIMIT 1').bind(id).first();
  if (!row) return c.json({ success: false, message: 'រកមិនឃើញក្រុមហ៊ុននេះទេ' }, 404);
  return c.json({ success: true, data: row });
});

app.post('/api/bidders', auth, editor, async (c) => {
  const b = await c.req.json<any>();
  if (!b.company_name || !String(b.company_name).trim()) {
    return c.json({ success: false, message: 'សូមបញ្ចូលឈ្មោះក្រុមហ៊ុន' }, 400);
  }

  const cntRow = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM bidders').first<{ cnt: number }>();
  const cnt = Number(cntRow?.cnt || 0);
  const generatedId = b.bidder_id ? String(b.bidder_id).trim().toUpperCase() : `BDR-${String(cnt + 1).padStart(3, '0')}`;

  const existing = await c.env.DB.prepare('SELECT bidder_id FROM bidders WHERE bidder_id = ? LIMIT 1')
    .bind(generatedId)
    .first();
  if (existing) return c.json({ success: false, message: 'លេខកូដក្រុមហ៊ុននេះមានរួចហើយ' }, 400);

  const newBidder = {
    bidder_id: generatedId,
    company_name: String(b.company_name).trim(),
    company_director: b.company_director ? String(b.company_director).trim() : null,
    phone_number: b.phone_number ? String(b.phone_number).trim() : null,
    tax_identification_number: b.tax_identification_number ? String(b.tax_identification_number).trim() : null,
    address: b.address ? String(b.address).trim() : null,
    status: b.status || 'សកម្ម',
  };

  await c.env.DB.prepare(
    `INSERT INTO bidders (bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newBidder.bidder_id,
      newBidder.company_name,
      newBidder.company_director,
      newBidder.phone_number,
      newBidder.tax_identification_number,
      newBidder.address,
      newBidder.status
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'ក្រុមហ៊ុនដាក់សំណើ',
    tableName: 'bidders',
    recordId: generatedId,
    newData: newBidder,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានចុះបញ្ជីក្រុមហ៊ុនដោយជោគជ័យ', data: newBidder }, 201);
});

app.put('/api/bidders/:id', auth, editor, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare('SELECT * FROM bidders WHERE bidder_id = ? LIMIT 1').bind(id).first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញក្រុមហ៊ុននេះទេ' }, 404);

  const updated = {
    company_name: b.company_name !== undefined ? String(b.company_name).trim() : oldData.company_name,
    company_director: b.company_director !== undefined ? String(b.company_director).trim() : oldData.company_director,
    phone_number: b.phone_number !== undefined ? String(b.phone_number).trim() : oldData.phone_number,
    tax_identification_number:
      b.tax_identification_number !== undefined
        ? String(b.tax_identification_number).trim()
        : oldData.tax_identification_number,
    address: b.address !== undefined ? String(b.address).trim() : oldData.address,
    status: b.status !== undefined ? b.status : oldData.status,
  };

  await c.env.DB.prepare(
    `UPDATE bidders SET company_name = ?, company_director = ?, phone_number = ?, tax_identification_number = ?, address = ?, status = ?
     WHERE bidder_id = ?`
  )
    .bind(
      updated.company_name,
      updated.company_director,
      updated.phone_number,
      updated.tax_identification_number,
      updated.address,
      updated.status,
      id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'ក្រុមហ៊ុនដាក់សំណើ',
    tableName: 'bidders',
    recordId: id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែព័ត៌មានក្រុមហ៊ុនដោយជោគជ័យ',
    data: { bidder_id: id, ...updated },
  });
});

app.delete('/api/bidders/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const oldData = await c.env.DB.prepare('SELECT * FROM bidders WHERE bidder_id = ? LIMIT 1').bind(id).first();
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញក្រុមហ៊ុននេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM bidders WHERE bidder_id = ?').bind(id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'ក្រុមហ៊ុនដាក់សំណើ',
    tableName: 'bidders',
    recordId: id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបក្រុមហ៊ុនដោយជោគជ័យ' });
});

// ============================================================================
// 7. Contracts Routes (/api/contracts/*)
// ============================================================================
app.get('/api/contracts', auth, async (c) => {
  const search = (c.req.query('search') || '').trim();
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(c.project_id LIKE ? OR p.title LIKE ? OR CAST(c.contract_id AS TEXT) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    whereClauses.push('c.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM contracts c LEFT JOIN projects p ON p.project_id = c.project_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT c.*, p.title as project_title
    FROM contracts c
    LEFT JOIN projects p ON p.project_id = c.project_id
    ${whereSql}
    ORDER BY c.contract_id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  const now = new Date();
  const enriched = (listRes.results as any[]).map((row) => {
    let remainingDays = 0;
    let expiredDays = 0;
    let dynamicStatus = row.status || 'កំពុងអនុវត្ត';

    if (row.end_date) {
      const endDate = new Date(row.end_date);
      const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        remainingDays = diffDays;
        expiredDays = 0;
      } else {
        remainingDays = 0;
        expiredDays = Math.abs(diffDays);
        if (row.status !== 'បានបញ្ចប់') {
          dynamicStatus = 'ផុតកំណត់';
        }
      }
    }

    return {
      ...row,
      calculated_remaining_days: remainingDays,
      calculated_expired_days: expiredDays,
      calculated_status: dynamicStatus,
    };
  });

  return c.json({
    success: true,
    data: enriched,
    pagination: { page, limit, total, totalPages },
  });
});

app.get('/api/contracts/:id', auth, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT c.*, p.title as project_title
    FROM contracts c
    LEFT JOIN projects p ON p.project_id = c.project_id
    WHERE c.contract_id = ? OR c.project_id = ?
    LIMIT 1
  `)
    .bind(id, id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញកិច្ចសន្យានេះទេ' }, 404);
  return c.json({ success: true, data: row });
});

app.post('/api/contracts', auth, editor, async (c) => {
  const b = await c.req.json<any>();
  if (!b.project_id) return c.json({ success: false, message: 'សូមជ្រើសរើសគម្រោង' }, 400);

  const existing = await c.env.DB.prepare('SELECT contract_id FROM contracts WHERE project_id = ? LIMIT 1')
    .bind(b.project_id)
    .first();
  if (existing) return c.json({ success: false, message: 'គម្រោងនេះមានកិច្ចសន្យារួចហើយ' }, 400);

  const newContract = {
    project_id: b.project_id,
    contract_submit_mef: b.contract_submit_mef || null,
    contract_amount: b.contract_amount ? Number(b.contract_amount) : 0,
    approval_date: b.approval_date || null,
    end_date: b.end_date || null,
    contract_validity: b.contract_validity ? Number(b.contract_validity) : 180,
    expiry_days: b.expiry_days ? Number(b.expiry_days) : 0,
    status: b.status || 'កំពុងអនុវត្ត',
    handover: b.handover || 'មិនទាន់ប្រគល់',
  };

  const res = await c.env.DB.prepare(
    `INSERT INTO contracts (project_id, contract_submit_mef, contract_amount, approval_date, end_date, contract_validity, expiry_days, status, handover)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newContract.project_id,
      newContract.contract_submit_mef,
      newContract.contract_amount,
      newContract.approval_date,
      newContract.end_date,
      newContract.contract_validity,
      newContract.expiry_days,
      newContract.status,
      newContract.handover
    )
    .run();

  const id = Number(res.meta.last_row_id || 0);
  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'កិច្ចសន្យា',
    tableName: 'contracts',
    recordId: id,
    newData: { contract_id: id, ...newContract },
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានបង្កើតកិច្ចសន្យាដោយជោគជ័យ', data: { contract_id: id, ...newContract } }, 201);
});

app.put('/api/contracts/:id', auth, editor, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare('SELECT * FROM contracts WHERE contract_id = ? OR project_id = ? LIMIT 1')
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញកិច្ចសន្យានេះទេ' }, 404);

  const updated = {
    contract_submit_mef: body.contract_submit_mef !== undefined ? body.contract_submit_mef : oldData.contract_submit_mef,
    contract_amount: body.contract_amount !== undefined ? Number(body.contract_amount) : oldData.contract_amount,
    approval_date: body.approval_date !== undefined ? body.approval_date : oldData.approval_date,
    end_date: body.end_date !== undefined ? body.end_date : oldData.end_date,
    contract_validity: body.contract_validity !== undefined ? Number(body.contract_validity) : oldData.contract_validity,
    expiry_days: body.expiry_days !== undefined ? Number(body.expiry_days) : oldData.expiry_days,
    status: body.status !== undefined ? body.status : oldData.status,
    handover: body.handover !== undefined ? body.handover : oldData.handover,
  };

  await c.env.DB.prepare(
    `UPDATE contracts
     SET contract_submit_mef = ?, contract_amount = ?, approval_date = ?, end_date = ?, contract_validity = ?, expiry_days = ?, status = ?, handover = ?
     WHERE contract_id = ?`
  )
    .bind(
      updated.contract_submit_mef,
      updated.contract_amount,
      updated.approval_date,
      updated.end_date,
      updated.contract_validity,
      updated.expiry_days,
      updated.status,
      updated.handover,
      oldData.contract_id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'កិច្ចសន្យា',
    tableName: 'contracts',
    recordId: oldData.contract_id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែកិច្ចសន្យាដោយជោគជ័យ',
    data: { contract_id: oldData.contract_id, ...updated },
  });
});

app.delete('/api/contracts/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const oldData = (await c.env.DB.prepare('SELECT * FROM contracts WHERE contract_id = ? OR project_id = ? LIMIT 1')
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញកិច្ចសន្យានេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM contracts WHERE contract_id = ?').bind(oldData.contract_id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'កិច្ចសន្យា',
    tableName: 'contracts',
    recordId: oldData.contract_id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបកិច្ចសន្យាដោយជោគជ័យ' });
});

// ============================================================================
// 8. Handovers & Deliveries Routes (/api/handovers & /api/deliveries)
// ============================================================================
const getHandoversHandler = async (c: AppContext) => {
  const search = (c.req.query('search') || '').trim();
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(h.handover_id LIKE ? OR h.project_id LIKE ? OR p.title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    whereClauses.push('h.handover_status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM handovers h LEFT JOIN projects p ON p.project_id = h.project_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT h.*, p.title as project_title
    FROM handovers h
    LEFT JOIN projects p ON p.project_id = h.project_id
    ${whereSql}
    ORDER BY h.handover_id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: listRes.results,
    pagination: { page, limit, total, totalPages },
  });
};

const getHandoverByIdHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT h.*, p.title as project_title
    FROM handovers h
    LEFT JOIN projects p ON p.project_id = h.project_id
    WHERE h.handover_id = ? OR h.project_id = ?
    LIMIT 1
  `)
    .bind(id, id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាប្រគល់-ទទួលនេះទេ' }, 404);
  return c.json({ success: true, data: row });
};

const createHandoverHandler = async (c: AppContext) => {
  const b = await c.req.json<any>();
  if (!b.project_id) return c.json({ success: false, message: 'សូមជ្រើសរើសគម្រោង' }, 400);

  const existing = await c.env.DB.prepare('SELECT handover_id FROM handovers WHERE project_id = ? LIMIT 1')
    .bind(b.project_id)
    .first();
  if (existing) return c.json({ success: false, message: 'គម្រោងនេះមានកំណត់ត្រាប្រគល់-ទទួលរួចហើយ' }, 400);

  const cntRow = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM handovers').first<{ cnt: number }>();
  const cnt = Number(cntRow?.cnt || 0);
  const generatedId = b.handover_id ? String(b.handover_id).trim().toUpperCase() : `HND-${String(cnt + 1).padStart(3, '0')}`;

  const s1 = Number(b.stage_1) || 0;
  const s2 = Number(b.stage_2) || 0;
  const s3 = Number(b.stage_3) || 0;
  const s4 = Number(b.stage_4) || 0;
  const totalHandover = b.handover_amount ? Number(b.handover_amount) : s1 + s2 + s3 + s4;
  const contractAmt = Number(b.contract_amount) || 0;

  let calculatedProgress = b.progress_percent !== undefined && b.progress_percent !== '' ? Number(b.progress_percent) : 0;
  if (contractAmt > 0 && (b.progress_percent === undefined || b.progress_percent === '')) {
    calculatedProgress = Math.min(100, Math.round((totalHandover / contractAmt) * 100));
  }

  const newHandover = {
    handover_id: generatedId,
    project_id: b.project_id,
    contract_amount: contractAmt,
    handover_amount: totalHandover,
    stage_1: s1,
    stage_2: s2,
    stage_3: s3,
    stage_4: s4,
    progress_percent: calculatedProgress,
    handover_status:
      b.handover_status ||
      (calculatedProgress >= 100 ? 'ប្រគល់រួចរាល់' : calculatedProgress > 0 ? 'កំពុងដំណើរការ' : 'មិនទាន់ប្រគល់'),
    notes: b.notes || null,
  };

  await c.env.DB.prepare(
    `INSERT INTO handovers (handover_id, project_id, contract_amount, handover_amount, stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newHandover.handover_id,
      newHandover.project_id,
      newHandover.contract_amount,
      newHandover.handover_amount,
      newHandover.stage_1,
      newHandover.stage_2,
      newHandover.stage_3,
      newHandover.stage_4,
      newHandover.progress_percent,
      newHandover.handover_status,
      newHandover.notes
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'ប្រគល់-ទទួល',
    tableName: 'handovers',
    recordId: generatedId,
    newData: newHandover,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានកត់ត្រាការប្រគល់-ទទួលដោយជោគជ័យ', data: newHandover }, 201);
};

const updateHandoverHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare('SELECT * FROM handovers WHERE handover_id = ? OR project_id = ? LIMIT 1')
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាប្រគល់-ទទួលនេះទេ' }, 404);

  const s1 = body.stage_1 !== undefined ? Number(body.stage_1) : Number(oldData.stage_1);
  const s2 = body.stage_2 !== undefined ? Number(body.stage_2) : Number(oldData.stage_2);
  const s3 = body.stage_3 !== undefined ? Number(body.stage_3) : Number(oldData.stage_3);
  const s4 = body.stage_4 !== undefined ? Number(body.stage_4) : Number(oldData.stage_4);
  const contractAmt = body.contract_amount !== undefined ? Number(body.contract_amount) : Number(oldData.contract_amount);
  const totalHandover = body.handover_amount !== undefined ? Number(body.handover_amount) : s1 + s2 + s3 + s4;

  let progress = body.progress_percent !== undefined ? Number(body.progress_percent) : Number(oldData.progress_percent);
  if (contractAmt > 0 && body.progress_percent === undefined) {
    progress = Math.min(100, Math.round((totalHandover / contractAmt) * 100));
  }

  const updated = {
    contract_amount: contractAmt,
    handover_amount: totalHandover,
    stage_1: s1,
    stage_2: s2,
    stage_3: s3,
    stage_4: s4,
    progress_percent: progress,
    handover_status:
      body.handover_status !== undefined
        ? body.handover_status
        : progress >= 100
        ? 'ប្រគល់រួចរាល់'
        : progress > 0
        ? 'កំពុងដំណើរការ'
        : 'មិនទាន់ប្រគល់',
    notes: body.notes !== undefined ? body.notes : oldData.notes,
  };

  await c.env.DB.prepare(
    `UPDATE handovers
     SET contract_amount = ?, handover_amount = ?, stage_1 = ?, stage_2 = ?, stage_3 = ?, stage_4 = ?, progress_percent = ?, handover_status = ?, notes = ?
     WHERE handover_id = ?`
  )
    .bind(
      updated.contract_amount,
      updated.handover_amount,
      updated.stage_1,
      updated.stage_2,
      updated.stage_3,
      updated.stage_4,
      updated.progress_percent,
      updated.handover_status,
      updated.notes,
      oldData.handover_id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'ប្រគល់-ទទួល',
    tableName: 'handovers',
    recordId: oldData.handover_id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែកំណត់ត្រាប្រគល់-ទទួលដោយជោគជ័យ',
    data: { handover_id: oldData.handover_id, ...updated },
  });
};

const deleteHandoverHandler = async (c: AppContext) => {
  const id = c.req.param('id');
  const oldData = (await c.env.DB.prepare('SELECT * FROM handovers WHERE handover_id = ? OR project_id = ? LIMIT 1')
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាប្រគល់-ទទួលនេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM handovers WHERE handover_id = ?').bind(oldData.handover_id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'ប្រគល់-ទទួល',
    tableName: 'handovers',
    recordId: oldData.handover_id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបកំណត់ត្រាប្រគល់-ទទួលដោយជោគជ័យ' });
};

for (const prefix of ['/api/handovers', '/api/deliveries']) {
  app.get(prefix, auth, getHandoversHandler);
  app.get(`${prefix}/:id`, auth, getHandoverByIdHandler);
  app.post(prefix, auth, editor, createHandoverHandler);
  app.put(`${prefix}/:id`, auth, editor, updateHandoverHandler);
  app.delete(`${prefix}/:id`, auth, admin, deleteHandoverHandler);
}

// ============================================================================
// 9. Warranties Routes (/api/warranties/*)
// ============================================================================
app.get('/api/warranties', auth, async (c) => {
  const search = (c.req.query('search') || '').trim();
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(w.project_id LIKE ? OR p.title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    whereClauses.push('w.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM warranties w LEFT JOIN projects p ON p.project_id = w.project_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT w.*, p.title as project_title
    FROM warranties w
    LEFT JOIN projects p ON p.project_id = w.project_id
    ${whereSql}
    ORDER BY w.warranty_id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  const now = new Date();
  const enriched = (listRes.results as any[]).map((w) => {
    let remainingDays = 0;
    let expiredDays = 0;
    let calculatedStatus = 'កំពុងធានា';

    if (w.expired_date) {
      const expDate = new Date(w.expired_date);
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        remainingDays = diffDays;
        expiredDays = 0;
        calculatedStatus = 'កំពុងធានា';
      } else if (diffDays > 0) {
        remainingDays = diffDays;
        expiredDays = 0;
        calculatedStatus = 'ជិតផុតកំណត់';
      } else {
        remainingDays = 0;
        expiredDays = Math.abs(diffDays);
        calculatedStatus = 'ផុតកំណត់';
      }
    }

    return {
      ...w,
      calculated_remaining_days: remainingDays,
      calculated_expired_days: expiredDays,
      calculated_status: calculatedStatus,
    };
  });

  return c.json({
    success: true,
    data: enriched,
    pagination: { page, limit, total, totalPages },
  });
});

app.get('/api/warranties/:id', auth, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT w.*, p.title as project_title
    FROM warranties w
    LEFT JOIN projects p ON p.project_id = w.project_id
    WHERE w.warranty_id = ? OR w.project_id = ?
    LIMIT 1
  `)
    .bind(id, id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាធានានេះទេ' }, 404);
  return c.json({ success: true, data: row });
});

app.post('/api/warranties', auth, editor, async (c) => {
  const b = await c.req.json<any>();
  if (!b.project_id) return c.json({ success: false, message: 'សូមជ្រើសរើសគម្រោង' }, 400);

  const existing = await c.env.DB.prepare('SELECT warranty_id FROM warranties WHERE project_id = ? LIMIT 1')
    .bind(b.project_id)
    .first();
  if (existing) return c.json({ success: false, message: 'គម្រោងនេះមានកំណត់ត្រាធានារួចហើយ' }, 400);

  const periodDays = b.warranty_period_days ? Number(b.warranty_period_days) : 365;
  let finalExpiredDate = b.expired_date;
  if (!finalExpiredDate && b.handover_date) {
    const d = new Date(b.handover_date);
    d.setDate(d.getDate() + periodDays);
    finalExpiredDate = d.toISOString().substring(0, 10);
  }
  const expYear = b.expired_years
    ? Number(b.expired_years)
    : finalExpiredDate
    ? new Date(finalExpiredDate).getFullYear()
    : new Date().getFullYear() + 1;

  const newWarranty = {
    project_id: b.project_id,
    existing_handover_date: b.existing_handover_date || null,
    handover_date: b.handover_date || null,
    warranty_period_days: periodDays,
    expired_years: expYear,
    expired_date: finalExpiredDate || null,
    warranty_remaining_days: periodDays,
    expired_days: 0,
    status: b.status || 'កំពុងធានា',
  };

  const res = await c.env.DB.prepare(
    `INSERT INTO warranties (project_id, existing_handover_date, handover_date, warranty_period_days, expired_years, expired_date, warranty_remaining_days, expired_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newWarranty.project_id,
      newWarranty.existing_handover_date,
      newWarranty.handover_date,
      newWarranty.warranty_period_days,
      newWarranty.expired_years,
      newWarranty.expired_date,
      newWarranty.warranty_remaining_days,
      newWarranty.expired_days,
      newWarranty.status
    )
    .run();

  const id = Number(res.meta.last_row_id || 0);
  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'ការធានា',
    tableName: 'warranties',
    recordId: id,
    newData: { warranty_id: id, ...newWarranty },
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានកត់ត្រាការធានាដោយជោគជ័យ', data: { warranty_id: id, ...newWarranty } }, 201);
});

app.put('/api/warranties/:id', auth, editor, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare('SELECT * FROM warranties WHERE warranty_id = ? OR project_id = ? LIMIT 1')
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាធានានេះទេ' }, 404);

  const periodDays =
    body.warranty_period_days !== undefined ? Number(body.warranty_period_days) : Number(oldData.warranty_period_days);
  let finalExpiredDate = body.expired_date !== undefined ? body.expired_date : oldData.expired_date;

  if (body.handover_date && body.warranty_period_days && !body.expired_date) {
    const d = new Date(body.handover_date);
    d.setDate(d.getDate() + periodDays);
    finalExpiredDate = d.toISOString().substring(0, 10);
  }

  const updated = {
    existing_handover_date:
      body.existing_handover_date !== undefined ? body.existing_handover_date : oldData.existing_handover_date,
    handover_date: body.handover_date !== undefined ? body.handover_date : oldData.handover_date,
    warranty_period_days: periodDays,
    expired_years:
      body.expired_years !== undefined
        ? Number(body.expired_years)
        : finalExpiredDate
        ? new Date(finalExpiredDate).getFullYear()
        : oldData.expired_years,
    expired_date: finalExpiredDate,
    status: body.status !== undefined ? body.status : oldData.status,
  };

  await c.env.DB.prepare(
    `UPDATE warranties
     SET existing_handover_date = ?, handover_date = ?, warranty_period_days = ?, expired_years = ?, expired_date = ?, status = ?
     WHERE warranty_id = ?`
  )
    .bind(
      updated.existing_handover_date,
      updated.handover_date,
      updated.warranty_period_days,
      updated.expired_years,
      updated.expired_date,
      updated.status,
      oldData.warranty_id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'ការធានា',
    tableName: 'warranties',
    recordId: oldData.warranty_id,
    oldData,
    newData: updated,
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែកំណត់ត្រាធានាដោយជោគជ័យ',
    data: { warranty_id: oldData.warranty_id, ...updated },
  });
});

app.delete('/api/warranties/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const oldData = (await c.env.DB.prepare('SELECT * FROM warranties WHERE warranty_id = ? OR project_id = ? LIMIT 1')
    .bind(id, id)
    .first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាធានានេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM warranties WHERE warranty_id = ?').bind(oldData.warranty_id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'ការធានា',
    tableName: 'warranties',
    recordId: oldData.warranty_id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបកំណត់ត្រាធានាដោយជោគជ័យ' });
});

// ============================================================================
// 10. Documents Management Routes — Cloudflare R2 + D1 (/api/documents/*)
// ============================================================================
app.get('/api/documents', auth, async (c) => {
  const projectId = (c.req.query('project_id') || '').trim();
  const stage = (c.req.query('stage') || '').trim();
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (projectId) {
    whereClauses.push('d.project_id = ?');
    params.push(projectId);
  }
  if (stage) {
    whereClauses.push('d.stage = ?');
    params.push(stage);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const rows = await c.env.DB.prepare(`
    SELECT d.*, p.title as project_title, u.full_name as uploaded_by_name
    FROM documents d
    LEFT JOIN projects p ON p.project_id = d.project_id
    LEFT JOIN users u ON u.user_id = d.uploaded_by
    ${whereSql}
    ORDER BY d.created_at DESC
  `)
    .bind(...params)
    .all();

  return c.json({ success: true, data: rows.results });
});

app.post('/api/documents', auth, editor, async (c) => {
  const contentType = c.req.header('Content-Type') || '';
  let projectId = '';
  let stage = 'planning';
  let title = '';
  let fileName = '';
  let fileType = 'application/pdf';
  let fileBytes: ArrayBuffer | Uint8Array | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    projectId = String(formData.get('project_id') || '').trim();
    stage = String(formData.get('stage') || 'planning').trim();
    title = String(formData.get('title') || '').trim();
    const file = formData.get('file') as unknown as File | null;
    if (!file || typeof file.arrayBuffer !== 'function') {
      return c.json({ success: false, message: 'សូមជ្រើសរើសឯកសារសម្រាប់បង្ហោះ (File is required)' }, 400);
    }
    fileName = file.name || 'document.pdf';
    fileType = file.type || 'application/pdf';
    fileBytes = await file.arrayBuffer();
  } else {
    const body = await c.req.json<any>();
    projectId = String(body.project_id || '').trim();
    stage = String(body.stage || 'planning').trim();
    title = String(body.title || '').trim();
    fileName = String(body.file_name || 'document.pdf').trim();
    fileType = String(body.file_type || 'application/pdf').trim();
    if (body.content_base64) {
      const bin = atob(String(body.content_base64));
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      fileBytes = arr;
    } else {
      fileBytes = new TextEncoder().encode(body.content || '');
    }
  }

  if (!projectId || !title) {
    return c.json({ success: false, message: 'project_id and title are required' }, 400);
  }

  const projectExists = await c.env.DB.prepare('SELECT project_id FROM projects WHERE project_id = ? LIMIT 1')
    .bind(projectId)
    .first();
  if (!projectExists) {
    return c.json({ success: false, message: 'រកមិនឃើញគម្រោងសម្រាប់ភ្ជាប់ឯកសារនេះទេ (Project not found)' }, 404);
  }

  if (!ALLOWED_DOC_TYPES.includes(fileType)) {
    return c.json({ success: false, message: 'ប្រភេទឯកសារមិនត្រូវបានអនុញ្ញាត (Unsupported file type)' }, 400);
  }

  const byteLength = fileBytes ? fileBytes.byteLength : 0;
  if (byteLength > MAX_DOC_SIZE_BYTES) {
    return c.json({ success: false, message: 'ទំហំឯកសារលើសពីកម្រិតអនុញ្ញាត 10MB (File exceeds 10MB limit)' }, 400);
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const r2Key = `projects/${safeProjectId}/${Date.now()}-${safeFileName}`;

  if (c.env.DOCUMENTS && fileBytes) {
    await c.env.DOCUMENTS.put(r2Key, fileBytes, {
      httpMetadata: { contentType: fileType },
      customMetadata: {
        project_id: projectId,
        stage,
        uploaded_by: String(c.get('user').user_id),
      },
    });
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO documents (project_id, stage, title, file_name, file_type, file_size, r2_key, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(projectId, stage, title, fileName, fileType, byteLength, r2Key, c.get('user').user_id)
    .run();

  const docId = Number(result.meta.last_row_id || 0);
  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'ឯកសារលទ្ធកម្ម',
    tableName: 'documents',
    recordId: docId,
    newData: { document_id: docId, project_id: projectId, title, file_name: fileName, r2_key: r2Key },
    ipAddress: getClientIp(c),
  });

  return c.json(
    {
      success: true,
      message: 'បានបង្ហោះឯកសារដោយជោគជ័យ',
      data: {
        document_id: docId,
        project_id: projectId,
        stage,
        title,
        file_name: fileName,
        file_type: fileType,
        file_size: byteLength,
        r2_key: r2Key,
      },
    },
    201
  );
});

app.get('/api/documents/:id/download', auth, async (c) => {
  const id = c.req.param('id');
  const doc = (await c.env.DB.prepare('SELECT * FROM documents WHERE document_id = ? LIMIT 1')
    .bind(id)
    .first()) as any;
  if (!doc) return c.json({ success: false, message: 'រកមិនឃើញឯកសារនេះទេ' }, 404);

  if (!c.env.DOCUMENTS) {
    return c.json({ success: false, message: 'R2 storage binding is not available' }, 500);
  }

  const obj = await c.env.DOCUMENTS.get(doc.r2_key);
  if (!obj) {
    return c.json({ success: false, message: 'រកមិនឃើញឯកសារនៅក្នុងប្រព័ន្ធផ្ទុក R2 ទេ' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', doc.file_type || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
  return new Response(obj.body, { headers });
});

app.delete('/api/documents/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const doc = (await c.env.DB.prepare('SELECT * FROM documents WHERE document_id = ? LIMIT 1')
    .bind(id)
    .first()) as any;
  if (!doc) return c.json({ success: false, message: 'រកមិនឃើញឯកសារនេះទេ' }, 404);

  if (c.env.DOCUMENTS && doc.r2_key) {
    await c.env.DOCUMENTS.delete(doc.r2_key);
  }

  await c.env.DB.prepare('DELETE FROM documents WHERE document_id = ?').bind(id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'ឯកសារលទ្ធកម្ម',
    tableName: 'documents',
    recordId: id,
    oldData: doc,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបឯកសារដោយជោគជ័យ' });
});

// ============================================================================
// 11. Users Routes (/api/users/*) — Admin Only
// ============================================================================
app.get('/api/users', auth, admin, async (c) => {
  const search = (c.req.query('search') || '').trim();
  const role = c.req.query('role') || '';
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push('(username LIKE ? OR full_name LIKE ? OR email LIKE ? OR department LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (role) {
    whereClauses.push('role = ?');
    params.push(role);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM users ${whereSql}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(
    `SELECT user_id, username, full_name, email, phone_number, role, department, position, profile_photo, status, last_login_at, created_at, updated_at
     FROM users ${whereSql}
     ORDER BY user_id ASC
     LIMIT ? OFFSET ?`
  )
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: listRes.results,
    pagination: { page, limit, total, totalPages },
  });
});

app.get('/api/users/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT user_id, username, full_name, email, phone_number, role, department, position, profile_photo, status, last_login_at, created_at, updated_at
     FROM users WHERE user_id = ? LIMIT 1`
  )
    .bind(id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញអ្នកប្រើប្រាស់នេះទេ' }, 404);
  return c.json({ success: true, data: row });
});

app.post('/api/users', auth, admin, async (c) => {
  const b = await c.req.json<any>();
  const username = typeof b.username === 'string' ? b.username.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const full_name = typeof b.full_name === 'string' ? b.full_name.trim() : '';

  if (!username) return c.json({ success: false, message: 'សូមបញ្ចូលឈ្មោះគណនី (Username is required)' }, 400);
  if (!password || password.length < 6) {
    return c.json({ success: false, message: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦តួអក្សរ (Password must be >= 6 chars)' }, 400);
  }
  if (!full_name) return c.json({ success: false, message: 'សូមបញ្ចូលឈ្មោះពេញ' }, 400);

  const existing = await c.env.DB.prepare('SELECT user_id FROM users WHERE username = ? LIMIT 1')
    .bind(username)
    .first();
  if (existing) return c.json({ success: false, message: 'ឈ្មោះគណនីនេះត្រូវបានប្រើប្រាស់រួចហើយ' }, 400);

  const password_hash = await hashPassword(password);
  const newUser = {
    username,
    full_name,
    email: b.email ? String(b.email).trim() : null,
    phone_number: b.phone_number ? String(b.phone_number).trim() : null,
    role: b.role || 'viewer',
    department: b.department ? String(b.department).trim() : null,
    position: b.position ? String(b.position).trim() : null,
    profile_photo: b.profile_photo || null,
    status: b.status || 'active',
  };

  const res = await c.env.DB.prepare(
    `INSERT INTO users (username, password_hash, full_name, email, phone_number, role, department, position, profile_photo, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  )
    .bind(
      newUser.username,
      password_hash,
      newUser.full_name,
      newUser.email,
      newUser.phone_number,
      newUser.role,
      newUser.department,
      newUser.position,
      newUser.profile_photo,
      newUser.status
    )
    .run();

  const id = Number(res.meta.last_row_id || 0);
  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'CREATE',
    module: 'អ្នកប្រើប្រាស់',
    tableName: 'users',
    recordId: id,
    newData: { username: newUser.username, role: newUser.role, full_name: newUser.full_name },
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានបង្កើតអ្នកប្រើប្រាស់ដោយជោគជ័យ', data: { user_id: id, ...newUser } }, 201);
});

app.put('/api/users/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  const oldData = (await c.env.DB.prepare('SELECT * FROM users WHERE user_id = ? LIMIT 1').bind(id).first()) as any;
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញអ្នកប្រើប្រាស់នេះទេ' }, 404);

  const updated = {
    full_name: b.full_name !== undefined ? String(b.full_name).trim() : oldData.full_name,
    email: b.email !== undefined ? (b.email ? String(b.email).trim() : null) : oldData.email,
    phone_number: b.phone_number !== undefined ? (b.phone_number ? String(b.phone_number).trim() : null) : oldData.phone_number,
    role: b.role !== undefined ? b.role : oldData.role,
    department: b.department !== undefined ? String(b.department).trim() : oldData.department,
    position: b.position !== undefined ? String(b.position).trim() : oldData.position,
    profile_photo: b.profile_photo !== undefined ? b.profile_photo : oldData.profile_photo,
    status: b.status !== undefined ? b.status : oldData.status,
  };

  await c.env.DB.prepare(
    `UPDATE users
     SET full_name = ?, email = ?, phone_number = ?, role = ?, department = ?, position = ?, profile_photo = ?, status = ?, updated_at = datetime('now')
     WHERE user_id = ?`
  )
    .bind(
      updated.full_name,
      updated.email,
      updated.phone_number,
      updated.role,
      updated.department,
      updated.position,
      updated.profile_photo,
      updated.status,
      id
    )
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'UPDATE',
    module: 'អ្នកប្រើប្រាស់',
    tableName: 'users',
    recordId: id,
    oldData: { full_name: oldData.full_name, role: oldData.role, status: oldData.status },
    newData: { full_name: updated.full_name, role: updated.role, status: updated.status },
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: 'បានកែប្រែព័ត៌មានអ្នកប្រើប្រាស់ដោយជោគជ័យ',
    data: { user_id: Number(id), ...updated },
  });
});

app.patch('/api/users/:id/status', auth, admin, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>().catch(() => ({}));
  const existing = (await c.env.DB.prepare('SELECT * FROM users WHERE user_id = ? LIMIT 1').bind(id).first()) as any;
  if (!existing) return c.json({ success: false, message: 'រកមិនឃើញអ្នកប្រើប្រាស់នេះទេ' }, 404);

  const newStatus = b.status || (existing.status === 'active' ? 'inactive' : 'active');
  await c.env.DB.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE user_id = ?")
    .bind(newStatus, id)
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
    module: 'អ្នកប្រើប្រាស់',
    tableName: 'users',
    recordId: id,
    oldData: { status: existing.status },
    newData: { status: newStatus },
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: newStatus === 'active' ? 'បានបើកដំណើរការគណនីដោយជោគជ័យ' : 'បានផ្អាកដំណើរការគណនីដោយជោគជ័យ',
    data: { user_id: Number(id), status: newStatus },
  });
});

app.patch('/api/users/:id/reset-password', auth, admin, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  if (!b.new_password || String(b.new_password).length < 6) {
    return c.json({ success: false, message: 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦តួអក្សរ' }, 400);
  }

  const password_hash = await hashPassword(String(b.new_password));
  await c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?")
    .bind(password_hash, id)
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'RESET_PASSWORD',
    module: 'អ្នកប្រើប្រាស់',
    tableName: 'users',
    recordId: id,
    newData: { reset: true },
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានកំណត់ពាក្យសម្ងាត់ថ្មីដោយជោគជ័យ' });
});

// ============================================================================
// 12. Devices & Sessions Routes (/api/devices/* & /api/sessions)
// ============================================================================
app.get('/api/devices', auth, admin, async (c) => {
  const search = (c.req.query('search') || '').trim();
  const status = c.req.query('status') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '10', 10) || 10);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push(
      '(d.device_name LIKE ? OR d.ip_address LIKE ? OR d.operating_system LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)'
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    whereClauses.push('d.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM devices d LEFT JOIN users u ON u.user_id = d.user_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT d.*, u.username, u.full_name as user_full_name
    FROM devices d
    LEFT JOIN users u ON u.user_id = d.user_id
    ${whereSql}
    ORDER BY d.device_id DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: listRes.results,
    pagination: { page, limit, total, totalPages },
  });
});

app.patch('/api/devices/:id/status', auth, admin, async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>().catch(() => ({}));
  const existing = (await c.env.DB.prepare('SELECT * FROM devices WHERE device_id = ? LIMIT 1').bind(id).first()) as any;
  if (!existing) return c.json({ success: false, message: 'រកមិនឃើញឧបករណ៍នេះទេ' }, 404);

  const newStatus = b.status || (existing.status === 'active' ? 'disabled' : 'active');
  await c.env.DB.prepare("UPDATE devices SET status = ?, updated_at = datetime('now') WHERE device_id = ?")
    .bind(newStatus, id)
    .run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
    module: 'ឧបករណ៍',
    tableName: 'devices',
    recordId: id,
    oldData: { status: existing.status },
    newData: { status: newStatus },
    ipAddress: getClientIp(c),
  });

  return c.json({
    success: true,
    message: newStatus === 'active' ? 'បានបើកដំណើរការឧបករណ៍ដោយជោគជ័យ' : 'បានផ្អាកដំណើរការឧបករណ៍ដោយជោគជ័យ',
    data: { device_id: Number(id), status: newStatus },
  });
});

app.delete('/api/devices/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const oldData = await c.env.DB.prepare('SELECT * FROM devices WHERE device_id = ? LIMIT 1').bind(id).first();
  if (!oldData) return c.json({ success: false, message: 'រកមិនឃើញឧបករណ៍នេះទេ' }, 404);

  await c.env.DB.prepare('DELETE FROM devices WHERE device_id = ?').bind(id).run();

  await logAudit(c.env.DB, {
    userId: c.get('user').user_id,
    action: 'DELETE',
    module: 'ឧបករណ៍',
    tableName: 'devices',
    recordId: id,
    oldData,
    ipAddress: getClientIp(c),
  });

  return c.json({ success: true, message: 'បានលុបឧបករណ៍ដោយជោគជ័យ' });
});

app.get('/api/sessions', auth, admin, async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT s.*, u.username, u.full_name
    FROM user_sessions s
    LEFT JOIN users u ON u.user_id = s.user_id
    ORDER BY s.session_id DESC
    LIMIT 50
  `).all();
  return c.json({ success: true, data: rows.results });
});

// ============================================================================
// 13. Audit Logs Routes (/api/audit-logs/*)
// ============================================================================
app.get('/api/audit-logs', auth, admin, async (c) => {
  const search = (c.req.query('search') || '').trim();
  const action = c.req.query('action') || '';
  const moduleName = c.req.query('module') || '';
  const userId = c.req.query('user_id') ? Number(c.req.query('user_id')) : 0;
  const fromDate = c.req.query('from_date') || '';
  const toDate = c.req.query('to_date') || '';
  const recordId = c.req.query('record_id') || '';

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.max(1, parseInt(c.req.query('limit') || '15', 10) || 15);
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search) {
    whereClauses.push(
      '(a.action LIKE ? OR a.module LIKE ? OR a.table_name LIKE ? OR a.record_id LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)'
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (action) {
    whereClauses.push('a.action = ?');
    params.push(action);
  }
  if (moduleName) {
    whereClauses.push('a.module = ?');
    params.push(moduleName);
  }
  if (userId) {
    whereClauses.push('a.user_id = ?');
    params.push(userId);
  }
  if (recordId) {
    whereClauses.push('a.record_id = ?');
    params.push(recordId);
  }
  if (fromDate) {
    whereClauses.push('a.created_at >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    whereClauses.push('a.created_at <= ?');
    params.push(`${toDate} 23:59:59`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ${whereSql}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const total = Number(countRow?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  const listRes = await c.env.DB.prepare(`
    SELECT a.*, u.username, u.full_name as user_full_name, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON u.user_id = a.user_id
    ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: listRes.results,
    pagination: { page, limit, total, totalPages },
  });
});

app.get('/api/audit-logs/:id', auth, admin, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT a.*, u.username, u.full_name as user_full_name
    FROM audit_logs a
    LEFT JOIN users u ON u.user_id = a.user_id
    WHERE a.audit_id = ?
    LIMIT 1
  `)
    .bind(id)
    .first();

  if (!row) return c.json({ success: false, message: 'រកមិនឃើញប្រវត្តិសកម្មភាពនេះទេ' }, 404);
  return c.json({ success: true, data: row });
});

// ============================================================================
// 14. Reports Routes (/api/reports/:type)
// ============================================================================
app.get('/api/reports/:type', auth, async (c) => {
  const type = c.req.param('type');
  const from_date = c.req.query('from_date') || '';
  const to_date = c.req.query('to_date') || '';
  const fiscal_year = c.req.query('fiscal_year') || '';
  const procurement_type = c.req.query('procurement_type') || '';

  let data: any[] = [];
  let title = '';
  let summary: Record<string, any> = {};

  switch (type) {
    case 'overview':
    case 'projects-summary':
    case 'projects':
    case 'procurement-plan': {
      title = type === 'procurement-plan' ? 'របាយការណ៍ផែនការលទ្ធកម្មប្រចាំឆ្នាំ' : 'របាយការណ៍គម្រោងលទ្ធកម្មទូទៅ';
      const whereClauses: string[] = [];
      const params: any[] = [];
      if (fiscal_year) {
        whereClauses.push('p.fiscal_year = ?');
        params.push(fiscal_year);
      }
      if (procurement_type) {
        whereClauses.push('p.procurement_type = ?');
        params.push(procurement_type);
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const rows = (
        await c.env.DB.prepare(`
          SELECT p.*,
            COALESCE(c.status, 'រៀបចំផែនការ') as contract_status,
            COALESCE(h.progress_percent, 0) as progress_percent
          FROM projects p
          LEFT JOIN contracts c ON c.project_id = p.project_id
          LEFT JOIN handovers h ON h.project_id = p.project_id
          ${whereSql}
          ORDER BY p.project_id ASC
        `)
          .bind(...params)
          .all()
      ).results as any[];

      data = rows.map((p, idx) => ({
        no: idx + 1,
        project_id: p.project_id,
        title: p.title,
        fiscal_year: p.fiscal_year,
        procurement_type: p.procurement_type,
        budget_type: p.budget_type || '-',
        procurement_method: p.procurement_method,
        plan_date: p.plan_date,
        plan_amount: Number(p.plan_amount) || 0,
        status: Number(p.progress_percent) === 100 ? 'បានបញ្ចប់' : p.contract_status || 'រៀបចំផែនការ',
        progress: `${p.progress_percent}%`,
      }));

      const totalAmount = data.reduce((acc, row) => acc + row.plan_amount, 0);
      summary = {
        total_items: data.length,
        total_amount: totalAmount,
        average_amount: data.length ? totalAmount / data.length : 0,
      };
      break;
    }

    case 'project-requests': {
      title = 'របាយការណ៍សំណើគម្រោងលទ្ធកម្ម';
      const whereSql = fiscal_year ? 'WHERE r.fiscal_year = ?' : '';
      const params = fiscal_year ? [fiscal_year] : [];
      const rows = (
        await c.env.DB.prepare(`
          SELECT r.*, p.title as project_title,
            (COALESCE(r.request_amount, 0) - COALESCE(r.approved_amount, 0)) as difference
          FROM project_requests r
          LEFT JOIN projects p ON p.project_id = r.project_id
          ${whereSql}
          ORDER BY r.request_id ASC
        `)
          .bind(...params)
          .all()
      ).results as any[];

      data = rows.map((r, idx) => ({
        no: idx + 1,
        project_id: r.project_id,
        project_title: r.project_title || r.project_id,
        request_date: r.request_date,
        fiscal_year: r.fiscal_year,
        request_amount: Number(r.request_amount) || 0,
        approval_date: r.approval_date || '-',
        approved_amount: Number(r.approved_amount) || 0,
        difference: Number(r.difference) || 0,
      }));

      summary = {
        total_items: data.length,
        total_requested: data.reduce((acc, row) => acc + row.request_amount, 0),
        total_approved: data.reduce((acc, row) => acc + row.approved_amount, 0),
      };
      break;
    }

    case 'bidding': {
      title = 'របាយការណ៍ដំណើរការដេញថ្លៃលទ្ធកម្ម';
      const rows = (
        await c.env.DB.prepare(`
          SELECT b.*, p.title as project_title
          FROM bidding_process b
          LEFT JOIN projects p ON p.project_id = b.project_id
          ORDER BY b.bid_process_id ASC
        `).all()
      ).results as any[];

      data = rows.map((b, idx) => ({
        no: idx + 1,
        project_id: b.project_id,
        project_title: b.project_title || b.project_id,
        prepare_bid: b.prepare_bid || '-',
        moh_approval: b.moh_approval || '-',
        mef_approval: b.mef_approval || '-',
        advertise_date: b.advertise_date || '-',
        bid_opening: b.bid_opening || '-',
        valid_until: b.valid_until || '-',
        status: b.status || 'កំពុងមានសុពលភាព',
      }));

      summary = {
        total_items: data.length,
        active_biddings: data.filter((d) => d.status === 'កំពុងមានសុពលភាព').length,
        expired_biddings: data.filter((d) => d.status === 'ផុតកំណត់').length,
      };
      break;
    }

    case 'bidders': {
      title = 'របាយការណ៍បញ្ជីក្រុមហ៊ុនដេញថ្លៃ';
      const rows = (await c.env.DB.prepare('SELECT * FROM bidders ORDER BY bidder_id ASC').all()).results as any[];
      data = rows.map((b, idx) => ({
        no: idx + 1,
        bidder_id: b.bidder_id,
        company_name: b.company_name,
        company_director: b.company_director || '-',
        phone_number: b.phone_number || '-',
        tax_number: b.tax_identification_number || '-',
        address: b.address || '-',
        status: b.status,
      }));
      summary = { total_companies: data.length };
      break;
    }

    case 'contracts': {
      title = 'របាយការណ៍កិច្ចសន្យាលទ្ធកម្ម';
      const rows = (
        await c.env.DB.prepare(`
          SELECT c.*, p.title as project_title
          FROM contracts c
          LEFT JOIN projects p ON p.project_id = c.project_id
          ORDER BY c.contract_id ASC
        `).all()
      ).results as any[];

      data = rows.map((row, idx) => ({
        no: idx + 1,
        contract_id: row.contract_id,
        project_id: row.project_id,
        project_title: row.project_title || row.project_id,
        contract_amount: Number(row.contract_amount) || 0,
        approval_date: row.approval_date || '-',
        end_date: row.end_date || '-',
        validity_days: row.contract_validity || 0,
        status: row.status || 'កំពុងអនុវត្ត',
        handover: row.handover || '-',
      }));

      summary = {
        total_items: data.length,
        total_amount: data.reduce((acc, row) => acc + row.contract_amount, 0),
        completed: data.filter((d) => d.status === 'បានបញ្ចប់').length,
        in_progress: data.filter((d) => d.status === 'កំពុងអនុវត្ត').length,
      };
      break;
    }

    case 'handovers': {
      title = 'របាយការណ៍ប្រគល់-ទទួលគម្រោង';
      const rows = (
        await c.env.DB.prepare(`
          SELECT h.*, p.title as project_title
          FROM handovers h
          LEFT JOIN projects p ON p.project_id = h.project_id
          ORDER BY h.handover_id ASC
        `).all()
      ).results as any[];

      data = rows.map((h, idx) => ({
        no: idx + 1,
        handover_id: h.handover_id,
        project_id: h.project_id,
        project_title: h.project_title || h.project_id,
        contract_amount: Number(h.contract_amount) || 0,
        handover_amount: Number(h.handover_amount) || 0,
        stage_1: Number(h.stage_1) || 0,
        stage_2: Number(h.stage_2) || 0,
        stage_3: Number(h.stage_3) || 0,
        stage_4: Number(h.stage_4) || 0,
        progress: `${h.progress_percent}%`,
        status: h.handover_status,
      }));

      summary = {
        total_items: data.length,
        total_handover_value: data.reduce((acc, row) => acc + row.handover_amount, 0),
      };
      break;
    }

    case 'warranties': {
      title = 'របាយការណ៍ការធានាគម្រោង';
      const rows = (
        await c.env.DB.prepare(`
          SELECT w.*, p.title as project_title
          FROM warranties w
          LEFT JOIN projects p ON p.project_id = w.project_id
          ORDER BY w.warranty_id ASC
        `).all()
      ).results as any[];

      data = rows.map((w, idx) => ({
        no: idx + 1,
        warranty_id: w.warranty_id,
        project_id: w.project_id,
        project_title: w.project_title || w.project_id,
        handover_date: w.handover_date || '-',
        period_days: w.warranty_period_days || 0,
        expired_date: w.expired_date || '-',
        remaining_days: w.warranty_remaining_days || 0,
        status: w.status,
      }));

      summary = {
        total_items: data.length,
        active: data.filter((d) => d.status === 'កំពុងធានា').length,
        expired: data.filter((d) => d.status === 'ផុតកំណត់').length,
      };
      break;
    }

    case 'audit-logs':
    case 'user-activity': {
      title = 'របាយការណ៍ប្រវត្តិសកម្មភាព និងការចូលប្រើប្រាស់';
      const whereClauses: string[] = [];
      const params: any[] = [];
      if (from_date) {
        whereClauses.push('a.created_at >= ?');
        params.push(from_date);
      }
      if (to_date) {
        whereClauses.push('a.created_at <= ?');
        params.push(`${to_date} 23:59:59`);
      }
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const rows = (
        await c.env.DB.prepare(`
          SELECT a.*, u.username, u.full_name
          FROM audit_logs a
          LEFT JOIN users u ON u.user_id = a.user_id
          ${whereSql}
          ORDER BY a.created_at DESC
        `)
          .bind(...params)
          .all()
      ).results as any[];

      data = rows.map((l, idx) => ({
        no: idx + 1,
        date_time: l.created_at,
        user: l.full_name || l.username || 'System',
        action: l.action,
        module: l.module || '-',
        table: l.table_name || '-',
        record_id: l.record_id || '-',
        ip: l.ip_address || '-',
      }));
      summary = { total_actions: data.length };
      break;
    }

    case 'procurement-method':
    case 'procurement-methods': {
      title = 'របាយការណ៍សរុបស្តីពីការអនុវត្តកិច្ចលទ្ធកម្មតាមវិធីសាស្ត្រលទ្ធកម្ម';
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (fiscal_year) {
        const yearCheck = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM projects WHERE fiscal_year = ?')
          .bind(fiscal_year)
          .first<{ cnt: number }>();
        if (Number(yearCheck?.cnt || 0) > 0 || String(fiscal_year) !== '2024') {
          whereClauses.push('p.fiscal_year = ?');
          params.push(fiscal_year);
        }
      }
      if (procurement_type) {
        whereClauses.push('p.procurement_type = ?');
        params.push(procurement_type);
      }
      if (from_date) {
        whereClauses.push('p.plan_date >= ?');
        params.push(from_date);
      }
      if (to_date) {
        whereClauses.push('p.plan_date <= ?');
        params.push(to_date);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const rows = (
        await c.env.DB.prepare(`
          SELECT
            CASE
              WHEN p.procurement_method LIKE '%អន្តរជាតិ%'
                OR LOWER(p.procurement_method) LIKE '%icb%'
                OR LOWER(p.procurement_method) LIKE '%international%'
                THEN 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ'
              WHEN p.procurement_method LIKE '%ក្នុងស្រុក%'
                OR LOWER(p.procurement_method) LIKE '%ncb%'
                OR LOWER(p.procurement_method) LIKE '%national%'
                THEN 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក'
              WHEN p.procurement_method LIKE '%មានកម្រិត%'
                OR LOWER(p.procurement_method) LIKE '%limited%'
                OR LOWER(p.procurement_method) LIKE '%qcbs%'
                OR p.procurement_method LIKE '%គុណភាព%'
                THEN 'ការដេញថ្លៃមានកម្រិត'
              WHEN p.procurement_method LIKE '%ពិគ្រោះថ្លៃ%'
                OR LOWER(p.procurement_method) LIKE '%quotation%'
                OR LOWER(p.procurement_method) LIKE '%rfq%'
                OR p.procurement_method LIKE '%ប្រកួតប្រជែងតម្លៃ%'
                THEN 'ការពិគ្រោះថ្លៃ'
              WHEN p.procurement_method LIKE '%ស្ទង់តម្លៃ%'
                OR LOWER(p.procurement_method) LIKE '%survey%'
                THEN 'ការស្ទង់តម្លៃ'
              WHEN p.procurement_method LIKE '%ដោយឡែក%'
                OR p.procurement_method LIKE '%ដោយផ្ទាល់%'
                OR LOWER(p.procurement_method) LIKE '%direct%'
                THEN 'លទ្ធកម្មដោយឡែក'
              ELSE COALESCE(p.procurement_method, '')
            END AS normalized_method,
            COUNT(p.project_id) AS project_count,
            COALESCE(SUM(CASE WHEN p.budget_type = 'ចរន្ត' THEN COALESCE(p.plan_amount, 0) ELSE 0 END), 0) AS plan_current,
            COALESCE(SUM(CASE WHEN p.budget_type = 'មូលធន' THEN COALESCE(p.plan_amount, 0) ELSE 0 END), 0) AS plan_capital,
            COUNT(r.request_id) AS commitment_count,
            COALESCE(SUM(CASE WHEN p.budget_type = 'ចរន្ត' THEN COALESCE(r.approved_amount, 0) ELSE 0 END), 0) AS commitment_current,
            COALESCE(SUM(CASE WHEN p.budget_type = 'មូលធន' THEN COALESCE(r.approved_amount, 0) ELSE 0 END), 0) AS commitment_capital,
            COALESCE(SUM(COALESCE(r.approved_amount, 0)), 0) AS commitment_amount,
            COUNT(c.contract_id) AS contract_count,
            COALESCE(SUM(CASE WHEN p.budget_type = 'ចរន្ត' THEN COALESCE(c.contract_amount, 0) ELSE 0 END), 0) AS contract_current,
            COALESCE(SUM(CASE WHEN p.budget_type = 'មូលធន' THEN COALESCE(c.contract_amount, 0) ELSE 0 END), 0) AS contract_capital,
            COALESCE(SUM(COALESCE(c.contract_amount, 0)), 0) AS contract_amount
          FROM projects p
          LEFT JOIN project_requests r ON r.project_id = p.project_id
          LEFT JOIN contracts c ON c.project_id = p.project_id
          ${whereSql}
          GROUP BY normalized_method
        `)
          .bind(...params)
          .all()
      ).results as any[];

      const methodDefs = [
        { no: 1, key: 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ', label: 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ' },
        { no: 2, key: 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក', label: 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក' },
        { no: 3, key: 'ការដេញថ្លៃមានកម្រិត', label: 'ការដេញថ្លៃមានកម្រិត' },
        { no: 4, key: 'ការពិគ្រោះថ្លៃ', label: 'ការពិគ្រោះថ្លៃ' },
        { no: 5, key: 'ការស្ទង់តម្លៃ', label: 'ការស្ទង់តម្លៃ' },
        { no: 6, key: 'លទ្ធកម្មដោយឡែក', label: 'លទ្ធកម្មដោយឡែក' },
      ];

      const rowMap = new Map<string, any>();
      for (const r of rows) {
        rowMap.set(String(r.normalized_method || ''), r);
      }

      const formatPct = (numerator: number, denominator: number): string => {
        if (!denominator || denominator === 0 || !Number.isFinite(denominator) || !Number.isFinite(numerator)) {
          return '0.00%';
        }
        const pct = (numerator / denominator) * 100;
        if (!Number.isFinite(pct) || isNaN(pct)) return '0.00%';
        const normalized = Math.abs(pct) < 0.000001 ? 0 : pct;
        return `${normalized.toFixed(2)}%`;
      };

      let sumPlanCurrent = 0;
      let sumPlanCapital = 0;
      let sumCommitmentCurrent = 0;
      let sumCommitmentCapital = 0;
      let sumContractCount = 0;
      let sumContractAmount = 0;

      data = methodDefs.map((m) => {
        const dbRow = rowMap.get(m.key);
        const planCurrent = Number(dbRow?.plan_current || 0);
        const planCapital = Number(dbRow?.plan_capital || 0);
        const commitmentCurrent = Number(dbRow?.commitment_current || 0);
        const commitmentCapital = Number(dbRow?.commitment_capital || 0);
        const contractCount = Number(dbRow?.contract_count || 0);
        const contractAmount = Number(dbRow?.contract_amount || 0);

        sumPlanCurrent += planCurrent;
        sumPlanCapital += planCapital;
        sumCommitmentCurrent += commitmentCurrent;
        sumCommitmentCapital += commitmentCapital;
        sumContractCount += contractCount;
        sumContractAmount += contractAmount;

        const totalPlan = planCurrent + planCapital;
        const totalCommitment = commitmentCurrent + commitmentCapital;
        const contractVsCommitmentAmount = totalCommitment === 0 ? 0 : totalCommitment - contractAmount;
        const contractVsCommitmentPercent = formatPct(contractVsCommitmentAmount, totalCommitment);
        const contractVsPlanAmount = totalPlan === 0 ? 0 : totalPlan - contractAmount;
        const contractVsPlanPercent = formatPct(contractVsPlanAmount, totalPlan);

        return {
          no: m.no,
          procurement_method: m.label,
          plan_current_amount: planCurrent,
          plan_capital_amount: planCapital,
          commitment_current_amount: commitmentCurrent,
          commitment_capital_amount: commitmentCapital,
          contract_count: contractCount,
          contract_total_amount: contractAmount,
          contract_vs_commitment_amount: contractVsCommitmentAmount,
          contract_vs_commitment_percent: contractVsCommitmentPercent,
          contract_vs_plan_amount: contractVsPlanAmount,
          contract_vs_plan_percent: contractVsPlanPercent,
        };
      });

      const grandTotalPlan = sumPlanCurrent + sumPlanCapital;
      const grandTotalCommitment = sumCommitmentCurrent + sumCommitmentCapital;
      const grandTotalContract = sumContractAmount;
      const grandContractVsCommitmentAmount = grandTotalCommitment === 0 ? 0 : grandTotalCommitment - grandTotalContract;
      const grandContractVsCommitmentPercent = formatPct(grandContractVsCommitmentAmount, grandTotalCommitment);
      const grandContractVsPlanAmount = grandTotalPlan === 0 ? 0 : grandTotalPlan - grandTotalContract;
      const grandContractVsPlanPercent = formatPct(grandContractVsPlanAmount, grandTotalPlan);

      data.push({
        no: 'សរុប',
        procurement_method: 'ចំនួនគម្រោង I+II+III (សរុប)',
        plan_current_amount: sumPlanCurrent,
        plan_capital_amount: sumPlanCapital,
        commitment_current_amount: sumCommitmentCurrent,
        commitment_capital_amount: sumCommitmentCapital,
        contract_count: sumContractCount,
        contract_total_amount: sumContractAmount,
        contract_vs_commitment_amount: grandContractVsCommitmentAmount,
        contract_vs_commitment_percent: grandContractVsCommitmentPercent,
        contract_vs_plan_amount: grandContractVsPlanAmount,
        contract_vs_plan_percent: grandContractVsPlanPercent,
      });

      summary = {
        total_plan_amount: grandTotalPlan,
        total_commitment_amount: grandTotalCommitment,
        total_contract_count: sumContractCount,
        total_contract_amount: grandTotalContract,
        contract_vs_commitment_amount: grandContractVsCommitmentAmount,
        contract_vs_commitment_percent: grandContractVsCommitmentPercent,
        contract_vs_plan_amount: grandContractVsPlanAmount,
        contract_vs_plan_percent: grandContractVsPlanPercent,
      };
      break;
    }

    default:
      return c.json({ success: false, message: 'ប្រភេទរបាយការណ៍មិនត្រឹមត្រូវ' }, 400);
  }

  const user = c.get('user');
  return c.json({
    success: true,
    title,
    summary,
    data,
    metadata: {
      generated_at: new Date().toISOString(),
      generated_by: user?.full_name || user?.username || 'Admin',
      organization: 'ក្រសួងសុខាភិបាល - នាយកដ្ឋានលទ្ធកម្មសាធារណៈ (Ministry of Health)',
    },
  });
});

// ============================================================================
// 404 & Error Handlers
// ============================================================================
app.notFound((c) => c.json({ success: false, message: 'API route not found' }, 404));

app.onError((err, c) => {
  console.error('[Worker API Error]', err);
  return c.json({ success: false, message: 'Internal server error' }, 500);
});

export default app;
