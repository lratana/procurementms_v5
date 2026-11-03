# Cambodian Public Procurement Management System (ProcurementMS)

> **Production deployment:** See [`PRODUCTION_SETUP.md`](./PRODUCTION_SETUP.md) for the dedicated production checklist covering separate D1/R2 resources, Worker secrets, Netlify, Cloudflare DNS, same-origin `/api/*`, deployment, verification, and rollback.

**Setup & Deployment Guide | មគ្គុទ្ទេសក៍ដំឡើង និងដំណើរការប្រព័ន្ធ**

> This repository contains the React/Vite frontend, the legacy Node.js/Express API, and an initial Cloudflare Workers + D1 + R2 migration foundation. **The Cloudflare Worker is not yet a complete replacement for the Express API.** Read the migration status before deploying it to a live domain.

---

## 1. Project overview | ទិដ្ឋភាពទូទៅ

ProcurementMS is a procurement tracking application for managing project and procurement information, including:

- Dashboard and reports
- Projects and project requests
- Bidding process and bidders
- Contracts
- Handovers and warranties
- Users, roles, devices, sessions and audit logs

### Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| UI / charts | Tailwind CSS, Lucide, Recharts |
| Frontend API client | Axios (`/api` by default) |
| Existing/local backend | Node.js, Express, TypeScript (`tsx`) |
| Existing/local database | MySQL 8+; SQLite fallback is present in the current source |
| Authentication | JWT and bcryptjs in the Express application |
| Serverless API foundation | Cloudflare Workers + Hono |
| Serverless database | Cloudflare D1 (SQLite-compatible) |
| Document storage binding | Cloudflare R2 (binding configured; application upload APIs are not implemented yet) |
| Frontend hosting | Netlify |
| DNS / custom domain | Cloudflare |

## 2. Understand the deployment architecture

The intended production topology is a **single public hostname**:

```text
User's browser
      |
      | https://YOUR_DOMAIN/
      v
Cloudflare DNS / Proxy
      |
      +---- / and frontend assets ----> Netlify (React + Vite)
      |
      +---- /api/* -------------------> Cloudflare Worker (Hono)
                                           |
                                           +---- D1 database (DB)
                                           |
                                           +---- R2 bucket (DOCUMENTS)
```

The frontend uses a relative API URL:

```ts
baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
```

Therefore, the browser calls `https://YOUR_DOMAIN/api/...`. No separate `api.` subdomain is required.

**Important:** A Cloudflare Worker route on `YOUR_DOMAIN/api/*` only handles API requests. The DNS hostname must still be configured to reach the Netlify site for frontend requests. Do not delete or replace Netlify's required DNS records without checking the Netlify domain instructions.

## 3. Requirements

Recommended development environment:

- Node.js **22.13 or newer** (the local SQLite fallback imports `node:sqlite`)
- npm (comes with Node.js)
- Git
- A MySQL 8+ server, if using MySQL locally
- Cloudflare account with an active zone for the custom domain, if deploying the Worker
- Netlify account connected to the GitHub repository, if deploying the frontend

Check versions:

```bash
node --version
npm --version
git --version
```

## 4. Get the project and install dependencies

Clone the Git repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd procurementMS
```

Or extract the ZIP and open the extracted `procurementMS` folder in VS Code.

Install frontend and Express application dependencies:

```bash
npm install
```

For reproducible CI/Netlify installs, commit `package-lock.json` and use:

```bash
npm ci
```

Do not upload `node_modules` to GitHub.

## 5. Run locally with the existing Express backend

This is the current path for testing the **existing application modules**. The root `npm run dev` starts Express and attaches the Vite development middleware.

### 5.1 Configure environment variables

Create `.env` in the repository root. Do not commit this file.

Example for local development with MySQL:

```dotenv
NODE_ENV=development
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=procurement_db
DB_USER=YOUR_MYSQL_USER
DB_PASSWORD=YOUR_MYSQL_PASSWORD

JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=1d

