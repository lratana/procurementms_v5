import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getDevices(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = await getDb();

    const search = ((req.query.search as string) || '').trim();
    const status = req.query.status ? String(req.query.status) : '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push('(d.device_name LIKE ? OR d.ip_address LIKE ? OR d.operating_system LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push('d.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM devices d LEFT JOIN users u ON u.user_id = d.user_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT d.*, u.username, u.full_name as user_full_name
      FROM devices d
      LEFT JOIN users u ON u.user_id = d.user_id
      ${whereSql}
      ORDER BY d.device_id DESC
      LIMIT ? OFFSET ?
    `;

    const data = await query(listSql, [...params, limit, offset]);

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function toggleDeviceStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { query, execute } = await getDb();
    const existing = await query('SELECT * FROM devices WHERE device_id = ? LIMIT 1', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញឧបករណ៍នេះទេ' });
    }

    const currentStatus = existing[0].status;
    const newStatus = status || (currentStatus === 'active' ? 'disabled' : 'active');

    await execute('UPDATE devices SET status = ?, updated_at = NOW() WHERE device_id = ?', [newStatus, id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
      module: 'ឧបករណ៍',
      tableName: 'devices',
      recordId: id,
      oldData: { status: currentStatus },
      newData: { status: newStatus },
    });

    return res.json({
      success: true,
      message: newStatus === 'active' ? 'បានបើកដំណើរការឧបករណ៍ដោយជោគជ័យ' : 'បានផ្អាកដំណើរការឧបករណ៍ដោយជោគជ័យ',
      data: { device_id: Number(id), status: newStatus },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteDevice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM devices WHERE device_id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញឧបករណ៍នេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM devices WHERE device_id = ?', [id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'ឧបករណ៍',
      tableName: 'devices',
      recordId: id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបឧបករណ៍ដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getSessions(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = await getDb();
    const sessions = await query(
      `SELECT s.*, u.username, u.full_name
       FROM user_sessions s
       LEFT JOIN users u ON u.user_id = s.user_id
       ORDER BY s.session_id DESC
       LIMIT 50`
    );
    return res.json({ success: true, data: sessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
