// The conversation: turns, their TraceLogs, and the actions the chat UI offers. A Zustand vanilla store,
// so it is testable without React. Streamed entries are appended at once but published at most once per
// animation frame (CLAUDE.md §9).

import { createStore, type StoreApi } from 'zustand/vanilla';

import { REQUEST_LIMITS } from '@/shared/limits';
import type { ChatRequestV1, RequestMessageV1 } from '@/shared/protocol/v1';
import { utf8Length } from '@/shared/utf8';
import type { ClientMs } from '@/shared/units';
import type { FinalizedTrace } from '@/trace/facts';
import { finalizeTrace } from '@/trace/finalize';
import { appendEntry, createLog, isTerminated, TERMINAL_KINDS, type TraceLogEntry, type TraceLogV1 } from '@/trace/log';
import { foldLive, initialLiveState, reduceLive, type LiveTurnState } from '@/trace/reducer';

import type { sendTurn as SendTurn } from './client';
import {
  CONVERSATION_KEY,
  PRIVACY_KEY,
  clearConversation,
  loadConversation,
  saveConversation,
  type KeyValueStorage,
  type StoredConversation,
} from './persist';

/** Bump when the privacy notice changes, so visitors see the new version. */
export const PRIVACY_VERSION = '2026-10-02';

/**
 * Runs before first paint (in the root layout). The chat page's privacy notice and empty-chat text are
 * rendered on the server, so they show without waiting for scripts; this marks what the browser has
 * already stored, so CSS can hide them at once for visitors who don't need them. React takes over after
 * hydration (and removes the marks). Only a substring check: the stored conversation isn't parsed here.
 */
export const CHAT_PRELOAD_SCRIPT = `(function(){try{var d=document.documentElement.dataset;if(localStorage.getItem(${JSON.stringify(PRIVACY_KEY)})===${JSON.stringify(PRIVACY_VERSION)})d.privacy="accepted";var c=sessionStorage.getItem(${JSON.stringify(CONVERSATION_KEY)});if(c&&c.indexOf('"turns":[{')>=0)d.conversation="yes";}catch(e){}})();`;

function announce(turn: Turn): string {
  if (turn.live.terminal === 'user_abort') return 'Reply stopped.';
  if (turn.live.error || turn.live.terminal === 'http_error') return 'The reply ran into a problem.';
  return 'Reply finished.';
}

export interface Turn {
  readonly id: string;
  readonly user: { readonly id: string; readonly content: string };
  /** Null when the log was dropped from storage to save space: the text remains, replay doesn't. */
  readonly log: TraceLogV1 | null;
  readonly live: LiveTurnState;
  readonly assistant: { readonly id: string; readonly content: string; readonly sig: string | null } | null;
  readonly done: boolean;
}

export interface ConversationState {
  readonly hydrated: boolean;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly turns: readonly Turn[];
  readonly streaming: boolean;
  /** Set when older turns lost their logs to storage limits. */
  readonly storageNote: string | null;
  /** Null until hydrated. */
  readonly privacyAccepted: boolean | null;
  /** One polite screen-reader announcement per finished reply (CLAUDE.md §8). */
  readonly announcement: string;
}

export interface ConversationActions {
  hydrate(): void;
  acceptPrivacy(): void;
  send(text: string): Promise<void>;
  stop(): void;
  retryLast(): Promise<void>;
  clear(): void;
}

export type ConversationStore = StoreApi<ConversationState & ConversationActions>;

export interface StoreDeps {
  readonly sendTurn: typeof SendTurn;
  readonly now: () => ClientMs;
  readonly randomId: () => string;
  readonly storage: KeyValueStorage | null;
  /** Longer-lived storage for the privacy-notice acknowledgment. */
  readonly preferences: KeyValueStorage | null;
  readonly idleTimeoutMs: number;
  readonly scheduleFlush: (flush: () => void) => void;
  /**
   * Load storage while creating the store, so it starts hydrated. Only for storage that exists on the
   * server too (the recorded sample): React reads a store's initial state during server rendering.
   */
  readonly hydrateAtCreation?: boolean;
}

/** Keep requests well under the server's body limit; the server trims by tokens as well. */
const HISTORY_BYTE_BUDGET = Math.floor(REQUEST_LIMITS.maxBodyBytes * 0.75);

const newId = (deps: StoreDeps, prefix: string) => `${prefix}_${deps.randomId().replaceAll('-', '')}`;

const traces = new WeakMap<TraceLogV1, FinalizedTrace>();

/** The labeled facts of a turn, computed once per log. */
export function traceOf(turn: Turn): FinalizedTrace | null {
  if (!turn.log || !turn.done) return null;
  let trace = traces.get(turn.log);
  if (!trace) {
    trace = finalizeTrace(turn.log);
    traces.set(turn.log, trace);
  }
  return trace;
}

const wasRejected = (turn: Turn) => turn.live.terminal === 'http_error';

function readPreference(storage: KeyValueStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** History to send: whole turns, newest first until the byte budget or message cap is reached. */
export function historyFor(turns: readonly Turn[]): RequestMessageV1[] {
  const out: RequestMessageV1[][] = [];
  let bytes = 0;
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const t = turns[i];
    if (!t || !t.done || wasRejected(t)) continue;
    const msgs: RequestMessageV1[] = [{ role: 'user', id: t.user.id, content: t.user.content }];
    if (t.assistant?.sig && t.assistant.content) {
      msgs.push({ role: 'assistant', id: t.assistant.id, content: t.assistant.content, sig: t.assistant.sig });
    }
    const size = msgs.reduce((n, m) => n + utf8Length(m.content) + 200, 0);
    if (count + msgs.length > REQUEST_LIMITS.maxMessages - 1 || bytes + size > HISTORY_BYTE_BUDGET) break;
    out.unshift(msgs);
    bytes += size;
    count += msgs.length;
  }
  return out.flat();
}

