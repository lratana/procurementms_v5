import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = await getDb();

    const search = ((req.query.search as string) || '').trim();
    const action = req.query.action ? String(req.query.action) : '';
    const moduleName = req.query.module ? String(req.query.module) : '';
    const userId = req.query.user_id ? Number(req.query.user_id) : 0;
    const fromDate = req.query.from_date ? String(req.query.from_date) : '';
    const toDate = req.query.to_date ? String(req.query.to_date) : '';
    const recordId = req.query.record_id ? String(req.query.record_id) : '';

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 15);
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push('(a.action LIKE ? OR a.module LIKE ? OR a.table_name LIKE ? OR a.record_id LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)');
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

    const countRows = await query(
      `SELECT COUNT(*) as total FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT a.*, u.username, u.full_name as user_full_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON u.user_id = a.user_id
      ${whereSql}
      ORDER BY a.created_at DESC
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

export async function getAuditLogById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const rows = await query(
      `SELECT a.*, u.username, u.full_name as user_full_name
       FROM audit_logs a
       LEFT JOIN users u ON u.user_id = a.user_id
       WHERE a.audit_id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញប្រវត្តិសកម្មភាពនេះទេ' });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
