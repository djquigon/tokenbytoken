# Token by Token: product & technical plan

> **Status:** Phase 1 planning output, approved 2026-09-30. No application code exists yet.
> Project rules and conventions live in [`CLAUDE.md`](../CLAUDE.md); keep the two in sync.
> Platform facts (OpenAI, Next.js, Vercel, libraries) were verified against official documentation on
> 2026-09-29. Re-verify before relying on them.

A personal, non-commercial project: public with no sign-in, owner-funded with at most $20/month, nothing
stored on the server, for a general audience of adults and older teens, hosted on Vercel. The model is the
cheapest one that gives the best visualization outcomes. There is no formal expert review or user study.

> **Phase 0 update (2026-09-30):** decisions made after this plan was approved live in
> [`docs/decisions/`](decisions/). ADR 0001 selects `gpt-6-luna`, and ADR 0003 records the streaming findings
> that refine §3.5. Where an ADR and this plan disagree, the ADR wins. For example, the plan says to watch
> for chunks carrying several tokens, but the probe found OpenAI sends exactly one token per delta.
>
> **Phase 1 update (2026-09-30):** ADR 0006 records how the chat pipeline, limits, budget ledger, and
> history signing were built. ADR 0003 now documents protocol v1 as implemented. The request gained a
> tab-scoped `sessionId`. `end` carries the ledger basis, and text without tokens carries `gapTokens`.

## Decisions at a glance
- **Hybrid timing.**
  - The real reply streams normally, alongside a thin live strip that shows only observed events.
  - When the reply finishes, a guided walkthrough of about 2.5 minutes is *offered*, paced by reading time (ADR 0007; first planned at about 90 seconds). It replays the recorded trace at a pace people can follow.
- **Real data wherever it exists.**
  - Real messages, real token strings, and the real top‑20 next-token options (logprobs) for every token in the reply.
  - The network's internals appear only as labeled examples.
  - **No invented numbers ever appear on the user's own tokens.**
- **Four labels plus a modifier**, enforced in the type system:
  - **Recorded**, **Calculated**, and **Example** correspond to the brief's Observed, Derived, and Illustrative.
  - **Reference** is added for documented or general facts.
  - A **What‑if** modifier marks hypotheticals.
  - See Q6.
- **Model: the cheapest one that passes every visualization check.** The checks are:
  - streamed top‑20 logprobs;
  - no hidden reasoning tokens;
  - temperature accepted;
  - tokenizer round-trip agreement;
  - no retirement scheduled soon;
  - good enough replies.

  A Phase 0 probe tests candidates in cost order: `gpt-6-luna` at `reasoning.effort:"none"` ($0.10/$0.50 per 1M tokens), then `gpt-4o-mini`, `gpt-5.4-nano`, and `gpt-4.1-mini`.
- **Stack.**
  - Next.js ≥16.3.8 (App Router, Node runtime).
  - The official `openai` SDK v7 with the Responses API. We do not use the Vercel AI SDK.
  - SVG/HTML visuals drawn as pure functions of a seekable clock that we own.
  - 3D only after MVP.
  - **Requires Node 24 LTS. This machine has 21.6.1.**
- **Privacy and cost.**
  - The server is stateless and sends `store:false`.
  - Prompt and response content is never logged or stored.
  - Layered rate limits and a budget ledger.
  - **A hard $20/month cap in OpenAI, plus an app circuit-breaker of about $0.55/day.** When a day's budget is used up, the site falls back to the sample conversation.
- **Hosting.** Vercel Hobby, which fits a personal, non-commercial project. The site is public with no sign-in. A custom domain gets added once you buy it.
- **Look and feel.** A "digital-rain terminal" inspired by *The Matrix*: green phosphor on near-black, monospace glyphs, and a soft glow. The style does teaching work too:
  - The falling characters are *real tokens*.
  - Glyphs only ever stand for text.
  - Real data glows, while examples are drawn as wireframes.
  - Legibility, accessibility, and accuracy always win over effects.

---

## 1. Product framework

### Vision
Anyone can ask a real AI model a question, then watch at a human pace how a reply like that gets made:
- what the app sends,
- how text becomes tokens,
- how a fixed, trained network turns them into options for the next token,
- how one option is picked at random, weighted by those scores,
- and how that repeats until the reply ends.

Every view is anchored to the user's own conversation. Views of the model's insides are clearly marked as examples. Learners should leave with an accurate mental model, and with a sense of what can't be known from outside the model.

### Audience
- **Primary:** curious non-technical adults (knowledge workers, students, educators, journalists, policymakers) who use chatbots. Assumes no math beyond percentages.
- **Secondary:** technical-adjacent learners (product managers, designers, junior developers, CS students) who want correct terminology and more depth.
- **Later:** educators presenting to a group.

### Learning outcomes
**Core outcomes.** The MVP has to achieve these, and each maps to a probe question in §4.
1. **One token at a time.** The reply is generated one token at a time. At each step, the model produces scores for every possible next token, based on everything so far, including its own earlier output.
2. **Tokens.** Text is split into tokens. A token is often a whole common word (usually with its leading space), sometimes a piece of a word, a single character, or a byte. Tokens are the unit that limits and costs are counted in.
3. **Context, not memory.** The app sends the conversation, or as much of it as fits, with every message. Chatting does not change the model's learned parameters.
4. **Scores, then a weighted random pick.** The network produces scores. A separate sampling step, shaped by settings like temperature, picks one token. That is why the same prompt can produce different replies.
5. **Real vs. example.** Users can point to which parts of the walkthrough are real data from their conversation and which are teaching examples.

**Extended outcomes.** These are covered in the deep dives and assessed more lightly.
6. **Fluent is not the same as correct.** A likely wording is not a true statement. There is no built-in fact-checking.
7. **The gist of a transformer.** It has layers. Each position attends to itself and earlier positions, never later ones. It reuses saved work while generating.
8. **Add-ons.** Retrieval, web search, and tools are optional workflows that add text to the context. They were not used here.
9. **Training vs. inference.** The parameters were learned beforehand, and using the model doesn't change them. Providers may train future models under their own policies. By default, OpenAI doesn't train on API data.

### Primary user journey
1. **Landing page.**
   - A headline and 3–5 "you'll learn" bullets.
   - A short "what's real here" explanation of the labels.
   - Primary call to action: **Ask your own question**.
   - Secondary: **Replay a sample conversation**. This is a real trace, recorded on a stated date with a named model snapshot, chosen to show a close call between token options. It costs nothing in API usage.
2. **First visit to the chat page.** A skippable three-step orientation (the chat, the walkthrough, the labels), then a privacy notice before the first message is sent.
3. **Submit.** The reply streams normally into the chat bubble. A thin live strip shows only recorded events, in order:
   1. "Request sent."
   2. A waiting timer, captioned: *"waiting for the first text. This includes network travel, OpenAI's queue, and the model processing your conversation. We can't see how that time splits."*
   3. First text arrives.
   4. Text and tokens keep arriving.
4. **Offer.** When the reply ends, the walkthrough panel shows a static **Hook** card built from real data: *"Your reply was 212 tokens. At every token there were options. Here's a close call…"*. It has two buttons: **Play (≈ 2.5 min)** and **Skip**. Autoplay is off by default and can be turned on as a preference.
5. **Walkthrough.** Six short chapters, seven from the second turn on. The user can:
   - play, pause, step, and scrub;
   - change speed, replay, and jump to any chapter;
   - click any token to open its *token card*.
6. **Continue.** As the brief requires, the composer unlocks when the walkthrough ends or is skipped.
   - Skip is a single action, available from the composer itself.
   - **Explain this reply**, on any message, resumes or replays that walkthrough later without making an API call.
7. **Follow-up turns.** Chapter 7 shows:
   - the chat so far being sent again;
   - the context budget;
   - what this app dropped, if anything;
   - any cached-token reports, worded carefully.
8. **Optional wrap-up.** A 30-second "real or example?" sorting check. It reinforces the lesson and doubles as a measurement tool.

### MVP scope
**Chat**
- Real streamed chat through the OpenAI API: stop, retry, sanitized Markdown, and typed error states.

**Walkthrough**
- The thin live strip plus the guided walkthrough.
- Hook plus six chapters, seven from the second turn, at *Simple* and *Detailed* depth.
- The label system, enforced in types.

**Real data**
- The real top‑20 options for each token, from logprobs. Phase 0 verifies this works with the chosen model.
- **If logprobs aren't available**, chapters 4–5 switch to the recorded sample conversation. They never show invented numbers on the user's tokens.
- The token-by-token story is shown **only when `reasoning_tokens == 0`**. Otherwise the model generated hidden tokens first, so the walkthrough shows an opaque block ("N hidden tokens, count only") and switches off its per-token claims.

**Deep dives**
- *Why fluent answers can be wrong*, with a real recorded case where the model gave a wrong token a high score.
- A *temperature what-if*.
- *Context limits & history*.
- *Does it learn from me?* (training vs. inference).
- A one-line note: "no tools or search were offered or used".
- A *timing card* with measured numbers only, not attributed to any internal phase.

**Controls and accessibility**
- Player controls and keyboard shortcuts that work only while the walkthrough has focus.
- Reduced motion, following the OS setting plus an in-app toggle.
- A Transcript view (a text version of the whole walkthrough).
- Responsive layouts.

**Safety, cost, and pages**
- The server-side API key, limits, and a budget circuit-breaker. No conversation content is stored on the server.
- The landing page, the sample conversation, and privacy and about pages.

### Deferred
- **Deeper content:**
  - Technical depth throughout.
  - A deep dive on saved work (KV cache and prompt caching), with timing.
  - Stepping through individual layers, and a switcher for types of attention head.
  - A "meaning map" of embeddings, using real embeddings from a named open model, labeled Example.
- **Interactive tools:**
  - Regenerate & compare (a real second sample).
  - Temperature presets that users set on real requests.
  - A tokenizer playground.
- **Richer visuals and workflows:**
  - Optional 3D views: an embedding map and a layer stack, each with a 2D equivalent.
  - A real tools or web-search demo, shown only from actual events.
  - A small-open-model lab, starting with GPT‑2 attention precomputed to JSON.
  - A reasoning-model module: counts only, and any summaries labeled as separately generated.
- **Product features:** presenter mode, sharing (which needs storage and consent), localization, and other model providers.

### Decisions (confirmed 2026‑09‑30)
- **D1. Ownership and access.** A personal, non-commercial project, funded by you. It is public, with no sign-in.
- **D2. Budget: $20/month at most.**
  - **Hard cap in OpenAI:** a $20 hard spend cap at the organization level. If project-level caps are available, split them: production $17, development and probes $3.
  - **App circuit-breaker:** about $0.55/day, so one busy day can't drain the month.
  - **When the daily budget runs out,** the site falls back to the sample conversation and shows when it resets.
