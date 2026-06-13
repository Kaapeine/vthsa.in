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
  security: {
    checkOrigin: process.env.NODE_ENV !== 'development',
    allowedDomains: [
      {
        protocol: 'https',
        hostname: 'vthsa.in',
      },
    ],
  },
});