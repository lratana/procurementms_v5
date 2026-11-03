import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';

export interface AuthUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'editor' | 'viewer';
  department: string | null;
  position: string | null;
  profile_photo: string | null;
  status: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  deviceId?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'cambodian_procurement_gov_secret_token_key_2026';

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'សូមចូលប្រើប្រាស់ប្រព័ន្ធជាមុនសិន (Authentication required)',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { user_id: number; username: string };
    const { query } = await getDb();
    const rows = await query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [decoded.user_id]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'គណនីអ្នកប្រើប្រាស់មិនត្រូវបានរកឃើញទេ (User not found)',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'គណនីនេះត្រូវបានផ្អាកដំណើរការ (Account is deactivated)',
      });
    }

    req.user = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
      position: user.position,
      profile_photo: user.profile_photo,
      status: user.status,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: 'សុពលភាពនៃកូដចូលប្រើប្រាស់បានផុតកំណត់ (Invalid or expired token)',
    });
  }
}
