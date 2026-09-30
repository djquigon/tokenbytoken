'use client';

// Token rain (docs/PLAN.md §2, "Signature motif"): falling glyphs that are real token strings from a
// recorded reply, never invented characters. Each column reads down in the reply's own order.
//
// Decoration only: the canvas is aria-hidden, a caption says what the tokens are, and it never sits behind
// text. Canvas 2D at 30 fps at most; it stops when offscreen or the tab is hidden, has its own pause
// control (WCAG 2.2.2), and shows one still frame under reduced motion, more contrast, or Effects off
// (CLAUDE.md §8–9).

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useEffectsEnabled } from '@/components/prefs/hooks';
import { visibleTokenText } from '@/shared/token-display';

const FRAME_MS = 1000 / 30;
const FONT_PX = 14;
const ROW_PX = 22;
/** Tokens per falling stream. */
const TRAIL = 12;

interface Column {
  x: number;
  y: number;
  speed: number;
  start: number;
}

/** A small deterministic generator, so the layout is the same on every visit (it's decoration, not data). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return { bg: get('--bg-raised'), head: get('--recorded'), tail: get('--text-muted'), font: get('--font-plex-mono') || 'monospace' };
}

export function TokenRain({ tokens, children }: { tokens: readonly string[]; /** The caption: what the tokens are. */ children: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const effects = useEffectsEnabled();
  const [paused, setPaused] = useState(false);
  const moving = effects && !paused;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || tokens.length === 0) return;
    const shown = tokens.map(visibleTokenText);
    const random = seeded(tokens.length * 7919);
    let columns: Column[] = [];
    let palette = colors();
    let width = 0;
    let height = 0;

    const layout = () => {
      const dpr = window.devicePixelRatio || 1;
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Columns fit a typical token (the longest may overlap a neighbor slightly), and start at spread-out
      // points of the reply so neighbors don't repeat the same words.
      const lengths = shown.map((t) => t.length).sort((a, b) => a - b);
      const typical = Math.min(10, Math.max(5, lengths[Math.floor(lengths.length * 0.8)] ?? 6));
      const colWidth = typical * FONT_PX * 0.62 + 12;
      const count = Math.max(1, Math.floor(width / colWidth));
      columns = Array.from({ length: count }, (_, i) => ({
        x: i * (width / count) + 6,
        y: random() * (height + TRAIL * ROW_PX),
        speed: 0.6 + random() * 1.1,
        start: Math.floor(((i + random() * 0.5) / count) * shown.length),
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
          // The head is the newest token (bottom); older ones fade above it, so each column reads downward.
          const text = shown[(col.start + TRAIL - 1 - k) % shown.length] ?? '';
          ctx.globalAlpha = k === 0 ? 1 : Math.max(0.12, 0.75 - k * 0.08);
          ctx.fillStyle = k === 0 ? palette.head : palette.tail;
          ctx.fillText(text, col.x, y);
        }
      }
      ctx.globalAlpha = 1;
    };

    const step = () => {
      for (const col of columns) {
        col.y += col.speed * 2;
        if (col.y - TRAIL * ROW_PX > height) {
          col.y = -ROW_PX;
          col.start = (col.start + TRAIL) % shown.length;
        }
      }
    };

    layout();
    draw();
    // The monospace font may still be loading; redraw once it's ready.
    void document.fonts?.ready.then(() => draw());

    let frame = 0;
    let last = 0;
    let visible = true;
    const loop = (t: number) => {
      frame = requestAnimationFrame(loop);
      if (t - last < FRAME_MS) return;
      last = t;
      step();
      draw();
    };
    const start = () => {
      if (moving && visible && !document.hidden && frame === 0) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const resize = new ResizeObserver(() => {
      layout();
      draw();
    });
    resize.observe(el);
    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) start();
      else stop();
    });
    onScreen.observe(el);
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
      resize.disconnect();
      onScreen.disconnect();
      theme.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tokens, moving]);

  return (
    <figure className="token-rain">
      <canvas ref={canvas} aria-hidden="true" />
      <figcaption>
        <span>{children}</span>
        {effects ? (
          <button type="button" className="btn btn-quiet" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume the rain' : 'Pause the rain'}
          </button>
        ) : null}
      </figcaption>
    </figure>
  );
}
