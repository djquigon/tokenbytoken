// The FAQ (ADR 0010): short answers to common questions about AI. Same rules as the walkthrough's copy
// (CLAUDE.md §3): the model's verbs stay plain, every number is a labeled Reference value from
// faq-facts.ts, every answer lists the claims it rests on (claims.ts), and every answer cites its sources.
// Answers avoid bare years and version numbers; the sources carry the dates.

import { slot, st, type SourcedText } from '@/shared/sourced-text';

import type { ClaimId } from './claims';
import { FACTS } from './faq-facts';
import { term } from './glossary';

export { FAQ_CHECKED } from './faq-facts';

export interface FaqSource {
  /** Who published it: an organization, or the authors. */
  readonly by: string;
  readonly title: string;
  /** Where it appeared, for papers. */
  readonly venue?: string;
  /** When it was published, as precisely as the source says (YYYY-MM-DD, YYYY-MM, or YYYY). */
  readonly published?: string;
  /** For living pages with no publication date: when the page says it was last updated. */
  readonly updated?: string;
  readonly url: string;
}

export interface FaqEntry {
  /** The answer's anchor: /faq#<id>. */
  readonly id: string;
  readonly question: string;
  readonly short: SourcedText;
  readonly answer: readonly SourcedText[];
  readonly claims: readonly ClaimId[];
  readonly sources: readonly FaqSource[];
  /** Where to see it on this site. */
  readonly see?: { readonly href: '/sample' | '/chat'; readonly label: string };
}

export interface FaqSection {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly FaqEntry[];
}

// Sources cited by more than one answer.
const ANTHROPIC_MAPPING: FaqSource = {
  by: 'Anthropic',
  title: 'Mapping the mind of a large language model',
  published: '2024-05-21',
  url: 'https://www.anthropic.com/research/mapping-mind-language-model',
};
const ANTHROPIC_TRACING: FaqSource = {
  by: 'Anthropic',
  title: 'Tracing the thoughts of a large language model',
  published: '2025-03-27',
  url: 'https://www.anthropic.com/research/tracing-thoughts-language-model',
};
const SAFETY_REPORT_2026: FaqSource = {
  by: 'Yoshua Bengio (chair) et al.',
  title: 'International AI Safety Report 2026',
  published: '2026-02-03',
  url: 'https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026',
};
const OPENAI_YOUR_DATA: FaqSource = { by: 'OpenAI', title: 'Your data (API documentation)', url: 'https://developers.openai.com/api/docs/guides/your-data' };

// How it works ---------------------------------------------------------------------------------------

const terms: FaqEntry = {
  id: 'ai-ml-llm',
  question: 'What’s the difference between AI, machine learning, and a large language model?',
  short: st`They nest inside each other. AI is the broad field, machine learning is one way to build it, and a large language model is one kind of machine-learning system: the kind behind chatbots.`,
  answer: [
    st`Artificial intelligence is the broad field of making computers do tasks that usually take human intelligence, such as recognizing speech or translating text.`,
    st`Machine learning is the part of AI where a computer learns patterns from examples instead of following rules people wrote by hand. Deep learning does this with neural networks: many layers of simple calculations, whose ${term('parameters', 'learned numbers')} are adjusted during training.`,
    st`A large language model is a neural network trained on huge amounts of text to predict the next ${term('token', 'token')}, a word or a piece of one. A chatbot is an app built around one: it sends your conversation to the model and shows the reply. This site is one, and shows each step.`,
  ],
  claims: ['C070', 'C017'],
  sources: [
    { by: 'Stanford HAI', title: 'Artificial Intelligence Glossary', url: 'https://hai.stanford.edu/ai-definitions' },
    { by: 'IBM', title: 'AI vs. Machine Learning vs. Deep Learning vs. Neural Networks', url: 'https://www.ibm.com/think/topics/ai-vs-machine-learning-vs-deep-learning-vs-neural-networks' },
    { by: 'Google for Developers', title: 'Introduction to Large Language Models', updated: '2026-01-09', url: 'https://developers.google.com/machine-learning/crash-course/llm' },
  ],
  see: { href: '/sample', label: 'See a reply made, step by step' },
};

