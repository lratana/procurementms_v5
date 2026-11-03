# ProcurementMS — Automatic Deployment Setup (Netlify + Cloudflare)

## Architecture

- Frontend: Netlify (`https://procurement-ms-moh.netlify.app`)
- Backend: Cloudflare Worker (`procurementms-api`)
- Database: Cloudflare D1 (`DB` binding)
- Documents: Cloudflare R2 (`DOCUMENTS` binding)
- API connection: Netlify proxy `/api/*` -> Worker `workers.dev`

## Important corrections made

1. Production D1 binding is now `DB`, matching `worker/src/index.ts`.
2. Production Worker name is `procurementms-api`.
3. `workers_dev` is enabled; no custom-domain `routes` are configured.
4. Netlify `_redirects` includes the API proxy first and SPA fallback second.
5. Vite config uses an ESM-safe `__dirname` implementation.
6. Added GitHub Actions workflow to typecheck and deploy the Worker automatically on pushes to `main` that touch `worker/`, `cloudflare/`, or the workflow itself.
7. Removed `.git`, `node_modules`, macOS metadata, and local runtime state from this deployment ZIP.

## A. Use Node.js 22 LTS

Use Node.js 22 (22.12+ recommended for this Vite toolchain). In the terminal:

```bash
node -v
```

If you use nvm:

```bash
nvm install 22
nvm use 22
```

## B. Install the project dependencies

At the repository root:

```bash
npm ci
```

Then install Worker dependencies:

```bash
cd worker
npm ci --include=optional
npx wrangler --version
```

`--include=optional` is important because `workerd` installs a platform-specific optional binary, such as `@cloudflare/workerd-darwin-arm64` on Apple Silicon Macs.

The uploaded ZIP's Worker lockfile references `@cloudflare/workers-types` `5.20261103.1`. The earlier ETARGET error referred to `^4.20261101.0`, which is not the dependency declaration in this uploaded ZIP. Make sure your terminal is running inside this extracted project's `worker/` folder and not an older copy.

## C. Authenticate and create Cloudflare resources (one-time)

From `worker/`:

```bash
npx wrangler login
npx wrangler whoami

npx wrangler d1 create procurement-db-dev
npx wrangler d1 create procurement-db

npx wrangler r2 bucket create procurement-documents-dev
npx wrangler r2 bucket create procurement-documents
```

Copy the two actual `database_id` values returned by Cloudflare into `worker/wrangler.jsonc`:

- Development ID -> `d1_databases[0].database_id`
- Production ID -> `env.production.d1_databases[0].database_id`

The two zero-shaped IDs in the supplied file are deliberate placeholders. Replace them before deployment. Do not invent IDs.

Apply the initial schema only to the newly created, empty databases:

```bash
npx wrangler d1 execute procurement-db-dev --local --file=../cloudflare/schema.sql
npx wrangler d1 execute procurement-db --remote --file=../cloudflare/schema.sql
```

Do not run this initial schema against a database containing records without reviewing the schema and preparing a backup/migration plan.

Set a production JWT secret:

```bash
openssl rand -hex 32
npx wrangler secret put JWT_SECRET --env production
```

Paste the generated secret at the prompt. Do not commit it or put it in Netlify environment variables.

## D. First manual Worker deployment

After the D1 IDs, D1 schema, and R2 buckets are ready:

```bash
npm run typecheck
npx wrangler deploy --env production
```

The Worker should be deployed with the name `procurementms-api`. Wrangler prints its actual `workers.dev` URL, typically:

```text
https://procurementms-api.<your-account-subdomain>.workers.dev
```

Copy the actual URL. The Cloudflare account subdomain cannot be guessed from the Netlify site URL.

## E. Finish Netlify proxy

Open `public/_redirects` and replace:

```text
https://procurementms-api.YOUR_CLOUDFLARE_SUBDOMAIN.workers.dev
```

with the exact `workers.dev` URL printed by Wrangler. Keep `/api/:splat` at the end.

The final file should look like:

```text
/api/*  https://procurementms-api.ACTUAL_SUBDOMAIN.workers.dev/api/:splat  200
/*      /index.html  200
```

Do not use `https://procurement-ms-moh.netlify.app` as the proxy target; that is the frontend and would create a proxy loop.

## F. Netlify automatic frontend deployment

1. Push this repository to GitHub.
2. In Netlify, select **Add new site -> Import an existing project**.
3. Choose the GitHub repository.
4. Base directory: repository root (the folder containing the root `package.json`).
5. Build command: `npm run build`.
6. Publish directory: `dist`.
7. Add environment variable `VITE_API_BASE_URL=/api`.
8. Deploy.

After the initial link, Netlify automatically builds and deploys frontend changes pushed to the connected branch. Changes to `public/_redirects` also trigger a new frontend deploy.

The repository's `netlify.toml` already defines the build command, publish directory, and `VITE_API_BASE_URL`.

## G. Cloudflare automatic Worker deployment from GitHub

In GitHub repository settings, add these Actions repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Create a Cloudflare API token with the minimum permissions needed to deploy Workers and access the configured D1/R2 resources. Keep the token private. Never put it in source files, Netlify variables, or the `VITE_` namespace.

The workflow `.github/workflows/deploy-worker.yml` runs on pushes to `main` that change `worker/**`, `cloudflare/**`, or the workflow file. It:

1. Uses Node.js 22.
2. Installs dependencies with optional platform packages.
3. Runs Worker TypeScript checks.
4. Deploys `--env production`.

It can also be started manually from GitHub **Actions -> Deploy ProcurementMS Worker -> Run workflow**.

The first production deployment should be completed manually after provisioning D1/R2 and setting the secret. After that, the GitHub workflow handles Worker code deployments.

## H. Test

Worker health:

```bash
curl -i https://procurementms-api.ACTUAL_SUBDOMAIN.workers.dev/api/health
```

Netlify proxy after deploying `_redirects`:

```bash
curl -i https://procurement-ms-moh.netlify.app/api/health
```

The response should be JSON and report `database: "connected"`.

## Important: current application is not yet production-complete

The Worker code in this ZIP is a migration foundation:

- `/api/health` is implemented.
- Projects CRUD is partially implemented.
- `/api/auth/login` currently returns HTTP 501.
- Dashboard, project requests, bidding, bidders, contracts, handovers, warranties, users, devices, sessions, audit logs, and reports include placeholder 501 responses.
- R2 binding exists, but protected document upload/download endpoints are not implemented.
- Existing MySQL data has not been migrated to D1.
- Financial columns in the current D1 schema use SQLite `REAL`; exact money representation should be reviewed before financial production use.

Therefore, automatic deployment means automatic publishing of the current Worker code, not that every procurement module is ready for real production use. Complete and test authentication, RBAC, all API modules, data migration, document access control, backups, and financial precision before switching the live system.