- **D3. Model rule: use the cheapest model that gives the best visualization outcomes.** There is one server-configured model.
  - It must pass every Phase 0 check:
    - streamed top‑20 logprobs;
    - `reasoning_tokens == 0`;
    - temperature and top_p accepted;
    - tokenizer round-trip agreement of at least 99%;
    - no retirement scheduled within about 6 months;
    - acceptable quality on the prompt set.
  - Candidates are tested in cost order: `gpt-6-luna` (at effort `none`), `gpt-4o-mini`, `gpt-5.4-nano` (at `none`), `gpt-4.1-mini`.
  - MVP sends **temperature 1 and top_p 1**. If Phase 0 confirms the logprobs are raw scores, the percentages users see *are* the actual chances of each pick.
- **D4. Hosting.** Vercel Hobby. Its terms allow personal, non-commercial use, and this project qualifies; re-check if the site ever makes money. A custom domain will be bought later.
- **D5. Data.** Nothing is stored on the server. The server is stateless, the conversation lives in the browser, and history is sent explicitly each turn (no provider-side conversation state). Requests use `store:false`, and analytics never include content.
- **D6. Audience.** A general audience of adults and older teens, not directed at children.
- **D7. Rigor.** It's a personal project, so there's no external expert review and no formal user study. Accuracy rests on:
  - the rules in `CLAUDE.md` §3;
  - a source for every claim;
  - the content lint;
  - a self-review;
  - informal feedback from a few people.
- **D8. Identity.**
  - Name: **"Token by Token"**.
  - Dark theme by default, plus a light theme.
  - English interface, with provider-neutral copy.
  - **Styling inspired by *The Matrix***: a "digital-rain terminal" look. It's inspired by the film, not copied from it (see §2, Visual direction).

### Assumptions
- **A1.** Text only. The interface is in English; prompts can be in any language.
- **A2.** The richest experience targets desktop, but the full lesson works on mobile.
- **A3.** The four-label system is acceptable (Q6; we proceed on this default).

### Still open (proceeding on defaults; see §6)
- The label vocabulary.
- How the walkthrough starts.
- How far into formulas the depth goes.
- Whether real generation controls ship in MVP.
- The final model, picked in Phase 0.
- The domain.

### Streaming vs. afterward: **hybrid (recommended)**
| Approach | Pros | Cons |
|---|---|---|
| Animate *during* streaming | Feels immediate. Uses real arrival timing. | Real generation outruns human reading. The wait before the first text mixes network time, queueing, and processing, and we can't separate them. Network hops regroup chunks. Attention is split between reading and watching. |
| Animate *after* completion | Complete data: every token, logprob, usage count, and stop reason. Human pace. Deterministic, seekable, and accessible. | The delay can feel disconnected, and users may skip it. |
| **Hybrid** | Keeps the familiar chat feel and teaches from complete data. One event log drives both parts. | Two modes to design. The live strip must stay minimal and honest. |

**Live strip.** Shows recorded events only, with no animation of model internals.
- **Tokens appear live** only because the stream carries token strings (Recorded, reported by OpenAI). Without logprobs, the strip shows plain text chunks, and token chips appear after the reply completes.
- **In Detailed mode, the strip shows chunk grouping** ("this burst carried 3 tokens"), measured at our server. The copy follows what Phase 0 finds: bursts usually carry one token, sometimes several.
- **The strip can be hidden** with a "Hide live view" toggle.

**Walkthrough structure.** The first two passes are the lesson:
1. **Pass 1 is the prompt pass.** All prompt positions are processed in parallel, layer by layer, which produces the options for token 1.
2. **Pass 2 is one generation step.** Only the new position is computed. It looks back at saved results for earlier positions.
3. **Then the first close call gets the options and pick chapters again**, with lighter narration. An optional "guess which is likely" asks the user to choose among the real top options.
4. **A montage covers the remaining tokens.** It is capped at about 8 s and labeled "sped up, not real timing". It pauses at no more than 2 close calls.

---

## 2. Visualization & interaction plan

### Three lanes
- **This app.** Recorded events: what was sent and what was done. Examples: request validated, context assembled, turns dropped, moderation check, request sent, reply received, stopped.
- **OpenAI's service, shown as a black box.** Recorded values reported by OpenAI, plus Reference facts from its docs. Examples: response created, first text, completed or incomplete, usage, cached tokens, and the unexplained wait. Hosted tools would appear here, but they're out of MVP.
- **Inside a model like this.** Example views only.

At *Simple* depth, the lanes collapse into a thin event ticker. *Detailed* depth shows all three lanes.

### Three materials, plus the sampler (persistent visual language)
- **Learned parameters: "fixed while in use, learned in training".**
  - Drawn as a dense, *static* lattice of dim cells, marked with a pin glyph and text.
  - It never uses characters, because parameters are numbers, not text, and are not readable "code".
  - We avoid a lock glyph, because it reads as security.
  - The embedding table lives here.
- **Context: "text sent with this request".** A tape of glowing token glyphs.
- **Working notes: "computed for this request, then discarded".**
  - Translucent phosphor overlays that visibly fade after use.
  - They cover token vectors, layer states, and saved results (the KV cache).
  - For prompt caching, a Reference note says OpenAI keeps these briefly.
- **The sampler.** Drawn as a small device *outside* the parameter block, labeled "a weighted random pick, set by the app's settings".
- **Tokens.**
  - Monospace glyph chips in pale phosphor, with visible borders between neighbors. Adjacent tokens alternate between two subtle tints.
  - Whitespace uses readable symbols (␣, ↵), with spoken screen-reader names ("space", "newline", "part 1 of 2 of 😀").
  - Linked highlighting uses an outline plus an underline, never hue alone.
  - Token tints never reuse the label colors.

### Chapters
Banner on chapters 3–6:

> *"Chapters 3–6 repeat for every new token, for that token only, reusing saved work. OpenAI hasn't published the design of the model answering you (it has for its open-weight gpt-oss models). These are example views of models like it."*

| # | Plain title (Simple) | Technical subtitle (Detailed only) | Internal stage modules |
|---|---|---|---|
| 0 | Hook: "At every token there were options" | (none) | `probs` (hook slot) |
| 1 | What gets sent | Context assembly | `context` |
| 2 | Text becomes tokens | Tokenization, token IDs | `tokenize` |
| 3 | Inside the network (example view) | Embeddings, positions, transformer layers, prompt processing | `embed`, `layers` |
| 4 | The options for the next token | Scores → probabilities (logprobs) | `probs` |
| 5 | A weighted random pick | Sampling | `sample` |
| 6 | Add it, repeat, until it ends | Generation loop, saved work, stop conditions | `loop`, `stop` |
| 7 | Your next message: the chat so far is sent again | History as context, context budget | `followup` |

### Chapter-by-chapter breakdown
Abbreviations: **Rec** Recorded · **Calc** Calculated · **Ref** Reference · **Ex** Example · **WI** What‑if.

**Ch0 · Hook (~10 s)**
- *Sees:* "Your reply was 212 tokens. At every token there were options. Here's a close call:" followed by the real top options at one position of *their* reply.
- *Learns:* the reply was built piece by piece, and there were alternatives at each step.
- *Interacts:* Play the walkthrough, pick another close call, or Skip.
- *Data:*
  - **Rec** (reported by OpenAI): token strings and logprobs.
  - **Calc:** the percentages, and the close-call rule. A close call means the chosen option was under 50%, or the top two were within 15 points. Whitespace and punctuation tokens are de-prioritized.
- *Disclose:* "A close call means several wordings were likely. It doesn't mean the answer is uncertain or wrong." Without logprobs, the hook uses the sample conversation and names it as such.

**Ch1 · What gets sent**
- *Sees:*
  - Cards for this app's instructions, earlier turns (from turn 2), and the user's message.
  - The cards merge into a single input tape with role markers.
  - **View the full request** shows the exact JSON body sent, including the fields the server adds (`store:false`, the output limit, the hashed safety ID, the settings). It also notes the separate moderation check.
- *Learns:*
  - The model receives one input, which the app assembles.
  - Apps can add instructions users don't see. This app shows its own, word for word.
  - Nothing else is consulted here.
