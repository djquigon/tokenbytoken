// Renders SourcedText: words as text, values through <Datum> with their labels.

import { Datum } from '@/components/provenance/Datum';
import type { SourcedText, Slot } from '@/shared/sourced-text';

function SlotView({ slot }: { slot: Slot }) {
  // The union keeps `as` and the value type paired; Datum re-checks it.
  return <Datum of={slot.d as never} as={slot.as} approx={slot.approx} compact />;
}

export function RichText({ text }: { text: SourcedText }) {
  return (
    <>
      {text.map((part, i) => (typeof part === 'string' ? <span key={i}>{part}</span> : <SlotView key={i} slot={part} />))}
    </>
  );
}