function finishTurn(turn: Turn): Turn {
  const trace = turn.log ? finalizeTrace(turn.log) : null;
  if (trace && turn.log) traces.set(turn.log, trace);
  const content = turn.live.text || turn.live.refusal;
  const assistant =
    trace?.assistant.messageId && content ? { id: trace.assistant.messageId, content, sig: trace.assistant.sig } : null;
  return { ...turn, assistant, done: true };
}

function toStored(state: ConversationState): StoredConversation {
  return {
    v: 1,
    sessionId: state.sessionId,
    conversationId: state.conversationId,
    turns: state.turns.filter((t) => t.done).map((t) => ({ id: t.id, user: t.user, assistant: t.assistant, log: t.log })),
  };
}

/** The state that loading storage produces (the whole of hydrate()). */
function loadedState(deps: StoreDeps): Partial<ConversationState> {
  const stored = loadConversation(deps.storage);
  const turns: Turn[] = (stored?.turns ?? []).map((t) => {
    // A log without an ending means the page was reloaded mid-stream.
    const log = t.log && !isTerminated(t.log) ? appendEntry(t.log, { k: 'recovered', tc: deps.now() }) : t.log;
    const live = log ? foldLive(log) : { ...initialLiveState, phase: 'done' as const, text: t.assistant?.content ?? '' };
    return { id: t.id, user: t.user, log, live, assistant: t.assistant, done: true };
  });
  return {
    hydrated: true,
    sessionId: stored?.sessionId ?? newId(deps, 'ses'),
    conversationId: stored?.conversationId ?? newId(deps, 'cnv'),
    turns,
    storageNote: turns.some((t) => t.log === null) ? 'Some earlier replies can no longer be inspected in this tab.' : null,
    privacyAccepted: readPreference(deps.preferences, PRIVACY_KEY) === PRIVACY_VERSION,
  };
}

export function createConversationStore(deps: StoreDeps): ConversationStore {
  let controller: AbortController | null = null;

  return createStore<ConversationState & ConversationActions>()((set, get) => {
    const persist = () => {
      const { droppedLogs } = saveConversation(deps.storage, toStored(get()));
      if (droppedLogs > 0) {
        set({ storageNote: 'To save space in this tab, some earlier replies can no longer be inspected.' });
      }
    };

    const run = async (text: string) => {
      const state = get();
      if (state.streaming || text.trim().length === 0) return;
      const userId = newId(deps, 'msg');
      const turnId = newId(deps, 'req');
      const request: ChatRequestV1 = {
        v: 1,
        clientRequestId: turnId,
        sessionId: state.sessionId,
        conversationId: state.conversationId,
        messages: [...historyFor(state.turns), { role: 'user', id: userId, content: text }],
        options: { logprobs: true },
      };
      let working: Turn = {
        id: turnId,
        user: { id: userId, content: text },
        log: createLog(turnId, state.conversationId, userId),
        live: initialLiveState,
        assistant: null,
        done: false,
      };
      set({ turns: [...state.turns, working], streaming: true });
      const runController = new AbortController();
      controller = runController;
      const isCurrent = () => controller === runController;
      let flushScheduled = false;
      const flush = () => {
        flushScheduled = false;
        if (!isCurrent()) return;
        const current = working;
        set((s) => ({ turns: s.turns.map((t) => (t.id === current.id ? current : t)) }));
      };

      const onEntry = (entry: TraceLogEntry) => {
        if (!isCurrent() || !working.log || isTerminated(working.log)) return;
        working = { ...working, log: appendEntry(working.log, entry), live: reduceLive(working.live, entry) };
        if (TERMINAL_KINDS.has(entry.k)) {
          working = finishTurn(working);
          flush();
          set({ announcement: announce(working) });
          return;
        }
        if (!flushScheduled) {
          flushScheduled = true;
          deps.scheduleFlush(flush);
        }
      };

      try {
        await deps.sendTurn({ request, signal: runController.signal, idleTimeoutMs: deps.idleTimeoutMs, now: deps.now, onEntry });
      } finally {
        // sendTurn always ends with a terminal entry; this guards against a thrown bug.
        if (isCurrent()) {
          if (!working.done) onEntry({ k: 'network_error', tc: deps.now() });
          controller = null;
          set({ streaming: false });
          persist();
        }
      }
    };

    return {
      hydrated: false,
      sessionId: '',
      conversationId: '',
      turns: [],
      streaming: false,
      storageNote: null,
      privacyAccepted: null,
      announcement: '',
      ...(deps.hydrateAtCreation ? loadedState(deps) : {}),

      hydrate() {
        if (get().hydrated) return;
        set(loadedState(deps));
      },

      acceptPrivacy() {
        try {
          deps.preferences?.setItem(PRIVACY_KEY, PRIVACY_VERSION);
        } catch {
          // storage unavailable: accepted for this page view only
        }
        set({ privacyAccepted: true });
      },

      send: (text) => run(text),

      stop() {
        controller?.abort();
      },

      async retryLast() {
        const state = get();
        const last = state.turns.at(-1);
        if (state.streaming || !last || !last.done) return;
        set({ turns: state.turns.slice(0, -1) });
        await run(last.user.content);
      },

      clear() {
        const previous = controller;
        controller = null;
        previous?.abort();
        clearConversation(deps.storage);
        set({ turns: [], conversationId: newId(deps, 'cnv'), storageNote: null, streaming: false, announcement: 'Conversation cleared.' });
      },
    };
  });
}
