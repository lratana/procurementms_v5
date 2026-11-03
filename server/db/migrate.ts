import path from 'path';
import dotenv from 'dotenv';
import { runMigrations, getDb } from '../config/database.js';

dotenv.config();

async function main() {
  const migrationsDir = path.resolve(process.cwd(), 'database/migrations');
  console.log('====================================================');
  console.log(' Running Database Migrations');
  console.log(` Directory: ${migrationsDir}`);
  console.log('====================================================');

  try {
    const result = await runMigrations(migrationsDir);
    const { pool, isUsingMysql } = await getDb();

    console.log('----------------------------------------------------');
    console.log(` Applied (${result.applied.length}): ${result.applied.length ? result.applied.join(', ') : 'none'}`);
    console.log(` Skipped (${result.skipped.length}): ${result.skipped.length ? result.skipped.join(', ') : 'none'}`);
    console.log('----------------------------------------------------');
    console.log('[Migrations] All migrations completed successfully.');

    if (isUsingMysql) {
      await pool.end();
    }
    process.exit(0);
  } catch (err: any) {
    console.error('[Migrations] Migration run failed:', err.message || err);
    process.exit(1);
  }
}

main();
