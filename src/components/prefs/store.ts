// Viewer preferences: theme, effects, motion, walkthrough depth and speed, shortcuts. Stored in this
// browser only (localStorage), validated on load, and mirrored onto <html> as data attributes so CSS can
// react before React hydrates (see THEME_INIT_SCRIPT).
//
// Only the settings a viewer actually chose are stored, so a changed default reaches everyone who never
// picked that setting.

import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

import { DEFAULT_KEYS, SHORTCUT_ACTIONS, type Keymap } from './keys';

export const PREFS_KEY = 'tbt:prefs:v1';

export const DEPTHS = ['simple', 'detailed', 'technical'] as const;
export const SPEEDS = [0.5, 1, 2, 4] as const;

const prefsSchema = z.object({
  theme: z.enum(['dark', 'light']).catch('dark'),
  effects: z.boolean().catch(true),
  /** "system" follows prefers-reduced-motion; the others override it. */
  motion: z.enum(['system', 'reduce', 'full']).catch('system'),
  depth: z.enum(DEPTHS).catch('simple'),
  /** Half speed by default (owner, 2026-09-30): full speed felt too fast to follow. */
  speed: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(4)]).catch(0.5),
  /** The walkthrough is offered, never started automatically, unless the viewer opts in. */
  autoplay: z.boolean().catch(false),
  shortcuts: z.boolean().catch(true),
  /** Remapped shortcut keys (WCAG 2.1.4); any malformed map falls back to the defaults. */
  keys: z
    .record(z.enum(SHORTCUT_ACTIONS), z.array(z.string().min(1).max(24)).max(3))
    .catch(DEFAULT_KEYS as Record<(typeof SHORTCUT_ACTIONS)[number], string[]>)
    .transform((k) => k as Keymap),
  liveStrip: z.boolean().catch(true),
  /** The first-visit tour of the chat page, once seen or skipped. */
  tourSeen: z.boolean().catch(false),
});

export type Preferences = z.infer<typeof prefsSchema>;
export type Depth = Preferences['depth'];
export type Speed = Preferences['speed'];

export const DEFAULT_PREFS: Preferences = prefsSchema.parse({});

const FIELDS = Object.keys(prefsSchema.shape) as (keyof Preferences)[];
/** The stored format: 2 keeps only chosen settings; format 1 (no marker) stored every setting. */
const FORMAT = 2;

/** The settings this viewer chose, read from storage and validated one by one. */
export function readChosen(storage: Pick<Storage, 'getItem'>): Partial<Preferences> {
  try {
    const raw = JSON.parse(storage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;
    const chosen: Record<string, unknown> = {};
    for (const key of FIELDS) {
      if (!(key in raw)) continue;
      const parsed = prefsSchema.shape[key].safeParse(raw[key]);
      if (parsed.success) chosen[key] = parsed.data;
    }
    // Format 1 stored every setting, so a speed of 1 there was the old default, not a choice.
    if (raw.v !== FORMAT && chosen.speed === 1) delete chosen.speed;
    return chosen as Partial<Preferences>;
  } catch {
    return {};
  }
}

function apply(p: Preferences) {
  const d = document.documentElement.dataset;
  d.theme = p.theme;
  d.effects = p.effects ? 'on' : 'off';
  d.motion = p.motion;
  d.tour = p.tourSeen ? 'seen' : 'new';
}

export interface PrefsState extends Preferences {
  readonly hydrated: boolean;
  hydrate(): void;
  set(patch: Partial<Preferences>): void;
}

/** What this viewer chose; kept in memory too, so choices last the page view when storage is unavailable. */
let chosen: Partial<Preferences> = {};

export const prefsStore = createStore<PrefsState>()((set, get) => ({
  ...DEFAULT_PREFS,
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    try {
      chosen = readChosen(window.localStorage);
    } catch {
      chosen = {};
    }
    const prefs = prefsSchema.parse(chosen);
    set({ ...prefs, hydrated: true });
    apply(prefs);
  },
  set(patch) {
    chosen = { ...chosen, ...patch };
    const next = prefsSchema.parse(chosen);
    set(next);
    apply(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ v: FORMAT, ...chosen }));
    } catch {
      // storage unavailable: the choice lasts for this page view
    }
  },
}));

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme. Kept tiny and defensive:
 * unknown or malformed values fall back to the defaults.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}");var d=document.documentElement.dataset;d.theme=p.theme==="light"?"light":"dark";d.effects=p.effects===false?"off":"on";d.motion=p.motion==="reduce"||p.motion==="full"?p.motion:"system";d.tour=p.tourSeen===true?"seen":"new";}catch(e){}})();`;
