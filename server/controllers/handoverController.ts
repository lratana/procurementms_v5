import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getHandovers(req: AuthenticatedRequest, res: Response) {
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
      whereClauses.push('(h.handover_id LIKE ? OR h.project_id LIKE ? OR p.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push('h.handover_status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) as total FROM handovers h LEFT JOIN projects p ON p.project_id = h.project_id ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const listSql = `
      SELECT h.*, p.title as project_title
      FROM handovers h
      LEFT JOIN projects p ON p.project_id = h.project_id
      ${whereSql}
      ORDER BY h.handover_id DESC
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

export async function getHandoverById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const rows = await query(
      `SELECT h.*, p.title as project_title
       FROM handovers h
       LEFT JOIN projects p ON p.project_id = h.project_id
       WHERE h.handover_id = ? OR h.project_id = ?
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាប្រគល់-ទទួលនេះទេ' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const { handover_id, project_id, contract_amount, handover_amount, stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes } = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: 'សូមជ្រើសរើសគម្រោង' });
    }

    const { query, execute } = await getDb();
    const existing = await query('SELECT handover_id FROM handovers WHERE project_id = ? LIMIT 1', [project_id]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'គម្រោងនេះមានកំណត់ត្រាប្រគល់-ទទួលរួចហើយ' });
    }

    const countRows = await query('SELECT COUNT(*) as cnt FROM handovers');
    const cnt = Number(countRows[0]?.cnt || 0);
    const generatedId = handover_id ? handover_id.trim().toUpperCase() : `HND-${String(cnt + 1).padStart(3, '0')}`;

    const s1 = Number(stage_1) || 0;
    const s2 = Number(stage_2) || 0;
    const s3 = Number(stage_3) || 0;
    const s4 = Number(stage_4) || 0;
    const totalHandover = handover_amount ? Number(handover_amount) : (s1 + s2 + s3 + s4);
    const contractAmt = Number(contract_amount) || 0;

    let calculatedProgress = progress_percent !== undefined && progress_percent !== '' ? Number(progress_percent) : 0;
    if (contractAmt > 0 && (progress_percent === undefined || progress_percent === '')) {
      calculatedProgress = Math.min(100, Math.round((totalHandover / contractAmt) * 100));
    }

    const newHandover = {
      handover_id: generatedId,
      project_id,
      contract_amount: contractAmt,
      handover_amount: totalHandover,
      stage_1: s1,
      stage_2: s2,
      stage_3: s3,
      stage_4: s4,
      progress_percent: calculatedProgress,
      handover_status: handover_status || (calculatedProgress >= 100 ? 'ប្រគល់រួចរាល់' : calculatedProgress > 0 ? 'កំពុងដំណើរការ' : 'មិនទាន់ប្រគល់'),
      notes: notes || null,
    };

    await execute(
      `INSERT INTO handovers (handover_id, project_id, contract_amount, handover_amount, stage_1, stage_2, stage_3, stage_4, progress_percent, handover_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newHandover.handover_id,
        newHandover.project_id,
        newHandover.contract_amount,
        newHandover.handover_amount,
        newHandover.stage_1,
        newHandover.stage_2,
        newHandover.stage_3,
        newHandover.stage_4,
        newHandover.progress_percent,
        newHandover.handover_status,
        newHandover.notes,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'ប្រគល់-ទទួល',
      tableName: 'handovers',
      recordId: generatedId,
      newData: newHandover,
    });

    return res.status(201).json({ success: true, message: 'បានកត់ត្រាការប្រគល់-ទទួលដោយជោគជ័យ', data: newHandover });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM handovers WHERE handover_id = ? OR project_id = ? LIMIT 1', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាប្រគល់-ទទួលនេះទេ' });
    }

    const oldData = existing[0];
    const s1 = body.stage_1 !== undefined ? Number(body.stage_1) : Number(oldData.stage_1);
    const s2 = body.stage_2 !== undefined ? Number(body.stage_2) : Number(oldData.stage_2);
    const s3 = body.stage_3 !== undefined ? Number(body.stage_3) : Number(oldData.stage_3);
    const s4 = body.stage_4 !== undefined ? Number(body.stage_4) : Number(oldData.stage_4);
    const contractAmt = body.contract_amount !== undefined ? Number(body.contract_amount) : Number(oldData.contract_amount);
    const totalHandover = body.handover_amount !== undefined ? Number(body.handover_amount) : (s1 + s2 + s3 + s4);

    let progress = body.progress_percent !== undefined ? Number(body.progress_percent) : Number(oldData.progress_percent);
    if (contractAmt > 0 && body.progress_percent === undefined) {
      progress = Math.min(100, Math.round((totalHandover / contractAmt) * 100));
    }

    const updated = {
      contract_amount: contractAmt,
      handover_amount: totalHandover,
      stage_1: s1,
      stage_2: s2,
      stage_3: s3,
      stage_4: s4,
      progress_percent: progress,
      handover_status: body.handover_status !== undefined ? body.handover_status : (progress >= 100 ? 'ប្រគល់រួចរាល់' : progress > 0 ? 'កំពុងដំណើរការ' : 'មិនទាន់ប្រគល់'),
      notes: body.notes !== undefined ? body.notes : oldData.notes,
    };

    await execute(
      `UPDATE handovers SET contract_amount = ?, handover_amount = ?, stage_1 = ?, stage_2 = ?, stage_3 = ?, stage_4 = ?, progress_percent = ?, handover_status = ?, notes = ?
       WHERE handover_id = ?`,
      [
        updated.contract_amount,
        updated.handover_amount,
        updated.stage_1,
        updated.stage_2,
        updated.stage_3,
        updated.stage_4,
        updated.progress_percent,
        updated.handover_status,
        updated.notes,
        oldData.handover_id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'ប្រគល់-ទទួល',
      tableName: 'handovers',
      recordId: oldData.handover_id,
      oldData,
      newData: updated,
    });

    return res.json({ success: true, message: 'បានកែប្រែកំណត់ត្រាប្រគល់-ទទួលដោយជោគជ័យ', data: { handover_id: oldData.handover_id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteHandover(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM handovers WHERE handover_id = ? OR project_id = ? LIMIT 1', [id, id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញកំណត់ត្រាប្រគល់-ទទួលនេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM handovers WHERE handover_id = ?', [oldData.handover_id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'ប្រគល់-ទទួល',
      tableName: 'handovers',
      recordId: oldData.handover_id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបកំណត់ត្រាប្រគល់-ទទួលដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
