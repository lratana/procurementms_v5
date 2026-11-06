-- ============================================================================
-- Seed / Migration: 0002_sample_data.sql
-- Purpose: Approved Non-Sensitive Sample Data for Local & Development Testing
-- WARNING: DO NOT APPLY TO PRODUCTION DATABASE
-- All operations use INSERT OR IGNORE for idempotency.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Sample Test Users (Passwords: Admin@123, Editor@123, Viewer@123)
INSERT OR IGNORE INTO users (
  user_id, username, password_hash, full_name, email, phone_number,
  role, department, position, status, created_at, updated_at
) VALUES
  (1, 'admin', '$2b$10$0Z4OSjYkGjpC8HqcHI.EWetgBIzReYl3caw07xK2RH27A11Y6x95i', 'ឯកឧត្តម សុខ ចិន្តា (Test Admin)', 'admin@test.procurement.gov.kh', '012 000 001', 'admin', 'នាយកដ្ឋានលទ្ធកម្មសាធារណៈ', 'ប្រធាននាយកដ្ឋាន', 'active', datetime('now'), datetime('now')),
  (2, 'editor', '$2b$10$NNx85mU4U7IdVIRIzro.tefnsjv3UQDYjONP3fyHTcVfsniLSV7N2', 'លោកជំទាវ កែវ មុនីរ័ត្ន (Test Officer)', 'editor@test.procurement.gov.kh', '012 000 002', 'editor', 'ការិយាល័យដេញថ្លៃ និងកិច្ចសន្យា', 'អនុប្រធានការិយាល័យ', 'active', datetime('now'), datetime('now')),
  (3, 'viewer', '$2b$10$RhgwJtcm9jcmtGr5zyvYcead6dMRlG4zPWz/5JF4KDPFCCBhFZpQW', 'លោក ឡុង រតនៈ (Test Viewer)', 'viewer@test.procurement.gov.kh', '012 000 003', 'viewer', 'អង្គភាពសវនកម្មផ្ទៃក្នុង', 'មន្ត្រីត្រួតពិនិត្យ និងតាមដាន', 'active', datetime('now'), datetime('now'));

