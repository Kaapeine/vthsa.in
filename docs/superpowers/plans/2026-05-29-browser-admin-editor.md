# Browser Admin Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a password-protected `/admin` area to the Astro blog that lets the owner create, edit, and delete blog posts and add library links from a browser, committing each change to GitHub as a markdown file so the existing build redeploys and publishes it.

**Architecture:** The site moves from GitHub Pages to Railway running the `@astrojs/node` standalone server. All existing pages stay statically prerendered; only the new `/admin/*` routes opt into on-demand server rendering (`export const prerender = false`). Admin routes authenticate via a signed HttpOnly session cookie, and write content by committing markdown files to the GitHub repo through the GitHub Contents REST API using `fetch`. A push to `main` (from the editor or from normal git work) triggers Railway's auto-deploy.

**Tech Stack:** Astro 6, `@astrojs/node` adapter, `gray-matter` (frontmatter parse/serialize), Node `crypto` (cookie HMAC + constant-time compare), plain `fetch` against the GitHub Contents API. No test framework (testing intentionally out of scope per owner; verification is manual via the dev server and a staging branch).

**Important conventions for the implementer:**
- Package manager is **npm** (`package-lock.json`). Use `npm install` / `npm run`.
- Node ≥ 22.12.0.
- Astro 6 default output is `static`; with an adapter present, individual routes become on-demand by exporting `const prerender = false`. Do **not** set `output: 'server'` — that would flip the default and force every page on-demand. Leave the default and opt in per admin route.
- Astro API endpoints are `.ts` files under `src/pages/` that export `GET`/`POST` functions returning a `Response`. Pages are `.astro` files.
- Commit after every task. Branch for this work: create `feat/admin-editor` before Task 1.

---

## File Structure

**New files:**
- `src/lib/config.ts` — reads and validates required environment variables once.
- `src/lib/auth.ts` — session cookie sign/verify, password check, login throttle, request guard.
- `src/lib/github.ts` — `getFile` / `putFile` / `deleteFile` against the GitHub Contents API.
- `src/lib/content.ts` — slugify, build post markdown, parse/serialize `links.md`.
- `src/layouts/AdminLayout.astro` — minimal bare layout for admin pages (no site chrome).
- `src/pages/admin/index.astro` — login form (logged out) / dashboard (logged in).
- `src/pages/admin/new.astro` — new post form.
- `src/pages/admin/edit/[slug].astro` — edit post form.
- `src/pages/admin/library/new.astro` — add library link form.
- `src/pages/admin/api/login.ts` — POST: verify password, set cookie.
- `src/pages/admin/api/logout.ts` — POST: clear cookie.
- `src/pages/admin/api/posts.ts` — POST: create/update a post.
- `src/pages/admin/api/posts/[slug]/delete.ts` — POST: delete a post.
- `src/pages/admin/api/library.ts` — POST: add a library link.
- `.env.example` — documents required env vars.
- `docs/deployment-railway.md` — deployment + DNS cutover notes.

**Modified files:**
- `package.json` — add `@astrojs/node`, `gray-matter` deps; add `start` script.
- `astro.config.mjs` — register the node adapter.
- `.gitignore` — ignore `.env`.
- `src/content.config.ts` — no change required, but referenced for schema fidelity.

---

## Task 1: Add the Node adapter and confirm hybrid rendering

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b feat/admin-editor
```

- [ ] **Step 2: Install the adapter and frontmatter library**

```bash
npm install @astrojs/node gray-matter
```

- [ ] **Step 3: Register the adapter in `astro.config.mjs`**

Replace the file contents with:

```js
// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://vthsa.in',
  integrations: [mdx(), sitemap()],
  adapter: node({ mode: 'standalone' }),
});
```

Note: output stays at the default (`static`). Existing pages prerender unchanged; only routes that export `prerender = false` run on-demand.

- [ ] **Step 4: Add a `start` script to `package.json`**

In the `scripts` block, add:

```json
"start": "node ./dist/server/entry.mjs"
```

So the scripts block reads:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "start": "node ./dist/server/entry.mjs",
  "astro": "astro"
}
```

- [ ] **Step 5: Ignore `.env` in `.gitignore`**

