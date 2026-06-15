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
			description: z.string().optional(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).optional(),
			draft: z.boolean().optional(),
		}),
});

const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		externalUrl: z.string(),
		date: z.coerce.date(),
		// When true, list items link straight to externalUrl instead of a detail page.
		onlyLink: z.boolean().optional(),
		// Card thumbnail (path or URL). When set, used instead of fetching the external og:image.
		thumbnailImage: z.string().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const music = defineCollection({
	loader: glob({ base: './src/content/music', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		externalUrl: z.string(),
		date: z.coerce.date(),
		// When true, list items link straight to externalUrl instead of a detail page.
		onlyLink: z.boolean().optional(),
		// Card thumbnail (path or URL). When set, used instead of fetching the external og:image.
		thumbnailImage: z.string().optional(),
		tags: z.array(z.string()).optional(),
	}),
});

const library = defineCollection({
	loader: glob({ base: './src/content/library', pattern: '**/*.md' }),
	schema: z.object({
		links: z.array(z.object({
			title: z.string(),
			url: z.string(),
			description: z.string(),
			tags: z.array(z.string()),
		})),
	}),
});

const map = defineCollection({
	loader: glob({ base: './src/content/map', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		category: z.string(),
		lat: z.number(),
		lng: z.number(),
		image: z.string().optional(),
		pubDate: z.coerce.date(),
	}),
});

export const collections = { blog, projects, music, library, map };
