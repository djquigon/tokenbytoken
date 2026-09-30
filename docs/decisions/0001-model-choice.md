# ADR 0001: Model choice

- **Status:** Accepted, 2026-09-30. The owner reviewed the replies in
  `docs/probe/2026-09-30-quality-gpt-6-luna.md` and approved their quality.
- **Deciders:** project owner (the rule and the final quality call), Claude (the probe)

## Context
Decision D3 (docs/PLAN.md §1): use the cheapest model that gives the best visualization outcomes. Concretely,
the cheapest candidate that passes every automatic check below, then an owner review of reply quality.
The Phase 0 probe (`npm run probe`) tested four candidates in cost order on 2026-09-30, 61 calls each.
The full run cost $0.0135. Evidence: `docs/probe/2026-09-30-capability-report.md` and `fixtures/probe/`.

## Results

| Check | gpt-6-luna | gpt-4o-mini | gpt-5.4-nano | gpt-4.1-mini |
|---|---|---|---|---|
| Price per 1M tokens (in / out) | $0.10 / $0.50 | $0.15 / $0.60 | $0.20 / $1.25 | $0.40 / $1.60 |
| Streamed top-20 logprobs | pass | pass | pass | pass |
| `reasoning_tokens == 0` (61 calls) | pass | pass | pass | pass |
| Temperature and top_p accepted | pass | pass | pass | pass |
| Tokenizer round-trip (o200k_base) | 1464/1464 | 1873/1873 | 1761/1761 | 1720/1720 |
| No retirement within ~6 months | pass | pass | pass | pass |
| Hidden output tokens per reply | 4 | 1 | 4 | 1 |
| Input count vs. local o200k_base | within 1 token | exact | within 1 token | exact |
| Prompt caching reported | yes (read and write) | no (in this test) | no (in this test) | no (in this test) |

## Decision
**`gpt-6-luna` with `reasoning.effort: "none"`**, temperature 1, top_p 1, `top_logprobs: 20`,
`store: false`. It is the cheapest candidate, it passed every automatic check, and the owner judged its
replies in the quality set good enough. At the ~$0.55/day app budget, a typical
turn (≈1,500 input + 350 output tokens) costs ≈$0.00033, so the site can serve roughly 1,700 turns a day.

**Fallback, in cost order:** `gpt-4o-mini`, then `gpt-5.4-nano`, then `gpt-4.1-mini`. All three passed the
same checks. Swapping is a config change plus a probe run.

## Consequences for the product (all measured, and shared by every candidate unless noted)
- **Reported logprobs are raw scores.** They did not change with temperature: gap ratios were ≈1.0 at
  T = 0, 0.7, and 1.5, where scaling by 1/T would give 1.43 and 0.67. At the app's settings (T = 1,
  top_p = 1) the percentages shown *are* the chances of each pick. The temperature What-if is exact
  within the returned top 20.
- **top_p shortens the returned list on the newer models.** On gpt-6-luna and gpt-5.4-nano, top_p = 0.1
  returned one alternative, with an unchanged value. The app keeps top_p = 1.
- **Values vary between identical requests.** Identical requests differed by up to 0.6–1.3 in logprob,
  mostly among low-ranked alternatives. Replays use the recorded trace, so the walkthrough is consistent.
- **The chosen token is almost always among the alternatives.** gpt-6-luna missed once in 1,464 tokens;
  the UI still handles "chosen token not listed".
- **Hidden output tokens.** `usage.output_tokens` counts tokens that are never returned as text: 4 per reply
  for gpt-6-luna. The capability registry records this so reconciliation can explain the gap, not flag it.
- **Emoji gaps.** Some emoji arrive with no logprob entries (" 👋", "🏽", " 🧑", "🚀"). When a reply contains
  them, the final logprob list comes back empty. Streamed entries are therefore the primary source; see
  ADR 0003.
- **The tokenizer matches.** Every output token of every model was exactly one `o200k_base` token. Local
  input counts matched OpenAI's to within one token once a fixed per-message overhead is added. Token IDs
  can be shown as Calculated, with the tokenizer named as assumed.

## Sources
- Probe report and fixtures in this repository (2026-09-30).
- OpenAI "Using the latest model" guide (reasoning effort and logprob parameters), checked 2026-09-29:
  https://developers.openai.com/api/docs/guides/latest-model
- Pricing, checked 2026-09-29: https://developers.openai.com/api/docs/pricing
