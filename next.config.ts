import { withBotId } from 'botid/next/config';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';
// Vercel injects its toolbar into Preview deployments only; production never allows these hosts.
// Sources from https://vercel.com/docs/vercel-toolbar/managing-toolbar ("Using a Content Security Policy").
const toolbar = process.env.VERCEL_ENV === 'preview';
const extra = (sources: string) => (toolbar ? ` ${sources}` : '');

// A static policy (no nonces), so pages can stay statically rendered (Next.js CSP guide, "Without
// Nonces"). Model output is rendered as sanitized Markdown without images, so img-src stays narrow, and
// connect-src 'self' keeps any injected script from sending data elsewhere. PROVISIONAL (CLAUDE.md §10):
// check BotID on the first Preview deployment, since its challenge script can't run locally.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${extra('https://vercel.live')}`,
  `style-src 'self' 'unsafe-inline'${extra('https://vercel.live')}`,
  `img-src 'self' data: blob:${extra('https://vercel.live https://vercel.com')}`,
  `font-src 'self'${extra('https://vercel.live https://assets.vercel.com')}`,
  `connect-src 'self'${extra('https://vercel.live wss://ws-us3.pusher.com')}`,
  `frame-src 'self'${extra('https://vercel.live')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // BotID serves its challenge through same-origin paths under this prefix and sets its own headers.
      { source: '/((?!_next/static|_next/image|favicon.ico|149e9513-01fa-4fb0-aad4-566afd725d1b).*)', headers: securityHeaders },
    ];
  },
};

export default withBotId(nextConfig);
