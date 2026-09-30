// The glossary (docs/PLAN.md §2, "Progressive disclosure": define every term the first time it appears).
// Copy marks a term with term(id, text); the definition shows on hover, focus, or click. Definitions follow
// the same rules as the rest of the copy: plain verbs, no bare numbers, and claims for what they assert.

import type { TermPart } from '@/shared/sourced-text';

import type { ClaimId } from './claims';

export interface GlossaryEntry {
  readonly term: string;
  readonly definition: string;
  readonly claims: readonly ClaimId[];
}

export const GLOSSARY = {
  token: {
    term: 'Token',
    definition: 'A piece of text the model works with: often a whole common word with its leading space, sometimes part of a word, a single character, or a byte.',
    claims: ['C022'],
  },
  vocabulary: {
    term: 'Vocabulary',
    definition: "The fixed list of every token a model can read or write. A token's ID is its position in the list.",
    claims: ['C023'],
  },
  parameters: {
    term: 'Learned parameters',
    definition: 'The numbers a model learned in training. They stay fixed while you use it: chatting doesn’t change them.',
    claims: ['C028', 'C046'],
  },
  'working-notes': {
    term: 'Working notes',
    definition: 'Values computed for this request from the learned parameters, then discarded.',
    claims: ['C028'],
  },
  layer: {
    term: 'Layer',
    definition: 'One stage of the network. Every position passes up through the layers, one after another.',
    claims: ['C029'],
  },
  attention: {
    term: 'Attention',
    definition: 'The step that lets each position draw on itself and earlier positions, never later ones.',
    claims: ['C030'],
  },
  score: {
    term: 'Score',
    definition: 'What the network produces for every possible next token. The scores are turned into percentages.',
    claims: ['C033'],
  },
  logprob: {
    term: 'Logprob',
    definition: 'How OpenAI reports a score: the natural logarithm of the chance, with the chance written as a fraction rather than a percentage. This app turns it back into a percentage.',
    claims: ['C011'],
  },
  sampling: {
    term: 'Weighted random pick',
    definition: 'How one token is chosen from the options: at random, with likelier options picked more often. Also called sampling.',
    claims: ['C036'],
  },
  temperature: {
    term: 'Temperature',
    definition: 'A setting for the pick. Lower makes the likeliest token likelier; higher spreads the chances out.',
    claims: ['C038'],
  },
  'top-p': {
    term: 'top_p',
    definition: 'A setting that limits the pick to the likeliest options that together reach a share of the chances. At its highest value, every option stays in.',
    claims: ['C037'],
  },
  'saved-work': {
    term: 'Saved work',
    definition: 'Results kept from earlier positions (often called the key-value cache), so each new token needs only one new position computed.',
    claims: ['C040'],
  },
  'end-marker': {
    term: 'End marker',
    definition: 'A special token that means “done”. When the model writes it, the reply ends.',
    claims: ['C015', 'C042'],
  },
  moderation: {
    term: 'Moderation check',
    definition: "OpenAI's separate moderation model checks each new message before it's sent to the chat model.",
    claims: ['C006'],
  },
  context: {
    term: 'Context',
    definition: 'Everything sent with a request: instructions, the conversation so far, and the new message. The model has no other memory of the chat.',
    claims: ['C018', 'C044'],
  },
  'context-limit': {
    term: 'Context limit',
    definition: "The most tokens a model accepts in one request. This app keeps well under it with a smaller budget of its own.",
    claims: ['C045'],
  },
  'close-call': {
    term: 'Close call',
    definition: 'A step where the pick was under half the chances, or the top two options were close. It describes wording, not correctness.',
    claims: ['C012'],
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;

/** Marks a glossary term in copy: st`Your message became ${term('token', 'tokens')}.` */
export const term = (id: GlossaryId, text: string): TermPart => ({ kind: 'term', id, text });
