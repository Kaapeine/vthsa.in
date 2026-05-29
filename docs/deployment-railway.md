# Deploying to Railway

This site runs as an `@astrojs/node` standalone server so the `/admin` editor can
run server-side. All public pages are still prerendered at build time.

## One-time setup

1. Create a Railway project and add a service from this GitHub repo (branch `main`).
2. Build command: `npm run build`
3. Start command: `npm run start`  (runs `node --env-file=.env ./dist/server/entry.mjs`)
   - On Railway the env vars come from the dashboard, not a `.env` file. Railway injects
     them into `process.env` directly, so the `--env-file` flag is harmless (it only loads
     the file if it exists). No `.env` file is committed or needed on the server.
4. Set environment variables in the Railway service dashboard (see `.env.example`):
   - `ADMIN_PASSWORD` — your login password
   - `GITHUB_TOKEN` — fine-grained PAT, repo-scoped, **Contents: Read and write**
   - `GITHUB_REPO` — e.g. `Kaapeine/vthsa.in`
   - `GITHUB_BRANCH` — `main`
   - `SESSION_SECRET` — output of `openssl rand -hex 32`
5. Railway sets `PORT` automatically; the standalone adapter honors it. No extra config needed.

## How publishing works

- Editing a post or adding a link commits a markdown file to `main` via the GitHub API.
- The push triggers Railway to rebuild and redeploy automatically.
- The change is live ~1 minute later.

## DNS cutover (vthsa.in)

1. In Railway, add the custom domain `vthsa.in` (and `www` if used) to the service.
2. Railway shows the target (a CNAME or A record). Update DNS at your registrar to point
   to Railway instead of GitHub Pages.
3. Wait for the certificate to provision (Railway handles HTTPS automatically).
4. Once the domain resolves correctly on Railway, retire GitHub Pages:
   - In the GitHub repo Settings → Pages, set source to **None**.
   - Remove `.github/workflows/astro.yml` (the Pages deploy workflow) — it is no longer
     needed since Railway handles deployment.

## Security notes

- The GitHub PAT is fine-grained and limited to this repo's contents only.
- The session cookie is HttpOnly, Secure, SameSite=Strict; `SESSION_SECRET` signs it.
- Failed logins are throttled in-memory (5 attempts / 15 min). The counter resets on
  restart/redeploy, which is acceptable for a single-author blog.
- `/admin` routes are excluded from the sitemap (`noindex, nofollow` meta tag set).
