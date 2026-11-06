#!/usr/bin/env node
/**
 * Helper utility to generate an idempotent SQL INSERT statement for an initial
 * Production administrator account without seeding sample test data.
 *
 * Usage:
 *   node worker/scripts/generate-admin-sql.mjs "<StrongPasswordHere>" [username] [email]
 */
import bcrypt from 'bcryptjs';

const password = process.argv[2];
const username = process.argv[3] || 'admin';
const email = process.argv[4] || 'admin@procurement.gov.kh';

if (!password || password.length < 10) {
  console.error('Usage: node worker/scripts/generate-admin-sql.mjs "<StrongPasswordMin10Chars>" [username] [email]');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const escapeSql = (val) => String(val).replace(/'/g, "''");

const sql = `INSERT OR IGNORE INTO users (username, password_hash, full_name, email, role, department, position, status, created_at, updated_at)
VALUES ('${escapeSql(username)}', '${escapeSql(hash)}', 'System Administrator', '${escapeSql(email)}', 'admin', 'នាយកដ្ឋានលទ្ធកម្មសាធារណៈ', 'ប្រធាននាយកដ្ឋាន', 'active', datetime('now'), datetime('now'));`;

console.log('-- Execute against procurement-db (Production) via:');
console.log(`-- npx --prefix worker wrangler d1 execute procurement-db --remote --env production --command="${sql.replace(/\n/g, ' ')}"\n`);
console.log(sql);