Append a line `.env` to `.gitignore` (create the file if it does not exist). Verify the entry is present:

```bash
grep -qx '.env' .gitignore || printf '\n.env\n' >> .gitignore
grep -n 'env' .gitignore
```

- [ ] **Step 6: Create `.env.example`**

```
# Password required to log into /admin
ADMIN_PASSWORD=change-me

# Fine-grained GitHub PAT with Contents: Read and write on this repo only
GITHUB_TOKEN=github_pat_xxx

# owner/repo to commit content into
GITHUB_REPO=YourGitHubUser/astro-blog

# Branch the editor commits to (Railway auto-deploys from this branch)
GITHUB_BRANCH=main

# Long random string used to sign the session cookie (e.g. `openssl rand -hex 32`)
SESSION_SECRET=replace-with-32-byte-random-hex
```

- [ ] **Step 7: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes; output mentions a server entry at `dist/server/entry.mjs` (because an adapter is now present) alongside the prerendered pages. No errors.

- [ ] **Step 8: Verify the prerendered server starts**

Run: `node ./dist/server/entry.mjs` (Ctrl-C after confirming). Then in another shell `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/`
Expected: `200`. (Default port is 4321; Railway will set `PORT`, which the standalone adapter honors.)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs .gitignore .env.example
git commit -m "build: add node adapter for on-demand admin routes"
```

---

## Task 2: Environment config module

**Files:**
- Create: `src/lib/config.ts`

- [ ] **Step 1: Implement `src/lib/config.ts`**

```ts
// Reads required environment variables once and fails loudly if any are missing.
// Imported by admin API routes and the GitHub client — never by static pages.

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  adminPassword: () => required('ADMIN_PASSWORD'),
  githubToken: () => required('GITHUB_TOKEN'),
  githubRepo: () => required('GITHUB_REPO'),
  githubBranch: () => process.env.GITHUB_BRANCH?.trim() || 'main',
  sessionSecret: () => required('SESSION_SECRET'),
};
```

Note: each value is a function (lazy) so importing the module never throws at build time — only when an admin route actually needs the value at request time.

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5` (or `npm run build`)
Expected: no type errors referencing `config.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/config.ts
git commit -m "feat: add environment config module for admin"
```

---

## Task 3: Session cookie helpers

**Files:**
- Create: `src/lib/auth.ts` (cookie portion only in this task)

- [ ] **Step 1: Implement the cookie sign/verify and password check in `src/lib/auth.ts`**

```ts
import crypto from 'node:crypto';
import { config } from './config';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Token payload is just an expiry timestamp; the HMAC proves authenticity.
function sign(payload: string): string {
  const hmac = crypto
    .createHmac('sha256', config.sessionSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${hmac}`;
}

