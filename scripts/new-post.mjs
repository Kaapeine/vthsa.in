#!/usr/bin/env node
// Scaffolds a new content file for the `blog` or `projects` collection.
// Usage: npm run new-post -- blog "My Post Title"
//        npm run new-post -- projects "My Project Title"

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const [collection, title] = process.argv.slice(2);

if (!collection || !['blog', 'projects'].includes(collection)) {
	console.error('Usage: npm run new-post -- <blog|projects> "Title"');
	process.exit(1);
}
if (!title) {
	console.error('Missing title, e.g. npm run new-post -- blog "My Title"');
	process.exit(1);
}

const slug = title
	.toLowerCase()
	.trim()
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-+|-+$/g, '');

const dir = path.join(root, 'src', 'content', collection);
const filePath = path.join(dir, `${slug}.md`);

if (existsSync(filePath)) {
	console.error(`File already exists: ${path.relative(root, filePath)}`);
	process.exit(1);
}

const today = new Date();
const dateStr =
	collection === 'blog'
		? `${today.toLocaleString('en-US', { month: 'long' })} ${today.getDate()} ${today.getFullYear()}`
		: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const frontmatter =
	collection === 'blog'
		? `title: '${title}'\npubDate: '${dateStr}'`
		: `title: '${title}'\ndescription: ''\nexternalUrl: ''\ndate: ${dateStr}`;

mkdirSync(dir, { recursive: true });
writeFileSync(filePath, `---\n${frontmatter}\n---\n\n`, 'utf8');

console.log(`Created ${path.relative(root, filePath)}`);
