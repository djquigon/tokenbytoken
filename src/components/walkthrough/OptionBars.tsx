// The real options for one position (Recorded tokens, Calculated percentages). Each row is text first
// (token, percentage, "picked"), and the bar is decoration, so the chart reads as a list for screen readers
// (CLAUDE.md §8, "Charts have data tables").
//
// Rows: the top options; the picked one, even when it ranked lower; the rest of OpenAI's list added up;
// and the share left for every token OpenAI didn't list. Together they cover the whole 100%.

import { Datum } from '@/components/provenance/Datum';
import { Term } from '@/components/glossary/Term';
import { deriveAll } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import type { Alternative, OutputToken } from '@/trace/facts';

function Row({ alt, i, rank }: { alt: Alternative; i: number; rank?: OutputToken['chosenRank'] }) {
  return (
    <li className={rank ? 'option-row option-below' : 'option-row'} data-chosen={alt.isChosen ? 'true' : undefined} style={{ '--w': read(alt.pct) / 100, '--i': i } as React.CSSProperties}>
      <span className="option-token mono">
        <Datum of={alt.text} as="token" badge={false} />
      </span>
      <span className="option-bar" aria-hidden="true" />
      <span className="option-pct">
        <Datum of={alt.pct} as="pct" badge={false} />
      </span>
      {alt.isChosen ? (
        <span className="option-picked">
          picked
          {rank && read(rank) !== null ? (
            <span className="option-rank">
              {' '}
              · rank <Datum of={rank as never} as="int" badge={false} />
            </span>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

export function OptionBars({ token, shown, animate = true }: { token: OutputToken; shown: number; animate?: boolean }) {
  const alts = token.alternatives;
  const top = alts.slice(0, shown);
  const chosenAt = alts.findIndex((a) => a.isChosen);
  const chosenBelow = chosenAt >= shown ? alts[chosenAt] : undefined;
  const hidden = alts.filter((a, i) => i >= shown && i !== chosenAt);
  const hiddenSum = hidden.length > 0 ? deriveAll('sum', hidden.map((a) => a.pct), (pcts) => pcts.reduce((n, p) => n + p, 0)) : null;
  // Row positions, for the staggered reveal.
  const groupAt = top.length + (chosenBelow ? 1 : 0);
  const restAt = groupAt + (hiddenSum ? 1 : 0);
  return (
    <div className="option-bars" data-animate={animate ? 'true' : undefined}>
      <ol className="option-list" aria-label="The top options OpenAI returned, as percentages">
        {top.map((alt, k) => (
          <Row key={k} alt={alt} i={k} />
        ))}
        {chosenBelow ? <Row alt={chosenBelow} i={top.length} rank={token.chosenRank} /> : null}
        {hiddenSum ? (
          <li className="option-row option-group" style={{ '--w': read(hiddenSum) / 100, '--i': groupAt } as React.CSSProperties}>
            <span className="option-token">other listed options</span>
            <span className="option-bar" aria-hidden="true" />
            <span className="option-pct">
              <Datum of={hiddenSum} as="pct" badge={false} />
            </span>
          </li>
        ) : null}
        <li className="option-row option-remainder" style={{ '--w': read(token.remainderPct) / 100, '--i': restAt } as React.CSSProperties}>
          <span className="option-token">all other tokens</span>
          <span className="option-bar" aria-hidden="true" />
          <span className="option-pct">
            <Datum of={token.remainderPct} as="pct" badge={false} />
          </span>
        </li>
      </ol>
      <p className="option-legend">
        Chance of coming next, not chance of being true. Tokens: <span className="legend-word">Recorded</span> (reported by OpenAI).
        Percentages: <span className="legend-word">Calculated</span> from its <Term id="logprob">logprobs</Term>.
        {chosenAt >= 0 ? null : ' The chosen token was not among the options OpenAI listed.'}
      </p>
    </div>
  );
}
