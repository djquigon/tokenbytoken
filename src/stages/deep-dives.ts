// The deep dives' copy for one reply, built from its trace (pure). Shared by the deep-dive panels and the
// Transcript view, so both say the same thing.

import {
  type RecordedWrongCase,
  contextDive,
  fluentDive,
  learningDive,
  temperatureDive,
  timingDive,
  type DeepDiveCopy,
  type DeepDiveId,
} from '@/content/deep-dives';
import { derive, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import type { FinalizedTrace } from '@/trace/facts';

import { firstToken, hookMoment } from './common';

export const DEEP_DIVE_IDS: readonly DeepDiveId[] = ['fluent', 'temperature', 'context', 'learning', 'timing'];

/** The token the deep dives use as their example: the Hook's close call, or the first token. */
export const exampleToken = (trace: FinalizedTrace) => hookMoment(trace)?.token ?? firstToken(trace);

/** The temperature this app sent, when it sent one. */
export function sentTemperature(trace: FinalizedTrace): Sourced<number> | null {
  const t = trace.request?.settings.temperature;
  return t && read(t) !== null ? (t as Sourced<number>) : null;
}

/** The recorded wrong case's values, labeled: its first token is the answer to a letter-counting question. */
export function recordedWrongCase(caseTrace: FinalizedTrace | null): RecordedWrongCase | null {
  if (!caseTrace) return null;
  const token = firstToken(caseTrace);
  const top = token?.alternatives[0];
  const question = caseTrace.request?.inputRuns.find((r) => r.role === 'user')?.text;
  const date = caseTrace.timing.browser.requestSent;
  const model = caseTrace.model;
  if (!token || !top || !question || !date || !model) return null;
  const count = derive('letter-count', [question], (q) => {
    const m = q.match(/letter "(.)" appear in the word "([^"]+)"/u);
    return m?.[1] && m[2] ? [...m[2].toLowerCase()].filter((ch) => ch === m[1]?.toLowerCase()).length : 0;
  });
  return { date, model, question, top: top.text, topPct: top.pct, wrote: token.text, count };
}

export function deepDiveCopy(id: DeepDiveId, trace: FinalizedTrace, wrongCase: RecordedWrongCase | null = null): DeepDiveCopy | null {
  const request = trace.request;
  switch (id) {
    case 'fluent': {
      const token = exampleToken(trace);
      return token ? fluentDive({ token: token.text, pct: token.pct, cutoff: request?.reference.knowledgeCutoff ?? null, recorded: wrongCase }) : null;
    }
    case 'temperature': {
      const sent = sentTemperature(trace);
      const rawScores = request ? read(request.reference.logprobsAreRawScores) : false;
      return sent && rawScores && exampleToken(trace) ? temperatureDive({ sent }) : null;
    }
    case 'context':
      return request
        ? contextDive({
            used: trace.usage?.inputTokens ?? null,
            budget: request.context.inputBudgetTokens,
            limit: request.reference.contextWindowTokens,
            dropped: derive('count', [request.context.dropped], (d) => d.length),
          })
        : null;
    case 'learning':
      return learningDive({ trainingUse: request?.reference.apiDataUsedForTraining ?? null });
    case 'timing':
      return timingDive({
        firstText: trace.timing.durations.browserToFirstText,
        total: trace.timing.durations.browserTotal,
        rate: trace.timing.deliveryRate,
      });
  }
}
