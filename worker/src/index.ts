import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
};
type Variables = { user: { user_id: number; username: string; role: string } };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('/api/*', async (c, next) => {
  const allowed = (c.env.CORS_ORIGIN || '').split(',').map(v => v.trim()).filter(Boolean);
  return cors({ origin: allowed, allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'], credentials: false })(c, next);
});

app.get('/api/health', async c => {
  const result = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return c.json({ success: true, service: 'procurementms-api', database: result?.ok === 1 ? 'connected' : 'unknown' });
});

const auth = async (c: any, next: any) => {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ success: false, message: 'Authentication required' }, 401);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as any;
    const session = await c.env.DB.prepare(
      "SELECT session_id FROM user_sessions WHERE session_token = ? AND status = 'active' AND expires_at > datetime('now')"
    ).bind(token).first();
    if (!session) return c.json({ success: false, message: 'Session expired or revoked' }, 401);
    const user = await c.env.DB.prepare(
      `SELECT user_id, username, full_name, email, phone_number, role, department,
              position, profile_photo, status, last_login_at
       FROM users WHERE user_id = ? LIMIT 1`
    ).bind(Number(payload.user_id)).first() as { user_id: number; username: string; full_name: string; email: string | null; phone_number: string | null; role: string; department: string | null; position: string | null; profile_photo: string | null; status: string; last_login_at: string | null } | null;
    if (!user || user.status !== 'active') {
      return c.json({ success: false, message: 'User not found or inactive' }, 401);
    }
    c.set('user', user);
    await next();
  } catch { return c.json({ success: false, message: 'Invalid or expired token' }, 401); }
};
const admin = async (c: any, next: any) => {
  if (c.get('user')?.role !== 'admin') return c.json({ success: false, message: 'Forbidden' }, 403);
  await next();
};
const editor = async (c: any, next: any) => {
  if (!['admin', 'editor'].includes(c.get('user')?.role)) return c.json({ success: false, message: 'Forbidden' }, 403);
  await next();
};

// Login foundation. Password hashing compatibility is intentionally not guessed here:
// bcryptjs hashes from the existing Node app must be verified using a tested Workers-compatible implementation.
app.post('/api/auth/login', async c => {
  return c.json({ success: false, message: 'Cloudflare login migration is not enabled yet. Port and test password verification before switching the frontend.' }, 501);
});
app.post('/api/auth/logout', auth, async c => {
  const token = (c.req.header('Authorization') || '').slice(7);
  await c.env.DB.prepare("UPDATE user_sessions SET status='revoked', logout_at=datetime('now') WHERE session_token=?").bind(token).run();
  return c.json({ success: true, message: 'Logged out' });
});
app.get('/api/auth/me', auth, async c => c.json({ success: true, data: c.get('user') }));

// Projects API: first fully ported CRUD slice, using D1 prepared statements.
app.get('/api/projects', auth, async c => {
  const rows = await c.env.DB.prepare('SELECT * FROM projects ORDER BY project_id').all();
  return c.json({ success: true, data: rows.results });
});
app.get('/api/projects/:id', auth, async c => {
  const id = c.req.param('id');
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE project_id=?').bind(id).first();
  if (!project) return c.json({ success: false, message: 'Project not found' }, 404);
  const [requests, bidding, contracts, handovers, warranties] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM project_requests WHERE project_id=?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM bidding_process WHERE project_id=?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM contracts WHERE project_id=?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM handovers WHERE project_id=?').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM warranties WHERE project_id=?').bind(id).all()
  ]);
  return c.json({ success: true, data: { ...project, requests: requests.results, bidding: bidding.results, contracts: contracts.results, handovers: handovers.results, warranties: warranties.results } });
});
app.post('/api/projects', auth, editor, async c => {
  const b = await c.req.json<any>();
  if (!b.project_id || !b.title) return c.json({ success: false, message: 'project_id and title are required' }, 400);
  await c.env.DB.prepare(`INSERT INTO projects(project_id,title,description,fiscal_year,procurement_type,budget_type,procurement_method,plan_date,plan_amount)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(b.project_id, b.title, b.description ?? null, b.fiscal_year ?? null, b.procurement_type ?? null, b.budget_type ?? 'មូលធន', b.procurement_method ?? null, b.plan_date ?? null, b.plan_amount ?? null).run();
  return c.json({ success: true, data: { project_id: b.project_id } }, 201);
});
app.put('/api/projects/:id', auth, editor, async c => {
  const id = c.req.param('id'); const b = await c.req.json<any>();
  const result = await c.env.DB.prepare(`UPDATE projects SET title=?,description=?,fiscal_year=?,procurement_type=?,budget_type=?,procurement_method=?,plan_date=?,plan_amount=? WHERE project_id=?`)
    .bind(b.title, b.description ?? null, b.fiscal_year ?? null, b.procurement_type ?? null, b.budget_type ?? 'មូលធន', b.procurement_method ?? null, b.plan_date ?? null, b.plan_amount ?? null, id).run();
  return c.json({ success: true, changes: result.meta.changes });
});
app.delete('/api/projects/:id', auth, admin, async c => {
  const result = await c.env.DB.prepare('DELETE FROM projects WHERE project_id=?').bind(c.req.param('id')).run();
  return c.json({ success: true, changes: result.meta.changes });
});

// Keep the remaining legacy endpoint surface visible so incomplete migration cannot silently masquerade as complete.
const pending = ['/api/dashboard/summary', '/api/dashboard/charts', '/api/dashboard/recent-activities', '/api/project-requests', '/api/bidding', '/api/bidders', '/api/contracts', '/api/handovers', '/api/warranties', '/api/users', '/api/devices', '/api/sessions', '/api/audit-logs', '/api/reports/:type'];
for (const route of pending) {
  app.all(route, c => c.json({ success: false, message: 'This endpoint is not ported to Cloudflare Workers yet. Keep using the existing Express backend until this module is migrated and tested.' }, 501));
}
app.notFound(c => c.json({ success: false, message: 'API route not found' }, 404));
app.onError((err, c) => {
  console.error('Worker API error', err);
  return c.json({ success: false, message: 'Internal server error' }, 500);
});
export default app;
