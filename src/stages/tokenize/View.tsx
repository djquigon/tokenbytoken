// Views for "Text becomes tokens".

import { Datum } from '@/components/provenance/Datum';
import { TokenTape } from '@/components/tokens/TokenTape';

import type { SceneOf } from '../scenes';

export function ChipsView({ scene }: { scene: SceneOf<'tokenize', 'chips'> }) {
  return <TokenTape tokens={scene.pieces} label="Your message as tokens" revealVar />;
}

export function IdsView({ scene }: { scene: SceneOf<'tokenize', 'ids'> }) {
  return (
    <div className="ids-view">
      <TokenTape tokens={scene.pieces} label="Your message as tokens, with their IDs" showIds />
      <p className="stage-note">
        IDs from the <Datum of={scene.tokenizer} as="text" compact /> tokenizer, assumed to match this model.
      </p>
    </div>
  );
}

const CALLOUT_NAME = {
  leading_space: 'A whole word, with its leading space',
  split_word: 'A word split into pieces',
  multi_token_char: 'One character, several tokens',
} as const;

export function CalloutsView({ scene }: { scene: SceneOf<'tokenize', 'callouts'> }) {
  const all = new Set(scene.highlights.flatMap((h) => h.indices));
  return (
    <div className="callouts-view">
      <TokenTape tokens={scene.pieces} label="Your message as tokens, with examples outlined" highlight={all} />
      <ul className="callout-legend">
        {scene.highlights.map((h) => (
          <li key={h.kind}>
            <span className="callout-swatch" aria-hidden="true" /> {CALLOUT_NAME[h.kind]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CountView({ scene }: { scene: SceneOf<'tokenize', 'count'> }) {
  return (
    <div className="count-view">
      <div className="count-box">
        <p className="eyebrow">This app counted</p>
        <p className="count-number">
          <Datum of={scene.local} as="int" approx />
        </p>
      </div>
      <div className="count-box">
        <p className="eyebrow">OpenAI counted</p>
        <p className="count-number">{scene.reported ? <Datum of={scene.reported} as="int" /> : <span className="muted">not reported</span>}</p>
      </div>
    </div>
  );
}
