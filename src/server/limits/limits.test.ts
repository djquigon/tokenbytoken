// One contract suite, two implementations: the in-memory store, and the production Lua scripts running
// in a real Lua VM over a fake Redis (src/test/fake-redis.ts).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FakeRedis, luaRunner } from '@/test/fake-redis';

import { MemoryLimitsStore } from './memory-store';
import { RedisLimitsStore } from './redis-store';
import { admissionKeys, type LimitsPolicy, type LimitsStore } from './store';

const policy: LimitsPolicy = {
  sessionPerDay: 1_000,
  ipPerMinute: 1_000,
  ipPerDay: 10_000,
  dailyBudgetMicroUsd: 10_000,
  ipDailyBudgetMicroUsd: 10_000,
  lockTtlMs: 75_000,
  reservationTtlSec: 172_800,
};

const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
const req = (i: number, over: Partial<{ session: string; ip: string; reserve: number; now: number }> = {}) => ({
  requestId: `req-${i}`,
  sessionKey: over.session ?? `s${i}`,
  ipKey: over.ip ?? 'ip1',
  reserveMicroUsd: over.reserve ?? 1_000,
  nowMs: over.now ?? NOW,
});

interface Harness {
  readonly store: LimitsStore;
  charged(key: string, nowMs: number): number;
  /** Moves the store's own clock (Redis expiry), where it has one. */
  at(nowMs: number): void;
  close(): void;
}

const implementations: [name: string, make: () => Promise<Harness>, runs: { property: number; day: number }][] = [
  [
    'memory',
    async () => {
      const store = new MemoryLimitsStore();
      return { store, charged: (k, n) => store.charged(k, n), at: () => undefined, close: () => undefined };
    },
    { property: 100, day: 20 },
  ],
  [
    'redis (production Lua scripts)',
    async () => {
      const fake = new FakeRedis();
      fake.now = NOW;
      const runner = await luaRunner(fake);
      return { store: new RedisLimitsStore(runner), charged: (k) => fake.number(k), at: (ms) => void (fake.now = ms), close: () => runner.close() };
    },
    { property: 25, day: 3 },
  ],
];

