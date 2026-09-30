// Conversation persistence in sessionStorage (CLAUDE.md §10): tab-scoped, validated on restore, and
// capped. Only raw TraceLogs and message text are stored; facts are recomputed. When space runs out,
// the oldest turns keep their text but lose their logs, and the UI says they can't be replayed.

import { z } from 'zod';

import { traceLogSchema, type TraceLogV1 } from '@/trace/log';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CONVERSATION_KEY = 'tbt:conversation:v1';
export const PRIVACY_KEY = 'tbt:privacy-notice:v1';
/** Full logs are kept for this many recent turns. */
export const MAX_STORED_LOGS = 8;

export interface StoredTurn {
  readonly id: string;
  readonly user: { readonly id: string; readonly content: string };
  readonly assistant: { readonly id: string; readonly content: string; readonly sig: string | null } | null;
  readonly log: TraceLogV1 | null;
}

export interface StoredConversation {
  readonly v: 1;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly turns: readonly StoredTurn[];
}

const storedSchema = z.object({
  v: z.literal(1),
  sessionId: z.string(),
  conversationId: z.string(),
  turns: z.array(
    z.object({
      id: z.string(),
      user: z.object({ id: z.string(), content: z.string() }),
      assistant: z.object({ id: z.string(), content: z.string(), sig: z.string().nullable() }).nullable(),
      log: traceLogSchema.nullable(),
    }),
  ),
});

export function loadConversation(storage: KeyValueStorage | null): StoredConversation | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CONVERSATION_KEY);
    if (!raw) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Saves, dropping the oldest logs as needed. Returns how many turns lost their logs. */
export function saveConversation(storage: KeyValueStorage | null, conversation: StoredConversation): { droppedLogs: number } {
  if (!storage) return { droppedLogs: 0 };
  const turns = [...conversation.turns];
  let keepLogs = Math.min(MAX_STORED_LOGS, turns.length);
  for (;;) {
    const cut = turns.length - keepLogs;
    const trimmed = turns.map((t, i) => (i < cut ? { ...t, log: null } : t));
    try {
      storage.setItem(CONVERSATION_KEY, JSON.stringify({ ...conversation, turns: trimmed }));
      return { droppedLogs: trimmed.filter((t, i) => t.log === null && conversation.turns[i]?.log !== null).length };
    } catch {
      if (keepLogs === 0) {
        try {
          storage.removeItem(CONVERSATION_KEY);
        } catch {
          // storage unavailable
        }
        return { droppedLogs: turns.length };
      }
      keepLogs -= 1;
    }
  }
}

export function clearConversation(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(CONVERSATION_KEY);
  } catch {
    // storage unavailable
  }
}

/** Browser storage can be missing or throw (private windows, blocked site data). */
export function safeStorage(kind: 'session' | 'local'): KeyValueStorage | null {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    const probe = '__tbt_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
