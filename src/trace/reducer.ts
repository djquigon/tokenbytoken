// The live view of a turn while it streams: a cheap incremental fold for the chat bubble. The labeled
// facts come from finalizeTrace once the turn ends.

import type { AppError } from '@/shared/errors';
import type { EndEventV1, StartEventV1 } from '@/shared/protocol/v1';

import { TERMINAL_KINDS, type EntryKind, type TraceLogEntry, type TraceLogV1 } from './log';

export type LivePhase = 'sending' | 'waiting' | 'streaming' | 'done';

export interface LiveTurnState {
  readonly phase: LivePhase;
  readonly text: string;
  readonly refusal: string;
  readonly deltas: number;
  readonly tokens: number;
  readonly start: StartEventV1 | null;
  readonly end: EndEventV1 | null;
  /** The first terminal entry, if any. */
  readonly terminal: EntryKind | null;
  /** A pre-stream rejection or an in-band failure. */
  readonly error: AppError | null;
}

export const initialLiveState: LiveTurnState = {
  phase: 'sending',
  text: '',
  refusal: '',
  deltas: 0,
  tokens: 0,
  start: null,
  end: null,
  terminal: null,
  error: null,
};

export function reduceLive(state: LiveTurnState, entry: TraceLogEntry): LiveTurnState {
  if (state.terminal !== null) return state;
  if (TERMINAL_KINDS.has(entry.k)) {
    return {
      ...state,
      phase: 'done',
      terminal: entry.k,
      error: entry.k === 'http_error' ? (entry.error ?? { code: 'service_unavailable' }) : state.error,
    };
  }
  if (entry.k !== 'server') return entry.k === 'http_ok' ? { ...state, phase: 'waiting' } : state;
  const ev = entry.ev;
  switch (ev.type) {
    case 'start':
      return { ...state, phase: state.phase === 'streaming' ? 'streaming' : 'waiting', start: ev };
    case 'delta':
      return ev.channel === 'text'
        ? { ...state, phase: 'streaming', text: state.text + ev.text, deltas: state.deltas + 1, tokens: state.tokens + (ev.logprobs?.length ?? 0) }
        : { ...state, phase: 'streaming', refusal: state.refusal + ev.text, deltas: state.deltas + 1 };
    case 'end':
      return { ...state, phase: 'done', end: ev, error: ev.error ?? state.error };
    default:
      return state;
  }
}

export const foldLive = (log: TraceLogV1): LiveTurnState => log.entries.reduce(reduceLive, initialLiveState);
