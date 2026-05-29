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
