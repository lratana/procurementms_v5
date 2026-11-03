# ProcurementMS — Production Deployment Guide

ភាសា៖ Khmer / English  
គោលដៅ៖ Deploy Frontend ទៅ Netlify និង API ទៅ Cloudflare Workers ដោយប្រើ Domain តែមួយ។

> **Production warning:** Repository នេះនៅជាមូលដ្ឋាន migration ទៅ Cloudflare Workers ប៉ុណ្ណោះ។ Worker បច្ចុប្បន្នមិនទាន់មាន Login និង API គ្រប់ Module ទេ។ Login និង endpoints មួយចំនួនត្រឡប់ HTTP `501`។ កុំប្រើ Worker ជា Backend Production សម្រាប់ទិន្នន័យលទ្ធកម្មពិត រហូតដល់បំពេញចំណុចក្នុងផ្នែក Production Readiness Gate ខាងក្រោម។

---

## 1. Production architecture

```text
Browser
  |
  | https://YOUR_DOMAIN.com/
  v
Cloudflare DNS / Proxy
  |
  +-- /, assets, React routes --> Netlify (React + Vite)
  |
  +-- /api/* ------------------> Cloudflare Worker (Hono)
                                   |
                                   +--> D1 (procurement-db)
                                   |
                                   +--> R2 (procurement-documents)
```

Frontend configuration:

```dotenv
VITE_API_BASE_URL=/api
```

Axios client uses this base URL. Call endpoints as `api.get('/projects')`, not `api.get('/api/projects')`, otherwise the request path may become `/api/api/projects`.

## 2. Environments and isolation

The project has two Wrangler environments:

| Resource | Development | Production |
|---|---|---|
| Worker | `procurementms-api` | `procurementms-api-production` |
| D1 | `procurement-db-dev` | `procurement-db` |
| R2 | `procurement-documents-dev` | `procurement-documents` |
| CORS origin | `http://localhost:5173` | `https://YOUR_DOMAIN.com` |
| Custom route | None | `YOUR_DOMAIN.com/api/*` |

Never point development or preview deployments at production D1/R2. Do not copy real procurement records into development unless the data has been approved and sanitized.

## 3. Prerequisites

- Cloudflare account; the domain must be active in the Cloudflare zone.
- Netlify account and GitHub repository access.
- Node.js version compatible with the root project and Worker dependencies.
- npm and Git.
- Access to configure DNS, Worker routes, D1, R2, and Netlify environment variables.

Check:

```bash
node --version
npm --version
git --version
```

## 4. Prepare the repository

1. Extract the project or clone the private GitHub repository.
2. Confirm the repository root contains `package.json`, `netlify.toml`, `src/`, `worker/`, and `cloudflare/`.
3. Ensure real `.env`, `.dev.vars`, database files, backups, and uploaded documents are not committed.
4. Install root dependencies:

```bash
npm ci
```

5. Install Worker dependencies:

```bash
cd worker
npm ci
npx wrangler login
```

Do not commit `.env`, `.dev.vars`, API tokens, JWT secrets, database credentials, or production data.

## 5. Create isolated Cloudflare resources

Run commands from the `worker/` directory.

### 5.1 Create Development D1

```bash
npx wrangler d1 create procurement-db-dev
```

Copy the returned `database_id` into the default `d1_databases` entry in `worker/wrangler.jsonc` (the entry outside `env.production`).

### 5.2 Create Production D1

```bash
npx wrangler d1 create procurement-db
```

Copy the returned `database_id` into `env.production.d1_databases[0].database_id`.

### 5.3 Create R2 buckets

```bash
npx wrangler r2 bucket create procurement-documents-dev
npx wrangler r2 bucket create procurement-documents
```

The development and production R2 buckets must remain separate. The Worker currently has an R2 binding, but application upload/download routes and document authorization still need implementation.

## 6. Configure `worker/wrangler.jsonc`

Replace the UUID-shaped placeholder IDs with the actual IDs returned by Cloudflare.

In `env.production` replace:

- `YOUR_DOMAIN.com` in `CORS_ORIGIN`
- `YOUR_DOMAIN.com` in `routes[0].pattern`
- `YOUR_DOMAIN.com` in `routes[0].zone_name` with the Cloudflare zone name

Example: if the app URL is `https://procurement.example.com`, set:

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

