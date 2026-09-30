// Views for "What gets sent".

import { Datum } from '@/components/provenance/Datum';
import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { read } from '@/shared/provenance/read';
import type { InputRunFacts } from '@/trace/facts';

import type { SceneOf } from '../scenes';

const ROLE_LABEL: Record<InputRunFacts['role'], string> = {
  instructions: "This app's instructions",
  user: 'You',
  assistant: 'Earlier reply',
};

function MessageCard({ run, i, clamp = true }: { run: InputRunFacts; i: number; clamp?: boolean }) {
  return (
    <div className="context-card" data-role={run.role} style={{ '--i': i } as React.CSSProperties}>
      <p className="context-card-head">
        <span className="eyebrow">{ROLE_LABEL[run.role]}</span>
        <span className="context-count">
          <Datum of={run.count} as="int" compact /> tokens
        </span>
      </p>
      <div className={clamp ? 'context-text clamp' : 'context-text'}>
        <Datum of={run.text} as="text" compact />
      </div>
    </div>
  );
}

export function CardsView({ scene }: { scene: SceneOf<'context', 'cards'> }) {
  const cards = [...(scene.instructions ? [scene.instructions] : []), ...scene.earlier, scene.message];
  return (
    <div className="context-cards" style={{ '--n': cards.length } as React.CSSProperties}>
      {cards.map((run, i) => (
        <MessageCard key={run.key} run={run} i={i} />
      ))}
    </div>
  );
}

export function LayoutView({ scene }: { scene: SceneOf<'context', 'layout'> }) {
  const markers = read(scene.markers);
  const marker = (role: InputRunFacts['role']) => (role === 'instructions' ? markers[0] : role === 'user' ? markers[1] : markers[2]);
  return (
    <ExampleFrame rule="role-markers">
      <div className="input-tape" style={{ '--n': scene.runs.length } as React.CSSProperties}>
        {scene.runs.map((run, i) => (
          <div key={run.key} className="input-segment" style={{ '--i': i } as React.CSSProperties}>
            <span className="role-marker mono">{marker(run.role)}</span>
            <span className="input-text clamp-1">
              <Datum of={run.text} as="text" badge={false} />
            </span>
          </div>
        ))}
      </div>
    </ExampleFrame>
  );
}

export function ExtrasView({ scene }: { scene: SceneOf<'context', 'extras'> }) {
  const r = scene.request;
  return (
    <div className="extras">
      <dl className="facts">
        <div>
          <dt>Model requested</dt>
          <dd>
            <Datum of={r.settings.model} as="text" compact />
          </dd>
        </div>
        <div>
          <dt>Moderation check</dt>
          <dd>
            <span className="datum" data-kind={r.moderation.flagged.p.kind}>
              <span>{read(r.moderation.flagged) ? 'flagged' : 'not flagged'}</span>
            </span>{' '}
            <Datum of={r.moderation.model} as="text" compact />
          </dd>
        </div>
        <div>
          <dt>Tools or search offered</dt>
          <dd>
            <Datum of={r.settings.toolsOffered} as="int" compact />
          </dd>
        </div>
        <div>
          <dt>Tool calls in the reply</dt>
          <dd>
            <Datum of={scene.toolCalls} as="int" compact />
          </dd>
        </div>
        <div>
          <dt>Reply stored by OpenAI for later use</dt>
          <dd>
            <Datum of={r.settings.storedByProvider} as="bool" compact />
          </dd>
        </div>
      </dl>
      <details className="full-request">
        <summary>View the full request</summary>
        <Datum of={r.upstreamBody as never} as="json" block />
      </details>
    </div>
  );
}
