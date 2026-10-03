# ADR 0014: Manual walkthrough navigation

- **Status:** Accepted, 2026-10-02
- **Decider:** the owner, requesting removal of autoplay, play/pause, and speed controls

## Decision

Readers advance with Next and Previous buttons for steps and sections, or select a section on the original timeline. Skip walkthrough remains available and unlocks the composer. Reaching the last step also unlocks it. Native keyboard activation remains available; custom playback shortcuts are removed.

Each newly selected step animates automatically, then stays visible indefinitely. The animation clock cannot advance the step. Its short teaching animation is independent of reading time and recorded model timing. Reduced motion reveals the complete step immediately. Hiding the tab completes the current animation without changing steps. Changing depth preserves the current step by key, or animates the fallback step when that key is unavailable.

Playback settings are removed from the preference schema, so old saved autoplay, speed, and shortcut settings cannot restore automatic navigation. The original icon buttons, control-row layout, and section timeline retain their appearance and responsive styles. Only the play/pause and speed control groups are removed. The timeline uses the original segment widths and progress fill; animation progress cannot advance the selected step. Compiler timing metadata determines segment proportions, not reading pace. The separate timing deep dive still demonstrates how the recorded reply arrived.

The owner's screenshot clarification supersedes the initial implementation's expanded text buttons, stacked controls, and removed timeline. Those layout changes were unnecessary and are reverted.

This supersedes the autoplay, playback speed, and custom navigation shortcut decisions in ADRs 0007 and 0008 and the original plan. An Instant playback speed is no longer planned.

## Verification

Reducer and controller tests cover animation completion without advancement, explicit completion, reduced motion, section navigation, hidden tabs, and depth changes. Browser tests cover step animation on arrival, indefinite reading time, keyboard button activation, legacy settings, mobile controls, Skip, and the existing walkthrough and accessibility flows. All network-backed tests use the local mock API.

Validation passed: 230 unit tests, 56 Chromium browser tests including axe checks, type checking, lint, and a production build. Desktop and 320 px phone screenshots were inspected. The client bundle scan found no secrets or server-only code (379.5 KB total gzip).