`pattern` is the hostname plus `/api/*`. `zone_name` is the Cloudflare zone apex. For an apex app URL `https://example.com`, both values use `example.com` (with `/api/*` on the pattern).

The default environment intentionally has no production custom-domain route. Use `--env production` for production operations.

## 7. Apply the D1 schema safely

First inspect `cloudflare/schema.sql`. It is an initial schema for a **new, empty D1 database**, not a versioned data migration from MySQL/SQLite.

Development database:

```bash
npx wrangler d1 execute procurement-db-dev --local --file=../cloudflare/schema.sql
```

Production database (only after backup/approval and only when it is a new empty database):

```bash
npx wrangler d1 execute procurement-db --remote --env production --file=../cloudflare/schema.sql
```

Important:

- Do not run the initial schema repeatedly as a substitute for migrations.
- Do not apply it to a database containing important records without a reviewed migration plan.
- Existing MySQL/SQLite records, password hashes, sessions, audit logs, and documents are not migrated automatically.
- Money columns in the current D1 schema use SQLite `REAL`; review and change financial storage to an exact representation (for example, integer minor units or validated decimal strings) before production financial transactions.
- Back up and verify restore before any schema/data change.

## 8. Configure Worker secrets

Generate a strong, unique secret on a trusted machine:

```bash
openssl rand -hex 32
```

Set the Development secret:

```bash
npx wrangler secret put JWT_SECRET
```

Set the Production secret:

```bash
npx wrangler secret put JWT_SECRET --env production
```

Wrangler prompts for the value. Use a different secret for each environment. Do not put it in `vars`, `wrangler.jsonc`, GitHub source, Netlify variables, or any `VITE_*` variable.

For local Worker development, create `worker/.dev.vars` (do not commit it):

```dotenv
JWT_SECRET=YOUR_LOCAL_ONLY_SECRET
```

The `.dev.vars.example` file is only a template; copy it to `.dev.vars` and replace the example value.

## 9. Deploy Worker to staging first

Before attaching the production route, deploy a staging Worker using separate staging resources and a staging hostname/route. This repository currently defines development and production environments; it does not yet define a separate staging environment. For a safe release, add a dedicated `staging` environment with its own D1, R2, secret, and hostname before using a preview site.

For local Worker testing:

```bash
npm run dev
```

For type checking:

```bash
npm run typecheck
```

For production deployment after the readiness gate has passed:

```bash
npm run deploy:production
```

This command runs `wrangler deploy --env production`.

## 10. Netlify production setup

Deploy the React frontend separately.

1. Push the reviewed source to GitHub.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the repository.
4. Set the Base directory to the folder containing the root `package.json`.
5. Build command: `npm run build`.
6. Publish directory: `dist`.
7. Add this environment variable in Netlify:

```dotenv
VITE_API_BASE_URL=/api
```

8. Trigger a new deploy after changing the variable.

`VITE_*` values are embedded in the browser bundle. Only public frontend configuration belongs there. Never add `JWT_SECRET`, database passwords, Cloudflare API tokens, or private API keys.

The repository's `netlify.toml` already configures the build command, publish directory, and `/api` variable. The root `public/_redirects` provides SPA fallback behavior. Do not add a Netlify `/api/*` proxy redirect to a guessed Worker URL when using the Cloudflare same-host Worker route.

## 11. Cloudflare DNS and same-origin routing

The intended public URL is one hostname:

- Frontend: `https://YOUR_DOMAIN.com/`
- API: `https://YOUR_DOMAIN.com/api/*`

The hostname must remain configured as a custom domain in Netlify. Cloudflare DNS must use the current DNS target/instructions supplied by Netlify, and the Worker route must be attached to the same Cloudflare zone.

Checklist:

- [ ] Domain is active in Cloudflare.
- [ ] Custom domain is verified in Netlify.
- [ ] Netlify-required DNS record(s) are present.
- [ ] DNS proxy status is compatible with the Cloudflare Worker route.
- [ ] Worker route is exactly `YOUR_DOMAIN.com/api/*`.
- [ ] `zone_name` is the Cloudflare zone apex.
- [ ] SSL/TLS is configured correctly for the Netlify origin.
- [ ] No conflicting Netlify redirect or other Worker route captures `/api/*`.

