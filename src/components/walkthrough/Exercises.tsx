'use client';

// Two optional exercises (docs/PLAN.md §1–2): guess which real option the model scored highest before the
// percentages show, and sort things from the walkthrough into real data or examples. Answers stay on this
// page: nothing is sent or stored.

import { useState } from 'react';

import { Datum } from '@/components/provenance/Datum';
import { REAL_OR_EXAMPLE } from '@/content/deep-dives';
import { textBefore } from '@/stages/common';
import { guessPositions } from '@/stages/deep-dives';
import type { FinalizedTrace } from '@/trace/facts';

import { OptionBars } from './OptionBars';

/** The options offered as guesses: the top few, in an order that doesn't give the answer away. */
function shuffledTop(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  let a = seed * 2654435761;
  for (let i = order.length - 1; i > 0; i -= 1) {
    a = (a * 1103515245 + 12345) >>> 0;
    const j = a % (i + 1);
    [order[i], order[j]] = [order[j] ?? 0, order[i] ?? 0];
  }
  return order;
}

export function GuessExercise({ trace }: { trace: FinalizedTrace }) {
  const positions = guessPositions(trace);
  const [round, setRound] = useState(0);
  const [guesses, setGuesses] = useState<readonly (number | null)[]>(() => positions.map(() => null));
  const index = positions[round];
  const token = index === undefined ? undefined : trace.output.tokens[index];
  if (!token) return null;
  const count = Math.min(4, token.alternatives.length);
  const order = shuffledTop(count, token.index + 1);
  const guess = guesses[round] ?? null;
  const before = textBefore(trace, token.index);
  const top = token.alternatives[0];
  const chosen = guess === null ? undefined : token.alternatives[guess];
  const right = guesses.filter((g) => g === 0).length;
  const done = guesses.every((g) => g !== null);

  return (
    <div className="exercise">
      <p className="exercise-progress" data-control>
        Position {round + 1} of {positions.length}
      </p>
      <p className="moment-context mono">
        {before ? (
          <span className="moment-before">
            <span aria-hidden="true">…</span>
            <Datum of={before} as="text" badge={false} />
          </span>
        ) : null}
        <span className="moment-gap" aria-hidden="true">
          ▁▁▁
        </span>
        <span className="sr-only">(the next token goes here)</span>
      </p>
      {guess === null ? (
        <div className="exercise-choices" role="group" aria-label="Which option did the model score highest?">
          <p>Which option did the model score highest?</p>
          {order.map((i) => {
            const alt = token.alternatives[i];
            return alt ? (
              <button
                key={i}
                type="button"
                className="btn mono"
                onClick={() => setGuesses((g) => g.map((x, r) => (r === round ? i : x)))}
              >
                <Datum of={alt.text} as="token" badge={false} />
              </button>
            ) : null;
          })}
        </div>
      ) : (
        <div className="exercise-result" role="status">
          <p>
            {guess === 0 && top ? (
              <>
                Right: <Datum of={top.text} as="token" compact /> had the top score, <Datum of={top.pct} as="pct" compact />.
              </>
            ) : top && chosen ? (
              <>
                The top option was <Datum of={top.text} as="token" compact /> at <Datum of={top.pct} as="pct" compact />; you chose{' '}
                <Datum of={chosen.text} as="token" compact /> at <Datum of={chosen.pct} as="pct" compact />.
              </>
            ) : null}{' '}
            The model picked <Datum of={token.text} as="token" compact />.
          </p>
          <OptionBars token={token} shown={5} animate={false} />
          {round + 1 < positions.length ? (
            <button type="button" className="btn" onClick={() => setRound((r) => r + 1)}>
              Next position
            </button>
          ) : done ? (
            <p className="exercise-score" data-control>
              You found the top option {right} of {positions.length} times. Likely wordings are often easy to guess; that&rsquo;s what makes them
              likely.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CheckExercise() {
  const [answers, setAnswers] = useState<readonly ('real' | 'example' | null)[]>(() => REAL_OR_EXAMPLE.map(() => null));
  const correct = answers.filter((a, i) => a !== null && a === REAL_OR_EXAMPLE[i]?.answer).length;
  const answered = answers.filter((a) => a !== null).length;
  return (
    <div className="exercise">
      <ol className="check-list">
        {REAL_OR_EXAMPLE.map((item, i) => {
          const a = answers[i] ?? null;
          const answer = (value: 'real' | 'example') => setAnswers((all) => all.map((x, j) => (j === i ? value : x)));
          return (
            <li key={item.thing} className="check-item">
              <p>{item.thing}</p>
              {a === null ? (
                <div className="exercise-choices" role="group" aria-label={`${item.thing}: real data or example?`}>
                  <button type="button" className="btn" onClick={() => answer('real')}>
                    Real data
                  </button>
                  <button type="button" className="btn" onClick={() => answer('example')}>
                    Example
                  </button>
                </div>
              ) : (
                <p className="check-feedback" role="status" data-right={a === item.answer ? 'true' : 'false'}>
                  <strong>{a === item.answer ? 'Right.' : 'Not quite.'}</strong> {item.why}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answered === REAL_OR_EXAMPLE.length ? (
        <p className="exercise-score" role="status" data-control>
          You sorted {correct} of {REAL_OR_EXAMPLE.length} correctly. Whatever is marked Example is a drawing to teach the idea; everything else comes
          from this conversation.
        </p>
      ) : null}
    </div>
  );
}
