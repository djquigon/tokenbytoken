// The temperature What-if (docs/PLAN.md §2, Ch5): the chances each listed option would have at another
// temperature, computed on this page from the logprobs OpenAI returned. The model isn't asked again.
//
// Valid only because this model's logprobs are raw scores, unaffected by the temperature sent (Phase 0,
// ADR 0001), and only among the listed options: how the unlisted tokens would share out at another
// temperature isn't known, so every chance here is "among the listed options".

import { derive, deriveAll, type Sourced } from '@/shared/provenance';
import type { OutputToken } from '@/trace/facts';

/** The slider's range. Above about 1.2 the unlisted tokens' unknown share would dominate (docs/PLAN.md). */
export const TEMPERATURE_WHAT_IF = { min: 0, max: 1.2, step: 0.1 } as const;

export interface WhatIfRow {
  readonly text: Sourced<string, 'recorded'>;
  readonly isChosen: boolean;
  /** Chance among the listed options at the temperature this app sent. */
  readonly sent: Sourced<number, 'calculated'>;
  /** Chance among the listed options at the what-if temperature; null at temperature 0 (always the top). */
  readonly whatIf: Sourced<number, 'calculated'> | null;
}

/** Chances in percent among the listed options, with scores divided by the temperature (softmax). */
export function chancesAt(logprobs: readonly number[], temperature: number): number[] {
  if (logprobs.length === 0) return [];
  const scaled = logprobs.map((l) => l / temperature);
  const top = Math.max(...scaled);
  const weights = scaled.map((s) => Math.exp(s - top));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * 100);
}

export function temperatureWhatIf(token: OutputToken, sentTemperature: number, temperature: number, shown: number): WhatIfRow[] {
  const alts = token.alternatives;
  const logprobs = alts.map((a) => a.logprob);
  const at = (t: number) =>
    deriveAll('temperature-what-if', logprobs, (ls) => chancesAt(ls, t), t === sentTemperature ? {} : { whatIf: true });
  const sent = at(sentTemperature);
  const what = temperature > 0 ? at(temperature) : null;
  return alts.slice(0, shown).map((alt, i) => ({
    text: alt.text,
    isChosen: alt.isChosen,
    sent: derive('temperature-what-if', [sent], (xs) => xs[i] ?? 0),
    whatIf: what ? derive('temperature-what-if', [what], (xs) => xs[i] ?? 0, { whatIf: true }) : null,
  }));
}
