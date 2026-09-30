// Views for "A weighted random pick". The sampler is drawn outside the network (docs/PLAN.md §2).

import { Datum } from '@/components/provenance/Datum';
import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { read } from '@/shared/provenance/read';

import { stripOptions } from '../common';
import type { SceneOf } from '../scenes';

export function DrawView({ scene }: { scene: SceneOf<'sample', 'draw'> }) {
  const alts = stripOptions(scene.token);
  const listed = alts.reduce((n, a) => n + read(a.pct), 0);
  return (
    <div className="draw">
      <div className="weighted-strip" aria-label="The options as a strip, each as wide as its percentage">
        {alts.map((a, i) => (
          <span key={i} className="strip-seg" data-chosen={a.isChosen ? 'true' : undefined} style={{ '--w': read(a.pct) } as React.CSSProperties}>
            {read(a.pct) > 8 ? (
              <span className="strip-label mono">
                <Datum of={a.text} as="token" badge={false} />
              </span>
            ) : null}
          </span>
        ))}
        <span className="strip-seg strip-rest" style={{ '--w': Math.max(0, 100 - listed) } as React.CSSProperties} />
      </div>
      <ExampleFrame rule="sampler-draw" className="sampler">
        <div className="pointer-track" style={{ '--landing': read(scene.landing) } as React.CSSProperties}>
          <span className="pointer" aria-hidden="true">▲</span>
        </div>
        <p className="stage-note">
          Picked: <Datum of={scene.token.text} as="token" compact />
        </p>
      </ExampleFrame>
    </div>
  );
}

export function SettingsView({ scene }: { scene: SceneOf<'sample', 'settings'> }) {
  const s = scene.request.settings;
  const setting = (label: string, value: React.ReactNode) => (
    <div className="setting">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="settings">
      {setting('temperature', read(s.temperature) === null ? 'not sent' : <Datum of={s.temperature as never} as="decimal" compact />)}
      {setting('top_p', read(s.topP) === null ? 'not sent' : <Datum of={s.topP as never} as="decimal" compact />)}
      {setting('alternatives per token', read(s.topLogprobs) === null ? 'none' : <Datum of={s.topLogprobs as never} as="int" compact />)}
      {setting('reasoning effort', read(s.reasoningEffort) === null ? 'default' : <Datum of={s.reasoningEffort as never} as="text" compact />)}
    </dl>
  );
}
