# Site audit — How does an AI work?

Audit date: 2026-10-02. Scope: the working checkout and its locally rendered production build, using recorded samples and the mock OpenAI service. This is a report, not an implementation change.

## Summary: ten priorities

1. **T1-1 · High · Verified:** clearing an outstanding request can let its callbacks terminate the next request.
2. **T2-1 · High · Verified:** replies containing text without alternatives receive contradictory “total token” counts; the montage counts text segments as tokens.
3. **T2-2 · Medium · Verified:** a reported hidden-reasoning count does not disable the ordinary token-by-token walkthrough, despite rule A4.
4. **T2-3 · Medium · Verified:** the privacy notice understates the provider’s current exceptions to default abuse-log retention.
5. **T1-2 · Medium · Verified:** glossary definitions extend beyond the screen at 320 px, making the explanations needed by newcomers partially unreadable.
6. **T1-3 · Medium · Verified:** the text alternative refers to a temperature table and controls that it does not include.
7. **T3-1 · Medium · Verified:** the opening probability charts explain “logprobs” before explaining what the percentages mean.
8. **T4-1 · Medium · Verified layout / Suspected learning impact:** the network lesson follows a substantial caveat and graphic; on a narrow phone these precede the teaching caption by nearly a screen.
9. **T3-2 · Medium · Verified:** the first network caption introduces too many distinct concepts at once, despite passing its word limit.
10. **T2-4 · Low · Verified:** “unfinished replies aren’t sent again” contradicts the handling of signed length-limited replies.

No critical issue was verified. Passing automated tests do not cover the reproduced store race or the trace-to-lesson edge cases above. “Verified” means the stated code behavior, source mismatch, copy, or layout was observed; it does not mean a usability study established its effect on readers.

## Method and checks

Read `CLAUDE.md` (especially §§3 and 8), `docs/PLAN.md`, ADRs 0005 and 0007–0012, the claims register, the copy modules, and the relevant implementation. Separate review passes covered technical/accuracy concerns and newcomer reading. Existing exclusions in the request are not findings below.

The initial `git status --short` returned no entries, despite the request describing uncommitted changes. The checkout was audited as found. No application source, configuration, fixtures, or tests were edited. No commit, push, deployment, real OpenAI request, or direct inspection of `.env.local` values was performed. The normal build/test tools generated their usual ignored outputs. No screenshot files were added: rendered evidence is recorded below as exact text and DOM measurements, consistent with the report-only restriction.

| Check | Result |
|---|---|
| `npm run check` — type generation / TypeScript | Passed |
| `npm run check` — ESLint | Passed |
| Initial Vitest startup | Sandbox blocked a worker with `spawn EPERM`; this is an audit-environment failure, not a site finding |
| `npm test` with worker access | 221 passed, 1 failed out of 222; no type errors |
| Unit failure | The already-known busy-day Redis simulation exceeded 5,000 ms at `src/server/limits/limits.test.ts:180`; not reported as a new finding |
| `npm run build`, run separately after that failure | Passed; all nine static-generation entries completed |
| `node scripts/check-client-bundle.mts` | Passed: 15 scripts, 1,318.1 KB raw / 380.9 KB gzip; no key-pattern, secret-variable-name, or oversized server-only chunk match. Run directly with a fake key, without the npm wrapper that loads `.env.local` for exact-secret comparison |
| `npm run test:e2e -- --workers=2` | **47 passed in 2.2 minutes**, against the configured mock upstream |

The E2E suite exercised streaming, Stop/retry, error states, signed follow-ups, offline sample replay, keyboard navigation, reduced motion, provenance checks, security headers, narrow layouts, and existing axe checks. Its local BotID warnings do not establish a deployed BotID defect. Deployment behavior was not inferred from them.

The requested separate dev server could not start because the owner’s dev server held the repository lock. It was not stopped or used. Manual rendering used a freshly built production server on port 3100 with `OPENAI_BASE_URL=http://127.0.0.1:3299/v1`, a fake API key, memory limits, and an audit-only signing secret. Port 3000 was not used.

Manual browser review covered the landing page, `/sample`, all 26 Simple scenes for the second sample reply at 320 px and 1440 px, all 28 Detailed scenes at desktop width, the seven deep-dive/exercise panels, glossary interactions, text alternative, FAQ, and privacy. Playback was started, paused, and stepped through; this was not an uninterrupted seven-minute watch at default speed. Dark and light appearances were inspected. Additional 390 px and 720 px views were checked. The 720 px check is a compact reflow check, not proof of native 200% browser zoom behavior.

