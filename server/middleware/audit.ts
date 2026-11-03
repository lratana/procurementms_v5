import { getDb } from '../config/database.js';

export interface AuditLogPayload {
  userId?: number | null;
  deviceId?: number | null;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'RESET_PASSWORD' | 'ACTIVATE' | 'DEACTIVATE';
  module: string;
  tableName: string;
  recordId?: string | number | null;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
}

export async function createAuditLog(entry: AuditLogPayload) {
  try {
    const { execute } = await getDb();
    const oldJson = entry.oldData ? JSON.stringify(entry.oldData) : null;
    const newJson = entry.newData ? JSON.stringify(entry.newData) : null;

    await execute(
      `INSERT INTO audit_logs (user_id, device_id, action, module, table_name, record_id, old_data, new_data, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        entry.userId || null,
        entry.deviceId || null,
        entry.action,
        entry.module,
        entry.tableName,
        entry.recordId ? String(entry.recordId) : null,
        oldJson,
        newJson,
        entry.ipAddress || '127.0.0.1',
      ]
    );
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log in MySQL:', err);
  }
}
