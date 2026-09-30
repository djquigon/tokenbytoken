// Text for labels (CLAUDE.md L6): every label also exists as words, for badges, accessible names,
// the Trace Inspector, and later the Transcript view.

import { METHODS, RULES } from './registry';
import type { Kind, Prov, RecordedSource } from './types';

export const KIND_LABEL: Record<Kind, string> = {
  recorded: 'Recorded',
  calculated: 'Calculated',
  reference: 'Reference',
  example: 'Example',
};

export const WHAT_IF_LABEL = 'What-if';
export const WHAT_IF_LINE = "Simulated on this page; the model wasn't asked again";
export const GENERAL_REFERENCE_LINE = 'General: true of standard transformer models; not confirmed for this model';

export function recordedLine(source: RecordedSource): string {
  switch (source.via) {
    case 'sent':
      return 'Sent by this app';
    case 'done':
      return 'Done by this app';
    case 'reported':
      return source.by === 'openai_moderation' ? "Reported by OpenAI's moderation model" : 'Reported by OpenAI';
    case 'measured':
      return source.clock === 'server' ? 'Measured by this app (server)' : 'Measured by this app (browser)';
  }
}

/** The required source line for a label (docs/PLAN.md §2, "Labeling"). */
export function sourceLine(p: Prov): string {
  switch (p.kind) {
    case 'recorded':
      return recordedLine(p.source);
    case 'calculated':
      return p.assumptions ? `${METHODS[p.method].label} (${p.assumptions})` : METHODS[p.method].label;
    case 'reference':
      if (p.doc) return `${p.doc.title}, retrieved ${p.doc.retrieved}`;
      if (p.measured) return `${p.measured.what}, measured ${p.measured.date}`;
      return GENERAL_REFERENCE_LINE;
    case 'example':
      return p.otherModel ? `Real data from ${p.otherModel}` : RULES[p.rule].label;
  }
}

/** A longer explanation for the "How do we know this?" view. */
export function sourceDetail(p: Prov): string {
  switch (p.kind) {
    case 'recorded':
      return `${recordedLine(p.source)}: ${p.source.field}.`;
    case 'calculated':
      return METHODS[p.method].detail;
    case 'reference':
      if (p.doc) return `From ${p.doc.title} (${p.doc.url}), retrieved ${p.doc.retrieved}.`;
      if (p.measured) return `${p.measured.what}, measured by this project on ${p.measured.date}.`;
      return `${GENERAL_REFERENCE_LINE}.`;
    case 'example':
      return RULES[p.rule].disclaimer;
  }
}

/** The distinct Recorded and Reference sources a value ultimately rests on. */
export function rootSources(p: Prov): Prov[] {
  if (p.kind === 'recorded' || p.kind === 'reference') return [p];
  const out: Prov[] = [];
  const seen = new Set<string>();
  const visit = (q: Prov) => {
    if (q.kind === 'calculated' || q.kind === 'example') {
      if (q.kind === 'example' && q.from.length === 0) {
        const key = JSON.stringify(q);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(q);
        }
      }
      q.from.forEach(visit);
      return;
    }
    const key = JSON.stringify(q);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
  };
  visit(p);
  return out;
}
