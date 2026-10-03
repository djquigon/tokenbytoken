import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFS, PREFS_KEY, readChosen } from './store';

const storage = (value: unknown) => ({ getItem: (k: string) => (k === PREFS_KEY ? JSON.stringify(value) : null) });

describe('preferences', () => {
  it('has no autoplay, speed, or navigation shortcut preferences', () => {
    for (const field of ['speed', 'autoplay', 'shortcuts', 'keys']) expect(DEFAULT_PREFS).not.toHaveProperty(field);
  });

  it('keeps supported choices and ignores obsolete playback settings in both formats', () => {
    expect(readChosen(storage({ theme: 'light', speed: 1, depth: 'simple' }))).toEqual({ theme: 'light', depth: 'simple' });
    expect(readChosen(storage({ speed: 2, autoplay: true }))).toEqual({});
    expect(readChosen(storage({ v: 2, speed: 1, autoplay: true, shortcuts: true, keys: {}, motion: 'reduce' }))).toEqual({ motion: 'reduce' });
    expect(readChosen(storage(null))).toEqual({});
    expect(readChosen({ getItem: () => 'not json' })).toEqual({});
  });
});
