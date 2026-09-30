# ADR 0006: Chat request pipeline, limits, and history signing

- **Status:** Accepted, 2026-09-30 (Phase 1). Items marked **open** need the owner or a Preview deployment.
- **Deciders:** Claude, per the approved plan (docs/PLAN.md §3.6–3.7)

## Context
`/api/chat` is public with no sign-in, spends the owner's money, and must store nothing about what people
write. The server is stateless, so the browser sends the history back each turn. Everything that can reject
a request must happen before streaming starts (ADR 0003).

## Decision
1. **Guard order**, cheapest first, all before the `start` event:
   origin → content type → size (128 KB, counted while reading) → schema → configuration → BotID →
   reply signatures → tokenize + context policy → admission (lock, rate limits, budget reservation) →
   moderation → stream.
2. **Limits** (`src/server/config.ts`):
   - Per IP: 30 requests/minute, 300/day, and at most $0.15 of the day's budget.
   - Per tab session: 30 requests/day, one stream at a time.
   - Global: $0.55/day (≈ $17 ÷ 31).
   - The per-session limit keeps visitors who share an IP (for example, a classroom) from starving each
     other. It's a fairness limit, not a security control: a tab can mint a new session.
3. **Budget ledger** (integer micro-dollars; prices are USD per 1M tokens, which equals µ$ per token):
   - Admission reserves the worst case: (estimated input + 64) × max(input, cache-write price) +
     (600 output + 4 hidden) × output price. That's about 330–1,050 µ$ per request.
   - Settlement replaces the reservation with the actual cost, once (idempotent):
     - **usage:** uncached, cached, and cache-write input plus output, at the dated prices.
     - **estimate:** a stopped or broken reply that had started. Input as estimated, plus the relayed
       tokens, the 4 hidden tokens, and 32 tokens assumed to have been in flight.
     - **none:** the request failed before OpenAI produced anything, or moderation flagged it.
   - A crashed function never settles, so its reservation stays charged in full: a crash can't overspend.
   - The in-memory store and the Redis Lua scripts share one contract suite. The Lua runs in a real Lua VM
     over a fake Redis in tests.
4. **History signing:**
   - `v1.<kid>.<issuedAt>.<HMAC-SHA256>` over the conversation ID, the reply's ID, a hash of the user
     message it answered, a hash of the reply text, and the issue time.
   - The previous secret is still accepted during a rotation.
   - A forged or altered reply rejects the request (`invalid_history`). A signature older than 24 hours
     drops that reply from the context (`expired_signature`).
   - Stopped, interrupted, and failed replies are never signed, and neither is a reply whose relay hash
     didn't match, so they're never re-sent.
5. **Moderation** (`omni-moderation-latest`, free):
   - It checks the new message, plus any earlier user message that isn't followed by a signed reply (a
     signed reply proves its question was checked).
   - It runs before generation, and fails closed (`service_unavailable`) if the call fails.
   - It costs about 0.9–1.5 s before the first token (live local run, 2026-09-30). Running it alongside
     generation would cut that wait, but flagged input would reach the model before the abort. **The owner
     chose to keep it first (2026-09-30).** The live strip (Phase 2) shows this check as a real app event.
6. **Hashed identifiers:**
   - OpenAI's `safety_identifier` is `tbt_` plus an HMAC of the tab session (47 characters; the limit is 64).
   - Limits keys are separate HMACs of the session and the IP.
   - Raw IPs and session IDs never reach Redis or OpenAI.
7. **BotID Basic, only on Vercel deployments.** The client initializes only when `NEXT_PUBLIC_VERCEL_ENV` is
   preview or production. Elsewhere the server runs `checkBotId()` in development mode, because it throws
   under a local `next start`.
8. **Security headers:** a static CSP without nonces (Next.js CSP guide, "Without Nonces"), with
   `connect-src 'self'` and `img-src 'self' data: blob:`. BotID's same-origin proxy path is excluded.
9. **Fail closed.** Each of these makes every request fail with `service_unavailable`:
   - `OPENAI_API_KEY` is missing.
   - On a deployment, the signing secret or Redis is missing.
   - The store is unreachable.

   The in-memory store is refused on Vercel deployments.
10. **Browser storage:**
    - Each turn's TraceLog lives in `sessionStorage`, validated on restore, with the 8 most recent kept in
      full. Older turns keep their text but can't be inspected.
    - A reload mid-stream records `recovered`, so the turn finalizes as interrupted.
    - The privacy acknowledgment is versioned in `localStorage`.

## Dependencies added
- **zod:** validation at every untrusted boundary (CLAUDE.md §6).
- **zustand:** the vanilla conversation store (plan §3.2).
- **react-markdown**, **remark-gfm**, **rehype-sanitize:** model output as sanitized Markdown, with no HTML
  and no images.
- **@upstash/redis:** the limits store (ADR 0002).
- **botid:** Vercel BotID Basic (ADR 0002).
- **Development only:**
  - **fast-check:** property tests.
  - **@axe-core/playwright:** accessibility checks in end-to-end tests.
  - **wasmoon:** runs the production Lua scripts in unit tests.
- **Pinned exactly:**
  - vitest 5.0.2, because its typecheck mode is experimental.
  - gpt-tokenizer 4.0.0, because the app reads its BPE ranks through an internal path to get per-token bytes.

## Consequences
- **Verified on 2026-09-30:**
  - Unit, property, and type tests.
  - End-to-end tests against a production build, with OpenAI replaced by a mock that replays the Phase 0
    fixtures.
  - A live local run of four requests (about $0.0001):
    - Two turns, with the signed first reply accepted on the second.
    - A tampered reply rejected.
    - A Stop that aborted OpenAI 4 ms after the disconnect and settled as an estimate.
- **Upstash free tier:** 500K commands/month, and every command inside a script is billed. That's about
  15 commands per turn, so ≈ 33K turns/month (≈ 1,100/day), which is below the ≈ 1,700/day that the OpenAI
  budget allows. Beyond that, the store fails closed (no spending); pay-as-you-go lifts the cap. Free
  databases are archived after 30 days without activity.
- **Bundle:** the chat page loads about 320 KB of gzipped JavaScript, mostly React, zod, and the Markdown
  stack. Phase 2 must get it under 250 KB, for example by using `zod/mini` on the client.
- **Open: to verify on a Preview deployment before production:**
  - The Upstash database, connected through the Vercel Marketplace, running the real Lua scripts.
  - BotID working under the CSP.
  - `supportsCancellation` on `/api/chat`, which is already listed in `vercel.json`.

## Sources (checked 2026-09-30)
- BotID: https://vercel.com/docs/botid/get-started and https://vercel.com/docs/botid/local-development-behavior
- Upstash billing and free tier: https://upstash.com/docs/redis/overall/billing
- Vercel request headers (client IP): https://vercel.com/docs/headers/request-headers
- Next.js CSP guide: `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` (16.3.7)
- OpenAI moderation: https://developers.openai.com/api/docs/guides/moderation
- OpenAI error codes: https://developers.openai.com/api/docs/guides/error-codes
