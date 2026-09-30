// The only way to show a labeled value (CLAUDE.md §3): the formatted value plus its label, as text.

import { sourceDetail, sourceLine, type Kind, type Sourced } from '@/shared/provenance';
import { provOf, read } from '@/shared/provenance/read';

import { formatValue, type Format, type FormatValues } from '@/shared/format';
import { WHITESPACE_SYMBOL_RUNS } from '@/shared/token-display';
import { ProvBadge } from './ProvBadge';

interface DatumProps<F extends Format> {
  readonly of: Sourced<FormatValues[F], Kind>;
  readonly as: F;
  /** Estimates get "≈" (language guide: "≈" only for estimates). */
  readonly approx?: boolean;
  /** Short badge, for tables. The full label stays available to screen readers. */
  readonly compact?: boolean;
  /** Hide the badge when the surrounding row already shows the label in its own column. */
  readonly badge?: boolean;
  readonly block?: boolean;
}

/** Whitespace symbols (␣ ↵) are dimmed so they read as markers, not as characters of the token. */
function TokenGlyphs({ text }: { text: string }) {
  return (
    <>
      {text.split(WHITESPACE_SYMBOL_RUNS).map((run, i) =>
        i % 2 === 1 ? (
          <span key={i} className="ws">
            {run}
          </span>
        ) : (
          run
        ),
      )}
    </>
  );
}

export function Datum<F extends Format>({ of, as, approx = false, compact = false, badge = true, block = false }: DatumProps<F>) {
  const p = provOf(of);
  const text = formatValue(as, read(of));
  const Tag = block ? 'div' : 'span';
  return (
    // data-source and data-detail feed "Is this real?" / "How do we know this?" (WhereFrom), which lists
    // exactly the values a step shows.
    <Tag className="datum" data-kind={p.kind} data-whatif={of.whatIf ? 'true' : undefined} data-source={sourceLine(p)} data-detail={sourceDetail(p)}>
      {block ? (
        // Focusable so keyboard users can scroll a long block (it has a max height).
        <pre className="datum-block" dir="auto" tabIndex={0}>
          {text}
        </pre>
      ) : (
        <span className="datum-value" dir="auto">
          {approx ? '≈ ' : ''}
          {as === 'token' ? <TokenGlyphs text={text} /> : text}
        </span>
      )}
      {badge ? <ProvBadge prov={p} whatIf={of.whatIf === true} compact={compact} /> : null}
    </Tag>
  );
}