function verify(token: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const expected = sign(payload);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function createSessionCookie(): string {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = sign(String(expiresAt));
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function isAuthenticated(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(COOKIE_NAME.length + 1);
  return verify(token);
}

export function checkPassword(submitted: string): boolean {
  const expected = config.adminPassword();
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5`
Expected: no type errors referencing `auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add session cookie and password helpers"
```

---

## Task 4: Login throttle and request guard

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Append an in-memory login throttle and a guard helper to `src/lib/auth.ts`**

Add at the end of the file:

```ts
// In-memory throttle for failed logins. Single server instance, so a module-level
// map is sufficient. Resets on deploy/restart, which is acceptable.
const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
let failures: { count: number; firstAt: number } = { count: 0, firstAt: 0 };

export function isLockedOut(): boolean {
  if (failures.count < LOCK_THRESHOLD) return false;
  if (Date.now() - failures.firstAt > LOCK_WINDOW_MS) {
    failures = { count: 0, firstAt: 0 };
    return false;
  }
  return true;
}

export function recordFailedLogin(): void {
  const now = Date.now();
  if (now - failures.firstAt > LOCK_WINDOW_MS) {
    failures = { count: 1, firstAt: now };
  } else {
    failures.count += 1;
  }
}

export function recordSuccessfulLogin(): void {
  failures = { count: 0, firstAt: 0 };
}

// Guard for API endpoints: returns a 401 Response if not authenticated, else null.
export function requireAuth(request: Request): Response | null {
  if (isAuthenticated(request.headers.get('cookie'))) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add login throttle and api auth guard"
```

---

## Task 5: GitHub Contents API client

**Files:**
- Create: `src/lib/github.ts`

- [ ] **Step 1: Implement `src/lib/github.ts`**

```ts
import { config } from './config';

const API = 'https://api.github.com';

function headers() {
  return {
    Authorization: `Bearer ${config.githubToken()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function contentsUrl(path: string): string {
  return `${API}/repos/${config.githubRepo()}/contents/${path}`;
}

export interface RepoFile {
  /** UTF-8 decoded file content */
  text: string;
  /** Blob sha, required to update or delete the file */
  sha: string;
}

/** Fetch a file's content and sha. Returns null if the file does not exist (404). */
export async function getFile(path: string): Promise<RepoFile | null> {
  const url = `${contentsUrl(path)}?ref=${encodeURIComponent(config.githubBranch())}`;
  const res = await fetch(url, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub getFile failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { content: string; sha: string };
  const text = Buffer.from(json.content, 'base64').toString('utf-8');
  return { text, sha: json.sha };
}

/**
 * Create or update a file. Pass the existing sha to update; omit for create.
 * Throws on conflict (409) or any non-2xx.
 */
export async function putFile(
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: config.githubBranch(),
  };
  if (sha) body.sha = sha;
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GitHub putFile failed (${res.status}): ${await res.text()}`);
  }
}

/** Delete a file by path + sha. Throws on any non-2xx. */
export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const res = await fetch(contentsUrl(path), {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ message, sha, branch: config.githubBranch() }),
  });
  if (!res.ok) {
    throw new Error(`GitHub deleteFile failed (${res.status}): ${await res.text()}`);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5`
Expected: no type errors referencing `github.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/github.ts
git commit -m "feat: add github contents api client"
```

---

## Task 6: Content helpers (slug, post markdown, links.md)

The blog schema (`src/content.config.ts`) requires post frontmatter: `title` (string), `description` (string), `pubDate` (coercible date), optional `updatedDate`, optional `tags` (string[]). The library schema requires `links: { title, url, description, tags[] }[]`.

**Files:**
- Create: `src/lib/content.ts`

- [ ] **Step 1: Implement `src/lib/content.ts`**

```ts
import matter from 'gray-matter';

export interface PostInput {
  title: string;
  description: string;
  body: string;
  tags: string[];
  pubDate: string; // ISO YYYY-MM-DD
  updatedDate?: string; // ISO YYYY-MM-DD, set on edits
}

export interface LibraryLink {
  title: string;
  url: string;
  description: string;
  tags: string[];
}

/** Convert a title into a filesystem/url-safe slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Today's date as ISO YYYY-MM-DD (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build a post markdown file (frontmatter + body) from form input. */
export function buildPostFile(input: PostInput): string {
  const data: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    pubDate: input.pubDate,
  };
  if (input.updatedDate) data.updatedDate = input.updatedDate;
  if (input.tags.length > 0) data.tags = input.tags;
  // gray-matter.stringify serializes `data` as YAML frontmatter above the body.
  return matter.stringify(input.body, data);
}

/** Parse an existing post file into editable fields. */
export function parsePostFile(raw: string): PostInput {
  const { data, content } = matter(raw);
  const toIso = (v: unknown): string => {
    if (!v) return '';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
  };
  return {
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    body: content.replace(/^\n/, ''),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    pubDate: toIso(data.pubDate),
    updatedDate: data.updatedDate ? toIso(data.updatedDate) : undefined,
  };
}

/** Parse links.md into its links array. Throws if the structure is unexpected. */
export function parseLinksFile(raw: string): LibraryLink[] {
  const { data } = matter(raw);
  if (!data || !Array.isArray(data.links)) {
    throw new Error('links.md is malformed: expected a top-level `links` array');
  }
  return data.links as LibraryLink[];
}

/** Serialize a links array back into links.md (empty body, links in frontmatter). */
export function buildLinksFile(links: LibraryLink[]): string {
  return matter.stringify('', { links });
}

/** Comma-separated string -> trimmed, de-duplicated, non-empty tag array. */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(',').map((t) => t.trim()).filter(Boolean))];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5`
Expected: no type errors referencing `content.ts`.

- [ ] **Step 3: Manually sanity-check serialization round-trip**

Run:

```bash
node --input-type=module -e "
import matter from 'gray-matter';
const out = matter.stringify('Hello body', { title: 'Test', pubDate: '2026-05-29', tags: ['a','b'] });
console.log(out);
const back = matter(out);
console.log(JSON.stringify(back.data), '|', JSON.stringify(back.content));
"
```

Expected: prints a YAML frontmatter block (`title: Test`, `pubDate: '2026-05-29'`, `tags: [a, b]`) followed by `Hello body`, then the parsed data and content. Confirms `gray-matter` round-trips cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/lib/content.ts
git commit -m "feat: add content helpers for posts and library links"
```

