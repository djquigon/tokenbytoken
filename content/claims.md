# Claims register

Every explanatory claim the site makes, with its source and when it was last checked (CLAUDE.md §3,
"Process"). A claim can't ship without a source. Format: PROVISIONAL. Phase 2 moves stage copy into
`content/stages/*.mdx` with these IDs.

Sources marked **this app** are facts about this app's own behavior. The cited code is the evidence, and a
test covers it where noted.

| ID | Claim (as worded in the UI) | Where | Source | Last checked |
|---|---|---|---|---|
| C001 | Your messages are sent to OpenAI to generate replies. | Privacy notice, /privacy | This app: `src/server/chat/handler.ts` | 2026-09-30 |
| C002 | This site doesn't store your conversation on its servers. It stays in this browser tab. | Privacy notice, /privacy | This app: no content is persisted or logged (`handler.test.ts` checks that the log line has no content); `src/generation/persist.ts` | 2026-09-30 |
| C003 | OpenAI keeps abuse-monitoring logs, which can include prompts and replies, for up to 30 days, or longer where the law requires it. | Privacy notice, /privacy | OpenAI, "Your data": https://developers.openai.com/api/docs/guides/your-data | 2026-09-30 |
| C004 | Data sent to OpenAI's API isn't used to train its models unless the account owner opts in. | Privacy notice, /privacy | OpenAI, "Your data" (as C003) | 2026-09-30 |
| C005 | With `store: false`, OpenAI doesn't keep the reply as stored application data. For longer conversations it may keep cached intermediate results of the start of a request (not its text) for up to 24 hours, not shared with other organizations. | /privacy | OpenAI, "Your data" (as C003); OpenAI prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching ("stores key-value (KV) tensors, not the tokens themselves"; the default for organizations without Zero Data Retention is `24h`; "not shared across organizations") | 2026-09-30 |
| C006 | Before a message is sent to the chat model, OpenAI's moderation model checks it; flagged messages aren't sent. | /privacy, error `input_flagged` | This app: `handler.ts` (tested: "does not send flagged input to the model") | 2026-09-30 |
| C007 | Counters for fair-use limits use hashed identifiers of your tab and IP, never the raw values, and expire within two days. | /privacy | This app: `src/server/signing/signing.ts` (`hashedKey`), `src/server/limits/store.ts` (TTLs of 2 min to 2 days) | 2026-09-30 |
| C008 | OpenAI receives a hashed identifier of your tab's session (a "safety identifier"). | /privacy | This app: `safetyIdentifier()`; OpenAI API reference, `safety_identifier` (at most 64 characters) | 2026-09-30 |
| C009 | On the deployed site, Vercel's bot protection runs a check in your browser. | /privacy | Vercel BotID docs: https://vercel.com/docs/botid | 2026-09-30 |
| C010 | This model's output count always includes 4 tokens that aren't returned as text. | Inspector, output-token check | Phase 0 probe (`docs/probe/2026-09-30-capability-report.md`, 27 of 27 fully covered calls), plus a live check on 2026-09-30 | 2026-09-30 |
| C011 | The "chance of being picked" is the percentage from the logprob OpenAI returned. | Inspector, token table | ADR 0001: logprobs are raw scores, unchanged by temperature; the app sends temperature 1 and top_p 1 | 2026-09-30 |
| C012 | Close calls ("chosen under 50%, or the top two within 15 points") describe wording, not correctness. | Inspector, token table | Design rule CLAUDE.md A12. General: a continuation's probability is not the probability that a statement is true | 2026-09-30 |
| C013 | Waits include network travel and OpenAI's queue, so they aren't the model's processing time; the time each token took to compute can't be observed. | Inspector, timing | CLAUDE.md A5/A6. Timestamps are taken at this app's server and in the browser (`src/trace/finalize.ts`) | 2026-09-30 |
| C014 | Cached tokens are saved results for an identical start of a request; they aren't memory. | Inspector, usage | OpenAI prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching (it reuses the saved key-value state of an unchanged prefix; it stores tensors, not tokens) | 2026-09-30 |
| C015 | "The model generated its end marker": inferred when OpenAI reports `completed` and no stop sequences were set. | Inspector, "How it ended" | Method `end-marker-inferred`; the app sets no stop sequences (the Responses API has no `stop` parameter; docs/PLAN.md §3.1) | 2026-09-30 |
| C016 | OpenAI returned no alternatives for these characters. | Inspector, gap rows | Phase 0 probe (ADR 0003, finding 2); `stream-unicode.json` fixture | 2026-09-30 |
