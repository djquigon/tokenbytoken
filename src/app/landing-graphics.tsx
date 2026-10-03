// The landing page's graphics, drawn from the recorded sample (./landing-data.ts). Every value goes through
// <Datum>, and each graphic's legend names the labels of the values in it, as the walkthrough's option
// charts do. Server components: nothing here runs in the browser.

import { Datum } from '@/components/provenance/Datum';
import { Term } from '@/components/glossary/Term';
import { LabelChip } from '@/components/provenance/ProvBadge';
import type { Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import { spokenTokenText } from '@/shared/token-display';
import type { Alternative, InputRunFacts } from '@/trace/facts';

import type { Moment } from './landing-data';

interface ChipToken {
  readonly text: Sourced<string>;
  readonly id?: Sourced<number> | null;
}

/** Token chips as a list: whitespace shows as symbols and is spoken as words. `next` adds the empty slot. */
export function TokenChips({ tokens, label, ids = false, next = false }: { tokens: readonly ChipToken[]; label: string; ids?: boolean; next?: boolean }) {
  return (
    <ol className="chip-row" aria-label={label}>
      {tokens.map((t, i) => (
        <li key={i} className="token-chip" data-kind={t.text.p.kind}>
          <span className="token-text" aria-hidden="true">
            <Datum of={t.text} as="token" badge={false} />
          </span>
          <span className="sr-only">{spokenTokenText(read(t.text))}</span>
          {ids && t.id ? (
            <span className="token-id">
              <Datum of={t.id} as="id" badge={false} />
            </span>
          ) : null}
        </li>
      ))}
      {/* The position being predicted: a cursor, not a token. */}
      {next ? <li className="token-next" aria-hidden="true" /> : null}
    </ol>
  );
}

/** A position's top options: token, bar, percentage, and "picked" (the bar is decoration). */
export function OptionRows({ options, label }: { options: readonly Alternative[]; label: string }) {
  return (
    <ol className="option-list" aria-label={label}>
      {options.map((a, i) => (
        <li key={i} className="option-row" data-chosen={a.isChosen ? 'true' : undefined} style={{ '--w': read(a.pct) / 100 } as React.CSSProperties}>
          <span className="option-token mono">
            <Datum of={a.text} as="token" badge={false} />
          </span>
          <span className="option-bar" aria-hidden="true" />
          <span className="option-pct">
            <Datum of={a.pct} as="pct" badge={false} />
          </span>
          {a.isChosen ? <span className="option-picked">picked</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** Tokens reported by OpenAI, percentages calculated from its logprobs. */
export function OptionsLegend() {
  return (
    <>
      <span>Chance this piece comes next, not chance it is true.</span>
      <span>
        <LabelChip kind="recorded" /> tokens, reported by OpenAI
      </span>
      <span>
        <LabelChip kind="calculated" /> percentages, from its <Term id="logprob">logprobs</Term>
      </span>
    </>
  );
}

/**
 * The hero: the reply so far, then curves fanning out to the real options for the next token. The curves
 * only say "one of these comes next": they are the same for every option and never stand for attention.
 */
export function NextTokenFigure({
  moment,
  recordedAt,
  recordedModel,
}: {
  moment: Moment;
  recordedAt: Sourced<number> | null;
  recordedModel: Sourced<string> | null;
}) {
  const options = moment.token.alternatives.slice(0, 4);
  const mid = options.length * 50;
  return (
    <figure className="next-token" aria-labelledby="next-token-title">
      <p className="section-title" id="next-token-title">
        The options for the next token
      </p>
      <div className="next-token-body">
        <div className="next-token-context">
          <TokenChips tokens={moment.before.map((t) => ({ text: t.text }))} label="The reply so far, as tokens" next />
        </div>
        <div className="next-token-fan" aria-hidden="true">
          <svg viewBox={`0 0 40 ${options.length * 100}`} preserveAspectRatio="none" focusable="false">
            {options.map((a, i) => {
              const y = i * 100 + 50;
              return <path key={i} d={`M0 ${mid} C24 ${mid} 16 ${y} 40 ${y}`} data-chosen={a.isChosen ? 'true' : undefined} />;
            })}
          </svg>
        </div>
        <OptionRows options={options} label="The top options OpenAI returned for the next token, as percentages" />
      </div>
      <figcaption className="figure-legend">
        <OptionsLegend />
        {recordedAt && recordedModel ? (
          <span className="figure-source">
            From the sample conversation, recorded <Datum of={recordedAt} as="date" compact /> with <Datum of={recordedModel} as="text" compact />
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** A smaller moment for a feature card: the text so far with its slot, then the options. */
export function MomentRows({ moment, shown = 4 }: { moment: Moment; shown?: number }) {
  return (
    <div className="moment-rows">
      <TokenChips tokens={moment.before.map((t) => ({ text: t.text }))} label="The reply so far, as tokens" next />
      <OptionRows options={moment.token.alternatives.slice(0, shown)} label="The top options OpenAI returned, as percentages" />
    </div>
  );
}

const ROLE_NAME = { instructions: 'Instructions', user: 'You', assistant: 'Assistant' } as const;

/** Everything one request carried, oldest first: who wrote each part, its text, and its token count. */
export function ContextRows({ runs, label }: { runs: readonly InputRunFacts[]; label: string }) {
  return (
    <ol className="context-rows" aria-label={label}>
      {runs.map((r) => (
        <li key={r.key} className="context-row" data-role={r.role}>
          <span className="context-role">{ROLE_NAME[r.role]}</span>
          <span className="context-row-text clamp-1">
            <Datum of={r.text} as="text" badge={false} />
          </span>
          <span className="context-row-count">
            <Datum of={r.count} as="int" badge={false} /> tokens
          </span>
        </li>
      ))}
    </ol>
  );
}
