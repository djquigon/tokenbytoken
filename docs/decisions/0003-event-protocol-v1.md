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

## Consequences
- The Phase 1 trace reducer and alignment tests use `fixtures/probe/*/stream-basic.json` and
  `stream-unicode.json` as contract fixtures, including the emoji-gap case.
- The spike must still confirm, on Vercel, that disconnects propagate and that responses aren't buffered.
