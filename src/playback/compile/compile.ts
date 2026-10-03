// compileScript (docs/PLAN.md §3.5): FinalizedTrace + preferences → PlaybackScript. Pure: no Date,
// randomness, DOM, or fetch (a test runs it with those rigged to throw).
//
// Order: Hook → what gets sent → tokens → the prompt pass (example) → options and pick for the first token
// → the second pass and the rest of the reply (with close-call moments) → how it ended → the follow-up.

import type { Depth } from '@/components/prefs/store';
import { joinText, wordCount, type SourcedText } from '@/shared/sourced-text';
import { playbackMs } from '@/shared/units';
import type { FinalizedTrace } from '@/trace/facts';
import { read } from '@/shared/provenance/read';

import { buildContext } from '@/stages/context/build';
import { buildFollowup } from '@/stages/followup/build';
import { buildLoop } from '@/stages/loop/build';
import { buildNetwork } from '@/stages/network/build';
import { buildHook, buildOptions } from '@/stages/probs/build';
import { buildSample } from '@/stages/sample/build';
import type { Scene } from '@/stages/scenes';
import { buildTokenize } from '@/stages/tokenize/build';

import type { ChapterId, ChapterSpan, PlaybackScript, Step } from '../types';
import { fitDurations, readingMs, type Timing } from './pacing';

export interface CompileOptions {
  readonly depth: Depth;
}

export type CompileResult = { readonly ok: true; readonly script: PlaybackScript } | { readonly ok: false; readonly reason: 'no_request' | 'no_reply' | 'hidden_reasoning' | 'unknown_reasoning' };

/** A step never plays faster than its caption can be read (the montage's repeated caption counts once). */
function withReadingTime(scene: Scene, depth: Depth, captionAlreadyShown: boolean): Timing {
  const words = captionAlreadyShown
    ? 0
    : wordCount(scene.copy.body) +
      (depth !== 'simple' && scene.copy.detail ? wordCount(scene.copy.detail) : 0) +
      (depth === 'technical' && scene.copy.technical ? wordCount(scene.copy.technical) : 0);
  const reading = words > 0 ? readingMs(words) : 0;
  return { baseMs: Math.max(scene.timing.baseMs, reading), minMs: Math.max(scene.timing.minMs, reading), compressible: scene.timing.compressible };
}

/** The text alternative for a step: its title and copy at the chosen depth (CLAUDE.md §7, describe()). */
export function describeScene(scene: Scene, depth: Depth): SourcedText {
  const parts = [scene.copy.title, scene.copy.body];
  if (depth !== 'simple' && scene.copy.detail) parts.push(scene.copy.detail);
  if (depth === 'technical' && scene.copy.technical) parts.push(scene.copy.technical);
  return joinText(...parts.map((p, i) => (i === 0 ? [...p, '.'] : p)));
}

/** Whether there is reply data to explain, including the opaque reasoning fallback. */
export function canCompile(trace: FinalizedTrace): boolean {
  return trace.request !== null && (trace.output.segments.length > 0 || trace.output.tokens.length > 0);
}

export function compileScript(trace: FinalizedTrace, options: CompileOptions): CompileResult {
  if (!trace.request) return { ok: false, reason: 'no_request' };
  if (!canCompile(trace)) return { ok: false, reason: 'no_reply' };
  if (!trace.reasoningGate) return { ok: false, reason: 'unknown_reasoning' };
  if (!read(trace.reasoningGate)) return { ok: false, reason: 'hidden_reasoning' };
  const ctx = { trace, depth: options.depth, seed: trace.turnId };
  const scenes: Scene[] = [
    ...buildHook(ctx),
    ...buildContext(ctx),
    ...buildTokenize(ctx),
    ...buildNetwork(ctx),
    ...buildOptions(ctx),
    ...buildSample(ctx),
    ...buildLoop(ctx),
    ...buildFollowup(ctx),
  ];
  const timings = scenes.map((s, i) =>
    withReadingTime(s, options.depth, s.view === 'montage' && scenes.slice(0, i).some((earlier) => earlier.view === 'montage')),
  );
  const durations = fitDurations(timings);
  let at = 0;
  const steps: Step[] = scenes.map((scene, index) => {
    const durationMs = durations[index] ?? scene.timing.baseMs;
    const step: Step = {
      index,
      chapter: scene.chapter,
      key: scene.key,
      scene,
      startMs: playbackMs(at),
      durationMs: playbackMs(durationMs),
      autoPause: scene.autoPause ?? false,
      describe: describeScene(scene, options.depth),
    };
    at += durationMs;
    return step;
  });
  const chapters: ChapterSpan[] = [];
  for (const step of steps) {
    const last = chapters.at(-1);
    if (last && last.id === step.chapter) chapters[chapters.length - 1] = { ...last, last: step.index };
    else chapters.push({ id: step.chapter as ChapterId, first: step.index, last: step.index });
  }
  return { ok: true, script: { turnId: trace.turnId, depth: options.depth, steps, chapters, totalMs: playbackMs(at) } };
}
