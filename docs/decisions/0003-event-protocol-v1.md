# ADR 0003: Event protocol v1 (server → browser)

- **Status:** Accepted as the basis for Phase 1, 2026-09-30. Field-level details are finalized when the
  adapter and trace reducer are implemented.
- **Deciders:** Claude, per the approved plan (docs/PLAN.md §3.5), revised with Phase 0 probe findings

## Decision
- **Shape.** The chat route streams versioned, provider-agnostic Server-Sent Events: `start`,
  `upstream_open`, `response_created`, `delta`, `text_done`, `end`.
  - Every event carries `seq` and a server timestamp.
  - Only `src/server/openai/` knows OpenAI's event names.
  - Rejections happen before the stream starts, with an HTTP status.
  - Failures after that point arrive in-band as `end{failed}`.
- **Framing.** SSE over `fetch` (POST), LF line endings.
  - The stream opens with a ~2 KB padding comment, because Safari buffers the first 1 KB.
  - A heartbeat comment is sent every 15 s while idle.
  - Headers: `text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.
- **Obfuscation off upstream.** The server sets `stream_options.include_obfuscation: false`, since the
  server-to-OpenAI link is trusted. The field is never forwarded.

## Probe findings that shape the protocol (all four candidate models, 2026-09-30)
1. **One token per delta.** OpenAI sent exactly one token per `response.output_text.delta` in about 1,500
   to 1,900 deltas per model.
   - Any grouping the browser sees comes from the network. The `/spike` page measures it.
   - Teaching copy must say what we measured, not assume chunk ≠ token at the source.
2. **Streamed entries have no bytes; the final list does but can be empty.**
   - Streamed logprob entries carry `token`, `logprob`, and `top_logprobs`, but no bytes.
   - The final `output_text.logprobs` list carries bytes, but it was **empty** for the reply that contained
     emoji.
   - Those emoji deltas carried **no logprob entries at all**.
   - So the protocol relays streamed entries as they come, possibly empty per delta, and the final list as
     optional.
   - The trace aligns tokens using the streamed token strings plus delta text. It uses bytes only when
     present, and labels uncovered text as "OpenAI returned no alternatives for these characters".
3. **Hidden output tokens.** `usage.output_tokens` includes tokens never returned as text: 4 per reply for
   gpt-6-luna, 1 for the gpt-4 models. `end` carries usage as reported. The capability registry supplies the
   expected per-model gap, so reconciliation can explain it.
4. **Reported logprobs are raw scores** (temperature-independent). `start` records the settings actually
   sent, so the UI can say whether the percentages equal the chances of each pick (true at T = 1, top_p = 1).
5. **`response.created` precedes the first text.** For gpt-6-luna the gap was a median of 365 ms. Both
   timestamps are Recorded; the UI never attributes the gap to an internal phase.
6. **Cached tokens are shared across requests from the same account.** The full run's *first* caching call
   hit the cache warmed by an earlier shakedown run. This confirms that a cache badge must never imply
   per-user memory (`CLAUDE.md` A14).

7. **Stopping a reply, measured on a Vercel Preview.**
   - A disconnect reaches the function only with `supportsCancellation` enabled (see ADR 0002).
   - With it, the server detected the stop and aborted the OpenAI request within about 10 ms.
   - The aborted response ended without a terminal event and without usage.
   - The server had already relayed 18 deltas when the page stopped at 10, because tokens were in flight.
   - So a stopped turn's cost is an estimate: relayed tokens plus a small in-flight margin. `end` is never
     sent for it.

## Consequences
- The Phase 1 trace reducer and alignment tests use `fixtures/probe/*/stream-basic.json` and
  `stream-unicode.json` as contract fixtures, including the emoji-gap case.
- `/api/chat` must be covered by `supportsCancellation` in `vercel.json`, with its cleanup in `after()`
  (ADR 0002).

## Phase 1: the protocol as implemented (2026-09-30)
The schemas in `src/shared/protocol/v1.ts` are the source of truth.
- **Request:** `v`, `clientRequestId`, `sessionId`, `conversationId`, `messages`, `options.logprobs`.
  - `sessionId` is new since the plan. It is tab-scoped and used, hashed, for limits and the safety ID.
  - Re-sent replies must carry `sig` (ADR 0006).
- **`start`:**
  - `requestId`, `assistantMessageId`, `instructions` (word for word), and `settings` (what was sent).
  - `upstreamRequest`: the exact body, opaque to the browser.
  - `context`: what was included or dropped, and why.
  - `inputTokens`: this app's tokenization, as IDs plus UTF-8 lengths per piece.
  - `moderation`, `limits`, and `reference` (dated facts that the trace labels Reference).
- **`delta`:**
  - `logprobs` is null when not requested, and can be empty.
  - Text that arrives with no tokens also carries `gapTokens`: this app's own tokenization of that text,
    labeled Calculated and never shown as OpenAI's tokens.
- **`end`:**
  - `outcome`, `incompleteReason`, `error`, `usage`, and `outputItemTypes` (so tool calls would be visible).
  - `textSha256` over the relayed text.
  - `finalTokenBytes` from `response.completed`, and `providerTokenIds` (this app's vocabulary lookup).
  - `outputTokens`, `assistantSig`, and `ledger` (what was charged, and on what basis).

**Further findings**
8. **Final logprob values are rounded.** The final list rounds to about 5 significant digits, while
   streamed values have full precision. The trace uses streamed values, and the final list only for bytes.
9. **Where bytes come from.** `response.output_text.done` carries logprobs without bytes; only the
   `response.completed` output has bytes. The SDK throws on a stream `error` event instead of yielding it.
   The adapter maps that, and any dropped connection after the stream opened, to in-band codes.
10. **Live check (2026-09-30).**
    - The input estimate matched within 1 token (104 vs. 103, and 147 vs. 146).
    - Output usage was exactly the visible tokens plus 4.
    - Every streamed token was found in `o200k_base`.
    - One position came back with 19 alternatives, not 20.
