'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';

import { prefsStore, type PrefsState } from './store';

export function usePrefs<T>(selector: (s: PrefsState) => T): T {
  return useStore(prefsStore, selector);
}

/** Loads stored preferences once on the client. */
export function useHydratePrefs() {
  useEffect(() => prefsStore.getState().hydrate(), []);
}

function mediaQuery(query: string) {
  return {
    subscribe(onChange: () => void) {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    get: () => window.matchMedia(query).matches,
  };
}

const reducedMotionQuery = mediaQuery('(prefers-reduced-motion: reduce)');
const moreContrastQuery = mediaQuery('(prefers-contrast: more)');

export function useMediaQuery(q: ReturnType<typeof mediaQuery>): boolean {
  return useSyncExternalStore(q.subscribe, q.get, () => false);
}

/** Reduced motion from the OS setting unless the in-app control overrides it (CLAUDE.md §8). */
export function useReducedMotion(): boolean {
  const system = useMediaQuery(reducedMotionQuery);
  const motion = usePrefs((s) => s.motion);
  return motion === 'reduce' || (motion === 'system' && system);
}

/** Visual effects are off under reduced motion, more contrast, or the Effects toggle. */
export function useEffectsEnabled(): boolean {
  const reduced = useReducedMotion();
  const moreContrast = useMediaQuery(moreContrastQuery);
  const effects = usePrefs((s) => s.effects);
  return effects && !reduced && !moreContrast;
}
