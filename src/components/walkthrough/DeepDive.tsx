'use client';

// Deep-dive panels (docs/PLAN.md §2, "Deep dives"): docked below the caption like the token card, never an
// overlay. Esc closes one and focus returns to the button that opened it.

import { useEffect, useRef, useState } from 'react';

import { Datum } from '@/components/provenance/Datum';
import { CloseIcon } from '@/components/ui/icons';
import { DEEP_DIVE_TITLES, type DeepDiveId } from '@/content/deep-dives';
import { read } from '@/shared/provenance/read';
import { textBefore } from '@/stages/common';
import { deepDiveCopy, exampleToken, recordedWrongCase, sentTemperature } from '@/stages/deep-dives';
import { SIMULATED_PICKS, TEMPERATURE_WHAT_IF, pickChances, simulatePicks, temperatureWhatIf } from '@/stages/sample/what-if';
import { derive } from '@/shared/provenance';
import type { FinalizedTrace } from '@/trace/facts';

import { CheckExercise, GuessExercise } from './Exercises';
import { fluentCaseTrace } from './fluent-case';
import { OptionBars } from './OptionBars';
import { RichText } from './RichText';

const WHAT_IF_ROWS = 8;
const round1 = (n: number) => Math.round(n * 10) / 10;

function TemperatureWhatIf({ trace }: { trace: FinalizedTrace }) {
  const token = exampleToken(trace);
  const sent = sentTemperature(trace);
  const [t, setT] = useState(0.5);
  // Picks simulated at the current what-if temperature; moving the slider clears them.
  const [picks, setPicks] = useState<number[] | null>(null);
  if (!token || !sent) return null;
  const rows = temperatureWhatIf(token, read(sent), t, WHAT_IF_ROWS);
  const top = token.alternatives[0];
  const set = (n: number) => {
    setT(round1(Math.min(TEMPERATURE_WHAT_IF.max, Math.max(TEMPERATURE_WHAT_IF.min, n))));
    setPicks(null);
  };
  const simulate = () => setPicks(simulatePicks(pickChances(token.alternatives.map((a) => read(a.logprob)), t), SIMULATED_PICKS, Math.random));
  const elsewhere = picks ? picks.slice(WHAT_IF_ROWS).reduce((a, b) => a + b, 0) : 0;
  // Each count is a What-if: drawn on this page from the chances in its row.
  const count = (i: number, basis: (typeof rows)[number]) =>
    derive('simulated-picks', [basis.whatIf ?? basis.sent], () => picks?.[i] ?? 0, { whatIf: true });
  const label = t === 0 ? 'zero (always the top option)' : t.toFixed(1);
  const before = textBefore(trace, token.index);
  return (
    <div className="what-if">
      <p className="moment-context mono">
        {before ? (
          <span className="moment-before">
            <span aria-hidden="true">…</span>
            <Datum of={before} as="text" badge={false} />
          </span>
        ) : null}
        <span className="moment-chosen" data-kind={token.text.p.kind}>
          <Datum of={token.text} as="token" badge={false} />
        </span>
        <span className="sr-only">(the token picked here)</span>
      </p>
      <div className="what-if-controls" data-control>
        <label htmlFor="what-if-temperature">What-if temperature</label>
        {/* aria-disabled, not disabled: a focused button that becomes disabled drops keyboard focus. */}
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => set(t - TEMPERATURE_WHAT_IF.step)}
          aria-label="Lower the temperature"
          aria-disabled={t <= TEMPERATURE_WHAT_IF.min}
        >
          −
        </button>
        <input
          id="what-if-temperature"
          type="range"
          min={TEMPERATURE_WHAT_IF.min}
          max={TEMPERATURE_WHAT_IF.max}
          step={TEMPERATURE_WHAT_IF.step}
          value={t}
          aria-valuetext={label}
          onChange={(e) => set(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => set(t + TEMPERATURE_WHAT_IF.step)}
          aria-label="Raise the temperature"
          aria-disabled={t >= TEMPERATURE_WHAT_IF.max}
        >
          +
        </button>
        <output htmlFor="what-if-temperature" className="mono">
          {label}
        </output>
      </div>
      <table className="what-if-table">
        <caption>Chances among the listed options for this position</caption>
        <thead>
          <tr>
            <th scope="col">Option</th>
            <th scope="col">
              Temperature sent: <Datum of={sent} as="decimal" compact />
            </th>
            <th scope="col">What-if: {t === 0 ? 'zero' : t.toFixed(1)}</th>
            {picks ? <th scope="col">Simulated picks</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} data-chosen={row.isChosen ? 'true' : undefined}>
              <th scope="row" className="mono">
                <Datum of={row.text} as="token" badge={false} />
                {row.isChosen ? <span className="option-picked">picked</span> : null}
              </th>
              <td style={{ '--w': read(row.sent) / 100 } as React.CSSProperties}>
                <span className="what-if-bar" aria-hidden="true" />
                <Datum of={row.sent} as="pct" badge={false} />
              </td>
              <td style={{ '--w': row.whatIf ? read(row.whatIf) / 100 : i === 0 ? 1 : 0 } as React.CSSProperties} data-whatif="true">
                <span className="what-if-bar" aria-hidden="true" />
                {row.whatIf ? <Datum of={row.whatIf} as="pct" badge={false} /> : i === 0 ? 'every time' : 'never'}
              </td>
              {picks ? (
                <td data-whatif="true">
                  <Datum of={count(i, row)} as="int" badge={false} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="what-if-simulate" data-control>
        <button type="button" className="btn" onClick={simulate}>
          {picks ? 'Simulate again' : `Simulate ${SIMULATED_PICKS} picks at this temperature`}
        </button>
        {picks ? (
          <span className="stage-note" role="status">
            Simulated on this page; the model wasn&rsquo;t asked again.
            {elsewhere > 0 ? ' Some picks landed on other listed options, not shown here.' : ''}
          </span>
        ) : null}
      </p>
      <p className="stage-note">
        Options: <span className="legend-word">Recorded</span>. Chances: <span className="legend-word">Calculated</span> from the logprobs; the
        What-if column is <span className="legend-word">simulated on this page</span>.
        {t === 0 && top ? (
          <>
            {' '}
            At temperature zero, <Datum of={top.text} as="token" compact /> would be picked every time.
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Replays the reply on the arrival times this browser measured (docs/PLAN.md §2, Ch6). It shows how the
 * text was delivered, network included, not how long the model took per token (CLAUDE.md A5, A6).
 */
function RealSpeedReplay({ trace }: { trace: FinalizedTrace }) {
  const segments = trace.output.segments;
  const times = segments.map((seg) => read(seg.kind === 'token' ? seg.token.arrival.browser : seg.gap.arrival.browser));
  const texts = segments.map((seg) => read(seg.kind === 'token' ? seg.token.text : seg.gap.text));
  const first = times[0] ?? 0;
  const [shown, setShown] = useState<number | null>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  if (segments.length === 0) return null;
  const play = () => {
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      let n = 0;
      while (n < times.length && (times[n] ?? 0) - first <= elapsed) n += 1;
      setShown(n);
      if (n < times.length) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(frame.current);
    setShown(null);
  };
  const running = shown !== null && shown < texts.length;
  return (
    <div className="real-speed">
      <p className="what-if-simulate" data-control>
        <button type="button" className="btn" onClick={running ? stop : play}>
          {running ? 'Stop' : shown === null ? 'Replay at the speed it arrived' : 'Replay again'}
        </button>
      </p>
      {shown !== null ? (
        <p className="real-speed-text" data-kind="recorded">
          {texts.slice(0, shown).join('')}
          {running ? <span className="cursor" aria-hidden="true" /> : null}
        </p>
      ) : null}
      <p className="stage-note">
        Replayed on the arrival times this browser measured, so they include the network. The time each token took to compute can&rsquo;t be observed.
      </p>
    </div>
  );
}

export function DeepDive({ id, trace, onClose }: { id: DeepDiveId; trace: FinalizedTrace; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current = document.activeElement;
    heading.current?.focus();
    const back = opener.current;
    return () => {
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    };
  }, [id]);

  const caseTrace = id === 'fluent' ? fluentCaseTrace() : null;
  const copy = deepDiveCopy(id, trace, recordedWrongCase(caseTrace));
  const caseToken = caseTrace?.output.tokens[0];
  return (
    <section
      className="deep-dive panel"
      aria-labelledby="deep-dive-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="token-card-head">
        <h3 id="deep-dive-title" ref={heading} tabIndex={-1}>
          {DEEP_DIVE_TITLES[id]}
        </h3>
        <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>
      {copy ? (
        copy.paragraphs.map((p, i) => (
          <p key={i} className="deep-dive-text">
            <RichText text={p} />
          </p>
        ))
      ) : (
        <p className="muted">Not available for this reply.</p>
      )}
      {id === 'temperature' && copy ? <TemperatureWhatIf trace={trace} /> : null}
      {id === 'guess' && copy ? <GuessExercise trace={trace} /> : null}
      {id === 'check' ? <CheckExercise /> : null}
      {id === 'timing' ? <RealSpeedReplay trace={trace} /> : null}
      {id === 'fluent' && caseToken ? (
        <figure className="recorded-case">
          <figcaption className="stage-note">The recorded example&rsquo;s first token: the options OpenAI returned.</figcaption>
          <OptionBars token={caseToken} shown={5} animate={false} />
        </figure>
      ) : null}
    </section>
  );
}
