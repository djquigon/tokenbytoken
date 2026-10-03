'use client';

// A glossary term (CLAUDE.md §8, WCAG 1.4.13). The definition shows on hover or focus and pins on click.
// It can be dismissed with Esc without moving focus or the pointer, stays open while the pointer is over
// it, and never takes focus. Screen readers get the definition as the term's description.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { GLOSSARY, type GlossaryId } from '@/content/glossary';

/** Hovering opens after a moment, so moving the pointer across text doesn't flash definitions. */
const HOVER_DELAY_MS = 300;
const HIDE_DELAY_MS = 250;

export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = (GLOSSARY as Record<string, (typeof GLOSSARY)[GlossaryId] | undefined>)[id];
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const hide = useRef<number | undefined>(undefined);
  const reveal = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !tooltip.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? window.innerHeight;
      tooltip.current.style.maxWidth = `${Math.max(0, width - 16)}px`;
      tooltip.current.style.maxHeight = `${Math.max(0, height - 16)}px`;
      const tip = tooltip.current.getBoundingClientRect();
      tooltip.current.style.left = `${Math.max(left + 8, Math.min(anchor.left, left + width - tip.width - 8))}px`;
      const below = anchor.bottom + 6;
      tooltip.current.style.top = `${Math.max(top + 8, Math.min(below + tip.height <= top + height - 8 ? below : anchor.top - tip.height - 6, top + height - tip.height - 8))}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open]);

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
        ref={trigger}
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
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
            setPinned(false);
          }
        }}
      >
        {children}
      </button>
      {open ? createPortal(<span ref={tooltip} id={tipId} role="tooltip" className="term-tip" onMouseEnter={show} onMouseLeave={hideSoon}>
        <strong>{entry.term}:</strong> {entry.definition}
        {'analogy' in entry ? <span className="term-analogy"> {entry.analogy}</span> : null}
      </span>, document.body) : null}
    </span>
  );
}