Do not delete or overwrite DNS records by guesswork. Follow the exact current Netlify custom-domain target. If using a subdomain, preserve the correct zone apex in `zone_name`.

## 12. Production verification

After deployment, verify the frontend:

```text
https://YOUR_DOMAIN.com/
```

Check the Worker health route:

```bash
curl -i https://YOUR_DOMAIN.com/api/health
```

The health response should be JSON and report that the D1 query succeeded. This only proves the Worker can reach D1; it does **not** prove that login or all business modules work.

Use browser Developer Tools → Network to confirm frontend requests go to `/api/...` and not to a duplicated `/api/api/...` path.

Do not test protected business functions using production records until the readiness gate has passed.

## 13. Production Readiness Gate — mandatory

The current Worker source explicitly reports incomplete migration. The following work remains before it can become the only production backend:

- [ ] Implement login and test password verification against existing password hashes.
- [ ] Implement secure token issuance, expiry, session creation, revocation, and active-session checks.
- [ ] Port every API endpoint used by the current React frontend.
- [ ] Preserve and test request/response formats expected by the frontend.
- [ ] Complete role-based access control for every protected operation.
- [ ] Port dashboard, project requests, bidding, bidders, contracts, handovers, warranties, users, devices, sessions, audit logs, and reports.
- [ ] Implement R2 upload/download, file type/size validation, private access, and authorization.
- [ ] Review CORS, rate limiting, input validation, error handling, logging, and security headers.
- [ ] Design versioned, non-destructive D1 migrations.
- [ ] Migrate existing source records and reconcile counts, IDs, relations, dates, statuses, and financial totals.
- [ ] Replace or redesign `REAL` financial fields for exact monetary calculations.
- [ ] Test all roles and the complete procurement lifecycle in staging.
- [ ] Perform backup and restore testing.
- [ ] Prepare rollback and cutover procedures.
- [ ] Obtain business/user acceptance before switching the production `/api/*` route.

**Do not cut over while any required endpoint returns HTTP 501.** The current `POST /api/auth/login` returns 501, and many module endpoints are intentionally marked as not ported.

## 14. Release and rollback procedure

Recommended release order:

1. Back up the existing production database and documents.
2. Deploy the completed Worker to a staging environment with isolated resources.
3. Deploy a Netlify preview using the staging API.
4. Test authentication, permissions, all modules, reports, uploads/downloads, and financial totals.
5. Freeze writes to the old system during the planned final data migration.
6. Run the approved migration and reconcile data.
7. Deploy the Worker with production bindings and route.
8. Run smoke tests immediately.
9. Keep the previous backend and verified backups available for rollback.
10. If critical tests fail, restore the previous routing/backend according to the approved rollback plan. Avoid allowing both systems to write independently during rollback.

## 15. Useful commands

Run root commands from the repository root and Worker commands from `worker/`.

```bash
# Root: install frontend/Express dependencies
npm ci

# Root: build frontend
npm run build

# Worker: install dependencies
cd worker
npm ci

# Worker: authenticate to Cloudflare
npx wrangler login

# Worker: local development
npm run dev

# Worker: type-check
npm run typecheck

# Worker: deploy production environment
npm run deploy:production

# Worker: inspect deployment
npx wrangler deployments list --env production
```

## 16. Common issues

### `404` from `/api/...`
Check the exact Worker route pattern, Cloudflare zone, DNS proxy configuration, and whether the Worker is deployed to the `production` environment.

### `501 Not Implemented`
The endpoint has not yet been ported to the Worker. This is an application migration gap, not a DNS issue.

### D1 binding error
Check that the production D1 ID is correct and that `binding` remains `DB` in the production environment.

### R2 binding error
Check that the production bucket exists and that the production binding is named `DOCUMENTS`.

### Login fails
The Worker login endpoint is intentionally not implemented yet and returns 501. Do not route production users to this Worker until login migration is complete.

### Frontend calls `/api/api/...`
Use `VITE_API_BASE_URL=/api` and call `api.get('/projects')`, not `api.get('/api/projects')`.

### Netlify frontend works but API does not
Check Cloudflare route, DNS proxy, Worker deployment environment, and `/api/health`. Confirm that Netlify does not have a conflicting API redirect.

---

**Release status:** This guide prepares the deployment configuration and documents the production process. It does not certify the current Worker as a complete production backend. Complete every mandatory readiness item before processing official procurement data.
