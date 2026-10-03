// Manual walkthrough navigation. The clock animates only the current step and never advances it.
import type { ChapterId, PlaybackScript } from './types';

export const STEP_ANIMATION_MS = 1_800;
export interface PlaybackState {
  readonly status: 'active' | 'ended';
  readonly step: number;
  readonly progress: number;
  /** Reduced motion shows each step fully revealed without running the clock. */
  readonly stepMode: boolean;
}
export type PlaybackEvent =
  | { readonly type: 'animate' }
  | { readonly type: 'next' | 'prev' | 'nextChapter' | 'prevChapter' | 'hidden' | 'skip' }
  | { readonly type: 'seek'; readonly step: number }
  | { readonly type: 'seekChapter'; readonly chapter: ChapterId }
  | { readonly type: 'tick'; readonly dtMs: number }
  | { readonly type: 'stepMode'; readonly on: boolean };
export type Effect = { readonly type: 'startClock' | 'stopClock' | 'ended' };
export interface Transition { readonly state: PlaybackState; readonly effects: readonly Effect[] }
export const initialState = (stepMode: boolean): PlaybackState => ({ status: 'active', step: 0, progress: stepMode ? 1 : 0, stepMode });

export function reduce(state: PlaybackState, event: PlaybackEvent, script: PlaybackScript): Transition {
  const last = script.steps.length - 1;
  const unchanged = { state, effects: [] };
  if (last < 0) return unchanged;
  const move = (target: number): Transition => {
    const step = Math.max(0, Math.min(last, target));
    if (step === state.step) return unchanged;
    const ended = step === last;
    return {
      state: { ...state, step, progress: state.stepMode ? 1 : 0, status: ended ? 'ended' : 'active' },
      effects: [{ type: state.stepMode ? 'stopClock' : 'startClock' }, ...(ended ? [{ type: 'ended' } as const] : [])],
    };
  };
  switch (event.type) {
    case 'animate':
      return { state, effects: [{ type: state.stepMode || state.progress >= 1 ? 'stopClock' : 'startClock' }] };
    case 'next': return move(state.step + 1);
    case 'prev': return move(state.step - 1);
    case 'seek': return move(event.step);
    case 'seekChapter': return move(script.chapters.find((c) => c.id === event.chapter)?.first ?? state.step);
    case 'nextChapter': return move(script.chapters.find((c) => c.first > state.step)?.first ?? last);
    case 'prevChapter': {
      const index = script.chapters.findIndex((c) => state.step >= c.first && state.step <= c.last);
      const current = script.chapters[index];
      return move(current && state.step > current.first ? current.first : script.chapters[Math.max(0, index - 1)]?.first ?? 0);
    }
    case 'stepMode':
      return event.on === state.stepMode ? unchanged : {
        state: { ...state, stepMode: event.on, progress: 1 }, effects: [{ type: 'stopClock' }],
      };
    case 'hidden': return { state: { ...state, progress: 1 }, effects: [{ type: 'stopClock' }] };
    case 'skip': return {
      state: { ...state, step: last, status: 'ended', progress: 1 },
      effects: [{ type: 'stopClock' }, ...(state.status === 'ended' ? [] : [{ type: 'ended' } as const])],
    };
    case 'tick': {
      if (state.stepMode || state.progress >= 1) return unchanged;
      const progress = Math.min(1, state.progress + Math.max(0, event.dtMs) / STEP_ANIMATION_MS);
      return { state: { ...state, progress }, effects: progress === 1 ? [{ type: 'stopClock' }] : [] };
    }
  }
}
