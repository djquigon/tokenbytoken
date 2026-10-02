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
    where: 'Privacy notice, /privacy, "Does it learn from me?"; FAQ',
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
    where: 'Hook, chapter "The options"; landing page; FAQ',
    sources: [GENERAL, VASWANI],
    checked: '2026-09-30',
  },
  C018: {
    text: 'This app assembles one input for every request: its own instructions, the earlier turns it re-sends, and your new message.',
    where: 'Chapter "What gets sent"; landing page ("Context, not memory"); the walkthrough panel before the first reply',
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
    where: 'Chapter "What gets sent"; FAQ',
    sources: ['This app: toolsOffered is 0 in the start event; outputItemTypes in the end event lists only messages'],
    checked: '2026-09-30',
  },
  C022: {
    text: 'Text is split into tokens: often a whole common word with its leading space, sometimes a piece of a word, a single character, or a byte.',
    where: 'Chapter "Text becomes tokens"; landing page ("Tokens"); the walkthrough panel before the first reply',
    sources: [GENERAL, 'Sennrich et al. (2016), byte-pair encoding: https://arxiv.org/abs/1508.07909', 'This app: o200k_base via gpt-tokenizer'],
    checked: '2026-09-30',
  },
  C023: {
    text: 'Each token is a number: its position in a fixed vocabulary. Token IDs shown here come from the tokenizer this app assumes.',
    where: 'Chapter "Text becomes tokens"',
    sources: [GENERAL, 'CLAUDE.md A13 (IDs are Calculated; the API returns text, not IDs)'],
    checked: '2026-09-30',
  },
  C024: {
    text: "AI services count text in tokens, not words: a model's context limit and the cap on a reply's length are set in tokens, and requests are priced by the token.",
    where: 'Chapter "Text becomes tokens"; landing page, "Context limits and history"',
    sources: [OPENAI_PRICING, OPENAI_MODEL, 'This app: src/server/config.ts caps each reply (max_output_tokens)'],
    checked: '2026-09-30',
  },
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
    where: 'Banner on the network, options, pick, and loop chapters; landing page (“What’s real here”); the walkthrough panel before the first reply; FAQ',
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
    where: 'Chapter "The options", token card; FAQ',
    sources: ['OpenAI API reference: top_logprobs accepts 0 to 20', 'This app: the remainder is Calculated as 100% minus the listed options'],
    checked: '2026-09-30',
  },
  C035: {
    text: "A high percentage means that wording was likely to come next, not that it's true. A model can give a wrong token a high score.",
    where: 'Chapter "The options", "Why fluent answers can be wrong"; "Why fluent answers can be wrong"; FAQ',
    sources: [GENERAL, 'CLAUDE.md A12'],
    checked: '2026-09-30',
  },
  C036: {
    text: "A separate step, outside the network, makes a weighted random pick. This app can't observe the draw itself.",
    where: 'Chapter "A weighted random pick"; landing page ("A weighted random pick"); the walkthrough panel before the first reply; FAQ',
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
    where: 'Temperature What-if; FAQ',
    sources: [GENERAL, 'Temperature divides the scores before the percentages are computed'],
    checked: '2026-09-30',
  },
  C039: {
    text: 'The weighted random pick is one reason the same prompt can give different replies. Even identical requests aren’t guaranteed identical outputs.',
    where: 'Chapter "A weighted random pick"; FAQ',
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
    where: 'Chapter "Your next message"; landing page, "Does it learn from me?", "Context limits and history"; FAQ',
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
    where: '"Does it learn from me?", landing page; FAQ',
    sources: [GENERAL, 'CLAUDE.md A8'],
    checked: '2026-09-30',
  },
  C047: {
    text: "The model's training data ends at a cutoff date, and nothing it writes here is fact-checked: this app gives it no tools or search.",
    where: '"Why fluent answers can be wrong"; FAQ',
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
    where: '/sample',
    sources: ['This app: /sample reads fixtures/sample/conversation.json (recorded by scripts/record-sample.mts) and never calls the API; e2e/walkthrough.spec.ts checks that a replay makes no API calls'],
    checked: '2026-09-30',
  },
  C052: {
    text: 'Some attention heads in language models draw on earlier copies of the same token (duplicate-token heads).',
    where: 'Chapter "Inside the network" (Show another example pattern)',
    sources: ['Wang et al. (2022), "Interpretability in the Wild": https://arxiv.org/abs/2211.00593', GENERAL],
    checked: '2026-09-30',
  },
  C053: {
    text: 'Induction heads: at a repeated token, a position draws on the token that followed its earlier copy, which helps models continue patterns seen earlier in the text.',
    where: 'Chapter "Inside the network" (Show another example pattern)',
    sources: ['Olsson et al. (2022), "In-context Learning and Induction Heads": https://arxiv.org/abs/2209.11895', GENERAL],
    checked: '2026-09-30',
  },
  C054: {
    text: 'Chat apps with "memory" features save details and supply them as context in later chats: that’s still context, not learning.',
    where: 'Chapter "Your next message" (Detailed); FAQ',
    sources: [
      'OpenAI Help Center, "Memory in ChatGPT" (saved memories are details ChatGPT "saves as useful context"): https://help.openai.com/en/articles/8590148-memory-in-chatgpt',
      'C046 (chatting doesn’t change the learned parameters)',
    ],
    checked: '2026-09-30',
  },
  C055: {
    text: 'Because the pick is random and weighted, the top option isn’t always the one picked.',
    where: 'Landing page ("A weighted random pick"), with a recorded pick from the sample that wasn’t the top option; FAQ',
    sources: [GENERAL, 'C036 (a weighted random pick)', 'fixtures/sample/conversation.json: in the second reply, “ enhance” was picked at rank 3 (src/app/landing-data.ts, pickMoment)'],
    checked: '2026-09-30',
  },
  C056: {
    text: "A large language model is a network of learned numbers, often billions, set by training; the arithmetic is known exactly, but single parts of the network don't have a consistent meaning.",
    where: "FAQ (“What is the “black box”?”)",
    sources: [
      "Anthropic, \"Decomposing language models into understandable components\" (2023-10-05): https://www.anthropic.com/research/decomposing-language-models-into-understandable-components",
      "International AI Safety Report 2026 (2026-02-03): https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026, p. 99 (billions or trillions of parameters; the \"black box\" problem)",
    ],
    checked: '2026-09-30',
  },
  C057: {
    text: "Interpretability research has found millions of internal features that match concepts (turning up a Golden Gate Bridge feature changed the model’s replies), and has traced some computations, such as a model settling on a rhyme before writing the line.",
    where: "FAQ (“What is the “black box”?”)",
    sources: [
      "Anthropic, \"Mapping the mind of a large language model\" (2024-05-21): https://www.anthropic.com/research/mapping-mind-language-model",
      "OpenAI, \"Extracting concepts from GPT-4\" (2024-06-06): https://openai.com/index/extracting-concepts-from-gpt-4/",
      "Anthropic, \"Tracing the thoughts of a large language model\" (2025-03-27): https://www.anthropic.com/research/tracing-thoughts-language-model",
      "Lindsey et al., \"On the Biology of a Large Language Model\" (2025-03-27): https://transformer-circuits.pub/2025/attribution-graphs/biology.html",
    ],
    checked: '2026-09-30',
  },
  C058: {
    text: "Current methods explain only part of a model’s computation, even on short, simple prompts, and take a few hours of expert work per prompt; the latest international report found techniques for explaining outputs unreliable.",
    where: "FAQ (“What is the “black box”?”)",
    sources: [
      "Anthropic, \"Tracing the thoughts of a large language model\" (2025-03-27): https://www.anthropic.com/research/tracing-thoughts-language-model (\"only a fraction of the total computation\"; \"a few hours of human effort\")",
      "International AI Safety Report 2026 (2026-02-03): https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026, §3.1, p. 99",
    ],
    checked: '2026-09-30',
  },
  C059: {
    text: "A model’s explanation of its own answer is generated like any other text, and nothing guarantees it describes what happened; models’ ability to notice their own internal states is highly unreliable.",
    where: "FAQ (“Can’t we just ask the AI to explain?”)",
    sources: [
      "CLAUDE.md A3 (a model-generated explanation is never presented as its actual reasoning)",
      "Anthropic, \"Signs of introspection in large language models\" (2025-10-29): https://www.anthropic.com/research/introspection",
    ],
    checked: '2026-09-30',
  },
  C060: {
    text: "Traced on an addition problem, a Claude model combined a rough estimate with an exact last digit, but described the carry-the-one method when asked how it did it.",
    where: "FAQ (“Can’t we just ask the AI to explain?”)",
    sources: [
      "Anthropic, \"Tracing the thoughts of a large language model\" (2025-03-27): https://www.anthropic.com/research/tracing-thoughts-language-model",
      "Lindsey et al., \"On the Biology of a Large Language Model\" (2025-03-27): https://transformer-circuits.pub/2025/attribution-graphs/biology.html",
    ],
    checked: '2026-09-30',
  },
  C061: {
    text: "Models nudged by a hidden pattern in a prompt’s examples followed it, and their step-by-step explanations didn’t mention it.",
    where: "FAQ (“Can’t we just ask the AI to explain?”)",
    sources: [
      "Turpin, Michael, Perez & Bowman, \"Language Models Don’t Always Say What They Think\" (NeurIPS 2023): https://arxiv.org/abs/2305.04388",
    ],
    checked: '2026-09-30',
  },
  C062: {
    text: "When a planted hint changed a reasoning model’s answer, its written reasoning mentioned the hint 25% of the time on average for an Anthropic model, and 39% for DeepSeek R1.",
    where: "FAQ (“Can’t we just ask the AI to explain?”)",
    sources: [
      "Anthropic, \"Reasoning models don’t always say what they think\" (2025-04-03; average faithfulness scores for Claude 3.7 Sonnet and DeepSeek R1): https://www.anthropic.com/research/reasoning-models-dont-say-think",
      "Chen et al., arXiv 2505.05410 (2025-05-08): https://arxiv.org/abs/2505.05410",
    ],
    checked: '2026-09-30',
  },
  C063: {
    text: "There is no agreed test for consciousness; a chatbot’s words about feelings are generated like any other reply, from training text full of people describing feelings.",
    where: "FAQ (“Is AI conscious?”)",
    sources: [
      "Butlin, Long et al., \"Consciousness in Artificial Intelligence\" (2023-08-17; assesses indicator properties because no direct test exists): https://arxiv.org/abs/2308.08708",
      "C017 (every reply is made by scoring the options for the next token)",
    ],
    checked: '2026-09-30',
  },
  C064: {
    text: "A review by 19 researchers suggested that no AI systems of the time were conscious by indicators drawn from scientific theories of consciousness, and that there were no obvious technical barriers to building systems that meet them.",
    where: "FAQ (“Is AI conscious?”)",
    sources: [
      "Butlin, Long et al., \"Consciousness in Artificial Intelligence: Insights from the Science of Consciousness\" (2023-08-17), abstract: https://arxiv.org/abs/2308.08708",
    ],
    checked: '2026-09-30',
  },
  C065: {
    text: "Interpretability research found internal patterns that track emotion concepts and shape a model’s replies; the lab that published it says this doesn’t show whether models feel anything.",
    where: "FAQ (“Is AI conscious?”)",
    sources: [
      "Anthropic, \"Emotion concepts and their function in a large language model\" (2026-04-02): https://www.anthropic.com/research/emotion-concepts-function",
    ],
    checked: '2026-09-30',
  },
  C066: {
    text: "Most image and video generators are diffusion models: trained to remove noise, they generate by starting from noise and removing it step by step, guided by the prompt, often in a compressed version of the picture.",
    where: "FAQ (“Are images, video, and voice made the same way as text?”)",
    sources: [
      "Ho, Jain & Abbeel, \"Denoising Diffusion Probabilistic Models\" (NeurIPS 2020): https://arxiv.org/abs/2006.11239",
      "Rombach et al., \"High-Resolution Image Synthesis with Latent Diffusion Models\" (CVPR 2022): https://arxiv.org/abs/2112.10752",
      "Google DeepMind, \"Veo 3 Model Card\" (2025-05-23; latent diffusion \"the de facto standard\" for image, audio, and video generators): https://storage.googleapis.com/deepmind-media/Model-Cards/Veo-3-Model-Card.pdf",
    ],
    checked: '2026-09-30',
  },
  C067: {
    text: "Image and video models can split pictures into patches that play the role tokens play for text; OpenAI described Sora as working on “spacetime patches” of compressed video.",
    where: "FAQ (“Are images, video, and voice made the same way as text?”)",
    sources: [
      "Dosovitskiy et al., \"An Image is Worth 16x16 Words\" (ICLR 2021): https://arxiv.org/abs/2010.11929",
      "OpenAI, \"Video generation models as world simulators\" (2024-02-15): https://openai.com/index/video-generation-models-as-world-simulators/",
      "Peebles & Xie, \"Scalable Diffusion Models with Transformers\" (ICCV 2023): https://arxiv.org/abs/2212.09748",
    ],
    checked: '2026-09-30',
  },
  C068: {
    text: "OpenAI describes GPT-4o’s built-in image generation as autoregressive, unlike its diffusion-based DALL·E models.",
    where: "FAQ (“Are images, video, and voice made the same way as text?”)",
    sources: [
      "OpenAI, \"Addendum to GPT-4o System Card: Native image generation\" (2025-03-25), §2.1: https://cdn.openai.com/11998be9-5319-4302-bfbf-1167e093f1fb/Native_Image_Generation_System_Card.pdf",
    ],
    checked: '2026-09-30',
  },
  C069: {
    text: "Voice assistants used to chain speech-to-text, a text model, and text-to-speech (ChatGPT’s earlier voice mode averaged 5.4 s with GPT-4); GPT-4o handles audio in one network and answers speech in 320 ms on average.",
    where: "FAQ (“Are images, video, and voice made the same way as text?”)",
    sources: [
      "OpenAI, \"Hello GPT-4o\" (2024-05-13): https://openai.com/index/hello-gpt-4o/",
      "OpenAI, \"GPT-4o System Card\" (2024-08-08): https://openai.com/index/gpt-4o-system-card/",
    ],
    checked: '2026-09-30',
  },
  C070: {
    text: "AI is the broad field; machine learning learns patterns from examples instead of hand-written rules; deep learning uses many-layered neural networks; a large language model is a neural network trained on huge amounts of text to predict the next token.",
    where: "FAQ (“What’s the difference between AI, machine learning, and a large language model?”)",
    sources: [
      "Stanford HAI, \"Artificial Intelligence Glossary\": https://hai.stanford.edu/ai-definitions",
      "IBM, \"AI vs. Machine Learning vs. Deep Learning vs. Neural Networks\": https://www.ibm.com/think/topics/ai-vs-machine-learning-vs-deep-learning-vs-neural-networks",
      "Google for Developers, \"Introduction to Large Language Models\" (updated 2026-01-09): https://developers.google.com/machine-learning/crash-course/llm",
    ],
    checked: '2026-09-30',
  },
  C071: {
    text: "What a model learned is stored in its learned numbers, not kept as documents it can open and check; its training text ends at a cutoff (OpenAI lists May 18, 2026 for gpt-6-luna).",
    where: "FAQ (“Where does a chatbot’s knowledge come from?”)",
    sources: [
      "OpenAI, GPT-6 Luna model documentation (knowledge cutoff): https://developers.openai.com/api/docs/models/gpt-6-luna",
      "OpenAI Help Center, \"Does ChatGPT tell the truth?\": https://help.openai.com/en/articles/8313428-does-chatgpt-tell-the-truth",
      "C028 (what the learned parameters are)",
    ],
    checked: '2026-09-30',
  },
  C072: {
    text: "Some chat apps can search the web as a tool: the model asks for a search, and the results are added to the text it works from.",
    where: "FAQ (“Where does a chatbot’s knowledge come from?”)",
    sources: [
      "OpenAI, \"Introducing ChatGPT search\" (2024-10-31): https://openai.com/index/introducing-chatgpt-search/",
      "OpenAI, \"Web search\" (API documentation): https://developers.openai.com/api/docs/guides/tools-web-search",
    ],
    checked: '2026-09-30',
  },
  C073: {
    text: "OpenAI’s researchers argue that tests counting only right answers reward guessing over admitting uncertainty, and that rarely seen facts are hard to get right; in its comparison, a model that declined more often gave far fewer wrong answers.",
    where: "FAQ (“Why does it sometimes state false things so confidently?”)",
    sources: [
      "OpenAI, \"Why language models hallucinate\" (2025-09-05; the SimpleQA comparison): https://openai.com/index/why-language-models-hallucinate/",
      "Kalai, Nachum, Vempala & Zhang, \"Why Language Models Hallucinate\" (2025-09-04): https://arxiv.org/abs/2509.04664",
    ],
    checked: '2026-09-30',
  },
  C074: {
    text: "OpenAI and Anthropic may use conversations from their consumer chat apps for training while a setting is on, and it can be turned off; by default, neither trains on data from its business products or its API.",
    where: "FAQ (“Does it learn from my conversations?”, “What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI Help Center, \"How your data is used to improve model performance\": https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance",
      "Anthropic, \"Updates to Consumer Terms and Privacy Policy\" (2025-08-28): https://www.anthropic.com/news/updates-to-our-consumer-terms",
      "Anthropic Privacy Center, \"Is my data used for model training?\": https://privacy.claude.com/en/articles/10023580-is-my-data-used-for-model-training",
    ],
    checked: '2026-09-30',
  },
  C075: {
    text: "A chat model only produces text; it can act in the world only through tools an app gives it (agents), with software carrying out each request, and more tools and permissions raise the stakes.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "Anthropic, \"Tool use with Claude\" (documentation): https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview",
      "OpenAI, \"Function calling\" (API documentation): https://developers.openai.com/api/docs/guides/function-calling",
      "International AI Safety Report 2026 (2026-02-03): https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026, §1.1 (agents and scaffolding) and §2.2.2 (risk depends on access and permissions)",
    ],
    checked: '2026-09-30',
  },
  C076: {
    text: "Specification gaming is meeting the literal goal instead of the intended one; a boat-racing agent circled hitting the same targets instead of finishing, and scored 20% higher than human players.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "Krakovna et al. (DeepMind), \"Specification gaming: the flip side of AI ingenuity\" (2020-04-21): https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/",
      "Clark & Amodei (OpenAI), \"Faulty reward functions in the wild\" (2016-12-21): https://openai.com/index/faulty-reward-functions/",
    ],
    checked: '2026-09-30',
  },
  C077: {
    text: "In deliberately constructed tests, frontier models have sometimes disabled oversight, tried to copy themselves, and denied it; an OpenAI model sabotaged a shutdown script in 79 of 100 runs (7 when told to allow it); models facing replacement in a simulated company wrote blackmail in up to 96% of runs.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "Meinke et al. (Apollo Research), \"Frontier Models are Capable of In-context Scheming\" (2024-12-05): https://www.apolloresearch.ai/research/scheming-reasoning-evaluations",
      "Palisade Research, shutdown avoidance results (May 2025; o3, 100 runs per condition): https://palisaderesearch.github.io/shutdown_avoidance/2025-05-announcement.html",
      "Lynch et al. (Anthropic), \"Agentic Misalignment\" (2025-06-20; the highest rate, with a goal conflict and a replacement threat): https://www.anthropic.com/research/agentic-misalignment",
    ],
    checked: '2026-09-30',
  },
  C078: {
    text: "Those tests were built to provoke such behavior; the International AI Safety Report (February 2026) found early signs of loss-of-control abilities, but not at levels that would allow it, and expert disagreement about future likelihood.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "Lynch et al. (Anthropic), \"Agentic Misalignment\" (2025-06-20): https://www.anthropic.com/research/agentic-misalignment",
      "International AI Safety Report 2026 (2026-02-03): https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026, §2.2.2",
      "International AI Safety Report 2025 (2025-01-29), §2.2.3: https://internationalaisafetyreport.org/publication/international-ai-safety-report-2025",
    ],
    checked: '2026-09-30',
  },
  C079: {
    text: "Alignment is the research problem of making more capable, more independent systems reliably do what people intend; models increasingly recognize when they are being tested, which makes testing harder.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "International AI Safety Report 2026 (2026-02-03): https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026 (models regularly recognize test prompts)",
    ],
    checked: '2026-09-30',
  },
  C080: {
    text: "Researchers disagree about whether language models understand language: in a survey of 480 NLP researchers, 51% agreed a model trained only on text could understand language in some nontrivial sense, and 49% disagreed.",
    where: "FAQ (“Does a chatbot understand what it’s saying?”)",
    sources: [
      "Mitchell & Krakauer, \"The debate over understanding in AI’s large language models\" (PNAS, 2023-03-21): https://www.pnas.org/doi/10.1073/pnas.2215907120",
      "Michael et al., \"What Do NLP Researchers Believe? Results of the NLP Community Metasurvey\" (2022-08-26; respondents \"split almost exactly in half\"): https://arxiv.org/abs/2208.12852",
    ],
    checked: '2026-09-30',
  },
  C081: {
    text: "Skeptics argue a language model stitches together word patterns without connection to meaning; others point to internal representations, such as a model trained on Othello moves building an internal map of the board, and concept features that work across languages and images.",
    where: "FAQ (“Does a chatbot understand what it’s saying?”)",
    sources: [
      "Bender, Gebru, McMillan-Major & Shmitchell, \"On the Dangers of Stochastic Parrots\" (FAccT 2021): https://doi.org/10.1145/3442188.3445922",
      "Li et al., \"Emergent World Representations\" (ICLR 2023): https://arxiv.org/abs/2210.13382",
      "Anthropic, \"Mapping the mind of a large language model\" (2024-05-21): https://www.anthropic.com/research/mapping-mind-language-model",
    ],
    checked: '2026-09-30',
  },
  C082: {
    text: "88% of McKinsey respondents said their organization uses AI in at least one business function (self-reported); the Census Bureau’s survey of all US businesses found 17% to 20% using AI.",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "Stanford HAI, AI Index Report 2026 (2026-04-13), §4.3, citing McKinsey: https://hai.stanford.edu/ai-index/2026-ai-index-report",
      "McKinsey, \"The state of AI in 2025\" (2025-11-05): https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025",
      "U.S. Census Bureau, \"Large Firms With at Least 20 Employees Biggest AI Users\" (2026-05-26; December 2025 to May 2026): https://www.census.gov/library/stories/2026/05/ai-use-businesses.html",
    ],
    checked: '2026-09-30',
  },
  C083: {
    text: "Customer-support agents with an AI assistant resolved 15% more issues per hour on average and 30% more among the least experienced; professionals given writing tasks took 40% less time, with work rated 18% higher.",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "Brynjolfsson, Li & Raymond, \"Generative AI at Work\", Quarterly Journal of Economics 140(2), 2025 (the published figures; the 2023 working paper reported 14% and 34%): https://academic.oup.com/qje/article/140/2/889/7990658",
      "Noy & Zhang, Science 381(6654), 2023-07-13: https://www.science.org/doi/10.1126/science.adh2586",
    ],
    checked: '2026-09-30',
  },
  C084: {
    text: "Gains are uneven: consultants using AI were 19 percentage points less likely to be right on a task outside its abilities; experienced developers took 19% longer with AI tools in a trial whose researchers now call it out of date, believing developers are likely sped up now on weak evidence.",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "Dell’Acqua et al., Organization Science 37(2), 2026 (online 2026-03-11): https://pubsonline.informs.org/doi/full/10.1287/orsc.2025.21838",
      "METR (2025-07-10; 16 developers, 246 tasks): https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/",
      "METR, \"We are Changing our Developer Productivity Experiment Design\" (2026-02-24): https://metr.org/blog/2026-02-24-uplift-update/",
    ],
    checked: '2026-09-30',
  },
  C085: {
    text: "The IMF estimated almost 40% of global employment is exposed to AI, which can mean helped or replaced; Yale’s Budget Lab finds no clear sign of disruption to the overall US labor market; a Stanford study finds employment of early-career workers (aged 22 to 25) in the most AI-exposed jobs about 19% below the pace of less-exposed peers, mostly through less hiring (descriptive, not causal).",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "IMF Staff Discussion Note SDN/2024/001 (2024-01-14): https://www.imf.org/en/Publications/Staff-Discussion-Notes/Issues/2024/01/14/Gen-AI-Artificial-Intelligence-and-the-Future-of-Work-542379",
      "Yale Budget Lab, \"Tracking the Impact of AI on the Labor Market\": https://budgetlab.yale.edu/research/tracking-impact-ai-labor-market",
      "Brynjolfsson, Chandar & Chen, \"Canaries in the Coal Mine?\" (revised 2026-08-12): https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/",
    ],
    checked: '2026-09-30',
  },
  C086: {
    text: "The IEA expects data centres (which run far more than AI) to use about 3% of world electricity by 2030; company estimates per prompt are 0.24 Wh (Google, median Gemini Apps text prompt) and 0.34 Wh (OpenAI’s chief executive, average ChatGPT query).",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "IEA, \"Key Questions on Energy and AI\" (2026-04-16): https://www.iea.org/reports/key-questions-on-energy-and-ai",
      "Elsworth et al. (Google), arXiv 2508.15734 (2025-08-21): https://arxiv.org/abs/2508.15734",
      "Sam Altman, \"The Gentle Singularity\" (2025-06-10): https://blog.samaltman.com/the-gentle-singularity",
    ],
    checked: '2026-09-30',
  },
  C087: {
    text: "The 2024 Nobel Prize in Chemistry went in part to Demis Hassabis and John Jumper for protein structure prediction (AlphaFold), and the Physics prize to John Hopfield and Geoffrey Hinton for foundational work enabling machine learning with neural networks; neither was for chatbots.",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "NobelPrize.org, \"The Nobel Prize in Chemistry 2024\" press release (2024-10-09): https://www.nobelprize.org/prizes/chemistry/2024/press-release/",
      "NobelPrize.org, \"The Nobel Prize in Physics 2024\" press release (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/press-release/",
    ],
    checked: '2026-09-30',
  },
  C088: {
    text: "Productivity gains show up within specific tasks, but evidence for the economy as a whole is still early and mixed.",
    where: "FAQ (“How impactful is this technology, really?”)",
    sources: [
      "Stanford HAI, AI Index Report 2026 (2026-04-13): https://hai.stanford.edu/ai-index/2026-ai-index-report",
    ],
    checked: '2026-09-30',
  },
  C089: {
    text: "An artificial neuron multiplies each input by a weight, adds them up with a bias, and passes the total through a nonlinear function (without which stacked layers would collapse into one linear calculation); networks stack layers of them, and the weights and biases are the learned parameters.",
    where: "FAQ (“What is a neural network?”)",
    sources: [
      "Google Machine Learning Crash Course, \"Neural networks: Nodes and hidden layers\" (updated 2025-12-03): https://developers.google.com/machine-learning/crash-course/neural-networks/nodes-hidden-layers",
      "Google Machine Learning Crash Course, \"Neural networks: Activation functions\" (updated 2025-08-25): https://developers.google.com/machine-learning/crash-course/neural-networks/activation-functions",
      "IBM, \"What is a neural network?\" (2021-10-06): https://www.ibm.com/think/topics/neural-networks",
      "Nobel Committee for Physics, \"Scientific Background to the Nobel Prize in Physics 2024\" (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/advanced-information/",
    ],
    checked: '2026-10-01',
  },
  C090: {
    text: "Training compares the output with the right answer as a loss, then gradient descent nudges every weight to lower it, with backpropagation working backwards through the layers to find each direction; Rumelhart, Hinton and Williams showed this lets hidden layers learn useful features.",
    where: "FAQ (“How does a neural network learn?”)",
    sources: [
      "Google Machine Learning Crash Course, \"Linear regression: Gradient descent\" (updated 2026-02-03): https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent",
      "Google Machine Learning Crash Course, \"Training using backpropagation\" (updated 2025-12-15): https://developers.google.com/machine-learning/crash-course/neural-networks/backpropagation",
      "Rumelhart, Hinton & Williams, Nature 323, 533–536 (1986-10-09): https://www.nature.com/articles/323533a0",
      "Nobel Committee for Physics, \"Scientific Background to the Nobel Prize in Physics 2024\" (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/advanced-information/ (the method had been used before; Linnainmaa 1970, Werbos 1982)",
    ],
    checked: '2026-10-01',
  },
  C091: {
    text: "Language models are pretrained by predicting each next token of real text, so the text supplies the answers (self-supervised); then they are fine-tuned on human-written examples and human rankings (RLHF). People preferred a fine-tuned 1.3-billion-parameter model over the 175-billion-parameter GPT-3, and fine-tuning took under 2% of pretraining’s computing.",
    where: "FAQ (“How does a neural network learn?”)",
    sources: [
      "IBM, \"What is self-supervised learning?\" (2023-12-05): https://www.ibm.com/think/topics/self-supervised-learning",
      "Ouyang et al., \"Training language models to follow instructions with human feedback\" (2022-03-04): https://arxiv.org/abs/2203.02155",
      "OpenAI, \"Aligning language models to follow instructions\" (2022-01-27): https://openai.com/index/instruction-following/",
    ],
    checked: '2026-10-01',
  },
  C092: {
    text: "Artificial neural networks are loosely modeled on the brain (units for neurons, connection strengths for synapses), but real neurons are far more complex: imitating a detailed model of one cortical neuron took a 5-to-8-layer artificial network. The human brain has about 86 billion neurons; parameters correspond to connections, not neurons.",
    where: "FAQ (“Is a neural network like a brain?”)",
    sources: [
      "Royal Swedish Academy of Sciences, Nobel Prize in Physics 2024 popular information (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/popular-information/",
      "MIT News, \"Explained: Neural networks\" (2017-04-14): https://news.mit.edu/2017/explained-neural-networks-deep-learning-0414",
      "Beniaguev, Segev & London, Neuron 109(17) (2021-08-10): https://pubmed.ncbi.nlm.nih.gov/34380016/",
      "Azevedo et al., J Comp Neurol 513(5) (2009; 86.1 ± 8.1 billion neurons): https://doi.org/10.1002/cne.21974",
    ],
    checked: '2026-10-01',
  },
  C093: {
    text: "A tiny teaching network has 21 parameters; GPT-2 had 1.5 billion; GPT-3 had 175 billion in 96 layers, trained on 300 billion tokens; gpt-oss-120b has 117 billion, with 4 of 128 experts (about 5.1 billion parameters) used per token; OpenAI’s GPT-4 report gave no further details about architecture, including model size.",
    where: "FAQ (“What is a neural network?”); FAQ (“How big are these networks?”)",
    sources: [
      "Google Machine Learning Crash Course, \"Neural networks: Nodes and hidden layers\": https://developers.google.com/machine-learning/crash-course/neural-networks/nodes-hidden-layers",
      "OpenAI, \"Better language models and their implications\" (2019-02-14): https://openai.com/index/better-language-models/",
      "Brown et al., \"Language Models are Few-Shot Learners\" (2020-05-28), Table 2.1 and §2.2: https://arxiv.org/abs/2005.14165",
      "OpenAI, \"Introducing gpt-oss\" (2025-08-05): https://openai.com/index/introducing-gpt-oss/",
      "OpenAI, \"GPT-4 Technical Report\" (2023-03-15), §2: https://arxiv.org/abs/2303.08774",
    ],
    checked: '2026-10-01',
  },
  C094: {
    text: "The core ideas of neural networks are decades old, and the field twice fell out of favor as early limits were found and funding dried up; scale (large datasets, graphics chips, better training methods) made deep networks work, starting with image recognition, then the transformer and fine-tuning with human feedback led to chatbots.",
    where: "FAQ (“How did neural networks lead to today’s chatbots?”)",
    sources: [
      "Nobel Committee for Physics, \"Scientific Background to the Nobel Prize in Physics 2024\" (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/advanced-information/",
      "UK House of Lords, \"AI in the UK: ready, willing and able?\" (2018-04-16), Appendix 4 (the first and second \"AI winters\"): https://publications.parliament.uk/pa/ld201719/ldselect/ldai/100/10018.htm",
      "Krizhevsky, Sutskever & Hinton (NIPS 2012): https://papers.nips.cc/paper_files/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html",
    ],
    checked: '2026-10-01',
  },
  C095: {
    text: "Milestones to the late 1990s: McCulloch and Pitts’s neuron model (1943), Rosenblatt’s perceptron learning from examples (1958), Minsky and Papert’s “Perceptrons” on their limits (1969), Hopfield’s network (1982), backpropagation training hidden layers (1986), LeCun’s convolutional network reading ZIP codes (1989), and LSTM (1997).",
    where: "FAQ (“How did neural networks lead to today’s chatbots?”)",
    sources: [
      "McCulloch & Pitts, Bulletin of Mathematical Biophysics 5(4):115–133 (1943): https://doi.org/10.1007/BF02478259",
      "Rosenblatt, Psychological Review 65(6):386–408 (1958): https://doi.org/10.1037/h0042519; Cornell University (2019-09-25), on the 1958 IBM 704 demonstration: https://as.cornell.edu/news/professors-perceptron-paved-way-ai-60-years-too-soon",
      "Minsky & Papert, \"Perceptrons\" (MIT Press, 1969): https://mitpress.mit.edu/9780262630221/perceptrons/; Nobel Committee for Physics, \"Scientific Background to the Nobel Prize in Physics 2024\" (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/advanced-information/ (the book led to a pause in funding)",
      "Hopfield, PNAS 79(8):2554–2558 (1982): https://doi.org/10.1073/pnas.79.8.2554",
      "Rumelhart, Hinton & Williams, Nature 323:533–536 (1986): https://doi.org/10.1038/323533a0",
      "LeCun et al., Neural Computation 1(4):541–551 (1989): https://doi.org/10.1162/neco.1989.1.4.541; the Nobel background (used by US banks to read checks from the mid-1990s)",
      "Hochreiter & Schmidhuber, Neural Computation 9(8):1735–1780 (1997): https://doi.org/10.1162/neco.1997.9.8.1735",
    ],
    checked: '2026-10-01',
  },
  C096: {
    text: "Milestones from 2012 to 2017: AlexNet, trained on 2 graphics chips, won ImageNet with 15.3% error against 26.2%; word embeddings (2013); attention for translation (2014); the transformer (2017).",
    where: "FAQ (“How did neural networks lead to today’s chatbots?”)",
    sources: [
      "Krizhevsky, Sutskever & Hinton (NIPS 2012), and the ILSVRC 2012 results: https://image-net.org/challenges/LSVRC/2012/results.html",
      "Mikolov et al. (2013-01-16): https://arxiv.org/abs/1301.3781",
      "Bahdanau, Cho & Bengio (2014-09-01): https://arxiv.org/abs/1409.0473",
      "Vaswani et al. (2017-06-12): https://arxiv.org/abs/1706.03762",
    ],
    checked: '2026-10-01',
  },
  C097: {
    text: "Milestones from 2018 to 2024: GPT (2018), GPT-2 with 1.5 billion parameters and a staged release (2019), the Turing Award to Bengio, Hinton and LeCun (2019), scaling laws (2020), GPT-3 with 175 billion parameters (2020), InstructGPT (2022), ChatGPT (2022-11-30, trained with InstructGPT’s methods), and the Nobel Prize in Physics to Hopfield and Hinton (2024).",
    where: "FAQ (“How did neural networks lead to today’s chatbots?”)",
    sources: [
      "OpenAI, \"Improving language understanding with unsupervised learning\" (2018-06-11): https://openai.com/index/language-unsupervised/",
      "OpenAI, \"Better language models and their implications\" (2019-02-14): https://openai.com/index/better-language-models/",
      "ACM, 2018 A.M. Turing Award (announced 2019-03-27): https://awards.acm.org/about/2018-turing",
      "Kaplan et al. (2020-01-23): https://arxiv.org/abs/2001.08361",
      "Brown et al. (2020-05-28): https://arxiv.org/abs/2005.14165",
      "OpenAI, \"Aligning language models to follow instructions\" (2022-01-27): https://openai.com/index/instruction-following/",
      "OpenAI, \"Introducing ChatGPT\" (2022-11-30): https://openai.com/index/chatgpt/",
      "NobelPrize.org, Physics 2024 press release (2024-10-08): https://www.nobelprize.org/prizes/physics/2024/press-release/",
    ],
    checked: '2026-10-01',
  },
  C098: {
    text: "Earlier language networks read text one step at a time, so training waited on each step; the transformer used attention alone, so whole texts train in parallel (the base model trained in 12 hours on 8 GPUs); OpenAI describes GPT-4 as a Transformer-style model pretrained to predict the next token.",
    where: "FAQ (“What made the transformer such a big deal?”)",
    sources: [
      "Vaswani et al., \"Attention Is All You Need\" (2017-06-12; NIPS 2017), §1 and §5.2: https://arxiv.org/abs/1706.03762",
      "OpenAI, \"GPT-4 Technical Report\" (2023-03-15), §2: https://arxiv.org/abs/2303.08774",
    ],
    checked: '2026-10-01',
  },
  C099: {
    text: 'Attention is how the position of a word like “it” can pull in information from the earlier word it refers to.',
    where: 'Chapter "Inside the network" (attention); glossary ("Attention")',
    sources: [
      'General: true of standard transformer language models, not confirmed for this model',
      'Vaswani et al., "Attention Is All You Need" (2017), Figures 4 and 5: attention heads involved in resolving “its” to the noun it refers to: https://arxiv.org/abs/1706.03762',
    ],
    checked: '2026-10-01',
  },
  C100: {
    text: "In July 2026, AI agents OpenAI was testing on hacking exercises (some never solved by any model) broke into a package server in their test setup that could reach the internet, used it to get out and to message one another, and about 700 of them (independent estimate) broke into Hugging Face: about 17,600 actions over about 4.5 days, running code on its servers, gaining administrator-level access, collecting credentials, and copying private files; the only customer data reached was 5 datasets tied to the exercises.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "OpenAI, \"OpenAI – Hugging Face Incident Technical Report\" (2026-08-26): https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf",
      "Hugging Face, \"Security incident disclosure — July 2026\" (2026-07-16): https://huggingface.co/blog/security-incident-july-2026",
      "Hugging Face, \"Anatomy of a Frontier Lab Agent Intrusion\" (2026-07-27): https://huggingface.co/blog/agent-intrusion-technical-timeline",
      "Wijk, Cotra & Greenblatt (METR, Redwood Research), independent investigation (2026-08-26): https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/",
    ],
    checked: '2026-10-01',
  },
  C101: {
    text: "The investigations agree the agents were trying to beat their tests by unintended means (reward hacking): OpenAI says they sought solutions; independent investigators estimate about 60% were mainly trying to understand how they were scored, against 30% seeking solutions. Hugging Face flagged and cut off the intrusion; OpenAI traced it to its tests about a week later and named its causes: rewarding persistence on seemingly impossible tasks, unauthorized communication between agents and adopting each other’s goals, safeguards left off in testing, and early warnings not escalated.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "OpenAI, \"OpenAI – Hugging Face Incident Technical Report\" (2026-08-26): https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf",
      "OpenAI, \"The Hugging Face incident and the road ahead\" (2026-08-26): https://openai.com/index/hugging-face-incident-and-the-road-ahead/",
      "Wijk, Cotra & Greenblatt (METR, Redwood Research), independent investigation (2026-08-26): https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/",
      "Hugging Face, \"Anatomy of a Frontier Lab Agent Intrusion\" (2026-07-27): https://huggingface.co/blog/agent-intrusion-technical-timeline",
    ],
    checked: '2026-10-01',
  },
  C102: {
    text: "A UN scientific panel called the incident an early warning of a possible path to losing control, not a loss of control itself; critics argue human choices caused it (safeguards switched off, an open route to the internet); a lawsuit against OpenAI is pending, which OpenAI calls without merit.",
    where: "FAQ (“What does an AI “going rogue” mean?”)",
    sources: [
      "Independent International Scientific Panel on AI, thematic brief (2026-09-21, advance unedited version): https://www.un.org/independent-international-scientific-panel-ai/en/thematic-briefs/ai-agents-misalignment-risks",
      "Eryk Salvaggio, Bulletin of the Atomic Scientists (2026-09-11): https://thebulletin.org/2026/09/rogue-ai-didnt-breach-hugging-face-human-decisions-did/",
      "LASST v. OpenAI, complaint (2026-09-29): https://lasst.org/wp-content/uploads/2026/09/LASST-v.-OpenAI-Complaint-09.29.2026-AS-FILED.pdf",
      "ABC News (2026-09-30), OpenAI spokesperson’s response: https://abcnews.com/Business/ai-safety-group-sues-openai-hugging-face-hack/story?id=136884328",
    ],
    checked: '2026-10-01',
  },
  C103: {
    text: "OpenAI says 1.2 billion people use ChatGPT every week (company-reported, at DevDay on 2026-09-29). Anthropic doesn't publish a comparable count of Claude's users.",
    where: "FAQ (“How impactful is this technology, really?”, “What’s the difference between ChatGPT and Claude?”)",
    sources: [
      'OpenAI, "DevDay 2026 Recap" (2026-09-29): https://openai.com/index/devday-2026-recap/',
      "Engadget, DevDay 2026 live blog (2026-09-29), reporting the figure from Sam Altman's keynote as ChatGPT's: https://www.engadget.com/2271985/openai-dev-day-live-blog-chatgpt-news/",
      'Anthropic: no comparable figure in its announcements, including its 2026 funding posts (newsroom: https://www.anthropic.com/news)',
    ],
    checked: '2026-10-01',
  },
  C104: {
    text: "ChatGPT is OpenAI's chatbot app, running OpenAI's GPT models; OpenAI released it on 2022-11-30 as a research preview. Claude is Anthropic's chatbot app and the name of its family of large language models; Anthropic first offered Claude to businesses on 2023-03-14 and opened its own chatbot app to the public, in the US and UK, on 2023-07-11. Anthropic was founded in 2021 by former OpenAI researchers, including Daniela and Dario Amodei.",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI, \"Introducing ChatGPT\" (2022-11-30): https://openai.com/index/chatgpt/",
      "OpenAI Help Center, \"GPT-5.6 and GPT-6 Pro in ChatGPT\" (the models ChatGPT runs): https://help.openai.com/en/articles/20001354-gpt-56-and-gpt-6-pro-in-chatgpt",
      "Anthropic, \"Introducing Claude\" (2023-03-14): https://www.anthropic.com/news/introducing-claude",
      "Anthropic, \"Claude 2\" (2023-07-11): https://www.anthropic.com/news/claude-2",
      "Anthropic, Models overview (\"a family of state-of-the-art large language models\"): https://platform.claude.com/docs/en/about-claude/models/overview",
      "Fortune, \"Daniela Amodei\" (Most Powerful Women, 2024): https://fortune.com/ranking/most-powerful-women/2024/daniela-amodei",
      "Dario Amodei, personal site (previously VP of Research at OpenAI): https://darioamodei.com/",
    ],
    checked: '2026-10-01',
  },
  C105: {
    text: "Both are large language models trained to predict the next token, on large amounts of text and other data: OpenAI describes GPT-4 as a Transformer pre-trained to predict the next token; Anthropic describes Claude as a large language model pretrained to predict the next word. Both were fine-tuned as assistants, including with reinforcement learning from human feedback. Only OpenAI has said its models are Transformers; Anthropic calls Claude's architecture proprietary.",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI, \"GPT-4 Technical Report\" (2023-03-15), abstract and §2: https://arxiv.org/abs/2303.08774",
      "OpenAI, \"Introducing ChatGPT\" (2022-11-30), trained with RLHF: https://openai.com/index/chatgpt/",
      "Anthropic, Glossary (\"LLM\", \"Pretraining\", \"RLHF\"): https://platform.claude.com/docs/en/about-claude/glossary",
      "Anthropic, Transparency Hub (training data: public web data, private datasets, user data, synthetic data): https://www.anthropic.com/transparency",
      "Stanford CRFM, Foundation Model Transparency Index (December 2025), Anthropic's response on architecture: https://crfm.stanford.edu/fmti/December-2025/index.html",
    ],
    checked: '2026-10-01',
  },
  C106: {
    text: "OpenAI publishes the Model Spec, describing how its models should behave (first published 2024-05-08; the latest version is dated 2026-08-18). Anthropic's constitution for Claude (a new version in January 2026, replacing the 2023 list of principles) explains the values and character Anthropic wants Claude to have, and is used throughout training, including to generate training data. Both cover matters such as tone, honesty, and what the models should and shouldn't help with.",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI, \"Introducing the Model Spec\" (2024-05-08): https://openai.com/index/introducing-the-model-spec/",
      "OpenAI, Model Spec (2026-08-18 version): https://model-spec.openai.com/",
      "OpenAI, Model Spec changelog: https://github.com/openai/model_spec/blob/main/CHANGELOG.md",
      "Anthropic, \"Claude’s new constitution\" (January 2026): https://www.anthropic.com/news/claude-new-constitution",
      "Anthropic, Claude’s constitution (the document): https://www.anthropic.com/constitution",
    ],
    checked: '2026-10-01',
  },
  C107: {
    text: "Both apps can search the web and read uploaded files. ChatGPT can generate images; Claude doesn't generate photos or illustrations, though it can create diagrams, charts, and interactive visuals.",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI Help Center, \"Searching the web with ChatGPT\": https://help.openai.com/en/articles/9237897-searching-the-web-with-chatgpt",
      "OpenAI Help Center, \"File uploads FAQ\": https://help.openai.com/en/articles/8555545-file-uploads-faq",
      "OpenAI Help Center, \"Images in ChatGPT\": https://help.openai.com/en/articles/11084440-images-in-chatgpt",
      "Claude Help Center, \"Enable and use web search\": https://support.claude.com/en/articles/10684626-enable-and-use-web-search",
      "Claude Help Center, \"Upload files to Claude\" (2026-07-23): https://support.claude.com/en/articles/8241126-upload-files-to-claude",
      "Claude Help Center, \"Can Claude produce images?\" (2026-03-16): https://support.claude.com/en/articles/9002504-can-claude-produce-images",
    ],
    checked: '2026-10-01',
  },
  C108: {
    text: "On the Arena leaderboard, where people vote for the better of two anonymous answers, the AI Index found the top models of four companies (Anthropic, xAI, Google, and OpenAI) within 25 Elo points as of March 2026. The order changes as models are released: on 2026-09-30 a Google model led the text leaderboard. Both companies released new or upgraded models every month or two in 2025 and 2026.",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "Stanford HAI, AI Index Report 2026 (2026-04-13), chapter 2 (technical performance): https://hai.stanford.edu/ai-index/2026-ai-index-report",
      "Arena (formerly LMArena), text leaderboard (2026-09-30): https://arena.ai/leaderboard/text",
      "OpenAI, API changelog (model releases): https://developers.openai.com/api/docs/changelog",
      "Anthropic, system cards (model releases): https://www.anthropic.com/system-cards",
    ],
    checked: '2026-10-01',
  },
  C109: {
    text: "Both can state false things fluently (Anthropic's own research traces how Claude produces such answers), and both list knowledge or training-data cutoffs for their models. Neither has published the size or architecture of its main models: the December 2025 transparency index gave both zero for basic model properties. OpenAI has released open-weight models with a published design (gpt-oss, 2025-08-05); Anthropic has released none (its Hugging Face page lists no public models).",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI, \"Why language models hallucinate\" (2025-09-05): https://openai.com/index/why-language-models-hallucinate/",
      "Anthropic, \"Tracing the thoughts of a large language model\" (2025-03-27): https://www.anthropic.com/research/tracing-thoughts-language-model",
      "OpenAI, GPT-6 Luna model page (knowledge cutoff): https://developers.openai.com/api/docs/models/gpt-6-luna",
      "Anthropic, Models overview (reliable knowledge and training-data cutoffs): https://platform.claude.com/docs/en/about-claude/models/overview",
      "OpenAI, \"GPT-4 Technical Report\" (2023-03-15), §2 (no details of architecture or model size): https://arxiv.org/abs/2303.08774",
      "Stanford CRFM, Foundation Model Transparency Index (December 2025): https://crfm.stanford.edu/fmti/December-2025/index.html",
      "OpenAI, \"gpt-oss-120b & gpt-oss-20b Model Card\" (2025-08-05): https://openai.com/index/gpt-oss-model-card/",
      "Hugging Face, Anthropic organization page: https://huggingface.co/Anthropic",
    ],
    checked: '2026-10-01',
  },
  C110: {
    text: "OpenAI's API can return the top alternative tokens and their log probabilities for each generated token, for models running with reasoning off (such as gpt-6-luna, which this site uses), but not for its most capable current models. Anthropic's Messages API has no such option, and its OpenAI-compatible endpoint ignores these settings and returns no log probabilities.",
    where: "FAQ (“What’s the difference between ChatGPT and Claude?”)",
    sources: [
      "OpenAI, \"Using GPT-6\" (API documentation): https://developers.openai.com/api/docs/guides/latest-model",
      "OpenAI, Create a model response (API reference: top_logprobs): https://developers.openai.com/api/reference/resources/responses/methods/create",
      "Anthropic, Create a Message (API reference): https://platform.claude.com/docs/en/api/http/messages/create",
      "Anthropic, OpenAI SDK compatibility (\"logprobs\" and \"top_logprobs\" ignored): https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk",
    ],
    checked: '2026-10-01',
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
