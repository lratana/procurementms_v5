import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getBidders(req: AuthenticatedRequest, res: Response) {
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
      whereClauses.push('(bidder_id LIKE ? OR company_name LIKE ? OR company_director LIKE ? OR tax_identification_number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(`SELECT COUNT(*) as total FROM bidders ${whereSql}`, params);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const data = await query(`SELECT * FROM bidders ${whereSql} ORDER BY bidder_id ASC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);

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

export async function getBidderById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();
    const rows = await query('SELECT * FROM bidders WHERE bidder_id = ? LIMIT 1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញក្រុមហ៊ុននេះទេ' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createBidder(req: AuthenticatedRequest, res: Response) {
  try {
    const { bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលឈ្មោះក្រុមហ៊ុន' });
    }

    const { query, execute } = await getDb();
    const countRows = await query('SELECT COUNT(*) as cnt FROM bidders');
    const count = Number(countRows[0]?.cnt || 0);

    const generatedId = bidder_id ? bidder_id.trim().toUpperCase() : `BDR-${String(count + 1).padStart(3, '0')}`;

    const existing = await query('SELECT bidder_id FROM bidders WHERE bidder_id = ? LIMIT 1', [generatedId]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'លេខកូដក្រុមហ៊ុននេះមានរួចហើយ' });
    }

    const newBidder = {
      bidder_id: generatedId,
      company_name: company_name.trim(),
      company_director: company_director ? company_director.trim() : null,
      phone_number: phone_number ? phone_number.trim() : null,
      tax_identification_number: tax_identification_number ? tax_identification_number.trim() : null,
      address: address ? address.trim() : null,
      status: status || 'active',
    };

    await execute(
      `INSERT INTO bidders (bidder_id, company_name, company_director, phone_number, tax_identification_number, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newBidder.bidder_id,
        newBidder.company_name,
        newBidder.company_director,
        newBidder.phone_number,
        newBidder.tax_identification_number,
        newBidder.address,
        newBidder.status,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'ក្រុមហ៊ុនដាក់សំណើ',
      tableName: 'bidders',
      recordId: generatedId,
      newData: newBidder,
    });

    return res.status(201).json({ success: true, message: 'បានចុះបញ្ជីក្រុមហ៊ុនដោយជោគជ័យ', data: newBidder });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateBidder(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { company_name, company_director, phone_number, tax_identification_number, address, status } = req.body;

    const { query, execute } = await getDb();
    const existing = await query('SELECT * FROM bidders WHERE bidder_id = ? LIMIT 1', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញក្រុមហ៊ុននេះទេ' });
    }

    const oldData = existing[0];
    const updated = {
      company_name: company_name !== undefined ? company_name.trim() : oldData.company_name,
      company_director: company_director !== undefined ? company_director.trim() : oldData.company_director,
      phone_number: phone_number !== undefined ? phone_number.trim() : oldData.phone_number,
      tax_identification_number: tax_identification_number !== undefined ? tax_identification_number.trim() : oldData.tax_identification_number,
      address: address !== undefined ? address.trim() : oldData.address,
      status: status !== undefined ? status : oldData.status,
    };

    await execute(
      `UPDATE bidders SET company_name = ?, company_director = ?, phone_number = ?, tax_identification_number = ?, address = ?, status = ?
       WHERE bidder_id = ?`,
      [
        updated.company_name,
        updated.company_director,
        updated.phone_number,
        updated.tax_identification_number,
        updated.address,
        updated.status,
        id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'ក្រុមហ៊ុនដាក់សំណើ',
      tableName: 'bidders',
      recordId: id,
      oldData,
      newData: updated,
    });

    return res.json({ success: true, message: 'បានកែប្រែព័ត៌មានក្រុមហ៊ុនដោយជោគជ័យ', data: { bidder_id: id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteBidder(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query, execute } = await getDb();

    const existing = await query('SELECT * FROM bidders WHERE bidder_id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញក្រុមហ៊ុននេះទេ' });
    }

    const oldData = existing[0];
    await execute('DELETE FROM bidders WHERE bidder_id = ?', [id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'ក្រុមហ៊ុនដាក់សំណើ',
      tableName: 'bidders',
      recordId: id,
      oldData,
    });

    return res.json({ success: true, message: 'បានលុបក្រុមហ៊ុនដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
