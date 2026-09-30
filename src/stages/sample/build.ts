// Stage `sample` (chapter 5): the weighted random pick. The options and the chosen token are Recorded;
// where the random draw landed is an Example, because the draw itself isn't observable (CLAUDE.md A1).

import { pickDraw, pickSettings } from '@/content/walkthrough';
import { illustrate, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import type { OutputToken, RequestFacts } from '@/trace/facts';

import { firstToken, prng, stripOptions } from '../common';
import { timing, type BuildContext, type SceneMeta } from '../contract';

export type SampleScene =
  | (SceneMeta<'sample', 'draw'> & {
      readonly token: OutputToken;
      /** Where along the weighted strip the pointer lands: inside the chosen token's share. */
      readonly landing: Sourced<number, 'example'>;
    })
  | (SceneMeta<'sample', 'settings'> & { readonly token: OutputToken; readonly request: RequestFacts });

/**
 * A landing point, as a fraction of the strip's width, inside the chosen token's segment of the strip the
 * view draws (stripOptions, then one segment for the rest), or inside the rest if it wasn't listed.
 */
function landingPoint(token: OutputToken, seed: string): Sourced<number, 'example'> {
  return illustrate('sampler-draw', seed, [], () => {
    const strip = stripOptions(token);
    const pcts = strip.map((a) => read(a.pct));
    const listed = pcts.reduce((a, b) => a + b, 0);
    const chosenAt = strip.findIndex((a) => a.isChosen);
    const start = chosenAt >= 0 ? pcts.slice(0, chosenAt).reduce((a, b) => a + b, 0) : listed;
    const share = chosenAt >= 0 ? (pcts[chosenAt] ?? 0) : Math.max(0, 100 - listed);
    return (start + share * (0.2 + 0.6 * prng(`draw:${seed}`)())) / Math.max(100, listed);
  });
}

export function buildSample(ctx: BuildContext): SampleScene[] {
  const token = firstToken(ctx.trace);
  const request = ctx.trace.request;
  if (!token || !request) return [];
  const t = request.settings.temperature;
  const p = request.settings.topP;
  return [
    {
      stage: 'sample',
      view: 'draw',
      key: 'pick:draw',
      chapter: 'pick',
      timing: timing(6_000, 4_500),
      copy: pickDraw({ chosen: token.text }),
      examples: true,
      token,
      landing: landingPoint(token, ctx.seed),
    },
    {
      stage: 'sample',
      view: 'settings',
      key: 'pick:settings',
      chapter: 'pick',
      timing: timing(5_000),
      copy: pickSettings({
        temperature: read(t) === null ? null : (t as Sourced<number>),
        topP: read(p) === null ? null : (p as Sourced<number>),
      }),
      examples: false,
      token,
      request,
    },
  ];
}
