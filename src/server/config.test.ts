import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { REQUEST_LIMITS } from '@/shared/limits';
import { referenceValuesSchema } from '@/shared/protocol/v1';

import { APP_LIMITS, CHAT_CONFIG, INSTRUCTIONS, LIMITS_CONFIG, REFERENCE, onVercelDeployment, readServerEnv } from './config';

describe('server config', () => {
  it('treats empty variables as unset and rejects malformed ones', () => {
    expect(readServerEnv({ OPENAI_API_KEY: '', KV_REST_API_URL: '' })).toEqual({});
    expect(() => readServerEnv({ KV_REST_API_URL: 'not a url' })).toThrow(/KV_REST_API_URL/);
    expect(() => readServerEnv({ HISTORY_SIGNING_SECRET: 'too-short' })).toThrow(/HISTORY_SIGNING_SECRET/);
  });

  it('knows a Vercel deployment from local runs', () => {
    expect(onVercelDeployment({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe(true);
    expect(onVercelDeployment({ VERCEL: '1', VERCEL_ENV: 'preview' })).toBe(true);
    expect(onVercelDeployment({ VERCEL: '1', VERCEL_ENV: 'development' })).toBe(false);
    expect(onVercelDeployment({})).toBe(false);
  });

  it('keeps the route’s maxDuration in step with the config', () => {
    const route = readFileSync('src/app/api/chat/route.ts', 'utf8');
    expect(route).toMatch(new RegExp(`export const maxDuration = ${CHAT_CONFIG.maxDurationSec};`));
    expect(LIMITS_CONFIG.lockTtlMs).toBeGreaterThan(CHAT_CONFIG.maxDurationSec * 1_000);
  });

  it('echoes valid reference values, each with a source', () => {
    expect(referenceValuesSchema.safeParse(REFERENCE).success).toBe(true);
    expect(APP_LIMITS.maxMessageChars).toBe(REQUEST_LIMITS.maxMessageChars);
    expect(CHAT_CONFIG.inputBudgetTokens + CHAT_CONFIG.maxOutputTokens).toBeLessThan(REFERENCE.contextWindowTokens.value);
  });

  it('keeps the public instructions short (they are sent with every request)', () => {
    expect(INSTRUCTIONS.length).toBeLessThan(600);
  });
});
