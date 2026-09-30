// The label badge (CLAUDE.md L6): the label word is always visible text (or, in compact tables, an
// abbreviation plus the full word for screen readers), with a glyph and border style as further cues —
// never color alone (docs/PLAN.md §2, "Visual encoding").

import { BookIcon } from '@/components/ui/icons';
import { KIND_LABEL, WHAT_IF_LABEL, WHAT_IF_LINE, sourceLine, type Kind, type Prov } from '@/shared/provenance';

function Glyph({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'recorded':
      return <span aria-hidden="true">●</span>;
    case 'calculated':
      return <span aria-hidden="true">ƒ</span>;
    case 'reference':
      return <BookIcon />;
    case 'example':
      return <span aria-hidden="true">◌</span>;
  }
}

export function ProvBadge({ prov, whatIf = false, compact = false }: { prov: Prov; whatIf?: boolean; compact?: boolean }) {
  const line = sourceLine(prov);
  const label = KIND_LABEL[prov.kind];
  return (
    <span className="prov-badge" data-kind={prov.kind} title={whatIf ? `${label}, ${WHAT_IF_LABEL}: ${line}. ${WHAT_IF_LINE}.` : `${label}: ${line}`}>
      <Glyph kind={prov.kind} />
      {compact ? (
        <>
          <span aria-hidden="true">{label.slice(0, 3)}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {whatIf ? (
        <span className="prov-whatif">
          <span aria-hidden="true">?</span>
          <span className="sr-only">{WHAT_IF_LABEL}</span>
        </span>
      ) : null}
      <span className="sr-only">: {line}</span>
    </span>
  );
}

/** The label alone, for legends: its glyph and word, in the same style as a value's badge. */
export function LabelChip({ kind }: { kind: Kind }) {
  return (
    <span className="prov-badge" data-kind={kind}>
      <Glyph kind={kind} />
      <span>{KIND_LABEL[kind]}</span>
    </span>
  );
}
