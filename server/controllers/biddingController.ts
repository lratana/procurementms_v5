import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getBiddingProcesses(req: AuthenticatedRequest, res: Response) {
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
      whereClauses.push('(b.project_id LIKE ? OR p.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push('b.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM bidding_process b LEFT JOIN projects p ON p.project_id = b.project_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT b.*, p.title as project_title
      FROM bidding_process b
      LEFT JOIN projects p ON p.project_id = b.project_id
      ${whereSql}
      ORDER BY b.bid_process_id DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await query(listSql, [...params, limit, offset]);
    const now = new Date();

    const enriched = rows.map((b) => {
      let dynamicStatus = b.status || 'កំពុងមានសុពលភាព';
      let remainingDays = b.expiry_days || 0;

      if (b.valid_until) {
        const expiryDate = new Date(b.valid_until);
        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        remainingDays = diffDays > 0 ? diffDays : 0;
        dynamicStatus = diffDays > 0 ? 'កំពុងមានសុពលភាព' : 'ផុតកំណត់';
      }

      return {
        ...b,
        calculated_status: dynamicStatus,
        remaining_days: remainingDays,
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

export async function getBiddingById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const rows = await query(
      `SELECT b.*, p.title as project_title
       FROM bidding_process b
       LEFT JOIN projects p ON p.project_id = b.project_id
       WHERE b.bid_process_id = ? OR b.project_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញដំណើរការដេញថ្លៃនេះទេ' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createBidding(req: AuthenticatedRequest, res: Response) {
  try {
    const { project_id, prepare_bid, moh_approval, mef_submit, mef_approval, advertise_date, bid_opening, validity_days, expiry_days, valid_until, status } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'សូមជ្រើសរើសលេខគម្រោង' });
    }

    const { query, execute } = await getDb();
    const existing = await query('SELECT bid_process_id FROM bidding_process WHERE project_id = ? LIMIT 1', [project_id]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'គម្រោងនេះមានដំណើរការដេញថ្លៃរួចហើយ' });
    }

    let calculatedValidUntil = valid_until;
    if (!calculatedValidUntil && bid_opening && validity_days) {
      const d = new Date(bid_opening);
      d.setDate(d.getDate() + Number(validity_days));
      calculatedValidUntil = d.toISOString().substring(0, 10);
    }

    const newBidding = {
      project_id,
      prepare_bid: prepare_bid || null,
      moh_approval: moh_approval || null,
      mef_submit: mef_submit || null,
      mef_approval: mef_approval || null,
      advertise_date: advertise_date || null,
      bid_opening: bid_opening || null,
      validity_days: validity_days ? Number(validity_days) : 90,
      expiry_days: expiry_days ? Number(expiry_days) : 30,
      valid_until: calculatedValidUntil || null,
      status: status || 'កំពុងមានសុពលភាព',
    };

    const result = await execute(
      `INSERT INTO bidding_process (project_id, prepare_bid, moh_approval, mef_submit, mef_approval, advertise_date, bid_opening, validity_days, expiry_days, valid_until, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        newBidding.status,
      ]
    );

    const id = result.insertId;

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'ការដេញថ្លៃ',
      tableName: 'bidding_process',
      recordId: id,
      newData: { bid_process_id: id, ...newBidding },
    });

    return res.status(201).json({ success: true, message: 'បានបង្កើតដំណើរការដេញថ្លៃដោយជោគជ័យ', data: { bid_process_id: id, ...newBidding } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateBidding(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM bidding_process WHERE bid_process_id = ? OR project_id = ? LIMIT 1', [id, id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញដំណើរការដេញថ្លៃនេះទេ' });
    }

    const oldData = existing[0];
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

    await execute(
      `UPDATE bidding_process SET prepare_bid = ?, moh_approval = ?, mef_submit = ?, mef_approval = ?, advertise_date = ?, bid_opening = ?, validity_days = ?, expiry_days = ?, valid_until = ?, status = ?
       WHERE bid_process_id = ?`,
      [
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
        oldData.bid_process_id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'ការដេញថ្លៃ',
      tableName: 'bidding_process',
      recordId: oldData.bid_process_id,
      oldData,
      newData: updated,
    });

    return res.json({ success: true, message: 'បានកែប្រែដំណើរការដេញថ្លៃដោយជោគជ័យ', data: { bid_process_id: oldData.bid_process_id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteBidding(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM bidding_process WHERE bid_process_id = ? OR project_id = ? LIMIT 1', [id, id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញដំណើរការដេញថ្លៃនេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM bidding_process WHERE bid_process_id = ?', [oldData.bid_process_id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'ការដេញថ្លៃ',
      tableName: 'bidding_process',
      recordId: oldData.bid_process_id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបដំណើរការដេញថ្លៃដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
