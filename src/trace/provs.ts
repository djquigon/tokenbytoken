// Shared provenance objects for the trace. Reusing one object per source keeps traces small and lets
// aggregates dedupe their inputs by identity.

import { recordedProv } from '@/shared/provenance/mint';

const reported = (field: string) => recordedProv({ via: 'reported', by: 'openai', field });
const sent = (field: string) => recordedProv({ via: 'sent', field });
const done = (field: string) => recordedProv({ via: 'done', field });

export const PROV = {
  deltaText: reported('streamed text (delta.text)'),
  refusalText: reported('streamed refusal (delta.text, refusal channel)'),
  token: reported('token string (delta.logprobs[].token)'),
  logprob: reported('logprob (delta.logprobs[].logprob)'),
  alternatives: reported('alternatives (delta.logprobs[].top)'),
  altToken: reported('alternative token (delta.logprobs[].top[].token)'),
  altLogprob: reported('alternative logprob (delta.logprobs[].top[].logprob)'),
  tokensInDelta: reported('tokens per streamed piece (delta.logprobs.length)'),
  finalText: reported('final text (text_done.text)'),
  model: reported('model (response_created.model)'),
  incompleteReason: reported('incomplete reason (end.incompleteReason)'),
  outputItemTypes: reported('output item types (end.outputItemTypes)'),
  usage: {
    inputTokens: reported('usage.inputTokens'),
    cachedInputTokens: reported('usage.cachedInputTokens'),
    cacheWriteTokens: reported('usage.cacheWriteTokens'),
    outputTokens: reported('usage.outputTokens'),
    reasoningTokens: reported('usage.reasoningTokens'),
    totalTokens: reported('usage.totalTokens'),
  },
  moderationFlagged: recordedProv({ via: 'reported', by: 'openai_moderation', field: 'moderation result (start.moderation.flagged)' }),
  instructions: sent('instructions (start.instructions)'),
  upstreamBody: sent('request body (start.upstreamRequest.body)'),
  messages: sent('messages sent (start.upstreamRequest.body)'),
  setting: (name: string) => sent(`setting (start.settings.${name})`),
  moderationModel: done('moderation model (start.moderation.model)'),
  moderationChecked: done('messages checked (start.moderation.checkedIds)'),
  contextBudget: done('input budget (start.context.inputBudgetTokens)'),
  contextIncluded: done('messages included (start.context.included)'),
  contextDropped: done('messages dropped (start.context.dropped)'),
  limit: (name: string) => done(`app limit (start.limits.${name})`),
  relayHash: done('hash of the relayed text (end.textSha256)'),
  ledger: done('charged to the daily budget (end.ledger)'),
  serverTime: (event: string) => recordedProv({ via: 'measured', clock: 'server', field: `${event} (t)` }),
  browserTime: (event: string) => recordedProv({ via: 'measured', clock: 'browser', field: `${event} (tc)` }),
  networkRead: recordedProv({ via: 'measured', clock: 'browser', field: 'network read that carried each event' }),
  userAbort: recordedProv({ via: 'done', field: 'Stop pressed (user_abort)' }),
  outcome: done('outcome (end.outcome)'),
  rejected: done('request rejected before streaming (http_error)'),
} as const;

export const SERVER_DELTA_TIME = PROV.serverTime('streamed piece sent');
export const BROWSER_DELTA_TIME = PROV.browserTime('streamed piece received');
