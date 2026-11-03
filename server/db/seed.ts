import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'procurement_db',
    multipleStatements: true,
  });

  console.log('[Seed] Connected to MySQL database procurement_db.');

  // Clean existing data
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  await connection.query('TRUNCATE TABLE audit_logs');
  await connection.query('TRUNCATE TABLE user_sessions');
  await connection.query('TRUNCATE TABLE devices');
  await connection.query('TRUNCATE TABLE warranties');
  await connection.query('TRUNCATE TABLE handovers');
  await connection.query('TRUNCATE TABLE contracts');
  await connection.query('TRUNCATE TABLE bidding_process');
  await connection.query('TRUNCATE TABLE bidders');
  await connection.query('TRUNCATE TABLE project_requests');
  await connection.query('TRUNCATE TABLE projects');
  await connection.query('TRUNCATE TABLE users');
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('[Seed] Cleared existing tables.');

  // Password hashes
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const editorHash = await bcrypt.hash('Editor@123', 10);
  const viewerHash = await bcrypt.hash('Viewer@123', 10);

  // 1. Insert Users
  await connection.query(`
    INSERT INTO users (user_id, username, password_hash, full_name, email, phone_number, role, department, position, status, created_at) VALUES
    (1, 'admin', ?, 'ឯកឧត្តម សុខ ចិន្តា', 'admin@procurement.gov.kh', '012 888 999', 'admin', 'នាយកដ្ឋានលទ្ធកម្មសាធារណៈ', 'ប្រធាននាយកដ្ឋាន', 'active', NOW()),
    (2, 'editor', ?, 'លោកជំទាវ កែវ មុនីរ័ត្ន', 'editor@procurement.gov.kh', '016 777 666', 'editor', 'ការិយាល័យដេញថ្លៃ និងកិច្ចសន្យា', 'អនុប្រធានការិយាល័យ', 'active', NOW()),
    (3, 'viewer', ?, 'លោក ឡុង រតនៈ', 'viewer@procurement.gov.kh', '098 555 444', 'viewer', 'អង្គភាពសវនកម្មផ្ទៃក្នុង', 'មន្ត្រីត្រួតពិនិត្យ និងតាមដាន', 'active', NOW());
  `, [adminHash, editorHash, viewerHash]);

  console.log('[Seed] Inserted default users (admin, editor, viewer).');

  // 2. Insert Projects
  await connection.query(`
    INSERT INTO projects (project_id, title, description, fiscal_year, procurement_type, budget_type, procurement_method, plan_date, plan_amount) VALUES
    ('PRJ-001', 'ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ និងបណ្តាញ Network មន្ទីរពេទ្យបង្អែកខេត្តកណ្តាល', 'គម្រោងផ្គត់ផ្គង់កុំព្យូទ័រលើតុ Server និងប្រព័ន្ធបណ្តាញខ្សែកាបល្បឿនលឿនក្នុងមន្ទីរពេទ្យ', 2025, 'ទំនិញ', 'ចរន្ត', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-01-15', 7450.00),
    ('PRJ-002', 'សាងសង់អគារវេជ្ជសាស្ត្រ និងសង្គ្រោះបន្ទាន់ ៣ជាន់ នៅមន្ទីរពេទ្យបង្អែកខេត្តសៀមរាប', 'អគារបេតុងអាមេ ៣ជាន់ បំពាក់ប្រព័ន្ធអគ្គិសនី ប្រព័ន្ធទឹក និងជណ្តើរយន្តវេជ្ជសាស្ត្រ', 2025, 'សំណង់', 'មូលធន', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-02-01', 1180000.00),
    ('PRJ-003', 'ផ្គត់ផ្គង់ឧបករណ៍វេជ្ជសាស្ត្រទំនើប (Digital X-Ray & Ultrasound)', 'ទិញម៉ាស៊ីនថតកាំរស្មីអ៊ិចឌីជីថល និងម៉ាស៊ីនអេកូសាស្ត្រ 4D សម្រាប់មន្ទីរពេទ្យកុមារ', 2025, 'ទំនិញ', 'មូលធន', 'ការដេញថ្លៃជាអន្តរជាតិ (ICB)', '2025-03-10', 450000.00),
    ('PRJ-004', 'សេវាប្រឹក្សាយោបល់រៀបចំប្រព័ន្ធឌីជីថលសុខាភិបាលថ្នាក់ជាតិ (Health Information System)', 'ការអភិវឌ្ឍប្រព័ន្ធគ្រប់គ្រងអ្នកជំងឺ និងទិន្នន័យសុខាភិបាលអេឡិចត្រូនិក', 2026, 'សេវាកម្មប្រឹក្សា', 'មូលធន', 'ការជ្រើសរើសផ្អែកលើគុណភាព និងតម្លៃ (QCBS)', '2026-01-20', 185000.00),
    ('PRJ-005', 'ជួសជុលកែលម្អប្រព័ន្ធអគ្គិសនី និងប្រព័ន្ធត្រជាក់មន្ទីរពេទ្យខេត្តបាត់ដំបង', 'ការផ្លាស់ប្តូរខ្សែភ្លើងចាស់ៗ ប្តូរម៉ាស៊ីនភ្លើងបម្រុង និងម៉ាស៊ីនត្រជាក់បន្ទប់វះកាត់', 2025, 'សំណង់', 'ចរន្ត', 'ការដេញថ្លៃប្រកួតប្រជែងតម្លៃ (Price Quotation)', '2025-04-05', 65000.00),
    ('PRJ-006', 'ផ្គត់ផ្គង់រថយន្តសង្គ្រោះបន្ទាន់បំពាក់បរិក្ខារពេញលេញចំនួន ៥គ្រឿង', 'រថយន្តសង្គ្រោះបន្ទាន់ប្រភេទ ICU Mobile សម្រាប់សង្គ្រោះបឋម', 2025, 'ទំនិញ', 'មូលធន', 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)', '2025-05-12', 250000.00);
  `);

  console.log('[Seed] Inserted projects.');

  // 3. Insert Project Requests
  await connection.query(`
    INSERT INTO project_requests (project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount) VALUES
    ('PRJ-001', '2025-01-25', 2025, 7500.00, '2025-02-10', 7450.00),
    ('PRJ-002', '2025-02-15', 2025, 1200000.00, '2025-03-01', 1180000.00),
    ('PRJ-003', '2025-03-15', 2025, 460000.00, '2025-04-02', 450000.00),
    ('PRJ-004', '2026-02-01', 2026, 190000.00, '2026-02-25', 185000.00),
    ('PRJ-005', '2025-04-12', 2025, 68000.00, '2025-04-28', 65000.00),
    ('PRJ-006', '2025-05-18', 2025, 260000.00, '2025-06-05', 250000.00);
  `);

  // 4. Insert Bidders
  await connection.query(`
    INSERT INTO bidders (bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status) VALUES
    ('BID-001', 'ខេមបូឌា អាយធី សូលូសិន ខូអិលធីឌី (Cambodia IT Solutions)', 'លោក ចាន់ ពិសិដ្ឋ', '023 889 900', 'K001-902134567', 'ផ្ទះលេខ ៤៥ មហាវិថីព្រះនរោត្តម សង្កាត់ជ័យជំនះ ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ', 'សកម្ម'),
    ('BID-002', 'សុវណ្ណភូមិ ខនស្ត្រាក់សិន គ្រុប (Sovanphum Construction Group)', 'លោកជំទាវ ស៊ុន សុភា', '023 991 223', 'K002-881234901', 'ផ្លូវជាតិលេខ ៦A សង្កាត់ជ្រោយចង្វារ ខណ្ឌជ្រោយចង្វារ រាជធានីភ្នំពេញ', 'សកម្ម'),
    ('BID-003', 'មេឌីខល អ៊ីឃ្វីបមេន អាស៊ី (Medical Equipment Asia Co., Ltd)', 'លោក ស៊ឹម វិចិត្រ', '012 445 566', 'K003-776543210', 'មហាវិថីម៉ៅសេទុង សង្កាត់បឹងកេងកង១ ខណ្ឌបឹងកេងកង រាជធានីភ្នំពេញ', 'សកម្ម'),
    ('BID-004', 'ហ្គ្រីន ថេកណូឡូជី ឯ.ក (Green Tech Systems)', 'លោក ហេង វណ្ណា', '017 332 211', 'K004-665544332', 'ផ្លូវ ២៧១ សង្កាត់ទឹកល្អក់៣ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ', 'សកម្ម');
  `);

  // 5. Insert Bidding Process
  await connection.query(`
    INSERT INTO bidding_process (bid_process_id, project_id, prepare_bid, moh_approval, mef_submit, mef_approval, advertise_date, bid_opening, validity_days, valid_until, status) VALUES
    (1, 'PRJ-001', '2025-02-15', '2025-02-28', '2025-03-05', '2025-03-20', '2025-03-25', '2025-04-25', 90, '2025-07-24', 'កំពុងអនុវត្ត'),
    (2, 'PRJ-002', '2025-03-05', '2025-03-18', '2025-03-25', '2025-04-10', '2025-04-15', '2025-05-20', 120, '2025-09-17', 'កំពុងអនុវត្ត'),
    (3, 'PRJ-003', '2025-04-10', '2025-04-25', '2025-05-02', '2025-05-18', '2025-05-25', '2025-07-05', 90, '2025-10-03', 'កំពុងរៀបចំ');
  `);

  // 6. Insert Contracts
  await connection.query(`
    INSERT INTO contracts (contract_id, project_id, contract_submit_mef, contract_amount, approval_date, end_date, contract_validity, status, handover) VALUES
    (1, 'PRJ-001', '2025-05-18', 7450.00, '2025-05-28', '2025-09-30', 120, 'កំពុងអនុវត្ត', 'ដំណាក់កាលទី ៣'),
    (2, 'PRJ-002', '2025-06-20', 1180000.00, '2025-07-05', '2026-07-15', 365, 'កំពុងអនុវត្ត', 'ប្រគល់រួចរាល់');
  `);

  // 7. Insert Handovers
  await connection.query(`
    INSERT INTO handovers (handover_id, project_id, contract_amount, handover_amount, stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes) VALUES
    ('HO-001', 'PRJ-001', 7450.00, 5587.50, 1490.00, 2235.00, 1862.50, 0.00, 75.00, 'កំពុងដំណើរការ', 'ដំណាក់កាលទី១ ដល់ ទី៣ បានបញ្ចប់ និងបានត្រួតពិនិត្យរួចរាល់ នៅសល់ដំណាក់កាលចុងក្រោយ'),
    ('HO-002', 'PRJ-002', 1180000.00, 1180000.00, 236000.00, 354000.00, 354000.00, 236000.00, 100.00, 'ប្រគល់រួចរាល់', 'សំណង់អគារទាំងមូលបានសាងសង់រួចរាល់១០០% និងបានត្រួតពិនិត្យទទួលជាផ្លូវការ');
  `);

  // 8. Insert Warranties
  await connection.query(`
    INSERT INTO warranties (warranty_id, project_id, existing_handover_date, handover_date, warranty_period_days, expired_years, expired_date, status) VALUES
    (1, 'PRJ-001', '2025-10-20', '2025-10-20', 365, 2026, '2026-10-20', 'Active'),
    (2, 'PRJ-002', '2025-08-15', '2025-08-15', 730, 2027, '2027-08-15', 'Active');
  `);

  // 9. Insert Devices
  await connection.query(`
    INSERT INTO devices (device_id, user_id, device_name, device_type, operating_system, browser, device_identifier, ip_address, user_agent, first_login_at, last_login_at, status) VALUES
    (1, 1, 'Dell Latitude 7440 (Office)', 'Laptop', 'Windows 11 Pro', 'Chrome 122.0', 'DEV-OFFICE-01', '192.168.1.105', 'Chrome / Windows', NOW(), NOW(), 'active'),
    (2, 2, 'HP EliteBook G9', 'Laptop', 'Windows 11', 'Chrome 121.0', 'DEV-OFFICE-02', '192.168.1.110', 'Chrome / Windows', NOW(), NOW(), 'active'),
    (3, 3, 'MacBook Pro M2', 'Laptop', 'macOS Sonoma', 'Safari 17.2', 'DEV-OFFICE-03', '192.168.1.115', 'Safari / macOS', NOW(), NOW(), 'active');
  `);

  // 10. Insert Audit Logs
  await connection.query(`
    INSERT INTO audit_logs (audit_id, user_id, device_id, action, module, table_name, record_id, old_data, new_data, ip_address, created_at) VALUES
    (1, 1, 1, 'LOGIN', 'auth', 'user_sessions', '1', NULL, '{"status": "success"}', '192.168.1.105', NOW() - INTERVAL 2 HOUR),
    (2, 1, 1, 'CREATE', 'projects', 'projects', 'PRJ-001', NULL, '{"title": "ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ..."}', '192.168.1.105', NOW() - INTERVAL 1 HOUR),
    (3, 2, 2, 'UPDATE', 'handovers', 'handovers', 'HO-001', '{"progress": 50}', '{"progress": 75}', '192.168.1.110', NOW() - INTERVAL 30 MINUTE);
  `);

  console.log('[Seed] Database successfully populated with Cambodian Procurement records!');
  await connection.end();
}

seed().catch((err) => {
  console.error('[Seed] Error populating database:', err);
  process.exit(1);
});
