// Branded units. Mixing clocks is a type error (CLAUDE.md A6): a measured ServerMs can never be fed
// into playback pacing, and micro-dollars can't be confused with token counts.

declare const unit: unique symbol;
type Unit<Name extends string> = number & { readonly [unit]: Name };

/** Milliseconds since the server began handling one chat request (monotonic, server clock). */
export type ServerMs = Unit<'ServerMs'>;
/** High-resolution epoch milliseconds in the browser (`performance.timeOrigin + performance.now()`). */
export type ClientMs = Unit<'ClientMs'>;
/** Milliseconds on the walkthrough's own playback timeline. Never derived from measured time. */
export type PlaybackMs = Unit<'PlaybackMs'>;
/** Integer millionths of a US dollar. */
export type MicroUsd = Unit<'MicroUsd'>;

export const serverMs = (n: number) => n as ServerMs;
export const clientMs = (n: number) => n as ClientMs;
export const playbackMs = (n: number) => n as PlaybackMs;
export const microUsd = (n: number) => {
  if (!Number.isSafeInteger(n)) throw new RangeError(`micro-dollar amounts must be safe integers, got ${n}`);
  return n as MicroUsd;
};
