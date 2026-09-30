'use client';

// One notice per AppErrorCode: fixed copy, plus the action its retry rule allows. Raw provider text is
// never shown (CLAUDE.md §6).

import { useEffect, useState } from 'react';

import { APP_ERRORS, type AppError } from '@/shared/errors';

const CLEAR_CODES = new Set(['invalid_history', 'payload_too_large', 'upstream_context_length']);

function useCountdown(seconds: number | undefined): number {
  const [left, setLeft] = useState(seconds ?? 0);
  useEffect(() => {
    if (!seconds) return;
    const endAt = Date.now() + seconds * 1_000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1_000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function ErrorNotice({
  error,
  onRetry,
  onClear,
  canRetry,
}: {
  error: AppError;
  onRetry: () => void;
  onClear: () => void;
  canRetry: boolean;
}) {
  const spec = APP_ERRORS[error.code];
  const left = useCountdown(spec.retry === 'after' ? error.retryAfterSec : undefined);
  const resetAt = error.resetAt ? new Date(error.resetAt) : null;

  return (
    <div className="notice notice-error" role="alert" data-error-code={error.code}>
      <p className="notice-title">{spec.title}</p>
      <p>{spec.body}</p>
      {resetAt && !Number.isNaN(resetAt.getTime()) ? (
        <p>
          It resets at <time dateTime={resetAt.toISOString()}>{resetAt.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</time>.
        </p>
      ) : null}
      <div className="notice-actions">
        {CLEAR_CODES.has(error.code) ? (
          <button type="button" className="btn" onClick={onClear}>
            Clear conversation
          </button>
        ) : null}
        {spec.retry === 'reload' ? (
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        ) : null}
        {canRetry && (spec.retry === 'now' || spec.retry === 'backoff' || spec.retry === 'later' || spec.retry === 'after') ? (
          <button type="button" className="btn" onClick={onRetry} disabled={spec.retry === 'after' && left > 0}>
            {spec.retry === 'after' && left > 0 ? (
              <>
                Try again in <span role="timer">{clock(left)}</span>
              </>
            ) : (
              'Try again'
            )}
          </button>
        ) : null}
      </div>
      {canRetry && spec.retry !== 'none' && spec.retry !== 'reload' ? (
        <p className="notice-hint">Trying again sends a new request, so the reply may differ.</p>
      ) : null}
    </div>
  );
}