describe.each(implementations)('%s limits store', (_name, make, runs) => {
  it('allows one stream per session at a time, and says how long the lock has left', async () => {
    const { store, at, close } = await make();
    expect((await store.admit(req(1, { session: 'a' }), policy)).ok).toBe(true);
    at(NOW + 15_000);
    expect(await store.admit(req(2, { session: 'a', now: NOW + 15_000 }), policy)).toEqual({ ok: false, reason: 'concurrent_request', retryAfterSec: 60 });
    await store.settle({ requestId: 'req-1', keys: admissionKeys(req(1, { session: 'a' })), reservedMicroUsd: 1_000, actualMicroUsd: 10, nowMs: NOW });
    expect((await store.admit(req(3, { session: 'a' }), policy)).ok).toBe(true);
    close();
  });

  it('frees a lock left by a crashed request once it expires', async () => {
    const { store, at, close } = await make();
    expect((await store.admit(req(1, { session: 'a' }), policy)).ok).toBe(true);
    at(NOW + policy.lockTtlMs + 1);
    expect((await store.admit(req(2, { session: 'a', now: NOW + policy.lockTtlMs + 1 }), policy)).ok).toBe(true);
    close();
  });

  it('rate-limits per IP per minute and resets in the next minute', async () => {
    const { store, close } = await make();
    const tight = { ...policy, ipPerMinute: 2 };
    for (const i of [1, 2]) {
      const r = await store.admit(req(i), tight);
      expect(r.ok).toBe(true);
      if (r.ok) await store.settle({ requestId: `req-${i}`, keys: r.keys, reservedMicroUsd: 1_000, actualMicroUsd: 1_000, nowMs: NOW });
    }
    expect(await store.admit(req(3), tight)).toEqual({ ok: false, reason: 'rate_limited', scope: 'ip_minute', retryAfterSec: 60 });
    expect((await store.admit(req(4, { now: NOW + 60_000 }), tight)).ok).toBe(true);
    close();
  });

  it('limits each session per day, separately from its IP', async () => {
    const { store, close } = await make();
    const oneADay = { ...policy, sessionPerDay: 1 };
    const first = await store.admit(req(1, { session: 'a' }), oneADay);
    if (!first.ok) throw new Error('expected admission');
    await store.settle({ requestId: 'req-1', keys: first.keys, reservedMicroUsd: 1_000, actualMicroUsd: 5, nowMs: NOW });
    expect(await store.admit(req(2, { session: 'a' }), oneADay)).toMatchObject({ ok: false, reason: 'rate_limited', scope: 'session_day' });
    // Another tab on the same IP is unaffected.
    expect((await store.admit(req(3, { session: 'b' }), oneADay)).ok).toBe(true);
    close();
  });

  it('stops admitting when the daily budget is used up, and says when it resets', async () => {
    const { store, close } = await make();
    const small = { ...policy, dailyBudgetMicroUsd: 2_500 };
    expect((await store.admit(req(1), small)).ok).toBe(true);
    expect((await store.admit(req(2), small)).ok).toBe(true);
    expect(await store.admit(req(3), small)).toEqual({
      ok: false,
      reason: 'daily_budget_exhausted',
      scope: 'global',
      resetAt: '2026-10-01T00:00:00.000Z',
      retryAfterSec: 12 * 3600,
    });
    // The rejected request left no reservation behind, and its session isn't locked.
    expect((await store.admit(req(4, { session: 's3', reserve: 400 }), small)).ok).toBe(true);
    close();
  });

  it('caps one IP at its share of the day, leaving the rest for others', async () => {
    const { store, charged, close } = await make();
    const shares = { ...policy, dailyBudgetMicroUsd: 10_000, ipDailyBudgetMicroUsd: 2_000 };
    expect((await store.admit(req(1, { ip: 'x' }), shares)).ok).toBe(true);
    expect((await store.admit(req(2, { ip: 'x' }), shares)).ok).toBe(true);
    expect(await store.admit(req(3, { ip: 'x' }), shares)).toMatchObject({ ok: false, reason: 'daily_budget_exhausted', scope: 'ip' });
    expect(charged(admissionKeys(req(0)).budgetGlobal, NOW)).toBe(2_000);
    expect((await store.admit(req(4, { ip: 'y' }), shares)).ok).toBe(true);
    close();
  });

  it('settles once, refunds the unused reservation, and charges extra if the reply cost more', async () => {
    const { store, charged, close } = await make();
    const a = await store.admit(req(1), policy);
    const b = await store.admit(req(2), policy);
    if (!a.ok || !b.ok) throw new Error('expected admission');
    const settleA = { requestId: 'req-1', keys: a.keys, reservedMicroUsd: 1_000, actualMicroUsd: 300, nowMs: NOW };
    expect(await store.settle(settleA)).toEqual({ settled: true });
    expect(await store.settle(settleA)).toEqual({ settled: false });
    await store.settle({ requestId: 'req-2', keys: b.keys, reservedMicroUsd: 1_000, actualMicroUsd: 1_100, nowMs: NOW });
    expect(charged(a.keys.budgetGlobal, NOW)).toBe(1_400);
    expect(charged(a.keys.budgetIp, NOW)).toBe(1_400);
    close();
  });

  it('never lets concurrent reservations exceed the cap', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ reserve: fc.integer({ min: 1, max: 3_000 }), session: fc.nat(5), settleTo: fc.option(fc.nat(3_000)) }), {
          minLength: 1,
          maxLength: 40,
        }),
        fc.scheduler(),
        async (requests, scheduler) => {
          const { store, charged, close } = await make();
          const cap = { ...policy, dailyBudgetMicroUsd: 8_000, ipDailyBudgetMicroUsd: 8_000 };
          const tasks = requests.map((r, i) =>
            scheduler.schedule(store.admit(req(i, { session: `s${r.session}-${i}`, reserve: r.reserve }), cap)).then(async (res) => {
              if (!res.ok || r.settleTo === null) return;
              // A settled request never costs more than it reserved in this test.
              const actual = Math.min(r.settleTo, r.reserve);
              await scheduler.schedule(
                store.settle({ requestId: `req-${i}`, keys: res.keys, reservedMicroUsd: r.reserve, actualMicroUsd: actual, nowMs: NOW }),
              );
            }),
          );
          await scheduler.waitAll();
          await Promise.all(tasks);
          expect(charged(admissionKeys(req(0)).budgetGlobal, NOW)).toBeLessThanOrEqual(8_000);
          close();
        },
      ),
      { numRuns: runs.property },
    );
  });

  it('simulates a busy day with aborts and crashes without exceeding the cap by more than one request', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 2 ** 31 - 1 }), async (seed) => {
        // A small deterministic PRNG so the property can explore many "days".
        let state = seed;
        const rand = () => {
          state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
          return state / 2 ** 31;
        };
        const { store, at, close } = await make();
        const day = { ...policy, dailyBudgetMicroUsd: 550_000, ipDailyBudgetMicroUsd: 550_000 };
        const maxRequest = 1_100; // worst case reserve for one request (≈ 6k input + 604 output tokens)
        let charged = 0;
        for (let i = 0; i < 1_500; i += 1) {
          const reserve = Math.ceil(300 + rand() * (maxRequest - 300));
          const now = Math.min(NOW + i * 25_000, NOW + 11 * 3600_000);
          at(now);
          const r = await store.admit(req(i, { session: `s${i}`, ip: `ip${i % 20}`, reserve, now }), day);
          if (!r.ok) continue;
          const kind = rand();
          if (kind < 0.05) {
            charged += reserve; // crash: never settled, stays charged in full
            continue;
          }
          // Aborted: an estimate. Completed: usage, occasionally a little over the reservation.
          const actual = kind < 0.2 ? Math.ceil(reserve * (0.3 + rand() * 0.5)) : Math.ceil(reserve * (0.2 + rand() * 0.82));
          await store.settle({ requestId: `req-${i}`, keys: r.keys, reservedMicroUsd: reserve, actualMicroUsd: actual, nowMs: now });
          charged += actual;
        }
        expect(charged).toBeLessThanOrEqual(day.dailyBudgetMicroUsd + maxRequest);
        close();
      }),
      { numRuns: runs.day },
    );
  });
});
