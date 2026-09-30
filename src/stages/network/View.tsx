// Views for "Inside the network (example view)". All drawings are Examples: wireframes with an EXAMPLE tag,
// uniform arcs, and no numbers on arcs or vectors (CLAUDE.md A10).

import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { Datum } from '@/components/provenance/Datum';
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
  const labels = read(scene.labels);
  const arcs = read(scene.arcs);
  const n = labels.length;
  const x = (i: number) => (i + 0.5) * (600 / Math.max(1, n));
  return (
    <ExampleFrame rule={scene.onSample ? 'attention-previous-token' : 'attention-previous-token'}>
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
                : `M${from} 112 Q ${(from + to) / 2} ${40} ${to - 4} 110`;
            return <path key={i} d={d} pathLength={1} className="arc" markerEnd="url(#arrow)" style={{ '--i': i / Math.max(1, arcs.length) } as React.CSSProperties} />;
          })}
        </svg>
        <div className="attention-labels" style={{ '--cols': n } as React.CSSProperties}>
          {labels.map((l, i) => (
            <span key={i} className="net-label mono" data-kind={scene.labels.p.kind}>
              {l.replaceAll(' ', '␣')}
            </span>
          ))}
        </div>
        <p className="stage-note">
          {scene.onSample ? 'A neutral sample sentence.' : 'Your tokens.'} Arrows point into the position that draws on the text. Every arrow has the same
          weight: this shows a pattern, not measured values.
        </p>
      </div>
    </ExampleFrame>
  );
}
