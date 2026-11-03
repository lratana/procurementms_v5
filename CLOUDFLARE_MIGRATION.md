# ProcurementMS: Netlify + Cloudflare same-domain deployment

This is a staged migration foundation, not a production-complete conversion.

## Target topology

- `https://YOUR_DOMAIN.com/` -> Netlify (React + Vite static frontend)
- `https://YOUR_DOMAIN.com/api/*` -> Cloudflare Worker (Hono API)
- Worker bindings: D1 (`DB`) and R2 (`DOCUMENTS`)
- Cloudflare manages DNS and TLS. The custom domain's DNS must be active in the Cloudflare zone and proxied for the Worker route.

No separate `api.` subdomain is used. The browser calls the relative `/api` path, so no cross-origin API URL or browser CORS exception is needed for the normal same-origin flow.

## 1. Netlify site

Connect the existing GitHub repository to Netlify.

- Base directory: repository root (the directory containing `package.json`)
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_BASE_URL=/api`

`netlify.toml` in this package supplies the build command, publish directory and variable. `public/_redirects` provides SPA fallback routing. Do not add a Netlify redirect for `/api/*`; the Cloudflare Worker route owns that path.

Add the custom domain to the Netlify site as usual. Keep the domain's authoritative DNS in Cloudflare.

## 2. Cloudflare DNS and Worker route

In `worker/wrangler.jsonc`, replace both occurrences of `YOUR_DOMAIN.com` with the exact custom domain, for example `procurement.example.com` if that is the hostname used by the Netlify site.

The `routes` entry must be:
```jsonc
"routes": [
  { "pattern": "YOUR_DOMAIN.com/api/*", "zone_name": "YOUR_DOMAIN.com" }
]
```
For a subdomain such as `pms.example.com`, set `pattern` to `pms.example.com/api/*` and `zone_name` to `example.com` (the Cloudflare zone apex).

Ensure the hostname is present in Cloudflare DNS and is proxied (orange cloud) so the Worker route can run. Preserve the Netlify origin target/records that Netlify requires. Verify SSL/TLS mode and Netlify custom-domain validation after changing DNS; do not replace existing records blindly.

## 3. Create Cloudflare resources

From `worker/`:
```bash
npm install
npx wrangler login
npx wrangler d1 create procurement-db
npx wrangler r2 bucket create procurement-documents
```
Copy the D1 `database_id` returned by Wrangler into `d1_databases[0].database_id` in `worker/wrangler.jsonc`.

Apply the schema only to a new/empty D1 database after reviewing it:
```bash
npx wrangler d1 execute procurement-db --remote --file=../cloudflare/schema.sql
```
For local development:
```bash
npx wrangler d1 execute procurement-db --local --file=../cloudflare/schema.sql
```

## 4. Worker secrets and deployment

Generate a fresh secret:
```bash
openssl rand -hex 32
```
Set it without committing it:
```bash
npx wrangler secret put JWT_SECRET
```
Deploy:
```bash
npx wrangler deploy
```
The Worker will be routed on the same hostname at `/api/*`. Test:
```bash
curl https://YOUR_DOMAIN.com/api/health
```

## 5. Frontend API configuration

The React Axios client uses `VITE_API_BASE_URL || '/api'`. Netlify is configured with `/api`, so browser requests stay same-origin:
```ts
baseURL: import.meta.env.VITE_API_BASE_URL || '/api'
```
Do not set a `workers.dev` URL in Netlify for this same-domain design.

## 6. Current migration status — do not switch production yet

- Frontend source is retained.
- Worker health endpoint is implemented.
- A first Projects CRUD slice is ported to D1.
- Login/password verification and token issuance are not ported; login returns HTTP 501.
- Other legacy endpoints are explicitly marked 501 until ported.
- R2 upload/download endpoints are not implemented yet.
- Existing MySQL data has not been migrated to D1.
- Worker route should not be attached to the live domain until all required APIs, authentication, authorization, reports, files and data migration have passed testing.

## 7. Safe cutover sequence

1. Deploy Worker to its temporary `workers.dev` URL for testing first (temporarily remove/disable the custom route while testing).
2. Complete all API and auth ports, R2 access controls, D1 migrations and MySQL-to-D1 data reconciliation.
3. Deploy Netlify preview and test all frontend workflows against a staging Worker.
4. Back up MySQL and verify D1 row counts and financial totals.
5. Attach `YOUR_DOMAIN.com/api/*` Worker route.
6. Run smoke tests for login, roles, projects, requests, bidding, contracts, handovers, warranties, reports and document access.
7. Keep rollback steps ready: remove/disable the Worker route to return `/api` traffic to the prior origin only if a compatible backend exists there.

## Security and data

Never commit `.env`, `.dev.vars`, production credentials, `node_modules`, local database files or production records. Set production secrets with Wrangler. Do not run legacy destructive MySQL schema scripts against production.
