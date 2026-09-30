// Views for the Hook and "The options for the next token".

import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { OptionBars } from '@/components/walkthrough/OptionBars';
import { Datum } from '@/components/provenance/Datum';
import { read } from '@/shared/provenance/read';

import type { SceneOf } from '../scenes';
import type { OptionsView } from './build';

function Moment({ view }: { view: OptionsView }) {
  return (
    <div className="moment">
      <p className="moment-context mono">
        {view.before ? (
          <span className="moment-before">
            <span aria-hidden="true">…</span>
            <Datum of={view.before} as="text" badge={false} />
          </span>
        ) : null}
        <span className="moment-chosen" data-kind={view.token.text.p.kind}>
          <Datum of={view.token.text} as="token" badge={false} />
        </span>
        <span className="sr-only">(the token picked here)</span>
      </p>
      <OptionBars token={view.token} shown={view.shown} />
    </div>
  );
}

export function HookView({ scene }: { scene: SceneOf<'probs', 'hook'> }) {
  return (
    <div className="stage-hook">
      {scene.closeCall ? (
        <p className="eyebrow">
          Close call <span className="sr-only" data-method="close-call">
            (Calculated: chosen under 50%, or the top two within 15 points)
          </span>
        </p>
      ) : null}
      <Moment view={scene.moment} />
    </div>
  );
}

export function StripView({ scene }: { scene: SceneOf<'probs', 'strip'> }) {
  const scores = read(scene.scores);
  return (
    <ExampleFrame rule="vocab-scores">
      <div className="vocab-strip" aria-hidden="true" style={{ '--n': scores.length } as React.CSSProperties}>
        {scores.map((h, i) => (
          <span key={i} className="vocab-cell" style={{ '--h': h, '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <p className="stage-note">
        One cell stands for many vocabulary entries.
        {scene.vocabulary ? (
          <>
            {' '}
            Entries in the assumed vocabulary: <Datum of={scene.vocabulary} as="int" compact />
          </>
        ) : null}
      </p>
    </ExampleFrame>
  );
}

export function UnavailableView() {
  return (
    <div className="stage-unavailable">
      <p>Not available for this reply.</p>
      <p>
        <a href="/sample">Replay the sample conversation</a>, recorded through this app, to see the options for every token.
      </p>
    </div>
  );
}

export function BarsView({ scene }: { scene: SceneOf<'probs', 'bars'> | SceneOf<'probs', 'meaning'> }) {
  return <Moment view={scene.options} />;
}
