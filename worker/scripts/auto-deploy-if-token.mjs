#!/usr/bin/env node
/**
 * Automatically deploys the Cloudflare Worker during Netlify / CI builds
 * ONLY when CLOUDFLARE_API_TOKEN is present in the environment.
 * Exits 0 immediately when CLOUDFLARE_API_TOKEN is not set so local/frontend builds never fail.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token || !token.trim()) {
  console.log('[Cloudflare Auto-Deploy] CLOUDFLARE_API_TOKEN not set in environment — skipping Worker deploy during frontend build.');
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..');

try {
  console.log('[Cloudflare Auto-Deploy] CLOUDFLARE_API_TOKEN detected! Installing Worker dependencies and deploying Worker...');
  execSync('npm install --no-audit --no-fund', { cwd: workerDir, stdio: 'inherit' });
  const envFlag = process.env.CONTEXT === 'deploy-preview' || process.env.CONTEXT === 'branch-deploy' ? '' : '--env production';
  execSync(`npx wrangler deploy ${envFlag}`.trim(), { cwd: workerDir, stdio: 'inherit' });
  console.log('[Cloudflare Auto-Deploy] Cloudflare Worker deployed successfully!');
} catch (err) {
  console.warn('[Cloudflare Auto-Deploy] Warning: Worker deployment failed during build:', err?.message || err);
}
