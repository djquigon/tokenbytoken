// The playback state machine (docs/PLAN.md §3.5): pure, hand-written, and returning its side effects as
// data instead of performing them. The clock drives it with `tick` events; everything else is the viewer.

import type { Speed } from '@/components/prefs/store';

import type { ChapterId, PlaybackScript } from './types';

export type PauseReason = 'user' | 'moment' | 'hidden';

export interface PlaybackState {
  readonly status: 'ready' | 'playing' | 'paused' | 'ended';
  readonly pauseReason: PauseReason | null;
  readonly step: number;
  /** 0 to 1 within the current step. */
  readonly progress: number;
  readonly speed: Speed;
  /** Reduced motion: discrete steps, and the clock never runs (CLAUDE.md §8). */
  readonly stepMode: boolean;
}

export type PlaybackEvent =
  | { readonly type: 'play' }
  | { readonly type: 'pause'; readonly reason?: PauseReason }
  | { readonly type: 'toggle' }
  | { readonly type: 'next' }
  | { readonly type: 'prev' }
  | { readonly type: 'nextChapter' }
  | { readonly type: 'prevChapter' }
  | { readonly type: 'seek'; readonly step: number }
  | { readonly type: 'seekChapter'; readonly chapter: ChapterId }
  | { readonly type: 'tick'; readonly dtMs: number }
  | { readonly type: 'speed'; readonly speed: Speed }
  | { readonly type: 'stepMode'; readonly on: boolean }
  | { readonly type: 'hidden' }
  | { readonly type: 'replay' }
  | { readonly type: 'skip' };

export type Effect = { readonly type: 'startClock' } | { readonly type: 'stopClock' } | { readonly type: 'ended' };

export interface Transition {
  readonly state: PlaybackState;
  readonly effects: readonly Effect[];
}

/** The offer shows the Hook complete (a static card); Play then plays it from its start. */
export const initialState = (speed: Speed, stepMode: boolean): PlaybackState => ({
  status: 'ready',
  pauseReason: null,
  step: 0,
  progress: 1,
  speed,
  stepMode,
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function reduce(state: PlaybackState, event: PlaybackEvent, script: PlaybackScript): Transition {
  const last = script.steps.length - 1;
  // Moving while stopped shows the step complete (nothing is animating to reveal it); while playing, the
  // step plays from its start.
  const at = (step: number, progress = state.stepMode || state.status !== 'playing' ? 1 : 0): PlaybackState => ({
    ...state,
    step: clamp(step, 0, Math.max(0, last)),
    progress,
  });
  const stop = (next: PlaybackState): Transition => ({ state: next, effects: state.status === 'playing' ? [{ type: 'stopClock' }] : [] });
  const paused = (next: PlaybackState, reason: PauseReason = 'user'): PlaybackState => ({ ...next, status: 'paused', pauseReason: reason });
  const ended = (): Transition => ({
    state: { ...state, status: 'ended', pauseReason: null, step: Math.max(0, last), progress: 1 },
    effects: [...(state.status === 'playing' ? [{ type: 'stopClock' } as const] : []), { type: 'ended' }],
  });
  const keepStatus = (next: PlaybackState): Transition =>
    state.status === 'playing' ? { state: next, effects: [] } : { state: state.status === 'ended' ? paused(next) : next, effects: [] };

  if (last < 0) return { state, effects: [] };

  switch (event.type) {
    case 'play': {
      // In step mode the clock never runs; "play" moves one step.
      if (state.stepMode) return reduce(state, { type: 'next' }, script);
      if (state.status === 'playing') return { state, effects: [] };
      const start = (from: PlaybackState): Transition => ({
        state: { ...from, status: 'playing', pauseReason: null },
        effects: [{ type: 'startClock' }],
      });
      if (state.status === 'ended') return start(at(0, 0));
      // Paused at the end of a close-call moment: carry on with the next step.
      if (state.progress >= 1 && state.pauseReason === 'moment') return state.step >= last ? ended() : start(at(state.step + 1, 0));
      // Showing a finished step after moving there: play it from its start.
      if (state.progress >= 1) return start({ ...state, progress: 0 });
      return start(state);
    }
    case 'pause':
      return state.status === 'playing' ? stop(paused(state, event.reason)) : { state, effects: [] };
    case 'toggle':
      return reduce(state, state.status === 'playing' ? { type: 'pause' } : { type: 'play' }, script);
    case 'hidden':
      return state.status === 'playing' ? stop(paused(state, 'hidden')) : { state, effects: [] };
    case 'next':
      if (state.step >= last) return ended();
      return keepStatus(at(state.step + 1));
    case 'prev':
      return keepStatus(at(state.step - 1));
    case 'seek':
      return keepStatus(at(event.step));
    case 'nextChapter': {
      const next = script.chapters.find((c) => c.first > state.step);
      return next ? keepStatus(at(next.first)) : ended();
    }
    case 'prevChapter': {
      const current = script.chapters.findIndex((c) => state.step >= c.first && state.step <= c.last);
      const chapter = script.chapters[current];
      // Like a music player: back goes to the chapter's start, or to the previous chapter from its start.
      const target = chapter && state.step > chapter.first ? chapter : script.chapters[Math.max(0, current - 1)];
      return keepStatus(at(target?.first ?? 0));
    }
    case 'seekChapter': {
      const chapter = script.chapters.find((c) => c.id === event.chapter);
      return chapter ? keepStatus(at(chapter.first)) : { state, effects: [] };
    }
    case 'speed':
      return { state: { ...state, speed: event.speed }, effects: [] };
    case 'stepMode':
      if (event.on === state.stepMode) return { state, effects: [] };
      return event.on
        ? stop({ ...(state.status === 'playing' ? paused(state) : state), stepMode: true, progress: 1 })
        : { state: { ...state, stepMode: false }, effects: [] };
    case 'replay':
      if (state.stepMode) return { state: { ...at(0), status: 'paused', pauseReason: 'user' }, effects: state.status === 'playing' ? [{ type: 'stopClock' }] : [] };
      return { state: { ...at(0, 0), status: 'playing', pauseReason: null }, effects: state.status === 'playing' ? [] : [{ type: 'startClock' }] };
    case 'skip':
      return ended();
    case 'tick': {
      if (state.status !== 'playing') return { state, effects: [] };
      let { step, progress } = state;
      let remaining = Math.max(0, event.dtMs) * state.speed;
      for (;;) {
        const current = script.steps[step];
        if (!current) return ended();
        const duration = Math.max(1, current.durationMs);
        const left = (1 - progress) * duration;
        if (remaining < left) {
          progress += remaining / duration;
          return { state: { ...state, step, progress }, effects: [] };
        }
        remaining -= left;
        if (current.autoPause) return stop(paused({ ...state, step, progress: 1 }, 'moment'));
        if (step >= last) return ended();
        step += 1;
        progress = 0;
      }
    }
  }
}
