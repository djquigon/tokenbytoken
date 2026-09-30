// Stage `tokenize` (chapter 2): your message as tokens. The split and the IDs are Calculated with the
// tokenizer this app assumes (CLAUDE.md A13); OpenAI's count is Recorded and shown beside ours.

import { tokenizeCallouts, tokenizeChips, tokenizeCount, tokenizeIds, type Callout } from '@/content/walkthrough';
import { deriveAll, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';

import { inputPieces, type TokenPiece } from '../common';
import { timing, type BuildContext, type SceneMeta } from '../contract';

export interface Highlight {
  readonly kind: Callout['kind'];
  readonly indices: readonly number[];
}

export type TokenizeScene =
  | (SceneMeta<'tokenize', 'chips'> & { readonly pieces: readonly TokenPiece[] })
  | (SceneMeta<'tokenize', 'ids'> & { readonly pieces: readonly TokenPiece[]; readonly tokenizer: Sourced<string, 'reference'> })
  | (SceneMeta<'tokenize', 'callouts'> & { readonly pieces: readonly TokenPiece[]; readonly highlights: readonly Highlight[] })
  | (SceneMeta<'tokenize', 'count'> & { readonly local: Sourced<number>; readonly reported: Sourced<number> | null });

const LETTER = /\p{L}/u;
const STARTS_WORD = /^\s|^[\p{P}\p{S}]/u;

/** Finds, in your own message, one example of each kind of split worth pointing out. */
export function findCallouts(pieces: readonly TokenPiece[]): { callouts: Callout[]; highlights: Highlight[] } {
  const texts = pieces.map((p) => read(p.text));
  const callouts: Callout[] = [];
  const highlights: Highlight[] = [];

  const leading = texts.findIndex((t, i) => /^ \p{L}{3,}$/u.test(t) && (i + 1 >= texts.length || STARTS_WORD.test(texts[i + 1] ?? ' ')));
  if (leading >= 0) {
    const piece = pieces[leading];
    if (piece) {
      callouts.push({ kind: 'leading_space', token: piece.text });
      highlights.push({ kind: 'leading_space', indices: [leading] });
    }
  }

  for (let i = 0; i < texts.length - 1; i += 1) {
    const first = texts[i] ?? '';
    if (!LETTER.test(first) || pieces[i]?.part) continue;
    let j = i + 1;
    while (j < texts.length && LETTER.test(texts[j] ?? '') && !STARTS_WORD.test(texts[j] ?? '') && !pieces[j]?.part) j += 1;
    if (j - i >= 2) {
      const span = pieces.slice(i, j);
      callouts.push({
        kind: 'split_word',
        word: deriveAll('text-join', span.map((p) => p.text), (xs) => xs.join('').trim()),
        pieces: deriveAll('count', span.map((p) => p.text), (xs) => xs.length),
      });
      highlights.push({ kind: 'split_word', indices: span.map((_, k) => i + k) });
      break;
    }
    i = j - 1;
  }

  const partIndex = pieces.findIndex((p) => p.part && p.part.k === 1 && p.part.n >= 2);
  const first = pieces[partIndex];
  if (partIndex >= 0 && first?.part) {
    const span = pieces.slice(partIndex, partIndex + first.part.n);
    callouts.push({
      kind: 'multi_token_char',
      char: first.text,
      pieces: deriveAll('count', span.map((p) => p.text), (xs) => xs.length),
    });
    highlights.push({ kind: 'multi_token_char', indices: span.map((_, k) => partIndex + k) });
  }
  return { callouts, highlights };
}

export function buildTokenize(ctx: BuildContext): TokenizeScene[] {
  const request = ctx.trace.request;
  if (!request) return [];
  const message = request.inputRuns.filter((r) => r.role === 'user').at(-1);
  if (!message) return [];
  const pieces = inputPieces(message);
  const { callouts, highlights } = findCallouts(pieces);
  const scenes: TokenizeScene[] = [
    {
      stage: 'tokenize',
      view: 'chips',
      key: 'tokenize:chips',
      chapter: 'tokenize',
      timing: timing(5_500),
      copy: tokenizeChips({ count: message.count }),
      examples: false,
      pieces,
    },
    {
      stage: 'tokenize',
      view: 'ids',
      key: 'tokenize:ids',
      chapter: 'tokenize',
      timing: timing(4_000),
      copy: tokenizeIds(),
      examples: false,
      pieces,
      tokenizer: request.reference.tokenizer,
    },
  ];
  if (callouts.length > 0) {
    scenes.push({
      stage: 'tokenize',
      view: 'callouts',
      key: 'tokenize:callouts',
      chapter: 'tokenize',
      timing: timing(5_000),
      copy: tokenizeCallouts(callouts),
      examples: false,
      pieces,
      highlights,
    });
  }
  scenes.push({
    stage: 'tokenize',
    view: 'count',
    key: 'tokenize:count',
    chapter: 'tokenize',
    timing: timing(4_000),
    copy: tokenizeCount({ local: request.context.estimatedInputTokens, reported: ctx.trace.usage?.inputTokens ?? null }),
    examples: false,
    local: request.context.estimatedInputTokens,
    reported: ctx.trace.usage?.inputTokens ?? null,
  });
  return scenes;
}
