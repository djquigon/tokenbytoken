// HTTP helpers for the chat route: typed error responses, a size-capped body reader, and the origin check.

import 'server-only';

import { APP_ERRORS, type AppError, type AppErrorCode } from '@/shared/errors';

export function errorResponse(error: AppError): Response {
  const spec = APP_ERRORS[error.code];
  const status = 'status' in spec ? spec.status : 500;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (error.retryAfterSec !== undefined) headers['Retry-After'] = String(error.retryAfterSec);
  return new Response(JSON.stringify({ error }), { status, headers });
}

export const errorOf = (code: AppErrorCode, extra: Omit<AppError, 'code'> = {}): AppError => ({ code, ...extra });

export type BodyResult = { ok: true; text: string } | { ok: false; reason: 'too_large' | 'unreadable' };

/** Reads at most `maxBytes`, whatever Content-Length claims. */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<BodyResult> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: 'too_large' };
  if (!request.body) return { ok: true, text: '' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/**
 * Only this site's own pages may call the API. Browsers always send Origin on POST, and requiring JSON
 * forces a CORS preflight for cross-site pages, which this route never approves.
 */
export function originAllowed(request: Request, extraOrigins: readonly string[]): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (extraOrigins.includes(origin)) return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The client IP. On Vercel, x-forwarded-for and x-real-ip are set by Vercel and can't be spoofed. */
export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}
