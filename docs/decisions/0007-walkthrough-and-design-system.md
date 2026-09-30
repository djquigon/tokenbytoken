# ADR 0007: The walkthrough, its content, and the design system (Phase 2)

- **Status:** Accepted, 2026-09-30
- **Deciders:** Claude, per the approved plan (docs/PLAN.md §2, §3.5, Phase 2); pacing and speed-target
  changes follow the owner's direction on script size (ADR 0006)

## Context
Phase 2 builds the walkthrough from the plan: the playback engine, the Hook and chapters 1–7, the player,
the token card, the Transcript, deep dives, the live strip, the sample conversation, the landing page, and
the Matrix-inspired design system. Building it forced several decisions the plan left open or got wrong.

## Decisions

### Content
- **Copy is a TypeScript module, not MDX.** Walkthrough copy lives in `src/content/walkthrough.ts`, and the
  deep dives' copy in `src/content/deep-dives.ts`. Each is a function returning `SourcedText`. The `st`
  template accepts only strings and labeled slots, so a raw number in copy is a type error, which MDX can't
  enforce.
- **Claims register in TypeScript.** `src/content/claims.ts` (C001–C051) is the source of truth.
  `npm run claims` generates `content/claims.md`, and a test fails if the two differ. Every scene's copy
  names its claims, and a test checks that each one exists.
