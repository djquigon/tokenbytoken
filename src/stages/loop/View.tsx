// Views for "Add it, repeat, until it ends".

'use client';

import { useState } from 'react';

import { AssistantReply } from '@/components/chat/AssistantReply';
import { Datum } from '@/components/provenance/Datum';
import { ProvBadge } from '@/components/provenance/ProvBadge';
import { provOf, read } from '@/shared/provenance/read';
import { TokenTape, type TapeToken } from '@/components/tokens/TokenTape';
import { ExampleFrame } from '@/components/walkthrough/ExampleFrame';
import { OptionBars } from '@/components/walkthrough/OptionBars';
import type { FinalizedTrace } from '@/trace/facts';

import type { SceneOf } from '../scenes';

export function replyTape(trace: FinalizedTrace): TapeToken[] {
  return trace.output.segments.map((s) =>
    s.kind === 'token' ? { text: s.token.text, id: s.token.tokenId } : { text: s.gap.text, gap: true },
  );
}

/** Maps a tape position to an OpenAI token index (gaps have none). */
export function tokenAt(trace: FinalizedTrace, segment: number): number | null {
  const s = trace.output.segments[segment];
  return s?.kind === 'token' ? s.token.index : null;
}

export function DecodeView({ scene }: { scene: SceneOf<'layers', 'decode'> }) {
  return (
    <ExampleFrame rule="saved-work">
      <div className="decode">
        {scene.tokens.map((t, i) => (
          <div key={i} className="decode-col" data-new={i === scene.tokens.length - 1 ? 'true' : undefined}>
            <span className="decode-notes" aria-hidden="true" />
            <span className="net-label mono" data-kind={t.text.p.kind}>
              <Datum of={t.text} as="token" badge={false} />
            </span>
          </div>
        ))}
        <p className="stage-note decode-note">Faded: saved work from earlier positions, reused. Bright: the new position, computed now.</p>
      </div>
    </ExampleFrame>
  );
}

export function MomentView({ scene }: { scene: SceneOf<'loop', 'moment'> }) {
  return (
    <div className="moment">
      <p className="moment-context mono">
        {scene.before ? (
          <span className="moment-before">
            <span aria-hidden="true">…</span>
            <Datum of={scene.before} as="text" badge={false} />
          </span>
        ) : null}
        <span className="moment-chosen" data-kind={scene.token.text.p.kind}>
          <Datum of={scene.token.text} as="token" badge={false} />
        </span>
      </p>
      <OptionBars token={scene.token} shown={5} />
    </div>
  );
}

export function MontageView({
  scene,
  trace,
  onToken,
}: {
  scene: SceneOf<'loop', 'montage'>;
  trace: FinalizedTrace;
  onToken: (tokenIndex: number) => void;
}) {
  const tape = replyTape(trace);
  return (
    <div className="montage" data-from={scene.from} data-to={scene.to}>
      <p className="montage-counter">
        Sped up, not real timing · reply length: <Datum of={scene.total} as="int" compact />
      </p>
      <TokenTape
        tokens={tape.slice(0, scene.to)}
        label="The reply as tokens, as far as this step"
        revealVar
        offset={scene.from}
        onActivate={(i) => {
          const index = tokenAt(trace, i);
          if (index !== null) onToken(index);
        }}
      />
    </div>
  );
}

export function EndView({ trace, onToken }: { scene: SceneOf<'stop', 'end'>; trace: FinalizedTrace; onToken: (tokenIndex: number) => void }) {
  // Close calls are outlined on the tape (Calculated with the displayed rule).
  const close = new Set(read(trace.closeCalls).all);
  const outlined = new Set(trace.output.segments.flatMap((s, i) => (s.kind === 'token' && close.has(s.token.index) ? [i] : [])));
  return (
    <div className="end-view">
      <TokenTape
        tokens={replyTape(trace)}
        label="The whole reply as tokens, close calls outlined. Activate a token to see its options."
        highlight={outlined}
        onActivate={(i) => {
          const index = tokenAt(trace, i);
          if (index !== null) onToken(index);
        }}
      />
      <p className="stage-note" data-method="close-call">
        Select any token to see the options OpenAI returned for it.
        {outlined.size > 0 ? ' Outlined: the close calls, where the pick was under half the chances or the top two were close.' : ''}
      </p>
      <ReplyText trace={trace} />
    </div>
  );
}

/** The reply formatted, or as written: formatting such as bold is just characters the model wrote. */
function ReplyText({ trace }: { trace: FinalizedTrace }) {
  const [asWritten, setAsWritten] = useState(false);
  const text = trace.output.finalText ?? trace.output.text;
  return (
    <div className="reply-text">
      <div className="reply-text-head">
        <div className="segmented" role="group" aria-label="Show the reply">
          <button type="button" aria-pressed={!asWritten} onClick={() => setAsWritten(false)}>
            Formatted
          </button>
          <button type="button" aria-pressed={asWritten} onClick={() => setAsWritten(true)}>
            As written
          </button>
        </div>
        <ProvBadge prov={provOf(text)} compact />
      </div>
      {asWritten ? (
        <Datum of={text} as="text" block badge={false} />
      ) : (
        // Focusable, so a long reply can be scrolled from the keyboard.
        <div className="reply-rendered" data-kind={provOf(text).kind} tabIndex={0} role="region" aria-label="The reply, formatted">
          <AssistantReply text={read(text)} />
        </div>
      )}
      <p className="stage-note">
        Formatting is just characters the model wrote, such as asterisks around a word; this app turns them into bold or lists.
      </p>
    </div>
  );
}