---

## Task 7: Admin layout + login API + logout API

**Files:**
- Create: `src/layouts/AdminLayout.astro`
- Create: `src/pages/admin/api/login.ts`
- Create: `src/pages/admin/api/logout.ts`

- [ ] **Step 1: Create `src/layouts/AdminLayout.astro`**

```astro
---
const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>{title} · admin</title>
    <style>
      body {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        max-width: 760px;
        margin: 2rem auto;
        padding: 0 1rem;
        background: #111;
        color: #eee;
      }
      a { color: #6cf; }
      input, textarea, button {
        font: inherit;
        background: #1b1b1b;
        color: #eee;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 0.5rem;
      }
      label { display: block; margin: 1rem 0 0.25rem; }
      input, textarea { width: 100%; box-sizing: border-box; }
      textarea { min-height: 50vh; }
      button { cursor: pointer; margin-top: 1rem; }
      .row { display: flex; gap: 1rem; align-items: center; }
      .msg { padding: 0.5rem 0.75rem; border-radius: 4px; margin: 1rem 0; }
      .msg.error { background: #3a1414; border: 1px solid #743; }
      .msg.ok { background: #143a18; border: 1px solid #474; }
      ul.posts { list-style: none; padding: 0; }
      ul.posts li { display: flex; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px solid #222; }
    </style>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Create `src/pages/admin/api/login.ts`**

```ts
import type { APIRoute } from 'astro';
import {
  checkPassword,
  createSessionCookie,
  isLockedOut,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');

  if (isLockedOut()) {
    return redirectWithError('Too many attempts. Try again later.');
  }
  if (!checkPassword(password)) {
    recordFailedLogin();
    return redirectWithError('Incorrect password.');
  }
  recordSuccessfulLogin();
  return new Response(null, {
    status: 303,
    headers: { Location: '/admin', 'Set-Cookie': createSessionCookie() },
  });
};

