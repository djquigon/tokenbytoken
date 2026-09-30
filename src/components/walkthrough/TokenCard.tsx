'use client';

// The token card (docs/PLAN.md §2): a docked panel, not an overlay, with the real options for one position.
// Esc closes it and focus returns to where it came from.

import { useEffect, useRef } from 'react';

import { Datum } from '@/components/provenance/Datum';
import { CloseIcon } from '@/components/ui/icons';
import { read } from '@/shared/provenance/read';
import type { FinalizedTrace } from '@/trace/facts';

import { OptionBars } from './OptionBars';

export function TokenCard({ trace, index, onClose }: { trace: FinalizedTrace; index: number; onClose: () => void }) {
  const token = trace.output.tokens[index];
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    heading.current?.focus();
    const back = opener.current;
    return () => {
      if (back instanceof HTMLElement) back.focus();
    };
  }, [index]);

  if (!token) return null;
  const rank = read(token.chosenRank);
  return (
    <section
      className="token-card panel"
      aria-labelledby="token-card-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="token-card-head">
        <h3 id="token-card-title" ref={heading} tabIndex={-1}>
          Token card: <Datum of={token.text} as="token" compact />
        </h3>
        <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Close token card">
          <CloseIcon />
        </button>
      </header>
      <OptionBars token={token} shown={10} animate={false} />
      <dl className="facts">
        <div>
          <dt>Chance of being picked</dt>
          <dd>
            <Datum of={token.pct} as="pct" compact />
          </dd>
        </div>
        <div>
          <dt>Rank among the options</dt>
          <dd>{rank === null ? 'not listed' : <Datum of={token.chosenRank as never} as="int" compact />}</dd>
        </div>
        {token.tokenId ? (
          <div>
            <dt>Token ID (assumed tokenizer)</dt>
            <dd>
              <Datum of={token.tokenId} as="id" compact />
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Close call</dt>
          <dd>
            <Datum of={token.closeCall} as="bool" compact />
          </dd>
        </div>
        {token.arrivalAfterSend ? (
          <div>
            <dt>Arrived after sending (includes the network)</dt>
            <dd>
              <Datum of={token.arrivalAfterSend} as="ms" compact />
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
