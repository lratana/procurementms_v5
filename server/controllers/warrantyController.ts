import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getWarranties(req: AuthenticatedRequest, res: Response) {
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
      whereClauses.push('(w.project_id LIKE ? OR p.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push('w.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM warranties w LEFT JOIN projects p ON p.project_id = w.project_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT w.*, p.title as project_title
      FROM warranties w
      LEFT JOIN projects p ON p.project_id = w.project_id
      ${whereSql}
      ORDER BY w.warranty_id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(listSql, [...params, limit, offset]);
    const now = new Date();

    const enriched = rows.map((w) => {
      let remainingDays = 0;
      let expiredDays = 0;
      let calculatedStatus = 'កំពុងធានា';

      if (w.expired_date) {
        const expDate = new Date(w.expired_date);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

    return res.json({
      success: true,
      data: enriched,
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

export async function getWarrantyById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const rows = await query(
      `SELECT w.*, p.title as project_title
       FROM warranties w
       LEFT JOIN projects p ON p.project_id = w.project_id
       WHERE w.warranty_id = ? OR w.project_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាធានានេះទេ' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createWarranty(req: AuthenticatedRequest, res: Response) {
  try {
    const { project_id, existing_handover_date, handover_date, warranty_period_days, expired_years, expired_date, status } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'សូមជ្រើសរើសគម្រោង' });
    }

    const { query, execute } = await getDb();
    const existing = await query('SELECT warranty_id FROM warranties WHERE project_id = ? LIMIT 1', [project_id]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'គម្រោងនេះមានកំណត់ត្រាធានារួចហើយ' });
    }

    const periodDays = warranty_period_days ? Number(warranty_period_days) : 365;
    let finalExpiredDate = expired_date;

    if (!finalExpiredDate && handover_date) {
      const d = new Date(handover_date);
      d.setDate(d.getDate() + periodDays);
      finalExpiredDate = d.toISOString().substring(0, 10);
    }

    const expYear = expired_years ? Number(expired_years) : (finalExpiredDate ? new Date(finalExpiredDate).getFullYear() : new Date().getFullYear() + 1);

    const newWarranty = {
      project_id,
      existing_handover_date: existing_handover_date || null,
      handover_date: handover_date || null,
      warranty_period_days: periodDays,
      expired_years: expYear,
      expired_date: finalExpiredDate || null,
      warranty_remaining_days: periodDays,
      expired_days: 0,
      status: status || 'កំពុងធានា',
    };

    const result = await execute(
      `INSERT INTO warranties (project_id, existing_handover_date, handover_date, warranty_period_days, expired_years, expired_date, warranty_remaining_days, expired_days, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newWarranty.project_id,
        newWarranty.existing_handover_date,
        newWarranty.handover_date,
        newWarranty.warranty_period_days,
        newWarranty.expired_years,
        newWarranty.expired_date,
        newWarranty.warranty_remaining_days,
        newWarranty.expired_days,
        newWarranty.status,
      ]
    );

    const id = result.insertId;

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'ការធានា',
      tableName: 'warranties',
      recordId: id,
      newData: { warranty_id: id, ...newWarranty },
    });

    return res.status(201).json({ success: true, message: 'បានកត់ត្រាការធានាដោយជោគជ័យ', data: { warranty_id: id, ...newWarranty } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateWarranty(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM warranties WHERE warranty_id = ? OR project_id = ? LIMIT 1', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាធានានេះទេ' });
    }

    const oldData = existing[0];
    const periodDays = body.warranty_period_days !== undefined ? Number(body.warranty_period_days) : Number(oldData.warranty_period_days);
    let finalExpiredDate = body.expired_date !== undefined ? body.expired_date : oldData.expired_date;

    if (body.handover_date && body.warranty_period_days && !body.expired_date) {
      const d = new Date(body.handover_date);
      d.setDate(d.getDate() + periodDays);
      finalExpiredDate = d.toISOString().substring(0, 10);
    }

    const updated = {
      existing_handover_date: body.existing_handover_date !== undefined ? body.existing_handover_date : oldData.existing_handover_date,
      handover_date: body.handover_date !== undefined ? body.handover_date : oldData.handover_date,
      warranty_period_days: periodDays,
      expired_years: body.expired_years !== undefined ? Number(body.expired_years) : (finalExpiredDate ? new Date(finalExpiredDate).getFullYear() : oldData.expired_years),
      expired_date: finalExpiredDate,
      status: body.status !== undefined ? body.status : oldData.status,
    };

    await execute(
      `UPDATE warranties SET existing_handover_date = ?, handover_date = ?, warranty_period_days = ?, expired_years = ?, expired_date = ?, status = ?
       WHERE warranty_id = ?`,
      [
        updated.existing_handover_date,
        updated.handover_date,
        updated.warranty_period_days,
        updated.expired_years,
        updated.expired_date,
        updated.status,
        oldData.warranty_id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'ការធានា',
      tableName: 'warranties',
      recordId: oldData.warranty_id,
      oldData,
      newData: updated,
    });

    return res.json({ success: true, message: 'បានកែប្រែកំណត់ត្រាធានាដោយជោគជ័យ', data: { warranty_id: oldData.warranty_id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteWarranty(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM warranties WHERE warranty_id = ? OR project_id = ? LIMIT 1', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាធានានេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM warranties WHERE warranty_id = ?', [oldData.warranty_id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'ការធានា',
      tableName: 'warranties',
      recordId: oldData.warranty_id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបកំណត់ត្រាធានាដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
