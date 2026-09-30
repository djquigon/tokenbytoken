import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatValue } from './format';

describe('formatValue', () => {
  it('never shows a chance as certain either way, even when rounding computes 0 or 100', () => {
    expect(formatValue('pct', 100)).toBe('>99.99%');
    expect(formatValue('pct', 99.999)).toBe('>99.99%');
    expect(formatValue('pct', 99.96)).toBe('99.96%');
    expect(formatValue('pct', 99.949)).toBe('99.94%');
    expect(formatValue('pct', 74.12)).toBe('74.1%');
    expect(formatValue('pct', 3.18)).toBe('3.18%');
    expect(formatValue('pct', 0.004)).toBe('<0.01%');
    expect(formatValue('pct', 0)).toBe('<0.01%');
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (v) => {
        const shown = formatValue('pct', v);
        expect(shown).not.toMatch(/^100(\.0+)?%$/);
        expect(shown).not.toMatch(/^0(\.0+)?%$/);
      }),
    );
  });

  it('formats the other kinds', () => {
    expect(formatValue('int', 12345)).toBe('12,345');
    expect(formatValue('ms', 216.4)).toBe('216 ms');
    expect(formatValue('ms', 1234)).toBe('1.23 s');
    expect(formatValue('usd', 0.000025)).toBe('$0.000025');
    expect(formatValue('token', ' the\n')).toBe('␣the↵');
    expect(formatValue('list', [])).toBe('none');
    expect(formatValue('bool', false)).toBe('no');
    expect(formatValue('date', Date.UTC(2026, 8, 30, 15, 4))).toBe('2026-09-30');
  });
});
