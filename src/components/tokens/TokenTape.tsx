'use client';

// A row of token chips (CLAUDE.md §8): one tab stop, arrow keys move between tokens, Home/End jump, and
// Enter or Space activates a token (opening its token card) when the tape allows it. Focusing a token never
// starts anything; only activating does (WCAG 3.2.1). Whitespace is visible and spoken.

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Datum } from '@/components/provenance/Datum';
import type { Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import { spokenTokenText } from '@/shared/token-display';

export interface TapeToken {
  readonly text: Sourced<string>;
  readonly id?: Sourced<number> | null;
  readonly part?: { readonly k: number; readonly n: number; readonly char: string } | null;
  /** Text that OpenAI returned without alternatives (drawn dashed, never filled in). */
  readonly gap?: boolean;
}

export function TokenTape({
  tokens,
  label,
  showIds = false,
  highlight,
  onActivate,
  revealVar,
  offset = 0,
}: {
  tokens: readonly TapeToken[];
  /** Accessible name of the tape, e.g. "Your message as tokens". */
  label: string;
  showIds?: boolean;
  highlight?: ReadonlySet<number>;
  onActivate?: (index: number) => void;
  /** Reveal tokens progressively with the step's --p (index-based), for animated steps. */
  revealVar?: boolean;
  /** For progressive reveal of a slice: tokens before `offset` are already shown. */
  offset?: number;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const count = tokens.length;
  const move = (to: number) => {
    const next = Math.max(0, Math.min(count - 1, to));
    setActive(next);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(active + 1),
      ArrowLeft: () => move(active - 1),
      Home: () => move(0),
      End: () => move(count - 1),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      e.stopPropagation();
      action();
    }
  };

  return (
    <div className="token-tape" role="list" aria-label={label} onKeyDown={onKeyDown}>
      {tokens.map((t, i) => {
        const text = read(t.text);
        const spoken = t.part ? `part ${t.part.k} of ${t.part.n} of ${t.part.char}` : spokenTokenText(text);
        const content: ReactNode = (
          <>
            <span className="token-text" aria-hidden="true">
              {t.part ? (
                <>
                  {t.part.char}
                  <sup>
                    {t.part.k}/{t.part.n}
                  </sup>
                </>
              ) : (
                <Datum of={t.text} as="token" badge={false} />
              )}
            </span>
            <span className="sr-only">{spoken}</span>
            {showIds && t.id ? (
              <span className="token-id">
                <Datum of={t.id} as="id" badge={false} />
              </span>
            ) : null}
          </>
        );
        const common = {
          ref: (el: HTMLElement | null) => {
            refs.current[i] = el;
          },
          className: 'token-chip',
          'data-gap': t.gap ? 'true' : undefined,
          'data-highlight': highlight?.has(i) ? 'true' : undefined,
          'data-kind': t.text.p.kind,
          style: revealVar ? ({ '--i': i - offset, '--n': Math.max(1, count - offset) } as React.CSSProperties) : undefined,
          'data-reveal': revealVar && i >= offset ? 'true' : undefined,
          tabIndex: i === active ? 0 : -1,
          onFocus: () => setActive(i),
        };
        return (
          <span role="listitem" key={i} className="token-slot">
            {onActivate ? (
              <button type="button" {...common} onClick={() => onActivate(i)} aria-label={`${spoken}. Open token card`}>
                {content}
              </button>
            ) : (
              <span {...common}>{content}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
