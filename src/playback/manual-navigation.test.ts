import { expect, it } from 'vitest';
import sample from '../../fixtures/sample/conversation.json';
import { finalizeTrace } from '@/trace/finalize';
import { traceLogSchema } from '@/trace/log';
import { compileScript } from './compile/compile';
import { initialState, reduce } from './machine';

it('finishes a step animation without advancing even after a long wait', () => {
  const result = compileScript(finalizeTrace(traceLogSchema.parse(sample.conversation.turns[0]?.log)), { depth: 'simple' });
  if (!result.ok) throw new Error(result.reason);
  const start = reduce(initialState(false), { type: 'animate' }, result.script);
  const half = reduce(start.state, { type: 'tick', dtMs: 900 }, result.script);
  expect(half.state.progress).toBeGreaterThan(0);
  expect(half.state.progress).toBeLessThan(1);
  const complete = reduce(half.state, { type: 'tick', dtMs: 600_000 }, result.script);
  expect(complete.state).toMatchObject({ step: 0, progress: 1, status: 'active' });
  expect(complete.effects).toContainEqual({ type: 'stopClock' });
  const next = reduce(complete.state, { type: 'next' }, result.script);
  expect(next.state).toMatchObject({ step: 1, progress: 0 });
  expect(next.effects).toContainEqual({ type: 'startClock' });
});
