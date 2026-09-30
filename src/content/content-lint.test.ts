// The content lint (CLAUDE.md §3, "Process"): fails on banned phrasings in anything the site says. It reads
// every string and JSX text in the copy and UI source files, so comments and identifiers don't count.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { claimsMarkdown, CLAIMS, CLAIM_IDS } from './claims';

const ROOT = join(__dirname, '..', '..');

/** Where user-facing words live: copy modules, pages, and UI components. */
const SOURCES = ['src/content', 'src/app', 'src/components', 'src/stages'];

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) return files(rel);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.|\.test-d\./.test(name) ? [rel] : [];
  });
}

/** Every string literal, template part, and JSX text in a file, with its line. */
function texts(rel: string): { text: string; line: number }[] {
  const source = ts.createSourceFile(rel, readFileSync(join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      const text = ts.isJsxText(node) ? node.getText() : node.text;
      if (text.trim()) out.push({ text, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/**
 * The language guide's "avoid" list (CLAUDE.md §3): words that make the model sound like a person, and
 * wordings the accuracy rules forbid (A11, A12). Allowed only where the text corrects the idea.
 */
const BANNED: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\b(the model|it) (thinks|knows|understands|wants|decides|remembers|believes)\b/i, why: 'the model as a person' },
  { pattern: /\bthinking\b/i, why: 'waits and scores are not "thinking" (A5, A6)' },
  { pattern: /\bre-?reads?\b/i, why: 'decoding reuses saved work; it never re-reads (A11)' },
  { pattern: /\bas the model sees it\b/i, why: 'the model as a person' },
  { pattern: /\bprobably wrong\b/i, why: 'low probability is not "wrong" (A12)' },
  { pattern: /\b(the model|it) (decided|chose) to\b/i, why: 'a weighted random pick, not a decision' },
  { pattern: /\bhallucinat/i, why: 'say what happened: a likely wording that is false' },
];

/** Exact phrases that use a banned word to correct the misconception. Keep this list short. */
const ALLOWED = [/doesn['’]t remember/i, /never called “thinking”/i];

describe('content lint', () => {
  const all = SOURCES.flatMap(files).flatMap((rel) => texts(rel).map((t) => ({ ...t, rel })));

  it('reads the copy, and its patterns catch what they should (sanity checks)', () => {
    expect(all.length).toBeGreaterThan(200);
    const caught = (s: string) => BANNED.some((b) => b.pattern.test(s)) && !ALLOWED.some((a) => a.test(s));
    expect(caught('Here the model thinks about your question.')).toBe(true);
    expect(caught('While it decides, the model re-reads everything.')).toBe(true);
    expect(caught('A low score means it is probably wrong.')).toBe(true);
    expect(caught("The model doesn't remember your earlier messages.")).toBe(false);
  });

  it('has no banned phrasings', () => {
    const hits = all.flatMap(({ text, line, rel }) =>
      BANNED.filter((b) => b.pattern.test(text) && !ALLOWED.some((a) => a.test(text))).map((b) => `${rel}:${line} "${text.trim().slice(0, 80)}" (${b.why})`),
    );
    expect(hits).toEqual([]);
  });

  it('keeps every claim in the register phrased by the same rules', () => {
    const hits = CLAIM_IDS.filter((id) => BANNED.some((b) => b.pattern.test(CLAIMS[id].text) && !ALLOWED.some((a) => a.test(CLAIMS[id].text))));
    expect(hits).toEqual([]);
  });
});

describe('claims register', () => {
  it('content/claims.md matches src/content/claims.ts (run npm run claims)', () => {
    expect(readFileSync(join(ROOT, 'content', 'claims.md'), 'utf8').replaceAll('\r\n', '\n')).toBe(claimsMarkdown());
  });

  it('gives every claim a source and a check date', () => {
    for (const id of CLAIM_IDS) {
      expect(CLAIMS[id].sources.length, id).toBeGreaterThan(0);
      expect(CLAIMS[id].checked, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
