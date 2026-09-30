// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_ERRORS, APP_ERROR_CODES } from '@/shared/errors';

import { ErrorNotice } from './ErrorNotice';

afterEach(cleanup);

describe('ErrorNotice', () => {
  it.each(APP_ERROR_CODES)('renders %s with its copy and the action its retry rule allows', (code) => {
    const spec = APP_ERRORS[code];
    render(<ErrorNotice error={{ code, retryAfterSec: 30 }} onRetry={vi.fn()} onClear={vi.fn()} canRetry />);
    const notice = screen.getByRole('alert');
    expect(notice).toHaveProperty('dataset.errorCode', code);
    expect(notice.textContent).toContain(spec.title);
    expect(notice.textContent).toContain(spec.body);

    const buttons = screen.queryAllByRole('button').map((b) => b.textContent);
    switch (spec.retry) {
      case 'now':
      case 'backoff':
      case 'later':
        expect(buttons).toContain('Try again');
        break;
      case 'after':
        expect(buttons).toContain('Try again in 0:30');
        expect(screen.getByRole('button', { name: /Try again in/ })).toHaveProperty('disabled', true);
        break;
      case 'reload':
        expect(buttons).toContain('Reload page');
        break;
      case 'none':
        expect(buttons.filter((b) => b?.startsWith('Try again'))).toEqual([]);
        break;
    }
    if (['invalid_history', 'payload_too_large', 'upstream_context_length'].includes(code)) {
      expect(buttons).toContain('Clear conversation');
    }
  });

  it('offers no retry on turns other than the latest', () => {
    render(<ErrorNotice error={{ code: 'upstream_failed' }} onRetry={vi.fn()} onClear={vi.fn()} canRetry={false} />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows when the daily budget resets', () => {
    render(
      <ErrorNotice
        error={{ code: 'daily_budget_exhausted', retryAfterSec: 3_600, resetAt: '2026-10-01T00:00:00.000Z' }}
        onRetry={vi.fn()}
        onClear={vi.fn()}
        canRetry
      />,
    );
    const time = screen.getByRole('alert').querySelector('time');
    expect(time?.parentElement?.textContent).toMatch(/^It resets at /);
    expect(time?.getAttribute('datetime')).toBe('2026-10-01T00:00:00.000Z');
  });
});