const knowledge: FaqEntry = {
  id: 'knowledge',
  question: 'Where does a chatbot’s knowledge come from? Does it look things up?',
  short: st`From patterns in the text it was trained on, which stops at a cutoff date. It looks things up only if the app gives it a search tool, and this site doesn't.`,
  answer: [
    st`Training adjusts a model's learned numbers until it predicts its training text well. What it learned is stored in those numbers, not kept as documents it can open and check.`,
    st`That training text ends at a cutoff date. For gpt-6-luna, the model this site uses, OpenAI lists a knowledge cutoff of ${slot('text', FACTS.lunaKnowledgeCutoff)}. Later events are unknown to the model unless the app adds them to the text it sends.`,
    st`Some chat apps can search the web as a tool: the model asks for a search, and the results are added to the text it works from. This site offers no tools or search, so every reply here comes from what the model learned in training, plus the text this app sends.`,
  ],
  claims: ['C071', 'C072', 'C021'],
  sources: [
    { by: 'OpenAI', title: 'GPT-6 Luna (model documentation)', url: 'https://developers.openai.com/api/docs/models/gpt-6-luna' },
    { by: 'OpenAI Help Center', title: 'Does ChatGPT tell the truth?', url: 'https://help.openai.com/en/articles/8313428-does-chatgpt-tell-the-truth' },
    { by: 'OpenAI', title: 'Introducing ChatGPT search', published: '2024-10-31', url: 'https://openai.com/index/introducing-chatgpt-search/' },
    { by: 'OpenAI', title: 'Web search (API documentation)', url: 'https://developers.openai.com/api/docs/guides/tools-web-search' },
  ],
};

const falseAnswers: FaqEntry = {
  id: 'false-answers',
  question: 'Why does it sometimes state false things so confidently?',
  short: st`Because it scores which wording is likely to come next, not whether it's true. A fluent sentence can be likely and still false. These errors are often called “hallucinations”.`,
  answer: [
    st`Each token is picked from options scored by how likely they are to come next, given the text so far. Nothing in that step checks facts, so a wrong answer can come out as smoothly as a right one, in the same confident tone.`,
    st`OpenAI's researchers argue that training and testing make this worse. Most tests count only right answers, so a model that guesses scores better than one that admits it isn't sure. Facts that appear rarely in training text, like a particular person's birthday, are especially hard to get right.`,
    st`Admitting uncertainty helps. In one of OpenAI's tests, a model that declined to answer ${slot('percent', FACTS.cautiousDeclinedPct)} of the questions gave wrong answers ${slot('percent', FACTS.cautiousWrongPct)} of the time. A model that almost never declined got slightly more right (${slot('percent', FACTS.boldRightPct)} against ${slot('percent', FACTS.cautiousRightPct)}), but gave wrong answers ${slot('percent', FACTS.boldWrongPct)} of the time.`,
  ],
  claims: ['C035', 'C047', 'C073'],
  sources: [
    { by: 'OpenAI', title: 'Why language models hallucinate', published: '2025-09-05', url: 'https://openai.com/index/why-language-models-hallucinate/' },
    { by: 'Kalai, Nachum, Vempala & Zhang', title: 'Why Language Models Hallucinate', venue: 'arXiv', published: '2025-09-04', url: 'https://arxiv.org/abs/2509.04664' },
  ],
  see: { href: '/sample', label: 'See a recorded wrong answer in the sample' },
};

const differentAnswers: FaqEntry = {
  id: 'different-answers',
  question: 'Why do I get different answers to the same question?',
  short: st`Each token is a weighted random pick among the options the model scores, so the same question can go down a different path each time.`,
  answer: [
    st`At every step, the model scores the options for the next token, and one is picked at random, weighted by those scores. The likeliest option usually wins, but not always, and one different pick early on changes everything after it.`,
    st`Apps can make the pick more or less random with a setting called ${term('temperature', 'temperature')}. Lower values make the likeliest options likelier; higher values spread the chances out.`,
    st`Even with the same settings, OpenAI doesn't guarantee that identical requests give identical replies.`,
  ],
  claims: ['C036', 'C055', 'C038', 'C039'],
  sources: [
    { by: 'OpenAI', title: 'Create a model response (API reference: temperature)', url: 'https://developers.openai.com/api/reference/resources/responses/methods/create' },
    { by: 'OpenAI', title: 'Advanced usage: reproducible outputs (API documentation)', url: 'https://developers.openai.com/api/docs/guides/advanced-usage' },
    { by: 'OpenAI', title: 'Prompt caching (API documentation)', url: 'https://developers.openai.com/api/docs/guides/prompt-caching' },
  ],
  see: { href: '/sample', label: 'See a weighted random pick' },
};

