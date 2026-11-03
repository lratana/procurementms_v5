import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';
import { createAuditLog } from '../middleware/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cambodian_procurement_gov_secret_token_key_2026';

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'សូមបញ្ចូលឈ្មោះគណនី និងពាក្យសម្ងាត់ (Username and password are required)',
      });
    }

    const { query, execute } = await getDb();
    const rows = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username.trim()]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Invalid username or password)',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'គណនីនេះត្រូវបានផ្អាកដំណើរការ សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ (Account is inactive)',
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Invalid credentials)',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last_login_at in MySQL
    await execute('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    // Device registration in MySQL
    let deviceId: number | null = null;
    try {
      const devRows = await query('SELECT device_id FROM devices WHERE user_id = ? AND ip_address = ? LIMIT 1', [
        user.user_id,
        ipAddress,
      ]);
      if (devRows.length > 0) {
        deviceId = devRows[0].device_id;
        await execute('UPDATE devices SET last_login_at = NOW() WHERE device_id = ?', [deviceId]);
      } else {
        const devResult = await execute(
          `INSERT INTO devices (user_id, device_name, device_type, operating_system, browser, device_identifier, ip_address, user_agent, first_login_at, last_login_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'active')`,
          [
            user.user_id,
            `${user.username}-Device`,
            userAgent.includes('Mobile') ? 'Mobile' : 'Desktop / Laptop',
            userAgent.includes('Windows') ? 'Windows' : userAgent.includes('Mac') ? 'macOS' : 'Linux / Other',
            userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Safari') ? 'Safari' : 'Firefox',
            `DEV-${user.username.toUpperCase()}-${Date.now()}`,
            ipAddress,
            userAgent,
          ]
        );
        deviceId = devResult.insertId || null;
      }

      // Create session in MySQL
      await execute(
        `INSERT INTO user_sessions (user_id, device_id, session_token, ip_address, user_agent, login_at, status)
         VALUES (?, ?, ?, ?, ?, NOW(), 'active')`,
        [user.user_id, deviceId, token, ipAddress, userAgent]
      );
    } catch (dbErr) {
      console.warn('[Auth] Non-fatal device/session recording warning:', dbErr);
    }

    // Audit log
    await createAuditLog({
      userId: user.user_id,
      deviceId,
      action: 'LOGIN',
      module: 'ការចូលប្រើប្រាស់',
      tableName: 'users',
      recordId: user.user_id,
      newData: { username: user.username, ip: ipAddress, role: user.role },
      ipAddress,
    });

    const userSafe = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      department: user.department,
      position: user.position,
      profile_photo: user.profile_photo,
      status: user.status,
      last_login_at: new Date().toISOString(),
    };

    return res.json({
      success: true,
      message: 'ចូលប្រើប្រាស់ប្រព័ន្ធជោគជ័យ',
      data: {
        token,
        user: userSafe,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'មានបញ្ហាបច្ចេកទេសក្នុងការចូលប្រើប្រាស់ (Login failed)',
      errors: [err.message],
    });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (req.user) {
      await createAuditLog({
        userId: req.user.user_id,
        action: 'LOGOUT',
        module: 'ការចាកចេញពីប្រព័ន្ធ',
        tableName: 'user_sessions',
        recordId: req.user.user_id,
        ipAddress,
      });
    }

    return res.json({
      success: true,
      message: 'ចាកចេញពីប្រព័ន្ធដោយជោគជ័យ (Logged out successfully)',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function me(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'សូមចូលប្រើប្រាស់ជាមុនសិន',
    });
  }

  return res.json({
    success: true,
    data: req.user,
  });
}
