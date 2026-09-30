// Candidate models for the Phase 0 capability probe, in the cost order the plan tests them
// (docs/PLAN.md §3.1, decision D3). Prices and retirement dates are Reference values from
// OpenAI's docs as checked on PRICE_TABLE_DATE; re-verify before relying on them.

export const PRICE_TABLE_DATE = '2026-09-29';
export const PRICE_SOURCE = 'https://developers.openai.com/api/docs/pricing';
export const DEPRECATIONS_SOURCE = 'https://developers.openai.com/api/docs/deprecations';

export interface Price {
  /** USD per 1M input tokens (uncached). */
  input: number;
  /** USD per 1M cached input tokens. */
  cachedInput: number;
  /** USD per 1M cache-write tokens, when the model bills them separately. */
  cacheWrite?: number;
  /** USD per 1M output tokens. */
  output: number;
}

export interface Candidate {
  id: string;
  /**
   * `reasoning.effort` to send. `null` means a non-reasoning model, where the `reasoning`
   * parameter must be omitted entirely.
   */
  reasoningEffort: 'none' | null;
  price: Price;
  /** Documented shutdown date (YYYY-MM-DD), or null if none was listed on PRICE_TABLE_DATE. */
  shutdown: string | null;
  notes: string;
}

export const CANDIDATES: readonly Candidate[] = [
  {
    id: 'gpt-6-luna',
    reasoningEffort: 'none',
    price: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
    shutdown: null,
    notes: 'Cheapest current model. Logprob support at effort none is only implied by the docs; tokenizer unpublished.',
  },
  {
    id: 'gpt-4o-mini',
    reasoningEffort: null,
    price: { input: 0.15, cachedInput: 0.075, output: 0.6 },
    shutdown: null,
    notes: 'Non-reasoning. The Cookbook demonstrates logprobs with it; official o200k_base mapping.',
  },
  {
    id: 'gpt-5.4-nano',
    reasoningEffort: 'none',
    price: { input: 0.2, cachedInput: 0.02, output: 1.25 },
    shutdown: null,
    notes: 'Effort defaults to none. Logprobs documented for the GPT-5.4 family, not nano specifically.',
  },
  {
    id: 'gpt-4.1-mini',
    reasoningEffort: null,
    price: { input: 0.4, cachedInput: 0.1, output: 1.6 },
    shutdown: null,
    notes: 'Non-reasoning; 1M-token context.',
  },
];