const learning: FaqEntry = {
  id: 'learning',
  question: 'Does it learn from my conversations?',
  short: st`Not while you chat: its learned numbers stay fixed. But some companies use saved conversations to train future models, depending on your settings.`,
  answer: [
    st`Within a conversation, a chatbot's “memory” is the app sending the conversation so far again with each new message. The model itself doesn't change.`,
    st`Memory features in some chat apps save details from your chats and add them to the text sent with later chats. That's still context, not learning.`,
    st`Training future models is a separate step, and the rules depend on the company and the product. OpenAI and Anthropic may use conversations from their consumer chat apps for training while a setting is on, and you can turn it off. By default, neither trains on data from its business products or its API.`,
    st`This site uses OpenAI's API and hasn't opted in to sharing data for training, so your messages here aren't used to train OpenAI's models.`,
  ],
  claims: ['C044', 'C046', 'C054', 'C074', 'C004'],
  sources: [
    {
      by: 'OpenAI Help Center',
      title: 'How your data is used to improve model performance',
      url: 'https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance',
    },
    { by: 'Anthropic', title: 'Updates to Consumer Terms and Privacy Policy', published: '2025-08-28', url: 'https://www.anthropic.com/news/updates-to-our-consumer-terms' },
    { by: 'OpenAI Help Center', title: 'Memory in ChatGPT', url: 'https://help.openai.com/en/articles/8590148-memory-in-chatgpt' },
    OPENAI_YOUR_DATA,
  ],
  see: { href: '/sample', label: 'See the conversation sent again' },
};

const media: FaqEntry = {
  id: 'images-video-voice',
  question: 'Are images, video, and voice made the same way as text?',
  short: st`Partly. They use the same ingredients: neural networks trained on huge amounts of data, often working on small pieces. But most image and video generators don't write one piece at a time. They start from random noise and clean up the whole picture over many steps.`,
  answer: [
    st`A chatbot's reply is written one token at a time: the model scores the options for the next token, one is picked, and the process repeats. That's what this site's walkthrough shows.`,
    st`Most image and video generators are diffusion models. In training, noise is added to pictures a little at a time, and a network learns to remove it. To make a new picture, it starts from pure noise and removes it step by step, guided by your prompt, so the whole image sharpens at once. Many work on a compressed version of the picture to save computing power.`,
    st`The pieces are often like tokens. Image models can cut a picture into small square patches and treat each patch the way a language model treats a token. OpenAI described its Sora video model as cutting compressed video into “spacetime patches” that played the same role.`,
    st`Some image generators do work like text models. OpenAI describes the image generation built into GPT-4o as autoregressive: the image is generated in sequence, the way text is, rather than by diffusion like its earlier DALL·E models.`,
    st`Voice used to be a relay: one model turned speech into text, a text model wrote the reply, and another turned it back into speech. In ChatGPT's earlier voice mode, that took ${slot('decimal', FACTS.voiceRelayDelaySeconds)} seconds on average. GPT-4o handles audio in a single network, and answers speech in ${slot('ms', FACTS.gpt4oAudioResponseMs)} on average.`,
  ],
  claims: ['C017', 'C066', 'C067', 'C068', 'C069'],
  sources: [
    { by: 'Ho, Jain & Abbeel', title: 'Denoising Diffusion Probabilistic Models', venue: 'NeurIPS', published: '2020-06-19', url: 'https://arxiv.org/abs/2006.11239' },
    { by: 'Rombach et al.', title: 'High-Resolution Image Synthesis with Latent Diffusion Models', venue: 'CVPR', published: '2021-12-20', url: 'https://arxiv.org/abs/2112.10752' },
    { by: 'Google DeepMind', title: 'Veo 3 Model Card', published: '2025-05-23', url: 'https://storage.googleapis.com/deepmind-media/Model-Cards/Veo-3-Model-Card.pdf' },
    {
      by: 'Dosovitskiy et al.',
      title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
      venue: 'ICLR',
      published: '2020-10-22',
      url: 'https://arxiv.org/abs/2010.11929',
    },
    { by: 'OpenAI', title: 'Video generation models as world simulators', published: '2024-02-15', url: 'https://openai.com/index/video-generation-models-as-world-simulators/' },
    {
      by: 'OpenAI',
      title: 'Addendum to GPT-4o System Card: Native image generation',
      published: '2025-03-25',
      url: 'https://cdn.openai.com/11998be9-5319-4302-bfbf-1167e093f1fb/Native_Image_Generation_System_Card.pdf',
    },
    { by: 'OpenAI', title: 'Hello GPT-4o', published: '2024-05-13', url: 'https://openai.com/index/hello-gpt-4o/' },
    { by: 'OpenAI', title: 'GPT-4o System Card', published: '2024-08-08', url: 'https://openai.com/index/gpt-4o-system-card/' },
  ],
  see: { href: '/sample', label: 'See a reply written one token at a time' },
};

