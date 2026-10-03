# ADR 0015: Five chronological chapters for one reply

- **Status:** Accepted, 2026-10-03
- **Decider:** the owner, approving the five conversational chapter titles

## Decision

Every eligible request and response uses this sequence:

1. **What goes into the model** — instructions, the message, included history, role markers, and request settings.
2. **What happens to your message** — tokenization and the illustrated input-processing pass.
3. **How the model builds its reply** — next-token scores, selection, the next model pass using saved work, and the remaining generation loop.
4. **How the reply ends** — the recorded stop reason and complete reply.
5. **A closer look at your reply** — recorded token choices, after the relevant concepts have been explained.

The original opening example moves to the last chapter. Additional close calls move there too; a token is not featured twice. If no alternatives were returned, the review explicitly says they are unavailable. No values are fabricated. A separate follow-up chapter is no longer compiled, even for a selected reply whose request included earlier messages; those messages remain part of the actual input context.

Stage keys remain stable so depth changes preserve the current scene. The text view uses the same chapter grouping. Detailed headings explicitly distinguish input processing from output generation; the network appears in both through the prompt pass and the saved-work generation pass.

The existing manual navigation, icon buttons, timeline styling, and automatic within-step animations are preserved. Timeline labels are compact versions of the full chapter titles, which remain in accessible names and chapter headings. This supersedes the chapter grouping in ADRs 0007 and 0008.

## Verification

Compiler coverage checks chapter order, input/generation separation, end-before-review ordering, missing alternatives, and the same five chapters for requests with history. Browser coverage checks the timeline, text view, depth labels, existing lesson interactions, and accessibility using only fixtures and the mock API.

Validation: 231 unit tests and 57 Chromium browser tests passed, along with type checking, lint, the production build, and the client-bundle scan. The chapter/manual-navigation cases were rerun after compacting timeline labels. Desktop and 320 px phone views were inspected; no stylesheet or control-layout changes were made.
