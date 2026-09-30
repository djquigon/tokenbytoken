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
- Re-check Vercel's Hobby terms if the site ever earns money (ads, sponsorships); commercial use needs Pro.
- Hobby allows only one WAF rule, so every other limit lives in the route handler and Redis.
- If Redis is unreachable, the chat endpoint fails closed (no request is sent to OpenAI).
- Before any public deployment, pin Next.js to the 16.3.8 security release or later (not yet published on
  2026-09-30; 16.3.7 is installed).

## Open verification
- Upstash free-tier limits (commands per day, storage) against expected traffic: check in Phase 1.
- Whether a client disconnect reaches the route handler on Vercel (`request.signal` and
  `ReadableStream.cancel()`): the Phase 0 streaming spike (`/spike`) answers this on a preview deployment.

## Sources (checked 2026-09-29)
- Vercel limits and Fluid compute: https://vercel.com/docs/functions/limitations
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel WAF rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Vercel BotID: https://vercel.com/docs/botid
- Next.js runtime (Edge deprecated): https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
- OpenAI rate limits and spend caps: https://developers.openai.com/api/docs/guides/rate-limits
