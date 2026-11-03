import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

export function authorizeRoles(...allowedRoles: Array<'admin' | 'editor' | 'viewer'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'សូមចូលប្រើប្រាស់ប្រព័ន្ធជាមុនសិន',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'លោកអ្នកគ្មានសិទ្ធិអនុវត្តប្រតិបត្តិការនេះទេ (Forbidden: Insufficient privileges)',
      });
    }

    next();
  };
}

// Convenience guards
export const requireAdmin = authorizeRoles('admin');
export const requireEditorOrAdmin = authorizeRoles('admin', 'editor');
export const requireAnyRole = authorizeRoles('admin', 'editor', 'viewer');
