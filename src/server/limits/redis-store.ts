// Upstash Redis limits store. Each step is one Lua script, so admission is atomic across serverless
// instances. Upstash bills every Redis command inside a script, so the scripts stay short (about 10
// commands to admit and 5 to settle).

import 'server-only';

import { Redis } from '@upstash/redis';

/** Runs a Lua script atomically. Upstash in production; a Lua VM over a fake Redis in tests. */
export interface ScriptRunner {
  exec(script: string, keys: string[], args: string[]): Promise<unknown>;
}

/** EVALSHA first, falling back to EVAL (the SDK's Script helper), one cached Script per source. */
export function upstashRunner(redis: Redis): ScriptRunner {
  const scripts = new Map<string, ReturnType<Redis['createScript']>>();
  return {
    exec(script, keys, args) {
      let s = scripts.get(script);
      if (!s) {
        s = redis.createScript(script);
        scripts.set(script, s);
      }
      return s.exec(keys, args);
    },
  };
}

import {
  DAY_KEY_TTL_SEC,
  MINUTE_KEY_TTL_SEC,
  admissionKeys,
  rejectionTiming,
  type AdmitRequest,
  type AdmitResult,
  type LimitsPolicy,
  type LimitsStore,
  type SettleRequest,
} from './store';

// KEYS: 1 lock, 2 session-day, 3 ip-minute, 4 ip-day, 5 budget-global, 6 budget-ip, 7 reservation
// ARGV: 1 requestId, 2 lockTtlMs, 3 sessionPerDay, 4 ipPerMinute, 5 ipPerDay, 6 minuteTtlSec, 7 dayTtlSec,
//       8 reserve, 9 globalCap, 10 ipCap, 11 reservationTtlSec
export const ADMIT_LUA = `
if not redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then
  return {'concurrent_request', 'session', redis.call('PTTL', KEYS[1])}
end
local function bump(key, ttl)
  local v = redis.call('INCR', key)
  if v == 1 then redis.call('EXPIRE', key, ttl) end
  return v
end
local function reject(reason, scope)
  redis.call('DEL', KEYS[1])
  return {reason, scope, 0}
end
if bump(KEYS[3], ARGV[6]) > tonumber(ARGV[4]) then return reject('rate_limited', 'ip_minute') end
if bump(KEYS[2], ARGV[7]) > tonumber(ARGV[3]) then return reject('rate_limited', 'session_day') end
if bump(KEYS[4], ARGV[7]) > tonumber(ARGV[5]) then return reject('rate_limited', 'ip_day') end
local reserve = tonumber(ARGV[8])
local g = redis.call('INCRBY', KEYS[5], reserve)
if g == reserve then redis.call('EXPIRE', KEYS[5], ARGV[7]) end
if g > tonumber(ARGV[9]) then
  redis.call('DECRBY', KEYS[5], reserve)
  return reject('daily_budget_exhausted', 'global')
end
local i = redis.call('INCRBY', KEYS[6], reserve)
if i == reserve then redis.call('EXPIRE', KEYS[6], ARGV[7]) end
if i > tonumber(ARGV[10]) then
  redis.call('DECRBY', KEYS[6], reserve)
  redis.call('DECRBY', KEYS[5], reserve)
  return reject('daily_budget_exhausted', 'ip')
end
redis.call('SET', KEYS[7], reserve, 'EX', ARGV[11])
return {'ok', '', 0}
`;

// KEYS: 1 reservation, 2 budget-global, 3 budget-ip, 4 lock
// ARGV: 1 reserved, 2 actual, 3 requestId
export const SETTLE_LUA = `
if redis.call('DEL', KEYS[1]) == 0 then return 0 end
local refund = tonumber(ARGV[1]) - tonumber(ARGV[2])
if refund ~= 0 then
  redis.call('DECRBY', KEYS[2], refund)
  redis.call('DECRBY', KEYS[3], refund)
end
if redis.call('GET', KEYS[4]) == ARGV[3] then redis.call('DEL', KEYS[4]) end
return 1
`;

export class RedisLimitsStore implements LimitsStore {
  readonly kind = 'redis';

  constructor(private readonly runner: ScriptRunner) {}

  async admit(req: AdmitRequest, policy: LimitsPolicy): Promise<AdmitResult> {
    const keys = admissionKeys(req);
    const result = await this.runner.exec(
      ADMIT_LUA,
      [keys.lock, keys.sessionDay, keys.ipMinute, keys.ipDay, keys.budgetGlobal, keys.budgetIp, keys.reservation],
      [
        req.requestId,
        String(policy.lockTtlMs),
        String(policy.sessionPerDay),
        String(policy.ipPerMinute),
        String(policy.ipPerDay),
        String(MINUTE_KEY_TTL_SEC),
        String(DAY_KEY_TTL_SEC),
        String(req.reserveMicroUsd),
        String(policy.dailyBudgetMicroUsd),
        String(policy.ipDailyBudgetMicroUsd),
        String(policy.reservationTtlSec),
      ],
    );
    if (!Array.isArray(result)) throw new Error('unexpected admission result');
    const [reason, scope, pttl] = result as [unknown, unknown, unknown];
    if (reason === 'ok') return { ok: true, keys };
    if (reason === 'concurrent_request') {
      return { ok: false, reason, retryAfterSec: Math.max(1, Math.ceil(Number(pttl) / 1000)) };
    }
    const timing = rejectionTiming(String(scope), req.nowMs);
    if (reason === 'rate_limited' && (scope === 'ip_minute' || scope === 'session_day' || scope === 'ip_day')) {
      return { ok: false, reason, scope, retryAfterSec: timing.retryAfterSec };
    }
    if (reason === 'daily_budget_exhausted' && (scope === 'global' || scope === 'ip')) {
      return { ok: false, reason, scope, retryAfterSec: timing.retryAfterSec, resetAt: timing.resetAt ?? '' };
    }
    throw new Error(`unexpected admission result: ${String(reason)}`);
  }

  async settle(req: SettleRequest): Promise<{ settled: boolean }> {
    const result = await this.runner.exec(
      SETTLE_LUA,
      [req.keys.reservation, req.keys.budgetGlobal, req.keys.budgetIp, req.keys.lock],
      [String(req.reservedMicroUsd), String(req.actualMicroUsd), req.requestId],
    );
    return { settled: Number(result) === 1 };
  }
}

/** Reads the Upstash variables under either naming scheme (Upstash console or Vercel Marketplace). */
export function redisFromEnv(env: {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
}): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  // No automatic JSON parsing: script results are plain strings and numbers.
  return new Redis({ url, token, automaticDeserialization: false, retry: { retries: 1 } });
}
