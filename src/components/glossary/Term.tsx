'use client';

// A glossary term (CLAUDE.md §8, WCAG 1.4.13). The definition shows on hover or focus and pins on click.
// It can be dismissed with Esc without moving focus or the pointer, stays open while the pointer is over
// it, and never takes focus. Screen readers get the definition as the term's description.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { GLOSSARY, type GlossaryId } from '@/content/glossary';

/** Hovering opens after a moment, so moving the pointer across text doesn't flash definitions. */
const HOVER_DELAY_MS = 300;
const HIDE_DELAY_MS = 250;

export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = (GLOSSARY as Record<string, (typeof GLOSSARY)[GlossaryId] | undefined>)[id];
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hide = useRef<number | undefined>(undefined);
  const reveal = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(
    () => () => {
      window.clearTimeout(hide.current);
      window.clearTimeout(reveal.current);
    },
    [],
  );

  if (!entry) return <>{children}</>;
  const show = () => {
    window.clearTimeout(hide.current);
    window.clearTimeout(reveal.current);
    setOpen(true);
  };
  const showSoon = () => {
    window.clearTimeout(hide.current);
    window.clearTimeout(reveal.current);
    reveal.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };
  const hideSoon = () => {
    window.clearTimeout(reveal.current);
    if (pinned) return;
    window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setOpen(false), HIDE_DELAY_MS);
  };

  return (
    <span className="term" onMouseEnter={showSoon} onMouseLeave={hideSoon}>
      <button
        type="button"
        className="term-button"
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={show}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        onClick={() => {
          setPinned((p) => !p);
          setOpen(!pinned || !open);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) e.stopPropagation();
        }}
      >
        {children}
      </button>
      <span id={tipId} role="tooltip" className="term-tip" hidden={!open}>
        <strong>{entry.term}:</strong> {entry.definition}
        {'analogy' in entry ? <span className="term-analogy"> {entry.analogy}</span> : null}
      </span>
    </span>
  );
}
