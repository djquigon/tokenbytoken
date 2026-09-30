// Views for "Inside the network (example view)". All drawings are Examples: wireframes with an EXAMPLE tag,
// uniform arcs, and no numbers on arcs or vectors (CLAUDE.md A10).

'use client';

import { useState } from 'react';

import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { Datum } from '@/components/provenance/Datum';
import { ATTENTION_PATTERN_NOTES } from '@/content/walkthrough';
import { RULES } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';

import type { SceneOf } from '../scenes';
import type { TokenPiece } from '../common';

function TokenLabels({ pieces }: { pieces: readonly TokenPiece[] }) {
  return (
    <>
      {pieces.map((p, i) => (
        <span key={i} className="net-label mono" data-kind={p.text.p.kind}>
          <Datum of={p.text} as="token" badge={false} />
        </span>
      ))}
    </>
  );
}

/** Learned parameters: a static lattice of dim cells, never characters (docs/PLAN.md §2, "Three materials"). */
function ParameterBlock() {
  return (
    <div className="param-block" aria-hidden="true">
      {Array.from({ length: 48 }, (_, i) => (
        <span key={i} className="param-cell" />
      ))}
      <span className="param-pin">⌖</span>
    </div>
  );
}

export function LookupView({ scene }: { scene: SceneOf<'embed', 'lookup'> }) {
  const vectors = read(scene.vectors);
  return (
    <ExampleFrame rule="embedding-vector">
      <div className="lookup">
        <div className="lookup-params">
          <ParameterBlock />
          <p className="material-label">Learned parameters: fixed while in use</p>
        </div>
        <div className="lookup-rows" style={{ '--n': scene.pieces.length } as React.CSSProperties}>
          {scene.pieces.map((p, i) => (
            <div key={i} className="lookup-row" style={{ '--i': i } as React.CSSProperties}>
              <span className="net-label mono" data-kind={p.text.p.kind}>
                <Datum of={p.text} as="token" badge={false} />
              </span>
              <span className="vector" aria-hidden="true">
                {(vectors[i] ?? []).map((h, d) => (
                  <span key={d} className="vector-bar" style={{ '--h': h } as React.CSSProperties} />
                ))}
              </span>
            </div>
          ))}
          <p className="material-label notes">Working notes: computed for this request, then discarded</p>
        </div>
      </div>
    </ExampleFrame>
  );
}

export function PrefillView({ scene }: { scene: SceneOf<'layers', 'prefill'> }) {
  const layers = read(scene.layers);
  return (
    <ExampleFrame rule="layer-stack">
      <div className="prefill" style={{ '--cols': scene.pieces.length, '--layers': layers } as React.CSSProperties}>
        <div className="layer-grid" aria-hidden="true">
          {Array.from({ length: layers }, (_, row) =>
            scene.pieces.map((_, col) => (
              <span key={`${row}-${col}`} className="layer-cell" style={{ '--row': layers - 1 - row } as React.CSSProperties} />
            )),
          )}
        </div>
        <p className="stack-label">× many layers (number not published)</p>
        <div className="prefill-labels">
          <TokenLabels pieces={scene.pieces} />
        </div>
      </div>
    </ExampleFrame>
  );
}

export function AttentionView({ scene }: { scene: SceneOf<'layers', 'attention'> }) {
  const [index, setIndex] = useState(0);
  const current = scene.patterns[index % scene.patterns.length] ?? scene.patterns[0];
  if (!current) return null;
  const labels = read(current.labels);
  const arcs = read(current.arcs);
  const n = labels.length;
  const x = (i: number) => (i + 0.5) * (600 / Math.max(1, n));
  const next = scene.patterns.length > 1 ? scene.patterns[(index + 1) % scene.patterns.length] : null;
  return (
    <ExampleFrame rule={current.rule}>
      <div className="attention">
        <svg className="arcs" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="currentColor" />
            </marker>
          </defs>
          {arcs.map((a, i) => {
            const from = x(a.from);
            const to = x(a.to);
            const d =
              a.from === a.to
                ? `M${to - 10} 112 C ${to - 22} 70, ${to + 22} 70, ${to + 6} 110`
                : `M${from} 112 Q ${(from + to) / 2} ${Math.max(8, 70 - (a.to - a.from) * 12)} ${to - 4} 110`;
            return <path key={`${current.rule}-${i}`} d={d} pathLength={1} className="arc" markerEnd="url(#arrow)" style={{ '--i': i / Math.max(1, arcs.length) } as React.CSSProperties} />;
          })}
        </svg>
        <div className="attention-labels" style={{ '--cols': n } as React.CSSProperties}>
          {labels.map((l, i) => (
            <span key={i} className="net-label mono" data-kind={current.labels.p.kind}>
              {l.replaceAll(' ', '␣')}
            </span>
          ))}
        </div>
        <p className="stage-note">
          {current.onSample ? 'A neutral sample. ' : 'Your tokens. '}
          {ATTENTION_PATTERN_NOTES[current.rule]} Arrows point into the position that draws on the text. Every arrow has the same weight: this shows
          a pattern, not measured values.
        </p>
        {next ? (
          <p>
            <button type="button" className="btn btn-quiet" onClick={() => setIndex((i) => i + 1)}>
              Show another example pattern
            </button>
            <span className="sr-only" aria-live="polite">
              {index > 0 ? RULES[current.rule].label : ''}
            </span>
          </p>
        ) : null}
      </div>
    </ExampleFrame>
  );
}

/** The same token at two positions: identical numbers going in (Detailed). */
export function PositionView({ scene }: { scene: SceneOf<'embed', 'position'> }) {
  const labels = read(scene.labels);
  const vector = read(scene.vector);
  const row = (p: (typeof scene.positions)[number]) => (
    <div className="position-row" key={p.index}>
      <span className="net-label mono" data-kind={scene.labels.p.kind}>
        {(labels[p.index] ?? '').replaceAll(' ', '␣')}
      </span>
      <span className="position-at">
        at position <Datum of={p.shown} as="int" badge={false} />
      </span>
      <span className="vector" aria-hidden="true">
        {vector.map((h, d) => (
          <span key={d} className="vector-bar" style={{ '--h': h } as React.CSSProperties} />
        ))}
      </span>
    </div>
  );
  return (
    <ExampleFrame rule="position-sample">
      <div className="position-view">
        <p className="position-sentence mono" data-kind={scene.labels.p.kind}>
          {labels.join('').trim()}
        </p>
        {scene.positions.map(row)}
        <p className="stage-note">Identical lists of numbers going in. Position information is what lets attention treat them differently.</p>
      </div>
    </ExampleFrame>
  );
}

/** Feed-forward: each position transformed on its own, with no links between positions (Detailed). */
export function FeedForwardView({ scene }: { scene: SceneOf<'layers', 'feedforward'> }) {
  return (
    <ExampleFrame rule="feed-forward">
      <div className="feedforward" style={{ '--cols': scene.pieces.length } as React.CSSProperties}>
        <div className="ff-grid" aria-hidden="true">
          {scene.pieces.map((_, i) => (
            <span key={i} className="ff-cell" style={{ '--i': i, '--n': scene.pieces.length } as React.CSSProperties} />
          ))}
        </div>
        <div className="prefill-labels">
          <TokenLabels pieces={scene.pieces} />
        </div>
        <p className="stage-note">One box per position. Nothing passes sideways between them in this step.</p>
      </div>
    </ExampleFrame>
  );
}
