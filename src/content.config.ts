import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).optional(),
		}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		url: z.string(),
		year: z.number(),
		tags: z.array(z.string()).optional(),
	}),
});

const music = defineCollection({
	loader: glob({ base: './src/content/music', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		url: z.string(),
		year: z.number(),
		tags: z.array(z.string()).optional(),
	}),
});

export const collections = { blog, projects, music };
