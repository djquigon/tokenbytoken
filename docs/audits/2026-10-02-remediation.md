# Site audit resolution — 2026-10-02

Implements all 13 findings in [the audit](2026-10-02-site-audit.md), authorized by the owner's request to address them on a new branch and open a PR. See [ADR 0013](../decisions/0013-audit-remediation.md) for the decisions.

| Finding | Resolution | Verification |
|---|---|---|
| T1-1 | Per-request working state and identity guards prevent stale callbacks, flushes and cleanup from affecting a new conversation. | Conversation-store regression |
| T1-2 | Portaled tooltips clamp to the viewport and follow scroll/resize; Escape dismisses without moving focus. | Browser bounds at 320, 375 and 640 px |
| T1-3 | Transcript has actual options tables, shared deep-dive controls/exercises, and expandable input/reply data. | Text-view browser regression |
| T2-1 | Provider-scored token counts replace montage segment counts; partial and absent alternatives are explicit. | Playback regressions for both gap cases |
| T2-2 | Nonzero or unknown reasoning count blocks the per-token script and shows a conservative fallback. An omitted upstream count stays null through the adapter, protocol, and trace. | Adapter/finalized-trace unit tests and browser composer-unlock checks for nonzero, null detail, and missing usage |
| T2-3 | Both privacy surfaces explain legal and harm-prevention retention exceptions; notice version bumped. | Official source checked; content lint |
| T2-4 | Follow-up copy distinguishes user/network stops from signed provider-ended partial replies. | Local history/signing code review; content lint |
| T2-5 | Survey denominator corrected to 327 eligible respondents and dated to this check. | Primary paper section 3; generated claims register |
| T3-1 | Legends explain next-piece likelihood versus truth and provide a logprob tooltip. | Browser tooltip check; content lint |
| T3-2 | Embeddings/fixed learned numbers and temporary working notes now occupy successive steps. | Caption word limit and reading-time tests |
| T3-3 | Training and transformer summaries explain or mark their technical terms. | FAQ glossary validation and content lint |
| T4-1 | Caption comes before the short visible Example caveat and graphic; full caveat is expandable. | Browser DOM-order and disclosure regression |
| T4-2 | Mobile FAQ index collapses; desktop retains its sidebar; answers link back to the index. | Mobile/desktop browser navigation regression |

## Validation

| Check | Final result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 26 files, 228 tests passed, no type errors; the known busy-day test also passed |
| Production build | Passed as part of the Playwright web-server setup |
| `npm run test:e2e -- --workers=2` | 54 Chromium tests passed, using mock OpenAI; includes axe scans of the transcript and existing site surfaces |
| `node scripts/check-client-bundle.mts` with a fake key | 15 browser scripts checked; 382.2 KB total gzip; no secret patterns or server-only code detected. No comparison to real secret values was performed. |
| `git diff --check` | Passed |
| Rendered review | Inspected mobile FAQ and transcript, glossary positioning, and desktop caption/Example ordering from browser screenshots |

The first browser run exposed a missing pane-switch action in the new mobile test; after correcting that test, it exposed real table overflow. Tables now have named, keyboard-scrollable regions, and the final run passed at 320 px. Existing local BotID configuration warnings remain in the mock-server output; they did not fail the checks.

Compatibility note: protocol v1 accepts null reasoning usage in addition to the existing numeric values. Older open clients may need a reload if the provider omits that count. Existing numeric recordings and ordinary replies are unchanged.

No real OpenAI calls or new sample recordings were made. No secret values were read from `.env.local`, and the owner's server on port 3000 was not used. Native screen-reader and real-device testing remain outside this verification.
