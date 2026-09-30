// UTF-8 helpers. Alignment works on bytes (docs/PLAN.md §3.5) because tokens can end in the middle of a
// character, and JavaScript strings are UTF-16.

const encoder = new TextEncoder();

export const utf8 = (text: string): Uint8Array => encoder.encode(text);

export const utf8Length = (text: string): number => encoder.encode(text).length;

/** Decodes bytes that are known to be complete UTF-8. Throws on malformed input. */
export const decodeUtf8Strict = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);

/** Number of bytes in the UTF-8 sequence that starts with `lead`, or 0 for a continuation/invalid byte. */
export const sequenceLength = (lead: number): number => {
  if (lead < 0x80) return 1;
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0;
};

/** True when `offset` in `bytes` is the start of a character (or the end of the buffer). */
export const isCharBoundary = (bytes: Uint8Array, offset: number): boolean => {
  if (offset <= 0 || offset >= bytes.length) return true;
  const b = bytes[offset] ?? 0;
  return (b & 0xc0) !== 0x80;
};

/** Moves `offset` back to the start of the character that contains it. */
export const charStartAtOrBefore = (bytes: Uint8Array, offset: number): number => {
  let i = Math.max(0, Math.min(offset, bytes.length));
  while (i > 0 && !isCharBoundary(bytes, i)) i -= 1;
  return i;
};

/** Moves `offset` forward to the end of the character that contains it. */
export const charEndAtOrAfter = (bytes: Uint8Array, offset: number): number => {
  let i = Math.max(0, Math.min(offset, bytes.length));
  while (i < bytes.length && !isCharBoundary(bytes, i)) i += 1;
  return i;
};

export const bytesEqual = (a: Uint8Array, aStart: number, b: Uint8Array): boolean => {
  if (aStart < 0 || aStart + b.length > a.length) return false;
  for (let i = 0; i < b.length; i += 1) if (a[aStart + i] !== b[i]) return false;
  return true;
};
