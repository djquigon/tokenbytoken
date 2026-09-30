// Stages `embed` and `layers` for chapter 3, "Inside the network (example view)". Every drawing here is an
// Example (CLAUDE.md A9, A10): the API exposes no internals. The token labels are your real tokens
// (Calculated with the assumed tokenizer); the vectors, layers, and attention arcs are teaching patterns.

import { networkAttentionSample, networkAttentionYours, networkLayers, networkLookup } from '@/content/walkthrough';
import { deriveAll, illustrate, type Sourced } from '@/shared/provenance';

import { exampleVectors, inputPieces, sampleSentence, type TokenPiece } from '../common';
import { timing, type BuildContext, type SceneMeta } from '../contract';

/** The last few tokens of your message: enough to show the idea without crowding. */
const WINDOW = 6;

export interface Arc {
  /** The position doing the drawing-on (arrows point into it). */
  readonly to: number;
  readonly from: number;
}

export type NetworkScene =
  | (SceneMeta<'embed', 'lookup'> & { readonly pieces: readonly TokenPiece[]; readonly vectors: Sourced<number[][], 'example'> })
  | (SceneMeta<'layers', 'prefill'> & { readonly pieces: readonly TokenPiece[]; readonly layers: Sourced<number, 'example'> })
  | (SceneMeta<'layers', 'attention'> & {
      /** Real tokens as labels don't make the arcs real (CLAUDE.md L1). */
      readonly labels: Sourced<readonly string[]>;
      readonly arcs: Sourced<readonly Arc[], 'example'>;
      readonly onSample: boolean;
    });

/** Each position draws on itself and the token before it: a simple, documented pattern. */
const previousTokenArcs = (seed: string, n: number) =>
  illustrate('attention-previous-token', seed, [], () =>
    Array.from({ length: n }, (_, to) => [{ to, from: to }, ...(to > 0 ? [{ to, from: to - 1 }] : [])]).flat(),
  );

export function buildNetwork(ctx: BuildContext): NetworkScene[] {
  const message = ctx.trace.request?.inputRuns.filter((r) => r.role === 'user').at(-1);
  if (!message) return [];
  const pieces = inputPieces(message).slice(-WINDOW);
  const labels = deriveAll('local-token-count', pieces.map((p) => p.text), (xs) => xs as readonly string[]);
  return [
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
      labels: sampleSentence(),
      arcs: previousTokenArcs('sample', 6),
      onSample: true,
    },
    {
      stage: 'layers',
      view: 'attention',
      key: 'network:attention-yours',
      chapter: 'network',
      timing: timing(4_500),
      copy: networkAttentionYours(),
      examples: true,
      labels,
      arcs: previousTokenArcs(ctx.seed, pieces.length),
      onSample: false,
    },
  ];
}
