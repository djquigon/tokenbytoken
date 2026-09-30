'use client';

// Token rain (docs/PLAN.md §2, "Signature motif"): the landing page's background. Every falling glyph is a
// real token of the tokenizer this app uses, picked at random from a pool of thousands of words and
// numbers (src/content/rain-tokens.json), and a caption says so.
//
// Decoration only: the canvas is aria-hidden and sits behind the page, while all text sits on solid
// panels, never over the rain (CLAUDE.md §8). Canvas 2D at 30 fps at most; it stops when the tab is
// hidden, has its own pause control (WCAG 2.2.2), and holds one still frame under reduced motion, more
// contrast, or Effects off (CLAUDE.md §9).

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useEffectsEnabled } from '@/components/prefs/hooks';
import { visibleTokenText } from '@/shared/token-display';

const FRAME_MS = 1000 / 30;
const FONT_PX = 15;
const ROW_PX = 24;
/** Tokens per falling stream. */
const TRAIL = 14;

interface Column {
  x: number;
  y: number;
  speed: number;
  /** This stream's tokens, newest last; drawn fresh from the pool each time the stream restarts. */
  tokens: string[];
}

interface RainState {
  readonly paused: boolean;
  readonly setPaused: (paused: boolean) => void;
  readonly moving: boolean;
}

const RainContext = createContext<RainState | null>(null);

/** Shares the pause state between the background canvas and its controls. */
export function RainProvider({ children }: { children: ReactNode }) {
  const effects = useEffectsEnabled();
  const [paused, setPaused] = useState(false);
  const value = useMemo(() => ({ paused, setPaused, moving: effects && !paused }), [paused, effects]);
  return <RainContext.Provider value={value}>{children}</RainContext.Provider>;
}

function colors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return { bg: get('--bg'), head: get('--recorded'), tail: get('--text-muted'), font: get('--font-plex-mono') || 'monospace' };
}

/** The background canvas: fixed behind the page, filling the window. */
export function RainCanvas({ pool }: { pool: readonly string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const moving = useContext(RainContext)?.moving ?? false;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || pool.length === 0) return;
    // Shown without the leading space (whitespace is invisible in running text anyway).
    const shown = pool.map((t) => visibleTokenText(t.trimStart()));
    // The rain is decoration, not data, so an ordinary random pick is fine here.
    const pick = () => shown[Math.floor(Math.random() * shown.length)] ?? '';
    const stream = () => Array.from({ length: TRAIL }, pick);
    let columns: Column[] = [];
    let palette = colors();
    let width = 0;
    let height = 0;

    const layout = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colWidth = 7 * FONT_PX * 0.62 + 18;
      const count = Math.max(1, Math.floor(width / colWidth));
      columns = Array.from({ length: count }, (_, i) => ({
        x: i * (width / count) + 6,
        y: Math.random() * (height + TRAIL * ROW_PX),
        speed: 0.5 + Math.random() * 1.2,
        tokens: stream(),
      }));
    };

    const draw = () => {
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${FONT_PX}px ${palette.font}`;
      ctx.textBaseline = 'middle';
      for (const col of columns) {
        for (let k = 0; k < TRAIL; k += 1) {
          const y = col.y - k * ROW_PX;
          if (y < -ROW_PX || y > height + ROW_PX) continue;
          // The head (bottom) is brightest; older tokens fade above it. Kept dim: it's a background.
          ctx.globalAlpha = k === 0 ? 0.75 : Math.max(0.06, 0.42 - k * 0.03);
          ctx.fillStyle = k === 0 ? palette.head : palette.tail;
          ctx.fillText(col.tokens[TRAIL - 1 - k] ?? '', col.x, y);
        }
      }
      ctx.globalAlpha = 1;
    };

    const step = () => {
      for (const col of columns) {
        col.y += col.speed * 2;
        if (col.y - TRAIL * ROW_PX > height) {
          col.y = -ROW_PX;
          col.tokens = stream();
        }
      }
    };

    layout();
    draw();
    // The monospace font may still be loading; redraw once it's ready.
    void document.fonts?.ready.then(() => draw());

    let frame = 0;
    let last = 0;
    const loop = (t: number) => {
      frame = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      step();
      draw();
    };
    const start = () => {
      if (moving && !document.hidden && frame === 0) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onResize = () => {
      layout();
      draw();
    };
    window.addEventListener('resize', onResize);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    // Redraw in the new colors when the theme changes.
    const theme = new MutationObserver(() => {
      palette = colors();
      draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    start();
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      theme.disconnect();
    };
  }, [pool, moving]);

  return (
    <>
      <canvas ref={canvas} className="rain-canvas" aria-hidden="true" />
      <div className="rain-scanlines" aria-hidden="true" />
    </>
  );
}

/** What the rain is, and its pause control (shown only when it moves). */
export function RainControls({ children }: { children: ReactNode }) {
  const rain = useContext(RainContext);
  const effects = useEffectsEnabled();
  return (
    <p className="rain-controls">
      <span>{children}</span>
      {effects && rain ? (
        <button type="button" className="btn btn-quiet" aria-pressed={rain.paused} onClick={() => rain.setPaused(!rain.paused)}>
          {rain.paused ? 'Resume the rain' : 'Pause the rain'}
        </button>
      ) : null}
    </p>
  );
}
