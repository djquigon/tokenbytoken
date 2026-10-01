# CLAUDE.md

@AGENTS.md

> **Project status: Phase 2 (the walkthrough) built (ADRs 0007, 0008), in the "operator terminal" look (ADR 0009), plus a FAQ (ADR 0010).**
>
> **What exists:**
> - The chat (`/chat`) with streaming, Stop, retry, and every error state, backed by `/api/chat` and its
>   full guard pipeline (ADR 0006).
> - The label system (`src/shared/provenance/`), protocol v1, and the trace. The trace records every turn
>   as a TraceLog and folds it into labeled facts.
> - The walkthrough beside the chat:
>   - the Hook and chapters 1–7 at Simple and Detailed depth, with the player, chapter bar, and step mode;
>   - the token card, five deep dives, two exercises, the Transcript view, and the live strip;
>   - glossary popovers, "Is this real?" / "How do we know this?", the three lanes, and Detailed sub-scenes;
>   - remappable shortcuts, and the first-visit tour of the chat page.
> - The recorded sample conversation (`/sample`) and the landing page, with the token rain as its background.
> - The Trace Inspector, the privacy notice, and `/privacy`.
> - The claims register (generated `content/claims.md`) and the content lint.
> - The FAQ (`/faq`): twelve sourced answers, every number a labeled Reference value (ADR 0010).
> - The Phase 0 probe, fixtures, and ADRs 0001–0010.
>
> **Not built yet:** the few plan items ADR 0008 lists as still open (linked highlighting, the Hook's "pick
> another close call", an "Instant" speed), and everything after Phase 2. Sections below that describe
> those describe intended structure.
>
> Items marked **PROVISIONAL** are proposals, not decisions. When one is decided, record an ADR in
> `docs/decisions/` and update this file. Never describe planned files or commands as if they already exist.

## 1. Purpose & audience
"Token by Token" is an interactive website that explains how large language
models, such as OpenAI's GPT models and Anthropic's Claude models, generate responses. Users chat with a
real OpenAI model. Each reply is paired with a replayable walkthrough of inference, anchored to their actual
prompt and response.

- **Project type:** a personal, non-commercial project. The site is public with no sign-in. The owner pays
  for it, with a hard budget of **$20/month**. Nothing is stored on the server.
- **Primary audience:** non-technical adults who use chatbots. Assume no math beyond percentages.
- **Secondary audience:** technical-adjacent learners who want correct terminology and deeper mechanics.
- **General audience:** adults and older teens; not directed at children.
- **This is an educational illustration of inference.** It is not a reconstruction of any model's hidden
  computation or reasoning, and must never read as one.
- **Core learning outcomes:** generation happens one token at a time; text becomes tokens; context is
  re-sent (the model has no memory); the model produces scores, then a weighted random pick; users can tell
  real data from examples. Extended outcomes are listed in `docs/PLAN.md` §1.

## 2. Product & UX principles
1. **Plain language first, depth on demand.** Simple → Detailed → Technical. Define every term the first
   time it appears.
2. **Anchor everything to the user's conversation.** Use their real messages, tokens, options, and numbers
   wherever possible. Views of model internals are labeled examples.
3. **Honesty over spectacle.** Every animation must teach something. Remove motion that doesn't.
4. **One focal movement per step.** Motion shows cause and effect.
5. **The user controls pace:** play, pause, step, scrub, speed, replay, skip. The walkthrough is offered,
   not forced. The composer unlocks when it ends or is skipped, and skipping is one action.
6. **Familiar chat first.** The real reply streams normally, and the walkthrough never blocks reading it.
7. **Three lanes.** "This app" (Recorded app events), "OpenAI's service" (a black box: only what it reports),
   and "Inside a model like this" (Examples). Tools and retrieval appear only as real events.
8. **Three materials, used consistently:**
   - *learned parameters:* fixed while in use;
   - *context:* text sent with the request;
   - *working notes:* computed for this request, then discarded.

   The sampler is drawn outside the model.
9. **Keyboard, screen-reader, mobile, and reduced-motion users get the full lesson.**
10. **No dark patterns. Never track conversation content.**
11. **Visual identity: a "digital-rain terminal" inspired by *The Matrix*.** Green phosphor on near-black,
    with monospace glyphs.
    - Glyphs only ever represent *tokens* (text), never parameters or numbers.
    - The token rain is made of real tokens. On the landing page it fills the background, picked at random
      from thousands of real words and numbers, with no caption (owner, 2026-09-30). Every block of text
      sits on a solid card, never over it (ADR 0008).
    - Real data glows; examples are wireframes.
    - The look is an "operator terminal" (ADR 0009): framed bars, near-square corners, phosphor borders, a
      filled green primary button. Label hues: Recorded green, Calculated cyan, Reference blue, Example orange.
    - Body text is pale green-white, not neon.
    - Inspired by the film, never copied from it: no film names, quotes, logos, or glyph designs, and no pill
      motif.
    - Legibility, accessibility, and accuracy always win over effects.

## 3. Scientific accuracy & transparency rules (non-negotiable)
Violating any of these is a bug. That includes copy, tooltips, alt text, and marketing pages.

**Labels.** Every data-bearing element carries exactly one label, set through `Sourced<T>` and `<Datum>`.
Unlabeled data must not render.

| UI label | Brief term | Meaning |
|---|---|---|
| **Recorded** | Observed | Sent by this app, done by this app, reported by OpenAI, or measured by this app (server or browser) |
| **Calculated** | Derived | Computed from Recorded values (plus Reference values where needed), with the method and assumptions named |
| **Reference** | — | Documented facts (with URL and retrieval date) or general principles ("true of standard transformer models; not confirmed for this model") |
| **Example** | Illustrative | A teaching depiction, or real data from a *different* named model |
| **What‑if** | — | A modifier for hypotheticals: "simulated on this page; the model wasn't asked again" |

- **L1. Inputs decide the label.**
  - Any Example input makes the result Example.
  - Recorded plus Reference makes Calculated.
  - General knowledge can justify a method, but never supplies a number.
  - Annotations never upgrade a label.
- **L2. Inherited labels can only get weaker.** A panel badge never covers an Example element. Panels that
  contain examples say "Contains examples".
- **L3. Seeded is not real.** Seeded or stable values are Example. Invented values are never shown as
  numbers.
- **L4. Keep "Reported by OpenAI" separate from "Measured by this app."** Timestamps are Recorded; durations
  are Calculated. Attributing time to model phases makes it Example.
- **L5. Absence counts only as far as the app can see.** Say "no tools offered; no tool calls returned".
- **L6. Every label also exists as text:** in the accessible name, as a tag inside exported graphics, and as
  a prefix in the Transcript view. Never encode a label with color alone.

**Prohibitions and required framing**
- **A1. Internals.** Never claim or imply access to attention weights, activations, hidden states, the full
  probability distribution, or hidden reasoning. Logprobs are "the top N alternatives the API returned."
- **A2. No invented numbers on the user's real tokens.** If the configured model can't return logprobs, the
  options and pick chapters switch to the recorded sample conversation, and the user's tokens show "not
  available".
  - Some text arrives with no logprob entries even when logprobs are on (observed for some emoji). When a reply
    contains such text, the final logprob list can be empty.
  - Label those characters "OpenAI returned no alternatives for these characters". Never fill them in.
- **A3. Model self-explanations.**
  - Never present a model-generated explanation as the model's actual reasoning.
  - Never ship an "ask the model why it said that" feature presented as introspection.
  - Label any provider "reasoning summary" as "generated separately, not the hidden reasoning".
- **A4. Hidden reasoning tokens.** Tell the token-by-token story only when `reasoning_tokens == 0`. Otherwise,
  show an opaque "N hidden tokens (count only)" block and disable per-token claims.
- **A5. Chunks are not tokens.** Never imply that a streaming chunk corresponds to one token. Per-token
  compute time is unobservable, so never show it.
- **A6. Animation timing is for teaching, not measurement.**
  - Pacing comes from content only. Branded `ServerMs`, `ClientMs`, and `PlaybackMs` types make mixing them
    a type error.
  - Measured waits include network time and queueing. Never attribute them to "prefill".
- **A7. Retrieval, search, and tools are optional.** Context assembly always happens; retrieval, web search,
  and tools are optional workflows. Show them only as actual events, and never draw a greyed-out search step
  in the pipeline.
- **A8. Chatting doesn't train the model.** Parameters are fixed while in use. "Memory" means context that
  gets re-sent. Keep training and inference distinct.
- **A9. Undisclosed internals.** OpenAI hasn't published the design of its hosted models; it has for its
  open-weight gpt-oss models. Say "in many transformer models…". Never state internals for the configured
  model.
- **A10. Example patterns and vectors.**
  - Examples come only from seeded, documented generators (today in `src/stages/common.ts`, each with a
    rule in `src/shared/provenance/registry.ts`), based on published general phenomena (previous-token,
    duplicate-token, induction patterns).
  - Arcs have a fixed weight, and no numbers ever appear on arcs or vectors.
  - Introduce each pattern on a neutral sample before showing it on the user's tokens.
- **A11. Correct attention wording.** "Each position can draw on itself and earlier positions, never later
  ones." Decoding computes only the new position and reuses saved work (the KV cache). Never say "re-reads
  everything".
- **A12. Probability is not truth.** "Close calls" describe wording, not errors. Never link low probability
  to "probably wrong".
- **A13. Token IDs are always Calculated.** The API returns strings and bytes, not IDs. Name the tokenizer as
  "assumed". Show reconciliation with the counts OpenAI reports; never silently correct them.
  - `usage.output_tokens` counts tokens that are never returned as text. The count is per model (4 for
    gpt-6-luna) and is recorded in the capability registry.
  - Present the gap as an explained difference ("OpenAI counted 44; 40 are visible"), not as an error.
  - Always encode with special-token strings treated as ordinary text, because users can type `<|endoftext|>`.
- **A14. Cached tokens.** Describe them as "saved intermediate results for an identical start of the request
  (often this app's shared instructions)". Say explicitly that this doesn't give the model memory.

**Language guide**
- **Prefer:** predicts, computes, scores, generates, "weighted random pick", "token card", "processing the
  prompt (all at once)", "generating the reply (one token at a time)".
- **Avoid unless quoted and explained:** thinks, knows, understands, wants, decides, remembers, re-reads,
  "as the model sees it".
- Distinguish "this app", "the model", and "OpenAI" precisely.
- Use "≈" only for estimates. Give units. Date every price and documented fact.

**Process**
- **Claims register.** Every explanatory claim has an ID in `src/content/claims.ts`, the source of truth.
  Each entry records the claim, where it appears, its sources, and the date it was last checked.
  - `npm run claims` regenerates `content/claims.md`, and a test fails if the two differ.
  - Copy functions name the claims they rest on, and a test checks that each ID exists.
  - A claim cannot ship without a source.
  - There is no external review (personal project), so self-review every change against this section.
- **Content lint.** `src/content/content-lint.test.ts` fails on banned phrasings in any user-facing string
  or JSX text. Its list: the model as a person, "thinking", "re-reads", "probably wrong", "hallucinate".
  Simple captions must avoid "prefill", "decode", "logprob", and "autoregressive".
- **Re-verification.** Whenever the API layer changes, re-verify API and framework facts against official
  docs. Record the URL and date.

## 4. Architecture & technology
Facts were verified on 2026-09-29. Re-verify before relying on details.

| Area | Choice | Status |
|---|---|---|
| Runtime | Node.js 24 LTS (`engines.node: "24.x"`) | Required (the openai SDK v7 and Vitest 5 need ≥22) |
| Framework | Next.js ≥16.3.8, App Router, TypeScript strict, Node runtime (Edge is deprecated); `proxy.ts`, not `middleware.ts` | Decided |
| LLM API | OpenAI Responses API through the official `openai` SDK, behind a server-only adapter | Decided |
| Vercel AI SDK | Not used: logprobs arrive only at finish, and we own the protocol | Decided |
| Model | **`gpt-6-luna` with `reasoning.effort: "none"`**, temperature 1, top_p 1, `top_logprobs: 20`, `store: false`. This is the cheapest candidate, and it passed every automatic check in the 2026-09-30 probe. Fallbacks, in cost order: `gpt-4o-mini`, `gpt-5.4-nano`, `gpt-4.1-mini` (see ADR 0001). | Decided (ADR 0001) |
| Tokenizer | `LocalTokenizer` interface; `gpt-tokenizer` (`o200k_base`), server-side. The probe found every output token of every candidate to be one `o200k_base` token, with input counts within 1 token. | Decided (ADR 0001) |
| Visualization | HTML/CSS and a few hand-computed SVG paths, rendered as pure functions of `(step, progress)` from our own clock; within-step motion only through `--p`. Canvas 2D for the token rain. No d3 or Motion so far. Three.js/R3F post-MVP, lazy-loaded, optional | Decided (ADRs 0004, 0007) |
| UI | Tailwind CSS 4 plus CSS-variable design tokens in `src/app/styles/` (dark default, light theme, contrast-tested); small custom controls (shadcn/ui not used so far) | Decided (ADR 0007) |
| Model output | `react-markdown` + `remark-gfm` + `rehype-sanitize`: no raw HTML, no images, links with `rel="noopener noreferrer nofollow"` | Decided (ADR 0006) |
| State | A Zustand vanilla store for the conversation (`src/generation/conversation-store.ts`), published at most once per animation frame; one for preferences (`src/components/prefs/store.ts`, localStorage). Playback: a pure machine (`src/playback/machine.ts`), a clock, and a controller exposed through `useSyncExternalStore`, notifying React once per step | Decided (ADR 0007) |
| Budget | $20/month: an OpenAI hard cap at the organization level (split into production $17 and development $3 if project caps exist); an app ledger of about $0.55/day; fall back to the sample conversation when it runs out | Decided |
| Limits | Per IP 30/min and 300/day; per tab session 30/day and one stream at a time; $0.55/day global and $0.15/day per IP, reserved worst-case and settled once; Upstash Redis (free tier) through two Lua scripts; BotID Basic on Vercel deployments; Hobby's WAF rule optional | Decided (ADR 0006) |
| History | HMAC-signed replies (`v1.<kid>.<iat>.<mac>`); the previous secret is accepted during a rotation; signatures older than 24 h are dropped from the context | Decided (ADR 0006) |
| Hosting | Vercel Hobby (personal, non-commercial project); a custom domain once purchased | Decided |
| Tests | Vitest 5.0.2 (pinned; typecheck mode is experimental), Testing Library + jsdom, fast-check, wasmoon (runs the production Lua scripts), Playwright (Chromium) + @axe-core/playwright against a mock OpenAI | Decided |

**Data flow. Don't break these boundaries.**

`OpenAI stream → server/openai/adapter → ServerEventV1 (versioned, provider-agnostic) → TraceLog (append-only;
the ONLY persisted artifact) → finalizeTrace (pure) → FinalizedTrace (labeled facts) → compileScript (pure) →
PlaybackScript → PlaybackClock → stage views`

- **Adapter isolation.** Only `src/server/openai/` knows OpenAI request and event shapes.
- **Label minting.**
  - Only `src/trace/` mints Recorded values.
  - Reference values come only from `src/server/config`, each with its source. The server echoes them in
    the `start` event, and `src/trace/` labels them Reference.
  - One exception: the FAQ's documented facts (`src/content/faq-facts.ts`) mint Reference values, each
    with the document it comes from and the date it was checked (ADR 0010). Lint allows no other module.
  - Downstream code can pass a label through or weaken it, never strengthen it.
- **Playback isolation.** Playback never imports generation or server code, never influences generation,
  and never mutates traces.
- **Pre-stream vs. in-band errors.** The client can't send a system prompt, model, or tools. Rejections
  happen before streaming starts (HTTP status). Failures after that are in-band `end{failed}` events.
- **Stateless server.** The client sends bounded, HMAC-signed history each turn. Stopped or interrupted
  replies are unsigned and never re-sent.
- **Supported controls only.** The UI shows only controls the configured model supports, read from the
  capability registry in `src/server/config`.

## 5. Repository layout
**Exists now (Phases 1–2):**
```
src/app/              pages: / (landing), /chat, /sample, /faq, /privacy; api/chat/route.ts (thin);
                      styles/ (tokens, base, components, chat, walkthrough, stages, inspector, pages,
                      landing)
src/instrumentation-client.ts   BotID client init (Vercel deployments only)
src/server/           config.ts · chat/ (handler, http, runtime) · openai/adapter.ts · tokenizer/ ·
                      limits/ (store contract, memory store, Redis Lua scripts) · signing/
src/shared/           protocol/ (v1 schemas, SSE) · provenance/ (types, registry, combine, mint, read,
                      describe) · context-policy/ · sourced-text.ts · format.ts · close-call-rule.ts ·
                      errors.ts · limits.ts · units.ts · utf8.ts · sha256.ts · token-display.ts
src/trace/            log · reducer · finalize · facts · live (the live strip's facts) · align/ ·
                      reconcile · close-calls · provs
src/generation/       client (fetch + SSE + watchdog) · conversation-store · persist (sessionStorage)
src/playback/         machine · clock · controller · types · compile/ (compile, pacing)
src/stages/           contract · common · scenes · lanes · deep-dives · <stage>/{build, View} for probs,
                      context, tokenize, network (+ patterns), sample (+ what-if), loop, followup
src/content/          walkthrough.ts, deep-dives.ts, glossary.ts, and faq.ts (all copy, with claim IDs) ·
                      faq-facts.ts (the FAQ's documented numbers) · claims.ts (the register) ·
                      rain-tokens.json (generated) · content-lint.test.ts
src/components/       provenance/ (Datum, ProvBadge) · chat/ (ChatApp, TurnView, Composer, LiveStrip, Tour,
                      …) · walkthrough/ (Walkthrough, StageView, TokenCard, DeepDive, Exercises, WhereFrom,
                      Lanes, Transcript, OptionBars, …) · glossary/ (Term) · tokens/ (TokenTape) · prefs/
                      (store, keys, hooks, PrefsMenu) · effects/ (TokenRain, DecodeText) · inspector/
                      (TraceInspector) · site/ (SiteHeader, SiteFooter) · ui/ (icons)
src/test/             test harnesses: chat route, probe fixtures, fake Redis + Lua VM, sample fixtures
content/claims.md     claims register, generated from src/content/claims.ts (npm run claims)
scripts/              probe/ (live capability probe) · record-sample.mts · build-claims.mts ·
                      build-rain-tokens.mts · check-client-bundle.mts
fixtures/probe/       sanitized recorded streams per model (written only by the probe)
fixtures/sample/      the recorded sample conversation and wrong-answer case (written only by
                      record-sample.mts)
e2e/                  Playwright tests (chat, walkthrough, pages, smoke) · mock-openai.mts (replays the
                      probe fixtures)
docs/                 PLAN.md · decisions/ (ADRs 0001–0010) · probe/
```
**Planned (later phases; nothing below exists yet):**
```
src/stages/       illustrative/ (seeded generators beyond the current common.ts ones)
content/          glossary
```
Import boundaries are enforced with ESLint `no-restricted-imports` (`eslint.config.mjs`, per
`docs/PLAN.md` §3.3):
- `src/shared` imports nothing from the app.
- `src/server` and `src/trace` import only `src/shared`.
- `src/generation` imports `src/shared` and `src/trace`.
- Client code (`src/components`, `src/app` outside `api/`) never imports `src/server`.
- Only `src/trace` may import `@/shared/provenance/mint`.

Server modules also import `server-only`. `read()` from `@/shared/provenance/read` is for computation and
branching. UI shows values only through `<Datum>`.

## 6. Coding conventions
- **TypeScript:** strict mode. No `any`; use `unknown` and narrow it. Every non-null `!` needs a comment.
- **Validation:** validate every untrusted boundary with zod: request bodies, provider events, storage
  restores, and environment variables.
- **Components:** Server Components by default. Mark only interactive leaves `'use client'`.
- **Pure logic:** keep it in `src/shared`, `src/trace`, and `src/playback/compile`. These modules have no
  React, DOM, `Date.now`, `Math.random`, or `fetch`, and all of it is unit-tested.
- **Exports:** named exports; default exports only where Next.js requires them.
- **Naming:** kebab-case files, PascalCase components, and `useX` hooks.
- **Constants:** limits, budgets, and durations live in config. No magic numbers.
- **Comments:** explain *why*, and keep them sparse.
- **Errors:** use the typed `AppErrorCode`. Never show raw provider text to users.
- **Dependencies:** each new one needs a one-line justification, and significant ones need an ADR. Prefer
  small, maintained packages.

## 7. Stage module contract
Each `src/stages/<stage>/` provides the following (ADR 0007):
- **`build(ctx: BuildContext) → Scene[]`** (`ctx` is `{trace, depth, seed}`)
  - Pure: no `Date`, `Math.random`, DOM, or `fetch`.
  - Every displayable leaf is `Sourced`.
  - Each scene declares its `timing` (`baseMs`, `minMs`, `compressible`), `autoPause`, whether it draws
    `examples`, and its `copy`.
- **`View({scene})`** (and the trace where it needs one)
  - React re-renders only when the step changes.
  - Within-step progress arrives as the CSS variable `--p`, set on the walkthrough panel. `--p` is 1 when
    paused, in step mode, and before playing, so a view's resting state is its complete state.
  - No timers of its own, and no fire-and-forget animations.
- **Text alternative:** `describeScene` (in `src/playback/compile/compile.ts`) turns a scene's copy into
  `SourcedText` for exactly that step. Labels are spelled out in the live region and the Transcript.
- **Copy** lives in `src/content/walkthrough.ts`: functions returning `SceneCopy`, which holds a title, a
  Simple body, and optional Detailed and Technical text, plus claim IDs. It is TypeScript rather than MDX,
  so a bare number in copy is a type error.

Stage IDs:
- `context`
- `tokenize`
- `embed`
- `layers`
- `probs` (also the hook)
- `sample`
- `loop`
- `stop`
- `followup`

Chapters group them (`src/playback/types.ts`):
- hook (probs)
- context
- tokenize
- network (embed + layers)
- options (probs)
- pick (sample)
- loop (layers for the second pass + loop + stop)
- followup (second turn onward)

## 8. Accessibility (target: WCAG 2.2 AA)
- **Keyboard and focus**
  - Everything works from the keyboard. Focus stays visible and is never obscured (sticky bars use
    `scroll-padding`). No keyboard traps.
  - The token card is a docked panel: Esc closes it and focus returns.
  - The token tape is a single tab stop, navigated with arrow keys, Home/End, and Esc.
  - Focusing a token never triggers playback; only activating it does (3.2.1).
- **Shortcuts:** active only while the walkthrough has focus. They can be remapped or turned off (2.1.4),
  and `?` lists them.
- **Pointer input:** the scrubber and sliders have ± buttons, so nothing requires dragging (2.5.7). Targets
  are at least 24×24 px (2.5.8), and at least 44 px on touch.
- **Motion and flashing**
  - Honor `prefers-reduced-motion`, plus an in-app toggle, by switching to step mode. The clock doesn't run,
    and fades last ≤200 ms.
  - Play/pause is the first control (2.2.2). The walkthrough is offered, not autoplayed.
  - Nothing flashes more than 3 times per second, including at 4× speed (2.3.1).
  - **Visual effects** (token rain, glow, scanlines, decode reveals, glitches):
    - Decorative layers are `aria-hidden`.
    - Effects never sit behind body text.
    - Settings' "Visual effects: Off" stops the rain, and Settings is on every page, the landing page
      included (2.2.2). The choice is saved in this browser.
    - Reduced motion, `prefers-contrast: more`, and the in-app Effects toggle each turn all effects off.
    - Decode reveals keep the final text in the DOM from the start.
- **Text alternatives**
  - Every step has `describe()` output.
  - The Transcript view gives the whole walkthrough as headings and tables, including numbers, labels, and
    What-if state (1.1.1, 1.3.1).
  - Charts have data tables.
- **Color and text**
  - Never color alone (1.4.1). Text contrast ≥4.5:1; UI components ≥3:1.
  - Hatching is faint and never sits behind text. The EXAMPLE tag is real text.
  - Captions and labels are HTML, not SVG text, so they reflow at 320 px and support 200% zoom and custom
    text spacing (1.4.10, 1.4.12).
- **Tooltips and popovers** can be dismissed with Esc, stay open while hovered, and never steal focus
  (1.4.13).
- **Token symbols** have spoken names: "space", "newline", "part 1 of 2 of 😀". Use `dir="auto"` and set
  `lang` where known.
- **Streaming**
  - The reply is `aria-busy` while streaming, with one polite announcement on completion (4.1.3). Never
    announce each token.
  - The wait counter uses `role="timer"`.
  - Step descriptions are announced when the step changes, at most once every 2 s.
- **3D (post-MVP)** is optional and never the only path.
- **Verification:** axe runs in CI. Manual NVDA and VoiceOver passes happen before each release.

## 9. Performance
- **Speed targets:** LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, all at the 75th percentile.
  - Measured 2026-09-30 on a throttled phone profile (Pixel 7, 4× CPU slowdown, about 1.6 Mbps and 150 ms
    latency; ADR 0007): LCP about 0.9 s on `/`, `/chat`, and `/sample`; CLS 0. The worst interaction
    measured was 176 ms (opening and playing the walkthrough on `/sample`).
  - Main content must render on the server, not wait for hydration. The sample's store starts hydrated.
    The chat page's notice and empty text are server-rendered and hidden before paint by
    `CHAT_PRELOAD_SCRIPT` when not needed.
  - Zustand's `useStore` reads the store's initial state during server rendering and hydration, so a
    store must be created in the state it should render.
- **Script-size warnings, not gates** (owner, 2026-09-30):
  - About 150 KB gzipped for the landing page, and 250 KB for the chat page before lazily loaded stages.
  - Going over is a prompt to look for cheap savings. It never blocks a feature or a choice that makes the
    product better.
- **Frame rate:** at least 60 fps on a mid-range laptop and 30 fps on a mid-range phone.
- **Rendering**
  - No React commits per frame. Continuous values go through CSS variables and refs.
  - Animate only transform and opacity.
  - Window token strips longer than about 400 tokens. Use Canvas for dense views and a Web Worker for any
    computation over 16 ms.
  - Batch streamed text per animation frame.
  - **Token rain:**
    - Canvas 2D, ≤30 fps.
    - Pauses when offscreen or when the tab is hidden.
    - Off under reduced motion.
    - No WebGL.
- **Heavy assets** (tokenizer ranks at about 1 MB gzipped, and anything 3D) load lazily, on demand.

## 10. API security & data handling
- **API key**
  - `OPENAI_API_KEY` exists only in server environment variables. Never `NEXT_PUBLIC_*`, and never logged.
  - `.env*.local` files are gitignored. `.env.example` lists variable names only.
  - CI checks the build output for key patterns.
- **OpenAI budget:** $20/month in total.
  - Set a $20 hard cap at the organization level.
  - Use separate production and development projects and keys, with caps of $17 and $3 if the dashboard
    supports project caps.
  - The app ledger allows about $0.55/day.
  - When the daily budget runs out, fall back to the sample conversation and show the reset time.
- **Server-side enforcement:**
  - The model, system prompt, and caps are set on the server.
  - Input bounds.
  - Per-session and per-IP rate limits.
  - One active stream per session.
  - The context budget.
  - `max_output_tokens`.
  - A budget ledger that reserves before each call and settles after it. Assume aborted tokens are billed.
    If the ledger store is unreachable, fail closed.
- **Disconnects on Vercel:** every streaming route must be listed in `vercel.json` `functions` with
  `"supportsCancellation": true`.
  - Without it, Vercel never signals a client disconnect, and OpenAI keeps generating (and billing) after a
    Stop. This was measured in Phase 0.
  - With it, Vercel terminates the function on disconnect, so ledger settlement, lock release, and metadata
    logging must run in `after()` from `next/server`.
  - Forward `request.signal` to the SDK's `signal` so the upstream request is aborted.
- **Generation requests**
  - Use `store: false`, `truncation: "disabled"`, and `safety_identifier` set to an HMAC of the anonymous
    session ID (never an IP address or personal data).
  - The SDK retries at most once, and only before any output.
- **Server environment** (`.env.example` lists the names):
  - `OPENAI_API_KEY`.
  - `HISTORY_SIGNING_SECRET`, plus `_PREVIOUS` during a rotation. Required on Vercel; locally a fixed
    development secret is used.
  - Upstash (`KV_REST_API_URL`/`KV_REST_API_TOKEN` from the Vercel Marketplace, or the `UPSTASH_REDIS_REST_*`
    names). Required on Vercel.
  - When any of these is missing or invalid, `/api/chat` fails closed with `service_unavailable`. The log
    names the variable and the rule it broke, never its value. The in-memory limits store is for local runs
    only and is refused on Vercel deployments.
  - Redis keys are prefixed with `VERCEL_ENV`, because Preview and Production share Upstash's single free
    database.
- **Moderation:** every new user message, and any earlier one not followed by a signed reply, goes to
  `omni-moderation-latest` before generation. If the check fails, the request fails closed.
- **BotID** runs only on Vercel preview and production deployments (`checkBotId()` can't verify anywhere
  else).
- **No content on the server:** never log or persist prompts or responses there. Logs contain only IDs,
  sizes, token counts, timings, status, and error codes.
- **Client storage:** conversations live in client memory and in `sessionStorage` (raw logs, LRU-capped).
  "Clear conversation" wipes everything.
- **Rendering model output:** sanitized Markdown, with no raw HTML, no images, and links marked
  `rel="noopener noreferrer nofollow"`.
- **The system prompt is public** (shown in the UI). Never put secrets in it.
- **Privacy notice:** show it before the first message. Keep `/privacy` in line with OpenAI's current
  data-controls docs, cited and dated.
- **Headers:** a static CSP and security headers via `next.config`. The exact policy is PROVISIONAL.

## 11. Testing & validation
- **Types:** `vitest --typecheck` with `@ts-expect-error`. These tests prove that:
  - a raw `Sourced` value can't render in JSX;
  - `derive` over an Example produces an Example;
  - `ServerMs` can't be used where `PlaybackMs` is expected.
- **Property tests (fast-check)**
  - Token/text alignment: random Unicode, cuts in the middle of a code point, lossy tokens.
  - Reducer: any truncation finalizes as `interrupted`.
  - Context policy: the system prompt and newest message are never dropped, and kept history is a contiguous
    suffix.
  - Ledger: concurrent reservations never exceed the cap, and settling is idempotent.
  - Pacing: total duration ≤ cap, montage ≤ 8 s.
- **Fixtures:** three layers, each tested against its consumer:
  - raw SDK events → the adapter;
  - wire SSE → the parser;
  - TraceLogs → `finalize` and `compile`.

  Only `scripts/` may change fixtures.
- **Golden vectors:** tokenizer output matches Python `tiktoken`.
- **Determinism:** the compiler runs with `Math.random`, `Date.now`, and `fetch` rigged to throw. Snapshots
  cover scenes and steps.
- **Components**
  - Each stage view renders at every step for each fixture.
  - A DOM test fails if digits appear in the walkthrough outside a labeled element (`[data-kind]`), a
    method description (`[data-method]`), or UI chrome (the player, the offer, the live region).
    It is `e2e/walkthrough.spec.ts`, stepping through every step at Detailed depth.
  - A render-count test (the controller notifies React once per step, never per frame).
  - axe, on the chat, the walkthrough (offer, a step, the Transcript), the landing page, and `/sample`.
- **Content:** the content lint and the claims-register sync test (`src/content/content-lint.test.ts`).
  The recorded sample fixtures are checked for validity, completeness, and removed signatures
  (`src/test/sample-fixture.test.ts`).
- **Limits store contract:** one suite runs against the in-memory store and against the production Lua
  scripts, executed by a real Lua VM (wasmoon) over a fake Redis (`src/test/fake-redis.ts`).
- **Client bundle:** `npm run check:bundle` fails if the browser build contains a key pattern, a server
  secret's name, the actual `OPENAI_API_KEY` from `.env.local`, or a chunk large enough to be server-only
  code.
- **E2E (Playwright, mocked upstream)**
  - OpenAI is replaced by `e2e/mock-openai.mts`, reached through `OPENAI_BASE_URL`, so the real adapter
    parses real-shaped streams. Keywords in the message pick scenarios (`SLOW`, `CUTOFF`, `UNICODE`,
    `FAIL_429`, `QUOTA`, `FLAG_ME`).
  - Send → stream → replay → follow-up (the walkthrough is skipped first: sending is locked until then).
  - Stop.
  - Every error code.
  - Interrupted streams.
  - Reduced motion (`emulateMedia`): step mode, and the token rain holds still.
  - Keyboard only: play, pause, steps, chapters, the shortcut list, and the token card's focus return.
  - Mobile viewport (one pane at a time).
  - Replay while offline, and the sample conversation, both proving no API calls.
  - The live strip, the deep dives (the temperature What-if and the recorded wrong answer), and the
    landing page.
  - Scope reply-text lookups to the chat pane (`#main`): the walkthrough quotes the reply too.
  - Visual checks with the dev server use the mock too. Run it with the "dev-mock" launch configuration,
    which sets `OPENAI_BASE_URL` and a fake key; the mock always replies with the same fixture.
- **Live capability probe:** run before releases to catch model or endpoint drift. Never in PR CI.
- **Accuracy:** every claim cites a source; the content lint passes; self-review against §3.
- **Learning (informal):** a few people try it and answer probe questions from `docs/PLAN.md` §2, plus the
  in-app "real or example?" check. No formal studies.
- **Definition of done:**
  - Typecheck, lint, tests, and accessibility checks pass.
  - Every new visual has labels and a text alternative.
  - The claims register and docs are updated.
  - No rule in §3 is violated.

## 12. MVP boundaries
**In:**
- Landing page.
- Real streaming chat with stop, retry, and error handling.
- The live strip, plus the Hook and seven chapters at Simple and Detailed depth.
- The label system.
- The sample-conversation fallback.
- Deep dives:
  - why fluent answers can be wrong;
  - temperature what-if;
  - context limits;
  - does it learn from me;
  - timing card;
  - a one-line "no tools used" note.
- Player controls and the Transcript view.
- Reduced motion, keyboard support, and mobile.
- Rate limits and the budget ledger.
- Privacy page.

**Out** (don't build without a plan update):
- Accounts.
- Server-side storage or sharing.
- Technical depth everywhere.
- The saved-work (KV cache) deep dive.
- Stepping through layers, or a head-type switcher.
- The meaning map.
- Regenerate and compare.
- User-set generation settings.
- A tokenizer playground.
- 3D.
- Real tools or search.
- The small open-model lab.
- The reasoning-model module.
- Presenter mode.
- Localization.
- Other providers.

## 13. Workflow for implementation tasks
1. Read this file and the relevant parts of `docs/PLAN.md` and `docs/decisions/`.
2. If the task touches the OpenAI API, Next.js, or a library's behavior, check the current official docs
   first. Don't rely on memory for parameters, event names, capabilities, limits, or prices. Record the URLs
   and the date.
3. For non-trivial work, write a short plan first: files, tests, accuracy risks, and the label of every new
   value.
4. Write tests first for pure logic. Build UI against recorded fixtures before calling the live API.
5. Keep changes small. Keep provider-specific code inside the adapter.
6. Run typecheck, lint, unit tests, and E2E tests (once those commands exist).
7. Self-review against §3 (accuracy) and §8 (accessibility).
8. Update `content/` claims, `docs/`, and this file when decisions change. Record significant decisions as
   ADRs (`docs/decisions/NNNN-title.md`).
9. Never commit secrets. Never deploy or publish without the owner's explicit approval.

## 14. Commands
Node.js 24 is required. If you use nvm-windows: `nvm use 24.19.0`. Copy `.env.example` to `.env.local` and
fill in the values.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint flat config (`next lint` was removed in Next.js 16) |
| `npm run typecheck` | `next typegen` (route types), then `tsc --noEmit` |
| `npm test` | Vitest: unit, property, and component tests (`src/**/*.test.ts(x)`, `scripts/**/*.test.mts`) plus type tests (`src/**/*.test-d.ts(x)`) |
| `npm run test:e2e` | Playwright against a production build on port 3200, with the mock OpenAI on port 3299. It never calls the real API. First run: `npx playwright install chromium` |
| `npm run check:bundle` | After a build: scan the browser bundle for secrets and server-only code, and report its size |
| `npm run check` | Typecheck, lint, unit tests, build, and the bundle check, in order |
| `npm run mock:openai` | Start the mock OpenAI on port 3299 (see "Local chat without spending" below) |
| `npm run claims` | Regenerate `content/claims.md` from `src/content/claims.ts` (a test fails if they differ) |
| `npm run rain` | Regenerate the token rain's pool (`src/content/rain-tokens.json`) from this project's writing, plus the numbers 0 to 999 (a test checks each is one real token) |
| `npm run record:sample` | Re-record `fixtures/sample/` through a local production build with the real key (run `npm run build` first; OPENAI_BASE_URL must be unset). At most 10 short turns, well under a cent. Never in CI. |
| `npm run probe` | Live capability probe. Needs `OPENAI_API_KEY` in `.env.local` and costs about 1–2¢. Never run it in CI. |

`probe` options:
- `--models=a,b` runs a subset.
- `--skip-quality` skips the reply-quality prompts.
- `--max-usd=0.10` sets the budget guard.
- `--stop-at-first-pass` stops at the first passing model.

**Local chat:** `npm run dev`, then open `/chat`. With `OPENAI_API_KEY` in `.env.local` it calls the real
API (a typical turn costs about $0.00003), with the in-memory limits store and a development signing secret.
Each request logs one `{"evt":"chat",…}` line of metadata.

**Local chat without spending:** run `npm run mock:openai` in one terminal. In another, run
`OPENAI_BASE_URL=http://127.0.0.1:3299/v1 npm run dev` (PowerShell: `$env:OPENAI_BASE_URL='http://127.0.0.1:3299/v1'; npm run dev`).

Scripts in `scripts/` are `.mts` files that Node 24 runs directly, with no build step. Use `import type` for
type-only imports, and include the `.mts` extension on relative imports.

## 15. Decisions and open items (keep in sync with `docs/PLAN.md` §6)
**Decided (2026-09-30):**
- A personal, non-commercial project; public with no sign-in; owner-funded.
- A budget of $20/month.
- Vercel Hobby hosting.
- Nothing stored on the server.
- An audience of adults and older teens, not directed at children.
- The model rule: the cheapest model that passes every visualization check.
- No external review and no formal user studies.
- Identity: the name "Token by Token"; a Matrix-inspired "digital-rain terminal" style; a dark theme (default)
  plus a light theme; an English interface; provider-neutral copy.

**Phase 0 results (2026-09-30):** ADRs 0001–0005 and `docs/probe/2026-09-30-capability-report.md`.
- The model is `gpt-6-luna` (the owner approved its reply quality).
- Reported logprobs are raw scores, independent of temperature.
- OpenAI streams one token per delta event.
- Some emoji come back without logprobs.
- Output usage includes hidden tokens (4 per reply for gpt-6-luna).
- On Vercel, streaming is progressive (verified in Chrome).
- A Stop aborts the OpenAI request within about 10 ms, but only for routes with `supportsCancellation`
  (ADR 0002).

**Phase 1 results (2026-09-30):** ADR 0006, plus updates to ADRs 0002 and 0003.
- `/api/chat` runs the full guard pipeline and streams protocol v1.
- The trace aligns tokens by bytes, labels emoji gaps, reconciles counts, and finds close calls.
- The chat UI has Stop, retry, every error state, and the Trace Inspector.
- Tested with 149 unit, property, component, and type tests, 15 end-to-end tests including axe, and a live
  local run against OpenAI (about $0.0001).
- Moderation adds about 0.9–1.5 s before the first token. The owner chose to keep it before generation,
  so flagged text never reaches the model.
- The chat page loads about 320 KB of gzipped JavaScript.
- Verified on a Vercel Preview: Upstash, BotID under the CSP, signed follow-ups, and Stop (ADR 0006).

**Phase 2 results (2026-09-30):** ADR 0007.
- The walkthrough runs beside the chat:
  - the Hook and chapters 1–7 at Simple and Detailed depth;
  - the player, chapter bar, step mode, and focus-scoped shortcuts;
  - the token card, five deep dives, and the Transcript view.
- The live strip, the recorded sample conversation (`/sample`), and the landing page with its token rain.
- Walkthroughs are paced by reading time: about 2.5 min at 1× for a first reply and about 3 min with the
  follow-up chapter. The plan's ~90 s left too little time to read.
- The default playback speed is 0.5× (owner, 2026-09-30: 1× felt too fast), so a walkthrough takes about
  5–6 min unless the viewer speeds it up. The offer shows the time at the current speed. Preferences store
  only settings a viewer chose, so a changed default reaches everyone who never picked one.
- Tested by 29 end-to-end tests (axe included) and the unit suite. The speed targets are met on a
  throttled phone profile.
- The sample recording cost about $0.00011. Early visual checks accidentally reached the real API, about
  $0.0006 in all; the launch configuration now forces the mock.

**Phase 2 extras (2026-09-30):** ADR 0008.
- Built everything ADR 0007 deferred:
  - remappable shortcuts, glossary popovers, and "Is this real?" / "How do we know this?";
  - the three lanes, the Detailed network sub-scenes, and more example attention patterns;
  - simulated picks, the two exercises, the formatted / as-written toggle, and the real-speed replay;
  - the first-visit tour.
- The token rain is now the landing page's background: thousands of real tokens, picked at random.
- The walkthrough is memoized and its announcements isolated, which brought the slowest measured
  interaction to 160 ms.
- Tested by 41 end-to-end tests and 208 unit tests.

**Open (proceeding on defaults):**
- **Plan items still open** (ADR 0008): linked highlighting of a token across the chat and the walkthrough,
  the Hook's "pick another close call", and an "Instant" playback speed.
- A manual NVDA and VoiceOver pass (owner, before release).
- **Production launch checklist** (owner approval required). Next.js is pinned to the 16.3.8 security
  release (exact, with `eslint-config-next` 16.3.8; 2026-09-30), so what remains is:
  1. Set Production variables: `OPENAI_API_KEY` (the production project's key), a `HISTORY_SIGNING_SECRET`
     different from Preview's, and the Upstash connection for Production (the same database is fine).
  2. Deploy, then repeat the Preview checks: a question, a follow-up, and a Stop.
- Script size is over its warnings: 371 KB gzipped across all routes (2026-09-30), while the speed targets
  are met. Take cheap savings, such as `zod/mini` in the browser, when convenient. Size is never a blocker.
- Optional: check streaming in Safari and iOS Safari. Padding is already in place.
- The label vocabulary (default: four labels plus What-if).
- The palette and fonts are set (`src/app/styles/tokens.css`, IBM Plex Sans and Mono, contrast-tested) but
  still open to the owner's review of the look.
- How deep the formulas go (default: at Technical depth, collapsed).
- Whether real generation controls ship in MVP (default: no).
- The domain (not yet bought).

## 16. Framework agent docs
`create-next-app` and `next dev` (16.3+) generate a version-matched `AGENTS.md`, which is imported at the top of
this file.
- Its instruction to read `node_modules/next/dist/docs/` before writing Next.js code is part of this project's
  workflow (§13, step 2).
- This `CLAUDE.md` remains the source of truth for the project.
- Never let a generated `CLAUDE.md` overwrite this file.
