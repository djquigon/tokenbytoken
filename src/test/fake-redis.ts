// A fake Redis for running the production Lua scripts in tests, through a real Lua VM (wasmoon). It
// implements only the commands the scripts use, with Redis's reply conventions: a nil reply is Lua
// `false`, a status reply is a table with an `ok` field.

import { LuaFactory } from 'wasmoon';

import type { ScriptRunner } from '@/server/limits/redis-store';

interface Entry {
  value: string;
  expiresAt: number | null;
}

export class FakeRedis {
  /** The fake's clock in milliseconds, for PX/EX expiry. */
  now = 0;
  private readonly data = new Map<string, Entry>();

  private entry(key: string): Entry | undefined {
    const e = this.data.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= this.now) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private incrBy(key: string, by: number): number {
    const e = this.entry(key);
    const current = e ? Number(e.value) : 0;
    if (!Number.isInteger(current)) throw new Error('ERR value is not an integer or out of range');
    const next = current + by;
    this.data.set(key, { value: String(next), expiresAt: e?.expiresAt ?? null });
    return next;
  }

  call(command: string, ...rawArgs: unknown[]): unknown {
    const args = rawArgs.map(String);
    const key = args[0] ?? '';
    switch (command.toUpperCase()) {
      case 'GET':
        return this.entry(key)?.value ?? false;
      case 'SET': {
        const options = args.slice(2).map((a) => a.toUpperCase());
        if (options.includes('NX') && this.entry(key)) return false;
        const px = options.indexOf('PX');
        const ex = options.indexOf('EX');
        const ttlMs = px >= 0 ? Number(args[px + 3]) : ex >= 0 ? Number(args[ex + 3]) * 1000 : null;
        this.data.set(key, { value: args[1] ?? '', expiresAt: ttlMs === null ? null : this.now + ttlMs });
        return { ok: 'OK' };
      }
      case 'DEL':
        return args.reduce((n, k) => (this.entry(k) ? (this.data.delete(k), n + 1) : n), 0);
      case 'INCR':
        return this.incrBy(key, 1);
      case 'INCRBY':
        return this.incrBy(key, Number(args[1]));
      case 'DECRBY':
        return this.incrBy(key, -Number(args[1]));
      case 'EXPIRE': {
        const e = this.entry(key);
        if (!e) return 0;
        e.expiresAt = this.now + Number(args[1]) * 1000;
        return 1;
      }
      case 'PTTL': {
        const e = this.entry(key);
        if (!e) return -2;
        return e.expiresAt === null ? -1 : e.expiresAt - this.now;
      }
      default:
        throw new Error(`FakeRedis: unsupported command ${command}`);
    }
  }

  number(key: string): number {
    const v = this.entry(key)?.value;
    return v === undefined ? 0 : Number(v);
  }
}

/**
 * Runs scripts one at a time, as Redis does, so each script is atomic. Each script is compiled once, as
 * the body of a function taking KEYS and ARGV.
 */
export async function luaRunner(redis: FakeRedis): Promise<ScriptRunner & { close(): void }> {
  const lua = await new LuaFactory().createEngine();
  lua.global.set('redis', { call: (...args: unknown[]) => redis.call(String(args[0]), ...args.slice(1)) });
  const compiled = new Map<string, (keys: string[], args: string[]) => unknown>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    exec(script, keys, args) {
      const run = async () => {
        let fn = compiled.get(script);
        if (!fn) {
          fn = (await lua.doString(`return function(KEYS, ARGV)\n${script}\nend`)) as (keys: string[], args: string[]) => unknown;
          compiled.set(script, fn);
        }
        return fn(keys, args);
      };
      const result = queue.then(run, run);
      queue = result.catch(() => undefined);
      return result;
    },
    close: () => lua.global.close(),
  };
}
