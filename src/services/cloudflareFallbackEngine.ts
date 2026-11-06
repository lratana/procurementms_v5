import { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const STORAGE_KEY = 'pms_cf_d1_fallback_state_v1';

interface FallbackState {
  users: any[];
  projects: any[];
  project_requests: any[];
  bidders: any[];
  bidding_process: any[];
  contracts: any[];
  handovers: any[];
  warranties: any[];
  devices: any[];
  user_sessions: any[];
  audit_logs: any[];
  passwords: Record<string, string>;
}

const DEFAULT_STATE: FallbackState = {
  users: [
    {
      user_id: 1,
      username: 'admin',
      full_name: 'ឯកឧត្តម សុខ ចិន្តា',
      email: 'admin@procurement.gov.kh',
      phone_number: '012 888 999',
      role: 'admin',
      department: 'នាយកដ្ឋានលទ្ធកម្មសាធារណៈ',
      position: 'ប្រធាននាយកដ្ឋាន',
      profile_photo: null,
      status: 'active',
      last_login_at: new Date().toISOString(),
      created_at: '2025-01-01T08:00:00Z',
    },
    {
      user_id: 2,
      username: 'editor',
      full_name: 'លោកជំទាវ កែវ មុនីរ័ត្ន',
      email: 'editor@procurement.gov.kh',
      phone_number: '016 777 666',
      role: 'editor',
      department: 'ការិយាល័យដេញថ្លៃ និងកិច្ចសន្យា',
      position: 'អនុប្រធានការិយាល័យ',
      profile_photo: null,
      status: 'active',
      last_login_at: new Date().toISOString(),
      created_at: '2025-01-01T08:00:00Z',
    },
    {
      user_id: 3,
      username: 'viewer',
      full_name: 'លោក ឡុង រតនៈ',
      email: 'viewer@procurement.gov.kh',
      phone_number: '098 555 444',
      role: 'viewer',
      department: 'អង្គភាពសវនកម្មផ្ទៃក្នុង',
      position: 'មន្ត្រីត្រួតពិនិត្យ និងតាមដាន',
      profile_photo: null,
      status: 'active',
      last_login_at: new Date().toISOString(),
      created_at: '2025-01-01T08:00:00Z',
    },
  ],
  passwords: {
    admin: 'Admin@123',
    editor: 'Editor@123',
    viewer: 'Viewer@123',
  },
  projects: [
    {
      project_id: 'PRJ-001',
      title: 'ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ និងបណ្តាញ Network មន្ទីរពេទ្យបង្អែកខេត្តកណ្តាល',
      description: 'គម្រោងផ្គត់ផ្គង់កុំព្យូទ័រលើតុ Server និងប្រព័ន្ធបណ្តាញខ្សែកាបល្បឿនលឿនក្នុងមន្ទីរពេទ្យ',
      fiscal_year: 2025,
      budget_type: 'មូលធន',
      procurement_type: 'ទំនិញ',
      procurement_method: 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)',
      plan_date: '2025-01-15',
      plan_amount: 7450.0,
    },
    {
      project_id: 'PRJ-002',
      title: 'សាងសង់អគារវេជ្ជសាស្ត្រ និងសង្គ្រោះបន្ទាន់ ៣ជាន់ នៅមន្ទីរពេទ្យបង្អែកខេត្តសៀមរាប',
      description: 'អគារបេតុងអាមេ ៣ជាន់ បំពាក់ប្រព័ន្ធអគ្គិសនី ប្រព័ន្ធទឹក និងជណ្តើរយន្តវេជ្ជសាស្ត្រ',
      fiscal_year: 2025,
      budget_type: 'មូលធន',
      procurement_type: 'សំណង់',
      procurement_method: 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)',
      plan_date: '2025-02-01',
      plan_amount: 1180000.0,
    },
    {
      project_id: 'PRJ-003',
      title: 'ផ្គត់ផ្គង់ឧបករណ៍វេជ្ជសាស្ត្រទំនើប (Digital X-Ray & Ultrasound)',
      description: 'ទិញម៉ាស៊ីនថតកាំរស្មីអ៊ិចឌីជីថល និងម៉ាស៊ីនអេកូសាស្ត្រ 4D សម្រាប់មន្ទីរពេទ្យកុមារ',
      fiscal_year: 2025,
      budget_type: 'មូលធន',
      procurement_type: 'ទំនិញ',
      procurement_method: 'ការដេញថ្លៃជាអន្តរជាតិ (ICB)',
      plan_date: '2025-03-10',
      plan_amount: 450000.0,
    },
    {
      project_id: 'PRJ-004',
      title: 'សេវាប្រឹក្សាយោបល់រៀបចំប្រព័ន្ធឌីជីថលសុខាភិបាលថ្នាក់ជាតិ (Health Information System)',
      description: 'ការអភិវឌ្ឍប្រព័ន្ធគ្រប់គ្រងអ្នកជំងឺ និងទិន្នន័យសុខាភិបាលអេឡិចត្រូនិក',
      fiscal_year: 2026,
      budget_type: 'ចរន្ត',
      procurement_type: 'សេវាកម្មប្រឹក្សា',
      procurement_method: 'ការជ្រើសរើសផ្អែកលើគុណភាព និងតម្លៃ (QCBS)',
      plan_date: '2026-01-20',
      plan_amount: 185000.0,
    },
    {
      project_id: 'PRJ-005',
      title: 'ជួសជុលកែលម្អប្រព័ន្ធអគ្គិសនី និងប្រព័ន្ធត្រជាក់មន្ទីរពេទ្យខេត្តបាត់ដំបង',
      description: 'ការផ្លាស់ប្តូរខ្សែភ្លើងចាស់ៗ ប្តូរម៉ាស៊ីនភ្លើងបម្រុង និងម៉ាស៊ីនត្រជាក់បន្ទប់វះកាត់',
      fiscal_year: 2025,
      budget_type: 'ចរន្ត',
      procurement_type: 'សំណង់',
      procurement_method: 'ការដេញថ្លៃប្រកួតប្រជែងតម្លៃ (Price Quotation)',
      plan_date: '2025-04-05',
      plan_amount: 65000.0,
    },
    {
      project_id: 'PRJ-006',
      title: 'ផ្គត់ផ្គង់រថយន្តសង្គ្រោះបន្ទាន់បំពាក់បរិក្ខារពេញលេញចំនួន ៥គ្រឿង',
      description: 'រថយន្តសង្គ្រោះបន្ទាន់ប្រភេទ ICU Mobile សម្រាប់សង្គ្រោះបឋម',
      fiscal_year: 2025,
      budget_type: 'មូលធន',
      procurement_type: 'ទំនិញ',
      procurement_method: 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)',
      plan_date: '2025-05-12',
      plan_amount: 250000.0,
    },
  ],
  project_requests: [
    { request_id: 1, project_id: 'PRJ-001', request_date: '2025-01-25', fiscal_year: 2025, request_amount: 7500.0, approval_date: '2025-02-10', approved_amount: 7450.0 },
    { request_id: 2, project_id: 'PRJ-002', request_date: '2025-02-15', fiscal_year: 2025, request_amount: 1200000.0, approval_date: '2025-03-01', approved_amount: 1180000.0 },
    { request_id: 3, project_id: 'PRJ-003', request_date: '2025-03-15', fiscal_year: 2025, request_amount: 460000.0, approval_date: '2025-04-02', approved_amount: 450000.0 },
    { request_id: 4, project_id: 'PRJ-004', request_date: '2026-02-01', fiscal_year: 2026, request_amount: 190000.0, approval_date: '2026-02-25', approved_amount: 185000.0 },
    { request_id: 5, project_id: 'PRJ-005', request_date: '2025-04-12', fiscal_year: 2025, request_amount: 68000.0, approval_date: '2025-04-28', approved_amount: 65000.0 },
    { request_id: 6, project_id: 'PRJ-006', request_date: '2025-05-18', fiscal_year: 2025, request_amount: 260000.0, approval_date: '2025-06-05', approved_amount: 250000.0 },
  ],
  bidders: [
    { bidder_id: 'BID-001', company_name: 'ខេមបូឌា អាយធី សូលូសិន ខូអិលធីឌី (Cambodia IT Solutions)', company_director: 'លោក ចាន់ ពិសិដ្ឋ', phone_number: '023 889 900', tax_identification_number: 'K001-902134567', address: 'ផ្ទះលេខ ៤៥ មហាវិថីព្រះនរោត្តម សង្កាត់ជ័យជំនះ ខណ្ឌដូនពេញ រាជធានីភ្នំពេញ', status: 'សកម្ម' },
    { bidder_id: 'BID-002', company_name: 'សុវណ្ណភូមិ ខនស្ត្រាក់សិន គ្រុប (Sovanphum Construction Group)', company_director: 'លោកជំទាវ ស៊ុន សុភា', phone_number: '023 991 223', tax_identification_number: 'K002-881234901', address: 'ផ្លូវជាតិលេខ ៦A សង្កាត់ជ្រោយចង្វារ ខណ្ឌជ្រោយចង្វារ រាជធានីភ្នំពេញ', status: 'សកម្ម' },
    { bidder_id: 'BID-003', company_name: 'មេឌីខល អ៊ីឃ្វីបមេន អាស៊ី (Medical Equipment Asia Co., Ltd)', company_director: 'លោក ស៊ឹម វិចិត្រ', phone_number: '012 445 566', tax_identification_number: 'K003-776543210', address: 'មហាវិថីម៉ៅសេទុង សង្កាត់បឹងកេងកង១ ខណ្ឌបឹងកេងកង រាជធានីភ្នំពេញ', status: 'សកម្ម' },
    { bidder_id: 'BID-004', company_name: 'ហ្គ្រីន ថេកណូឡូជី ឯ.ក (Green Tech Systems)', company_director: 'លោក ហេង វណ្ណា', phone_number: '017 332 211', tax_identification_number: 'K004-665544332', address: 'ផ្លូវ ២៧១ សង្កាត់ទឹកល្អក់៣ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ', status: 'សកម្ម' },
  ],
  bidding_process: [
    { bid_process_id: 1, project_id: 'PRJ-001', prepare_bid: '2025-02-15', moh_approval: '2025-02-28', mef_submit: '2025-03-05', mef_approval: '2025-03-20', advertise_date: '2025-03-25', bid_opening: '2025-04-25', validity_days: 90, expiry_days: 30, valid_until: '2025-07-24', status: 'កំពុងអនុវត្ត' },
    { bid_process_id: 2, project_id: 'PRJ-002', prepare_bid: '2025-03-05', moh_approval: '2025-03-18', mef_submit: '2025-03-25', mef_approval: '2025-04-10', advertise_date: '2025-04-15', bid_opening: '2025-05-20', validity_days: 120, expiry_days: 30, valid_until: '2025-09-17', status: 'កំពុងអនុវត្ត' },
    { bid_process_id: 3, project_id: 'PRJ-003', prepare_bid: '2025-04-10', moh_approval: '2025-04-25', mef_submit: '2025-05-02', mef_approval: '2025-05-18', advertise_date: '2025-05-25', bid_opening: '2025-07-05', validity_days: 90, expiry_days: 30, valid_until: '2025-10-03', status: 'កំពុងរៀបចំ' },
  ],
  contracts: [
    { contract_id: 1, project_id: 'PRJ-001', contract_submit_mef: '2025-05-18', contract_amount: 7450.0, approval_date: '2025-05-28', end_date: '2025-09-30', contract_validity: 120, expiry_days: 30, status: 'កំពុងអនុវត្ត', handover: 'ដំណាក់កាលទី ៣' },
    { contract_id: 2, project_id: 'PRJ-002', contract_submit_mef: '2025-06-20', contract_amount: 1180000.0, approval_date: '2025-07-05', end_date: '2026-07-15', contract_validity: 365, expiry_days: 30, status: 'កំពុងអនុវត្ត', handover: 'ប្រគល់រួចរាល់' },
  ],
  handovers: [
    { handover_id: 'HO-001', project_id: 'PRJ-001', contract_amount: 7450.0, handover_amount: 5587.5, stage_1: 1490.0, stage_2: 2235.0, stage_3: 1862.5, stage_4: 0.0, progress_percent: 75.0, handover_status: 'កំពុងដំណើរការ', notes: 'ដំណាក់កាលទី១ ដល់ ទី៣ បានបញ្ចប់ និងបានត្រួតពិនិត្យរួចរាល់ នៅសល់ដំណាក់កាលចុងក្រោយ' },
    { handover_id: 'HO-002', project_id: 'PRJ-002', contract_amount: 1180000.0, handover_amount: 1180000.0, stage_1: 236000.0, stage_2: 354000.0, stage_3: 354000.0, stage_4: 236000.0, progress_percent: 100.0, handover_status: 'ប្រគល់រួចរាល់', notes: 'សំណង់អគារទាំងមូលបានសាងសង់រួចរាល់១០០% និងបានត្រួតពិនិត្យទទួលជាផ្លូវការ' },
  ],
  warranties: [
    { warranty_id: 1, project_id: 'PRJ-001', existing_handover_date: '2025-10-20', handover_date: '2025-10-20', warranty_period_days: 365, expired_years: 2026, expired_date: '2026-10-20', status: 'Active' },
    { warranty_id: 2, project_id: 'PRJ-002', existing_handover_date: '2025-08-15', handover_date: '2025-08-15', warranty_period_days: 730, expired_years: 2027, expired_date: '2027-08-15', status: 'Active' },
  ],
  devices: [
    { device_id: 1, user_id: 1, device_name: 'Dell Latitude 7440 (Office)', device_type: 'Laptop', operating_system: 'Windows 11 Pro', browser: 'Chrome 122.0', device_identifier: 'DEV-OFFICE-01', ip_address: '192.168.1.105', user_agent: 'Chrome / Windows', first_login_at: '2025-01-10T08:00:00Z', last_login_at: new Date().toISOString(), status: 'active' },
    { device_id: 2, user_id: 2, device_name: 'HP EliteBook G9', device_type: 'Laptop', operating_system: 'Windows 11', browser: 'Chrome 121.0', device_identifier: 'DEV-OFFICE-02', ip_address: '192.168.1.110', user_agent: 'Chrome / Windows', first_login_at: '2025-01-12T08:00:00Z', last_login_at: new Date().toISOString(), status: 'active' },
    { device_id: 3, user_id: 3, device_name: 'MacBook Pro M2', device_type: 'Laptop', operating_system: 'macOS Sonoma', browser: 'Safari 17.2', device_identifier: 'DEV-OFFICE-03', ip_address: '192.168.1.115', user_agent: 'Safari / macOS', first_login_at: '2025-01-14T08:00:00Z', last_login_at: new Date().toISOString(), status: 'active' },
  ],
  user_sessions: [],
  audit_logs: [
    { audit_id: 1, user_id: 1, device_id: 1, action: 'LOGIN', module: 'auth', table_name: 'user_sessions', record_id: '1', old_data: null, new_data: '{"status": "success"}', ip_address: '192.168.1.105', created_at: '2025-01-15T08:30:00Z' },
    { audit_id: 2, user_id: 1, device_id: 1, action: 'CREATE', module: 'projects', table_name: 'projects', record_id: 'PRJ-001', old_data: null, new_data: '{"title": "ផ្គត់ផ្គង់ និងតម្លើងប្រព័ន្ធកុំព្យូទ័រ..."}', ip_address: '192.168.1.105', created_at: '2025-01-15T09:10:00Z' },
    { audit_id: 3, user_id: 2, device_id: 2, action: 'UPDATE', module: 'handovers', table_name: 'handovers', record_id: 'HO-001', old_data: null, new_data: '{"progress": 75}', ip_address: '192.168.1.110', created_at: '2025-02-01T14:20:00Z' },
  ],
};