- **Content lint.** `src/content/content-lint.test.ts` reads every string and JSX text in the copy and UI
  source (using the TypeScript compiler, so comments don't count). It fails on the banned phrasings from
  CLAUDE.md §3: the model as a person, "thinking", "re-reads", "probably wrong", "hallucinate". The playback
  tests also keep Simple captions to 48 words or fewer, free of "prefill", "decode", "logprob", and
  "autoregressive".
- **Words match the numbers.** A close call is described by how the pick compared with the other options
  (`comparePick`):
  - "the pick wasn't the top option";
  - "two options were close";
  - "no option had a majority".

  The token-count caption no longer claims that OpenAI always counts more.
- **Chances are never shown as 0% or 100%.** Softmax gives every token some chance, but OpenAI's rounded
  logprobs can compute to either extreme. The formatter shows "<0.01%" and ">99.99%" instead.

### Pacing and playback
- **Reading-time pacing replaces the plan's ~90 s target.** Each step lasts at least its reading time
  (230 wpm plus 1.5 s). The target is 150 s, with a hard cap of 240 s. The plan's 90 s left about 3.5 s
  per step, less than it takes to read the captions. Walkthroughs run about 2.5 min for a first reply and
  about 3 min with the follow-up chapter. The montage stays capped at 8 s.
- **Moving while stopped shows a step complete.** Moving there while playing plays it from its start, and
  Play replays a completed step. The offer shows the Hook complete, as a static card.
- **Progress (`--p`) is written to the panel element, not the per-step stage.** A step change made while
  paused would otherwise write to the old stage.

### Interface
- **Layout.**
  - At 60rem and wider: chat about 38%, walkthrough about 62%, each pane scrolling on its own.
  - Narrower (including 200% zoom): one pane at a time, switched by "Chat | How it works" toggle buttons.
    These aren't ARIA tabs, because on wide screens both panes are visible landmarks.
  - On narrow screens only the player's main row (play, step, step count) is pinned to the bottom. The
    header scrolls away.
- **Composer lock.** After a reply finishes in this page view, sending is locked until its walkthrough ends
  or is skipped. Typing still works, the draft is kept, and Skip is one click in the composer.
- **The token card is a static docked panel**, showing the real options for the chosen token. The plan's
  "activating a token re-runs chapters 4–5 for it" is deferred: the card shows the same data at once,
  without a second timeline.
- **Deep dives are docked panels**, offered beside the chapters they extend ("Go deeper"), and all together
  on the last step. They are also written out in the Transcript. The five MVP dives:
  - "Why fluent answers can be wrong";
  - the temperature What-if;
  - "Context limits and history";
  - "Does it learn from me?";
  - "How long did it take?".
- **The temperature What-if** computes chances among the listed options only, for temperatures from 0 to
  1.2. This is valid because this model's logprobs are raw scores (ADR 0001). How unlisted tokens would
  share out at another temperature isn't known, and the copy says so.
- **The live strip** sits under the streaming reply in the chat pane, so it works on narrow screens too. It
  shows only recorded events, in order: the request sent, the wait (with the unexplained-wait caption),
  first text, and the newest tokens. It isn't a live region, and it can be hidden.
- **No options, no numbers.** If OpenAI returned no alternatives for a whole reply, the options chapter
  becomes one "not available" step pointing to the sample conversation (CLAUDE.md A2).

### The sample conversation
- **Recording.** `scripts/record-sample.mts` records through the app itself, driving a local production
  build with the real key, and saves exactly the TraceLogs the browser kept. Its only edit is removing
  reply signatures, which are valid for one session.
  - `fixtures/sample/conversation.json`: two turns, recorded 2026-09-30 with `gpt-6-luna`.
  - `fixtures/sample/fluent-case.json`: the first of the tried letter-counting prompts where the model's
    top option was a wrong count. Asked how many times "e" appears in "bookkeeper", the model gave "2" at
    90.9%; the right answer, 3, is Calculated from the question. The file lists which prompts were tried.
  - The recording cost 4 turns, about $0.00011.
- **Uses.**
  - `/sample` replays the conversation read-only and never calls the API.
  - The error notices for a spent budget, the spending cap, and an unavailable service link to it.
  - The landing page's token rain is made of its tokens.

### Design system
- **Tokens.** Colors are defined in `src/app/styles/tokens.css`, dark by default with a light theme, and a
  test checks WCAG contrast. Styles are split by area: `base`, `components`, `chat`, `walkthrough`,
  `stages`, `inspector`, `landing`.
- **Token rain.**
  - Canvas 2D at 30 fps at most, drawing real tokens that read downward in the reply's order.
  - It has its own pause control, stops when offscreen or the tab is hidden, and shows one still frame
    under reduced motion, more contrast, or Effects off.
  - It is `aria-hidden`, with a caption that labels its source.
- **Decode reveals.** Headings resolve once, in at most 300 ms: the landing title and each chapter's title.
  The real text is in the DOM from the start, and the scramble is an `aria-hidden` overlay made of the
  heading's own letters.
- **No new libraries.** d3 and Motion (ADR 0004) weren't needed: the views are HTML and CSS, plus a few
  hand-computed SVG paths. shadcn/ui isn't used yet; the few controls needed are small and custom.

### Speed
Pages render their main content on the server, so LCP doesn't wait for hydration:
- The sample's store starts hydrated.
- The chat page's privacy notice and empty-chat text are server-rendered. An inline script hides them
  before first paint for visitors who don't need them.

Markdown replies and turns are memoized, so streaming and pane switches don't re-parse every reply.

Measured on a throttled phone profile (Pixel 7, 4× CPU slowdown, about 1.6 Mbps and 150 ms latency):

| Page | LCP | CLS | Worst interaction |
|---|---|---|---|
| `/` | 0.96 s | 0 | — |
| `/chat` | 0.87 s | 0 | — |
| `/sample` | 0.90 s | 0 | 176 ms (opening and playing the walkthrough) |

The browser build is 362 KB gzipped in total across all routes. That is a warning, not a gate.

## Consequences
- **Tests.** 29 end-to-end tests (Playwright with axe) cover:
  - the walkthrough, the keyboard, and reduced motion;
  - offline replay and narrow screens;
  - labeled numbers only;
  - the token card, deep dives, the live strip, the landing page, and the sample.

  The unit tests cover the engine, the What-if math, the sample fixtures, the claims register, and the lint.
- **Re-recording.** Re-recording the sample means running `npm run record:sample` (real API, well under a
  cent) and reviewing the new files.
- **Deferred from the plan's Phase 2 list** (all built since; see ADR 0008):
  - glossary popovers, and the "Is this real?" button on each panel;
  - the first-visit orientation, and the "real or example?" wrap-up check;
  - "guess which is likely", "simulate 20 picks", and "show another example pattern";
  - the Detailed sub-scenes (position, duplicate-token, and induction patterns), and the three lanes at
    Detailed depth;
  - the raw/rendered Markdown toggle, and the real-speed text replay;
  - remappable shortcuts (they can be turned off, which meets WCAG 2.1.4);
  - the manual NVDA and VoiceOver pass.

## Sources (checked 2026-09-30)
- Zustand reads a store's initial state for the server snapshot (`useStore` → `useSyncExternalStore` with
  `getInitialState`): `node_modules/zustand/esm/react.mjs`.
- WCAG 2.2: 2.1.4 Character Key Shortcuts, 2.2.2 Pause, Stop, Hide, 2.5.7 Dragging Movements, 2.5.8 Target
  Size (Minimum): https://www.w3.org/TR/WCAG22/
- Liu et al. (2023), "Lost in the Middle": https://arxiv.org/abs/2307.03172 (claim C049).
