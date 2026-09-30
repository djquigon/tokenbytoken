// The only way to show a labeled value (CLAUDE.md §3): the formatted value plus its label, as text.

import type { Kind, Sourced } from '@/shared/provenance';
import { provOf, read } from '@/shared/provenance/read';

import { formatValue, type Format, type FormatValues } from './format';
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

export function Datum<F extends Format>({ of, as, approx = false, compact = false, badge = true, block = false }: DatumProps<F>) {
  const p = provOf(of);
  const text = formatValue(as, read(of));
  const Tag = block ? 'div' : 'span';
  return (
    <Tag className="datum" data-kind={p.kind} data-whatif={of.whatIf ? 'true' : undefined}>
      {block ? (
        <pre className="datum-block" dir="auto">
          {text}
        </pre>
      ) : (
        <span className="datum-value" dir="auto">
          {approx ? '≈ ' : ''}
          {text}
        </span>
      )}
      {badge ? <ProvBadge prov={p} whatIf={of.whatIf === true} compact={compact} /> : null}
    </Tag>
  );
}