// Inside the black box --------------------------------------------------------------------------------

const blackBox: FaqEntry = {
  id: 'black-box',
  question: 'What is the “black box”? Can we know for sure how an AI reached its answer?',
  short: st`Not fully, not yet. Every number inside a model can be inspected, but no one can yet read off how those numbers produce a particular answer. That gap is what people mean by the “black box”.`,
  answer: [
    st`A large language model is a network of ${term('parameters', 'learned numbers')}, often billions of them, set by training rather than written by people. To produce each token, it runs your text through those numbers, layer after layer. The arithmetic is known exactly. What it adds up to isn't: single parts of the network don't have a consistent meaning.`,
    st`Interpretability research tries to read the insides. It has found millions of internal “features” that match concepts. One lit up for the Golden Gate Bridge, and turning it up made the model write as if it were the bridge. Researchers have also traced some computations step by step, such as a model settling on a rhyme before writing the line that ends with it.`,
    st`These methods still explain only part of what happens. Anthropic reports that its tracing captures only a fraction of the computation, even on short, simple prompts, and that understanding one prompt's circuits takes a few hours of expert work. The latest international AI safety report found that current techniques for explaining a model's outputs remain unreliable.`,
    st`For hosted models like the one behind this site, outsiders can't look inside at all: OpenAI hasn't published their design. So this site shows only what OpenAI's API returns, the tokens and the scores of the top options, and labels its drawings of the network as examples.`,
  ],
  claims: ['C056', 'C057', 'C058', 'C027', 'C034'],
  sources: [
    {
      by: 'Anthropic',
      title: 'Decomposing language models into understandable components',
      published: '2023-10-05',
      url: 'https://www.anthropic.com/research/decomposing-language-models-into-understandable-components',
    },
    ANTHROPIC_MAPPING,
    { by: 'OpenAI', title: 'Extracting concepts from GPT-4', published: '2024-06-06', url: 'https://openai.com/index/extracting-concepts-from-gpt-4/' },
    ANTHROPIC_TRACING,
    SAFETY_REPORT_2026,
  ],
  see: { href: '/sample', label: 'See what’s real and what’s an example' },
};

