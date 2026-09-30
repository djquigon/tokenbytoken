// The claims register (CLAUDE.md §3, "Process"): every explanatory claim the site makes, with its sources
// and the date they were last checked. A claim can't ship without a source. This file is the source of
// truth; `npm run claims` regenerates content/claims.md from it, and a test fails if the two differ.
//
// "This app" sources are facts about this app's own behavior; the cited code is the evidence.

export interface Claim {
  /** The claim, as worded in the UI (or its gist, where the UI interpolates values). */
  readonly text: string;
  /** Where it appears. */
  readonly where: string;
  readonly sources: readonly string[];
  readonly checked: string;
}

const OPENAI_YOUR_DATA = 'OpenAI, "Your data": https://developers.openai.com/api/docs/guides/your-data';
const OPENAI_CACHING = 'OpenAI prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching';
const OPENAI_MODEL = 'OpenAI model page, gpt-6-luna: https://developers.openai.com/api/docs/models/gpt-6-luna';
const OPENAI_PRICING = 'OpenAI API pricing: https://developers.openai.com/api/docs/pricing';
const GENERAL = 'General: true of standard transformer language models, not confirmed for this model';
const VASWANI = 'Vaswani et al. (2017), "Attention Is All You Need": https://arxiv.org/abs/1706.03762';
const PROBE = 'Phase 0 probe: docs/probe/2026-09-30-capability-report.md and ADR 0001';

