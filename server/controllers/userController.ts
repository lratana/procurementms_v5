import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

export async function getUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = await getDb();

    const search = ((req.query.search as string) || '').trim();
    const role = req.query.role ? String(req.query.role) : '';
    const status = req.query.status ? String(req.query.status) : '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push('(username LIKE ? OR full_name LIKE ? OR email LIKE ? OR department LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClauses.push('role = ?');
      params.push(role);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRows = await query(`SELECT COUNT(*) as total FROM users ${whereSql}`, params);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    const users = await query(
      `SELECT user_id, username, full_name, email, phone_number, role, department, position, profile_photo, status, last_login_at, created_at, updated_at
       FROM users ${whereSql}
       ORDER BY user_id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: users,
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

export async function getUserById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { query } = await getDb();
    const rows = await query(
      `SELECT user_id, username, full_name, email, phone_number, role, department, position, profile_photo, status, last_login_at, created_at, updated_at
       FROM users WHERE user_id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញអ្នកប្រើប្រាស់នេះទេ' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { username, password, full_name, email, phone_number, role, department, position, profile_photo, status } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលឈ្មោះគណនី (Username is required)' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦តួអក្សរ (Password must be >= 6 chars)' });
    }
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, message: 'សូមបញ្ចូលឈ្មោះពេញ' });
    }

    const { query, execute } = await getDb();
    const existing = await query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [username.trim()]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'ឈ្មោះគណនីនេះត្រូវបានប្រើប្រាស់រួចហើយ' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const newUser = {
      username: username.trim(),
      password_hash,
      full_name: full_name.trim(),
      email: email ? email.trim() : null,
      phone_number: phone_number ? phone_number.trim() : null,
      role: role || 'viewer',
      department: department ? department.trim() : null,
      position: position ? position.trim() : null,
      profile_photo: profile_photo || null,
      status: status || 'active',
    };

    const result = await execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone_number, role, department, position, profile_photo, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        newUser.username,
        newUser.password_hash,
        newUser.full_name,
        newUser.email,
        newUser.phone_number,
        newUser.role,
        newUser.department,
        newUser.position,
        newUser.profile_photo,
        newUser.status,
      ]
    );

    const id = result.insertId;

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'អ្នកប្រើប្រាស់',
      tableName: 'users',
      recordId: id,
      newData: { username: newUser.username, role: newUser.role, full_name: newUser.full_name },
    });

    const { password_hash: _, ...safeUser } = { user_id: id, ...newUser };
    return res.status(201).json({ success: true, message: 'បានបង្កើតអ្នកប្រើប្រាស់ដោយជោគជ័យ', data: safeUser });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { full_name, email, phone_number, role, department, position, profile_photo, status } = req.body;

    const { query, execute } = await getDb();
    const existing = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញអ្នកប្រើប្រាស់នេះទេ' });
    }

    const oldData = existing[0];
    const updated = {
      full_name: full_name !== undefined ? full_name.trim() : oldData.full_name,
      email: email !== undefined ? (email ? email.trim() : null) : oldData.email,
      phone_number: phone_number !== undefined ? (phone_number ? phone_number.trim() : null) : oldData.phone_number,
      role: role !== undefined ? role : oldData.role,
      department: department !== undefined ? department.trim() : oldData.department,
      position: position !== undefined ? position.trim() : oldData.position,
      profile_photo: profile_photo !== undefined ? profile_photo : oldData.profile_photo,
      status: status !== undefined ? status : oldData.status,
    };

    await execute(
      `UPDATE users SET full_name = ?, email = ?, phone_number = ?, role = ?, department = ?, position = ?, profile_photo = ?, status = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        updated.full_name,
        updated.email,
        updated.phone_number,
        updated.role,
        updated.department,
        updated.position,
        updated.profile_photo,
        updated.status,
        id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'អ្នកប្រើប្រាស់',
      tableName: 'users',
      recordId: id,
      oldData: { full_name: oldData.full_name, role: oldData.role, status: oldData.status },
      newData: { full_name: updated.full_name, role: updated.role, status: updated.status },
    });

    return res.json({ success: true, message: 'បានកែប្រែព័ត៌មានអ្នកប្រើប្រាស់ដោយជោគជ័យ', data: { user_id: id, ...updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function toggleUserStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { query, execute } = await getDb();
    const existing = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'រកមិនឃើញអ្នកប្រើប្រាស់នេះទេ' });
    }

    const currentStatus = existing[0].status;
    const newStatus = status || (currentStatus === 'active' ? 'inactive' : 'active');

    await execute('UPDATE users SET status = ?, updated_at = NOW() WHERE user_id = ?', [newStatus, id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE',
      module: 'អ្នកប្រើប្រាស់',
      tableName: 'users',
      recordId: id,
      oldData: { status: currentStatus },
      newData: { status: newStatus },
    });

    return res.json({
      success: true,
      message: newStatus === 'active' ? 'បានបើកដំណើរការគណនីដោយជោគជ័យ' : 'បានផ្អាកដំណើរការគណនីដោយជោគជ័យ',
      data: { user_id: Number(id), status: newStatus },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function resetUserPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦តួអក្សរ' });
    }

    const { execute } = await getDb();
    const password_hash = bcrypt.hashSync(new_password, 10);

    await execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?', [password_hash, id]);

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'RESET_PASSWORD',
      module: 'អ្នកប្រើប្រាស់',
      tableName: 'users',
      recordId: id,
      newData: { reset: true },
    });

    return res.json({ success: true, message: 'បានកំណត់ពាក្យសម្ងាត់ថ្មីដោយជោគជ័យ' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
