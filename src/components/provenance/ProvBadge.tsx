// The label badge (CLAUDE.md L6): the label word is always visible text, with a glyph and border style
// as further cues, never color alone.

import { KIND_LABEL, WHAT_IF_LABEL, WHAT_IF_LINE, sourceLine, type Kind, type Prov } from '@/shared/provenance';

const GLYPH: Record<Kind, string> = {
  recorded: '●',
  calculated: 'ƒ',
  reference: '§',
  example: '◌',
};

export function ProvBadge({ prov, whatIf = false, compact = false }: { prov: Prov; whatIf?: boolean; compact?: boolean }) {
  const line = sourceLine(prov);
  const label = KIND_LABEL[prov.kind];
  return (
    <span className="prov-badge" data-kind={prov.kind} title={whatIf ? `${label}, ${WHAT_IF_LABEL}: ${line}. ${WHAT_IF_LINE}.` : `${label}: ${line}`}>
      <span aria-hidden="true">{GLYPH[prov.kind]}</span>
      <span className={compact ? 'sr-only' : undefined}>{label}</span>
      {compact ? <span aria-hidden="true">{label.slice(0, 3)}</span> : null}
      {whatIf ? <span className="prov-whatif">? {WHAT_IF_LABEL}</span> : null}
      <span className="sr-only">: {line}</span>
    </span>
  );
}