-- 2. Sample Procurement Projects (Planning Stage)
INSERT OR IGNORE INTO projects (
  project_id, title, description, fiscal_year, procurement_type,
  budget_type, procurement_method, plan_date, plan_amount
) VALUES
  ('PRJ-001', 'ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ និងបណ្តាញ Network មន្ទីរពេទ្យបង្អែកខេត្តកណ្តាល [SAMPLE]', 'គម្រោងសាកល្បងផ្គត់ផ្គង់កុំព្យូទ័រលើតុ Server និងប្រព័ន្ធបណ្តាញខ្សែកាបល្បឿនលឿនក្នុងមន្ទីរពេទ្យ', 2025, 'ទំនិញ', 'ចរន្ត', 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក', '2025-01-15', 7450.00),
  ('PRJ-002', 'សាងសង់អគារវេជ្ជសាស្ត្រ និងសង្គ្រោះបន្ទាន់ ៣ជាន់ នៅមន្ទីរពេទ្យបង្អែកខេត្តសៀមរាប [SAMPLE]', 'អគារបេតុងអាមេ ៣ជាន់ បំពាក់ប្រព័ន្ធអគ្គិសនី ប្រព័ន្ធទឹក និងជណ្តើរយន្តវេជ្ជសាស្ត្រ', 2025, 'សំណង់', 'មូលធន', 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក', '2025-02-01', 1180000.00),
  ('PRJ-003', 'ផ្គត់ផ្គង់ឧបករណ៍វេជ្ជសាស្ត្រទំនើប (Digital X-Ray & Ultrasound) [SAMPLE]', 'ទិញម៉ាស៊ីនថតកាំរស្មីអ៊ិចឌីជីថល និងម៉ាស៊ីនអេកូសាស្ត្រ 4D សម្រាប់មន្ទីរពេទ្យកុមារ', 2025, 'ទំនិញ', 'មូលធន', 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ', '2025-03-10', 450000.00),
  ('PRJ-004', 'សេវាប្រឹក្សាយោបល់រៀបចំប្រព័ន្ធឌីជីថលសុខាភិបាលថ្នាក់ជាតិ (HIS) [SAMPLE]', 'ការអភិវឌ្ឍប្រព័ន្ធគ្រប់គ្រងអ្នកជំងឺ និងទិន្នន័យសុខាភិបាលអេឡិចត្រូនិក', 2026, 'សេវាកម្មទីប្រឹក្សា (Consultant Services)', 'មូលធន', 'ការដេញថ្លៃមានកម្រិត', '2026-01-20', 185000.00),
  ('PRJ-005', 'ជួសជុលកែលម្អប្រព័ន្ធអគ្គិសនី និងប្រព័ន្ធត្រជាក់មន្ទីរពេទ្យខេត្តបាត់ដំបង [SAMPLE]', 'ការផ្លាស់ប្តូរខ្សែភ្លើងចាស់ៗ ប្តូរម៉ាស៊ីនភ្លើងបម្រុង និងម៉ាស៊ីនត្រជាក់បន្ទប់វះកាត់', 2025, 'សំណង់', 'ចរន្ត', 'ការពិគ្រោះថ្លៃ', '2025-04-05', 65000.00),
  ('PRJ-006', 'ផ្គត់ផ្គង់រថយន្តសង្គ្រោះបន្ទាន់បំពាក់បរិក្ខារពេញលេញចំនួន ៥គ្រឿង [SAMPLE]', 'រថយន្តសង្គ្រោះបន្ទាន់ប្រភេទ ICU Mobile សម្រាប់សង្គ្រោះបឋម', 2025, 'ទំនិញ', 'មូលធន', 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក', '2025-05-12', 250000.00);

-- 3. Sample Project Requests (Procurement Stage)
INSERT OR IGNORE INTO project_requests (
  request_id, project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount
) VALUES
  (1, 'PRJ-001', '2025-01-25', 2025, 7500.00, '2025-02-10', 7450.00),
  (2, 'PRJ-002', '2025-02-15', 2025, 1200000.00, '2025-03-01', 1180000.00),
  (3, 'PRJ-003', '2025-03-15', 2025, 460000.00, '2025-04-02', 450000.00),
  (4, 'PRJ-004', '2026-02-01', 2026, 190000.00, '2026-02-25', 185000.00),
  (5, 'PRJ-005', '2025-04-12', 2025, 68000.00, '2025-04-28', 65000.00),
  (6, 'PRJ-006', '2025-05-18', 2025, 260000.00, '2025-06-05', 250000.00);

-- 4. Sample Bidders
INSERT OR IGNORE INTO bidders (
  bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status
) VALUES
  ('BID-001', 'ខេមបូឌា អាយធី សូលូសិន ខូអិលធីឌី (Cambodia IT Solutions - Test)', 'លោក ចាន់ ពិសិដ្ឋ', '023 000 101', 'TEST-K001-902134', 'សង្កាត់ជ័យជំនះ ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ', 'សកម្ម'),
  ('BID-002', 'សុវណ្ណភូមិ ខនស្ត្រាក់សិន គ្រុប (Sovanphum Construction - Test)', 'លោកជំទាវ ស៊ុន សុភា', '023 000 102', 'TEST-K002-881234', 'សង្កាត់ជ្រោយចង្វារ ខណ្ឌជ្រោយចង្វារ រាជធានីភ្នំពេញ', 'សកម្ម'),
  ('BID-003', 'មេឌីខល អ៊ីឃ្វីបមេន អាស៊ី (Medical Equipment Asia - Test)', 'លោក ស៊ឹម វិចិត្រ', '023 000 103', 'TEST-K003-776543', 'សង្កាត់បឹងកេងកង១ ខណ្ឌបឹងកេងកង រាជធានីភ្នំពេញ', 'សកម្ម'),
  ('BID-004', 'ហ្គ្រីន ថេកណូឡូជី ឯ.ក (Green Tech Systems - Test)', 'លោក ហេង វណ្ណា', '023 000 104', 'TEST-K004-665544', 'សង្កាត់ទឹកល្អក់៣ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ', 'សកម្ម');

-- 5. Sample Bidding Process (Bidding & Evaluation Stage)
INSERT OR IGNORE INTO bidding_process (
  bid_process_id, project_id, prepare_bid, moh_approval, mef_submit,
  mef_approval, advertise_date, bid_opening, validity_days, expiry_days, valid_until, status
) VALUES
  (1, 'PRJ-001', '2025-02-15', '2025-02-28', '2025-03-05', '2025-03-20', '2025-03-25', '2025-04-25', 90, 30, '2027-07-24', 'កំពុងមានសុពលភាព'),
  (2, 'PRJ-002', '2025-03-05', '2025-03-18', '2025-03-25', '2025-04-10', '2025-04-15', '2025-05-20', 120, 30, '2027-09-17', 'កំពុងមានសុពលភាព'),
  (3, 'PRJ-003', '2025-04-10', '2025-04-25', '2025-05-02', '2025-05-18', '2025-05-25', '2025-07-05', 90, 30, '2027-10-03', 'កំពុងមានសុពលភាព');

-- 6. Sample Contracts (Contract Stage)
INSERT OR IGNORE INTO contracts (
  contract_id, project_id, contract_submit_mef, contract_amount,
  approval_date, end_date, contract_validity, expiry_days, status, handover
) VALUES
  (1, 'PRJ-001', '2025-05-18', 7450.00, '2025-05-28', '2027-09-30', 120, 0, 'កំពុងអនុវត្ត', 'ដំណាក់កាលទី ៣'),
  (2, 'PRJ-002', '2025-06-20', 1180000.00, '2025-07-05', '2027-07-15', 365, 0, 'បានបញ្ចប់', 'ប្រគល់រួចរាល់');

-- 7. Sample Handovers (Delivery & Handover Stage)
INSERT OR IGNORE INTO handovers (
  handover_id, project_id, contract_amount, handover_amount,
  stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes
) VALUES
  ('HO-001', 'PRJ-001', 7450.00, 5587.50, 1490.00, 2235.00, 1862.50, 0.00, 75.00, 'កំពុងដំណើរការ', 'ដំណាក់កាលទី១ ដល់ ទី៣ បានបញ្ចប់ និងបានត្រួតពិនិត្យរួចរាល់ នៅសល់ដំណាក់កាលចុងក្រោយ [SAMPLE]'),
  ('HO-002', 'PRJ-002', 1180000.00, 1180000.00, 236000.00, 354000.00, 354000.00, 236000.00, 100.00, 'ប្រគល់រួចរាល់', 'សំណង់អគារទាំងមូលបានសាងសង់រួចរាល់១០០% និងបានត្រួតពិនិត្យទទួលជាផ្លូវការ [SAMPLE]');

-- 8. Sample Warranties (Warranty Stage)
INSERT OR IGNORE INTO warranties (
  warranty_id, project_id, existing_handover_date, handover_date,
  warranty_period_days, expired_years, expired_date, warranty_remaining_days, expired_days, status
) VALUES
  (1, 'PRJ-001', '2026-10-20', '2026-10-20', 365, 2027, '2027-10-20', 350, 0, 'កំពុងធានា'),
  (2, 'PRJ-002', '2026-08-15', '2026-08-15', 730, 2028, '2028-08-15', 650, 0, 'កំពុងធានា');

-- 9. Sample Devices
INSERT OR IGNORE INTO devices (
  device_id, user_id, device_name, device_type, operating_system,
  browser, device_identifier, ip_address, user_agent, first_login_at, last_login_at, status
) VALUES
  (1, 1, 'Dell Latitude 7440 (Test Office)', 'Laptop', 'Windows 11 Pro', 'Chrome 122.0', 'DEV-TEST-OFFICE-01', '127.0.0.1', 'Chrome / Windows', datetime('now'), datetime('now'), 'active'),
  (2, 2, 'HP EliteBook G9 (Test Office)', 'Laptop', 'Windows 11', 'Chrome 121.0', 'DEV-TEST-OFFICE-02', '127.0.0.1', 'Chrome / Windows', datetime('now'), datetime('now'), 'active'),
  (3, 3, 'MacBook Pro M2 (Test Office)', 'Laptop', 'macOS Sonoma', 'Safari 17.2', 'DEV-TEST-OFFICE-03', '127.0.0.1', 'Safari / macOS', datetime('now'), datetime('now'), 'active');

-- 10. Sample Audit Logs
INSERT OR IGNORE INTO audit_logs (
  audit_id, user_id, device_id, action, module, table_name, record_id, old_data, new_data, ip_address, created_at
) VALUES
  (1, 1, 1, 'LOGIN', 'ការចូលប្រើប្រាស់', 'user_sessions', '1', NULL, '{"status":"success","env":"sample"}', '127.0.0.1', datetime('now', '-2 hours')),
  (2, 1, 1, 'CREATE', 'គម្រោង', 'projects', 'PRJ-001', NULL, '{"project_id":"PRJ-001","sample":true}', '127.0.0.1', datetime('now', '-1 hour')),
  (3, 2, 2, 'UPDATE', 'ប្រគល់-ទទួល', 'handovers', 'HO-001', '{"progress":50}', '{"progress":75}', '127.0.0.1', datetime('now', '-30 minutes'));