- *Interacts:* expand the instructions; open the annotated full request; hover or focus a message to see its token count.
- *Data:*
  - **Rec** (sent): the messages, instructions, request fields, and requested model.
  - **Rec** (reported by OpenAI): the resolved model snapshot and, after the reply, `input_tokens`.
  - **Rec** (reported by OpenAI's separate moderation model): the moderation verdict.
  - **Calc:** per-message token counts, using `o200k_base` (assumed).
  - **Ex:** the role-marker layout, captioned "roughly how it's laid out for the model (example format)".
- *Disclose:*
  - OpenAI wraps messages in its own unpublished format and may run its own safety systems. That's why its count is slightly higher.
  - "This app offered no tools or search, and the response contains no tool calls." (Rec, limited to what the app can see.)

**Ch2 · Text becomes tokens**
- *Sees:*
  - The user's message as chips, with readable ␣ and ↵. Each chip flips to show its ID.
  - Callouts for a whole-word token with its leading space, a word split into pieces, and an emoji or non-English text taking several tokens.
  - A reconciliation line: "we counted 1,204 · OpenAI reported 1,211. The gap is formatting we can't see."
- *Learns:*
  - Models work with tokens from a fixed vocabulary: often whole common words, sometimes pieces, characters, or bytes.
  - A token ID is just a position in that vocabulary.
  - Limits and costs are counted in tokens.
  - Tokens help explain quirks, such as models miscounting letters.
- *Interacts:* the token tape is a single tab stop (arrow keys, Home/End, Esc); toggle between text and IDs; expand to the full context.
- *Data:*
  - **Calc:** input tokens and IDs. The tokenizer is named and marked *assumed* for this model.
  - **Rec** (reported): the reply's token strings.
  - **Calc:** the reply's token IDs, found by looking up each string in the vocabulary.
  - **Rec** (reported): usage counts.
  - **Calc:** the differences between our counts and OpenAI's.
- *Disclose:* "Re-split by our tokenizer. OpenAI's processing may differ." Mismatches are flagged, never hidden.

**Ch3 · Inside the network (example view): the prompt pass**
- *Sees (Simple):*
  - Prompt chips become *working notes*, looked up from the embedding table inside the parameter block.
  - The notes rise through a stack labeled "× many layers (number not published)". All positions light up together, layer by layer.
  - One example pattern: each position draws on itself and the token before it. Arrows are all the same weight and point *into* the reading position.
  - The pattern is shown first on a neutral sample sentence, then with "Try it on your tokens".
  - The last position's note heads on to Ch4.
- *Learns:*
  - The prompt is processed in parallel, layer by layer.
  - Attention lets each position draw on itself and earlier positions, never later ones.
  - Feed-forward steps transform each position on its own.
  - Word order matters. In many modern models, position is applied inside attention.
- *Interacts:* **Show another example pattern**. *Detailed* adds sub-scenes:
  - lookup;
  - position: the same word at two positions is identical going in, but compared differently in attention;
  - attention: a duplicate-token pattern, and an induction pattern ([A][B]…[A]→[B]) shown on the user's text only if it contains a repeat, otherwise on a sample;
  - feed-forward.
- *Data:*
  - **Calc:** the token chips and positions used as labels.
  - **Ref** ("general: true of standard transformer models; not confirmed for this model"): the rule that positions can't see later positions.
  - **Ex:** every pattern, vector, and stack depth, and the drawing of that rule.
  - **No numbers are ever shown on arcs or vectors.**
- *Disclose:*
  - "Example pattern, not this model's attention. The API exposes none of these internals."
  - Animation timing is not execution timing.
  - *Technical* drawer: positional schemes (absolute vs. rotary); attention sinks, shown only on a hidden [start] chip; mixture-of-experts; the published gpt-oss design; caveats about interpretability and about where knowledge lives.

**Ch4 · The options for the next token**
- *Sees:*
  - The last position's note becomes a score for every vocabulary entry, drawn as a compressed strip (Ex).
  - Then the *real* top options for this position appear as bars with percentages, with the chosen option highlighted.
  - A remainder bar reads "all other ~200,000 tokens".
  - The chart is titled "The model's scores for the next token, as percentages".
- *Learns:*
  - The network outputs a score for every possible next token.
  - Several continuations are often plausible.
  - A high percentage means that wording was likely to come next. It does not mean it's true.
- *Interacts:* click any token in the reply to open its token card; open a "close calls in this reply" list; navigate the bars as a data table.
- *Data:*
  - **Rec** (reported): the top‑k token strings and logprobs (up to 20, sometimes fewer).
  - **Calc:** percentages (e^logprob), the remainder (1 − Σ), and close calls (with the rule shown).
  - **Ex:** the vocabulary strip, and the animation from scores to percentages.
  - If the chosen token isn't among the returned options, the chart says so (Rec).
- *Disclose:*
  - Only the top 20 are visible.
  - OpenAI doesn't document whether these values reflect the app's temperature. The copy states whatever Phase 0 finds.
  - A model can give a wrong token a high score.
- **Fallback when there are no logprobs:** the chapter switches to the sample conversation, labeled "real, recorded ‹date› with ‹snapshot›; not the model you're chatting with". The user's tokens show "not available for this model".

**Ch5 · A weighted random pick**
- *Sees:*
  - The sampler draws from a weighted strip and lands on the chosen token. It is drawn outside the parameter block.
  - The settings actually sent are shown.
  - *Detailed* adds "Chance of being picked with this app's settings" beside the scores, plus a temperature what‑if:
    - a slider with ± buttons, capped at about 1.2;
    - an "unknown remainder" band;
    - temperature 0 means "always the top option".
- *Learns:*
  - The pick is random, but weighted by the scores and the settings.
  - Lower temperature is more predictable; higher is more varied.
  - That's one reason the same prompt can give different replies. Servers also vary slightly even at temperature 0.
- *Interacts:* the temperature what‑if; "simulate 20 picks"; view the settings sent.
- *Data:*
  - **Rec** (sent): temperature 1 and top_p 1.
  - **Rec** (reported): the chosen token.
  - **Calc + WI:** pick chances within the top 20 at another temperature. These are valid if Phase 0 confirms the logprobs are raw scores.
  - **Calc + WI:** the simulated picks, labeled "simulated on this page; the model wasn't asked again".
  - **Ex + WI:** the remainder band, and anything above the slider cap.
- *Disclose:*
  - The actual random draw and the sampler's details (for example, whether top_p or temperature is applied first) aren't observable or documented.
  - Some models don't accept temperature at all. The UI shows only the controls the configured model supports.

**Ch6 · Add it, repeat, until it ends**
- *Sees:*
  - The picked token joins the tape.
  - **Pass 2** computes only the new position, looking back at the saved notes of earlier positions. Nothing is recomputed.
  - The first close call replays Ch4–5 briefly.
  - A montage (capped at about 8 s, labeled "sped up, not real timing", with a counter like "token 57 of 212") highlights the reply in the chat bubble and pauses at up to 2 close calls.
  - The ending, taken from a fixed list of possible endings.
  - Decoded text turning into rendered Markdown, with a raw/rendered toggle.
  - A summary card.
- *Learns:*
  - Each new token is one more pass through the network, for the new position only, reusing saved work.
  - The model can't go back and edit.
  - A reply ends at an end marker, the length limit, a content filter, or a stop.
  - Formatting such as **bold** is just characters the model generated.
- *Interacts:* scrub; step ±1 token; click any token in the reply to jump to it; speed from 0.5× to 4× or Instant; an optional real-speed text replay using the recorded arrival times.
- *Data:*
  - **Rec** (reported): the reply text, token strings, status, incomplete reason, usage, and `reasoning_tokens` (this chapter's story requires 0).
  - **Rec** (measured by this app, on server and browser): chunk arrival times.
  - **Calc:**
    - time to first text (the first non-empty text delta);
    - total time;
    - the delivery rate this app saw;
    - "ended with an end marker", inferred from a completed status with no stop sequences set;
    - cost: reported usage × a dated price table.
  - **Ex:** the pass‑2 animation, the saved-notes depiction, the end-marker graphic, and the montage pacing.
- *Disclose:*
  - Arrival times include the network.
  - The time spent computing each token can't be observed.
  - A stopped reply shows "usage not reported, estimated".
  - The possible endings are: end marker (inferred), output limit, content filter, stopped by you, connection lost, error.
- **Reasoning gate:** if `reasoning_tokens > 0`, per-token claims about ordering and timing are replaced by an opaque block: "N hidden tokens were generated before the visible reply (count only)".

**Ch7 · Your next message: the chat so far is sent again** (turn 2 onward)
- *Sees:*
  - Earlier turns packed into the new request.
  - A context gauge on a broken, "not to scale" axis, showing this app's budget next to the model's documented limit.
  - The oldest turns fading, labeled "dropped by this app to fit its budget".
  - A note, when it applies, that stopped replies aren't re-sent.
  - A cached-token badge, shown only when OpenAI reports cached tokens.
- *Learns:*
  - A chat's "memory" is this app sending the history again. The model's parameters haven't changed.
  - Longer chats cost more and eventually hit limits. Going over the limit causes an error or an explicit cut, and fitting within it doesn't guarantee everything is used well.
  - Apps manage history in different ways. This one drops the oldest turns.
  - Consumer "memory" features insert saved notes into the context. That is still context.
- *Interacts:* **Exactly what was sent this time**; a per-turn token breakdown; a "Does it learn from me?" explainer.
- *Data:*
  - **Rec** (sent or done by this app): the included and dropped messages, and the budget.
  - **Rec** (reported): input tokens and cached tokens.
  - **Ref** (OpenAI docs, with retrieval date): the model's context limit, and "API data isn't used for training by default".
  - **Calc:** per-turn counts and projections.
  - **Ex:** the packing animation.
- *Disclose (cache badge copy):* "OpenAI reported N tokens cached. These are saved intermediate results for an identical start of the request, often this app's instructions, which are the same for everyone. Per OpenAI, this doesn't change the answer or give the model memory."

### Deep dives
| Deep dive | From | Labels | MVP? |
|---|---|---|---|
| **Prefill vs. decoding.** Taught in the main walkthrough rather than as a separate view: Ch3's pass 1 processes the prompt in parallel, and Ch6's pass 2 computes one new position using saved work. A measured-timing view is deferred to the saved-work deep dive. | Ch3/6 | Ex, Ref | MVP (main pass) |
| **Why fluent answers can be wrong.** A likely wording is not a fact; the model has a training cutoff; nothing is fact-checked without tools. Includes a *recorded* case where a wrong token got a high score. | Ch4/6 | Rec, Ref | MVP |
| **Temperature what-if** | Ch5 | Calc+WI, Ex+WI | MVP |
| **Context limits & history** | Ch7 | Rec, Ref | MVP |
| **Does it learn from me?** Training vs. inference. | Ch3/7 | Ref | MVP |
| **Timing card.** Measured numbers only, with no phase attribution. | Ch6 | Rec (measured), Calc | MVP |
| **Tools, search, retrieval.** MVP has one line: "none offered, none used". The model *requests* a tool, the app or OpenAI runs it, and the model is called again. | Ch1 | Rec | line → later |
| **Saved work: KV cache and prompt caching, with timing** | Ch6/7 | Rec, Ref, Ex | Later |
| **Reasoning models & hidden tokens.** Counts only. Any "summary" is labeled "generated separately, not the hidden reasoning". | Ch6 | Rec | Later |

### Progressive disclosure
- **Simple:**
  - About 40 words or fewer per step.
  - No "prefill", "decode", "logprob", or "autoregressive".
  - Labels are set per panel, but Example is always marked on each element.
  - Lanes are collapsed into the ticker.
  - An **Is this real?** button on every panel.
- **Detailed:** technical subtitles, sub-scenes, actual values, and a per-panel "How do we know this?" table.
- **Technical:** a drawer with the mechanics, optional formulas, variants, references, and known limitations.
- **Everywhere:** glossary popovers on first use of a term, and help in the same place on every screen.

### Connecting to the user's conversation
- **Anchored everywhere.** Every chapter uses the user's real messages and real tokens as labels, the real options for each real position, and the real reply built up by the loop. The network views are examples, introduced on a neutral sample first.
- **Linked highlighting.** Hovering or focusing a token highlights it in the chat bubble, on the tape, and in the chapter view. *Activating* a token (not just focusing it) re-runs Ch4–5 for that position (WCAG 3.2.1).
- **Focus token.** Defaults to the first close call. The user can pick any other token.

### Labeling: four labels and a modifier
The brief's three categories map onto Recorded, Calculated, and Example. We add **Reference** because documented limits, documented prices, and general textbook facts are none of those three. Forcing them into one would mislabel them.

| UI label (brief's term) | Meaning | Required source line |
|---|---|---|
| **Recorded** (Observed) | From this conversation | "Sent by this app" · "Done by this app" · "Reported by OpenAI" · "Measured by this app (server/browser)" |
| **Calculated** (Derived) | Computed here from Recorded values, plus Reference values where needed | The method and its assumptions ("o200k_base tokenizer, assumed") |
| **Reference** (new) | True outside this conversation | "OpenAI docs, retrieved ‹date›", or "General: true of standard transformer models; not confirmed for this model" |
| **Example** (Illustrative) | Made for teaching, not measured from the model that answered | "Rule-based pattern", or "Real data from ‹other model›" |
| **What‑if** (modifier) | A hypothetical | "Simulated on this page; the model wasn't asked again" |

**Rules** (enforced by types, tests, and review):
1. **The inputs decide the label.**
   - Any Example input makes the result Example.
   - Recorded plus Reference makes Calculated, citing both sources.
   - General knowledge can justify a *method*, but it never supplies a number.
   - Annotations don't upgrade a label. Real token text written on an example arc doesn't make the arc real.
2. **Labels can only get weaker when inherited.**
   - A panel's badge never covers an Example element inside it.
   - Any panel that contains examples shows "Contains examples".
3. **Stable isn't the same as real.** Values from a seeded generator are Example, even though they look the same on every replay. Invented values are never shown as numbers.
4. **Absence is recorded only as far as the app can see.** For example: "no tools offered; no tool calls returned".
5. **Keep reported and measured apart.** "Reported by OpenAI" stays separate from "Measured by this app". Where they disagree, both are shown.
6. **Time.** Timestamps are Recorded, with the place they were measured. Durations are Calculated. Attributing time to internal model phases is Example.
7. **Every label also exists as text:**
   - in the accessible name;
   - as a visible tag inside any exported graphic;
   - as a prefix in the Transcript view.
8. **Visual encoding, never color alone.** Label colors are reserved for labels.

   | Label | Encoding |
   |---|---|
   | Recorded | Solid outline, filled dot, **phosphor green with a soft glow** ("real signal") |
   | Calculated | Solid outline, dotted underline, ƒ glyph, **cyan** |
   | Reference | Book glyph and citation, **amber** (a classic terminal color) |
   | Example | A **"wireframe simulation"**: dashed outline, faint wide hatching (never behind text), **violet-grey with no glow**, and an **EXAMPLE** tag |
   | What‑if | "?" corner tag |

   Real data glows; examples are wireframes. The hues are provisional and must pass the contrast check on both themes. Hue is never the only cue.

### Misconceptions we design against
The probe questions double as the §4 assessment items.

| Misconception | Design mitigation | Probe question |
|---|---|---|
| The arcs show what *this* model focused on | Uniform-weight arcs; shown on a sample first; "Show another example"; EXAMPLE tag inside the graphic | "What do the lines in chapter 3 tell you about how *this* model handled your question?" |
| 94% means the answer is 94% likely to be right | "Chance this piece comes next"; a recorded confident-but-wrong case | "'Canberra' shows 94%. Is it (a) 94% likely correct, (b) rated very likely to come next, or (c) 94% of sources agree?" |
| No close calls means reliable; close calls mean errors | Rename to "close calls"; show that most are about wording; don't link them to the fallibility deep dive | "Are the parts with no close calls more likely true, less likely, or neither?" |
| The bars are the odds under any settings; the slider re-asked the model | Two separate quantities; "What-if: computed here" | "When you moved the slider, did the model write anything new?" |
| The wait was the model thinking; a longer wait means a harder question | An honest caption; the black-box OpenAI lane | "What could have happened in the 1.8 s before text appeared?" |
| Each burst of text is a token; slow bursts were hard | Chunk-grouping data; no per-token timing | "Is each burst one token? Did slower bursts take more effort?" |
| The model recomputes everything, or stores my chat inside itself | Pass 2 reuses saved work; the working-notes material has a visible lifetime | "After the reply finished, where does your conversation exist?" |
| It learns from me and will remember me next time | The fixed-parameters material; the "Does it learn from me?" explainer | "You tell it your name and start a new chat tomorrow. Will it know? Why?" |
| The model decides each word | A sampler drawn outside the model; the phrase "weighted random pick" | "Who or what makes the final choice of each token?" |
| The drawing is the real architecture | "× many layers (not published)"; no counts | "How many layers does the model you chatted with have?" |
| Tokens are words, one choice per word | Callouts for split words; the phrase "click a token" | "How many picks did it take to write 'unbelievably'?" |
| It looked the answer up, and search is a standard step | "Only the model plus the text sent"; no greyed-out search box | "Where did the facts in this answer come from?" |

### Visual direction & interaction model
- **Direction: a "digital-rain terminal" inspired by *The Matrix*.** Green phosphor on near-black, monospace glyphs, falling characters, and a soft CRT glow. It pays homage to the genre look without copying the film. The style carries part of the lesson: **glyphs always mean text**, so the "code" on screen is literally tokens.
  - **Signature motif: token rain.**
    - The falling characters are **real token strings**. On the landing page they fill the background, picked at random from thousands of real words and numbers of the tokenizer this app uses, with all text on solid cards (ADR 0008). In the live strip they come from the user's own reply, as it arrives.
    - Captions say what they are where the rain teaches something: "tokens arriving, timed by when this app received them". The landing page's background rain has no caption (owner, 2026-09-30).
    - The rain is drawn on Canvas 2D. It is decorative (`aria-hidden`) and static under reduced motion. Settings' Effects switch stops it on every page, the landing page included (ADR 0008).
    - It never falls behind body text or inside the walkthrough's lessons.
  - **"Decode" reveals.** A token chip briefly scrambles and resolves into its ID, or back into text. Headings can decode in once.
    - The final text is in the DOM from the start, so screen readers get it immediately.
    - Each reveal lasts ≤300 ms, never flashes, and is instant under reduced motion.
  - **Palette** (provisional tokens, checked for contrast in Phase 2). The dark theme is the default.
    - A near-black background with a faint green tint.
    - **Body text is pale green-white, not neon.** Long passages of saturated green on black cause glare and halation.
    - Saturated phosphor green is reserved for **Recorded** and a few accents.
    - Cyan, amber, and violet-grey go to the other labels (see the labeling table).
  - **Light theme: "green-bar printout".** Pale paper with faint green bands (decorative, never behind body text) and dark green ink, like continuous-feed terminal printouts.
  - **Typography.**
    - Monospace for tokens, IDs, labels, and short headings, e.g. IBM Plex Mono or JetBrains Mono via `next/font`.
    - A legible sans for explanations, e.g. IBM Plex Sans.
    - Uppercase letter-spaced monospace only for short headings.
  - **Effects budget.**
    - Glow comes from `text-shadow` and `box-shadow` only.
    - Scanlines and noise appear only on the landing hero, and never over text.
    - Chapter transitions may use a glitch of ≤150 ms, with no flashing.
    - Every effect is disabled by `prefers-reduced-motion`, by `prefers-contrast: more`, and by an in-app **Effects: on/off** toggle.
  - **Inspired by, not copied from.**
    - No film names, quotes, character names, logos, or the film's own glyph design.
    - No "red pill/blue pill" motif. It's derivative, and the phrase now carries unrelated online connotations.
    - Nothing implies that the network's numbers are readable code.
  - **Carried over.**
    - 2.5D isometric depth for the layer stack, switching to a flat layout at narrow widths or high zoom.
    - Motion shows *cause and effect*, with one focal element per step (Mayer's coherence and signaling principles).
    - No ambient looping inside the walkthrough.
    - Brightness changes are capped at high playback speeds, for flash safety.
- **Interaction model: Player, Chapters, Token card, Depth.**
  - **Player bar:** play/pause as the first control, then step, previous/next chapter, speed, replay, and skip. The scrubber has chapter segments plus ± buttons, so nothing requires dragging (WCAG 2.5.7).
  - **Token card:** a docked panel, not an overlay that would hide focus. Esc closes it and returns focus to the token.
  - **Depth switch:** Simple, Detailed, Technical.
  - **Shortcuts:** active only while the walkthrough has focus. They can be remapped or turned off, and `?` lists them.
- **Layouts:**
  - **Desktop:** chat about 38%, walkthrough about 62%.
  - **Tablet:** the chat collapses.
  - **Mobile:** "Chat | How it works" tabs, chapter cards, and touch targets of at least 44 px.
  - Captions and labels are HTML rather than SVG text, so they reflow and respect the user's text-spacing settings.
- **Reduced motion.** Follows the OS setting, plus an in-app toggle. It switches to step mode: discrete slides, fades of 200 ms or less, and the clock never runs. A link to the Transcript view sits at the top for screen-reader users.
- **Streaming accessibility:**
  - The reply region is `aria-busy` while streaming, with one polite announcement when it completes.
  - The wait counter uses `role="timer"`.
  - Errors are announced as text, with the time until the user can retry.
  - Descriptions update only when the step changes, at most once every 2 s while playing, with a full description when paused.

---

## 3. Technical architecture

### 3.1 Verified platform facts (official docs and registries, 2026‑09‑29)

**OpenAI API**
- The **Responses API** is recommended for new projects. Chat Completions is still supported. The Assistants API shut down on 2026‑08‑26.
- `store` **defaults to true**, which means 30 days of application-state retention. `store:false` disables that.
- Abuse-monitoring logs are kept for up to 30 days regardless. API data isn't used for training unless you opt in.
- `safety_identifier` replaces `user`. It holds a hashed ID of at most 64 characters.

**Logprobs**
- Request them with `top_logprobs` (0–20) plus `include:["message.output_text.logprobs"]`.
- They stream on `response.output_text.delta` events as `{token, logprob, top_logprobs[]}`. One delta can contain several tokens.
- **Streamed entries have no `bytes` field.** The final response object includes it. Fewer than 20 alternatives may come back.
- **Token IDs are never returned.**
- Logprobs, `temperature`, and `top_p` work only on non-reasoning models, or with `reasoning.effort:"none"`.
- GPT‑6 Astra and GPT‑6.1 Sol can't run at `none`. GPT‑5.5 and 5.6 have reasoning on by default.
- Documented support at `none` covers GPT‑5.4 and 5.2. For GPT‑6 Sol and Luna it is only implied.
- A forum report describes errors with `top_logprobs ≥ 2` on GPT‑5.2–5.4, still unresolved. Phase 0 checks this.

**Responses API parameters and outputs**
- There is **no `stop`, `seed`, or `n` parameter**.
- `truncation` defaults to `"disabled"`: an over-limit request fails with a 400 error.
- Usage fields: `input_tokens`, `input_tokens_details.{cached_tokens, cache_write_tokens}`, `output_tokens`, and `output_tokens_details.reasoning_tokens`.
- Response status: `completed`, `incomplete`, `failed`, `cancelled`, `queued`, or `in_progress`.
- Incomplete reasons: `max_output_tokens`, `content_filter`, `max_messages`, or `steered`.
- Events carry a `sequence_number`. `response.output_text.done` carries the final text.

**Token counting and cancellation**
- `POST /v1/responses/input_tokens` gives exact input counts.
- The official tiktoken maps the `gpt-5*` prefix to `o200k_base`. **The GPT‑6 tokenizer is not published.**
- Server-side cancellation works only for responses created in background mode. **What gets billed after a client aborts is undocumented, so we assume the tokens generated so far are billed.**

**Other OpenAI features**
- Moderation (`omni-moderation-latest`) is free.
- Hard monthly spend caps are available and return 429 once reached.
- Prompt caching is automatic for prompts of 1,024 tokens or more on GPT‑5.6 and later.
- The `openai` SDK v7.25 needs Node 22 or newer.

**Candidate models**, in the cost order the probe tests them. Prices are per million tokens, input / output.

| Model | Price | Notes |
|---|---|---|
| `gpt-6-luna` | $0.10 / $0.50 | The cheapest current model. It supports `none`, but logprob support is only implied, and the tokenizer is unpublished (the round-trip check decides). |
| `gpt-4o-mini` | $0.15 / $0.60 | Non-reasoning. The Cookbook demonstrates logprobs with it. Official `o200k_base` mapping. 128k context. No deprecation listed. |
| `gpt-5.4-nano` | $0.20 / $1.25 | Effort defaults to `none`. The `gpt-5` prefix maps to `o200k_base`. Logprobs are documented for the GPT‑5.4 family, but not for nano specifically. |
| `gpt-4.1-mini` | $0.40 / $1.60 | Non-reasoning. 1M context. |
| `gpt-5.4-mini` | $0.75 / $4.50 | Explicitly documented and reliable, but likely more than the budget needs. |

Avoid `gpt-4.1-nano` (shuts down 2026‑10‑23) and `gpt-5-nano` (shuts down 2026‑12‑11; no logprobs).

**Next.js**
- The current version is **16.3.7**. A **security release, 16.3.8, is due 2026‑09‑30**, so pin to 16.3.8 or later. (Pinned to 16.3.8 on 2026‑09‑30.)
- Turbopack is the default bundler.
- `middleware.ts` has been renamed `proxy.ts`.
- The **Edge runtime is deprecated**, so everything runs on Node.
- **Streaming and responses:**
  - Route Handlers stream a `ReadableStream`.
  - POST responses are never cached.
  - Status and headers can't change once streaming starts.
  - Server Actions are queued, so they don't work for chat.
  - Next.js doesn't document how `request.signal` behaves when the client disconnects.
- **Security headers:** a CSP built on nonces forces every page to render dynamically.
- **Scaffolding:** `create-next-app` now generates an `AGENTS.md` and a `CLAUDE.md` that points to it.

**Vercel**
- Fluid compute. Maximum function duration is 300 s on Hobby and 800 s on Pro, and streaming time counts toward it.
- Hobby allows one WAF rate-limit rule. BotID Basic is free.
- Node 24 is the default, and Node 20 is deprecated as of 2026‑10‑01.
- **Hobby is for non-commercial personal use only.** A project whose code is written by paid staff counts as commercial.

**Libraries**
- **Motion 13:** MIT license.
- **GSAP 3.15:** free, including plugins.
- **Three.js r186:** WebGPURenderer is still *experimental*, and WebGLRenderer is still recommended.
- **R3F 9.8:** requires React ≥19 and <19.4.
- **`@react-three/a11y`:** unmaintained since 2022.
- **`gpt-tokenizer` 4.0:** supports `o200k_base`. The token-rank data is about 1 MB gzipped.
- **Transformers.js 4.3:** returns logits and the KV cache, but **not attention weights without a custom export**. GPT‑2 downloads are 128–281 MB.
- **UI:** shadcn/ui defaults to Base UI (since 2026‑07); Radix is still supported.
- **Tooling:** Vitest 5 (Node ≥22.12), Playwright 1.63, `@axe-core/playwright` 4.13, Tailwind 4.3, Zustand 5, `@upstash/ratelimit` 2.2.

**Local machine**
- Node **21.6.1** is installed, which is too old. **Install Node 24 LTS before Phase 0.**

### 3.2 Recommended stack
| Concern | Choice | Why | Status |
|---|---|---|---|
| Runtime | Node.js 24 LTS (`engines.node: "24.x"`) | The SDK, the test runner, and Vercel all require it | Required |
| Framework | Next.js ≥16.3.8, App Router, TypeScript `strict`, Node runtime | Required by the brief; the current long-term-support release | Required |
| LLM access | Official `openai` SDK v7, **Responses API**, behind a server-only adapter | Raw per-token logprob events; our own labeled event protocol | Decided |
| Vercel AI SDK | **Not used** | Its OpenAI provider attaches logprobs only when the reply finishes | Decided |
| Model | **The cheapest candidate that passes every Phase 0 visualization check.** Expected first choice: `gpt-6-luna` at `reasoning.effort:"none"`. Fallbacks, in cost order: `gpt-4o-mini`, `gpt-5.4-nano` (at `none`), `gpt-4.1-mini`. All run with temperature 1, top_p 1, and `top_logprobs:20`. | This is your rule: the cheapest model that gives the best visualization outcomes. At $20/month, price per turn sets how many turns a day the site can serve. | **Rule decided; model picked in Phase 0** |
| Tokenizer | A `LocalTokenizer` interface. `gpt-tokenizer` (pure JS, maintained) by default; WASM `tiktoken` if exact byte-per-token output is needed. **Server-side in MVP.** | Keeps about 1 MB off the client | Provisional (Phase 0) |
| Visualization | SVG + HTML/CSS drawn as **pure functions of `(step, progress)`**. `d3-scale`, `d3-shape`, and `d3-interpolate` handle geometry. Our own playback clock. Canvas 2D only for dense views. | Deterministic, seekable, and accessible (see the evaluation below) | Provisional |
| UI animation | Motion only for UI transitions *outside* the walkthrough timeline, such as drawers and panels | Animations that play on their own clock can't be scrubbed or replayed exactly | Provisional |
| UI primitives | shadcn/ui on **Base UI**, plus Tailwind 4 and CSS-variable design tokens for a Matrix-inspired dark theme (default) and a "green-bar" light theme. Fonts through `next/font` (e.g. IBM Plex Mono and Plex Sans). | Accessible sliders, tabs, dialogs, tooltips, and toggle groups, owned as source code. Self-hosted fonts avoid layout shift. | Provisional |
| State | Zustand vanilla stores for the conversation and preferences. Playback runs on a pure state machine plus the clock, exposed through `useSyncExternalStore`. | Small and testable; no React state updates on every frame | Provisional |
| Abuse & cost controls | **Budget: $20/month (OpenAI hard cap); app ledger about $0.55/day.**<br>Layers:<br>• Hobby's one WAF rate-limit rule, per IP, on `/api/chat`<br>• in-handler per-session and per-IP quotas (for example, 6 per minute and 30 per day)<br>• a one-stream-at-a-time lock<br>• a micro-dollar budget ledger in Upstash Redis (free tier; verify its limits in Phase 0)<br>• BotID Basic | Layered defenses, because serverless instances share no memory. A small budget makes the circuit-breaker essential. | Budget decided; tooling provisional |
| Safety | `omni-moderation-latest` on user input before generation, shown as an event in the app lane | Free. It blocks before anything is spent, and it's sensible for a public site with a general audience. | Decided |
| Markdown | `react-markdown` plus `rehype-sanitize`: no raw HTML, no images, safe links | Blocks cross-site scripting and data exfiltration through image URLs | Provisional |
| Tests | Vitest 5, Testing Library, `fast-check`, Playwright, `@axe-core/playwright` | Property tests for alignment, the context policy, and the ledger | Provisional |
| Hosting | **Vercel Hobby** (a personal, non-commercial project), Fluid compute, with an explicit `maxDuration` of about 60 s. Add a custom domain once you buy it; the Origin allowlist comes from an env var. | Native streaming, one WAF rule, and BotID Basic, all free. Hobby's 300 s maximum is plenty. | Decided |

**Evaluation of visualization technologies.** Recommendation: a hybrid built primarily on DOM and SVG.

| Tech | Best for here | Weakness | Use |
|---|---|---|---|
| SVG + HTML/CSS | Token chips, attention arcs (`d3-shape` links), bar charts, the 2.5D layer stack, text | Slows beyond roughly 1–2k animated nodes, so long views are windowed | **Primary** |
| Own clock + CSS variables | Deterministic seek, speed, and stepping. A token reveal can be pure CSS, e.g. `opacity: clamp(0, calc(var(--p)*var(--n) - var(--i)), 1)` | We build it, but it's small | **Primary** |
| Canvas 2D | The **token rain** (decorative, ≤30 fps, pauses when hidden); the compressed vocabulary strip; heatmaps of long contexts | No built-in semantics, so it needs a parallel text alternative or `aria-hidden` | **Targeted** |
| Motion / GSAP | Drawer and panel transitions (Motion); complex choreography (GSAP, now free) | Each runs its own timeline, which conflicts with a seekable clock | Motion for UI chrome only; GSAP isn't needed |
| PixiJS | Thousands of animated sprites | About 261 KB gzipped; accessibility is opt-in | Not needed |
| Three.js / R3F | Where depth *is* the concept: a 3D embedding map, the layer stack | About 240 KB+ gzipped, GPU and battery cost, no maintained accessibility layer | **Post‑MVP, optional**, lazy-loaded, WebGLRenderer, each with a 2D equivalent |

3D is never the only way to understand anything.

**Prior art we build on rather than duplicate:**
- **Transformer Explainer** (MIT license): real GPT‑2 internals. It ships a custom export of about 657 MB.
- **bbycroft's LLM Visualization:** a 3D walkthrough.
- **OpenAI's Tokenizer.**

This project differs in three ways. It is grounded in *the user's* conversation with a production model. It labels its data honestly. It covers the conversation and context lifecycle, for non-technical audiences.

### 3.3 Module layout & boundaries (planned)
```
src/
  app/          pages + api/chat/route.ts (thin: Node runtime, maxDuration → server/chat/handler)
  server/       chat/ (handler, precheck, relay, sse) · openai/adapter.ts (ONLY OpenAI-aware module)
                tokenizer/ · budget/ (ledger, pricing, settle) · limits/ (rate, concurrency) · signing/ · config.ts
  shared/       protocol/ (v1 types, validation, SSE parser) · provenance/ (types, registries, mint, combine, read)
                context-policy/ · errors.ts · units.ts (branded ServerMs / ClientMs / PlaybackMs)
  trace/        log · reducer · finalize · align/ · reconcile · persist/
  generation/   client (fetch, AbortController, watchdog) · conversation store
  playback/     machine · clock · controller · compile/ (compile, pacing, montage, moments, focus)
  stages/       contract · registry · <stage-id>/{build, View, describe} · illustrative/ (seeded generators)
  components/   provenance/ (Datum, ProvBadge, SourcedFigure) · chat/ · viz/ (StageHost, Controls, Scrubber, TextAlternative)
content/ (stage copy MDX, glossary, claims register) · fixtures/ · scripts/ (probe, record-fixture) · e2e/ · docs/
```

**Import rules**, enforced with ESLint `no-restricted-imports`:
- `shared` imports nothing from the app.
- `server` imports only from `shared`.
- `trace` imports only from `shared`.
- `generation` imports from `shared` and `trace`.
- `playback` and `stages` import from `shared`, `trace` (types only), and `components/provenance`.
- Nothing on the client imports from `server`, enforced with `server-only`.

**Who can create which values:**
- **Only `trace/` can create Recorded values.**
- **Reference values come only from `server/config`**, and each one carries a documented source and retrieval date. The server echoes them to the client in the `start` event, and `trace/` labels them Reference, never Recorded.
- Everything downstream can pass a label through or weaken it, but never strengthen it.

### 3.4 End-to-end flow
```
Browser                                    Route handler (Node, stateless)                          OpenAI
Composer → conversation store
  POST /api/chat ChatRequestV1 {messages (assistant turns HMAC-signed), options} + AbortSignal ─►
                                           precheck: origin · size · schema · BotID · rate · lock
                                           verify signatures · tokenize · context policy · reserve budget · moderation
                                           (any failure → HTTP 4xx/5xx JSON AppError; no stream)
  ◄─ SSE start {exact upstream request body, context report, limits in effect, input token runs}
                                           responses.create({stream, store:false, top_logprobs:20,
                                             include:[logprobs], reasoning:{effort:"none"}, truncation:"disabled"}, {signal}) ─►
  ◄─ SSE upstream_open · response_created {resolved snapshot}
  ◄─ SSE delta {text, logprobs[], upstreamSeq}  (heartbeat comment every 15 s when idle)        ◄── output_text.delta
  ◄─ SSE text_done · end {outcome, reason, usage, textSha256, local output tokens, assistantSig, ledger basis}
                                           finally: settle ledger · release lock · log metadata (never content)
TraceLog (append-only, persisted) ─fold→ FinalizedTrace (labeled facts) ─compile→ PlaybackScript ─clock→ stage views
```

### 3.5 Data/event model: real events → facts → teaching choreography
Three layers, one job each:
1. **`TraceLog`** holds the raw wire events plus client timestamps. It is append-only and is **the only thing persisted**.
2. **`FinalizedTrace`** holds the labeled facts. It is a pure fold over the log.
3. **`PlaybackScript`** holds the teaching choreography. It is a pure function of the trace and the user's preferences.

Because fixtures are logs and facts are always recomputed, fixing a bug in alignment or labeling automatically fixes old turns too. Playback never touches generation. Durations come only from the *content* being taught, and the branded time units make it a type error to feed a measured `ServerMs` into pacing.

```ts
// Provenance. Runtime shape is { p, v }; `v` is hidden from the type system, so a Sourced value can't be
// dropped straight into JSX. It must go through <Datum as="pct" of={x}/>, which uses closed, meaning-preserving
// formatters and renders the label badge plus screen-reader text.
type Kind = 'recorded' | 'calculated' | 'reference' | 'example';
type RecordedSource = { via: 'sent' | 'done' | 'reported' | 'measured'; field: string; clock?: 'server' | 'browser' };
type Prov =
  | { kind: 'recorded'; source: RecordedSource }
  | { kind: 'calculated'; method: MethodId; from: ProvRef[]; assumptions?: string }
  | { kind: 'reference'; doc?: { url: string; retrieved: string }; general?: true }
  | { kind: 'example'; rule: RuleId; seed: string; from: ProvRef[]; otherModel?: string };
type Sourced<T, K extends Kind = Kind> = { readonly p: Prov & { kind: K }; readonly whatIf?: true; readonly [VALUE]: T };
// derive(method, inputs, f): weakest link wins (any example → example; recorded + reference → calculated); whatIf propagates.
// illustrate(rule, seed, inputs, f): always example; seeded RNG, so it stays pure.
// METHODS and RULES are closed registries with label and disclaimer copy.
// A typo is a compile error, and every badge popover has text.

// Wire protocol v1. The client can't send a system prompt, model, or tools. All options are clamped server-side.
interface ChatRequestV1 { v: 1; clientRequestId: string; conversationId: string;
  messages: ({ role: 'user'; id: string; content: string } | { role: 'assistant'; id: string; content: string; sig: string })[];
  options: { logprobs: boolean } }
type ServerEventV1 = { v: 1; seq: number; t: ServerMs } & (
  | { type: 'start'; requestId: string; upstreamRequest: UpstreamRequestView; context: ContextReport; inputTokens: TokenRuns }
  | { type: 'upstream_open' } | { type: 'response_created'; model: string }
  | { type: 'delta'; channel: 'text' | 'refusal'; text: string; logprobs: WireLogprob[] | null; upstreamSeq: number }
  | { type: 'text_done'; text: string }
  | { type: 'end'; outcome: 'completed' | 'incomplete' | 'failed'; incompleteReason?: string; error?: AppError;
      usage: WireUsage | null; textSha256: string; outputTokens: TokenRuns | null; assistantSig: string | null; ledger: SettleBasis });
// Pre-stream failures return a JSON AppError with a real status code (and Retry-After). After HTTP 200, failures arrive
// in-band as end{failed}. Unknown event types are ignored, so additive changes are safe; breaking changes bump to v2.

// Facts. The client stamps every entry with ClientMs. Terminal states are sticky.
type TraceLogEntry = { tc: ClientMs } & ({ k: 'server'; ev: ServerEventV1 } | { k: 'http_error'; status: number }
  | { k: 'user_abort' } | { k: 'stream_closed' } | { k: 'network_error' } | { k: 'idle_timeout' } | { k: 'recovered' });
// FinalizedTrace: request (incl. exact body), context report, input token runs, output {text, tokens: OutputToken[],
// source: 'provider'|'local'|'provider_prefix'|'none', chunks}, usage, timing, stop, reasoningGate, reconciliation, anomalies.
```

**Alignment.**
- The algorithm works on the whole text, never chunk by chunk, and uses UTF‑8 bytes:
  - Provider bytes come from the final response object.
  - Token strings are used where there are no bytes.
  - Lossy tokens are resolved by elimination between neighbors that are certain.
- Spans carry `partialStart` and `partialEnd` flags. An emoji split across two tokens shows each token's complete characters plus its partial bytes, and a bracket names the whole character.
- A segmentation is never mixed: it is either all provider tokens or all local tokens.
- **Reconciliation** never "corrects" a count. It shows both numbers with their labels:
  - joined text vs. `text_done`;
  - token count vs. `usage.output_tokens` (tolerance 0 for provider tokens);
  - input estimate vs. `usage.input_tokens`.

  Any mismatch becomes a visible footnote.

**Reasoning gate.**
- `reasoningGate = usage.reasoning_tokens === 0`.
- If false, the compiler swaps in the opaque hidden-tokens scene and turns off per-token timing and ordering claims.

**Close calls.**
- Computed only from Recorded logprobs, and only when tokens come from the provider.
- A token scores as a candidate when its probability is under 0.75, or when it wasn't the top option.
- Whitespace and punctuation are de-emphasized.
- The rule shown to users is "chosen <50% or top two within 15 points".
- The two moments with the highest score are kept, spaced apart, with ties broken deterministically.

**Script compiler.** `compileScript(trace, prefs)` builds the walkthrough in this order:
1. Hook.
2. Context.
3. Tokenize.
4. The prompt pass (`embed`, `layers`, phase `prefill`).
5. Options and pick for token 1.
6. Pass 2 (`layers`, phase `decode`, showing reuse of saved work).
7. Options and pick again at the first close call.
8. A montage, where each token gets `min(120 ms, 8 s / n)`. Reveals are batched so step mode stays navigable.
9. Stop.
10. Follow-up.

Pacing and focus:
- **Durations:** set by distributing time across steps, each at least its reading time (230 words per minute plus 1.5 s), to hit a target of about 150 s at 1× and a hard cap of 240 s. The first plan said about 90 s and 120 s, which left less time per step than reading the captions takes (ADR 0007).
- **Focus re-runs:** replaying the walkthrough for a user-chosen token has a fixed budget of about 15 s.
- **Caching:** compiled scripts are cached, keyed by trace ID and the structural preferences.

**Clock and playback machine.**
- **One `requestAnimationFrame` clock:**
  - Frame gaps are clamped to 100 ms, so a background tab never jumps ahead.
  - Autopause triggers at close-call steps.
  - It publishes snapshots only at step boundaries, so React re-renders per *step*, never per frame.
  - Progress within a step reaches views through a CSS variable (`--p`) or a ref callback.
  - Step mode never starts the frame loop.
- **A hand-written, pure machine:**
  - States: `idle`, `live`, `compiling`, `ready`, `playing`, `paused(user|step|moment|hidden)`, `ended`, `error`.
  - Transitions return side effects rather than performing them.
  - Choosing a focus token pushes a frame, and closing it pops back to the saved position.
  - Changing a structural preference recompiles and keeps the position.
  - A hidden tab pauses playback.

### 3.6 Conversation, context policy, streaming, cancellation, errors
- **Conversation state.**
  - It lives on the client. Raw logs are persisted to `sessionStorage` (scoped to the tab), with a least-recently-used cap. If storage quota runs out, older turns keep their text but lose replay, and the UI says so.
  - **Clear conversation** wipes everything.
  - The server is stateless and doesn't use `previous_response_id` or the Conversations API. The explicit payload is the thing we visualize, and this avoids storage on the provider side.
- **Signed assistant turns.**
  - Assistant turns carry an HMAC signature over the conversation ID, message ID, a hash of the previous user text, and a hash of the text the server itself accumulated, plus an issue time. Signing keys can be rotated.
  - A forged turn is rejected with `invalid_history`. A stale turn is dropped and reported as expired.
  - Stopped or interrupted replies have no signature, so they aren't re-sent. Ch7 explains why.
- **Context policy.** A pure function, shared by server and client; the server's result is authoritative.
  - Input budget = min(context window, app cap) − `max_output_tokens` − safety margin.
  - The system prompt and the newest user message are always kept. If they alone don't fit, the request fails with `context_too_long`.
  - Older content is kept as a *contiguous run of the most recent* user/assistant pairs. An older pair is never kept in place of a newer one.
  - Upstream uses `truncation:"disabled"`, so the provider never silently cuts. If our estimate undershoots, we get an explicit `upstream_context_length` error, which feeds back into tuning the safety margin.
  - Defaults (provisional): input budget 6,000 tokens, output 600 (cap 800), 12 turns.
- **Streaming.**
  - Messages are framed as `id/data`, LF only, with a heartbeat comment every 15 s.
  - Headers: `text/event-stream`, `no-cache, no-transform`, `X-Accel-Buffering: no`. Compression is off for this route.
  - The client uses a hand-written SSE parser with a streaming `TextDecoder`, which handles UTF‑8 characters split across chunks.
  - Streamed text is batched per animation frame.
- **Loading states.**
  - While a request is in flight:
    - the Send button turns into Stop;
    - the live strip shows "request sent" and the timer;
    - the composer is disabled but keeps any draft.
  - Chapter bundles are prefetched once the first reply starts. Lazy views show skeletons.
  - The walkthrough panel shows "preparing walkthrough" while the script compiles, which usually takes under 50 ms.
- **Cancellation, in order:**
  1. The user presses **Stop**. The client calls `abort()`, records `user_abort`, and the trace is final and replayable immediately.
  2. The server hears it through **both** `request.signal` and `ReadableStream.cancel()`, and aborts the SDK call.
  3. The server's `finally` block settles the ledger as `partial_estimate`, releases the lock, and logs metadata only.
  4. Phase 0 verifies this sequence on the real host.
- **Interruptions:**

  | Case | How it's detected | Result |
  |---|---|---|
  | Upstream ends without a terminal event | Server sees the upstream stream finish | `end{failed, upstream_stream_interrupted}` |
  | Transport drops, or `maxDuration` is hit | Client sees the stream close or error | `interrupted(transport)`; server cancels upstream |
  | Nothing arrives for a while | Client watchdog at 45 s; server watchdog at 60 s | Client: `interrupted(idle)`. Server: `upstream_timeout`. |
  | Page reloads mid-stream | On load, a log with no terminal entry | `recovered`, then `interrupted(reload)` |

  In every case, the tokens shown are the provider tokens received so far (Recorded), followed by a labeled untokenized tail. Retry is a new request, and the UI explains that the new reply may differ.
- **Replay.** Replaying any turn uses its log only. E2E tests prove this by replaying with the network offline.
- **Budget ledger.**
  - Amounts are integer micro-dollars.
  - Before calling upstream, the server atomically reserves the maximum possible cost, against both a global cap and a per-client cap.
  - Settlement is idempotent. Its basis is one of:
    - `usage`: the reply returned usage counts;
    - `partial_estimate`: tokens relayed so far plus a small tail;
    - `none`: the error came before the stream;
    - `expired_full`: the server crashed; a sweep based on time-to-live charges the full reservation.
  - If Redis is unreachable, requests are refused (fail closed).
- **Errors.** Each code has fixed copy, a retry rule, and a UI state. Raw provider text is never shown.

  | Group | Codes | Retry and UI |
  |---|---|---|
  | Pre-stream (HTTP) | `bad_request`, `payload_too_large`, `invalid_history`, `context_too_long` | No retry; clear explanation |
  | Pre-stream (HTTP) | `rate_limited`, `concurrent_request` | Retry-After with a countdown |
  | Pre-stream (HTTP) | `daily_budget_exhausted` | Reset time; offer the sample conversation |
  | Pre-stream (HTTP) | `service_unavailable` | Try again later |
  | In-band | `upstream_rate_limited` | Retry with backoff |
  | In-band | `upstream_overloaded`, `upstream_timeout`, `upstream_stream_interrupted`, `upstream_failed` | Keep the partial reply; offer retry |
  | In-band | `upstream_context_length`, `upstream_refused_request`, `upstream_misconfigured` | No retry; ops are alerted where relevant |
  | Client | `network_error`, `stream_interrupted` | Retry |
  | Client | `protocol_error` | Reload |

  - `incomplete` and `aborted` are *outcomes*, not errors, and Ch6 explains them.
  - The SDK retries at most once, and only before any output. Nothing retries automatically after the first delta.

### 3.7 Security, privacy, performance, cost
- **Security.**
  - `OPENAI_API_KEY` exists only in the server environment, never as `NEXT_PUBLIC_*`. Modules that touch it use `server-only`, and CI searches the build output for key patterns.
  - A dedicated OpenAI project and key, with a hard spend cap.
  - The model, system prompt, and caps are set server-side.
  - zod enforces bounds: message ≤4,000 characters, ≤12 turns, request body ≤128 KB.
  - An Origin allowlist and BotID.
  - A static CSP and security headers in `next.config`, so the landing page stays static.
  - Model output is rendered as sanitized Markdown with no images.
  - The system prompt is public by design.
- **Privacy.**
  - A notice appears before the first message. It explains that:
    - messages are sent to OpenAI;
    - this app stores nothing on its servers;
    - OpenAI keeps abuse-monitoring logs for up to 30 days;
    - OpenAI doesn't train on API data by default;
    - users shouldn't enter personal data.
  - Logs hold only IDs, sizes, token counts, timings, status, and error codes.
  - `safety_identifier` is an HMAC of the anonymous session ID.
  - Analytics are cookieless and never include content.
  - `/privacy` cites OpenAI's data-controls documentation, with a review date.
- **Performance targets (provisional).**
  - LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, all at the 75th percentile.
  - Script size is a warning, not a gate (owner, 2026-09-30): about 150 KB gzipped for the landing page and
    250 KB for the chat route, before lazily loaded stages. Going over prompts a look for cheap savings, but it
    never blocks a better product.
  - At least 60 fps on a mid-range laptop and 30 fps on a mid-range phone.
  - Only transforms and opacity are animated.
  - Long token strips are windowed.
  - A render-count test ensures playback commits roughly once per step.
- **Cost** (Calculated from the price table dated 2026‑09‑29):
  - **Budget: $20/month.** Set a $20 hard cap at the organization level in OpenAI. If project-level caps are available, split them: production $17, development and probes $3.
  - **Daily cap:** the app ledger allows about **$0.55/day** (≈ $17 ÷ 31) and resets at UTC midnight.
  - **Typical turn** (about 1,500 input and 350 output tokens), and how many fit in $0.55/day:

    | Model | Cost per turn | Turns per day |
    |---|---|---|
    | gpt‑6‑luna | ≈ $0.00033 | ≈ 1,700 |
    | gpt‑4o‑mini | ≈ $0.00044 | ≈ 1,250 |
    | gpt‑5.4‑nano | ≈ $0.00074 | ≈ 750 |
    | gpt‑4.1‑mini | ≈ $0.0012 | ≈ 470 |

  - **Worst case per request** (6k input, 800 output): about $0.001 on gpt‑6‑luna, or about $0.0037 on gpt‑4.1‑mini.
  - **Per-session quotas** (for example, 30 turns a day) keep any one visitor to a small share of the daily budget.
  - **Controls:**
    - the output cap and context budget;
    - a visible system prompt that asks for concise answers (these also visualize better);
    - the turn cap and quotas;
    - the ledger and the hard cap.
  - **Fallback:** when the day's budget runs out, the sample conversation is a free fallback, with a "come back after ‹reset time›" message.
  - **Development:** probe runs and development use the development project and its cap. A full probe run is a few dozen short requests, costing cents.

### 3.8 Key limitations & feasibility risks
| Risk | Mitigation |
|---|---|
| Logprob support depends on the model and effort level, and may disappear from future defaults | A capability registry; the probe script; the sample-conversation fallback is designed in; nothing is ever invented |
| Models are retired | Deprecation dates in the registry; swapping models is a config change plus a probe run |
| OpenAI's event and field shapes change | A single adapter that lists its assumptions; recorded fixtures; a contract test before each release |
| The tokenizer doesn't match (GPT‑6 is unpublished; hidden formatting) | Reconciliation shown to users; "assumed" labels; a round-trip check that each provider token string encodes to exactly one local token; a safety margin |
| Logprob semantics are unknown (before or after temperature? is the chosen token always in the top 20?) | Phase 0 experiment; the copy avoids the claim until measured |
| Disconnects may not propagate; billing after an abort is unknown | Both abort paths wired; watchdogs; estimates assume the tokens were billed |
| Buffering by proxies, compression, or Safari | Headers; heartbeats; a Phase 0 cross-browser check; padding if needed |
| People mistake examples for real internals | Labels inside the graphics; uniform-weight arcs; examples shown on a sample first; misconception probes |
| The provider adds hidden formatting, instructions, or safety systems | Disclosed in Ch1; we show only what we can see |
| There is no `seed`, so replies can't be reproduced | Replays use recorded logs; regenerate shows the variability on purpose (later) |
| Bots and cost abuse | Layered limits; BotID; ledger; hard cap; signed history |
| Complex visuals are hard to make accessible | Transcript view; `describe()` per step; manual screen-reader passes |
| Framework churn and security issues | Pinned versions; Renovate or Dependabot; re-verify docs whenever the API layer is touched |

---

## 4. Implementation roadmap
Guiding rule: **prove the teaching loop with plain 2D and a data inspector before adding visual complexity.** Each phase ends with a demo and a written go/no-go decision.

**Phase 0: Foundations & feasibility spikes (~1 week)**
- *Prerequisites:*
  - Node 24 LTS installed.
  - An OpenAI organization hard cap of $20/month. Production and development projects with their own keys and caps, if the dashboard supports project caps.
  - A Vercel Hobby account.
  - An Upstash Redis database, from the free tier, connected through the Vercel Marketplace.
  - The blocking questions are answered.
- *Deliverables:*
  - Initialize git.
  - Scaffold Next.js ≥16.3.8 in a **temporary directory, then merge it in**. `create-next-app` generates its own `AGENTS.md` and `CLAUDE.md`. Keep ours and reference `AGENTS.md` from it.
  - Set up tooling: typecheck, lint, test, e2e, and `probe`.
  - **`scripts/probe-capabilities.ts`** runs a fixed set of prompts against each candidate model, records sanitized fixtures, and checks:
    1. Logprobs are present in deltas and in the final response (with bytes). `top_logprobs:20` doesn't error.
    2. **Whether logprobs change with temperature or top_p.** Compare the *first* output position only, at T = 0, 0.7, and 1.5 and top_p = 1 and 0.1, with a tolerance.
    3. How often the chosen token falls outside the top 20.
    4. How many tokens each stream event carries.
    5. `reasoning_tokens == 0` under the chosen settings.
    6. The gap between `response.created` and the first text delta.
    7. Whether a brand-new session gets cache hits on its first turn.
    8. Local vs. reported input counts across different message counts (about 30 prompts: English, code, emoji, CJK, right-to-left scripts, long text).
    9. Round-trip agreement between provider tokens and the local tokenizer.
    10. `incomplete` on a very small `max_output_tokens`.
    11. The usage fields and latency.
  - **Streaming spike on the target host:**
    - no buffering in Chrome, Firefox, Safari, and iOS Safari;
    - abort reaches upstream within about 1 s, confirmed in server logs;
    - heartbeats and `maxDuration` behave as expected;
    - the tokenizer bundles correctly on the server.
  - ADRs: 0001 model choice; 0002 hosting and limit store; 0003 event protocol v1; 0004 visualization stack; 0005 label system.
- *Acceptance:*
  - A capability matrix for the candidates, in cost order, with fixture evidence. Testing can stop at the first candidate that passes everything.
  - **The cheapest passing model is chosen:**
    - streamed top‑20 logprobs with no errors;
    - `reasoning_tokens == 0`;
    - temperature and top_p accepted;
    - tokenizer round-trip agreement of at least 99%;
    - no retirement within about 6 months;
    - acceptable replies on a 20-prompt quality set, judged by you.
  - The capability registry is filled in.
  - Round-trip agreement ≥99%, or a documented labeling fallback.
  - Streaming and abort verified on a deployed preview.
  - Logprob semantics recorded in an ADR.
  - No product features yet.

**Phase 1: Real chat + trace foundation (~2 weeks)**
- *Deliverables:*
  - The provenance types and registries, with type-level tests.
  - Protocol v1 and the SSE parser.
  - The adapter.
  - The full guard pipeline in the handler.
  - The memory ledger, then the Redis ledger.
  - Signing.
  - The trace reducer, finalize, alignment, and reconciliation.
  - The chat UI: streaming, stop, retry, every error state, sanitized Markdown.
  - The privacy notice and page.
  - A **Trace Inspector** debug view that tables every value with its label. It becomes the seed of the Transcript view.
- *Acceptance:*
  - Property tests pass for alignment (random Unicode, cuts in the middle of a code point, lossy tokens), the reducer (any truncation gives `interrupted`), the context policy, and the ledger (concurrent reservations never exceed the cap).
  - A handler test shows an abort propagating and the ledger settling.
  - A ledger simulation of a busy day, including aborts and crashes, never exceeds the $0.55 daily cap by more than one request.
  - Mocked E2E covers: send → stream → stop → retry → follow-up.
  - Every error code renders its UI.
  - No API key appears in the client build.
  - A forged assistant turn is rejected.

**Phase 2: Educational MVP, 2D visualizer v1 (~4 weeks)**
- *Status (2026-09-30):* the core is built. ADR 0007 records what changed from this plan, what was
  measured, and which items are deferred.
- *Deliverables:*
  - The machine, clock, compiler, and StageHost.
  - The player bar, chapters, token card, and depth switch.
  - The live strip.
  - The Hook plus Ch1–7 at Simple and Detailed depth.
  - The sample-conversation fallback.
  - The MVP deep dives.
  - The Transcript view.
  - Step mode, and shortcuts scoped to focus.
  - The mobile layout.
  - The landing page, and the sample conversation (a real recorded log, dated).
  - The Matrix-inspired design system:
    - theme tokens for dark and light, checked for contrast;
    - the token-rain component;
    - decode reveals;
    - the Effects toggle.
  - The claims register and the content lint.
- *Acceptance:*
  - Type-enforced labels.
  - A DOM test fails if any digits or model text appear outside a labeled element or UI chrome.
  - Deterministic snapshots of scenes and steps.
  - A purity test: the compiler runs with `Math.random`, `Date.now`, and `fetch` rigged to throw.
  - A render-count test.
  - Offline replay E2E.
  - axe reports no serious or critical issues.
  - A keyboard-only E2E and a reduced-motion E2E pass.
  - A manual NVDA and VoiceOver pass.
  - The speed targets (LCP, INP, CLS) are met on a throttled mid-range phone profile. Script size is reported
    as a warning only.
  - A self-review against the accuracy rules in `CLAUDE.md` §3. Every claim cites a source, and the content lint passes.

**Phase 3 (optional): Informal feedback (a few days)**
- *Method:*
  - Have a few non-technical friends or family members try the walkthrough without help.
  - Afterward, ask them 3–4 of the probe questions from the §2 misconception table in conversation. Ask them to *explain*, not to rate themselves: polished animations make people overestimate how well they understand.
  - Watch the in-app "real or example?" check, and optionally a one-tap "Did this make sense?" rating. Both are anonymous and content-free.
- *Outcome:* fix whatever confused people, especially anything that suggests the examples are real internals. There's no formal study and no numeric targets.

**Phase 4: Depth & polish (~3–4 weeks)**
- *Deliverables:*
  - Technical depth and formulas.
  - The saved-work deep dive (KV cache and prompt caching).
  - Stepping through individual layers and a switcher for types of attention head.
  - **Regenerate & compare.**
  - Real temperature presets, if the model supports them.
  - A tokenizer playground in a lazily loaded Web Worker (about 1 MB).
  - A meaning map from a named open embedding model.
  - Optional 3D (R3F with WebGLRenderer), each view with a 2D equivalent.
  - Presenter mode.
- *Acceptance:*
  - The same gates as Phase 2.
  - The 3D code isn't fetched unless opened.
  - The new views don't make the "real or example?" check harder to pass.

**Phase 5: Optional workflows & extensions**
- A real web-search or tool-call demo, built only from actual events. Verify the tool event shapes at that point.
- A small-open-model lab, starting with GPT‑2 attention precomputed to JSON and labeled "Example: real data from GPT‑2".
- The reasoning-model module.
- Localization.
- More providers through the adapter, for example Anthropic. Verify capabilities first, and don't assume logprobs.

**How correctness and understanding are assessed**
- **Technical correctness:**
  - Unit, property, contract, component, E2E, accessibility, and performance suites.
  - Three fixture layers, each tested against its consumer:
    - raw SDK events → the adapter;
    - wire SSE → the parser;
    - TraceLogs → finalize and compile.
  - Golden tokenizer vectors from Python `tiktoken`.
  - The live probe runs before each release to catch drift.
- **Scientific accuracy** (lightweight, for a personal project):
  - A claims register recording each claim's sources and the date it was last checked.
  - A content lint for banned phrasings.
  - A self-review against the accuracy checklist in `CLAUDE.md` §3 before each release.
  - No external expert review.
- **Understanding** (informal):
  - Informal feedback from a few people, using the probe questions.
  - The in-app "real or example?" check.
  - Content-free funnel analytics: walkthrough completion, and skips per chapter.
  - No formal study.

---

## 5. `CLAUDE.md`
The project's rules and conventions live in [`CLAUDE.md`](../CLAUDE.md) at the repository root. They cover
accuracy and transparency, architecture boundaries, accessibility, performance, security and data handling,
testing, MVP boundaries, and the implementation workflow.

---

## 6. Clarification questions (prioritized)

**Answered on 2026‑09‑30. Nothing blocking remains.**

| # | Question | Your answer | What changed in the plan |
|---|---|---|---|
| 1 | Budget and access | Personal project, funded by you, **$20/month at most**. Public, no sign-in. | $20 hard cap at the OpenAI organization level (production $17 and development $3 if project caps exist). App ledger about $0.55/day. Sample-conversation fallback. Per-session quotas. |
| 2 | Model priority | The **cheapest model that gives the best visualization outcomes**; it doesn't need to be the newest | Rule: pick the cheapest candidate that passes every Phase 0 check. Order: `gpt-6-luna` → `gpt-4o-mini` → `gpt-5.4-nano` → `gpt-4.1-mini`. |
| 3 | Hosting | Vercel is preferred. Personal project. Domain to be purchased. | **Vercel Hobby**, which permits non-commercial personal use. The Origin allowlist comes from an env var and gets the domain when you buy it. |
| 4 | Data retention | Store nothing on the server | Confirmed: nothing stored on the server; content-free analytics only; sharing stays out. |
| 5 | Minors | General audience of adults and older teens | Confirmed: not directed at children, so no under‑18 safeguards are needed. Input moderation stays. |
| 10 | Accuracy reviewer | Not needed for a personal project | Replaced by: a source for every claim, the content lint, and self-review against `CLAUDE.md` §3. |
| 11 | User-study participants | Not needed for a personal project | Phase 3 becomes optional informal feedback from a few people. No targets. |
| 12 | Identity and scope | Yes to all the defaults. Styling inspired by *The Matrix*. | Name "Token by Token". The visual direction is rewritten as a "digital-rain terminal" (§2): <br>• the token rain is made of real tokens <br>• real data glows and examples are wireframes <br>• body text is pale green-white, not neon <br>• a Matrix-dark default theme and a "green-bar printout" light theme <br>• an Effects toggle <br>• inspired by the film, not copied from it |

**Still open. We're proceeding on these defaults, so tell me if you want any changed.**

6. **Label vocabulary.** Your brief names three categories. We use four user-facing labels, **Recorded / Calculated / Reference / Example**, plus a **What‑if** modifier. The brief's terms appear at Detailed depth. Reference covers documented facts, like context limits and prices, that fit none of your three.
7. **How the walkthrough starts.** A static Hook card appears automatically, and Play is one click away. Autoplay is an opt-in preference.
8. **Depth ceiling.** Technical depth includes formulas (softmax, attention), collapsed by default.
9. **Real generation controls in MVP.** No. Temperature presets and regenerate-and-compare come in Phase 4. The MVP shows the actual settings sent, plus a what-if.

---

## Verification of this plan (how we'll know the framework holds)
- **Phase 0 probe results** confirm or overturn the load-bearing assumptions. That produces ADRs for:
  - how logprobs stream;
  - how logprobs relate to temperature;
  - how many tokens arrive per stream event;
  - whether the tokenizer round-trips;
  - `reasoning_tokens == 0`;
  - whether disconnects propagate and whether responses are buffered on the real host.
- **The Trace Inspector** (Phase 1) shows every value with its label before any animation exists. That proves the data model before visual work begins.
- **Phase 2 gates:**
  - labels enforced by types;
  - the DOM check for unlabeled data;
  - determinism and purity tests;
  - offline replay;
  - axe and keyboard tests;
  - a self-review of the claims against the accuracy rules, with a source for every claim.
- **Budget check:** the ledger and the OpenAI hard cap together keep spending at or under $20/month. A Phase 1 test simulates a day's traffic against the ledger.
- **Informal feedback** (optional Phase 3), from a few people plus the in-app "real or example?" check, shows whether non-technical users actually understand the material.
