// The playback clock (docs/PLAN.md §3.5): one requestAnimationFrame loop. Frame gaps are clamped, so a
// backgrounded tab (where frames stop) never jumps ahead when it comes back.

export interface ClockDeps {
  readonly requestFrame: (cb: (t: number) => void) => number;
  readonly cancelFrame: (id: number) => void;
  readonly now: () => number;
}

export const MAX_FRAME_MS = 100;

export interface Clock {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

export function createClock(deps: ClockDeps, onTick: (dtMs: number) => void): Clock {
  let frame: number | null = null;
  let last = 0;
  const loop = () => {
    const t = deps.now();
    const dt = Math.min(MAX_FRAME_MS, Math.max(0, t - last));
    last = t;
    frame = deps.requestFrame(loop);
    onTick(dt);
  };
  return {
    start() {
      if (frame !== null) return;
      last = deps.now();
      frame = deps.requestFrame(loop);
    },
    stop() {
      if (frame !== null) deps.cancelFrame(frame);
      frame = null;
    },
    get running() {
      return frame !== null;
    },
  };
}
