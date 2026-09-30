// Stages `layers` (the second pass), `loop` (moments and the montage), and `stop` for chapter 6. The reply's
// tokens and how it ended are Recorded; the second-pass drawing is an Example; the montage pacing is
// teaching time, labeled "sped up, not real timing" (CLAUDE.md A6).

import { loopAppend, loopMoment, loopMontage, stopCopy } from '@/content/walkthrough';
import { deriveAll, illustrate, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import type { OutputToken, StopReason } from '@/trace/facts';

import { montageDurationMs } from '@/playback/compile/pacing';

import { hookMoment, pickCopy, textBefore } from '../common';
import { timing, type BuildContext, type SceneMeta } from '../contract';

/** The most close calls the montage pauses at (docs/PLAN.md §1). */
const MAX_MOMENTS = 2;

export type LoopScene =
  | (SceneMeta<'layers', 'decode'> & { readonly tokens: readonly OutputToken[]; readonly saved: Sourced<number, 'example'> })
  | (SceneMeta<'loop', 'moment'> & { readonly token: OutputToken; readonly before: Sourced<string> | null })
  | (SceneMeta<'loop', 'montage'> & {
      /** Segment indices into the reply's segments (tokens and gaps), end exclusive. */
      readonly from: number;
      readonly to: number;
      readonly total: Sourced<number>;
    })
  | (SceneMeta<'stop', 'end'> & { readonly reason: Sourced<StopReason>; readonly limit: Sourced<number> | null });

export function buildLoop(ctx: BuildContext): LoopScene[] {
  const { trace } = ctx;
  const segments = trace.output.segments;
  const scenes: LoopScene[] = [];
  const total = deriveAll('count', segments.map((s) => (s.kind === 'token' ? s.token.text : s.gap.text)), (xs) => xs.length);

  if (trace.output.tokens.length > 0) {
    scenes.push({
      stage: 'layers',
      view: 'decode',
      key: 'loop:decode',
      chapter: 'loop',
      timing: timing(6_000, 4_000),
      copy: loopAppend(),
      examples: true,
      tokens: trace.output.tokens.slice(0, 4),
      saved: illustrate('saved-work', ctx.seed, [], () => 4),
    });
  }

  // Montage segments split at up to two featured close calls after the first token.
  const { featured } = read(trace.closeCalls);
  const moments = featured.filter((i) => i > 0).slice(0, MAX_MOMENTS);
  const hookIndex = hookMoment(trace)?.token.index ?? null;
  const segmentOf = (tokenIndex: number) => segments.findIndex((s) => s.kind === 'token' && s.token.index === tokenIndex);
  const cuts = moments.map(segmentOf).filter((i) => i > 0);
  const bounds = [1, ...cuts.map((c) => c + 1), segments.length];
  const perToken = segments.length > 1 ? montageDurationMs(segments.length - 1) / (segments.length - 1) : 0;

  bounds.slice(0, -1).forEach((from, i) => {
    const to = bounds[i + 1] ?? segments.length;
    if (to > from) {
      scenes.push({
        stage: 'loop',
        view: 'montage',
        key: `loop:montage:${i}`,
        chapter: 'loop',
        // The montage is never compressed by pacing: its speed is fixed by the per-token rule.
        timing: timing(Math.max(400, Math.round((to - from) * perToken)), 300, false),
        copy: loopMontage({ tokens: total, first: i === 0 }),
        examples: false,
        from,
        to,
        total,
      });
    }
    const momentIndex = moments[i];
    const token = momentIndex === undefined ? undefined : trace.output.tokens[momentIndex];
    if (token && i < cuts.length) {
      scenes.push({
        stage: 'loop',
        view: 'moment',
        key: `loop:moment:${token.index}`,
        chapter: 'loop',
        timing: timing(5_000, 3_500),
        autoPause: true,
        copy: loopMoment({ pick: pickCopy(token), again: token.index === hookIndex }),
        examples: false,
        token,
        before: textBefore(trace, token.index),
      });
    }
  });

  const reason = read(trace.stopReason);
  scenes.push({
    stage: 'stop',
    view: 'end',
    key: 'loop:end',
    chapter: 'loop',
    timing: timing(5_500, 4_000),
    copy: stopCopy(reason, trace.request?.limits.maxOutputTokens ?? null),
    examples: false,
    reason: trace.stopReason,
    limit: trace.request?.limits.maxOutputTokens ?? null,
  });
  return scenes;
}

export type { OutputToken };