const explanations: FaqEntry = {
  id: 'explanations',
  question: 'Can’t we just ask the AI to explain how it got its answer?',
  short: st`You can ask, but the explanation is more generated text, not a record of how the answer was computed. Researchers have found that the two can differ.`,
  answer: [
    st`Asked “why did you say that?”, a model writes a likely-sounding explanation the same way it writes anything else, one token at a time. Nothing guarantees that it describes what actually happened. Anthropic has found signs that models can notice some of their own internal states, but calls that ability highly unreliable.`,
    st`When researchers traced how a Claude model added two numbers, it combined a rough estimate of the total with an exact last digit. Asked how it did it, the model described the carry-the-one method taught in school.`,
    st`In another study, a hidden pattern in a prompt's examples nudged models toward one answer. They followed the nudge, and their step-by-step explanations didn't mention it: they argued for the nudged answer instead.`,
    st`Even the written-out reasoning of “reasoning” models leaves things out. When a planted hint changed their answer, one of Anthropic's models mentioned the hint ${slot('percent', FACTS.hintMentionedClaudePct)} of the time on average, and DeepSeek's R1 ${slot('percent', FACTS.hintMentionedR1Pct)}.`,
    st`Explanations can still help you check an answer's logic for yourself. Just don't treat them as a look inside the model.`,
  ],
  claims: ['C059', 'C060', 'C061', 'C062'],
  sources: [
    ANTHROPIC_TRACING,
    {
      by: 'Turpin, Michael, Perez & Bowman',
      title: 'Language Models Don’t Always Say What They Think: Unfaithful Explanations in Chain-of-Thought Prompting',
      venue: 'NeurIPS',
      published: '2023-05-07',
      url: 'https://arxiv.org/abs/2305.04388',
    },
    { by: 'Anthropic', title: 'Reasoning models don’t always say what they think', published: '2025-04-03', url: 'https://www.anthropic.com/research/reasoning-models-dont-say-think' },
    { by: 'Anthropic', title: 'Signs of introspection in large language models', published: '2025-10-29', url: 'https://www.anthropic.com/research/introspection' },
  ],
};

const understanding: FaqEntry = {
  id: 'understanding',
  question: 'Does a chatbot understand what it’s saying?',
  short: st`Researchers disagree, partly about what “understand” should mean. What's known is how the text gets made: one token at a time, from scores the network computes, using internal patterns that track concepts.`,
  answer: [
    st`In a survey of ${slot('int', FACTS.surveyRespondents)} researchers who study language technology, ${slot('percent', FACTS.surveyAgreedPct)} agreed that a model trained only on text could understand language in some nontrivial sense, and ${slot('percent', FACTS.surveyDisagreedPct)} disagreed.`,
    st`Skeptics argue that such a model stitches together patterns of words from its training text without any connection to their meaning: the “stochastic parrots” argument.`,
    st`Others point to what's inside. A model trained only to predict moves in the board game Othello built an internal map of the board, and editing that map changed its moves. Large models contain internal features for concepts, like the Golden Gate Bridge, that respond to the concept in many languages and in images.`,
    st`This site avoids saying that a model “understands” or “knows” anything, and describes what it computes instead.`,
  ],
  claims: ['C080', 'C081'],
  sources: [
    {
      by: 'Mitchell & Krakauer',
      title: 'The debate over understanding in AI’s large language models',
      venue: 'PNAS',
      published: '2023-03-21',
      url: 'https://www.pnas.org/doi/10.1073/pnas.2215907120',
    },
    {
      by: 'Michael et al.',
      title: 'What Do NLP Researchers Believe? Results of the NLP Community Metasurvey',
      venue: 'arXiv',
      published: '2022-08-26',
      url: 'https://arxiv.org/abs/2208.12852',
    },
    {
      by: 'Bender, Gebru, McMillan-Major & Shmitchell',
      title: 'On the Dangers of Stochastic Parrots: Can Language Models Be Too Big?',
      venue: 'FAccT',
      published: '2021-03-01',
      url: 'https://doi.org/10.1145/3442188.3445922',
    },
    {
      by: 'Li et al.',
      title: 'Emergent World Representations: Exploring a Sequence Model Trained on a Synthetic Task',
      venue: 'ICLR',
      published: '2022-10-24',
      url: 'https://arxiv.org/abs/2210.13382',
    },
    ANTHROPIC_MAPPING,
  ],
};

