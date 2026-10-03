// Walkthrough copy (CLAUDE.md §3 and §7). Every step's words live here, with the claims they rest on.
// Rules this file follows, and the content lint checks:
// - Simple text is about 40 words at most per step.
// - Every number, token, and quoted text is a labeled slot, never a bare string.
// - Plain verbs for the model: predicts, computes, scores, generates, writes. Never thinks, knows,
//   understands, wants, decides, remembers, or re-reads.
// - "This app", "the model", and "OpenAI" are kept distinct.
// - Plain first (ADR 0011): a familiar picture where it helps, and a glossary term the first time a
//   technical word appears in a step. Analogies stay true to the mechanism; details go to Detailed depth.

import type { Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import { slot, st, type SourcedText } from '@/shared/sourced-text';

import { term } from './glossary';
import type { StopReason } from '@/trace/facts';

import type { PickKind } from '@/stages/common';
import type { SceneCopy } from '@/stages/contract';

const none: SourcedText = [];

/** A pick and how it compared with the other options (see comparePick), for wording that matches the numbers. */
export interface PickCopy {
  readonly chosen: Sourced<string>;
  readonly pct: Sourced<number>;
  readonly kind: PickKind;
  readonly other: { readonly text: Sourced<string>; readonly pct: Sourced<number> } | null;
}

function pickSentence(p: PickCopy, lead: 'Here' | 'Later,'): SourcedText {
  const picked = st`${slot('token', p.chosen)} was picked at ${slot('pct', p.pct)}`;
  const other = p.other ? st`, while ${slot('token', p.other.text)} had ${slot('pct', p.other.pct)}` : none;
  switch (p.kind) {
    case 'not_top':
      return p.other ? [...st`${lead} the pick wasn't the top option: `, ...picked, ...other, '.'] : [...st`${lead} the pick wasn't among the listed options: `, ...picked, '.'];
    case 'close':
      return [...st`${lead} two options were close: `, ...picked, ...other, '.'];
    case 'no_majority':
      return [...st`${lead} no option had a majority: `, ...picked, '.'];
    case 'clear':
      return [...st`${lead} `, ...picked, '.'];
  }
}

// Chapter 0 · Hook ------------------------------------------------------------------------------------

export const hook = (v: { tokens: Sourced<number>; pick: PickCopy; closeCall: boolean; gaps: boolean }): SceneCopy => ({
  title: v.closeCall ? st`A close call in your reply` : st`A token in your reply`,
  body: v.gaps
    ? [...st`OpenAI returned alternatives for ${slot('int', v.tokens)} ${term('token', 'tokens')}, but not for all the text. `, ...pickSentence(v.pick, 'Here')]
    : v.closeCall
    ? [...st`Your reply came back as ${slot('int', v.tokens)} ${term('token', 'tokens')}, written one at a time, with ${term('score', 'scored options')} at every step. `, ...pickSentence(v.pick, 'Here')]
    : st`Your reply came back as ${slot('int', v.tokens)} ${term('token', 'tokens')}, written one at a time, with ${term('score', 'scored options')} at every step. Its first step: ${slot('token', v.pick.chosen)} was picked at ${slot('pct', v.pick.pct)}.`,
  detail: st`At every step ${term('language-model', 'the model')} scored many possible next tokens. A ${term('close-call', 'close call')} means several wordings were likely, or a less likely one was picked. It doesn't mean the answer is uncertain or wrong.`,
  claims: ['C017', 'C012', 'C011', 'C016'],
});

// Chapter 1 · What gets sent -------------------------------------------------------------------------

export const contextCards = (v: { earlier: Sourced<number> | null }): SceneCopy => ({
  title: st`What gets sent`,
  body: v.earlier
    ? st`Before anything is generated, this app assembles one ${term('context', 'input')}: its ${term('instructions', 'instructions')}, the ${slot('int', v.earlier)} earlier messages it re-sends, and your new message. It's like handing over the whole script so far before each new line.`
    : st`Before anything is generated, this app assembles one ${term('context', 'input')}: its own ${term('instructions', 'instructions')} and your message. Think of it as a script handed over in full: anything not in it, the model doesn't get.`,
  detail: st`Apps can add instructions you don't see. This app shows its own, word for word.`,
  claims: ['C018', 'C019', 'C044'],
});

export const contextLayout = (): SceneCopy => ({
  title: st`One input, marked by who wrote it`,
  body: st`The pieces are joined into one input, each marked with who wrote it, like the speaker names in a play script. This layout is only an example.`,
  detail: st`OpenAI uses its own format, which it hasn't published, and adds hidden content of its own.`,
  claims: ['C020'],
});

export const contextExtras = (): SceneCopy => ({
  title: st`What else went with it`,
  body: st`OpenAI's ${term('moderation', 'moderation model')} checked your message first. This app offered no ${term('tools', 'tools')} or search, and the reply contains no tool calls, so nothing was looked up along the way.`,
  detail: st`Open "View the full request" to see every field this app sent, including its settings, store: false (don't keep the reply), and a hashed ID in place of anything about you.`,
  claims: ['C006', 'C021'],
});

// Chapter 2 · Text becomes tokens --------------------------------------------------------------------

export const tokenizeChips = (v: { count: Sourced<number> }): SceneCopy => ({
  title: st`Text becomes tokens`,
  body: st`The model works on ${term('token', 'tokens')}, not letters. Your message became ${slot('int', v.count)} tokens: whole words, pieces of words, or single characters. Think of them as building blocks: a common word is one block, a rare word several.`,
  detail: st`A token is often a whole common word with its leading space. This split comes from this app's ${term('tokenizer', 'tokenizer')}, assumed to match this model; OpenAI's own processing may differ.`,
  claims: ['C022', 'C023'],
});

export const tokenizeIds = (): SceneCopy => ({
  title: st`Each token is a number`,
  body: st`Each token is an entry in a ${term('vocabulary', 'fixed vocabulary')}, a bit like a numbered dictionary, so the model receives numbers like these. AI services count tokens, not words: a model takes in ${term('context-limit', 'only so many at once')}, replies are capped, and requests are priced by the token.`,
  detail: st`These IDs come from the tokenizer this app assumes. The API returns token text, never IDs.`,
  claims: ['C023', 'C024'],
});

export type Callout =
  | { readonly kind: 'leading_space'; readonly token: Sourced<string> }
  | { readonly kind: 'split_word'; readonly word: Sourced<string>; readonly pieces: Sourced<number> }
  | { readonly kind: 'multi_token_char'; readonly char: Sourced<string>; readonly pieces: Sourced<number> };

export function tokenizeCallouts(callouts: readonly Callout[]): SceneCopy {
  const sentences = callouts.map((c): SourcedText => {
    switch (c.kind) {
      case 'leading_space':
        return st`${slot('token', c.token)} is one token, space included.`;
      case 'split_word':
        return st`${slot('text', c.word)} takes ${slot('int', c.pieces)} tokens.`;
      case 'multi_token_char':
        return st`${slot('text', c.char)} takes ${slot('int', c.pieces)} tokens on its own.`;
    }
  });
  return {
    title: st`Whole words and pieces`,
    body: [...st`Common words are often a single token; rarer ones are split into pieces, sometimes down to single ${term('byte', 'bytes')}. `, ...sentences.flatMap((s) => [...s, ' '])],
    detail: st`Seeing tokens instead of letters is one reason models can miscount the letters in a word.`,
    claims: ['C022', 'C026'],
  };
}

export const tokenizeCount = (v: { local: Sourced<number>; reported: Sourced<number> | null }): SceneCopy => {
  const estimate = st`This app estimated ${slot('int', v.local, true)} tokens for what it sent, including a guess at the formatting OpenAI adds, which it hasn't published.`;
  const diff = v.reported ? read(v.reported) - read(v.local) : 0;
  return {
    title: st`Counting tokens`,
    body: !v.reported
      ? [...estimate, ...st` OpenAI reported no count for this reply.`]
      : diff === 0
        ? [...estimate, ...st` OpenAI counted ${slot('int', v.reported)}, the same.`]
        : [...estimate, ...st` OpenAI counted ${slot('int', v.reported)}.`],
    claims: ['C025'],
  };
};

// "Contains examples" banner (network to loop chapters) --------------------------------------------------------------------------------

export const EXAMPLE_BANNER: SourcedText = st`The network, options, and pick steps repeat for every new token, for that token only, reusing ${term('saved-work', 'saved work')}. OpenAI hasn't published the design of the model answering you (it has for its ${term('open-weight', 'open-weight')} gpt-oss models), so drawings of the network are example views of models like it.`;
export const EXAMPLE_BANNER_CLAIMS = ['C027'] as const;

// Chapter 3 · Inside the network (examples) ----------------------------------------------------------

export const networkLookup = (): SceneCopy => ({
  title: st`Each token becomes a list of numbers`,
  body: st`Each ${term('token', 'token')} selects an ${term('embedding', 'embedding')}: a list of ${term('parameters', 'numbers learned during training')}. Tokens used in similar ways have similar lists, like nearby places on a map. The learned numbers stay fixed while you chat.`,
  detail: st`The learned numbers stay fixed while in use: chatting doesn't change them.`,
  claims: ['C028', 'C046', 'C096'],
});

export const networkLayers = (): SceneCopy => ({
  title: st`Up through many layers`,
  body: st`The model uses those lists to compute temporary ${term('working-notes', 'working notes')}, which it discards afterwards. The notes pass through ${term('layer', 'layers')}, like stations on an assembly line. All ${term('position', 'positions')} in your message are processed together, layer by layer.`,
  detail: st`OpenAI hasn't published how many layers this model has. Between attention steps, ${term('feed-forward', 'feed-forward steps')} transform each position on its own.`,
  claims: ['C028', 'C029', 'C027', 'C032'],
});

export const networkAttentionSample = (): SceneCopy => ({
  title: st`Attention: drawing on earlier text`,
  body: st`${term('attention', 'Attention')} lets each position draw on itself and earlier positions, never later ones. That's how a word like “it” can pull in information from the word it refers to. The drawing shows an example of how that can look.`,
  detail: st`Word order is encoded too. In many modern models, position is applied inside attention.`,
  claims: ['C030', 'C032', 'C099'],
});

/** What each example attention pattern shows, beside its drawing. */
export const ATTENTION_PATTERN_NOTES = {
  'attention-previous-token': 'Each position draws on itself and the token before it.',
  'attention-duplicate-token': 'Each position draws on earlier copies of the same token.',
  'attention-induction': 'At a repeated token, a position draws on the token that followed its earlier copy, which helps continue a pattern seen before.',
} as const;
export const ATTENTION_PATTERN_CLAIMS = { 'attention-previous-token': ['C030', 'C031'], 'attention-duplicate-token': ['C052', 'C031'], 'attention-induction': ['C053', 'C031'] } as const;

export const networkPosition = (): SceneCopy => ({
  title: st`Where each token sits`,
  body: st`The same token at two ${term('position', 'positions')} starts out as the same list of numbers. Position is added so attention can tell them apart, a bit like seat numbers in a theater.`,
  detail: st`In many modern models, position is applied inside attention rather than added at the start.`,
  claims: ['C032'],
});

export const networkFeedForward = (): SceneCopy => ({
  title: st`Each position on its own`,
  body: st`Between attention steps, a ${term('feed-forward', 'feed-forward step')} transforms each position on its own. Nothing passes between positions here: each one is worked on separately.`,
  claims: ['C032'],
});

export const networkAttentionYours = (): SceneCopy => ({
  title: st`The same example on your tokens`,
  body: st`The same example pattern on your tokens. It's a teaching pattern, not this model's attention, which the API doesn't expose.`,
  claims: ['C031'],
});

// Chapter 4 · The options ----------------------------------------------------------------------------

/** When OpenAI returned no alternatives for any of the reply (CLAUDE.md A2): say so, and never fill them in. */
export const optionsUnavailable = (): SceneCopy => ({
  title: st`No options to show for this reply`,
  body: st`OpenAI returned no alternatives for this reply's text, so there are no real options to show, and this app never makes them up. The sample conversation shows them.`,
  claims: ['C016'],
});

export const optionsStrip = (v: { vocabulary: Sourced<number> | null }): SceneCopy => ({
  title: st`A score for every possible token`,
  body: st`At the last position, the network ${term('score', 'scores')} every possible next token, like a rating for every word in a dictionary. The scores become percentages that together cover every possible token.`,
  detail: v.vocabulary ? st`That's every entry in the vocabulary: ${slot('int', v.vocabulary, true)} in the tokenizer this app assumes.` : undefined,
  claims: ['C033'],
});

export const optionsBars = (v: { chosen: Sourced<string>; pct: Sourced<number>; listed: Sourced<number> }): SceneCopy => ({
  title: st`The real options for this token`,
  body: st`These are the real top options OpenAI returned for this ${term('token', 'token')}. ${slot('token', v.chosen)} was picked, at ${slot('pct', v.pct)}.`,
  detail: st`OpenAI returned ${slot('int', v.listed)} alternatives here, each with a ${term('logprob', 'logprob')}; every other token shares the rest.`,
  claims: ['C034', 'C011'],
});

export const optionsMeaning = (): SceneCopy => ({
  title: st`Likely isn't the same as true`,
  body: st`A high percentage means that wording was likely to come next. It doesn't mean it's true: like a phone's word suggestions, the model scores what usually follows, not what's correct.`,
  detail: st`A model can give a wrong token a high score.`,
  claims: ['C035'],
});

// Chapter 5 · A weighted random pick -----------------------------------------------------------------

export const pickDraw = (v: { chosen: Sourced<string> }): SceneCopy => ({
  title: st`A weighted random pick`,
  body: st`A separate step makes a ${term('sampling', 'weighted random pick')}, like a raffle where each option holds tickets in proportion to its percentage. This time it picked ${slot('token', v.chosen)}.`,
  detail: st`Likelier tokens win more often, not always. The pick happens outside the network, and this app sees only its result, never the draw.`,
  claims: ['C036'],
});

export const pickSettings = (v: { temperature: Sourced<number> | null; topP: Sourced<number> | null }): SceneCopy => ({
  title: st`The settings this app sent`,
  body:
    v.temperature && v.topP
      ? st`This app sent ${term('temperature', 'temperature')} ${slot('decimal', v.temperature)} and ${term('top-p', 'top_p')} ${slot('decimal', v.topP)}, so these percentages are the chances of each pick. It's one reason the same question can get different replies.`
      : st`The pick is random, weighted by the percentages. It's one reason the same question can get different replies.`,
  detail: st`OpenAI doesn't document its sampler in detail; this assumes standard sampling. Lower temperatures would make the likeliest token likelier; higher ones would spread the chances out.`,
  claims: ['C037', 'C039', 'C038'],
});

// Chapter 6 · Add it, repeat, until it ends ----------------------------------------------------------

export const loopAppend = (): SceneCopy => ({
  title: st`Add it, then do it again`,
  body: st`The picked token joins the text, and the network runs again, only for the new position, reusing ${term('saved-work', 'saved work')}. Like writing in pen, it can't go back and edit: each new token is added at the end.`,
  claims: ['C040', 'C041'],
});

export const loopMoment = (v: { pick: PickCopy; again: boolean }): SceneCopy => ({
  title: v.again ? st`The close call from the start` : st`Another close call`,
  body: pickSentence(v.pick, 'Later,'),
  detail: st`Close calls describe wording, not correctness.`,
  claims: ['C012', 'C034'],
});

export const loopMontage = (v: { tokens: Sourced<number>; first: boolean; gaps: boolean }): SceneCopy =>
  v.first
    ? {
        title: st`Token by token, to the end`,
        body: v.gaps
          ? st`We have alternatives for ${slot('int', v.tokens)} ${term('token', 'tokens')}. OpenAI returned no alternatives for some text; its token boundaries are unavailable. Sped up here, not real timing.`
          : st`This repeats for every token: ${slot('int', v.tokens)} in all. Sped up here, not real timing.`,
        detail: st`Measured arrival times include the network, and the time each token took to compute can't be observed.`,
        claims: ['C040', 'C013', 'C016'],
      }
    : { title: st`Carrying on`, body: st`The same loop continues, one token at a time. Still sped up, not real timing.`, claims: ['C040', 'C013'] };

export function stopCopy(reason: StopReason, limit: Sourced<number> | null): SceneCopy {
  const endings: Record<StopReason, SourcedText> = {
    end_marker: st`The model wrote its ${term('end-marker', 'end marker')}, a special token meaning "done", like “The End” at the bottom of a story. (This app infers it: OpenAI reported the reply complete, and no stop words were set.)`,
    output_limit: limit
      ? st`The reply reached this app's length limit of ${slot('int', limit)} tokens, so it stops mid-way.`
      : st`The reply reached this app's length limit, so it stops mid-way.`,
    content_filter: st`OpenAI's content filter ended the reply early.`,
    other_incomplete: st`OpenAI ended the reply early and reported why in its data.`,
    stopped_by_user: st`You pressed Stop, so this app cancelled the request.`,
    connection_lost: st`The connection ended before the reply finished.`,
    error: st`An error ended the reply.`,
    rejected: st`The request was rejected before anything was sent.`,
  };
  return {
    title: st`How the reply ended`,
    body: endings[reason],
    detail: st`Formatting like bold text is just characters the model wrote; this app turns them into formatting.`,
    claims: ['C042', 'C043', ...(reason === 'end_marker' ? (['C015'] as const) : [])],
  };
}

// Chapter 7 · Your next message ----------------------------------------------------------------------

export const followupPacking = (v: { included: Sourced<number>; dropped: Sourced<number> | null }): SceneCopy => ({
  title: st`The chat so far is sent again`,
  body: v.dropped
    ? st`The model doesn't remember earlier messages. This app sent the ${term('context', 'conversation')} again, like handing over the whole transcript before each reply: ${slot('int', v.included)} messages. ${slot('int', v.dropped)} older ones were left out to fit.`
    : st`The model doesn't remember earlier messages. This app sent the ${term('context', 'conversation')} again, like handing over the whole transcript before each reply: ${slot('int', v.included)} messages, including this one.`,
  detail: st`Replies stopped by you or a lost connection aren't sent again. Provider-ended partial replies can be included. Chat apps with "memory" features save details and supply them as context in later chats: that's still context, not learning.`,
  claims: ['C044', 'C045', 'C054'],
});

export const followupGauge = (v: {
  input: Sourced<number> | null;
  budget: Sourced<number>;
  window: Sourced<number>;
  cached: Sourced<number> | null;
}): SceneCopy => ({
  title: st`How much fits`,
  body: [
    ...(v.input
      ? st`This request used ${slot('int', v.input)} input tokens, within this app's budget of ${slot('int', v.budget)}. The model's documented ${term('context-limit', 'limit')} is ${slot('int', v.window)}.`
      : st`This app's budget is ${slot('int', v.budget)} input tokens per request. The model's documented ${term('context-limit', 'limit')} is ${slot('int', v.window)}.`),
  ],
  detail: v.cached
    ? st`OpenAI reported ${slot('int', v.cached)} tokens cached: saved results for an identical start of the request. They don't change the reply or give the model memory.`
    : st`Longer chats cost more, and past the budget this app drops the oldest turns.`,
  claims: ['C045', ...(v.cached ? (['C014'] as const) : [])],
});

export { none as EMPTY_TEXT };
