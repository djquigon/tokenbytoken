# ADR 0002: Hosting and the limits store

- **Status:** Accepted, 2026-09-30
- **Deciders:** project owner (answers to the Phase 1 questions), Claude

## Context
The site is a personal, non-commercial project. It's public with no sign-in and must never spend more than
$20/month on the OpenAI API. Serverless instances share no memory, so rate limits, the one-stream-per-session
lock, and the daily budget ledger need a shared store.

## Decision
- **Hosting:** Vercel **Hobby** (Fluid compute, Node.js 24). Hobby's terms allow personal, non-commercial
  use, and this project qualifies. Route handlers run on the Node.js runtime (Edge is deprecated in
  Next.js 16) with an explicit `maxDuration` (about 60 s; Hobby's maximum is 300 s).
- **Limits store:** Upstash Redis on the free tier, connected through the Vercel Marketplace. It holds the
  per-session and per-IP quotas, the concurrency lock, and the micro-dollar budget ledger.
- **Edge protection:** Hobby's single WAF rate-limit rule on `/api/chat`, plus Vercel BotID Basic (free).
- **Spending backstops:** an OpenAI organization hard cap of $20/month, with production and development
  projects capped at $17 and $3 if project caps are available. The app ledger allows about $0.55/day.

## Consequences
- **Streaming routes must opt in to request cancellation.** Measured on a Vercel Preview in Chrome on
  2026-09-30.
  - **Without cancellation, Vercel never tells a function the client left.** After the page stopped at 10
    events, the synthetic stream still sent all 40, and the OpenAI relay ran to completion (331 deltas),
    billing the whole reply.
  - **With `"supportsCancellation": true` on the route's path in `vercel.json`, it works.** `request.signal`
    fired on disconnect, and the OpenAI request was aborted 7 ms later.
  - **Vercel then terminates the function.** So the budget ledger settlement, lock release, and metadata
    log for `/api/chat` must run in `after()` (or `waitUntil`), or they are lost.
  - OpenAI reports no usage for an aborted response, so the ledger settles those turns with an estimate.
- **Framework preset.** It is pinned in `vercel.json` (`"framework": "nextjs"`). The project was imported
  while the repo held only docs, so Vercel had picked "Other". The first real build then failed after a
  successful `next build`, looking for a static `public` output directory.
- Re-check Vercel's Hobby terms if the site ever earns money (ads, sponsorships); commercial use needs Pro.
- Hobby allows only one WAF rule, so every other limit lives in the route handler and Redis.
- If Redis is unreachable, the chat endpoint fails closed (no request is sent to OpenAI).
- Before any public deployment, pin Next.js to the 16.3.8 security release or later (not yet published on
  2026-09-30; 16.3.7 is installed).

## Open verification
- Streaming in Safari and iOS Safari. Chrome is verified; Safari's 1 KB buffering is already handled with
  a padding comment. Optional: check once the chat exists.

## Resolved in Phase 1 (2026-09-30)
- **Upstash free tier:**
  - Limits: 500K commands/month, 256 MB, 10 GB bandwidth/month, and one database.
  - Every command inside a Lua script is billed, so a chat turn costs about 15 commands, or ≈ 33K turns a
    month. See ADR 0006 for what happens beyond that.
- **Upstash environment variables:** the Marketplace integration sets `KV_REST_API_URL` and
  `KV_REST_API_TOKEN`; the Upstash console's `UPSTASH_REDIS_REST_*` names also work. The app builds its
  client explicitly, without JSON auto-parsing of script results.
- **Client IP:** Vercel overwrites `x-forwarded-for` (and `x-real-ip`), so clients can't spoof it on Vercel.
  The app reads `x-real-ip` first, and hashes the IP before it reaches Redis.
- **BotID:**
  - Basic is free on Hobby.
  - `checkBotId()` returns human under `next dev` but throws under a local `next start`, so the app runs it
    in development mode unless it is on a Vercel preview or production deployment.
- **Verified on a Preview deployment (2026-09-30):**
  - Upstash, connected through the Marketplace, ran the admission and settlement Lua scripts.
  - BotID passed real page requests under the CSP.
  - `supportsCancellation` on `/api/chat` delivered the disconnect, and the OpenAI stream ended 8 ms later.
- **One database for every environment.** The free tier has one database, so Preview and Production share
  it. Every key is prefixed with `VERCEL_ENV` (`tbt:preview:…`, `tbt:production:…`), so each environment
  has its own limits and daily budget.

## Resolved
- **Disconnects on Vercel** (2026-09-30, `/spike` on a Preview):
  - Detected only when `supportsCancellation` is enabled; see Consequences.
  - With it, `request.signal` fires, and `ReadableStream.cancel()` is not needed.
- **Streaming on Vercel.** Delivery was progressive: arrivals were spread over ~1.5–1.9 s against the same
  span of sending. Chrome's network reads carried mostly one event, occasionally two.

## Sources (Phase 1, checked 2026-09-30)
- Upstash billing and free tier: https://upstash.com/docs/redis/overall/billing
- Upstash Ratelimit command costs (scripts count every command): https://upstash.com/docs/redis/sdks/ratelimit-ts/costs
- Vercel Marketplace Upstash integration: https://vercel.com/marketplace/upstash/upstash-kv
- Vercel request headers: https://vercel.com/docs/headers/request-headers
- BotID: https://vercel.com/docs/botid and https://vercel.com/docs/botid/local-development-behavior

## Sources (cancellation, checked 2026-09-30)
- Cancel requests: https://vercel.com/docs/functions/functions-api-reference#cancel-requests
- `functions` key and `supportsCancellation`: https://vercel.com/docs/project-configuration/vercel-json#functions

## Sources (checked 2026-09-29)
- Vercel limits and Fluid compute: https://vercel.com/docs/functions/limitations
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel WAF rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Vercel BotID: https://vercel.com/docs/botid
- Next.js runtime (Edge deprecated): https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
- OpenAI rate limits and spend caps: https://developers.openai.com/api/docs/guides/rate-limits