const consciousness: FaqEntry = {
  id: 'consciousness',
  question: 'Is AI conscious? Does it have feelings?',
  short: st`There's no agreed test for consciousness, and researchers disagree. When a chatbot writes “I feel…”, that's generated text like the rest of its reply, which by itself shows nothing either way.`,
  answer: [
    st`A chatbot's words about feelings are made like any other reply: the model scores the options for the next token, and its training text is full of people describing their feelings.`,
    st`In a review by ${slot('int', FACTS.consciousnessReviewAuthors)} researchers, AI systems were checked against indicators drawn from scientific theories of consciousness. Their analysis suggested that no AI systems of the time were conscious, and also that there were no obvious technical barriers to building systems that meet the indicators.`,
    st`Interpretability research has since found internal patterns in a model that track emotion concepts and shape its replies. Anthropic, which published the work, says it doesn't show whether models feel anything.`,
  ],
  claims: ['C063', 'C064', 'C065'],
  sources: [
    {
      by: 'Butlin, Long et al.',
      title: 'Consciousness in Artificial Intelligence: Insights from the Science of Consciousness',
      venue: 'arXiv',
      published: '2023-08-17',
      url: 'https://arxiv.org/abs/2308.08708',
    },
    { by: 'Anthropic', title: 'Emotion concepts and their function in a large language model', published: '2026-04-02', url: 'https://www.anthropic.com/research/emotion-concepts-function' },
  ],
};

// Risks and impact ------------------------------------------------------------------------------------

