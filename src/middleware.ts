import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  // Get the allowed origin from environment variable or use default
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = context.request.headers.get('origin');

  // Handle CORS preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Get the response from next middleware/route
  return next().then((response) => {
    // Add CORS headers to all responses
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  });
});
