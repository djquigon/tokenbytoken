# ADR 0014: Manual walkthrough navigation

- **Status:** Accepted, 2026-10-02
- **Decider:** the owner, requesting removal of autoplay, play/pause, and speed controls

## Decision

Readers advance with Next and Previous buttons for steps and sections. Skip walkthrough remains available and unlocks the composer. Reaching the last step also unlocks it. Native keyboard activation of these buttons remains available; custom playback shortcuts and direct chapter seeking are removed from the interface.

Each newly selected step animates automatically, then stays visible indefinitely. The animation clock cannot advance the step. Its short teaching animation is independent of reading time and recorded model timing. Reduced motion reveals the complete step immediately. Hiding the tab completes the current animation without changing steps. Changing depth preserves the current step by key, or animates the fallback step when that key is unavailable.

Playback settings are removed from the preference schema, so old saved autoplay, speed, and shortcut settings cannot restore automatic navigation. Duration estimates and the timed chapter progress bar are removed from the interface. Existing compiler timing metadata is retained for compatibility with compiled scripts; it no longer controls navigation. The separate timing deep dive still demonstrates how the recorded reply arrived.

This supersedes the autoplay, playback speed, and custom navigation shortcut decisions in ADRs 0007 and 0008 and the original plan. An Instant playback speed is no longer planned.

## Verification

Reducer and controller tests cover animation completion without advancement, explicit completion, reduced motion, section navigation, hidden tabs, and depth changes. Browser tests cover step animation on arrival, indefinite reading time, keyboard button activation, legacy settings, mobile controls, Skip, and the existing walkthrough and accessibility flows. All network-backed tests use the local mock API.

Validation passed: 230 unit tests, 56 Chromium browser tests including axe checks, type checking, lint, and a production build. Desktop and 320 px phone screenshots were inspected. The client bundle scan found no secrets or server-only code (379.5 KB total gzip).
