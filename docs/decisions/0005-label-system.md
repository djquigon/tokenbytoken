# ADR 0005: The label system

- **Status:** Accepted (default adopted), 2026-09-30. Wording to be checked with informal feedback.
- **Deciders:** Claude, with the owner's approval of the plan's defaults (docs/PLAN.md §6, Q6)

## Context
The brief asks the interface to distinguish observed data, derived data, and illustrative simulation.
Some values fit none of the three: documented limits and prices, and general principles of how
transformer models work.

## Decision
Four user-facing labels plus one modifier, enforced in the type system (`Sourced<T>`, `<Datum>`):

| UI label | Brief's term | Meaning |
|---|---|---|
| Recorded | Observed | Sent by this app, done by this app, reported by OpenAI, or measured by this app |
| Calculated | Derived | Computed from Recorded (plus Reference) values by a named method |
| Reference | (new) | Documented facts with URL and date, or general principles not confirmed for this model |
| Example | Illustrative | Teaching depictions, or real data from a different named model |
| What-if | (modifier) | Hypotheticals computed on the page; the model wasn't asked again |

The brief's terms appear at Detailed depth. The full rules (inputs decide the label, inherited labels only
weaken, seeded values are Example, and so on) live in `CLAUDE.md` §3.

## Consequences
- Every data-bearing element needs a label; a DOM test fails on unlabeled digits or model text.
- Phase 0 findings already need these distinctions: for example, the probe found that `usage.output_tokens`
  can include tokens that are never returned as text, so "OpenAI counted 44" (Recorded) and "40 visible"
  (Calculated) must be shown as different things.
