'use client';

// One turn: the question, the streamed reply, how it ended, and the data behind it.

import { useMemo, useState } from 'react';

import { Datum } from '@/components/provenance/Datum';
import { TraceInspector } from '@/components/inspector/TraceInspector';
import type { AppError } from '@/shared/errors';
import { read } from '@/shared/provenance/read';
import { traceOf, type Turn } from '@/generation/conversation-store';

import { AssistantReply } from './AssistantReply';
import { ErrorNotice } from './ErrorNotice';

function EndNote({ turn, onRetry, canRetry }: { turn: Turn; onRetry: () => void; canRetry: boolean }) {
  const trace = useMemo(() => traceOf(turn), [turn]);
  if (!trace) return null;
  const outcome = read(trace.outcome);
  const stop = read(trace.stopReason);
  if (outcome === 'stopped') {
    return (
      <div className="turn-note">
        <p>Stopped. This partial reply won&apos;t be sent back to the model with your next message.</p>
        {canRetry ? (
          <button type="button" className="btn btn-quiet" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  if (outcome === 'incomplete') {
    return (
      <p className="turn-note">
        {stop === 'output_limit'
          ? "The reply reached this app's length limit, so it ends mid-way."
          : stop === 'content_filter'
            ? "OpenAI's content filter ended this reply early."
            : 'OpenAI ended this reply early.'}
      </p>
    );
  }
  return null;
}

function errorOf(turn: Turn): AppError | null {
  if (turn.live.error) return turn.live.error;
  const trace = traceOf(turn);
  if (!trace) return null;
  const outcome = read(trace.outcome);
  return outcome === 'interrupted' || outcome === 'failed' || outcome === 'rejected' ? trace.error : null;
}

export function TurnView({
  turn,
  index,
  isLast,
  streaming,
  onRetry,
  onClear,
}: {
  turn: Turn;
  index: number;
  isLast: boolean;
  streaming: boolean;
  onRetry: () => void;
  onClear: () => void;
}) {
  const [inspect, setInspect] = useState(false);
  const live = turn.live;
  const active = !turn.done;
  const reply = live.text || live.refusal;
  const error = turn.done ? errorOf(turn) : null;
  const trace = inspect ? traceOf(turn) : null;
  const summary = turn.done ? traceOf(turn) : null;

  return (
    <article className="turn" aria-labelledby={`turn-${index}-q`}>
      <div className="msg msg-user">
        <h2 id={`turn-${index}-q`} className="sr-only">
          Your message {index + 1}
        </h2>
        <p dir="auto">{turn.user.content}</p>
      </div>

      {live.terminal !== 'http_error' ? (
        <div className="msg msg-assistant" aria-busy={active} data-kind="recorded">
          <h2 className="sr-only">Reply {index + 1} (Recorded: reported by OpenAI)</h2>
          {active && !reply ? (
            <p className="waiting">{live.phase === 'sending' ? 'Sending…' : 'Waiting for the first text…'}</p>
          ) : null}
          {live.text ? <AssistantReply text={live.text} /> : null}
          {live.refusal ? (
            <p className="refusal" dir="auto">
              <strong>The model declined:</strong> {live.refusal}
            </p>
          ) : null}
          {active && reply ? <span className="cursor" aria-hidden="true" /> : null}
        </div>
      ) : null}

      {turn.done ? <EndNote turn={turn} onRetry={onRetry} canRetry={isLast && !streaming} /> : null}
      {error ? <ErrorNotice error={error} onRetry={onRetry} onClear={onClear} canRetry={isLast && !streaming} /> : null}

      {summary?.request ? (
        <div className="turn-meta">
          {summary.model ? <Datum of={summary.model} as="text" compact /> : null}
          <Datum of={summary.output.providerTokenCount} as="int" compact /> <span>tokens with alternatives</span>
          {summary.timing.durations.browserToFirstText ? (
            <>
              <span aria-hidden="true">·</span>
              <span>first text after</span> <Datum of={summary.timing.durations.browserToFirstText} as="ms" compact />
            </>
          ) : null}
          {turn.log ? (
            <button type="button" className="btn btn-quiet" aria-expanded={inspect} onClick={() => setInspect((v) => !v)}>
              {inspect ? 'Hide data' : 'Inspect data'}
            </button>
          ) : (
            <span className="muted">Data not kept for this earlier reply</span>
          )}
        </div>
      ) : null}
      {trace ? <TraceInspector trace={trace} /> : null}
    </article>
  );
}
