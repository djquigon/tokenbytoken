import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFS, PREFS_KEY, readChosen } from './store';

const storage = (value: unknown) => ({ getItem: (k: string) => (k === PREFS_KEY ? JSON.stringify(value) : null) });

describe('preferences', () => {
  it('plays the walkthrough at half speed by default', () => {
    expect(DEFAULT_PREFS.speed).toBe(0.5);
  });

  it('keeps only chosen settings, and treats a stored 1× from the old format as the old default', () => {
    // Format 1 stored every setting, so its speed of 1 wasn't a choice; its theme is kept.
    expect(readChosen(storage({ theme: 'light', speed: 1, depth: 'simple' }))).toEqual({ theme: 'light', depth: 'simple' });
    // A different speed in the old format was a choice.
    expect(readChosen(storage({ speed: 2 }))).toEqual({ speed: 2 });
    // In the new format, 1× is a choice.
    expect(readChosen(storage({ v: 2, speed: 1 }))).toEqual({ speed: 1 });
    expect(readChosen(storage(null))).toEqual({});
    expect(readChosen({ getItem: () => 'not json' })).toEqual({});
  });
});
