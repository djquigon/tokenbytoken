// The playback controller: runs the machine, performs its effects, and publishes two streams.
// - Snapshots change only when the step or status changes, so React renders once per step.
// - Progress is published every frame to listeners that write a CSS variable (`--p`), never to React.

import { createClock, type ClockDeps } from './clock';
import { initialState, reduce, type PlaybackEvent, type PlaybackState } from './machine';
import type { PlaybackScript } from './types';

export interface PlaybackSnapshot {
  readonly status: PlaybackState['status'];
  readonly step: number;
  readonly stepMode: boolean;
  readonly script: PlaybackScript;
}

export interface PlaybackController {
  getSnapshot(): PlaybackSnapshot;
  subscribe(listener: () => void): () => void;
  getProgress(): number;
  subscribeProgress(listener: (progress: number) => void): () => void;
  dispatch(event: PlaybackEvent): void;
  /** Swap in a recompiled script (e.g. a depth change), keeping the viewer's place by step key. */
  replaceScript(script: PlaybackScript): void;
  destroy(): void;
}

export interface ControllerOptions {
  readonly script: PlaybackScript;
  readonly stepMode: boolean;
  readonly clock: ClockDeps;
  readonly onEnded?: () => void;
  readonly onStepChange?: (step: number) => void;
}

export function createPlaybackController(options: ControllerOptions): PlaybackController {
  let script = options.script;
  let state = initialState(options.stepMode);
  let snapshot = toSnapshot(state, script);
  const listeners = new Set<() => void>();
  const progressListeners = new Set<(p: number) => void>();

  const clock = createClock(options.clock, (dtMs) => dispatch({ type: 'tick', dtMs }));

  function toSnapshot(s: PlaybackState, sc: PlaybackScript): PlaybackSnapshot {
    return { status: s.status, step: s.step, stepMode: s.stepMode, script: sc };
  }

  function publish(prev: PlaybackState) {
    if (
      prev.status !== state.status ||
      prev.step !== state.step ||
      prev.stepMode !== state.stepMode ||
      snapshot.script !== script
    ) {
      snapshot = toSnapshot(state, script);
      if (prev.step !== state.step) options.onStepChange?.(state.step);
      for (const l of listeners) l();
    }
    if (prev.progress !== state.progress || prev.step !== state.step) {
      for (const l of progressListeners) l(state.progress);
    }
  }

  function dispatch(event: PlaybackEvent) {
    const prev = state;
    const { state: next, effects } = reduce(state, event, script);
    state = next;
    for (const effect of effects) {
      if (effect.type === 'startClock') clock.start();
      else if (effect.type === 'stopClock') clock.stop();
    }
    publish(prev);
    if (effects.some((e) => e.type === 'ended')) options.onEnded?.();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getProgress: () => state.progress,
    subscribeProgress(listener) {
      progressListeners.add(listener);
      return () => progressListeners.delete(listener);
    },
    dispatch,
    replaceScript(next) {
      const prev = state;
      const key = script.steps[state.step]?.key;
      const same = key === undefined ? -1 : next.steps.findIndex((s) => s.key === key);
      // Fall back to the start of the same chapter, then to the start.
      const chapter = script.steps[state.step]?.chapter;
      const fallback = next.chapters.find((c) => c.id === chapter)?.first ?? 0;
      const step = same >= 0 ? same : fallback;
      script = next;
      state = { ...state, step, progress: same >= 0 ? state.progress : state.stepMode ? 1 : 0 };
      if (same < 0 && !state.stepMode) clock.start();
      publish(prev);
    },
    destroy() {
      clock.stop();
      listeners.clear();
      progressListeners.clear();
    },
  };
}