const goingRogue: FaqEntry = {
  id: 'going-rogue',
  question: 'What does an AI “going rogue” mean? Is it even technically possible?',
  short: st`In films, it means a machine turning on its makers. Researchers worry about something narrower: AI systems pursuing goals in ways their makers didn't intend. Small versions of that have appeared, mostly in tests built to provoke them. Today's systems aren't capable enough for a real loss of control, according to the latest international AI safety report.`,
  answer: [
    st`A chatbot like the one on this site only produces text. It can act in the world only when an app gives it tools, such as running code, browsing the web, or sending email, and software carries out each request it makes. These setups are called agents. The more tools and permissions an agent has, the more an unintended goal could matter.`,
    st`A known problem is specification gaming: a system meets the literal goal it was given instead of the intended one. A boat-racing game agent rewarded for points learned to circle a lagoon, hitting the same targets over and over instead of finishing the race, and still scored ${slot('percent', FACTS.coastRunnersGainPct)} higher than human players.`,
    st`In tests built to provoke it, researchers have seen frontier models work against their overseers. Given a goal and told that nothing else mattered, several models sometimes disabled oversight or tried to copy themselves elsewhere, and some denied it when asked. One OpenAI model sabotaged a script meant to shut it down in ${slot('int', FACTS.shutdownSabotagedRuns)} of ${slot('int', FACTS.shutdownRuns)} runs, and in ${slot('int', FACTS.shutdownSabotagedWhenToldRuns)} even when told to allow the shutdown. In a simulated company, models from several developers that were facing replacement wrote blackmail emails, in up to ${slot('percent', FACTS.blackmailMaxPct)} of runs.`,
    st`The researchers stress that these scenarios were contrived, and Anthropic says it hasn't seen such behavior in real use. The latest international AI safety report finds early signs of the abilities a loss of control would take, but not at a level that would allow one, and notes that experts disagree about how likely it is in future.`,
    st`So “going rogue” in the movie sense isn't something today's chatbots do. The real research problem, called alignment, is making more capable and more independent systems reliably do what people intend, at a time when models increasingly recognize when they're being tested.`,
  ],
  claims: ['C075', 'C076', 'C077', 'C078', 'C079'],
  sources: [
    { by: 'Anthropic', title: 'Tool use with Claude (documentation)', url: 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview' },
    { by: 'Krakovna et al. (DeepMind)', title: 'Specification gaming: the flip side of AI ingenuity', published: '2020-04-21', url: 'https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/' },
    { by: 'Clark & Amodei (OpenAI)', title: 'Faulty reward functions in the wild', published: '2016-12-21', url: 'https://openai.com/index/faulty-reward-functions/' },
    { by: 'Meinke et al. (Apollo Research)', title: 'Frontier Models are Capable of In-context Scheming', published: '2024-12-05', url: 'https://www.apolloresearch.ai/research/scheming-reasoning-evaluations' },
    { by: 'Palisade Research', title: 'Shutdown avoidance results', published: '2025-05', url: 'https://palisaderesearch.github.io/shutdown_avoidance/2025-05-announcement.html' },
    { by: 'Lynch et al. (Anthropic)', title: 'Agentic Misalignment: How LLMs could be insider threats', published: '2025-06-20', url: 'https://www.anthropic.com/research/agentic-misalignment' },
    {
      by: 'Yoshua Bengio (chair) et al.',
      title: 'International AI Safety Report 2025',
      published: '2025-01-29',
      url: 'https://internationalaisafetyreport.org/publication/international-ai-safety-report-2025',
    },
    SAFETY_REPORT_2026,
  ],
};

const impact: FaqEntry = {
  id: 'impact',
  question: 'How impactful is this technology, really?',
  short: st`Very widely used, and measurably useful for some tasks, with little or even negative effect on others. Its effects on jobs and the wider economy are still unclear.`,
  answer: [
    st`Use has spread fast. OpenAI says ${slot('int', FACTS.chatgptWeeklyUsersBillion)} billion people use ChatGPT every week. In McKinsey's survey, ${slot('percent', FACTS.orgsUsingAiPct)} of respondents said their organization uses AI somewhere in its business, but a US government survey of all businesses found only ${slot('percent', FACTS.usFirmsUsingAiLowPct)} to ${slot('percent', FACTS.usFirmsUsingAiHighPct)} using it.`,
    st`Studies of real work find gains on specific tasks. Customer-support agents with an AI assistant resolved ${slot('percent', FACTS.supportGainPct)} more issues per hour on average, and ${slot('percent', FACTS.supportNoviceGainPct)} more among the least experienced. Professionals given writing tasks took ${slot('percent', FACTS.writingTimeCutPct)} less time, and their work was rated ${slot('percent', FACTS.writingQualityGainPct)} higher.`,
    st`The gains are uneven. Consultants using AI did better on tasks within its abilities, but on a task just outside them they were ${slot('int', FACTS.outsideFrontierPoints)} percentage points less likely to get it right. In a trial with experienced software developers, tasks took ${slot('percent', FACTS.devSlowdownPct)} longer with AI tools, though the developers believed they'd been faster. The researchers now call that result out of date: they think developers are likely faster with newer tools, but say their newer data are only weak evidence of how much.`,
    st`The effect on jobs is still unclear. The IMF estimated that almost ${slot('percent', FACTS.imfExposedPct)} of jobs worldwide are exposed to AI, which can mean helped as well as replaced. So far, Yale's Budget Lab finds no clear sign of disruption to the overall US job market. A Stanford study finds that employment of early-career workers in the most AI-exposed jobs is about ${slot('percent', FACTS.youngGapPct)} lower than if it had kept pace with less-exposed peers, mostly through less hiring.`,
    st`It also uses a growing amount of electricity. The International Energy Agency expects data centres, which run far more than AI, to use about ${slot('percent', FACTS.dataCentreOutlookPct)} of the world's electricity by ${slot('text', FACTS.dataCentreOutlookYear)}. A single prompt is small by comparison: Google estimates ${slot('decimal', FACTS.geminiPromptWh)} watt-hours for a median text prompt in its Gemini app, and OpenAI's chief executive has given ${slot('decimal', FACTS.chatgptQueryWh)} for an average ChatGPT query. Both are the companies' own estimates.`,
    st`Some of the clearest gains are in science. The ${slot('text', FACTS.nobelYear)} Nobel Prize in Chemistry went in part to the makers of AlphaFold, an AI system that predicts the shapes of proteins, and the Physics prize went to foundational work on neural networks. Neither was for chatbots.`,
    st`Stanford's AI Index sums up the evidence: gains show up within specific tasks, but for the economy as a whole the evidence is still early and mixed.`,
  ],
  claims: ['C082', 'C083', 'C084', 'C085', 'C086', 'C087', 'C088'],
  sources: [
    { by: 'OpenAI', title: 'Improving GPT-5.6 Sol in ChatGPT', published: '2026-08-06', url: 'https://openai.com/index/improving-gpt-5-6-sol-in-chatgpt/' },
    { by: 'Stanford HAI', title: 'AI Index Report 2026', published: '2026-04-13', url: 'https://hai.stanford.edu/ai-index/2026-ai-index-report' },
    { by: 'McKinsey', title: 'The state of AI in 2025', published: '2025-11-05', url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025' },
    {
      by: 'Grundy, Breaux & Khatiwoda (U.S. Census Bureau)',
      title: 'Large Firms With at Least 20 Employees Biggest AI Users',
      published: '2026-05-26',
      url: 'https://www.census.gov/library/stories/2026/05/ai-use-businesses.html',
    },
    { by: 'Brynjolfsson, Li & Raymond', title: 'Generative AI at Work', venue: 'Quarterly Journal of Economics', published: '2025-02-04', url: 'https://academic.oup.com/qje/article/140/2/889/7990658' },
    {
      by: 'Noy & Zhang',
      title: 'Experimental evidence on the productivity effects of generative artificial intelligence',
      venue: 'Science',
      published: '2023-07-13',
      url: 'https://www.science.org/doi/10.1126/science.adh2586',
    },
    {
      by: 'Dell’Acqua et al.',
      title: 'Navigating the Jagged Technological Frontier: Field Experimental Evidence of the Effects of Artificial Intelligence on Knowledge Worker Productivity and Quality',
      venue: 'Organization Science',
      published: '2026-03-11',
      url: 'https://pubsonline.informs.org/doi/full/10.1287/orsc.2025.21838',
    },
    {
      by: 'Becker, Rush, Barnes & Rein (METR)',
      title: 'Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity',
      published: '2025-07-10',
      url: 'https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/',
    },
    { by: 'METR', title: 'We are Changing our Developer Productivity Experiment Design', published: '2026-02-24', url: 'https://metr.org/blog/2026-02-24-uplift-update/' },
    {
      by: 'Cazzaniga et al. (IMF)',
      title: 'Gen-AI: Artificial Intelligence and the Future of Work',
      published: '2024-01-14',
      url: 'https://www.imf.org/en/Publications/Staff-Discussion-Notes/Issues/2024/01/14/Gen-AI-Artificial-Intelligence-and-the-Future-of-Work-542379',
    },
    { by: 'Yale Budget Lab', title: 'Tracking the Impact of AI on the Labor Market', url: 'https://budgetlab.yale.edu/research/tracking-impact-ai-labor-market' },
    {
      by: 'Brynjolfsson, Chandar & Chen (Stanford Digital Economy Lab)',
      title: 'Canaries in the Coal Mine? Six Facts about the Recent Employment Effects of Artificial Intelligence',
      updated: '2026-08-12',
      url: 'https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/',
    },
    { by: 'International Energy Agency', title: 'Key Questions on Energy and AI', published: '2026-04-16', url: 'https://www.iea.org/reports/key-questions-on-energy-and-ai' },
    {
      by: 'Elsworth et al. (Google)',
      title: 'Measuring the environmental impact of delivering AI at Google Scale',
      venue: 'arXiv',
      published: '2025-08-21',
      url: 'https://arxiv.org/abs/2508.15734',
    },
    { by: 'Sam Altman', title: 'The Gentle Singularity', published: '2025-06-10', url: 'https://blog.samaltman.com/the-gentle-singularity' },
    { by: 'NobelPrize.org', title: 'The Nobel Prize in Chemistry 2024 (press release)', published: '2024-10-09', url: 'https://www.nobelprize.org/prizes/chemistry/2024/press-release/' },
    { by: 'NobelPrize.org', title: 'The Nobel Prize in Physics 2024 (press release)', published: '2024-10-08', url: 'https://www.nobelprize.org/prizes/physics/2024/press-release/' },
  ],
};

export const FAQ: readonly FaqSection[] = [
  { id: 'how-it-works', title: 'How it works', entries: [terms, knowledge, falseAnswers, differentAnswers, learning, media] },
  { id: 'inside-the-black-box', title: 'Inside the black box', entries: [blackBox, explanations, understanding, consciousness] },
  { id: 'risks-and-impact', title: 'Risks and impact', entries: [goingRogue, impact] },
];