# The browser uses the same-origin API path
VITE_API_BASE_URL=/api
```

Generate a secret instead of reusing an example value:

```bash
openssl rand -hex 32
```

If MySQL is not configured or the connection fails, the current database module attempts to initialize a local `procurement.sqlite` database. This fallback is useful for development only; do not treat it as a production database strategy. Ensure your Node.js version supports `node:sqlite`.

### 5.2 Prepare the database

For MySQL:

1. Start MySQL 8+.
2. Create an empty database named `procurement_db` (or use the name in `.env`).
3. Set a database user and password with appropriate permissions.
4. Review `server/db/schema.sql` before applying any schema.

**Critical database warning:** `server/db/schema.sql` contains `DROP TABLE IF EXISTS` statements for the application's tables. It is destructive and can delete existing records. Never execute it against a database containing real data. Back up the database and prepare a reviewed, non-destructive migration before changing an existing database.

The repository also contains a migration runner (`npm run migrate`). Do not assume it is safe for production: inspect the migration files and runner behavior first, and take a verified backup.

### 5.3 Start the application

```bash
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- API health endpoint: `http://localhost:3000/api/health`

The development server serves the React application through Vite middleware and the API through Express.

### 5.4 Build and run the Express application

```bash
npm run build
npm start
```

The production Express server serves the built `dist/` frontend and API from the same Node.js process. This requires a Node.js hosting environment; **Netlify static hosting does not run this Express server automatically**.

## 6. Frontend build and Netlify deployment

The repository's `netlify.toml` currently specifies:

- Build command: `npm run build`
- Publish directory: `dist`
- `VITE_API_BASE_URL=/api`

### 6.1 Connect GitHub to Netlify

1. Push the project to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the GitHub repository.
4. Set the Base directory to the folder containing the root `package.json` (normally repository root).
5. Set Build command to `npm run build`.
6. Set Publish directory to `dist`.
7. Deploy the site.

If the project is in a monorepo or nested folder, update the Base directory to that exact folder.

### 6.2 Netlify environment variables

In **Site configuration → Environment variables**, set:

```text
VITE_API_BASE_URL=/api
```

This is a build-time frontend variable. Do not put `JWT_SECRET`, MySQL passwords, Cloudflare API tokens, or other private secrets in `VITE_*` variables. Values prefixed with `VITE_` are exposed to the browser bundle.

### 6.3 SPA routing

`public/_redirects` provides the single-page application fallback. Do not add a Netlify redirect that forwards `/api/*` to a guessed Worker URL for this architecture. The Cloudflare Worker route is intended to handle `/api/*` at the edge.

## 7. Cloudflare Worker, D1 and R2 setup

The Worker project is inside `worker/`.

### 7.1 Install Worker dependencies

```bash
cd worker
npm install
```

Log in:

```bash
npx wrangler login
```

### 7.2 Create D1 database

Create the database:

```bash
npx wrangler d1 create procurement-db
```

Wrangler returns a `database_id`. Copy it into `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "procurement-db",
    "database_id": "PASTE_THE_REAL_DATABASE_ID_HERE"
  }
]
```

Keep the binding name `DB`, because the Worker code reads `c.env.DB`.

### 7.3 Create R2 bucket

```bash
npx wrangler r2 bucket create procurement-documents
```

The Worker config binds it as `DOCUMENTS`. The binding is configured, but document upload/download API routes are not implemented in this migration foundation yet.

### 7.4 Apply the D1 schema

From the `worker/` directory, apply the schema to a **new, empty** D1 database:

```bash
npx wrangler d1 execute procurement-db --remote --file=../cloudflare/schema.sql
```

For local Worker development:

```bash
npx wrangler d1 execute procurement-db --local --file=../cloudflare/schema.sql
```

Review `cloudflare/schema.sql` first. Do not run schema changes against a database with production data unless the change is a reviewed, non-destructive migration and a backup/restore plan exists.

**The D1 schema is not a MySQL data migration.** Existing MySQL records, user password hashes, sessions, and documents have not been transferred by this setup.

### 7.5 Set Worker secrets

Create a unique secret:

```bash
openssl rand -hex 32
```

From `worker/`, set it in Cloudflare:

