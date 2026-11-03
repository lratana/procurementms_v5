import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getContracts(req: AuthenticatedRequest, res: Response) {
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
      whereClauses.push('(c.project_id LIKE ? OR p.title LIKE ? OR CAST(c.contract_id AS CHAR) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push('c.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM contracts c LEFT JOIN projects p ON p.project_id = c.project_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT c.*, p.title as project_title
      FROM contracts c
      LEFT JOIN projects p ON p.project_id = c.project_id
      ${whereSql}
      ORDER BY c.contract_id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(listSql, [...params, limit, offset]);
    const now = new Date();

    const enriched = rows.map((c) => {
      let remainingDays = 0;
      let expiredDays = 0;
      let dynamicStatus = c.status || 'កំពុងអនុវត្ត';

      if (c.end_date) {
        const endDate = new Date(c.end_date);
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          remainingDays = diffDays;
          expiredDays = 0;
        } else {
          remainingDays = 0;
          expiredDays = Math.abs(diffDays);
          if (c.status !== 'បានបញ្ចប់') {
            dynamicStatus = 'ផុតកំណត់';
          }
        }
      }

      return {
        ...c,
        calculated_remaining_days: remainingDays,
        calculated_expired_days: expiredDays,
        calculated_status: dynamicStatus,
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

export async function getContractById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const rows = await query(
      `SELECT c.*, p.title as project_title
       FROM contracts c
       LEFT JOIN projects p ON p.project_id = c.project_id
       WHERE c.contract_id = ? OR c.project_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកិច្ចសន្យានេះទេ' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createContract(req: AuthenticatedRequest, res: Response) {
  try {
    const { project_id, contract_submit_mef, contract_amount, approval_date, end_date, contract_validity, expiry_days, status, handover } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'សូមជ្រើសរើសគម្រោង' });
    }

    const { query, execute } = await getDb();
    const existing = await query('SELECT contract_id FROM contracts WHERE project_id = ? LIMIT 1', [project_id]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'គម្រោងនេះមានកិច្ចសន្យារួចហើយ' });
    }

    const newContract = {
      project_id,
      contract_submit_mef: contract_submit_mef || null,
      contract_amount: contract_amount ? Number(contract_amount) : 0,
      approval_date: approval_date || null,
      end_date: end_date || null,
      contract_validity: contract_validity ? Number(contract_validity) : 180,
      expiry_days: expiry_days ? Number(expiry_days) : 0,
      status: status || 'កំពុងអនុវត្ត',
      handover: handover || 'មិនទាន់ប្រគល់',
    };

    const result = await execute(
      `INSERT INTO contracts (project_id, contract_submit_mef, contract_amount, approval_date, end_date, contract_validity, expiry_days, status, handover)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newContract.project_id,
        newContract.contract_submit_mef,
        newContract.contract_amount,
        newContract.approval_date,
        newContract.end_date,
        newContract.contract_validity,
        newContract.expiry_days,
        newContract.status,
        newContract.handover,
      ]
    );

    const id = result.insertId;

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'កិច្ចសន្យា',
      tableName: 'contracts',
      recordId: id,
      newData: { contract_id: id, ...newContract },
    });

    return res.status(201).json({ success: true, message: 'បានបង្កើតកិច្ចសន្យាដោយជោគជ័យ', data: { contract_id: id, ...newContract } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateContract(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM contracts WHERE contract_id = ? OR project_id = ? LIMIT 1', [id, id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកិច្ចសន្យានេះទេ' });
    }

    const oldData = existing[0];
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

    await execute(
      `UPDATE contracts SET contract_submit_mef = ?, contract_amount = ?, approval_date = ?, end_date = ?, contract_validity = ?, expiry_days = ?, status = ?, handover = ?
       WHERE contract_id = ?`,
      [
        updated.contract_submit_mef,
        updated.contract_amount,
        updated.approval_date,
        updated.end_date,
        updated.contract_validity,
        updated.expiry_days,
        updated.status,
        updated.handover,
        oldData.contract_id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'កិច្ចសន្យា',
      tableName: 'contracts',
      recordId: oldData.contract_id,
      oldData,
      newData: updated,
    });

    return res.json({ success: true, message: 'បានកែប្រែកិច្ចសន្យាដោយជោគជ័យ', data: { contract_id: oldData.contract_id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteContract(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM contracts WHERE contract_id = ? OR project_id = ? LIMIT 1', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកិច្ចសន្យានេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM contracts WHERE contract_id = ?', [oldData.contract_id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'កិច្ចសន្យា',
      tableName: 'contracts',
      recordId: oldData.contract_id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបកិច្ចសន្យាដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
