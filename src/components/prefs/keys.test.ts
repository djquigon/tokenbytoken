import { describe, expect, it } from 'vitest';

import { actionFor, assignKey, DEFAULT_KEYS, keyLabel, keyName } from './keys';

const press = (key: string, mods: Partial<{ shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }> = {}) => ({
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe('walkthrough shortcuts', () => {
  it('names presses the way the keymap stores them, and refuses chords and reserved keys', () => {
    expect(keyName(press(' '))).toBe('Space');
    expect(keyName(press('K', { shiftKey: true }))).toBe('k');
    expect(keyName(press('?', { shiftKey: true }))).toBe('?');
    expect(keyName(press('ArrowRight', { shiftKey: true }))).toBe('Shift+ArrowRight');
    expect(keyName(press('k', { ctrlKey: true }))).toBeNull();
    expect(keyName(press('Tab'))).toBeNull();
    expect(keyName(press('Escape'))).toBeNull();
  });

  it('maps the defaults to their actions', () => {
    expect(actionFor(DEFAULT_KEYS, 'Space')).toBe('toggle');
    expect(actionFor(DEFAULT_KEYS, 'k')).toBe('toggle');
    expect(actionFor(DEFAULT_KEYS, 'Shift+ArrowLeft')).toBe('prevChapter');
    expect(actionFor(DEFAULT_KEYS, 'x')).toBeNull();
  });

  it('remaps a key, taking it from the action that had it', () => {
    const { keymap, takenFrom } = assignKey(DEFAULT_KEYS, 'next', 'k');
    expect(keymap.next).toEqual(['k']);
    expect(keymap.toggle).toEqual(['Space']);
    expect(takenFrom).toBe('toggle');
    expect(actionFor(keymap, 'ArrowRight')).toBeNull();
  });

  it('labels keys for people', () => {
    expect(keyLabel('Shift+ArrowRight')).toBe('Shift + →');
    expect(keyLabel('k')).toBe('K');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('+')).toBe('+');
  });
});
