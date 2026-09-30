// Stages `embed` and `layers` for chapter 3, "Inside the network (example view)". Every drawing here is an
// Example (CLAUDE.md A9, A10): the API exposes no internals. The token labels are your real tokens
// (Calculated with the assumed tokenizer); the vectors, layers, and attention arcs are teaching patterns.
// Detailed depth adds two sub-scenes (position, feed-forward) and more example attention patterns.

import {
  networkAttentionSample,
  networkAttentionYours,
  networkFeedForward,
  networkLayers,
  networkLookup,
  networkPosition,
} from '@/content/walkthrough';
import { deriveAll, illustrate, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';

import { exampleVectors, inputPieces, repeatSentence, sampleSentence, type TokenPiece } from '../common';
import { timing, type BuildContext, type SceneMeta } from '../contract';

import { hasRepeat, pattern, type AttentionPattern } from './patterns';

export type { Arc, AttentionPattern } from './patterns';

/** The last few tokens of your message: enough to show the idea without crowding. */
const WINDOW = 6;

export type NetworkScene =
  | (SceneMeta<'embed', 'lookup'> & { readonly pieces: readonly TokenPiece[]; readonly vectors: Sourced<number[][], 'example'> })
  | (SceneMeta<'embed', 'position'> & {
      readonly labels: Sourced<readonly string[], 'example'>;
      /** Where the repeated token sits: an index for drawing, and the position shown (counting from one). */
      readonly positions: readonly { readonly index: number; readonly shown: Sourced<number, 'example'> }[];
      readonly vector: Sourced<number[], 'example'>;
    })
  | (SceneMeta<'layers', 'prefill'> & { readonly pieces: readonly TokenPiece[]; readonly layers: Sourced<number, 'example'> })
  | (SceneMeta<'layers', 'attention'> & {
      /** The first is shown first; "Show another example pattern" steps through the rest. */
      readonly patterns: readonly AttentionPattern[];
    })
  | (SceneMeta<'layers', 'feedforward'> & { readonly pieces: readonly TokenPiece[] });

export function buildNetwork(ctx: BuildContext): NetworkScene[] {
  const message = ctx.trace.request?.inputRuns.filter((r) => r.role === 'user').at(-1);
  if (!message) return [];
  const detailed = ctx.depth !== 'simple';
  const pieces = inputPieces(message).slice(-WINDOW);
  const labels = deriveAll('local-token-count', pieces.map((p) => p.text), (xs) => xs as readonly string[]);
  const sample = sampleSentence();
  const repeat = repeatSentence();
  const yoursRepeat = hasRepeat(read(labels));

  const scenes: NetworkScene[] = [
    {
      stage: 'embed',
      view: 'lookup',
      key: 'network:lookup',
      chapter: 'network',
      timing: timing(5_000),
      copy: networkLookup(),
      examples: true,
      pieces,
      vectors: exampleVectors(ctx.seed, pieces.length, 10),
    },
  ];
  if (detailed) {
    const first = read(repeat)[0] ?? '';
    const at = [0, read(repeat).lastIndexOf(first)];
    scenes.push({
      stage: 'embed',
      view: 'position',
      key: 'network:position',
      chapter: 'network',
      timing: timing(5_000),
      copy: networkPosition(),
      examples: true,
      labels: repeat,
      positions: at.map((index) => ({ index, shown: illustrate('position-sample', 'sample-repeat', [repeat], () => index + 1) })),
      vector: illustrate('embedding-vector', 'sample-repeat', [], () => read(exampleVectors('sample-repeat', 1, 10))[0] ?? []),
    });
  }
  scenes.push(
    {
      stage: 'layers',
      view: 'prefill',
      key: 'network:prefill',
      chapter: 'network',
      timing: timing(5_500),
      copy: networkLayers(),
      examples: true,
      pieces,
      layers: illustrate('layer-stack', ctx.seed, [], () => 4),
    },
    {
      stage: 'layers',
      view: 'attention',
      key: 'network:attention-sample',
      chapter: 'network',
      timing: timing(5_000),
      copy: networkAttentionSample(),
      examples: true,
      // Every pattern is introduced on a neutral sample before your tokens (CLAUDE.md A10).
      patterns: [
        pattern('attention-previous-token', sample, 'sample', true),
        pattern('attention-duplicate-token', repeat, 'sample-repeat', true),
        pattern('attention-induction', repeat, 'sample-repeat', true),
      ],
    },
    {
      stage: 'layers',
      view: 'attention',
      key: 'network:attention-yours',
      chapter: 'network',
      timing: timing(4_500),
      copy: networkAttentionYours(),
      examples: true,
      // Repeat-based patterns appear on your tokens only when your message repeats one.
      patterns: [
        pattern('attention-previous-token', labels, ctx.seed, false),
        ...(yoursRepeat
          ? [pattern('attention-duplicate-token', labels, ctx.seed, false), pattern('attention-induction', labels, ctx.seed, false)]
          : []),
      ],
    },
  );
  if (detailed) {
    scenes.push({
      stage: 'layers',
      view: 'feedforward',
      key: 'network:feedforward',
      chapter: 'network',
      timing: timing(4_500),
      copy: networkFeedForward(),
      examples: true,
      pieces,
    });
  }
  return scenes;
}
