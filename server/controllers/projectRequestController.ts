import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getProjectRequests(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = await getDb();

    const search = ((req.query.search as string) || '').trim();
    const fiscal_year = req.query.fiscal_year ? String(req.query.fiscal_year) : '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push('(r.project_id LIKE ? OR p.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (fiscal_year) {
      whereClauses.push('r.fiscal_year = ?');
      params.push(fiscal_year);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM project_requests r LEFT JOIN projects p ON p.project_id = r.project_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT r.*, p.title as project_title,
        (COALESCE(r.request_amount, 0) - COALESCE(r.approved_amount, 0)) as difference
      FROM project_requests r
      LEFT JOIN projects p ON p.project_id = r.project_id
      ${whereSql}
      ORDER BY r.request_id DESC
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

export async function getProjectRequestById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const rows = await query(
      `SELECT r.*, p.title as project_title,
        (COALESCE(r.request_amount, 0) - COALESCE(r.approved_amount, 0)) as difference
       FROM project_requests r
       LEFT JOIN projects p ON p.project_id = r.project_id
       WHERE r.request_id = ? OR r.project_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញសំណើគម្រោងនេះទេ' });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createProjectRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'សូមជ្រើសរើសលេខគម្រោង' });
    }

    const { query, execute } = await getDb();
    const existing = await query('SELECT request_id FROM project_requests WHERE project_id = ? LIMIT 1', [project_id]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'គម្រោងនេះមានសំណើរួចហើយ' });
    }

    const newReq = {
      project_id,
      request_date: request_date || new Date().toISOString().substring(0, 10),
      fiscal_year: fiscal_year ? Number(fiscal_year) : new Date().getFullYear(),
      request_amount: request_amount ? Number(request_amount) : 0,
      approval_date: approval_date || null,
      approved_amount: approved_amount ? Number(approved_amount) : null,
    };

    const result = await execute(
      `INSERT INTO project_requests (project_id, request_date, fiscal_year, request_amount, approval_date, approved_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newReq.project_id,
        newReq.request_date,
        newReq.fiscal_year,
        newReq.request_amount,
        newReq.approval_date,
        newReq.approved_amount,
      ]
    );

    const id = result.insertId;

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'សំណើគម្រោង',
      tableName: 'project_requests',
      recordId: id,
      newData: { request_id: id, ...newReq },
    });

    return res.status(201).json({ success: true, message: 'បានបង្កើតសំណើគម្រោងដោយជោគជ័យ', data: { request_id: id, ...newReq } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateProjectRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { request_date, fiscal_year, request_amount, approval_date, approved_amount } = req.body;

    const { query, execute } = await getDb();
    const existing = await query('SELECT * FROM project_requests WHERE request_id = ? OR project_id = ? LIMIT 1', [id, id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញសំណើគម្រោងនេះទេ' });
    }

    const oldData = existing[0];
    const updated = {
      request_date: request_date !== undefined ? request_date : oldData.request_date,
      fiscal_year: fiscal_year !== undefined ? Number(fiscal_year) : oldData.fiscal_year,
      request_amount: request_amount !== undefined ? Number(request_amount) : oldData.request_amount,
      approval_date: approval_date !== undefined ? approval_date : oldData.approval_date,
      approved_amount: approved_amount !== undefined ? Number(approved_amount) : oldData.approved_amount,
    };

    await execute(
      `UPDATE project_requests SET request_date = ?, fiscal_year = ?, request_amount = ?, approval_date = ?, approved_amount = ?
       WHERE request_id = ?`,
      [updated.request_date, updated.fiscal_year, updated.request_amount, updated.approval_date, updated.approved_amount, oldData.request_id]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'សំណើគម្រោង',
      tableName: 'project_requests',
      recordId: oldData.request_id,
      oldData,
      newData: updated,
    });

    return res.json({ success: true, message: 'បានកែប្រែសំណើគម្រោងដោយជោគជ័យ', data: { request_id: oldData.request_id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteProjectRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();
    const existing = await query('SELECT * FROM project_requests WHERE request_id = ? OR project_id = ? LIMIT 1', [id, id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញសំណើគម្រោងនេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM project_requests WHERE request_id = ?', [oldData.request_id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'សំណើគម្រោង',
      tableName: 'project_requests',
      recordId: oldData.request_id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបសំណើគម្រោងដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
