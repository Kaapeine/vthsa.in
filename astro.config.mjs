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
  // Astro's built-in checkOrigin is disabled because it is broken behind a
  // TLS-terminating proxy (Railway): the standalone Node adapter builds the
  // request URL from the *internal* protocol (http), ignoring x-forwarded-proto,
  // so its `origin === url.origin` check fails against the browser's https
  // Origin header. We enforce a protocol-agnostic same-origin check in
  // src/middleware.ts instead. See validateForwardedHeaders in @astrojs/node.
  security: {
    checkOrigin: false,
  },
});
