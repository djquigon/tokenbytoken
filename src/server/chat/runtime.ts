// Builds the chat handler from the environment, once per server instance. Anything missing or malformed
// makes the handler fail closed (service_unavailable) instead of calling OpenAI unprotected.

import 'server-only';

import { checkBotId } from 'botid/server';
import { after } from 'next/server';

import { CHAT_CONFIG, DEV_SIGNING_SECRET, onVercelDeployment, readServerEnv, type ServerEnv } from '../config';
import { MemoryLimitsStore } from '../limits/memory-store';
import { RedisLimitsStore, redisFromEnv, upstashRunner } from '../limits/redis-store';
import type { LimitsStore } from '../limits/store';
import { createOpenAIUpstream } from '../openai/adapter';
import type { SigningKeys } from '../signing/signing';
import { o200kTokenizer } from '../tokenizer/local-tokenizer';

import { createChatHandler, type ChatDeps } from './handler';

type Handler = (request: Request) => Promise<Response>;

let handler: Handler | null = null;

/** Everything the handler needs apart from the three configured services. */
function platformDeps(env: ServerEnv, deployed: boolean): Omit<ChatDeps, 'upstream' | 'store' | 'keys'> {
  return {
    tokenizer: o200kTokenizer,
    // BotID can only verify requests on Vercel; elsewhere it runs in development mode (always human).
    botCheck: () => checkBotId(deployed ? undefined : { developmentOptions: { isDevelopment: true, bypass: 'HUMAN' } }),
    after: (task) => after(task),
    nowMs: () => Date.now(),
    monotonicMs: () => performance.now(),
    randomId: () => crypto.randomUUID(),
    log: (entry) => console.log(JSON.stringify(entry)),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function chatHandler(): Handler {
  if (handler) return handler;

  let env: ServerEnv;
  try {
    env = readServerEnv();
  } catch (err) {
    // A malformed variable must neither crash the route nor fall back to defaults.
    console.error(JSON.stringify({ evt: 'chat_config', error: err instanceof Error ? err.message : 'invalid environment' }));
    handler = createChatHandler({ ...platformDeps({}, true), upstream: null, store: null, keys: null });
    return handler;
  }

  const deployed = onVercelDeployment(env);
  const missing: string[] = [];

  // Deployments must have a real secret; local runs fall back to a fixed development one.
  const secret = env.HISTORY_SIGNING_SECRET ?? (deployed ? undefined : DEV_SIGNING_SECRET);
  const keys: SigningKeys | null = secret ? { current: secret, previous: env.HISTORY_SIGNING_SECRET_PREVIOUS ?? null } : null;
  if (!keys) missing.push('HISTORY_SIGNING_SECRET');

  // The in-memory store shares nothing between serverless instances, so deployments need Redis.
  const redis = redisFromEnv(env);
  // Upstash's free tier has one database, shared by Preview and Production: keys are namespaced by environment.
  const namespace = env.VERCEL_ENV ?? 'local';
  let store: LimitsStore | null = null;
  if (env.LIMITS_STORE === 'memory' && !deployed) store = new MemoryLimitsStore();
  else if (redis) store = new RedisLimitsStore(upstashRunner(redis), namespace);
  else if (!deployed && env.LIMITS_STORE !== 'redis') store = new MemoryLimitsStore();
  if (!store) missing.push('Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)');

  const upstream = env.OPENAI_API_KEY ? createOpenAIUpstream(env.OPENAI_API_KEY, { timeoutMs: CHAT_CONFIG.sdkTimeoutMs }) : null;
  if (!upstream) missing.push('OPENAI_API_KEY');

  if (missing.length > 0) console.warn(JSON.stringify({ evt: 'chat_config', missing }));

  handler = createChatHandler({ ...platformDeps(env, deployed), upstream, store, keys });
  return handler;
}
