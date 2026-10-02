// The glossary (docs/PLAN.md §2, "Progressive disclosure": define every term the first time it appears).
// Copy marks a term with term(id, text); the definition shows on hover, focus, or click. Definitions follow
// the same rules as the rest of the copy: plain verbs, no bare numbers, and claims for what they assert.
//
// Analogies (ADR 0011) give a familiar picture for the idea. They're shown as a second line, after the
// definition, and they must stay true to it: none may suggest that a model thinks, remembers, looks things
// up, or re-reads anything (CLAUDE.md §3).

import type { TermPart } from '@/shared/sourced-text';

import type { ClaimId } from './claims';

export interface GlossaryEntry {
  readonly term: string;
  readonly definition: string;
  /** A familiar picture of the idea, shown after the definition. */
  readonly analogy?: string;
  readonly claims: readonly ClaimId[];
}

export const GLOSSARY = {
  // The model and how it's made -----------------------------------------------------------------------
  'language-model': {
    term: 'Large language model (LLM)',
    definition: 'A neural network trained on huge amounts of text to predict the next token. A chatbot is an app built around one.',
    analogy: 'Like the word suggestions on a phone keyboard, scaled up enormously: it scores what is likely to come next, one piece at a time.',
    claims: ['C070', 'C017'],
  },
  'neural-network': {
    term: 'Neural network',
    definition: 'Many layers of simple calculations, whose numbers are learned from examples instead of being written by people.',
    analogy: 'Like a vast mixing desk covered in knobs: training turns every knob until what comes out is right.',
    claims: ['C089'],
  },
  parameters: {
    term: 'Learned parameters',
    definition: 'The numbers a model learned in training. They stay fixed while you use it: chatting doesn’t change them.',
    analogy: 'Like the settings of an enormous number of tiny dials, turned during training and then left alone.',
    claims: ['C028', 'C046'],
  },
  training: {
    term: 'Training',
    definition: 'How a model’s numbers get set: it practices predicting text, and after each try its numbers are nudged so the right answer becomes a little likelier. It all happens before you use the model.',
    analogy: 'Like practicing darts: throw, see how far off you were, adjust your aim slightly, and repeat an enormous number of times.',
    claims: ['C090', 'C046'],
  },
  pretraining: {
    term: 'Pretraining',
    definition: 'The first and biggest stage of training: predicting each next token across huge amounts of text. The text itself supplies the right answers.',
    claims: ['C091'],
  },
  'fine-tuning': {
    term: 'Fine-tuning',
    definition: 'More training after pretraining, on examples of good answers and on people’s ratings of replies, to make a model a helpful assistant.',
    claims: ['C091'],
  },
  rlhf: {
    term: 'Reinforcement learning from human feedback (RLHF)',
    definition: 'Fine-tuning that uses people’s rankings of a model’s replies, steering it toward the kind of answers people prefer.',
    analogy: 'Like a teacher marking practice answers, so the next attempts lean toward the better ones.',
    claims: ['C091'],
  },
  'gradient-descent': {
    term: 'Gradient descent',
    definition: 'Nudging each of a network’s numbers a little in the direction that lowers its error, over and over.',
    analogy: 'Like walking downhill in thick fog: you can’t see the bottom, but you can feel which way the ground slopes, so you take a small step that way, again and again.',
    claims: ['C090'],
  },
  backpropagation: {
    term: 'Backpropagation',
    definition: 'The method that works out, for every number in a network, which way to nudge it, by working backwards from the error through the layers.',
    analogy: 'Like tracing a bad batch back through a recipe, step by step, to find which amounts to adjust.',
    claims: ['C090'],
  },
  transformer: {
    term: 'Transformer',
    definition: 'The network design behind today’s large language models. It’s built around attention, which lets training run in parallel.',
    claims: ['C098'],
  },
  'mixture-of-experts': {
    term: 'Mixture of experts',
    definition: 'A design where a network’s layers are split into many parts, called experts, and each token passes through only a few of them.',
    analogy: 'Like a hospital with many specialists, where each patient sees only a few.',
    claims: ['C093'],
  },
  'open-weight': {
    term: 'Open-weight model',
    definition: 'A model whose learned numbers are published, so anyone can download it, run it, and look inside.',
    claims: ['C027', 'C093'],
  },
  'knowledge-cutoff': {
    term: 'Knowledge cutoff',
    definition: 'The date a model’s training text ends. It has no information about later events unless the app adds it to what it sends.',
    analogy: 'Like a snapshot taken on a certain day: anything that happened afterwards isn’t in it.',
    claims: ['C071'],
  },

  // Text and tokens -----------------------------------------------------------------------------------
  token: {
    term: 'Token',
    definition: 'A piece of text the model works with: often a whole common word with its leading space, sometimes part of a word, a single character, or a byte.',
    analogy: 'Like building blocks: a common word is usually one block, while a rare word is built from several.',
    claims: ['C022'],
  },
  tokenizer: {
    term: 'Tokenizer',
    definition: 'The program that splits text into tokens and gives each one its ID number. This app uses one believed to match the model’s own.',
    claims: ['C022', 'C023'],
  },
  vocabulary: {
    term: 'Vocabulary',
    definition: "The fixed list of every token a model can take in or write out. A token's ID is its position in the list.",
    analogy: 'Like a dictionary with numbered entries: the model works with the numbers, not the letters.',
    claims: ['C023'],
  },
  byte: {
    term: 'Byte',
    definition: 'The smallest unit computers store text in. A plain English letter takes one byte; an emoji, or a letter in many other alphabets, takes several.',
    claims: ['C022'],
  },
  instructions: {
    term: 'Instructions (system prompt)',
    definition: 'Text an app sends to the model ahead of your message, setting how it should behave. Many apps keep theirs hidden; this app shows its own.',
    analogy: 'Like a briefing handed over before the conversation starts.',
    claims: ['C018', 'C019'],
  },
  context: {
    term: 'Context',
    definition: 'Everything sent with a request: instructions, the conversation so far, and the new message. The model has no other memory of the chat.',
    analogy: 'Like handing an actor the whole script so far before every new line: all the model has to go on is what’s in the script.',
    claims: ['C018', 'C044'],
  },
  'context-limit': {
    term: 'Context limit',
    definition: "The most tokens a model accepts in one request. This app keeps well under it with a smaller budget of its own.",
    analogy: 'Like a page limit on what can be handed over at once.',
    claims: ['C045'],
  },

  // Inside the network --------------------------------------------------------------------------------
  embedding: {
    term: 'Embedding',
    definition: 'The list of numbers a token becomes inside the network, learned in training. Tokens used in similar ways get similar lists.',
    analogy: 'Like coordinates on a map, where words used in similar ways end up close together.',
    claims: ['C028', 'C096'],
  },
  position: {
    term: 'Position',
    definition: 'A token’s place in the text: first, second, third, and so on. The network works out a list of numbers for every position.',
    claims: ['C029', 'C032'],
  },
  'working-notes': {
    term: 'Working notes',
    definition: 'Values computed for this request from the learned parameters, then discarded.',
    analogy: 'Like scrap paper: used to work out this reply, then thrown away.',
    claims: ['C028'],
  },
  layer: {
    term: 'Layer',
    definition: 'One stage of the network. Every position passes up through the layers, one after another.',
    analogy: 'Like the stations of an assembly line: each one refines the numbers a little before passing them on.',
    claims: ['C029'],
  },
  attention: {
    term: 'Attention',
    definition: 'The step that lets each position draw on itself and earlier positions, never later ones.',
    analogy: 'For example, in “the cat sat down because it was tired”, attention is how the position for “it” can pull in information from “cat”.',
    claims: ['C030', 'C099'],
  },
  'feed-forward': {
    term: 'Feed-forward step',
    definition: 'A step in each layer that transforms each position’s numbers on its own, without drawing on any other position.',
    claims: ['C032'],
  },

  // Choosing the next token ----------------------------------------------------------------------------
  score: {
    term: 'Score',
    definition: 'What the network produces for every possible next token. The scores are turned into percentages.',
    analogy: 'Like a rating for every word in the dictionary, at every step: the higher the rating, the likelier that word comes next.',
    claims: ['C033'],
  },
  logprob: {
    term: 'Logprob',
    definition: 'How OpenAI reports a chance, on a logarithmic scale: zero means certain, and the more negative it is, the less likely. This app turns it back into a percentage.',
    analogy: 'Like the decibel scale for loudness: a compact way to write numbers that range from huge to tiny.',
    claims: ['C011'],
  },
  sampling: {
    term: 'Weighted random pick',
    definition: 'How one token is chosen from the options: at random, with likelier options picked more often. Also called sampling.',
    analogy: 'Like a raffle where each option holds tickets in proportion to its chance: the favorite usually wins, but not always.',
    claims: ['C036'],
  },
  temperature: {
    term: 'Temperature',
    definition: 'A setting for the pick. Lower makes the likeliest token likelier; higher spreads the chances out.',
    analogy: 'Like a dial between predictable and adventurous: turned down, the pick sticks to the favorites; turned up, it takes more chances.',
    claims: ['C038'],
  },
  'top-p': {
    term: 'top_p',
    definition: 'A setting that limits the pick to the likeliest options that together reach a share of the chances. At its highest value, every option stays in.',
    analogy: 'Like letting only the front-runners into the raffle.',
    claims: ['C037'],
  },
  'close-call': {
    term: 'Close call',
    definition: 'A step where the pick was under half the chances, or the top two options were close. It describes wording, not correctness.',
    analogy: 'Like a photo finish: several options were neck and neck, or an outsider came through.',
    claims: ['C012'],
  },
  'saved-work': {
    term: 'Saved work',
    definition: 'Results kept from earlier positions (often called the key-value cache), so each new token needs only one new position computed.',
    analogy: 'Like keeping notes on every earlier word, so they never have to be worked out again.',
    claims: ['C040'],
  },
  'end-marker': {
    term: 'End marker',
    definition: 'A special token that means “done”. When the model writes it, the reply ends.',
    analogy: 'Like writing “The End” at the bottom of a story.',
    claims: ['C015', 'C042'],
  },

  // Around the model ----------------------------------------------------------------------------------
  api: {
    term: 'API',
    definition: 'The way one program sends requests to another over the internet. This app sends your conversation to OpenAI’s API and gets the reply back.',
    analogy: 'Like a restaurant’s order window: requests go in, results come back out, and the kitchen stays out of sight.',
    claims: ['C001'],
  },
  streaming: {
    term: 'Streaming',
    definition: 'Sending a reply in pieces as it’s generated, so text appears while it’s still being written. A piece can carry more than one token.',
    claims: ['C050'],
  },
  moderation: {
    term: 'Moderation check',
    definition: "OpenAI's separate moderation model checks each new message before it's sent to the chat model.",
    analogy: 'Like a check at the door, before the message goes in.',
    claims: ['C006'],
  },
  tools: {
    term: 'Tools',
    definition: 'Extra abilities an app can give a model, such as web search or running code. The model can only ask for them; the app carries them out. This app offers none.',
    claims: ['C075', 'C021'],
  },
  agent: {
    term: 'AI agent',
    definition: 'A model connected to tools and allowed to take step after step toward a goal, such as browsing, running code, or sending messages.',
    claims: ['C075'],
  },

  // Research ideas ------------------------------------------------------------------------------------
  interpretability: {
    term: 'Interpretability',
    definition: 'Research into what happens inside a network: which internal parts track which concepts, and how they combine to produce an answer.',
    claims: ['C057', 'C058'],
  },
  alignment: {
    term: 'Alignment',
    definition: 'Making AI systems reliably do what people intend, including in situations their makers didn’t foresee.',
    claims: ['C079'],
  },
  'specification-gaming': {
    term: 'Specification gaming',
    definition: 'When a system meets the literal goal it was given in a way its makers didn’t intend. When a training reward is exploited like this, it’s also called reward hacking.',
    analogy: 'Like a student told to “fill two pages” who writes in giant letters.',
    claims: ['C076'],
  },
  diffusion: {
    term: 'Diffusion model',
    definition: 'A way to generate images and video: start from random noise and remove it step by step, guided by the prompt.',
    analogy: 'Like a photo slowly coming into focus out of TV static.',
    claims: ['C066'],
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;

/** Marks a glossary term in copy: st`Your message became ${term('token', 'tokens')}.` */
export const term = (id: GlossaryId, text: string): TermPart => ({ kind: 'term', id, text });
