// The FAQ's structure (ADR 0010): every answer is linkable, rests on registered claims, and lists sources;
// every number in it is a labeled Reference value from faq-facts.ts.

import { describe, expect, it } from 'vitest';

import { CLAIMS } from './claims';
import { FAQ } from './faq';
import { FACTS } from './faq-facts';

const entries = FAQ.flatMap((s) => s.entries);

describe('FAQ', () => {
  it('gives every question a unique anchor', () => {
    const ids = [...FAQ.map((s) => s.id), ...entries.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('bases every answer on registered claims, and lists its sources', () => {
    for (const e of entries) {
      expect(e.claims.length, e.id).toBeGreaterThan(0);
      for (const c of e.claims) expect(CLAIMS[c], `${e.id}: ${c}`).toBeDefined();
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const s of [...e.sources, ...(e.timeline ?? []).map((m) => m.source)]) {
        expect(s.url, e.id).toMatch(/^https:\/\//);
        for (const date of [s.published, s.updated]) if (date !== undefined) expect(date, e.id).toMatch(/^\d{4}(-\d{2}){0,2}$/);
      }
    }
  });

  it('shows numbers only as labeled values', () => {
    // A bare number is a digit that doesn't continue a name, as "4" does in "GPT-4o" or "1" in "R1".
    const bare = /(?<![\p{L}\p{N}-])\p{N}/u;
    for (const e of entries) {
      const prose = [e.short, ...e.answer, ...(e.timeline ?? []).map((m) => m.what)];
      for (const text of [e.question, ...prose.flatMap((t) => t.filter((p) => typeof p === 'string'))]) {
        expect(text, e.id).not.toMatch(bare);
      }
    }
  });

  it('keeps every history in order, each milestone dated', () => {
    for (const e of entries) {
      const whens = (e.timeline ?? []).map((m) => m.when);
      for (const w of whens) expect(w, e.id).toMatch(/^\d{4}(-\d{2}){0,2}$/);
      expect(whens, e.id).toEqual([...whens].sort());
    }
  });

  it('labels every documented number Reference, with its document', () => {
    for (const [name, fact] of Object.entries(FACTS)) {
      expect(fact.p.kind, name).toBe('reference');
      expect(fact.p.kind === 'reference' && fact.p.doc?.url, name).toMatch(/^https:\/\//);
    }
  });

  it('uses every documented number it keeps', () => {
    const prose = (e: (typeof entries)[number]) => [e.short, ...e.answer, ...(e.timeline ?? []).map((m) => m.what)];
    const used = new Set(entries.flatMap((e) => prose(e).flatMap((t) => t.flatMap((p) => (typeof p !== 'string' && p.kind === 'datum' ? [p.d] : [])))));
    for (const [name, fact] of Object.entries(FACTS)) expect(used.has(fact), name).toBe(true);
  });
});