```bash
npx wrangler secret put JWT_SECRET
```

Paste the generated value when prompted. Never commit the value to GitHub or place it in frontend environment variables.

For local Worker development, create `worker/.dev.vars`:

```dotenv
JWT_SECRET=YOUR_LOCAL_DEVELOPMENT_SECRET
```

Keep `.dev.vars` private and out of Git.

### 7.6 Configure the custom domain route

Edit `worker/wrangler.jsonc`. Replace the placeholders with the exact hostname used by the Netlify site.

Example if the site is `procurement.example.com` and the Cloudflare zone is `example.com`:

```jsonc
"vars": {
  "APP_ENV": "production",
  "CORS_ORIGIN": "https://procurement.example.com"
},
"routes": [
  {
    "pattern": "procurement.example.com/api/*",
    "zone_name": "example.com"
  }
]
```

For an apex domain such as `example.com`, use that exact hostname for both `pattern` and `zone_name`.

Ensure:

1. The domain is added and active in the Cloudflare account.
2. The hostname has the DNS record/origin configuration required by Netlify.
3. The DNS record is proxied through Cloudflare where required for the Worker route.
4. Netlify still recognizes and validates the custom domain.
5. SSL/TLS settings are compatible with the Netlify origin.

Do not blindly replace DNS records. Follow the current Netlify custom-domain instructions for the correct origin target and preserve those records.

### 7.7 Run and deploy the Worker

From `worker/`:

```bash
# Local Worker development
npm run dev

# Type check
npm run typecheck

# Deploy
npm run deploy
```

After deployment, test the Worker health endpoint:

```bash
curl https://YOUR_DOMAIN/api/health
```

A successful response should indicate that the Worker is running and can query D1. If testing on `workers.dev` first, use the URL shown by Wrangler.

## 8. Current Cloudflare migration status — read before production

This repository is a **migration foundation, not a complete serverless conversion**.

| Feature / API | Current status in Worker |
|---|---|
| `GET /api/health` | Implemented; checks D1 |
| `GET /api/auth/me` | Implemented behind authentication middleware |
| `POST /api/auth/logout` | Implemented to revoke a matching active session |
| `POST /api/auth/login` | **Not implemented**; returns HTTP 501 |
| Projects list/detail/create/update/delete | Initial D1 CRUD slice implemented |
| Dashboard endpoints | Not ported; HTTP 501 |
| Project requests | Not ported; HTTP 501 |
| Bidding and bidders | Not ported; HTTP 501 |
| Contracts, handovers, warranties | Not ported; HTTP 501 |
| Users, devices, sessions, audit logs | Not ported; HTTP 501 |
| Reports | Not ported; HTTP 501 |
| R2 document upload/download | Binding configured; API not implemented |
| MySQL-to-D1 data migration | Not implemented |

**Do not attach the Worker route to the live production hostname or switch the frontend to it as the only backend until every required endpoint, login, role checks, session handling, reports, document permissions, and data migration have been completed and tested.** Otherwise, existing screens will receive HTTP 501 errors or fail to log in.

## 9. Recommended safe migration and release sequence

Use separate development/staging resources before production.

1. **Back up the current database** and verify that the backup can be restored.
2. Confirm which database is the source of truth: MySQL or SQLite. Do not run both as competing production databases.
3. Finalize the data model and migration scripts for D1. Review financial columns carefully; SQLite `REAL` is not ideal for exact financial values.
4. Port and test authentication: password verification compatible with existing hashes, token signing, active-session validation, logout/revocation, and role-based authorization.
5. Port each API module and preserve the frontend's existing request/response contracts.
6. Implement R2 upload/download with authorization checks and safe object keys.
7. Migrate records from the source database to D1. Reconcile row counts, IDs, relationships, dates, statuses, and financial totals.
8. Deploy a staging Worker and staging D1/R2 resources.
9. Deploy a Netlify preview connected to the staging API.
10. Test every user role and workflow: login/logout, dashboard, projects, requests, bidding, bidders, contracts, handovers, warranties, users, devices, audit logs, reports, and documents.
11. Only after acceptance, schedule production cutover and attach the Worker route.
12. Keep a rollback plan and a verified backup. Do not allow old and new systems to write independently to different databases during cutover.

