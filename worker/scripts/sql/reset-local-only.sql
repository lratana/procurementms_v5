-- =============================================================================
-- LOCAL D1 DATABASE RESET SCRIPT (LOCAL DEVELOPMENT ONLY)
-- WARNING: NEVER EXECUTE THIS SCRIPT WITH --remote OR AGAINST PRODUCTION
-- =============================================================================

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS warranties;
DROP TABLE IF EXISTS handovers;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS bidding_process;
DROP TABLE IF EXISTS bidders;
DROP TABLE IF EXISTS project_requests;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS d1_migrations;

PRAGMA foreign_keys = ON;