## Task 1 — Technical issues and possible bugs

### T1-1 — An old request can terminate the request sent after Clear

**Severity:** high. **Status:** Verified, deterministic store-level reproduction.

**Where:** `src/generation/conversation-store.ts:226`, `:245`, `:292`; enabled Clear control at `src/components/chat/ChatApp.tsx:130`.

**Evidence:** two calls to the actual conversation store with separately controlled, in-memory `sendTurn` promises produced:

```text
before old finishes {"streaming":true,"turns":[{"text":"second","done":false}]}
after old finishes  {"streaming":false,"turns":[{"text":"second","done":true,"terminal":"network_error"}]}
```

Both runs close over shared mutable `working` and `controller` variables. Clear aborts the old controller and immediately publishes `streaming: false`. The old run’s `finally` can then insert `network_error` into the new working turn, null its state, and mark streaming false. Late callbacks can likewise act on the wrong turn.

**Reproduce:** inject a `sendTurn` dependency that holds request A unresolved; call `send('first')`, `clear()`, then `send('second')`; resolve A while B is still pending. Observe B marked done with a network error. In the UI the corresponding sequence is send on a delayed mock connection → Clear conversation → immediately send another message before the first abort settles. The race was controlled at store level, not claimed as a reliably hand-timed browser reproduction.

**Why it matters:** clearing should create a fresh conversation. Instead, a prior request can corrupt the new reply and discard its subsequent events.

**Suggested fix:** keep working state and controller local to each run, associate callbacks/finalization with a generation identity, and invalidate A before Clear permits B. Old runs must not publish into or finalize newer runs. Add a deterministic delayed-abort regression test.

### T1-2 — Glossary popup overflows a narrow viewport

**Severity:** medium. **Status:** Verified in the browser.

**Where:** landing page → Tokens card → “tokens” definition, 320 × 800; `src/app/styles/components.css:340` (especially `left: 0` and `max-width: min(20rem, 80vw)`). The shared component affects other term positions too.

**Evidence:** with the definition open, DOM measurements were:

```text
viewport width: 320
tooltip x: 148.984375
tooltip width: 256
tooltip right: 404.984375
document scrollWidth: 405
```

The screenshot inspected during the audit showed definition text clipped on the right. Limiting popup width to 80vw does not account for the term’s horizontal position.

**Reproduce:** open `/` at 320 px; scroll to “What you’ll see”; activate the underlined “tokens” term in the Tokens card. Read the popup’s right side and compare its bounding rectangle with the viewport. No API call is involved.

**Why it matters:** the site’s plain-language approach depends on these definitions. A reader who needs one cannot read it comfortably; opening it also introduces horizontal overflow.

**Suggested fix:** position definitions within the viewport with collision handling, or use an inline expandable definition on narrow screens. Verify terms near either edge and within scrolling panes, including touch and keyboard activation. Collision handling can be a styling/positioning fix; switching to inline definitions changes layout.

**Rejected hypothesis:** source inspection suggested Escape might not close a focused definition. On the fresh rendered build, opening “tokens” and pressing Escape changed `aria-expanded` to `false`. That hypothesis is not reported as a bug.

### T1-3 — The text alternative omits the data its copy refers to

**Severity:** medium. **Status:** Verified in rendered DOM and source.

**Where:** `/sample` → Read as text → “What if the temperature were different?”, Simple; `src/components/walkthrough/Transcript.tsx:34` and `:48`; also `src/playback/compile/compile.ts:42`.

**Evidence:** the transcript says “Try other settings: the chances below are computed on this page from the same scores.” Its temperature section contains zero tables and no temperature input or adjustment buttons; its only button is the glossary term. The animated-view deep dive has a real options table and temperature controls. The transcript renders `step.describe` and deep-dive paragraphs, not their associated visual data. The ordinary options scene likewise reduces to caption text rather than supplying the option table.

**Reproduce:** open `/sample`, select How it works on a narrow screen, and activate Read as text. Find the temperature section. Look for the promised chances and a way to change the setting. Compare with Show the walkthrough → last step → temperature deep dive. No API request is involved.

**Why it matters:** CLAUDE §8 promises the whole lesson in headings and tables. Readers choosing the text version receive an instruction they cannot follow and lose the comparison that makes the explanation concrete. This is a content-parity issue; it does not claim screen readers cannot use the ordinary view.

