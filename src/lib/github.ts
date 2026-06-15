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

/**
 * Create or update a binary file from a Buffer. Pass the existing sha to update;
 * omit for create. Throws on any non-2xx.
 */
export async function putBinaryFile(
  path: string,
  content: Buffer,
  message: string,
  sha?: string,
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: content.toString('base64'),
    branch: config.githubBranch(),
  };
  if (sha) body.sha = sha;
  const res = await fetch(contentsUrl(path), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GitHub putBinaryFile failed (${res.status}): ${await res.text()}`);
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
