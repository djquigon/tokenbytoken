// Walkthrough keyboard shortcuts (CLAUDE.md §8, WCAG 2.1.4): active only while the walkthrough has focus,
// and each one can be remapped or all of them turned off. Keys are stored by name ("Space", "k",
// "ArrowRight", "Shift+ArrowRight") in the preferences.

export const SHORTCUT_ACTIONS = ['toggle', 'next', 'prev', 'nextChapter', 'prevChapter', 'first', 'last', 'help'] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];
export type Keymap = Readonly<Record<ShortcutAction, readonly string[]>>;

export const ACTION_LABEL: Readonly<Record<ShortcutAction, string>> = {
  toggle: 'Play or pause',
  next: 'Next step',
  prev: 'Previous step',
  nextChapter: 'Next chapter',
  prevChapter: 'Previous chapter',
  first: 'First step',
  last: 'Last step',
  help: 'Show or hide the shortcut list',
};

export const DEFAULT_KEYS: Keymap = {
  toggle: ['Space', 'k'],
  next: ['ArrowRight'],
  prev: ['ArrowLeft'],
  nextChapter: ['Shift+ArrowRight'],
  prevChapter: ['Shift+ArrowLeft'],
  first: ['Home'],
  last: ['End'],
  help: ['?'],
};

/** Keys that keep their usual job everywhere, so they can't become shortcuts. */
const RESERVED = new Set(['Tab', 'Escape', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'ContextMenu', 'Dead', 'Unidentified']);

interface KeyLike {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/** The stored name of a key press, or null for presses that can't be shortcuts (modifier chords, Tab, Esc…). */
export function keyName(e: KeyLike): string | null {
  if (e.altKey || e.ctrlKey || e.metaKey || RESERVED.has(e.key)) return null;
  if (e.key === ' ') return 'Space';
  // Letters ignore Shift; other printable characters already carry it ("?" is Shift+/).
  if (e.key.length === 1) return /\p{L}/u.test(e.key) ? e.key.toLowerCase() : e.key;
  return e.shiftKey ? `Shift+${e.key}` : e.key;
}

export function actionFor(keymap: Keymap, name: string | null): ShortcutAction | null {
  if (name === null) return null;
  return SHORTCUT_ACTIONS.find((a) => keymap[a].includes(name)) ?? null;
}

const ARROWS: Readonly<Record<string, string>> = { ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓' };

/** How a key name is shown, e.g. "Shift + →". */
export function keyLabel(name: string): string {
  const [first, second] = name.split('+');
  const show = (k: string) => ARROWS[k] ?? (k.length === 1 ? k.toUpperCase() : k);
  return second !== undefined && first === 'Shift' && name !== '+' ? `Shift + ${show(second)}` : show(name);
}

/** Assigns one key to an action, taking it away from any other action that had it. */
export function assignKey(keymap: Keymap, action: ShortcutAction, name: string): { keymap: Keymap; takenFrom: ShortcutAction | null } {
  const takenFrom = SHORTCUT_ACTIONS.find((a) => a !== action && keymap[a].includes(name)) ?? null;
  const next = { ...keymap };
  for (const a of SHORTCUT_ACTIONS) next[a] = a === action ? [name] : keymap[a].filter((k) => k !== name);
  return { keymap: next, takenFrom };
}