export const CLAIMS = {
  C001: { text: 'Your messages are sent to OpenAI to generate replies.', where: 'Privacy notice, /privacy', sources: ['This app: src/server/chat/handler.ts'], checked: '2026-09-30' },
  C002: {
    text: "This site doesn't store your conversation on its servers. It stays in this browser tab.",
    where: 'Privacy notice, /privacy',
    sources: ['This app: no content is persisted or logged (handler.test.ts checks the log line has no content); src/generation/persist.ts'],
    checked: '2026-09-30',
  },
  C003: {
    text: 'OpenAI keeps abuse-monitoring logs, which can include prompts and replies, for up to 30 days, or longer where the law requires it.',
    where: 'Privacy notice, /privacy',
    sources: [OPENAI_YOUR_DATA],
    checked: '2026-09-30',
  },
  C004: {
    text: "Data sent to OpenAI's API isn't used to train its models unless the account owner opts in.",
    where: 'Privacy notice, /privacy, "Does it learn from me?"',
    sources: [OPENAI_YOUR_DATA],
    checked: '2026-09-30',
  },
  C005: {
    text: "With store: false, OpenAI doesn't keep the reply as stored application data. For longer conversations it may keep cached intermediate results of the start of a request (not its text) for up to 24 hours, not shared with other organizations.",
    where: '/privacy',
    sources: [OPENAI_YOUR_DATA, `${OPENAI_CACHING} ("stores key-value (KV) tensors, not the tokens themselves"; the default for organizations without Zero Data Retention is 24h)`],
    checked: '2026-09-30',
  },
  C006: {
    text: "Before a message is sent to the chat model, OpenAI's moderation model checks it; flagged messages aren't sent.",
    where: '/privacy, error input_flagged, chapter "What gets sent"',
    sources: ['This app: handler.ts (tested: "does not send flagged input to the model")'],
    checked: '2026-09-30',
  },
  C007: {
    text: 'Counters for fair-use limits use hashed identifiers of your tab and IP, never the raw values, and expire within two days.',
    where: '/privacy',
    sources: ['This app: src/server/signing/signing.ts (hashedKey), src/server/limits/store.ts (TTLs of 2 min to 2 days)'],
    checked: '2026-09-30',
  },
  C008: {
    text: 'OpenAI receives a hashed identifier of your tab\'s session (a "safety identifier").',
    where: '/privacy',
    sources: ['This app: safetyIdentifier(); OpenAI API reference, safety_identifier (at most 64 characters)'],
    checked: '2026-09-30',
  },
  C009: { text: "On the deployed site, Vercel's bot protection runs a check in your browser.", where: '/privacy', sources: ['Vercel BotID docs: https://vercel.com/docs/botid'], checked: '2026-09-30' },
  C010: {
    text: "This model's output count always includes 4 tokens that aren't returned as text.",
    where: 'Inspector, walkthrough token counts',
    sources: [`${PROBE} (27 of 27 fully covered calls); live checks on 2026-09-30`],
    checked: '2026-09-30',
  },
  C011: {
    text: 'The "chance of being picked" is the percentage from the logprob OpenAI returned.',
    where: 'Inspector, chapters "The options" and "A weighted random pick"',
    sources: [`${PROBE}: logprobs are raw scores, unchanged by temperature; this app sends temperature 1 and top_p 1`],
    checked: '2026-09-30',
  },
  C012: {
    text: 'Close calls ("chosen under 50%, or the top two within 15 points") describe wording, not correctness.',
    where: 'Inspector, Hook, chapter "Add it, repeat"; "Why fluent answers can be wrong"',
    sources: ['Design rule CLAUDE.md A12', "General: a continuation's probability is not the probability that a statement is true"],
    checked: '2026-09-30',
  },
  C013: {
    text: "Waits include network travel and OpenAI's queue, so they aren't the model's processing time; the time each token took to compute can't be observed.",
    where: 'Inspector timing, live strip, timing card ("How long did it take?")',
    sources: ['CLAUDE.md A5/A6', 'This app: timestamps are taken at its server and in the browser (src/trace/finalize.ts)'],
    checked: '2026-09-30',
  },
  C014: {
    text: "Cached tokens are saved results for an identical start of a request; they aren't memory, and they don't change how the reply is generated.",
    where: 'Inspector usage, chapter "Your next message"',
    sources: [`${OPENAI_CACHING} (reuses the saved key-value state of an unchanged prefix; "Prompt caching does not change how the model generates output tokens")`],
    checked: '2026-09-30',
  },
  C015: {
    text: '"The model generated its end marker": inferred when OpenAI reports the reply complete and no stop sequences were set.',
    where: 'Inspector, chapter "Add it, repeat"',
    sources: ['Method end-marker-inferred; this app sets no stop sequences (the Responses API has no stop parameter; docs/PLAN.md §3.1)'],
    checked: '2026-09-30',
  },
  C016: {
    text: 'OpenAI returned no alternatives for these characters.',
    where: 'Inspector gap rows, token views',
    sources: ['Phase 0 probe (ADR 0003, finding 2); fixtures/probe/gpt-6-luna/stream-unicode.json'],
    checked: '2026-09-30',
  },
  C017: {
    text: 'At every step, the model scores every possible next token, based on all the text so far, including what it has already written.',
    where: 'Hook, chapter "The options"; landing page',
    sources: [GENERAL, VASWANI],
    checked: '2026-09-30',
  },
  C018: {
    text: 'This app assembles one input for every request: its own instructions, the earlier turns it re-sends, and your new message.',
    where: 'Chapter "What gets sent"',
    sources: ['This app: src/server/chat/handler.ts and src/server/openai/adapter.ts (buildResponsesBody)'],
    checked: '2026-09-30',
  },
  C019: {
    text: "Apps can add instructions you don't see. This app shows its own word for word.",
    where: 'Chapter "What gets sent"',
    sources: ['This app: INSTRUCTIONS in src/server/config.ts are echoed in the start event', 'General: the Responses API accepts instructions and developer messages from the app'],
    checked: '2026-09-30',
  },
  C020: {
    text: "OpenAI wraps the messages in its own format and adds hidden system content of its own; it hasn't published the exact format for this model.",
    where: 'Chapter "What gets sent"',
    sources: [`${OPENAI_CACHING} (refers to "the OpenAI-provided hidden system content")`, 'This app: the input counts OpenAI reports exceed this app’s count by a fixed amount per message (Phase 0 calibration)'],
    checked: '2026-09-30',
  },
  C021: {
    text: 'This app offered no tools or search, and the reply contains no tool calls.',
    where: 'Chapter "What gets sent"',
    sources: ['This app: toolsOffered is 0 in the start event; outputItemTypes in the end event lists only messages'],
    checked: '2026-09-30',
  },
  C022: {
    text: 'Text is split into tokens: often a whole common word with its leading space, sometimes a piece of a word, a single character, or a byte.',
    where: 'Chapter "Text becomes tokens"; landing page',
    sources: [GENERAL, 'Sennrich et al. (2016), byte-pair encoding: https://arxiv.org/abs/1508.07909', 'This app: o200k_base via gpt-tokenizer'],
    checked: '2026-09-30',
  },
  C023: {
    text: 'Each token is a number: its position in a fixed vocabulary. Token IDs shown here come from the tokenizer this app assumes.',
    where: 'Chapter "Text becomes tokens"',
    sources: [GENERAL, 'CLAUDE.md A13 (IDs are Calculated; the API returns text, not IDs)'],
    checked: '2026-09-30',
  },
  C024: { text: 'Limits and prices are counted in tokens.', where: 'Chapter "Text becomes tokens"; landing page, "Context limits and history"', sources: [OPENAI_PRICING, OPENAI_MODEL], checked: '2026-09-30' },
  C025: {
    text: "This app's input count is an estimate: it adds an allowance, measured for this model, for formatting OpenAI adds but hasn't published, so it can differ slightly from OpenAI's count.",
    where: 'Chapter "Text becomes tokens"',
    sources: [`${PROBE} (about 1 extra token per request and 5 per message)`],
    checked: '2026-09-30',
  },
  C026: {
    text: 'Seeing tokens rather than letters is one reason models can miscount the letters in a word.',
    where: 'Chapter "Text becomes tokens" (Detailed)',
    sources: [GENERAL],
    checked: '2026-09-30',
  },
  C027: {
    text: "OpenAI hasn't published the design of the model answering you. It has for its open-weight gpt-oss models. These are example views of models like it.",
    where: 'Banner on the network, options, pick, and loop chapters; landing page (“What’s real here”)',
    sources: [OPENAI_MODEL, 'OpenAI, "gpt-oss-120b & gpt-oss-20b Model Card" (layers and architecture published): https://openai.com/index/gpt-oss-model-card/'],
    checked: '2026-09-30',
  },
  C028: {
    text: 'Each token ID picks out a list of numbers learned in training (its embedding). Values computed for this request are working notes, discarded afterwards.',
    where: 'Chapter "Inside the network"',
    sources: [GENERAL, VASWANI],
    checked: '2026-09-30',
  },
  C029: {
    text: 'The prompt is processed in parallel: all its positions pass up through the layers together, layer by layer.',
    where: 'Chapter "Inside the network"',
    sources: [GENERAL, VASWANI],
    checked: '2026-09-30',
  },
  C030: {
    text: 'Attention lets each position draw on itself and earlier positions, never later ones.',
    where: 'Chapter "Inside the network"',
    sources: [GENERAL, `${VASWANI} (masked self-attention in the decoder)`],
    checked: '2026-09-30',
  },
  C031: {
    text: "The pattern shown is a teaching example, not this model's attention: the API exposes none of these internals.",
    where: 'Chapter "Inside the network"',
    sources: ['CLAUDE.md A1 and A10', 'This app: the Responses API returns text, logprobs, and usage only'],
    checked: '2026-09-30',
  },
  C032: {
    text: 'Feed-forward steps transform each position on its own. Word order is encoded too; in many modern models, position is applied inside attention (for example, rotary embeddings).',
    where: 'Chapter "Inside the network" (Detailed)',
    sources: [GENERAL, VASWANI, 'Su et al. (2021), RoFormer: https://arxiv.org/abs/2104.09864'],
    checked: '2026-09-30',
  },
  C033: {
    text: 'The network produces a score for every entry in its vocabulary; the scores are turned into percentages that add up to 100%.',
    where: 'Chapter "The options"',
    sources: [GENERAL, `${VASWANI} (softmax output)`],
    checked: '2026-09-30',
  },
  C034: {
    text: 'Shown here are the top options OpenAI returned for this position (up to 20); every other token shares what is left.',
    where: 'Chapter "The options", token card',
    sources: ['OpenAI API reference: top_logprobs accepts 0 to 20', 'This app: the remainder is Calculated as 100% minus the listed options'],
    checked: '2026-09-30',
  },
  C035: {
    text: "A high percentage means that wording was likely to come next, not that it's true. A model can give a wrong token a high score.",
    where: 'Chapter "The options", "Why fluent answers can be wrong"; "Why fluent answers can be wrong"',
    sources: [GENERAL, 'CLAUDE.md A12'],
    checked: '2026-09-30',
  },
  C036: {
    text: "A separate step, outside the network, makes a weighted random pick. This app can't observe the draw itself.",
    where: 'Chapter "A weighted random pick"',
    sources: [GENERAL, "OpenAI doesn't document its sampler's internals (docs/PLAN.md §3.1)"],
    checked: '2026-09-30',
  },
  C037: {
    text: 'With temperature 1 and top_p 1, as this app sends, the percentages are the chances of each pick, assuming standard sampling.',
    where: 'Chapter "A weighted random pick"',
    sources: [PROBE, GENERAL],
    checked: '2026-09-30',
  },
  C038: {
    text: 'Lower temperature makes the likeliest tokens likelier; higher temperature spreads the chances out. At temperature 0 the top option is always picked.',
    where: 'Temperature What-if',
    sources: [GENERAL, 'Temperature divides the scores before the percentages are computed'],
    checked: '2026-09-30',
  },
  C039: {
    text: 'The weighted random pick is one reason the same prompt can give different replies. Even identical requests aren’t guaranteed identical outputs.',
    where: 'Chapter "A weighted random pick"; landing page',
    sources: [`${OPENAI_CACHING} ("identical requests are not guaranteed to produce identical outputs")`, `${PROBE} (identical requests returned different logprobs)`],
    checked: '2026-09-30',
  },
  C040: {
    text: 'Each new token takes one more pass through the network, for the new position only, reusing saved work for everything earlier.',
    where: 'Chapter "Add it, repeat"',
    sources: [GENERAL, `${OPENAI_CACHING} (key-value states "let the model refer back to earlier tokens while ... generating output tokens")`],
    checked: '2026-09-30',
  },
  C041: { text: "The model can't go back and edit tokens it has already written.", where: 'Chapter "Add it, repeat"', sources: [GENERAL], checked: '2026-09-30' },
  C042: {
    text: 'A reply ends when the model writes its end marker, reaches the length limit, is stopped by a content filter, or is stopped by you or a lost connection.',
    where: 'Chapter "Add it, repeat"',
    sources: ['OpenAI Responses API: status and incomplete_details.reason (SDK types, openai 7.25)', 'This app: src/trace/finalize.ts (stop reasons)'],
    checked: '2026-09-30',
  },
  C043: {
    text: 'Formatting such as bold text is just characters the model wrote; this app turns them into formatting.',
    where: 'Chapter "Add it, repeat"',
    sources: ['This app: replies are rendered as Markdown (src/components/chat/AssistantReply.tsx)'],
    checked: '2026-09-30',
  },
  C044: {
    text: "The model doesn't remember your earlier messages. This app sends the conversation so far with each new one.",
    where: 'Chapter "Your next message"; landing page, "Does it learn from me?", "Context limits and history"',
    sources: ['This app: stateless server; history is re-sent (docs/PLAN.md §3.6)', 'CLAUDE.md A8'],
    checked: '2026-09-30',
  },
  C045: {
    text: "When a conversation outgrows this app's budget, it drops the oldest turns. The model's own documented limit is much larger.",
    where: 'Chapter "Your next message", "Context limits and history"',
    sources: ['This app: src/shared/context-policy/policy.ts', OPENAI_MODEL],
    checked: '2026-09-30',
  },
  C046: {
    text: "Chatting doesn't change the model's learned parameters.",
    where: '"Does it learn from me?", landing page',
    sources: [GENERAL, 'CLAUDE.md A8'],
    checked: '2026-09-30',
  },
  C047: {
    text: "The model's training data ends at a cutoff date, and nothing it writes here is fact-checked: this app gives it no tools or search.",
    where: '"Why fluent answers can be wrong"',
    sources: [`${OPENAI_MODEL} (knowledge cutoff May 18, 2026)`, 'This app: no tools are offered'],
    checked: '2026-09-30',
  },
  C048: {
    text: "What-if chances at another temperature are computed on this page from the logprobs OpenAI returned, among the listed options only. This works because this model's logprobs are raw scores, unaffected by the temperature sent.",
    where: 'Temperature What-if',
    sources: [`${PROBE} (logprobs at the first output position didn't change with temperature beyond run-to-run noise)`, GENERAL],
    checked: '2026-09-30',
  },
  C049: {
    text: "Fitting within a model's context limit doesn't guarantee it makes good use of everything in it.",
    where: '"Context limits and history"',
    sources: ['Liu et al. (2023), "Lost in the Middle: How Language Models Use Long Contexts": https://arxiv.org/abs/2307.03172'],
    checked: '2026-09-30',
  },
  C050: {
    text: "A streamed piece is how the text traveled to this app; it isn't one step of the model, and one piece can carry several tokens.",
    where: 'Live strip (Detailed)',
    sources: [`${PROBE} (tokens per streamed piece, measured)`, 'This app: tokens per piece are counted from each piece OpenAI streamed (src/trace/live.ts)'],
    checked: '2026-09-30',
  },
  C051: {
    text: 'The sample replays a conversation recorded through this app: nothing is sent to OpenAI, and replaying it costs nothing.',
    where: '/sample, landing page',
    sources: ['This app: /sample reads fixtures/sample/conversation.json (recorded by scripts/record-sample.mts) and never calls the API; e2e/walkthrough.spec.ts checks that a replay makes no API calls'],
    checked: '2026-09-30',
  },
} as const satisfies Record<string, Claim>;

export type ClaimId = keyof typeof CLAIMS;
export const CLAIM_IDS = Object.keys(CLAIMS) as ClaimId[];

/** The register as Markdown (content/claims.md is generated from this). */
export function claimsMarkdown(): string {
  const escape = (s: string) => s.replaceAll('|', '\\|');
  const rows = CLAIM_IDS.map((id) => {
    const c: Claim = CLAIMS[id];
    return `| ${id} | ${escape(c.text)} | ${escape(c.where)} | ${escape(c.sources.join('; '))} | ${c.checked} |`;
  });
  return [
    '# Claims register',
    '',
    'Every explanatory claim the site makes, with its sources and when they were last checked (CLAUDE.md §3,',
    '"Process"). A claim can\'t ship without a source.',
    '',
    '**Generated from `src/content/claims.ts` by `npm run claims`. Edit that file, not this one.**',
    '',
    'Sources marked **This app** are facts about this app\'s own behavior; the cited code is the evidence.',
    '',
    '| ID | Claim (as worded in the UI) | Where | Sources | Last checked |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
