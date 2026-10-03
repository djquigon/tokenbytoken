// Stage `probs`: the final recorded-choice review and generation's next-token options. The options are
// Recorded (OpenAI's top alternatives) with Calculated percentages; the vocabulary strip is an Example.

import { hook, optionsBars, optionsMeaning, optionsStrip, optionsUnavailable } from '@/content/walkthrough';
import { derive, deriveAll, type Sourced } from '@/shared/provenance';
import type { OutputToken } from '@/trace/facts';

import { exampleScores, firstToken, hookMoment, pickCopy, textBefore } from '../common';
import { timing, type BuildContext, type SceneMeta } from '../contract';

export interface OptionsView {
  readonly token: OutputToken;
  /** The reply text just before this token, for context. */
  readonly before: Sourced<string> | null;
  /** How many alternatives to draw (the rest are in the token card). */
  readonly shown: number;
}

export type ProbsScene =
  | (SceneMeta<'probs', 'hook'> & { readonly moment: OptionsView; readonly closeCall: boolean })
  | (SceneMeta<'probs', 'strip'> & { readonly scores: Sourced<number[], 'example'>; readonly vocabulary: Sourced<number> | null })
  | (SceneMeta<'probs', 'bars'> & { readonly options: OptionsView })
  | (SceneMeta<'probs', 'meaning'> & { readonly options: OptionsView })
  | SceneMeta<'probs', 'unavailable'>;

const listedCount = (t: OutputToken) => deriveAll('count', t.alternatives.map((a) => a.text), (xs) => xs.length);

export function buildHook(ctx: BuildContext): ProbsScene[] {
  const moment = hookMoment(ctx.trace);
  if (!moment) return [{ stage: 'probs', view: 'unavailable', key: 'review:unavailable', chapter: 'review', timing: timing(5_000), copy: optionsUnavailable(), examples: false }];
  const token = moment.token;
  return [
    {
      stage: 'probs',
      view: 'hook',
      key: 'hook',
      chapter: 'review',
      timing: timing(7_000, 5_000),
      copy: hook({ tokens: ctx.trace.output.providerTokenCount, pick: pickCopy(token), closeCall: moment.closeCall, gaps: ctx.trace.output.segments.some((s) => s.kind === 'gap') }),
      examples: false,
      moment: { token, before: textBefore(ctx.trace, token.index), shown: 5 },
      closeCall: moment.closeCall,
    },
  ];
}

export function buildOptions(ctx: BuildContext): ProbsScene[] {
  const token = firstToken(ctx.trace);
  if (!token) {
    return [
      { stage: 'probs', view: 'unavailable', key: 'options:unavailable', chapter: 'generation', timing: timing(5_000), copy: optionsUnavailable(), examples: false },
    ];
  }
  const vocab = ctx.trace.request?.reference.tokenizerVocabulary ?? null;
  const view: OptionsView = { token, before: textBefore(ctx.trace, token.index), shown: ctx.depth === 'simple' ? 5 : 10 };
  return [
    {
      stage: 'probs',
      view: 'strip',
      key: 'options:strip',
      chapter: 'generation',
      timing: timing(4_500),
      copy: optionsStrip({ vocabulary: vocab ? derive('round', [vocab], (v) => Math.round(v / 1000) * 1000) : null }),
      examples: true,
      scores: exampleScores(ctx.seed, 96),
      vocabulary: vocab,
    },
    {
      stage: 'probs',
      view: 'bars',
      key: 'options:bars',
      chapter: 'generation',
      timing: timing(6_000, 4_500),
      copy: optionsBars({ chosen: token.text, pct: token.pct, listed: listedCount(token) }),
      examples: false,
      options: view,
    },
    {
      stage: 'probs',
      view: 'meaning',
      key: 'options:meaning',
      chapter: 'generation',
      timing: timing(4_000, 3_000),
      copy: optionsMeaning(),
      examples: false,
      options: view,
    },
  ];
}
