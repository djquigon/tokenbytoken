// Contrast checks for the design tokens (CLAUDE.md §8: text ≥ 4.5:1, UI components ≥ 3:1), in both themes.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/styles/tokens.css', 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`no block for ${selector}`);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1] ?? '', m[2] ?? '']));
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['text', 'text-muted', 'recorded', 'calculated', 'reference', 'example', 'danger'];
const BACKGROUNDS = ['bg', 'bg-raised', 'surface', 'surface-2', 'token-a', 'token-b'];
const UI = ['border-strong', 'focus'];

describe.each([
  ['dark', ':root[data-theme="dark"]'],
  ['light', ':root[data-theme="light"]'],
])('%s theme', (_name, selector) => {
  const t = tokens(selector);

  it.each(TEXT)('%s text is readable on every background (≥ 4.5:1)', (fg) => {
    for (const bg of BACKGROUNDS) {
      const ratio = contrast(t[fg] ?? '', t[bg] ?? '');
      expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(UI)('%s stands out from the page (≥ 3:1)', (ui) => {
    for (const bg of ['bg', 'surface', 'surface-2']) {
      expect(contrast(t[ui] ?? '', t[bg] ?? ''), `${ui} on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps body text pale rather than neon in the dark theme', () => {
    if (_name !== 'dark') return;
    // Body text and the phosphor accent must differ, so long passages never use saturated green.
    expect(t.text).not.toBe(t.accent);
  });
});