function loadState(): FallbackState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState(state: FallbackState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function getCurrentUser(state: FallbackState): any {
  try {
    const u = localStorage.getItem('pms_user');
    if (u) return JSON.parse(u);
  } catch {}
  return state.users[0];
}

function addAudit(state: FallbackState, action: string, module: string, tableName: string, recordId: any, newData?: any, oldData?: any) {
  const user = getCurrentUser(state);
  const nextId = (state.audit_logs.reduce((m, a) => Math.max(m, Number(a.audit_id) || 0), 0) || 0) + 1;
  state.audit_logs.unshift({
    audit_id: nextId,
    user_id: user?.user_id || 1,
    device_id: 1,
    action,
    module,
    table_name: tableName,
    record_id: String(recordId),
    old_data: oldData ? JSON.stringify(oldData) : null,
    new_data: newData ? JSON.stringify(newData) : null,
    ip_address: '127.0.0.1',
    created_at: new Date().toISOString(),
  });
}

function makeResponse(config: InternalAxiosRequestConfig, status: number, data: any): AxiosResponse {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : status === 201 ? 'Created' : 'Error',
    headers: {},
    config,
  };
}

export async function handleCloudflare501Fallback(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const state = loadState();
  const method = (config.method || 'get').toUpperCase();
  const rawUrl = (config.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
  const [pathOnly, queryString] = rawUrl.split('?');
  const searchParams = new URLSearchParams(queryString || '');
  if (config.params) {
    Object.entries(config.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') searchParams.set(k, String(v));
    });
  }

  let body: any = {};
  if (config.data) {
    body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  }

  const findProjectTitle = (projectId: string) =>
    state.projects.find((p) => p.project_id === projectId)?.title || projectId;

  // 1. Auth Routes
  if (pathOnly === '/auth/login' && method === 'POST') {
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const user = state.users.find((u) => u.username === username);
    const expectedPwd = state.passwords[username];

    if (!user || !expectedPwd || expectedPwd !== password) {
      throw {
        response: makeResponse(config, 401, {
          success: false,
          message: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Invalid username or password)',
        }),
      };
    }

    if (user.status !== 'active') {
      throw {
        response: makeResponse(config, 403, {
          success: false,
          message: 'គណនីនេះត្រូវបានផ្អាកដំណើរការ (Account is inactive)',
        }),
      };
    }

    user.last_login_at = new Date().toISOString();
    const token = `cf-session-${user.user_id}-${Date.now()}`;
    state.user_sessions.unshift({
      session_id: state.user_sessions.length + 1,
      user_id: user.user_id,
      device_id: 1,
      session_token: token,
      ip_address: '127.0.0.1',
      user_agent: navigator.userAgent,
      login_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'active',
    });
    addAudit(state, 'LOGIN', 'ការចូលប្រើប្រាស់', 'users', user.user_id, { username: user.username });
    saveState(state);

    return makeResponse(config, 200, {
      success: true,
      message: 'ចូលប្រើប្រាស់ប្រព័ន្ធជោគជ័យ',
      data: { token, user },
    });
  }

  if (pathOnly === '/auth/logout' && method === 'POST') {
    addAudit(state, 'LOGOUT', 'ការចូលប្រើប្រាស់', 'user_sessions', 1);
    saveState(state);
    return makeResponse(config, 200, { success: true, message: 'បានចាកចេញពីប្រព័ន្ធដោយជោគជ័យ' });
  }

  if (pathOnly === '/auth/me' && method === 'GET') {
    const user = getCurrentUser(state);
    return makeResponse(config, 200, { success: true, data: user });
  }

  // 2. Dashboard Routes
  if (pathOnly === '/dashboard/summary' || pathOnly === '/dashboard/stats') {
    const totalPlan = state.projects.reduce((s, p) => s + (Number(p.plan_amount) || 0), 0);
    const totalApproved = state.project_requests.reduce((s, r) => s + (Number(r.approved_amount) || 0), 0);
    const totalContract = state.contracts.reduce((s, c) => s + (Number(c.contract_amount) || 0), 0);
    const totalHandover = state.handovers.reduce((s, h) => s + (Number(h.handover_amount) || 0), 0);
    return makeResponse(config, 200, {
      success: true,
      data: {
        total_projects: state.projects.length,
        total_plan_amount: totalPlan,
        total_requests: state.project_requests.length,
        total_approved_amount: totalApproved,
        total_bidding: state.bidding_process.length,
        total_contracts: state.contracts.length,
        total_contracts_amount: totalContract,
        active_projects: state.contracts.filter((c) => c.status === 'កំពុងអនុវត្ត' || c.status === 'Active').length,
        total_handovers: state.handovers.length,
        total_handovers_amount: totalHandover,
        total_warranties: state.warranties.length,
        active_warranties: state.warranties.length,
        expiring_soon_warranties: 0,
        expired_warranties: 0,
      },
    });
  }

  if (pathOnly === '/dashboard/charts') {
    const yearsMap = new Map<string, { year: string; count: number; totalAmount: number }>();
    state.projects.forEach((p) => {
      const y = String(p.fiscal_year || 2025);
      const cur = yearsMap.get(y) || { year: y, count: 0, totalAmount: 0 };
      cur.count += 1;
      cur.totalAmount += Number(p.plan_amount) || 0;
      yearsMap.set(y, cur);
    });

    const typeMap = new Map<string, number>();
    state.projects.forEach((p) => {
      const t = p.procurement_type || 'ផ្សេងៗ';
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    });

    const statusMap = new Map<string, number>();
    state.contracts.forEach((c) => {
      const st = c.status || 'កំពុងអនុវត្ត';
      statusMap.set(st, (statusMap.get(st) || 0) + 1);
    });

    return makeResponse(config, 200, {
      success: true,
      data: {
        byFiscalYear: Array.from(yearsMap.values()),
        byProcurementType: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })),
        byStatus: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
        byWarranty: [
          { name: 'កំពុងធានា', value: state.warranties.length },
          { name: 'ជិតផុតកំណត់', value: 0 },
          { name: 'ផុតកំណត់', value: 0 },
        ],
      },
    });
  }

  if (pathOnly === '/dashboard/recent-activities') {
    const recentActivities = state.audit_logs.slice(0, 8).map((a) => {
      const u = state.users.find((usr) => usr.user_id === a.user_id);
      return { ...a, username: u?.username || 'admin', full_name: u?.full_name || 'Admin' };
    });
    return makeResponse(config, 200, {
      success: true,
      data: { recentActivities, alerts: [] },
    });
  }

  // Helper for pagination
  const paginate = (items: any[]) => {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10);
    const total = items.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const data = items.slice((page - 1) * limit, page * limit);
    return { data, pagination: { page, limit, total, totalPages } };
  };

  // 3. Projects
  if (pathOnly === '/projects' && method === 'GET') {
    const q = (searchParams.get('search') || '').toLowerCase();
    const fy = searchParams.get('fiscal_year') || '';
    const pt = searchParams.get('procurement_type') || '';
    const bt = searchParams.get('budget_type') || '';

    const filtered = state.projects
      .filter((p) => {
        if (q && !`${p.project_id} ${p.title} ${p.description || ''}`.toLowerCase().includes(q)) return false;
        if (fy && String(p.fiscal_year) !== fy) return false;
        if (pt && p.procurement_type !== pt) return false;
        if (bt && p.budget_type !== bt) return false;
        return true;
      })
      .map((p) => {
        const c = state.contracts.find((ct) => ct.project_id === p.project_id);
        const h = state.handovers.find((hd) => hd.project_id === p.project_id);
        const r = state.project_requests.find((rq) => rq.project_id === p.project_id);
        return {
          ...p,
          contract_status: c?.status || 'រៀបចំផែនការ',
          contract_amount: c?.contract_amount || null,
          progress_percent: h?.progress_percent || 0,
          approved_amount: r?.approved_amount || null,
        };
      });

    const { data, pagination } = paginate(filtered);
    return makeResponse(config, 200, { success: true, data, pagination });
  }

  if (pathOnly.startsWith('/projects/') && method === 'GET') {
    const id = decodeURIComponent(pathOnly.split('/')[2]);
    const project = state.projects.find((p) => p.project_id === id);
    if (!project) throw { response: makeResponse(config, 404, { success: false, message: 'រកមិនឃើញគម្រោងនេះទេ' }) };
    return makeResponse(config, 200, {
      success: true,
      data: {
        ...project,
        request: state.project_requests.find((r) => r.project_id === id) || null,
        bidding: state.bidding_process.find((b) => b.project_id === id) || null,
        contract: state.contracts.find((c) => c.project_id === id) || null,
        handover: state.handovers.find((h) => h.project_id === id) || null,
        warranty: state.warranties.find((w) => w.project_id === id) || null,
        documents: [],
      },
    });
  }

  if (pathOnly === '/projects' && method === 'POST') {
    const nextNum = state.projects.length + 1;
    const project_id = body.project_id ? String(body.project_id).trim().toUpperCase() : `PRJ-${String(nextNum).padStart(3, '0')}`;
    const newProj = {
      project_id,
      title: String(body.title || '').trim(),
      description: body.description || null,
      fiscal_year: Number(body.fiscal_year) || new Date().getFullYear(),
      budget_type: body.budget_type || 'មូលធន',
      procurement_type: body.procurement_type || 'ទំនិញ',
      procurement_method: body.procurement_method || 'ការដេញថ្លៃជាសាធារណៈក្នុងស្រុក (NCB)',
      plan_date: body.plan_date || new Date().toISOString().substring(0, 10),
      plan_amount: Number(body.plan_amount) || 0,
    };
    state.projects.unshift(newProj);
    addAudit(state, 'CREATE', 'គម្រោង', 'projects', project_id, newProj);
    saveState(state);
    return makeResponse(config, 201, { success: true, message: 'បានបង្កើតគម្រោងថ្មីដោយជោគជ័យ', data: newProj });
  }

  if (pathOnly.startsWith('/projects/') && method === 'PUT') {
    const id = decodeURIComponent(pathOnly.split('/')[2]);
    const idx = state.projects.findIndex((p) => p.project_id === id);
    if (idx === -1) throw { response: makeResponse(config, 404, { success: false, message: 'រកមិនឃើញគម្រោងនេះទេ' }) };
    state.projects[idx] = { ...state.projects[idx], ...body, project_id: id };
    addAudit(state, 'UPDATE', 'គម្រោង', 'projects', id, state.projects[idx]);
    saveState(state);
    return makeResponse(config, 200, { success: true, message: 'បានកែប្រែព័ត៌មានគម្រោងដោយជោគជ័យ', data: state.projects[idx] });
  }

  if (pathOnly.startsWith('/projects/') && method === 'DELETE') {
    const id = decodeURIComponent(pathOnly.split('/')[2]);
    state.projects = state.projects.filter((p) => p.project_id !== id);
    addAudit(state, 'DELETE', 'គម្រោង', 'projects', id);
    saveState(state);
    return makeResponse(config, 200, { success: true, message: 'បានលុបគម្រោងដោយជោគជ័យ' });
  }

  // 4. Project Requests
  if (['/project-requests', '/procurement-requests', '/procurement'].some((p) => pathOnly.startsWith(p))) {
    const parts = pathOnly.split('/');
    const id = parts[2];
    if (method === 'GET' && !id) {
      const items = state.project_requests.map((r) => ({
        ...r,
        project_title: findProjectTitle(r.project_id),
        difference: (Number(r.request_amount) || 0) - (Number(r.approved_amount) || 0),
      }));
      const { data, pagination } = paginate(items);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const request_id = (state.project_requests.reduce((m, r) => Math.max(m, Number(r.request_id) || 0), 0) || 0) + 1;
      const newReq = { request_id, ...body };
      state.project_requests.unshift(newReq);
      addAudit(state, 'CREATE', 'សំណើគម្រោង', 'project_requests', request_id, newReq);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: newReq });
    }
    if (method === 'PUT' && id) {
      const idx = state.project_requests.findIndex((r) => String(r.request_id) === id || r.project_id === id);
      if (idx !== -1) {
        state.project_requests[idx] = { ...state.project_requests[idx], ...body };
        saveState(state);
      }
      return makeResponse(config, 200, { success: true, data: state.project_requests[idx] });
    }
    if (method === 'DELETE' && id) {
      state.project_requests = state.project_requests.filter((r) => String(r.request_id) !== id && r.project_id !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  // 5. Bidding
  if (['/bidding', '/evaluations'].some((p) => pathOnly.startsWith(p))) {
    const id = pathOnly.split('/')[2];
    if (method === 'GET' && !id) {
      const items = state.bidding_process.map((b) => ({
        ...b,
        project_title: findProjectTitle(b.project_id),
        calculated_status: b.status || 'កំពុងមានសុពលភាព',
        remaining_days: 60,
      }));
      const { data, pagination } = paginate(items);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const bid_process_id = (state.bidding_process.reduce((m, b) => Math.max(m, Number(b.bid_process_id) || 0), 0) || 0) + 1;
      const item = { bid_process_id, ...body };
      state.bidding_process.unshift(item);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: item });
    }
    if (method === 'PUT' && id) {
      const idx = state.bidding_process.findIndex((b) => String(b.bid_process_id) === id || b.project_id === id);
      if (idx !== -1) state.bidding_process[idx] = { ...state.bidding_process[idx], ...body };
      saveState(state);
      return makeResponse(config, 200, { success: true, data: state.bidding_process[idx] });
    }
    if (method === 'DELETE' && id) {
      state.bidding_process = state.bidding_process.filter((b) => String(b.bid_process_id) !== id && b.project_id !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  // 6. Bidders
  if (pathOnly.startsWith('/bidders')) {
    const id = pathOnly.split('/')[2];
    if (method === 'GET' && !id) {
      const { data, pagination } = paginate(state.bidders);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const bidder_id = body.bidder_id || `BID-${String(state.bidders.length + 1).padStart(3, '0')}`;
      const item = { ...body, bidder_id, status: body.status || 'សកម្ម' };
      state.bidders.unshift(item);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: item });
    }
    if (method === 'PUT' && id) {
      const idx = state.bidders.findIndex((b) => b.bidder_id === id);
      if (idx !== -1) state.bidders[idx] = { ...state.bidders[idx], ...body };
      saveState(state);
      return makeResponse(config, 200, { success: true, data: state.bidders[idx] });
    }
    if (method === 'DELETE' && id) {
      state.bidders = state.bidders.filter((b) => b.bidder_id !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  // 7. Contracts
  if (pathOnly.startsWith('/contracts')) {
    const id = pathOnly.split('/')[2];
    if (method === 'GET' && !id) {
      const items = state.contracts.map((c) => ({
        ...c,
        project_title: findProjectTitle(c.project_id),
        remaining_days: 120,
        expired_days: 0,
        calculated_status: c.status || 'កំពុងអនុវត្ត',
      }));
      const { data, pagination } = paginate(items);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const contract_id = (state.contracts.reduce((m, c) => Math.max(m, Number(c.contract_id) || 0), 0) || 0) + 1;
      const item = { contract_id, ...body };
      state.contracts.unshift(item);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: item });
    }
    if (method === 'PUT' && id) {
      const idx = state.contracts.findIndex((c) => String(c.contract_id) === id || c.project_id === id);
      if (idx !== -1) state.contracts[idx] = { ...state.contracts[idx], ...body };
      saveState(state);
      return makeResponse(config, 200, { success: true, data: state.contracts[idx] });
    }
    if (method === 'DELETE' && id) {
      state.contracts = state.contracts.filter((c) => String(c.contract_id) !== id && c.project_id !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  // 8. Handovers
  if (['/handovers', '/deliveries'].some((p) => pathOnly.startsWith(p))) {
    const id = pathOnly.split('/')[2];
    if (method === 'GET' && !id) {
      const items = state.handovers.map((h) => ({ ...h, project_title: findProjectTitle(h.project_id) }));
      const { data, pagination } = paginate(items);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const handover_id = body.handover_id || `HO-${String(state.handovers.length + 1).padStart(3, '0')}`;
      const item = { ...body, handover_id };
      state.handovers.unshift(item);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: item });
    }
    if (method === 'PUT' && id) {
      const idx = state.handovers.findIndex((h) => h.handover_id === id || h.project_id === id);
      if (idx !== -1) state.handovers[idx] = { ...state.handovers[idx], ...body };
      saveState(state);
      return makeResponse(config, 200, { success: true, data: state.handovers[idx] });
    }
    if (method === 'DELETE' && id) {
      state.handovers = state.handovers.filter((h) => h.handover_id !== id && h.project_id !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  // 9. Warranties
  if (pathOnly.startsWith('/warranties')) {
    const id = pathOnly.split('/')[2];
    if (method === 'GET' && !id) {
      const items = state.warranties.map((w) => ({
        ...w,
        project_title: findProjectTitle(w.project_id),
        warranty_remaining_days: 300,
        expired_days: 0,
        calculated_status: 'កំពុងធានា',
      }));
      const { data, pagination } = paginate(items);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const warranty_id = (state.warranties.reduce((m, w) => Math.max(m, Number(w.warranty_id) || 0), 0) || 0) + 1;
      const item = { warranty_id, ...body };
      state.warranties.unshift(item);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: item });
    }
    if (method === 'PUT' && id) {
      const idx = state.warranties.findIndex((w) => String(w.warranty_id) === id || w.project_id === id);
      if (idx !== -1) state.warranties[idx] = { ...state.warranties[idx], ...body };
      saveState(state);
      return makeResponse(config, 200, { success: true, data: state.warranties[idx] });
    }
    if (method === 'DELETE' && id) {
      state.warranties = state.warranties.filter((w) => String(w.warranty_id) !== id && w.project_id !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  // 10. Users, Devices, Sessions, Audit Logs
  if (pathOnly.startsWith('/users')) {
    const id = pathOnly.split('/')[2];
    if (method === 'GET' && !id) {
      const { data, pagination } = paginate(state.users);
      return makeResponse(config, 200, { success: true, data, pagination });
    }
    if (method === 'POST') {
      const user_id = (state.users.reduce((m, u) => Math.max(m, Number(u.user_id) || 0), 0) || 0) + 1;
      const newUser = { user_id, ...body, status: body.status || 'active', created_at: new Date().toISOString() };
      delete newUser.password;
      if (body.password) state.passwords[newUser.username] = body.password;
      state.users.push(newUser);
      saveState(state);
      return makeResponse(config, 201, { success: true, data: newUser });
    }
    if (method === 'PUT' && id) {
      const idx = state.users.findIndex((u) => String(u.user_id) === id);
      if (idx !== -1) {
        if (body.password) state.passwords[state.users[idx].username] = body.password;
        const copy = { ...body };
        delete copy.password;
        state.users[idx] = { ...state.users[idx], ...copy };
      }
      saveState(state);
      return makeResponse(config, 200, { success: true, data: state.users[idx] });
    }
    if (method === 'DELETE' && id) {
      state.users = state.users.filter((u) => String(u.user_id) !== id);
      saveState(state);
      return makeResponse(config, 200, { success: true });
    }
  }

  if (pathOnly.startsWith('/devices')) {
    const items = state.devices.map((d) => {
      const u = state.users.find((usr) => usr.user_id === d.user_id);
      return { ...d, username: u?.username || 'admin', full_name: u?.full_name || 'Admin', role: u?.role || 'admin' };
    });
    const { data, pagination } = paginate(items);
    return makeResponse(config, 200, { success: true, data, pagination });
  }

  if (pathOnly.startsWith('/sessions')) {
    const items = state.user_sessions.map((s) => {
      const u = state.users.find((usr) => usr.user_id === s.user_id);
      return { ...s, username: u?.username || 'admin', full_name: u?.full_name || 'Admin', role: u?.role || 'admin' };
    });
    const { data, pagination } = paginate(items);
    return makeResponse(config, 200, { success: true, data, pagination });
  }

  if (pathOnly === '/audit-logs/modules') {
    return makeResponse(config, 200, { success: true, data: ['auth', 'projects', 'contracts', 'handovers'] });
  }

  if (pathOnly.startsWith('/audit-logs')) {
    const items = state.audit_logs.map((a) => {
      const u = state.users.find((usr) => usr.user_id === a.user_id);
      return { ...a, username: u?.username || 'admin', full_name: u?.full_name || 'Admin', role: u?.role || 'admin' };
    });
    const { data, pagination } = paginate(items);
    return makeResponse(config, 200, { success: true, data, pagination });
  }

  // 11. Reports
  if (pathOnly.startsWith('/reports/')) {
    const type = pathOnly.split('/')[2];
    const data = state.projects.map((p, idx) => {
      const c = state.contracts.find((ct) => ct.project_id === p.project_id);
      const h = state.handovers.find((hd) => hd.project_id === p.project_id);
      const r = state.project_requests.find((rq) => rq.project_id === p.project_id);
      const b = state.bidding_process.find((bd) => bd.project_id === p.project_id);
      return {
        no: idx + 1,
        project_id: p.project_id,
        title: p.title,
        project_title: p.title,
        fiscal_year: p.fiscal_year,
        procurement_type: p.procurement_type,
        budget_type: p.budget_type || 'មូលធន',
        procurement_method: p.procurement_method,
        plan_date: p.plan_date,
        plan_amount: Number(p.plan_amount) || 0,
        request_amount: Number(r?.request_amount) || 0,
        approved_amount: Number(r?.approved_amount) || 0,
        contract_amount: Number(c?.contract_amount) || 0,
        handover_amount: Number(h?.handover_amount) || 0,
        bid_opening: b?.bid_opening || '-',
        status: c?.status || 'កំពុងអនុវត្ត',
        progress: `${h?.progress_percent || 0}%`,
        col1_item_type: p.procurement_type,
        col2_budget_type: p.budget_type || 'មូលធន',
        col3_project_id: p.project_id,
        col4_description: p.title,
        col5_unit: 'គម្រោង',
        col6_quantity: '1',
        col7_award_decision: b?.mef_approval || '-',
        col8_bid_opening_date: b?.bid_opening || '-',
        col9_contract_ref: c ? `CON-${c.contract_id} (${c.approval_date || '-'})` : '-',
        col10_supplier_name: state.bidders[0]?.company_name || '-',
        col11_total_price_khr: Number(c?.contract_amount || p.plan_amount) || 0,
        col12_procuring_entity: 'ក្រសួងសុខាភិបាល',
      };
    });

    const totalAmount = data.reduce((acc, row) => acc + row.plan_amount, 0);
    return makeResponse(config, 200, {
      success: true,
      title: `របាយការណ៍លទ្ធកម្ម (${type})`,
      summary: { total_items: data.length, total_amount: totalAmount },
      data,
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: getCurrentUser(state)?.full_name || 'Admin',
        organization: 'ក្រសួងសុខាភិបាល - នាយកដ្ឋានលទ្ធកម្មសាធារណៈ (Ministry of Health)',
      },
    });
  }

  return makeResponse(config, 200, { success: true, data: [] });
}
