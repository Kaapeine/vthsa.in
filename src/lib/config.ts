// Reads required environment variables once and fails loudly if any are missing.
// Imported by admin API routes and the GitHub client — never by static pages.
// Reads import.meta.env first (Vite/astro dev), then process.env (production node server).

function required(name: string): string {
  const value = (import.meta.env[name] as string | undefined) || process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return (import.meta.env[name] as string | undefined) || process.env[name] || fallback;
}

export const config = {
  adminPassword: () => required('ADMIN_PASSWORD'),
  githubToken: () => required('GITHUB_TOKEN'),
  githubRepo: () => required('GITHUB_REPO'),
  githubBranch: () => optional('GITHUB_BRANCH', 'main'),
  sessionSecret: () => required('SESSION_SECRET'),
};
