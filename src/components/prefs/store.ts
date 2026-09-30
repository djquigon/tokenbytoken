// Viewer preferences: theme, effects, motion, walkthrough depth and speed, shortcuts. Stored in this
// browser only (localStorage), validated on load, and mirrored onto <html> as data attributes so CSS can
// react before React hydrates (see THEME_INIT_SCRIPT).

import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

export const PREFS_KEY = 'tbt:prefs:v1';

export const DEPTHS = ['simple', 'detailed', 'technical'] as const;
export const SPEEDS = [0.5, 1, 2, 4] as const;

const prefsSchema = z.object({
  theme: z.enum(['dark', 'light']).catch('dark'),
  effects: z.boolean().catch(true),
  /** "system" follows prefers-reduced-motion; the others override it. */
  motion: z.enum(['system', 'reduce', 'full']).catch('system'),
  depth: z.enum(DEPTHS).catch('simple'),
  speed: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(4)]).catch(1),
  /** The walkthrough is offered, never started automatically, unless the viewer opts in. */
  autoplay: z.boolean().catch(false),
  shortcuts: z.boolean().catch(true),
  liveStrip: z.boolean().catch(true),
});

export type Preferences = z.infer<typeof prefsSchema>;
export type Depth = Preferences['depth'];
export type Speed = Preferences['speed'];

export const DEFAULT_PREFS: Preferences = prefsSchema.parse({});

function readStored(): Preferences {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? prefsSchema.parse({ ...DEFAULT_PREFS, ...JSON.parse(raw) }) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function apply(p: Preferences) {
  const d = document.documentElement.dataset;
  d.theme = p.theme;
  d.effects = p.effects ? 'on' : 'off';
  d.motion = p.motion;
}

export interface PrefsState extends Preferences {
  readonly hydrated: boolean;
  hydrate(): void;
  set(patch: Partial<Preferences>): void;
}

export const prefsStore = createStore<PrefsState>()((set, get) => ({
  ...DEFAULT_PREFS,
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    const stored = readStored();
    set({ ...stored, hydrated: true });
    apply(stored);
  },
  set(patch) {
    const next = prefsSchema.parse({ ...pick(get()), ...patch });
    set(next);
    apply(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the choice lasts for this page view
    }
  },
}));

function pick(s: PrefsState): Preferences {
  const { theme, effects, motion, depth, speed, autoplay, shortcuts, liveStrip } = s;
  return { theme, effects, motion, depth, speed, autoplay, shortcuts, liveStrip };
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme. Kept tiny and defensive:
 * unknown or malformed values fall back to the defaults.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");var d=document.documentElement.dataset;d.theme=p.theme==="light"?"light":"dark";d.effects=p.effects===false?"off":"on";d.motion=p.motion==="reduce"||p.motion==="full"?p.motion:"system";}catch(e){}})();`;
