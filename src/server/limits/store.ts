// The limits store (ADR 0002): rate limits, the one-stream-per-session lock, and the micro-dollar budget
// ledger, admitted atomically in one step and settled once after the reply ends.
//
// Budget accounting: admission reserves the worst-case cost of a request against the global and per-IP
// daily totals; settlement refunds the difference once the actual (or estimated) cost is known. A request
// that never settles (the function crashed) stays charged in full, so a crash can't overspend.

import 'server-only';

export interface LimitsPolicy {
  readonly sessionPerDay: number;
  readonly ipPerMinute: number;
  readonly ipPerDay: number;
  readonly dailyBudgetMicroUsd: number;
  readonly ipDailyBudgetMicroUsd: number;
  readonly lockTtlMs: number;
  readonly reservationTtlSec: number;
}

export interface AdmitRequest {
  readonly requestId: string;
  /** Hashed; raw session IDs and IPs never reach the store. */
  readonly sessionKey: string;
  readonly ipKey: string;
  readonly reserveMicroUsd: number;
  readonly nowMs: number;
}

export interface AdmissionKeys {
  readonly lock: string;
  readonly sessionDay: string;
  readonly ipMinute: string;
  readonly ipDay: string;
  readonly budgetGlobal: string;
  readonly budgetIp: string;
  readonly reservation: string;
}

export type AdmitResult =
  | { readonly ok: true; readonly keys: AdmissionKeys }
  | { readonly ok: false; readonly reason: 'concurrent_request'; readonly retryAfterSec: number }
  | {
      readonly ok: false;
      readonly reason: 'rate_limited';
      readonly scope: 'ip_minute' | 'session_day' | 'ip_day';
      readonly retryAfterSec: number;
    }
  | {
      readonly ok: false;
      readonly reason: 'daily_budget_exhausted';
      readonly scope: 'global' | 'ip';
      readonly retryAfterSec: number;
      readonly resetAt: string;
    };

export interface SettleRequest {
  readonly requestId: string;
  readonly keys: AdmissionKeys;
  readonly reservedMicroUsd: number;
  readonly actualMicroUsd: number;
  readonly nowMs: number;
}

export interface LimitsStore {
  readonly kind: 'memory' | 'redis';
  admit(req: AdmitRequest, policy: LimitsPolicy): Promise<AdmitResult>;
  /** Idempotent: settling the same request twice changes nothing. Also releases the lock. */
  settle(req: SettleRequest): Promise<{ settled: boolean }>;
}

export const utcDay = (nowMs: number) => new Date(nowMs).toISOString().slice(0, 10);

export const nextUtcMidnight = (nowMs: number) => {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

export const secondsUntil = (targetMs: number, nowMs: number) => Math.max(1, Math.ceil((targetMs - nowMs) / 1000));

export function admissionKeys(req: Pick<AdmitRequest, 'requestId' | 'sessionKey' | 'ipKey' | 'nowMs'>): AdmissionKeys {
  const day = utcDay(req.nowMs);
  const minute = Math.floor(req.nowMs / 60_000);
  return {
    lock: `tbt:lock:s:${req.sessionKey}`,
    sessionDay: `tbt:rl:s:${req.sessionKey}:d:${day}`,
    ipMinute: `tbt:rl:i:${req.ipKey}:m:${minute}`,
    ipDay: `tbt:rl:i:${req.ipKey}:d:${day}`,
    budgetGlobal: `tbt:budget:g:${day}`,
    budgetIp: `tbt:budget:i:${req.ipKey}:${day}`,
    reservation: `tbt:res:${req.requestId}`,
  };
}

/** Timing hints for a rejection, shared by both store implementations. */
export function rejectionTiming(scope: string, nowMs: number): { retryAfterSec: number; resetAt?: string } {
  if (scope === 'ip_minute') return { retryAfterSec: secondsUntil((Math.floor(nowMs / 60_000) + 1) * 60_000, nowMs) };
  const midnight = nextUtcMidnight(nowMs);
  return { retryAfterSec: secondsUntil(midnight, nowMs), resetAt: new Date(midnight).toISOString() };
}

export const MINUTE_KEY_TTL_SEC = 120;
export const DAY_KEY_TTL_SEC = 2 * 24 * 60 * 60;