## 10. Useful commands

| Purpose | Command | Run from |
|---|---|---|
| Install app dependencies | `npm install` | Project root |
| Start Express + Vite | `npm run dev` | Project root |
| Build frontend | `npm run build` | Project root |
| TypeScript check (root) | `npm run lint` | Project root |
| Start Express production server | `npm start` | Project root |
| Install Worker dependencies | `npm install` | `worker/` |
| Start local Worker | `npm run dev` | `worker/` |
| Type-check Worker | `npm run typecheck` | `worker/` |
| Deploy Worker | `npm run deploy` | `worker/` |

## 11. Troubleshooting

### `ER_ACCESS_DENIED_ERROR` from MySQL

- Confirm MySQL is running.
- Check `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in the root `.env`.
- Test the same username/password using the MySQL client.
- Confirm that the database user has permissions on the selected database.
- Do not solve this by publishing database credentials or using a privileged root account in production.

### `node:sqlite` cannot be found

- Use a supported Node.js release (recommended Node.js 22.13+).
- Check `node --version`.
- Reinstall dependencies only after confirming the Node.js runtime is correct.

### Frontend loads but API returns 404 or 501

- `404` usually means the request is not reaching a matching API route.
- `501` is expected for Worker endpoints that have not yet been ported.
- Check the browser Network tab and inspect the exact `/api/...` request.
- Confirm whether the frontend is talking to the Express backend or the incomplete Cloudflare Worker.

### Worker reports D1 binding/database errors

- Confirm the `database_id` in `worker/wrangler.jsonc`.
- Confirm the binding is named `DB`.
- Confirm the D1 schema was applied to the correct local/remote database.
- Run Wrangler commands from the `worker/` directory.

### Custom domain does not route `/api/*` to Worker

- Confirm the route pattern matches the exact hostname.
- Confirm `zone_name` is the Cloudflare zone apex, not necessarily the subdomain.
- Confirm the DNS record is proxied and the hostname remains configured correctly at Netlify.
- Check Worker deployment logs and test `/api/health`.

## 12. Security checklist

- [ ] `.env`, `.dev.vars`, database files, backups and real records are excluded from Git.
- [ ] All credentials and JWT secrets are unique, strong, and rotated if exposed.
- [ ] No secrets are stored in `VITE_*` variables.
- [ ] Production database is backed up and restore-tested.
- [ ] Destructive schema files are never run against production.
- [ ] Worker endpoints enforce authentication and role authorization.
- [ ] Session revocation is enforced by protected endpoints.
- [ ] R2 documents are private and access-controlled.
- [ ] Error responses do not expose stack traces or secrets.
- [ ] Production deployment is tested in staging before cutover.

---

## 13. Repository structure

```text
procurementMS/
├── src/                      # React frontend
│   ├── components/           # Shared UI components
│   ├── context/              # Authentication context
│   ├── pages/                # Dashboard and procurement modules
│   ├── services/api.ts       # Axios API client (/api)
│   └── utils/                # Formatters and helpers
├── public/
│   └── _redirects            # Netlify SPA fallback
├── server.ts                 # Existing Express + Vite server
├── server/
│   ├── config/               # Existing database connection
│   ├── controllers/          # Existing Express API controllers
│   ├── db/                   # Schema, seed and migration runner
│   ├── middleware/           # Auth, role, audit, error handling
│   └── routes/               # Express API routes
├── cloudflare/
│   └── schema.sql            # Initial D1 schema
├── worker/
│   ├── src/index.ts          # Hono Worker API foundation
│   ├── wrangler.jsonc        # D1, R2, route and Worker config
│   └── package.json
├── netlify.toml              # Netlify build configuration
├── package.json
└── README.md                 # This guide
```

## 14. Important note

The setup instructions describe the source code as it exists in this repository. They do not certify the application as production-ready. Complete the missing Worker modules, security review, database migration, backup/restore testing, and user acceptance testing before using the Cloudflare serverless path for official procurement records.
