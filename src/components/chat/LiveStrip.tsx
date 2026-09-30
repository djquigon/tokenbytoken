'use client';

// The live strip (docs/PLAN.md §1, step 3): while a reply streams, only recorded events, in order. Nothing
// here animates the model's insides, and the wait is explained, never called "thinking" (CLAUDE.md A5, A6).
// Tokens appear live only because the stream carries their strings (Recorded, reported by OpenAI).
// It isn't a live region: the reply announces once when it finishes (CLAUDE.md §8).

import { useEffect, useMemo, useState } from 'react';

import { usePrefs } from '@/components/prefs/hooks';
import { prefsStore } from '@/components/prefs/store';
import { Datum } from '@/components/provenance/Datum';
import { TokenTape } from '@/components/tokens/TokenTape';
import type { Sourced } from '@/shared/provenance';
import { clientMs, type ClientMs } from '@/shared/units';
import { elapsedSince, liveFacts } from '@/trace/live';
import type { TraceLogV1 } from '@/trace/log';

/** How many of the newest tokens the strip shows. */
const RECENT_TOKENS = 18;
/** The timer redraws about ten times a second. */
const TIMER_STEP_MS = 100;

const browserNow = () => clientMs(performance.timeOrigin + performance.now());

function WaitTimer({ sent }: { sent: Sourced<ClientMs, 'recorded'> }) {
  const [now, setNow] = useState(browserNow);
  useEffect(() => {
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= TIMER_STEP_MS) {
        last = t;
        setNow(browserNow());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span role="timer" aria-label="Time since the request was sent">
      <Datum of={elapsedSince(sent, now)} as="ms" compact />
    </span>
  );
}

export function LiveStrip({ log }: { log: TraceLogV1 }) {
  const depth = usePrefs((s) => s.depth);
  const facts = useMemo(() => liveFacts(log), [log]);
  const recent = facts.tokens.slice(-RECENT_TOKENS).map((t) => ({ text: t.text }));

  return (
    <section className="live-strip" aria-label="Live view: what this app records as the reply arrives">
      <ol className="live-events">
        <li>Request sent</li>
        {facts.waited ? (
          <li>
            First text after <Datum of={facts.waited} as="ms" compact />
          </li>
        ) : (
          <li className="live-wait">
            Waiting for the first text {facts.requestSent ? <WaitTimer sent={facts.requestSent} /> : null}
          </li>
        )}
        {facts.tokens.length > 0 ? (
          <li>
            Tokens so far: <Datum of={facts.tokenCount} as="int" compact />
          </li>
        ) : null}
      </ol>
      {facts.waited ? null : (
        <p className="live-note">
          This includes network travel, OpenAI&rsquo;s queue, and the model processing your conversation. This app can&rsquo;t see how that time
          splits.
        </p>
      )}
      {recent.length > 0 ? <TokenTape tokens={recent} label="The newest tokens, as they arrive" /> : null}
      {facts.textWithoutTokens ? <p className="live-note">Some text arrived without tokens from OpenAI; it is shown as text only.</p> : null}
      {depth !== 'simple' && facts.mostTokensInOnePiece ? (
        <p className="live-note">
          Pieces received: <Datum of={facts.pieceCount} as="int" compact />. The most tokens in one piece:{' '}
          <Datum of={facts.mostTokensInOnePiece} as="int" compact />. A piece is how the text traveled, not a step of the model.
        </p>
      ) : null}
      <button type="button" className="btn btn-quiet live-hide" onClick={() => prefsStore.getState().set({ liveStrip: false })}>
        Hide live view
      </button>
    </section>
  );
}
