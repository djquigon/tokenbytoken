// Stage `context` (chapter 1): what this app sent. The messages, instructions, and settings are Recorded;
// the role-marker layout is an Example, because OpenAI's own format isn't published.

import { contextCards, contextExtras, contextLayout } from '@/content/walkthrough';
import { deriveAll, illustrate, type Sourced } from '@/shared/provenance';
import type { InputRunFacts, RequestFacts } from '@/trace/facts';

import { timing, type BuildContext, type SceneMeta } from '../contract';

export type ContextScene =
  | (SceneMeta<'context', 'cards'> & {
      readonly instructions: InputRunFacts | null;
      readonly earlier: readonly InputRunFacts[];
      readonly message: InputRunFacts;
    })
  | (SceneMeta<'context', 'layout'> & {
      readonly runs: readonly InputRunFacts[];
      readonly markers: Sourced<readonly string[], 'example'>;
    })
  | (SceneMeta<'context', 'extras'> & {
      readonly request: RequestFacts;
      readonly toolCalls: Sourced<number>;
    });

export function buildContext(ctx: BuildContext): ContextScene[] {
  const request = ctx.trace.request;
  if (!request) return [];
  const runs = request.inputRuns;
  const instructions = runs.find((r) => r.role === 'instructions') ?? null;
  const messages = runs.filter((r) => r.role !== 'instructions');
  const message = messages.at(-1);
  if (!message) return [];
  const earlier = messages.slice(0, -1);
  const earlierCount = earlier.length > 0 ? deriveAll('count', earlier.map((r) => r.text), (xs) => xs.length) : null;
  return [
    {
      stage: 'context',
      view: 'cards',
      key: 'context:cards',
      chapter: 'context',
      timing: timing(5_000),
      copy: contextCards({ earlier: earlierCount }),
      examples: false,
      instructions,
      earlier,
      message,
    },
    {
      stage: 'context',
      view: 'layout',
      key: 'context:layout',
      chapter: 'context',
      timing: timing(4_500),
      copy: contextLayout(),
      examples: true,
      runs,
      markers: illustrate('role-markers', ctx.seed, [], () => ['‹system›', '‹user›', '‹assistant›'] as const),
    },
    {
      stage: 'context',
      view: 'extras',
      key: 'context:extras',
      chapter: 'context',
      timing: timing(4_500),
      copy: contextExtras(),
      examples: false,
      request,
      toolCalls: ctx.trace.toolCallsReturned,
    },
  ];
}
