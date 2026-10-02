# ADR 0012: Renamed "How does an AI work?", after the domain

- **Status:** Accepted, 2026-10-01
- **Deciders:** the owner, who set up the domain howdoesanai.work and chose this name from the options, and
  Claude for the options and the change

## Context
The site went live at howdoesanai.work. The address reads as a question, "How does an AI work?", which is
what a newcomer would type into a search box. The old name, "Token by Token", leaned on a word newcomers
don't know yet.

## Decision
- **The name is the question its address spells out:** "How does an AI work?" Its answer, "Token by token",
  is the tagline.
- **Where it shows:**
  - **The landing page:** the question is the title, with "Token by token." under it as the answer. The
    lede now says it's a chatbot, since "an AI" is broader than what the walkthrough shows. The FAQ covers
    the broader questions.
  - **The header bars:** the address is the wordmark (`howdoesanai.work`, in the mono face, with ".work" in
    the accent). Screen readers hear "How does an AI work?" instead of a run-together address.
  - **Elsewhere:** browser-tab titles ("Chat · How does an AI work?"), the footer, the privacy page, and the
    model's instructions ("You are the assistant on howdoesanai.work, …").
- **One source:** `src/shared/site.ts` holds the name, the answer, and the address.
- **The mark: the next-token fork** (the owner's choice from six sketches). A token on the left, three
  branches to its options for the next token (a thicker branch is a likelier option), and the one picked,
  lit. It echoes the landing page's figure of options, and it is the site's main idea in one picture.
  - The token and its options are squares, the site's shape for tokens. A dot would look like the
    Recorded label's dot.
  - It is inline SVG in `src/components/site/Brand.tsx`, colored by the theme's accent and strong-border
    tokens, so it switches with the theme. High-contrast themes draw it in one system color. It replaces
    the CSS-drawn chip with a lit cursor.
  - The site had no tab icon. `src/app/icon.svg` is now the same fork on a dark tile, with heavier
    strokes for 16 px.
  - Considered: a prompt (`>_`), an attention arc, an artificial neuron, and a layered network (busy at
    header size). Avoided: the sparkle (it suggests magic, and the site exists to show it isn't), a brain
    (the FAQ explains that neural networks aren't much like brains), and a robot or a face (they suggest a
    mind).
- **Options considered:**
  - The statement form, "How an AI works": calmer, but less catchy, and it no longer matches the address.
  - "Watch an AI at work": generic as a name, and it sounds like AI in the workplace.
  - Other answers: "One token at a time", and "Piece by piece" (plainest, but it drops the word the site
    teaches).
- **Names avoided:**
  - "Show your work" suggests the model's reasoning is visible (CLAUDE.md A3).
  - "Inner workings" suggests a view of the real model's internals (A9).
  - "Word by word" is wrong: tokens aren't words.

## Consequences
- **The recorded sample keeps the old name.** Its instructions were recorded on 2026-09-30 and are shown
  word for word, so the sample, and the landing card built from it, still say "You are the assistant on
  Token by Token". Re-recording it would take one real request and the owner's go-ahead.
- **The domain needs no configuration.** The chat accepts requests from the site it's served on
  (`originAllowed` in `src/server/chat/http.ts`).
- **Unchanged:** the repository and package name (`tokenbytoken`), and the walkthrough step titled "Token by
  token, to the end".
