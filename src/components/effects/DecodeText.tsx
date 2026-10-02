'use client';

// A "decode" reveal (docs/PLAN.md §2): text briefly scrambles, then resolves, once. The real text is in
// the DOM from the start, so screen readers get it immediately; the scramble is an aria-hidden overlay.
// At most 300 ms, never flashing, and skipped entirely under reduced motion or with Effects off.

import { useEffect, useRef } from 'react';

import { useEffectsEnabled } from '@/components/prefs/hooks';

const DURATION_MS = 300;

export function DecodeText({ text }: { text: string }) {
  const overlay = useRef<HTMLSpanElement>(null);
  const final = useRef<HTMLSpanElement>(null);
  const effects = useEffectsEnabled();

  useEffect(() => {
    const o = overlay.current;
    const f = final.current;
    if (!o || !f || !effects) return;
    // Scramble with the text's own letters: glyphs only ever stand for text.
    const pool = [...text.replace(/\s/g, '')];
    const started = performance.now();
    let frame = 0;
    f.style.opacity = '0';
    const tick = (t: number) => {
      const done = Math.min(1, (t - started) / DURATION_MS);
      const settled = Math.floor(done * text.length);
      o.textContent = [...text].map((ch, i) => (i < settled || /\s/.test(ch) ? ch : (pool[(i * 7 + Math.floor(t / 40)) % pool.length] ?? ch))).join('');
      if (done < 1) frame = requestAnimationFrame(tick);
      else {
        o.textContent = '';
        f.style.opacity = '';
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      o.textContent = '';
      f.style.opacity = '';
    };
  }, [text, effects]);

  return (
    <span className="decode-text">
      <span ref={final}>{text}</span>
      <span ref={overlay} className="decode-overlay" aria-hidden="true" />
    </span>
  );
}
