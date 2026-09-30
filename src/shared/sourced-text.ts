// Copy with labeled values in it (CLAUDE.md §7, `describe() → SourcedText`). Walkthrough text never
// contains a raw number: every figure is a slot holding a Sourced value, rendered through <Datum> with its
// label, or spelled out with its label in plain-text alternatives.
//
//   st`Your reply was ${slot('int', count)} tokens.`
//
// The template only accepts slots and strings, so interpolating a bare number is a type error.

import { KIND_LABEL, WHAT_IF_LABEL, type Sourced } from './provenance';
import { formatValue, type Format, type FormatValues } from './format';

export type Slot = {
  [F in Format]: {
    readonly kind: 'datum';
    readonly as: F;
    readonly d: Sourced<FormatValues[F]>;
    readonly approx?: boolean;
  };
}[Format];

/** A glossary term in running text: shown with its definition on hover, focus, or click. */
export interface TermPart {
  readonly kind: 'term';
  /** A glossary ID (src/content/glossary.ts checks it). */
  readonly id: string;
  readonly text: string;
}

export type TextPart = string | Slot | TermPart;
export type SourcedText = readonly TextPart[];

export const slot = <F extends Format>(as: F, d: Sourced<FormatValues[F]>, approx = false): Slot =>
  ({ kind: 'datum', as, d, ...(approx ? { approx: true } : {}) }) as Slot;

export function st(strings: TemplateStringsArray, ...parts: readonly (Slot | TermPart | string)[]): SourcedText {
  const out: TextPart[] = [];
  strings.forEach((s, i) => {
    if (s) out.push(s);
    const part = parts[i];
    if (part !== undefined && part !== '') out.push(part);
  });
  return out;
}

export const joinText = (...texts: readonly SourcedText[]): SourcedText => texts.flatMap((t, i) => (i === 0 ? t : [' ', ...t]));

/**
 * Plain text with each value's label spelled out, for screen readers and the Transcript view
 * (CLAUDE.md L6), e.g. `212 tokens (Calculated)`.
 */
export function plainText(text: SourcedText, read: (s: Sourced<unknown>) => unknown): string {
  return text
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part.kind === 'term') return part.text;
      const value = formatValue(part.as, read(part.d) as never);
      const label = KIND_LABEL[part.d.p.kind];
      const whatIf = part.d.whatIf ? `, ${WHAT_IF_LABEL}` : '';
      return `${part.approx ? '≈ ' : ''}${value} (${label}${whatIf})`;
    })
    .join('');
}

/** Rough word count of the prose, for the "≤ 40 words per step at Simple depth" rule. */
export const wordCount = (text: SourcedText): number =>
  text.reduce((n, part) => {
    const words = typeof part === 'string' ? part : part.kind === 'term' ? part.text : null;
    // Punctuation left next to a term or value (", written") isn't a word.
    return n + (words === null ? 1 : words.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
  }, 0);