function redirectWithError(message: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/admin?error=${encodeURIComponent(message)}` },
  });
}
```

- [ ] **Step 3: Create `src/pages/admin/api/logout.ts`**

```ts
import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 303,
    headers: { Location: '/admin', 'Set-Cookie': clearSessionCookie() },
  });
};
```

- [ ] **Step 4: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/AdminLayout.astro src/pages/admin/api/login.ts src/pages/admin/api/logout.ts
git commit -m "feat: add admin layout and login/logout endpoints"
```

---

## Task 8: Admin dashboard / login page

**Files:**
- Create: `src/pages/admin/index.astro`

- [ ] **Step 1: Create `src/pages/admin/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import AdminLayout from '../../layouts/AdminLayout.astro';
import { isAuthenticated } from '../../lib/auth';

export const prerender = false;

const loggedIn = isAuthenticated(Astro.request.headers.get('cookie'));
const error = Astro.url.searchParams.get('error');
const notice = Astro.url.searchParams.get('notice');

let posts: { slug: string; title: string; pubDate: Date }[] = [];
if (loggedIn) {
  const all = await getCollection('blog');
  posts = all
    .map((p) => ({ slug: p.id, title: p.data.title, pubDate: p.data.pubDate }))
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
---

<AdminLayout title="admin">
  {error && <div class="msg error">{error}</div>}
  {notice && <div class="msg ok">{notice}</div>}

  {!loggedIn ? (
    <form method="POST" action="/admin/api/login">
      <h1>admin login</h1>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autofocus required />
      <button type="submit">Log in</button>
    </form>
  ) : (
    <>
      <div class="row" style="justify-content: space-between;">
        <h1>admin</h1>
        <form method="POST" action="/admin/api/logout"><button type="submit">Log out</button></form>
      </div>

      <div class="row">
        <a href="/admin/new">+ New post</a>
        <a href="/admin/library/new">+ Add library link</a>
      </div>

      <h2>Posts</h2>
      <ul class="posts">
        {posts.map((p) => (
          <li>
            <span style="color:#888; min-width:6rem;">{p.pubDate.toISOString().slice(0, 10)}</span>
            <a href={`/admin/edit/${p.slug}`} style="flex:1;">{p.title}</a>
            <form
              method="POST"
              action={`/admin/api/posts/${p.slug}/delete`}
              onsubmit="return confirm('Delete this post?');"
            >
              <button type="submit" style="border-color:#743;">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  )}
</AdminLayout>
```

Note: `getCollection('blog')` reads the content built into this deployment. After an edit commits and Railway redeploys, the new build reflects the change. This is consistent with the ~1-minute publish delay in the design.

- [ ] **Step 2: Verify locally**

Create a local `.env` (not committed) with the real values, then:

```bash
npm run build && node ./dist/server/entry.mjs
```

Visit `http://localhost:4321/admin`. Expected: login form. Enter the wrong password → redirected back with "Incorrect password." Enter the correct password → dashboard listing your existing posts with Edit/Delete and the two "+" links. Click Log out → back to login form.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat: add admin dashboard and login page"
```

---

## Task 9: New / edit post forms + posts API (create/update)

**Files:**
- Create: `src/pages/admin/new.astro`
- Create: `src/pages/admin/edit/[slug].astro`
- Create: `src/pages/admin/api/posts.ts`

- [ ] **Step 1: Create `src/pages/admin/new.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { isAuthenticated } from '../../lib/auth';
import { todayIso } from '../../lib/content';

export const prerender = false;

if (!isAuthenticated(Astro.request.headers.get('cookie'))) {
  return Astro.redirect('/admin');
}
const error = Astro.url.searchParams.get('error');
---

<AdminLayout title="new post">
  <a href="/admin">&larr; back</a>
  <h1>New post</h1>
  {error && <div class="msg error">{error}</div>}
  <form method="POST" action="/admin/api/posts">
    <input type="hidden" name="mode" value="create" />
    <label for="title">Title</label>
    <input id="title" name="title" required />
    <label for="description">Description</label>
    <input id="description" name="description" required />
    <label for="tags">Tags (comma-separated)</label>
    <input id="tags" name="tags" />
    <label for="pubDate">Publish date</label>
    <input id="pubDate" name="pubDate" type="date" value={todayIso()} required />
    <label for="body">Body (markdown)</label>
    <textarea id="body" name="body" required></textarea>
    <button type="submit">Publish</button>
  </form>
</AdminLayout>
```

- [ ] **Step 2: Create `src/pages/admin/edit/[slug].astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { isAuthenticated } from '../../../lib/auth';
import { getFile } from '../../../lib/github';
import { parsePostFile } from '../../../lib/content';

export const prerender = false;

if (!isAuthenticated(Astro.request.headers.get('cookie'))) {
  return Astro.redirect('/admin');
}

const { slug } = Astro.params;
const error = Astro.url.searchParams.get('error');

const file = await getFile(`src/content/blog/${slug}.md`);
if (!file) {
  return Astro.redirect('/admin?error=' + encodeURIComponent('Post not found'));
}
const post = parsePostFile(file.text);
---

<AdminLayout title="edit post">
  <a href="/admin">&larr; back</a>
  <h1>Edit: {post.title}</h1>
  {error && <div class="msg error">{error}</div>}
  <form method="POST" action="/admin/api/posts">
    <input type="hidden" name="mode" value="update" />
    <input type="hidden" name="slug" value={slug} />
    <input type="hidden" name="pubDate" value={post.pubDate} />
    <label for="title">Title</label>
    <input id="title" name="title" value={post.title} required />
    <label for="description">Description</label>
    <input id="description" name="description" value={post.description} required />
    <label for="tags">Tags (comma-separated)</label>
    <input id="tags" name="tags" value={post.tags.join(', ')} />
    <label for="body">Body (markdown)</label>
    <textarea id="body" name="body" required>{post.body}</textarea>
    <button type="submit">Save changes</button>
  </form>
</AdminLayout>
```

Note: the slug (filename) is fixed on edit. `pubDate` is preserved via a hidden field; the API sets `updatedDate` to today automatically.

- [ ] **Step 3: Create `src/pages/admin/api/posts.ts`**

```ts
import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { getFile, putFile } from '../../../lib/github';
import {
  buildPostFile,
  parseTags,
  slugify,
  todayIso,
  type PostInput,
} from '../../../lib/content';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const mode = String(form.get('mode') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();
  const tags = parseTags(String(form.get('tags') ?? ''));

  if (!title || !description || !body) {
    return fail(mode, form, 'Title, description, and body are required.');
  }

  try {
    if (mode === 'create') {
      const slug = slugify(title);
      if (!slug) return fail('create', form, 'Title produces an empty slug.');
      const path = `src/content/blog/${slug}.md`;
      const existing = await getFile(path);
      if (existing) return fail('create', form, 'A post with that title already exists.');
      const input: PostInput = {
        title,
        description,
        body,
        tags,
        pubDate: String(form.get('pubDate') ?? todayIso()),
      };
      await putFile(path, buildPostFile(input), `Add post: ${slug}`);
    } else if (mode === 'update') {
      const slug = String(form.get('slug') ?? '');
      const path = `src/content/blog/${slug}.md`;
      const current = await getFile(path);
      if (!current) return fail('update', form, 'Post no longer exists.', slug);
      const input: PostInput = {
        title,
        description,
        body,
        tags,
        pubDate: String(form.get('pubDate') ?? todayIso()),
        updatedDate: todayIso(),
      };
      await putFile(path, buildPostFile(input), `Update post: ${slug}`, current.sha);
    } else {
      return fail(mode, form, 'Unknown form mode.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail(mode, form, `Couldn't save — ${message}. Nothing was published.`);
  }

  return redirect(
    '/admin?notice=' + encodeURIComponent('Saved. Publishing now — live in ~1 minute.'),
  );
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function fail(mode: string, form: FormData, message: string, slug?: string): Response {
  const back =
    mode === 'update'
      ? `/admin/edit/${slug ?? form.get('slug')}`
      : '/admin/new';
  return redirect(`${back}?error=${encodeURIComponent(message)}`);
}
```

- [ ] **Step 4: Verify create flow locally against a staging branch**

In your local `.env`, set `GITHUB_BRANCH=admin-staging` (create that branch on GitHub first) so test commits don't touch `main`. Then:

```bash
npm run build && node ./dist/server/entry.mjs
```

Log in, go to **New post**, fill all fields, Publish. Expected: redirect to dashboard with the green "Saved. Publishing now…" notice, and a new commit `Add post: <slug>` on `admin-staging` in GitHub. Try Publish again with the same title → redirected back with "A post with that title already exists."

- [ ] **Step 5: Verify edit flow locally**

From the dashboard click **Edit** on the post you just created (note: it appears in the list only after a rebuild from the branch the deployment is built on; for local verification you can navigate directly to `/admin/edit/<slug>` since the edit page reads the file live via the GitHub API). Change the body, Save. Expected: commit `Update post: <slug>` on `admin-staging`, and the file now has an `updatedDate` matching today.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/new.astro "src/pages/admin/edit/[slug].astro" src/pages/admin/api/posts.ts
git commit -m "feat: add new/edit post forms and posts api"
```

---

## Task 10: Delete post endpoint

**Files:**
- Create: `src/pages/admin/api/posts/[slug]/delete.ts`

- [ ] **Step 1: Create `src/pages/admin/api/posts/[slug]/delete.ts`**

```ts
import type { APIRoute } from 'astro';
import { requireAuth } from '../../../../../lib/auth';
import { getFile, deleteFile } from '../../../../../lib/github';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const slug = params.slug;
  const path = `src/content/blog/${slug}.md`;
  try {
    const file = await getFile(path);
    if (!file) {
      return redirect('/admin?error=' + encodeURIComponent('Post not found.'));
    }
    await deleteFile(path, file.sha, `Delete post: ${slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return redirect('/admin?error=' + encodeURIComponent(`Couldn't delete — ${message}.`));
  }
  return redirect(
    '/admin?notice=' + encodeURIComponent('Deleted. Publishing now — live in ~1 minute.'),
  );
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
```

Note the relative import depth: this file is five levels under `src/pages/`, so `../../../../../lib/...` resolves to `src/lib/...`. Verify with the compile step.

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check 2>&1 | tail -5`
Expected: no type errors, and the import path resolves (no "cannot find module" for `lib/auth` or `lib/github`).

- [ ] **Step 3: Verify delete flow locally (staging branch)**

With `GITHUB_BRANCH=admin-staging`, rebuild/run, log in, and delete the staging test post via the dashboard's Delete button (confirm the browser prompt). Expected: commit `Delete post: <slug>` on `admin-staging`; dashboard shows the green "Deleted…" notice.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/admin/api/posts/[slug]/delete.ts"
git commit -m "feat: add delete post endpoint"
```

---

## Task 11: Add library link form + endpoint

**Files:**
- Create: `src/pages/admin/library/new.astro`
- Create: `src/pages/admin/api/library.ts`

- [ ] **Step 1: Create `src/pages/admin/library/new.astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { isAuthenticated } from '../../../lib/auth';

export const prerender = false;

if (!isAuthenticated(Astro.request.headers.get('cookie'))) {
  return Astro.redirect('/admin');
}
const error = Astro.url.searchParams.get('error');
---

<AdminLayout title="add link">
  <a href="/admin">&larr; back</a>
  <h1>Add library link</h1>
  {error && <div class="msg error">{error}</div>}
  <form method="POST" action="/admin/api/library">
    <label for="title">Title</label>
    <input id="title" name="title" required />
    <label for="url">URL</label>
    <input id="url" name="url" type="url" required />
    <label for="description">Description</label>
    <input id="description" name="description" required />
    <label for="tags">Tags (comma-separated)</label>
    <input id="tags" name="tags" />
    <button type="submit">Add link</button>
  </form>
</AdminLayout>
```

- [ ] **Step 2: Create `src/pages/admin/api/library.ts`**

```ts
import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { getFile, putFile } from '../../../lib/github';
import {
  buildLinksFile,
  parseLinksFile,
  parseTags,
  type LibraryLink,
} from '../../../lib/content';

export const prerender = false;

const LINKS_PATH = 'src/content/library/links.md';

export const POST: APIRoute = async ({ request }) => {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const url = String(form.get('url') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const tags = parseTags(String(form.get('tags') ?? ''));

  if (!title || !url || !description) {
    return fail('Title, URL, and description are required.');
  }
  try {
    new URL(url); // validate URL shape
  } catch {
    return fail('URL is not valid.');
  }

  try {
    const file = await getFile(LINKS_PATH);
    if (!file) return fail('links.md not found in the repo.');
    const existing = parseLinksFile(file.text);
    const next: LibraryLink[] = [{ title, url, description, tags }, ...existing];
    await putFile(LINKS_PATH, buildLinksFile(next), `Add library link: ${title}`, file.sha);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return fail(`Couldn't add link — ${message}. Nothing was published.`);
  }

  return redirect(
    '/admin?notice=' + encodeURIComponent('Link added. Publishing now — live in ~1 minute.'),
  );
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function fail(message: string): Response {
  return redirect('/admin/library/new?error=' + encodeURIComponent(message));
}
```

- [ ] **Step 3: Verify add-link flow locally (staging branch)**

With `GITHUB_BRANCH=admin-staging`, rebuild/run, log in, **Add library link**, fill the form with a real URL, submit. Expected: green notice; commit `Add library link: <title>` on `admin-staging`; the new link appears **prepended** to the `links:` array in `links.md`, and the existing links are intact and unchanged. Try an invalid URL like `not a url` → redirected back with "URL is not valid."

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/library/new.astro src/pages/admin/api/library.ts
git commit -m "feat: add library link form and endpoint"
```

---

## Task 12: Full local end-to-end pass and cleanup

**Files:** none (verification only)

- [ ] **Step 1: Confirm a clean production build**

Run: `npm run build`
Expected: success. Confirm in the output/log that `/admin`, `/admin/new`, `/admin/edit/[slug]`, `/admin/library/new`, and the `/admin/api/*` routes are listed as on-demand (server) routes, while existing content pages remain prerendered.

- [ ] **Step 2: Run through the whole flow once more against `admin-staging`**

Start `node ./dist/server/entry.mjs`. Verify: logged-out `/admin/new` redirects to login; after login, create → edit → delete a post, and add a library link, each producing the expected commit on `admin-staging`. Verify `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4321/admin/api/posts` returns `401` (no cookie).

- [ ] **Step 3: Delete the staging test commits/branch if desired**

```bash
git push origin --delete admin-staging   # optional cleanup, if the branch was pushed
```

- [ ] **Step 4: Commit any final tweaks (if needed) — otherwise skip**

---

## Task 13: Railway deployment + DNS cutover

**Files:**
- Create: `docs/deployment-railway.md`

- [ ] **Step 1: Write `docs/deployment-railway.md`**

```markdown
# Deploying to Railway

This site runs as an `@astrojs/node` standalone server so the `/admin` editor can
run server-side. All public pages are still prerendered at build time.

## One-time setup

1. Create a Railway project and add a service from this GitHub repo (branch `main`).
2. Build command: `npm run build`
3. Start command: `npm run start`  (runs `node ./dist/server/entry.mjs`)
4. Set environment variables (see `.env.example`):
   - `ADMIN_PASSWORD` — your login password
   - `GITHUB_TOKEN` — fine-grained PAT, repo-scoped, **Contents: Read and write**
   - `GITHUB_REPO` — e.g. `YourUser/astro-blog`
   - `GITHUB_BRANCH` — `main`
   - `SESSION_SECRET` — output of `openssl rand -hex 32`
5. Railway sets `PORT` automatically; the standalone adapter honors it. No extra config.

## How publishing works

- Editing a post or adding a link commits a markdown file to `main` via the GitHub API.
- The push triggers Railway to rebuild and redeploy automatically.
- The change is live ~1 minute later.

## DNS cutover (vthsa.in)

1. In Railway, add the custom domain `vthsa.in` (and `www` if used) to the service.
2. Railway shows the target (a CNAME / A record). Update DNS at your registrar to point
   to Railway instead of GitHub Pages.
3. Wait for the certificate to provision (Railway handles HTTPS).
4. Once verified, retire GitHub Pages: in the GitHub repo Settings → Pages, set source
   to None, and remove `.github/workflows/*` Pages deploy workflow if present.

## Security notes

- The GitHub PAT is fine-grained and limited to this repo's contents only.
- The session cookie is HttpOnly, Secure, SameSite=Strict; `SESSION_SECRET` signs it.
- Failed logins are throttled in-memory (5 attempts / 15 min) per server instance.
```

- [ ] **Step 2: Confirm there is no `.github/workflows` Pages deploy left referenced**

Run: `ls .github/workflows 2>/dev/null || echo "no workflows dir"`
If a Pages deploy workflow exists, note in the doc that it should be removed after cutover (do not delete here — coordinate with the DNS switch).

- [ ] **Step 3: Commit**

```bash
git add docs/deployment-railway.md
git commit -m "docs: add railway deployment and dns cutover notes"
```

- [ ] **Step 4: Open a PR (or merge) for `feat/admin-editor`**

```bash
git push -u origin feat/admin-editor
```

Then create a PR to `main`. Merging + the Railway setup completes the migration.

---

## Notes on scope (intentionally excluded for v1)

- **Image upload / hero images:** not supported; posts are text/markdown only.
- **Editing or deleting existing library links:** only adding is supported; edit `links.md` directly for the rare case.
- **Renaming a post (changing its slug):** the slug is fixed on edit to avoid breaking URLs.
- **Projects / music / about / resume pages:** not editable from the browser.
- **Automated tests:** omitted per owner's decision; each task includes manual verification against a staging branch.
- **Deploy-status polling:** the UI confirms the commit and states "live in ~1 minute" rather than tracking the Railway build.