**Suggested fix:** render accessible labeled option/temperature tables and usable controls, or provide an explicitly linked equivalent panel. Reuse the same data calculations. At minimum remove references to absent content, but copy removal alone would not supply the promised equivalent lesson.

## Task 2 — Validity and accuracy

### T2-1 — Missing-alternative text breaks the token-count story

**Severity:** high for the central educational promise. **Status:** Verified with recorded data.

**Where:** `src/stages/probs/build.ts:39`, `src/stages/loop/build.ts:33`, `src/content/walkthrough.ts:53` and `:252`; Hook and montage, Simple and Detailed.

**Evidence:** mapping the recorded `fixtures/probe/gpt-6-luna/stream-unicode.json` deltas into the app protocol, finalizing, and compiling produced:

```text
text: Hi 👋🏽 — 你好, مرحبا, ¡olé! 🧑‍🚀
tokens with alternatives: 12
local token estimate for gaps: 9
rendering segments: 16
Hook: “Your reply came back as 12 … tokens, written one at a time,
       with scored options at every step.”
Montage: “This repeats for every token: 16 … in all.”
```

The Hook uses `providerTokenCount`, which counts entries with alternatives, as the total. The montage counts segments, including each missing-alternative text segment as a single token. A segment can contain several locally estimated tokens. Neither number is an established total for the entire visible reply.

**Reproduce:** use the recorded Unicode stream to construct a trace with its actual delta text and alternatives, run `finalizeTrace`, then `compileScript(trace, { depth: 'simple' })`; compare the Hook and montage captions with `output.providerTokenCount`, gaps, and segments. Preserve missing alternatives rather than synthesizing them. No new recording is needed.

**Why it matters:** the same reply teaches two incompatible totals and promises scored options for positions without them. This violates A2/A5 even though the displayed numbers carry Calculated labels. A correct label does not make the quantity correctly named.

**Suggested fix:** separately name “tokens with alternatives” and “text without alternatives.” If displaying a combined local estimate, label it Calculated and approximate, state its assumptions, and reconcile it with reported usage. Do not use segment count as token count. Adapt both captions when gaps exist and retain the missing-alternative notice.

### T2-2 — Hidden reasoning does not gate per-token claims

**Severity:** medium. **Status:** Verified using an in-memory fixture variation; not observed on the default live model.

**Where:** `src/trace/finalize.ts:550`, `src/playback/compile/compile.ts:50`, `src/components/walkthrough/Walkthrough.tsx:85`.

**Evidence:** copying the sample’s first trace in memory and setting end-event `usage.reasoningTokens` to 12 yielded:

```text
reasoningGate: false
compiled: true
steps: 24
```

The normal Hook and per-token lesson still appeared in the compiled script. The gate is exposed to the Inspector but is not a condition in `canCompile` or the stage compilation sequence. Unknown usage also permits the usual story.

**Reproduce:** clone a recorded sample log in memory; change only the reasoning count in its end usage; finalize and compile Simple depth. Inspect the gate and resulting descriptions. Separately omit usage to test the unknown case.

**Why it matters:** A4 requires an opaque hidden-token count and suppression of per-token claims when reasoning is present. The configured `reasoning.effort: none` makes this less likely today, but the safeguard does not protect against changed provider behavior or another recorded trace.

**Suggested fix:** enforce the gate in compilation/rendering. Present a labeled hidden-token count without fabricated internals and use conservative wording when the count is unknown. Add nonzero and absent-usage cases to the compiler tests.

### T2-3 — The retention notice omits a current exception

**Severity:** medium. **Status:** Verified against the cited primary source.

**Where:** `src/components/chat/PrivacyNotice.tsx:15`, `src/app/privacy/page.tsx:69`, C003 at `src/content/claims.ts:33`.

