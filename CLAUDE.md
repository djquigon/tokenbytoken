# CLAUDE.md

> **Project status: pre-implementation.** This repository contains planning documents only. There is no
> application code, `package.json`, dependency, or script yet. Items marked **PROVISIONAL** are proposals,
> not decisions. When one is decided, record an ADR in `docs/decisions/` and update this file. Never
> describe planned files or commands as if they already exist.

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
    - The token rain is made of real tokens and is captioned as such.
    - Real data glows; examples are wireframes.
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
  - Examples come only from seeded, documented generators in `src/stages/illustrative/` (planned), based on
    published general phenomena (previous-token, duplicate-token, induction patterns).
  - Arcs have a fixed weight, and no numbers ever appear on arcs or vectors.
  - Introduce each pattern on a neutral sample before showing it on the user's tokens.
- **A11. Correct attention wording.** "Each position can draw on itself and earlier positions, never later
  ones." Decoding computes only the new position and reuses saved work (the KV cache). Never say "re-reads
  everything".
- **A12. Probability is not truth.** "Close calls" describe wording, not errors. Never link low probability
  to "probably wrong".
- **A13. Token IDs are always Calculated.** The API returns strings and bytes, not IDs. Name the tokenizer as
  "assumed". Show reconciliation with the counts OpenAI reports; never silently correct them.
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
- **Claims register.** Every explanatory claim lives in `content/` (planned) with an ID in the claims register
  (`content/claims.md`, format PROVISIONAL). Each entry records the claim, its depth, its sources, and the date
  it was last checked. A claim cannot ship without a source. There is no external review (personal project),
  so self-review every change against this section.
- **Content lint (planned).** It fails on banned phrasings.
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
| Model | **Rule: the cheapest model that passes every visualization check.** Checks: streamed top-20 logprobs; `reasoning_tokens == 0`; temperature and top_p accepted; tokenizer round-trip ≥99%; no retirement within ~6 months; acceptable replies. Candidates, in cost order: `gpt-6-luna` (effort `none`), `gpt-4o-mini`, `gpt-5.4-nano` (effort `none`), `gpt-4.1-mini`. Settings: temperature 1, top_p 1, `top_logprobs: 20`, `store: false` | Rule decided; model PROVISIONAL until the Phase 0 probe |
| Tokenizer | `LocalTokenizer` interface; `gpt-tokenizer` (`o200k_base`), server-side | PROVISIONAL |
| Visualization | SVG/HTML rendered as pure functions of `(step, progress)` from our own clock; d3-scale/shape/interpolate; Canvas 2D for dense views; Three.js/R3F post-MVP, lazy-loaded, optional | PROVISIONAL |
| UI | Tailwind CSS 4 with CSS-variable tokens; shadcn/ui on Base UI; Motion only for UI chrome outside the timeline | PROVISIONAL |
| State | Zustand vanilla stores (conversation, preferences); a pure playback machine and clock exposed through `useSyncExternalStore` | PROVISIONAL |
| Budget | $20/month: an OpenAI hard cap at the organization level (split into production $17 and development $3 if project caps exist); an app ledger of about $0.55/day; fall back to the sample conversation when it runs out | Decided |
| Limits | Hobby's single WAF rule; in-handler per-session and per-IP quotas and a one-stream lock; an Upstash Redis (free tier) micro-dollar ledger; BotID Basic | PROVISIONAL |
| Hosting | Vercel Hobby (personal, non-commercial project); a custom domain once purchased | Decided |
| Tests | Vitest 5, Testing Library, fast-check, Playwright, @axe-core/playwright | PROVISIONAL |

**Data flow. Don't break these boundaries.**

`OpenAI stream → server/openai/adapter → ServerEventV1 (versioned, provider-agnostic) → TraceLog (append-only;
the ONLY persisted artifact) → finalizeTrace (pure) → FinalizedTrace (labeled facts) → compileScript (pure) →
PlaybackScript → PlaybackClock → stage views`

- **Adapter isolation.** Only `src/server/openai/` knows OpenAI request and event shapes.
- **Label minting.**
  - Only `src/trace/` mints Recorded values.
  - Reference values come only from `src/server/config`, each with its source. The server echoes them in
    the `start` event, and `src/trace/` labels them Reference.
  - Downstream code can pass a label through or weaken it, never strengthen it.
- **Playback isolation.** Playback never imports generation or server code, never influences generation,
  and never mutates traces.
