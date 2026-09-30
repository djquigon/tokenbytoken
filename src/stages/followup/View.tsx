// Views for "Your next message: the chat so far is sent again".

import { Datum } from '@/components/provenance/Datum';
import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { read } from '@/shared/provenance/read';

import type { SceneOf } from '../scenes';

export function PackingView({ scene }: { scene: SceneOf<'followup', 'packing'> }) {
  const dropped = read(scene.dropped).length;
  return (
    <div className="packing" style={{ '--n': scene.messages.length } as React.CSSProperties}>
      {scene.messages.map((m, i) => (
        <div key={m.key} className="packed" data-role={m.role} style={{ '--i': i } as React.CSSProperties}>
          <span className="eyebrow">{m.role === 'user' ? 'You' : 'Reply'}</span>
          <span className="clamp-1">
            <Datum of={m.text} as="text" badge={false} />
          </span>
        </div>
      ))}
      {dropped > 0 ? <p className="stage-note">Older messages left out to fit this app’s budget are listed in the data view.</p> : null}
    </div>
  );
}

export function GaugeView({ scene }: { scene: SceneOf<'followup', 'gauge'> }) {
  const budget = read(scene.request.context.inputBudgetTokens);
  const used = scene.input ? read(scene.input) : 0;
  return (
    <ExampleFrame rule="context-gauge">
      <div className="gauge">
        <div className="gauge-row">
          <span className="gauge-label">Used by this request</span>
          <span className="gauge-bar" style={{ '--w': Math.min(1, used / budget) } as React.CSSProperties} aria-hidden="true" />
          <span>{scene.input ? <Datum of={scene.input} as="int" compact /> : 'not reported'}</span>
        </div>
        <div className="gauge-row">
          <span className="gauge-label">This app’s budget</span>
          <span className="gauge-bar full" aria-hidden="true" />
          <Datum of={scene.request.context.inputBudgetTokens} as="int" compact />
        </div>
        <div className="gauge-row">
          <span className="gauge-label">The model’s documented limit</span>
          <span className="gauge-bar broken" aria-hidden="true" />
          <Datum of={scene.request.reference.contextWindowTokens} as="int" compact />
        </div>
      </div>
    </ExampleFrame>
  );
}
