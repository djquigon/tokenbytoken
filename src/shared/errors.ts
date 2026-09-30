// Typed error codes (docs/PLAN.md §3.6). Each code has fixed copy and a retry rule. Raw provider text
// is never shown to users: the server maps provider errors to these codes and logs only the code.

/** How the UI offers a retry. */
export type RetryRule =
  | 'none' // retrying the same request won't help
  | 'now' // a new request may work right away
  | 'after' // wait for a countdown (Retry-After)
  | 'backoff' // the provider is busy: suggest waiting a moment
  | 'later' // something is down: try again in a few minutes
  | 'reload'; // the page itself is out of step: reload

/** Where the error is detected. Pre-stream errors carry an HTTP status; in-band ones arrive in `end`. */
export type ErrorStage = 'pre_stream' | 'in_band' | 'client';

interface ErrorSpec {
  readonly stage: ErrorStage;
  readonly status?: number;
  readonly retry: RetryRule;
  readonly title: string;
  readonly body: string;
}

export const APP_ERRORS = {
  bad_request: {
    stage: 'pre_stream',
    status: 400,
    retry: 'reload',
    title: "The server couldn't read this request",
    body: 'Reloading the page usually fixes this.',
  },
  payload_too_large: {
    stage: 'pre_stream',
    status: 413,
    retry: 'none',
    title: 'This conversation is too large to send',
    body: 'Shorten your message, or clear the conversation to start fresh.',
  },
  forbidden: {
    stage: 'pre_stream',
    status: 403,
    retry: 'none',
    title: 'This request was blocked',
    body: 'The server only accepts messages sent from this site in a regular browser.',
  },
  invalid_history: {
    stage: 'pre_stream',
    status: 400,
    retry: 'none',
    title: "An earlier reply couldn't be verified",
    body: "This app signs each reply so earlier turns can't be altered. One didn't match, so nothing was sent. Clear the conversation to continue.",
  },
  context_too_long: {
    stage: 'pre_stream',
    status: 400,
    retry: 'none',
    title: 'This message is too long for this app',
    body: "Even without the earlier turns, it doesn't fit in the amount of text this app sends per request. Try a shorter message.",
  },
  input_flagged: {
    stage: 'pre_stream',
    status: 422,
    retry: 'none',
    title: "This message wasn't sent",
    body: "OpenAI's moderation model flagged it, so this app didn't send it to the chat model. Try rephrasing it.",
  },
  rate_limited: {
    stage: 'pre_stream',
    status: 429,
    retry: 'after',
    title: "You're sending messages quickly",
    body: 'This free site limits how many messages each visitor can send per minute and per day.',
  },
  concurrent_request: {
    stage: 'pre_stream',
    status: 409,
    retry: 'after',
    title: 'Another reply is still being written',
    body: 'This app writes one reply at a time. Wait for it to finish, or stop it.',
  },
  daily_budget_exhausted: {
    stage: 'pre_stream',
    status: 503,
    retry: 'after',
    title: "Today's budget for this site is used up",
    body: 'This free site has a small daily budget for the AI model. It resets at midnight UTC.',
  },
  service_unavailable: {
    stage: 'pre_stream',
    status: 503,
    retry: 'later',
    title: 'The chat is unavailable right now',
    body: "A service this app depends on isn't responding. Please try again in a few minutes.",
  },
  upstream_rate_limited: {
    stage: 'in_band',
    retry: 'backoff',
    title: 'OpenAI is limiting requests right now',
    body: 'Please wait a moment, then try again.',
  },
  upstream_quota_exhausted: {
    stage: 'in_band',
    retry: 'none',
    title: 'This site has reached its OpenAI spending limit',
    body: "The site's budget with OpenAI is used up, so no more replies can be written for now.",
  },
  upstream_overloaded: {
    stage: 'in_band',
    retry: 'backoff',
    title: 'OpenAI is busy',
    body: "OpenAI couldn't handle the request just now. Please wait a moment, then try again.",
  },
  upstream_timeout: {
    stage: 'in_band',
    retry: 'now',
    title: 'The reply stalled',
    body: 'Nothing arrived from OpenAI for a while, so this app stopped waiting.',
  },
  upstream_stream_interrupted: {
    stage: 'in_band',
    retry: 'now',
    title: 'The reply was cut off',
    body: "OpenAI's stream ended before the reply was finished.",
  },
  upstream_failed: {
    stage: 'in_band',
    retry: 'now',
    title: "OpenAI couldn't finish this reply",
    body: 'Please try again.',
  },
  upstream_context_length: {
    stage: 'in_band',
    retry: 'none',
    title: 'This conversation is too long for the model',
    body: "OpenAI rejected it as longer than the model's limit. Clear the conversation or send a shorter message.",
  },
  upstream_refused_request: {
    stage: 'in_band',
    retry: 'none',
    title: 'OpenAI rejected this request',
    body: 'Try rephrasing your message.',
  },
  upstream_misconfigured: {
    stage: 'in_band',
    retry: 'none',
    title: "This site's connection to OpenAI isn't set up correctly",
    body: 'The site owner needs to fix it. Please try again later.',
  },
  network_error: {
    stage: 'client',
    retry: 'now',
    title: 'Connection problem',
    body: "This app couldn't reach its server. Check your connection and try again.",
  },
  stream_interrupted: {
    stage: 'client',
    retry: 'now',
    title: 'The connection dropped',
    body: 'The reply stopped arriving before it was finished.',
  },
  protocol_error: {
    stage: 'client',
    retry: 'reload',
    title: 'Something went wrong',
    body: "The app received data it couldn't read. Reload the page to continue.",
  },
} as const satisfies Record<string, ErrorSpec>;

export type AppErrorCode = keyof typeof APP_ERRORS;
export const APP_ERROR_CODES = Object.keys(APP_ERRORS) as AppErrorCode[];

/** The error shape on the wire: a code plus timing hints, never provider text. */
export interface AppError {
  readonly code: AppErrorCode;
  /** Seconds until a retry can succeed (rate limits, the concurrency lock, the daily budget). */
  readonly retryAfterSec?: number;
  /** When the daily budget resets (ISO 8601, UTC). */
  readonly resetAt?: string;
}

export const isAppErrorCode = (value: unknown): value is AppErrorCode =>
  typeof value === 'string' && Object.hasOwn(APP_ERRORS, value);

export const errorSpec = (code: AppErrorCode): ErrorSpec => APP_ERRORS[code];
