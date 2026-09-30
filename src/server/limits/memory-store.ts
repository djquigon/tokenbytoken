// In-memory limits store for local development and tests. Same semantics as the Redis Lua scripts, but
// instances share nothing, so it is refused on Vercel deployments (see runtime.ts).

import 'server-only';

import {
  admissionKeys,
  DAY_KEY_TTL_SEC,
  MINUTE_KEY_TTL_SEC,
  rejectionTiming,
  type AdmitRequest,
  type AdmitResult,
  type LimitsPolicy,
  type LimitsStore,
  type SettleRequest,
} from './store';

interface Entry {
  value: number | string;
  expiresAt: number;
}

export class MemoryLimitsStore implements LimitsStore {
  readonly kind = 'memory';
  private readonly data = new Map<string, Entry>();

  private live(key: string, nowMs: number): Entry | undefined {
    const e = this.data.get(key);
    if (e && e.expiresAt <= nowMs) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private num(key: string, nowMs: number): number {
    const v = this.live(key, nowMs)?.value;
    return typeof v === 'number' ? v : 0;
  }

  private incrBy(key: string, by: number, ttlSec: number, nowMs: number): number {
    const e = this.live(key, nowMs);
    const value = (typeof e?.value === 'number' ? e.value : 0) + by;
    this.data.set(key, { value, expiresAt: e ? e.expiresAt : nowMs + ttlSec * 1000 });
    return value;
  }

  async admit(req: AdmitRequest, policy: LimitsPolicy): Promise<AdmitResult> {
    const now = req.nowMs;
    const keys = admissionKeys(req);
    const lock = this.live(keys.lock, now);
    if (lock) return { ok: false, reason: 'concurrent_request', retryAfterSec: Math.max(1, Math.ceil((lock.expiresAt - now) / 1000)) };
    this.data.set(keys.lock, { value: req.requestId, expiresAt: now + policy.lockTtlMs });
    const reject = (reason: 'rate_limited' | 'daily_budget_exhausted', scope: string): AdmitResult => {
      this.data.delete(keys.lock);
      const timing = rejectionTiming(scope, now);
      return reason === 'rate_limited'
        ? { ok: false, reason, scope: scope as 'ip_minute' | 'session_day' | 'ip_day', retryAfterSec: timing.retryAfterSec }
        : { ok: false, reason, scope: scope as 'global' | 'ip', retryAfterSec: timing.retryAfterSec, resetAt: timing.resetAt ?? '' };
    };
    if (this.incrBy(keys.ipMinute, 1, MINUTE_KEY_TTL_SEC, now) > policy.ipPerMinute) return reject('rate_limited', 'ip_minute');
    if (this.incrBy(keys.sessionDay, 1, DAY_KEY_TTL_SEC, now) > policy.sessionPerDay) return reject('rate_limited', 'session_day');
    if (this.incrBy(keys.ipDay, 1, DAY_KEY_TTL_SEC, now) > policy.ipPerDay) return reject('rate_limited', 'ip_day');
    const reserve = req.reserveMicroUsd;
    if (this.incrBy(keys.budgetGlobal, reserve, DAY_KEY_TTL_SEC, now) > policy.dailyBudgetMicroUsd) {
      this.incrBy(keys.budgetGlobal, -reserve, DAY_KEY_TTL_SEC, now);
      return reject('daily_budget_exhausted', 'global');
    }
    if (this.incrBy(keys.budgetIp, reserve, DAY_KEY_TTL_SEC, now) > policy.ipDailyBudgetMicroUsd) {
      this.incrBy(keys.budgetIp, -reserve, DAY_KEY_TTL_SEC, now);
      this.incrBy(keys.budgetGlobal, -reserve, DAY_KEY_TTL_SEC, now);
      return reject('daily_budget_exhausted', 'ip');
    }
    this.data.set(keys.reservation, { value: reserve, expiresAt: now + policy.reservationTtlSec * 1000 });
    return { ok: true, keys };
  }

  async settle(req: SettleRequest): Promise<{ settled: boolean }> {
    const now = req.nowMs;
    if (!this.live(req.keys.reservation, now)) return { settled: false };
    this.data.delete(req.keys.reservation);
    const refund = req.reservedMicroUsd - req.actualMicroUsd;
    if (refund !== 0) {
      this.incrBy(req.keys.budgetGlobal, -refund, DAY_KEY_TTL_SEC, now);
      this.incrBy(req.keys.budgetIp, -refund, DAY_KEY_TTL_SEC, now);
    }
    if (this.live(req.keys.lock, now)?.value === req.requestId) this.data.delete(req.keys.lock);
    return { settled: true };
  }

  /** For tests: the day's charged total. */
  charged(key: string, nowMs: number): number {
    return this.num(key, nowMs);
  }
}