**Evidence:** the short notice says “up to 30 days.” The privacy page adds only “or longer where the law requires it.” The current [OpenAI data-controls page](https://developers.openai.com/api/docs/guides/your-data), in “Data retention controls for abuse monitoring,” also allows longer retention when reasonably necessary to protect its services or third parties from harm. Checked during this audit.

**Reproduce:** compare the notice before the first chat message, the privacy page, and that section of the linked source.

**Why it matters:** the notice can be read as a maximum, and the fuller page still understates the exception. This matters when visitors choose what to send.

**Suggested fix:** describe the duration as the default and disclose both legal and harm-prevention exceptions, with the source link. Keep any numeric duration a sourced value under the project’s label rules. Update C003 and its check date. The existing claim that cached application state can persist up to 24 hours remains supported and is not a finding.

### T2-4 — “Unfinished” is broader than the history policy

**Severity:** low. **Status:** Verified in code and an in-memory history reproduction.

**Where:** `src/content/walkthrough.ts:293`; `src/server/chat/handler.ts:419`; `src/generation/conversation-store.ts:133`; `src/trace/finalize.ts:533`. Rendered at `/sample` → follow-up → “The chat so far is sent again,” Detailed.

**Current text:** “Stopped or unfinished replies aren’t sent again.”

**Evidence:** the handler signs both `completed` and `incomplete` outcomes. A matching incomplete sample with a length-limit reason and signature survived finalization and produced:

```text
{"signed":true,"sentRoles":["user","assistant"],"reason":"max_output_tokens"}
```

**Reproduce:** create the variation in memory with `outcome: incomplete`, `incompleteReason: max_output_tokens`, and a signature, preserving the matching relay hash; finalize and pass it through `historyFor`. Compare this with the server branch that signs incomplete outcomes. This reproduction demonstrates client selection; it does not claim a fabricated signature would pass server HMAC verification.

**Why it matters:** a reader may expect a length-limited reply to be left out, but it can return as context on the next request.

**Suggested fix:** narrow the copy to “Replies stopped by you or a lost connection aren’t sent again.” Keep the rest of the memory explanation. If the intended policy includes all incomplete replies, change the signing/history policy instead and test it.

### T2-5 — The understanding survey uses the wrong respondent denominator

**Severity:** low. **Status:** Verified against the original paper.

**Where:** `src/content/faq.ts:999`, `src/content/faq-facts.ts:109`, C080 at `src/content/claims.ts:565`; FAQ → whether AI understands.

**Current text:** “In a survey of [480] researchers who study language technology, [51%] agreed … and [49%] disagreed.” Bracketed values are the existing Reference slots.

**Evidence:** the [original NLP Community Metasurvey paper](https://arxiv.org/pdf/2208.12852), page 4, distinguishes 480 completed responses from the 327 respondents meeting the target-demographic criteria. It restricts subsequent reported results to that subset. The understanding result on page 12 uses that qualifying group. The site's percentages are supported, but attaching them to all 480 respondents misstates the analysis population.

**Reproduce:** compare the FAQ paragraph and `surveyRespondents` with the paper's participant-filtering section and understanding result.

**Why it matters:** a precise, labeled Reference number should identify the population actually behind the percentage. The badge and source link currently lend precision to the wrong denominator.

**Suggested fix:** change the sourced denominator to 327 and say “Among the researchers who met the survey's participation criteria…”; alternatively omit the respondent count and say “Researchers in this survey were nearly evenly divided…” while retaining the percentages and their labels. Update C080 and its checked date. No new substantive claim is needed beyond the source's stated inclusion criteria.

### Accuracy checks that did not produce findings

The normal supported paths for `exp(logprob) × 100`, the unlisted remainder, conditional temperature softmax, and cost calculation were inspected; no arithmetic defect was established. The temperature panel explicitly limits its hypothetical distribution to listed options. Close calls are labeled as wording choices, not correctness. Ordinary token IDs are Calculated; schematic internals use Example frames; timing distinguishes measured delivery from invisible compute phases. The E2E provenance check passed. These observations do not establish that every individual value and accessible name is correct under every trace.

## Task 3 — Explanations that could be simpler

These are proposed copy changes only. Inline `term()` examples below express the intended glossary markup; JSX legends need the equivalent `<Term>`. Existing `Datum` values and badges should remain. No rewrite was applied to the app.

### T3-1 — Say what a percentage means before naming logprobs

**Severity:** medium. **Status:** Verified copy and first-use order; reader misconception is a reasoned risk.

**Where:** `src/app/landing-graphics.tsx:70`; `src/components/walkthrough/OptionBars.tsx:73`; `src/content/walkthrough.ts:51`; landing hero and Simple Hook, phone and desktop.

**Current text:** “percentages, from its logprobs”; “Percentages: Calculated from its logprobs”; “[token] was picked at [percentage].”

**Evidence:** the rendered landing hero displays `40.3%` and its calculation-method legend before the Tokens card introduces tokens. The Simple Hook shows `98.6%` versus `1.36%` and the same unmarked “logprobs” term. The direct “not truth” explanation comes later in the lesson; the Hook’s clarification is at Detailed depth.

**Why it matters:** a phone skimmer needs the meaning of the number here, not the technical name for the source format. The current order leaves room for PLAN §2’s probability-equals-truth misconception.

**Rewrite the legend, retaining the real label components:**

```ts
st`Chance this piece comes next, not chance it is true. Recorded: token text from OpenAI. Calculated: percentages from its ${term('logprob', 'logprobs')}.`
```

**Meaning preserved:** returned text is Recorded; percentages are Calculated from returned logprobs; likelihood concerns a continuation rather than factual correctness. Reuse C011/C035 and add the landing/chart legends to C035’s locations. This changes copy and term markup, not layout; it introduces no new numeric claim.

### T3-2 — Separate learned numbers from temporary calculations

**Severity:** medium. **Status:** Verified copy; cognitive burden is an expert reading judgment.

**Where:** `src/content/walkthrough.ts:143`, Simple “Each token becomes a list of numbers”; following layers caption; `src/stages/network/View.tsx:40`.

**Current text:** “Each token picks out a list of numbers the model learned in training: its embedding. Tokens used in similar ways get similar lists, like nearby places on a map. What’s computed from them is working notes, discarded afterwards.”

**Why it matters:** this introduces learned numbers, embedding lookup, similarity, temporary calculations, and their lifetime together. A word-count pass does not ensure one new idea per step. The important fixed-versus-temporary distinction is easy to lose.

**Rewrite the lookup caption:**

```ts
st`Each ${term('token', 'token')} selects an ${term('embedding', 'embedding')}: a list of ${term('parameters', 'numbers learned during training')}. Tokens used in similar ways have similar lists, like nearby places on a map. The learned numbers stay fixed while you chat.`
```

**Move the temporary-notes explanation to the existing next caption:**

```ts
st`The model uses those lists to compute temporary ${term('working-notes', 'working notes')}, which it discards afterwards. The notes pass through ${term('layer', 'layers')}, like stations on an assembly line. All ${term('position', 'positions')} in your message are processed together, layer by layer.`
```

Each proposed Simple caption stays under 48 words. Keep Example framing and the Detailed architecture qualifications.

**Meaning preserved:** embedding lookup and similarity, fixed learned parameters, temporary computed values, eventual discard, layers, and parallel prompt processing. Retain C028/C046/C096 on lookup; add C028 to the layers scene’s claim list. This redistributes copy between existing scenes, without a layout change.

### T3-3 — Make independently linked FAQ summaries self-contained

**Severity:** low. **Status:** Verified source copy.

**Where:** `src/content/faq.ts:540` (`/faq#training`) and `:890` (`/faq#transformer`).

**Current text:** “It makes a prediction, measures how wrong it was, and nudges every weight a little toward a better answer…”; “It let every position in a text draw directly on earlier positions through attention, and it could be trained in parallel on graphics chips.”

**Why it matters:** anchor links allow entry here without reading earlier answers. “Weight,” “position,” and “attention” therefore need their explanations in these summaries, not only elsewhere on the page.

**Proposed summaries:**

```ts
st`It makes a prediction, compares it with an example’s answer, and adjusts its ${term('parameters', 'learned numbers')} to reduce the error. Repeating this across many examples is ${term('training', 'training')}.`

st`It let a training text be processed all at once on graphics chips. ${term('attention', 'Attention')} lets each token’s ${term('position', 'position')} draw directly on itself and earlier positions. This made much bigger language models practical.`
```

**Meaning preserved:** prediction-error training and parameter adjustment; parallel training and causal language-model attention, including the current position. Existing C090/C098 and the answer’s attention explanation support these; keep the scope as language models rather than implying every Transformer uses causal attention. No new figures or layout change.

## Task 4 — Layouts that could be easier to follow

These are recommendations for the owner to review, not permission requests or changes made by this audit. Both are layout changes under ADR 0009.

### T4-1 — Put the network lesson before its caveat and drawing

**Severity:** medium. **Status:** Verified rendered order and dimensions; Suspected effect on comprehension.

**Where:** `/sample` → Network → “Each token becomes a list of numbers,” Simple, 320 × 800; `src/components/walkthrough/Walkthrough.tsx:215`; `src/content/walkthrough.ts:138`.

**Evidence:** the repeated banner precedes the stage, and the caption follows it. At 320 px the banner measured 186.5 px high and the lookup stage 586.625 px, before the caption’s 257.75 px. The banner begins “The network, options, and pick steps repeat for every new token…” and also covers saved work, unpublished architecture, and the gpt-oss exception. This finding is separate from the excluded lane-indicator redesign.

**Why it matters:** a skimming newcomer meets qualifications and an unfamiliar diagram before the sentence telling them what to learn. Chapter navigation near the bottom can also leave the earlier drawing above the current viewport.

**Suggested reformat:**

```text
Scene title
Short teaching caption
Contains examples · This is not the hosted model’s measured internals
Graphic, retaining every local Example/data label
[About these example drawings ▾]
```

Retain the full caveat, including saved work and the gpt-oss exception, in the expandable explanation. Keep Example status visible without opening it. Review how chapter changes orient the reader to the new heading without unexpectedly moving keyboard focus. **Layout change**, requiring owner approval before implementation.

### T4-2 — Compact the FAQ index on phones

**Severity:** low. **Status:** Verified dimensions; Suspected reading burden.

**Where:** `/faq`, 320 × 800; `src/app/faq/page.tsx:108`; `src/app/styles/pages.css:109` and `:128`.

**Evidence:** on initial load, the question index started at y=549.31 and measured 1,008.77 px tall; the first answer began at y=1,633.42. All nineteen question links precede the answers. The links do let readers jump directly; this is not a claim that answers are inaccessible.

**Why it matters:** a phone visitor reading naturally must pass a long index before the first short answer. The desktop’s useful adjacent index becomes a large preliminary block on a phone.

**Suggested reformat:** a compact “Choose a question” disclosure above the first answer, containing the existing grouped anchor links. Preserve direct links and offer “Back to questions” after long answers. Keep source access next to each answer. **Layout change**, requiring owner approval before implementation.

## Source verification and coverage limits

The register contains 110 claims. Reading its entries and passing the synchronization test is not equivalent to independently verifying every source. The source review below records what was actually checked; compound claims can be only partly supported by a checked source. Source dates printed in the site were not treated as proof of current validity.

| Claims / subject | Result and evidence inspected |
|---|---|
| C001–002, C006–008, C018–019, C021, C043–045, C051 — this app | Reviewed against handler, adapter, persistence, signing/limits, context policy, rendering, and sample implementation, with the passing existing tests as additional evidence. This supports app behavior, not undisclosed production/account configuration. T1-1 and T2-4 qualify the clearing/history story. |
| C003–005 — retention/training | Current [data controls](https://developers.openai.com/api/docs/guides/your-data) supports API opt-in training and cached-state retention; C003 needs the exception correction in T2-3. No independent check of the owner's opt-in setting. |
| C009 — BotID | Client/server wiring and local test behavior reviewed. Production browser enforcement not independently verified. |
| C010–011, C015–016, C025, C037, C048, C050 — probe-dependent observations | Read against the recorded probe/ADR account, trace math, missing-alternative data and rendering. No new live probe. An observed fixed usage gap or temperature behavior is evidence for the recorded model/date, not proof that provider behavior can never change. T2-1 identifies the downstream count defect. End-marker wording remains explicitly an inference. |
| C012–013, C023, C031, C034–036, C038, C041, C046, C055 — methods/design/general framing | Compared with code, sampling math, sample data and the project's stated scope. API alternatives and constraints also checked through the current references used for C110. No separate hosted-internals verification is possible. Several register entries cite general principles or project rules rather than an independent publication; this audit does not upgrade those entries into external evidence. |
| C014, C020, C039–040 — caching | [Prompt-caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) supports saved KV state, provider-added content, no change to generation and nondeterminism. |
| C017, C028–030, C032–033, C098 — Transformer mechanisms | [Transformer paper](https://arxiv.org/html/1706.03762v7) checked for masked decoder attention, embedding lookup, softmax, positionwise feed-forward operations and parallelism. These support general mechanisms, not confirmation of this hosted model's architecture. |
| C022, C032, C049, C052–053, C096 — tokenization, position, context and patterns | BPE, RoFormer, Lost in the Middle, IOI, induction-head and word-vector paper pages inspected. Several checks were abstract-level corroboration, not full figure/appendix audits. |
| C024, C027, C045, C047, C071 — model documentation | [Configured model page](https://developers.openai.com/api/docs/models/gpt-6-luna) checked for context/output limits, cutoff, prices and reasoning support. Its knowledge-cutoff field alone does not prove the stronger wording that every item of training text ends on that date. Training-storage explanations were not independently established from that page. |
| C026 — letter miscount explanation | Copy and scope reviewed. The register gives a general assertion rather than an independently checkable citation; its causal explanation was not independently verified. |
| C054 — memory | Context-versus-parameter distinction reviewed in copy/implementation. The saved-memory source was not independently reverified in full. |
| C056–061 — interpretability and self-explanations | [Anthropic tracing research](https://www.anthropic.com/research/tracing-thoughts-language-model) supports rhyme planning, partial coverage, expert-analysis time and the addition example; [introspection research](https://www.anthropic.com/research/introspection) supports unreliability. Not every source or clause of these compound claims was independently checked, especially C056–058 and C061. |
| C062–065 — faithfulness/consciousness/emotion | [Faithfulness study](https://www.anthropic.com/research/reasoning-models-dont-say-think), [consciousness review](https://arxiv.org/abs/2308.08708), and [emotion research](https://www.anthropic.com/research/emotion-concepts-function) support the checked figures and distinctions between behavior/concept patterns and subjective experience. |
| C066–069 — image/video/voice | DDPM/LDM and Sora sources, the [Veo 3 model card](https://storage.googleapis.com/deepmind-media/Model-Cards/Veo-3-Model-Card.pdf), GPT-4o's image system card and [Hello GPT-4o](https://openai.com/index/hello-gpt-4o/) support the checked architecture descriptions and latency comparison. This does not infer an undisclosed later image architecture. |
| C070–071 — definitions/knowledge | Definitions partially source-read; the broader training-storage explanation was not independently researched. |
| C072–074 — tools, guessing and training policy | Cited search-tool documentation and guessing-incentive research inspected. [Anthropic commercial policy](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training) and [OpenAI training policy](https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance), plus consumer choices, support the checked distinctions. |
| C075–079 — agency/risk | International safety report supports the checked loss-of-control framing and capability/evaluation caveats. Apollo supports contrived goals and the cited behaviors; [Anthropic agentic-misalignment research](https://www.anthropic.com/research/agentic-misalignment) supports its experiment. Palisade's primary page returned empty; its exact counts remain unverified. |
| C080–081 — understanding debate | [Survey paper](https://arxiv.org/pdf/2208.12852) checked: T2-5 corrects its denominator. [Othello paper](https://arxiv.org/abs/2210.13382) supports the intervention result. The original stochastic-parrot paper and all competing interpretations were not independently audited. |
| C082 — adoption | [Census](https://www.census.gov/library/stories/2026/05/ai-use-businesses.html) and [AI Index overview](https://hai.stanford.edu/ai-index/2026-ai-index-report) support the checked business-use figures. The site appropriately distinguishes their surveyed populations. |
| C083 — task productivity | [Published customer-support paper](https://academic.oup.com/qje/article/140/2/889/7990658) supports its two gains. The Science writing-study source failed to load; its time/quality figures remain unchecked. |
| C084 — uneven productivity | [Published consultant trial](https://pubsonline.informs.org/doi/full/10.1287/orsc.2025.21838), §4, supports the percentage-point difference. [METR follow-up](https://metr.org/blog/2026-02-24-uplift-update/) supports the earlier slowdown and qualification about weak newer evidence. |
| C085 — employment | [IMF primary report](https://www.imf.org/-/media/files/publications/sdn/2024/english/sdnea2024001.pdf) supports exposure rather than inevitable replacement. [Revised Stanford study](https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/) supports the divergence and hiring interpretation, with descriptive rather than established causal scope. Yale's substantive result was not independently verified. |
| C086 — energy | [IEA](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary), [Google paper](https://arxiv.org/abs/2508.15734), and [Altman post](https://blog.samaltman.com/the-gentle-singularity) support the checked figures with their existing attribution. Median and average remain distinct in the copy. |
| C087–088 — Nobel/macroeconomy | Nobel primary pages returned 403; official search excerpts corroborated recipients but do not replace full-source verification. The broader macroeconomic summary was not independently checked in full. |
| C089–093 — networks/training/size | Checked Google activation/backpropagation material and the primary neuron, brain-count, GPT-2, GPT-3 and gpt-oss sources. The [InstructGPT paper](https://arxiv.org/html/2203.02155v1) supports model preference and the relative training-compute statement. GPT-4's report confirms withheld architecture details. |
| C094–095, C097 — history | AI winters and the IBM 704 perceptron demonstration corroborated in the cited parliamentary/Cornell sources. GPT, GPT-2, scaling, GPT-3, InstructGPT and ChatGPT milestones checked. Not every individual historical paper was read; ACM failed and Nobel full pages were blocked. |
| C099 — pronoun attention illustration | The Transformer attention source was inspected, but this audit did not independently validate the particular illustrative sentence against its figures. Example status must remain explicit. |
| C100–101 — incident | [METR investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/) supports the checked agent estimate and motive split. Complete chronology, customer-data count and remediation details were not independently verified against all primary documents. |
| C102 — panel, criticism and litigation | Complaint opened; the cited ABC article corroborates the attributed response. UN source failed and the original criticism article was not independently checked. No legal conclusion is offered. |
| C103 — user count | Primary DevDay extraction did not expose the figure; the cited [Engadget liveblog](https://www.engadget.com/2271985/openai-dev-day-live-blog-chatgpt-news/) corroborates the company-reported count. Absence of a comparable Claude figure remains a bounded search, not proof of universal absence. |
| C104–105 — app origins/training | Claude introduction and public-app dates, ChatGPT release date, GPT-4 report and [Anthropic glossary](https://platform.claude.com/docs/en/about-claude/glossary) support checked clauses. Founding biographies not independently checked. Stanford transparency material supports the proprietary-architecture qualification. |
| C106 — behavior documents | [Dated Model Spec](https://model-spec.openai.com/2026-08-18.html) and [Claude constitution announcement](https://www.anthropic.com/news/claude-new-constitution) inspected. Full publication/changelog history not independently checked. |
| C107 — app features | Cited search, upload and image help pages opened, including [Claude's image limitation](https://support.claude.com/en/articles/9002504-can-claude-produce-images); checked feature distinctions supported. |
| C108 — rankings/cadence | [Arena table](https://arena.ai/leaderboard/text) explicitly dated September 30 supports the stated leader on that date. The earlier Elo comparison and release cadence remain unchecked. |
| C109 — opacity/open weights | [Anthropic FMTI](https://crfm.stanford.edu/fmti/December-2025/company-reports/Anthropic_FinalReport_FMTI2025.html), [OpenAI FMTI](https://crfm.stanford.edu/fmti/December-2025/company-reports/OpenAI_FinalReport_FMTI2025.html), gpt-oss material and [Anthropic's public model listing](https://huggingface.co/Anthropic) support checked opacity/open-weight clauses. Negative availability claims remain dated observations. |
| C110 — alternatives APIs | [GPT-6 guide](https://developers.openai.com/api/docs/guides/latest-model), Responses reference and [Claude compatibility reference](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk) support the checked reasoning restrictions and absent/ignored logprob options. |

This is therefore a broad source audit with explicitly partial entries, not a certificate that all 110 compound claims have been independently verified end to end. Failed fetches are coverage limitations, not evidence that a claim is false.

## What was not covered

- No real OpenAI calls, new capability probe, sample re-recording, or verification of the owner’s provider-account settings. Existing recordings substantiate observations at recording time, not an “always” guarantee about future provider behavior.
- No inspection of production deployment configuration, live limits/budget counters, CDN behavior, or the owner’s server on port 3000. The rendered audit concerns the checkout’s local production build, not a claim that deployment matches it.
- No NVDA, VoiceOver, Safari/iOS, Firefox, or real touch-device pass. AX/DOM inspection and passing axe tests do not replace those checks.
- No native 200% browser zoom verification, exhaustive contrast analysis of every transient state, full breakpoint sweep, or extended performance/hidden-tab soak test. Theme-token contrast tests and existing reduced-motion/keyboard E2E coverage passed; selected narrow and desktop views were inspected manually.
- No complete penetration test, exhaustive Redis/signing failure analysis, or new test files. No exact comparison against real secret values was performed in the bundle scan.
- No actual newcomer usability study. Copy and layout recommendations apply the requested first-use, sentence, concept-load, and reading-order checks; comprehension effects remain hypotheses.
- Technical depth was not traversed exhaustively. The default and Detailed paths received the main walkthrough review. Playback was inspected by starting, pausing, stepping, and seeking rather than watching both default-speed presentations uninterrupted.
- Known items explicitly excluded by the request are omitted. Source verification that could not be completed is identified in the coverage table, rather than silently treated as passed.