- **Pre-stream vs. in-band errors.** The client can't send a system prompt, model, or tools. Rejections
  happen before streaming starts (HTTP status). Failures after that are in-band `end{failed}` events.
- **Stateless server.** The client sends bounded, HMAC-signed history each turn. Stopped or interrupted
  replies are unsigned and never re-sent.
- **Supported controls only.** The UI shows only controls the configured model supports, read from the
  capability registry in `src/server/config`.

## 5. Planned repository layout (nothing below exists yet)
```
src/app/          pages; api/chat/route.ts (thin)
src/server/       chat/ · openai/adapter.ts · tokenizer/ · budget/ · limits/ · signing/ · config.ts
src/shared/       protocol/ · provenance/ · context-policy/ · errors.ts · units.ts
src/trace/        log · reducer · finalize · align/ · reconcile · persist/
src/generation/   client · conversation store
src/playback/     machine · clock · controller · compile/
src/stages/       contract · registry · <stage-id>/{build,View,describe} · illustrative/
src/components/   provenance/ · chat/ · viz/
content/          stages/*.mdx (Simple/Detailed/Technical) · glossary · claims.md
fixtures/         sanitized recorded streams and TraceLogs (written only by scripts/)
scripts/          probe-capabilities.ts · record-fixture.ts
e2e/  docs/ (PLAN.md · decisions/)
```
Import boundaries are enforced with ESLint `no-restricted-imports` (see `docs/PLAN.md` §3.3). Client code
never imports `src/server/**`, which is enforced by `server-only`.

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
Each `src/stages/<stage-id>/` provides the following:
- **`build({trace, slot, seed}) → SceneSpec[]`**
  - Pure: no `Date`, `Math.random`, DOM, or `fetch`.
  - Every displayable leaf is `Sourced`.
  - Steps declare `baseMs`/`minMs`/`compressible`/`autoPause`.
- **`View({model, step, motion})`**
  - React re-renders only when the step changes.
  - Within-step progress arrives as the CSS variable `--p` (or through `useFrame`).
  - No timers of its own, and no fire-and-forget animations.
- **`describe(model, step) → SourcedText`**
  - Text alternative for exactly this step, including label words.
- **Copy** lives in `content/stages/<stage-id>.mdx`, with Simple, Detailed, and Technical sections plus
  claim IDs.

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

Simple-depth chapters group them:
1. context
2. tokenize
3. embed + layers
4. probs
5. sample
6. loop + stop
7. followup

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
    - The rain has its own pause control (2.2.2).
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
- **Budgets (PROVISIONAL):**
  - Landing page JS ≤150 KB gzipped.
  - Chat route ≤250 KB gzipped, before lazily loaded stages.
  - LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, all at the 75th percentile.
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
- **Generation requests**
  - Use `store: false`, `truncation: "disabled"`, and `safety_identifier` set to an HMAC of the anonymous
    session ID (never an IP address or personal data).
  - The SDK retries at most once, and only before any output.
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
  - A DOM test fails if digits or model text appear outside a labeled element or UI chrome.
  - A render-count test.
  - axe.
- **E2E (Playwright, mocked upstream)**
  - Send → stream → replay → follow-up.
  - Stop.
  - Every error code.
  - Interrupted streams.
  - Reduced motion (`emulateMedia`).
  - Keyboard only.
  - Mobile viewport.
  - Replay while offline, proving no API calls.
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
None exist yet. Phase 0 creates `package.json` and defines at least:
- `dev`
- `build`
- `start`
- `lint`
- `typecheck`
- `test`
- `test:e2e`
- `probe` (requires `OPENAI_API_KEY`; never run in CI on PRs)

Document the exact commands here once they work. Note that `next lint` was removed in Next.js 16, so lint
with ESLint directly.

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

**Open (proceeding on defaults):**
- The final model (the Phase 0 probe decides).
- The label vocabulary (default: four labels plus What-if).
- Exact palette values and fonts (Phase 2 design tokens, checked for contrast).
- How deep the formulas go (default: at Technical depth, collapsed).
- Whether real generation controls ship in MVP (default: no).
- The domain (not yet bought).

## 16. Framework agent docs
`create-next-app` and `next dev` (16.3+) generate a version-matched `AGENTS.md`.
- This `CLAUDE.md` remains the source of truth for the project.
- Treat `AGENTS.md` as the framework reference, and import it with `@AGENTS.md` if useful.
- Never let a generated `CLAUDE.md` overwrite this file.
