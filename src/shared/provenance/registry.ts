// Closed registries of calculation methods and example rules (docs/PLAN.md §3.5). A typo in a method
// or rule ID is a compile error, and every badge popover has copy to show.

export interface MethodSpec {
  /** Short name shown in the "How do we know this?" table. */
  readonly label: string;
  /** One sentence on how the value is computed. */
  readonly detail: string;
}

export const METHODS = {
  'text-join': {
    label: 'Joined reply text',
    detail: 'The text of every streamed piece, joined in the order it arrived.',
  },
  'text-hash-check': {
    label: 'Relay check',
    detail: "Compares a hash of the text this browser received with the hash the server sent for the text it relayed.",
  },
  alignment: {
    label: 'Tokens matched to the text',
    detail: "Places each token OpenAI returned on the reply text by comparing UTF-8 bytes.",
  },
  'pct-from-logprob': {
    label: 'Percentage from a logprob',
    detail: 'e raised to the logprob, times 100.',
  },
  remainder: {
    label: 'Share not covered by the returned options',
    detail: '100% minus the sum of the returned options.',
  },
  sum: {
    label: 'Sum of listed options',
    detail: 'The percentages of the returned options not drawn as their own rows, added up.',
  },
  'letter-count': {
    label: 'Letters counted',
    detail: 'How many times the letter appears in the word from the question, counted by this app.',
  },
  'temperature-what-if': {
    label: 'Chances at another temperature',
    detail:
      'e raised to (logprob ÷ temperature) for each listed option, divided by their total. Among the listed options only, and valid because this model’s logprobs are raw scores (measured 2026-09-30).',
  },
  rank: {
    label: 'Position among the returned options',
    detail: 'Where the chosen token appears in the list of alternatives OpenAI returned, ordered by logprob.',
  },
  'close-call': {
    label: 'Close call',
    detail: 'The chosen option scored under 50%, or the top two options were within 15 percentage points.',
  },
  'local-token-count': {
    label: 'Counted with this app’s tokenizer',
    detail: 'Split with the o200k_base tokenizer (the gpt-tokenizer package), assumed to match this model.',
  },
  'token-id-lookup': {
    label: 'Token ID lookup',
    detail: 'Looks up the token text in the o200k_base vocabulary, assumed to match this model. The API returns text, not IDs.',
  },
  'input-estimate': {
    label: 'Estimated input tokens',
    detail: 'This app’s token count plus a fixed per-message allowance measured for this model on 2026-09-30.',
  },
  count: {
    label: 'Counted by this app',
    detail: 'The number of items this app recorded.',
  },
  difference: {
    label: 'Difference',
    detail: 'One recorded count minus another.',
  },
  duration: {
    label: 'Time between two moments',
    detail: 'The difference between two timestamps from the same clock.',
  },
  'delivery-rate': {
    label: 'Delivery rate',
    detail: 'Tokens received divided by the time between the first and last piece, as this app saw them.',
  },
  'outcome-from-log': {
    label: 'How the reply ended',
    detail: 'Read from the events this app recorded. A missing final event means the reply was interrupted.',
  },
  'end-marker-inferred': {
    label: 'End marker (inferred)',
    detail: 'OpenAI reported "completed" and this app set no stop sequences, so the model generated its end marker.',
  },
  'reasoning-gate': {
    label: 'Hidden-reasoning check',
    detail: 'OpenAI reported 0 reasoning tokens, so every generated token (apart from its fixed extras) is in the visible reply.',
  },
  'cost-from-usage': {
    label: 'Cost from usage',
    detail: 'The token counts OpenAI reported, multiplied by the dated price table.',
  },
  round: {
    label: 'Rounded',
    detail: 'Rounded for readability; the exact value is in the data view.',
  },
  'cost-estimate': {
    label: 'Estimated cost',
    detail: 'OpenAI reported no usage for this reply, so this app estimates it from what was sent and relayed.',
  },
} as const satisfies Record<string, MethodSpec>;

export type MethodId = keyof typeof METHODS;

export interface RuleSpec {
  readonly label: string;
  /** Always shown with the value, so the example can't be mistaken for measured data. */
  readonly disclaimer: string;
}

export const RULES = {
  derived: {
    label: 'Computed from an example',
    disclaimer: 'Built from example values, so it is an example too.',
  },
  'attention-previous-token': {
    label: 'Rule-based pattern: previous token',
    disclaimer: "Each position draws on itself and the token before it. A teaching pattern, not this model's attention.",
  },
  'embedding-vector': {
    label: 'Example vector',
    disclaimer: "Stands for the list of numbers a model looks up for each token. Not this model's values, and none are shown.",
  },
  'layer-stack': {
    label: 'Example layer stack',
    disclaimer: "Models like this have many layers. The number drawn here isn't this model's; OpenAI hasn't published it.",
  },
  'sample-sentence': {
    label: 'Neutral sample sentence',
    disclaimer: 'Used to introduce a pattern before showing it on your text.',
  },
  'vocab-scores': {
    label: 'Example score strip',
    disclaimer: 'Stands for a score for every entry in the vocabulary. The heights are made up; only the listed options are real.',
  },
  'sampler-draw': {
    label: 'Example draw',
    disclaimer: "The random draw itself can't be observed. This shows a draw landing on the token the model actually produced.",
  },
  'saved-work': {
    label: 'Example of saved work',
    disclaimer: "Stands for values computed for earlier positions and reused (the key-value cache). Not this model's values.",
  },
  'role-markers': {
    label: 'Example layout',
    disclaimer: "Roughly how messages are laid out for a model. Not OpenAI's format, which it hasn't published.",
  },
  'context-gauge': {
    label: 'Not to scale',
    disclaimer: 'The bar lengths are schematic; the numbers beside them are the real values.',
  },
} as const satisfies Record<string, RuleSpec>;

export type RuleId = keyof typeof RULES;
