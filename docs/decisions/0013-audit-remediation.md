# ADR 0013: Audit remediation and complete text alternatives

- **Status:** Accepted, 2026-10-02
- **Deciders:** the owner ("Address all these issues on a new branch then create a PR"), and Codex for implementation

## Context

The [site audit](../audits/2026-10-02-site-audit.md) identified 13 defects and content/layout issues. The owner's follow-up authorizes those fixes, including the two proposed layout changes. The dated sample recordings and the lane indicator remain as recorded/designed.

## Decisions

- A generation request owns its working turn, flush state, and abort controller. Clearing invalidates its identity before aborting. Late entries, queued flushes, and final cleanup cannot publish into or persist a replacement conversation.
- Only a trace reporting zero hidden reasoning tokens can compile the per-token walkthrough. Otherwise the panel shows a Recorded hidden-token count, or an explicit unknown count, with one action to continue chatting. It offers no per-token stages or deep dives for that trace. `canCompile` identifies reply data eligible for this panel, including its conservative fallback.
- Protocol v1 now permits `usage.reasoningTokens: null` when the upstream usage detail is absent. Existing numeric recordings remain valid. The adapter preserves other usage fields instead of inventing zero or discarding the entire usage object; the Inspector also says "Not reported" for this case. Older clients may reject a newly nullable event and need to reload, but normal events with numeric counts are unchanged.
- Counts of tokens with alternatives come from `providerTokenCount`. Render segments still drive the montage but are never called the reply's token length. Missing alternatives stay missing and are explained in the captions.
- The text view uses ordinary options tables and shares the same deep-dive controls, exercises, and replay as the visual view. The input and complete reply data remain accessible as text. Values retain their provenance.
- Glossary definitions render in a portal, positioned within the viewport and repositioned on scrolling or resizing. Escape closes them without changing focus.
- Captions precede graphics. An always-visible, short Example caveat precedes each example graphic; its disclosure retains the full explanation.
- Below the desktop breakpoint, the FAQ question index is a native disclosure with return links from answers. The desktop index remains visible beside the answers. Both use the same source entries.
- Probability legends explain what the percentage means before giving the source terminology. Embeddings and temporary working notes are introduced in successive steps. FAQ summaries define their technical terms.
- Privacy copy includes both legal and harm-prevention exceptions to the default retention period, and its acknowledgment version is bumped. Follow-up copy distinguishes user/network interruption from signed provider-ended partial replies. The survey denominator is the 327 respondents who met the publication criteria, not all 480 completions.

## Sources rechecked

- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data), abuse-monitoring retention, checked 2026-10-02.
- [Michael et al., NLP Community Metasurvey](https://arxiv.org/html/2208.12852), section 3 (eligible respondents), checked 2026-10-02.
- [OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning), `output_tokens_details.reasoning_tokens` usage field, and the installed SDK's `ResponseUsage` declaration, checked 2026-10-02. Treating an omitted field as unknown is this app's conservative policy.
- Local `historyFor` and server reply-signing behavior for the partial-history explanation.

The claims register is regenerated from its source. These targeted corrections do not turn the original audit's partial source coverage into full verification.

## Verification

Regression coverage includes Clear → immediate send with late callbacks, queued flushes and old cleanup; absent/nonzero reasoning counts; completely and partially missing alternatives; text-view tables and temperature interaction; viewport-constrained tooltips and Escape; mobile/desktop FAQ navigation; and caption/caveat/graphic reading order. Checks use local fixtures and the mock API only.

The [resolution record](../audits/2026-10-02-remediation.md) maps each finding to its implementation and records the final validation results.
