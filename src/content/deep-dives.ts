// Deep dives (docs/PLAN.md §2, "Deep dives"): optional panels that go further than the walkthrough. The
// same rules as src/content/walkthrough.ts: every value is a labeled slot, the model's verbs stay plain,
// and every paragraph lists the claims it rests on.

import type { Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import { slot, st, type SourcedText } from '@/shared/sourced-text';

import type { ClaimId } from './claims';

export type DeepDiveId = 'fluent' | 'temperature' | 'context' | 'learning' | 'timing' | 'guess' | 'check';

export const DEEP_DIVE_TITLES: Readonly<Record<DeepDiveId, string>> = {
  fluent: 'Why fluent answers can be wrong',
  temperature: 'What if the temperature were different?',
  context: 'Context limits and history',
  learning: 'Does it learn from me?',
  timing: 'How long did it take?',
  guess: 'Guess the likely option',
  check: 'Real or example? A quick check',
};

/** The deep dives that are interactive exercises; the Transcript lists only the others. */
export const EXERCISES: ReadonlySet<DeepDiveId> = new Set(['guess', 'check']);

export interface DeepDiveCopy {
  readonly paragraphs: readonly SourcedText[];
  readonly claims: readonly ClaimId[];
}

/** A recorded reply where the model's top option was wrong (see fixtures/sample/fluent-case.json). */
export interface RecordedWrongCase {
  readonly date: Sourced<number>;
  readonly model: Sourced<string>;
  readonly question: Sourced<string>;
  readonly top: Sourced<string>;
  readonly topPct: Sourced<number>;
  readonly wrote: Sourced<string>;
  readonly count: Sourced<number>;
}

export const fluentDive = (v: {
  token: Sourced<string>;
  pct: Sourced<number>;
  cutoff: Sourced<string> | null;
  recorded: RecordedWrongCase | null;
}): DeepDiveCopy => ({
  paragraphs: [
    st`The percentages score which wording is likely to come next, based on patterns in the model's training text. A likely wording isn't checked against facts, and a model can give a wrong token a high score.`,
    st`In your reply, ${slot('token', v.token)} had ${slot('pct', v.pct)}: the chance it would come next, not the chance it's true.`,
    ...(v.recorded
      ? [
          st`A recorded example (${slot('date', v.recorded.date)}, ${slot('text', v.recorded.model)}). Asked “${slot('text', v.recorded.question)}”, the model's top option was ${slot('token', v.recorded.top)} at ${slot('pct', v.recorded.topPct)}, and it wrote ${slot('token', v.recorded.wrote)}. The right answer is ${slot('int', v.recorded.count)}.`,
        ]
      : []),
    v.cutoff
      ? st`The model's training data ends at a cutoff (${slot('text', v.cutoff)}), and this app gives it no tools or search, so nothing in this reply was looked up or fact-checked.`
      : st`The model's training data ends at a cutoff date, and this app gives it no tools or search, so nothing in this reply was looked up or fact-checked.`,
  ],
  claims: ['C035', 'C047', 'C012'],
});

export const temperatureDive = (v: { sent: Sourced<number> }): DeepDiveCopy => ({
  paragraphs: [
    st`This app sent temperature ${slot('decimal', v.sent)}. Try others: the chances below are computed on this page from the same scores. The model wasn't asked again.`,
    st`Lower temperatures make the likeliest token likelier; higher ones spread the chances out. At temperature zero the top option is always picked. These chances are among the listed options only: how every other token would share out isn't known.`,
  ],
  claims: ['C038', 'C048', 'C037'],
});

export const contextDive = (v: {
  used: Sourced<number> | null;
  budget: Sourced<number>;
  limit: Sourced<number>;
  dropped: Sourced<number>;
}): DeepDiveCopy => ({
  paragraphs: [
    v.used
      ? st`Every request carries the conversation so far. This one used ${slot('int', v.used)} input tokens. This app's budget is ${slot('int', v.budget)}; the model's documented limit is ${slot('int', v.limit)}.`
      : st`Every request carries the conversation so far. This app's budget is ${slot('int', v.budget)} input tokens; the model's documented limit is ${slot('int', v.limit)}.`,
    read(v.dropped) > 0
      ? st`When a chat outgrows the budget, this app leaves out the oldest turns; this time it left out ${slot('int', v.dropped)}. Longer chats cost more, and fitting within a limit doesn't guarantee a model makes good use of everything in it.`
      : st`When a chat outgrows the budget, this app leaves out the oldest turns; nothing was left out this time. Longer chats cost more, and fitting within a limit doesn't guarantee a model makes good use of everything in it.`,
  ],
  claims: ['C044', 'C045', 'C024', 'C049'],
});

export const learningDive = (v: { trainingUse: Sourced<boolean> | null }): DeepDiveCopy => ({
  paragraphs: [
    st`No. The model's learned parameters were set in training, before this chat, and chatting doesn't change them.`,
    st`What looks like memory is this app sending the conversation again with each message. Start a new chat and the model has nothing from this one.`,
    v.trainingUse
      ? st`OpenAI says data sent to its API isn't used to train its models unless the account owner opts in (used for training by default: ${slot('bool', v.trainingUse)}).`
      : st`OpenAI says data sent to its API isn't used to train its models unless the account owner opts in.`,
  ],
  claims: ['C046', 'C044', 'C004'],
});

export const timingDive = (v: { firstText: Sourced<number> | null; total: Sourced<number> | null; rate: Sourced<number> | null }): DeepDiveCopy => ({
  paragraphs: [
    v.firstText && v.total
      ? st`Measured in this browser: the first text arrived ${slot('ms', v.firstText)} after sending, and the whole reply after ${slot('ms', v.total)}.`
      : st`This reply's timing wasn't fully recorded.`,
    v.rate ? st`Tokens arrived at ${slot('rate', v.rate)}, as this app received them (measured, including the network).` : [],
    st`These times include the network and OpenAI's queue. How the time split inside OpenAI's service can't be seen, and the time each token took to compute can't be observed.`,
  ].filter((p) => p.length > 0),
  claims: ['C013'],
});

export const guessDive = (): DeepDiveCopy => ({
  paragraphs: [
    st`Before you see the percentages: which option did the model score highest? These are real positions from your reply, with the real options OpenAI returned.`,
  ],
  claims: ['C034', 'C011'],
});

export const checkDive = (): DeepDiveCopy => ({
  paragraphs: [
    st`Sort each thing from the walkthrough: real data from your conversation, or a teaching example? Values this app worked out from what was recorded count as real data.`,
  ],
  claims: ['C027', 'C031'],
});

/** The "real or example?" items (docs/PLAN.md §1, optional wrap-up). Answers match the labels the walkthrough shows. */
export const REAL_OR_EXAMPLE = [
  {
    thing: 'The options listed for a token, in “The options for the next token”',
    answer: 'real',
    why: 'Real: these token strings are what OpenAI returned (Recorded).',
  },
  {
    thing: 'The percentages beside those options',
    answer: 'real',
    why: 'Real data, worked out by this app from the logprobs OpenAI returned (Calculated).',
  },
  {
    thing: 'The arrows between tokens in “Inside the network”',
    answer: 'example',
    why: 'An example: a teaching pattern. The API doesn’t expose this model’s attention.',
  },
  {
    thing: 'The number of layers drawn',
    answer: 'example',
    why: 'An example: OpenAI hasn’t published how many layers this model has.',
  },
  {
    thing: 'Your message split into tokens',
    answer: 'real',
    why: 'Real data, computed by this app with the tokenizer it assumes this model uses (Calculated).',
  },
  {
    thing: 'Where the pointer landed in “A weighted random pick”',
    answer: 'example',
    why: 'An example: the random draw itself can’t be observed, only the token it produced.',
  },
  {
    thing: 'The instructions shown in “What gets sent”',
    answer: 'real',
    why: 'Real: sent by this app, word for word (Recorded).',
  },
] as const satisfies readonly { thing: string; answer: 'real' | 'example'; why: string }[];
