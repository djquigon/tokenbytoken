# ADR 0011: A plain-language pass: analogies, and a tooltip for every technical term

- **Status:** Accepted, 2026-10-01
- **Deciders:** the owner ("audit the informative content … make it more accessible for the average person
  … using analogies, adding more tooltips for technical terms … still be thorough in explaining every step"),
  and Claude for the audit and the rewrite

## Context
The site's copy was accurate and sourced, but it was written close to the mechanism. A newcomer met words
like "instructions", "tool calls", "tokenizer", "positions", "feed-forward" and "logprob" with no
definition. The ideas that matter most also had no familiar picture: the conversation being sent again,
lists of numbers, attention, and a weighted random pick. The goal is for anyone, not only specialists, to
come away understanding how a chatbot's reply is made.

## The audit
I read every piece of explanatory copy as a newcomer would: the walkthrough's captions at every depth, the
deep dives, the FAQ, the glossary, the landing page, the tour, and the walkthrough's opening panel.

- **Every step was there.** Sending, tokens, IDs, the network, scores, the pick, the loop, the ending, and the next message are all covered. What was missing was the *why*, said plainly.
- **Undefined jargon:**
  - in the walkthrough: instructions (system prompt), tools and tool calls, tokenizer, bytes, embedding, positions, feed-forward steps, open-weight, saved work (in the banner), and the API;
  - in the FAQ: neural network, gradient descent, backpropagation, pretraining, fine-tuning, RLHF, transformer, mixture of experts, diffusion, interpretability, alignment, agents, specification gaming, and knowledge cutoff.
- **Abstract ideas with no picture:** context, tokens, the vocabulary, embeddings, layers, attention, scores, sampling, temperature, top_p, saved work, the end marker, the context limit, and close calls.
- **One definition was too technical.** "Logprob" was defined through the natural logarithm of a fraction. It now says: a logarithmic scale where zero means certain and more negative means less likely, like decibels.
- **One sentence was too vague** (the owner asked what it meant). "Limits and prices are counted in tokens", on the landing page and in the walkthrough, now names them: a model can take in only so many tokens at once, each reply is capped at a set number, and every request is priced by the token.

## Decisions

### Analogies, under rules
An analogy has to be true to the mechanism it stands for, not just vivid. These are the analogies used:

| Idea | Analogy |
|---|---|
| Large language model | A phone keyboard's word suggestions, scaled up enormously |
| Tokens | Building blocks: a common word is one block, a rare word several |
| Vocabulary | A dictionary with numbered entries |
| Context | Handing an actor the whole script so far before each new line |
| Embedding | Coordinates on a map, where similar words sit close together |
| Layers | Stations on an assembly line |
| Scores | A rating for every word in the dictionary |
| Weighted random pick | A raffle where likelier options hold more tickets |
| Temperature | A dial between predictable and adventurous |
| Writing the reply | Writing in pen: each token is added at the end, with no going back |
| Saved work | Notes kept on every earlier word |
| End marker | "The End" |
| Learned parameters | Dials set in training, then left alone |
| Training | Practicing darts |
| Gradient descent | Walking downhill in fog |
| Mixture of experts | A hospital where each patient sees only a few specialists |
| Diffusion | A photo coming into focus out of TV static |
| The black box | A city's full wiring, with no map of which switches light which streets |

The rules, added to CLAUDE.md's language guide:
- **No analogy may suggest that a model thinks, remembers, looks things up, or re-reads.** The content lint still checks the wording. A raffle, a script, or a dial is fine; "the model reads your message and decides" is not.
- **Concrete examples are labeled as examples.** Attention's pronoun example ("it" pulling in information from "cat") rests on a registered claim: C099, citing the transformer paper's own figures.
- **Simple captions stay within 48 words.** An analogy that doesn't fit goes into the term's tooltip or into Detailed depth.

### Tooltips for every technical term
- **The glossary grew from 17 terms to 43.**
  - New terms: large language model, neural network, training, pretraining, fine-tuning, RLHF, gradient descent, backpropagation, transformer, mixture of experts, open-weight model, knowledge cutoff, tokenizer, byte, instructions, embedding, position, feed-forward step, API, streaming, tools, AI agent, interpretability, alignment, specification gaming, and diffusion model.
  - Most entries now carry an analogy, shown on its own line under the definition. Screen readers get both as the term's description.
- **Terms are marked where a newcomer first meets them:**
  - in the walkthrough's captions, the deep dives, and the FAQ, including the history timeline;
  - on the landing page's feature cards;
  - on the walkthrough's opening panel.

### What changed for viewers
- **Simple captions are longer by a sentence**, so the walkthrough takes longer to read. Each step's time is still set by its reading time, and the total is about 201 seconds at 1× (it was 157), under the 240-second cap. At the default 0.5× speed that's nearly seven minutes; viewers can step through at their own pace.
- **Detailed and Technical depths keep their precision.** The pass changed how the ideas are introduced, not what is claimed.

## Consequences
- **Tests:** all copy tests still pass: claims registered, the 48-word limit, banned Simple-depth jargon, the content lint, and labeled numbers. The pacing snapshot was updated for the longer captions.
- **For future copy:** follow the same rules. Mark a technical term with `term(id, text)` the first time a step uses it; add a glossary entry, with a claim and, where it helps, an analogy, before using a new term; and check any analogy against the mechanism, not just the wording.
