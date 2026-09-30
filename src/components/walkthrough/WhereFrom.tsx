'use client';

// "Is this real?" (Simple) and "How do we know this?" (Detailed), docs/PLAN.md §2 "Progressive
// disclosure": for the step on screen, which values are real data from this conversation, which were
// computed, which are documented facts, and which are teaching drawings, each with its source.
//
// It reads the labels the step actually rendered (every <Datum> and Example frame carries data-kind,
// data-source, and data-detail), so it lists exactly what's shown, never more.

import { useLayoutEffect, useState, type RefObject } from 'react';

import { KIND_LABEL, type Kind } from '@/shared/provenance';

interface Found {
  readonly kind: Kind;
  readonly source: string;
  readonly detail: string;
  readonly whatIf: boolean;
}

const ORDER: readonly Kind[] = ['recorded', 'calculated', 'reference', 'example'];

const PLAIN: Readonly<Record<Kind, string>> = {
  recorded: 'Real, from this conversation',
  calculated: 'Worked out by this app from real values',
  reference: 'Documented facts',
  example: 'Teaching drawings, not this model’s data',
};

function collect(root: HTMLElement): Found[] {
  const seen = new Map<string, Found>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-source]')) {
    const kind = el.dataset.kind as Kind | undefined;
    const source = el.dataset.source;
    if (!kind || !source || !ORDER.includes(kind)) continue;
    const whatIf = el.dataset.whatif === 'true';
    // One row per distinct field, so three things "sent by this app" show as three rows.
    const key = `${kind}|${el.dataset.detail ?? source}|${whatIf}`;
    if (seen.has(key)) continue;
    seen.set(key, { kind, source, detail: el.dataset.detail ?? '', whatIf });
  }
  return [...seen.values()].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

export function WhereFrom({ root, stepKey, detailed }: { root: RefObject<HTMLElement | null>; stepKey: string; detailed: boolean }) {
  const [found, setFound] = useState<Found[]>([]);
  // Re-read after each step renders; the stage's DOM changes only when the step does.
  useLayoutEffect(() => {
    // Reading the rendered labels is the point: it keeps this list exactly in step with the screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (root.current) setFound(collect(root.current));
  }, [root, stepKey]);

  if (found.length === 0) return <p className="muted">This step shows no values, only text.</p>;

  if (!detailed) {
    return (
      <ul className="where-from">
        {ORDER.filter((k) => found.some((f) => f.kind === k)).map((k) => (
          <li key={k} data-kind={k}>
            <strong>{PLAIN[k]}</strong> ({KIND_LABEL[k]}):{' '}
            {[...new Set(found.filter((f) => f.kind === k).map((f) => f.source))].join('; ')}.
          </li>
        ))}
        {found.some((f) => f.kind === 'example') ? (
          <li className="muted">Anything marked Example is drawn to teach the idea. OpenAI doesn’t expose these internals.</li>
        ) : null}
      </ul>
    );
  }

  return (
    <table className="where-from-table">
      <caption>Every kind of value in this step, and where it comes from</caption>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col">Source</th>
          <th scope="col">How</th>
        </tr>
      </thead>
      <tbody>
        {found.map((f) => (
          <tr key={`${f.kind}|${f.detail}|${f.whatIf}`} data-kind={f.kind}>
            <td>
              {KIND_LABEL[f.kind]}
              {f.whatIf ? ', What-if' : ''}
            </td>
            <td>{f.source}</td>
            <td>{f.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
