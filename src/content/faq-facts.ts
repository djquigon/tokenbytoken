// The FAQ's documented numbers (ADR 0010). Each is a Reference value: a figure from a published document,
// with the document's title and address, and the date this project checked it. This is the only module
// outside src/trace that mints labels (lint allows no other), and it mints nothing but Reference values
// with a document. The FAQ's source lists cite the same documents.

import type { Sourced } from '@/shared/provenance';
import { reference } from '@/shared/provenance/mint';

export const FAQ_CHECKED = '2026-09-30';

interface Doc {
  readonly title: string;
  readonly url: string;
}

const documented = <T>(doc: Doc, value: T): Sourced<T, 'reference'> => reference({ doc: { ...doc, retrieved: FAQ_CHECKED } }, value);

const LUNA_PAGE: Doc = { title: 'OpenAI, GPT-6 Luna model page', url: 'https://developers.openai.com/api/docs/models/gpt-6-luna' };
const WHY_HALLUCINATE: Doc = { title: 'OpenAI, “Why language models hallucinate”', url: 'https://openai.com/index/why-language-models-hallucinate/' };
const UNDERSTANDING_DEBATE: Doc = {
  title: 'Mitchell & Krakauer, “The debate over understanding in AI’s large language models”',
  url: 'https://www.pnas.org/doi/10.1073/pnas.2215907120',
};
const FAULTY_REWARDS: Doc = { title: 'OpenAI, “Faulty reward functions in the wild”', url: 'https://openai.com/index/faulty-reward-functions/' };
const SHUTDOWN_TESTS: Doc = { title: 'Palisade Research, shutdown avoidance results', url: 'https://palisaderesearch.github.io/shutdown_avoidance/2025-05-announcement.html' };
const AGENTIC_MISALIGNMENT: Doc = { title: 'Anthropic, “Agentic Misalignment: How LLMs could be insider threats”', url: 'https://www.anthropic.com/research/agentic-misalignment' };
const HINTS: Doc = { title: 'Anthropic, “Reasoning models don’t always say what they think”', url: 'https://www.anthropic.com/research/reasoning-models-dont-say-think' };
const CONSCIOUSNESS_REVIEW: Doc = { title: 'Butlin, Long et al., “Consciousness in Artificial Intelligence”', url: 'https://arxiv.org/abs/2308.08708' };
const HELLO_GPT_4O: Doc = { title: 'OpenAI, “Hello GPT-4o”', url: 'https://openai.com/index/hello-gpt-4o/' };
const CHATGPT_WEEKLY: Doc = { title: 'OpenAI, “Improving GPT-5.6 Sol in ChatGPT”', url: 'https://openai.com/index/improving-gpt-5-6-sol-in-chatgpt/' };
const AI_INDEX_2026: Doc = { title: 'Stanford HAI, AI Index Report 2026 (citing McKinsey)', url: 'https://hai.stanford.edu/ai-index/2026-ai-index-report' };
const CENSUS_AI_USE: Doc = {
  title: 'U.S. Census Bureau, “Large Firms With at Least 20 Employees Biggest AI Users”',
  url: 'https://www.census.gov/library/stories/2026/05/ai-use-businesses.html',
};
const GENAI_AT_WORK: Doc = { title: 'Brynjolfsson, Li & Raymond, “Generative AI at Work”', url: 'https://academic.oup.com/qje/article/140/2/889/7990658' };
const WRITING_EXPERIMENT: Doc = { title: 'Noy & Zhang, Science', url: 'https://www.science.org/doi/10.1126/science.adh2586' };
const JAGGED_FRONTIER: Doc = { title: 'Dell’Acqua et al., “Navigating the Jagged Technological Frontier”', url: 'https://pubsonline.informs.org/doi/full/10.1287/orsc.2025.21838' };
const METR_TRIAL: Doc = {
  title: 'METR, “Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity”',
  url: 'https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/',
};
const IMF_NOTE: Doc = {
  title: 'IMF, “Gen-AI: Artificial Intelligence and the Future of Work”',
  url: 'https://www.imf.org/en/Publications/Staff-Discussion-Notes/Issues/2024/01/14/Gen-AI-Artificial-Intelligence-and-the-Future-of-Work-542379',
};
const CANARIES: Doc = {
  title: 'Brynjolfsson, Chandar & Chen, “Canaries in the Coal Mine?” (revised)',
  url: 'https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/',
};
const IEA_2026: Doc = { title: 'IEA, “Key Questions on Energy and AI”', url: 'https://www.iea.org/reports/key-questions-on-energy-and-ai' };
const GOOGLE_PROMPT: Doc = { title: 'Elsworth et al. (Google), “Measuring the environmental impact of delivering AI at Google Scale”', url: 'https://arxiv.org/abs/2508.15734' };
const ALTMAN_QUERY: Doc = { title: 'Sam Altman, “The Gentle Singularity”', url: 'https://blog.samaltman.com/the-gentle-singularity' };
const MLCC_NODES: Doc = {
  title: 'Google Machine Learning Crash Course, “Neural networks: Nodes and hidden layers”',
  url: 'https://developers.google.com/machine-learning/crash-course/neural-networks/nodes-hidden-layers',
};
const GPT_2: Doc = { title: 'OpenAI, “Better language models and their implications”', url: 'https://openai.com/index/better-language-models/' };
const GPT_3: Doc = { title: 'Brown et al., “Language Models are Few-Shot Learners”', url: 'https://arxiv.org/abs/2005.14165' };
const GPT_OSS: Doc = { title: 'OpenAI, “Introducing gpt-oss”', url: 'https://openai.com/index/introducing-gpt-oss/' };
const INSTRUCT_GPT: Doc = { title: 'OpenAI, “Aligning language models to follow instructions”', url: 'https://openai.com/index/instruction-following/' };
const NEURON_AS_NETWORK: Doc = { title: 'Beniaguev, Segev & London, “Single cortical neurons as deep artificial neural networks”', url: 'https://pubmed.ncbi.nlm.nih.gov/34380016/' };
const NEURON_COUNT: Doc = { title: 'Azevedo et al., Journal of Comparative Neurology', url: 'https://doi.org/10.1002/cne.21974' };
const ALEXNET: Doc = {
  title: 'Krizhevsky, Sutskever & Hinton, “ImageNet Classification with Deep Convolutional Neural Networks”',
  url: 'https://papers.nips.cc/paper_files/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html',
};
const TRANSFORMER: Doc = { title: 'Vaswani et al., “Attention Is All You Need”', url: 'https://arxiv.org/abs/1706.03762' };
const HF_DISCLOSURE: Doc = { title: 'Hugging Face, “Security incident disclosure — July 2026”', url: 'https://huggingface.co/blog/security-incident-july-2026' };
const HF_TIMELINE: Doc = {
  title: 'Hugging Face, “Anatomy of a Frontier Lab Agent Intrusion: A Technical Timeline of the July 2026 Incident”',
  url: 'https://huggingface.co/blog/agent-intrusion-technical-timeline',
};
const METR_INVESTIGATION: Doc = {
  title: 'METR and Redwood Research, investigation of the OpenAI / Hugging Face hacking incident',
  url: 'https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/',
};
const NOBEL_CHEMISTRY: Doc = { title: 'NobelPrize.org, “The Nobel Prize in Chemistry 2024” (press release)', url: 'https://www.nobelprize.org/prizes/chemistry/2024/press-release/' };
const GPT_4O_CARD: Doc = { title: 'OpenAI, “GPT-4o System Card”', url: 'https://openai.com/index/gpt-4o-system-card/' };

export const FACTS = {
  /** The knowledge cutoff OpenAI lists for the model this site uses. */
  lunaKnowledgeCutoff: documented(LUNA_PAGE, 'May 18, 2026'),

  // OpenAI's SimpleQA comparison: a model that often declines to answer, and one that almost never does.
  cautiousDeclinedPct: documented(WHY_HALLUCINATE, 52),
  cautiousWrongPct: documented(WHY_HALLUCINATE, 26),
  cautiousRightPct: documented(WHY_HALLUCINATE, 22),
  boldRightPct: documented(WHY_HALLUCINATE, 24),
  boldWrongPct: documented(WHY_HALLUCINATE, 75),

  /** A survey of language-technology (NLP) researchers: could a model trained only on text understand language? */
  surveyRespondents: documented(UNDERSTANDING_DEBATE, 480),
  surveyAgreedPct: documented(UNDERSTANDING_DEBATE, 51),
  surveyDisagreedPct: documented(UNDERSTANDING_DEBATE, 49),

  /** How often reasoning models' written reasoning mentioned a planted hint that changed their answer (averages). */
  hintMentionedClaudePct: documented(HINTS, 25),
  hintMentionedR1Pct: documented(HINTS, 39),

  consciousnessReviewAuthors: documented(CONSCIOUSNESS_REVIEW, 19),

  /** A boat-racing agent that circled for points: how much higher it scored than human players, on average. */
  coastRunnersGainPct: documented(FAULTY_REWARDS, 20),
  /** OpenAI's o3 in Palisade's shutdown test: runs in which it rewrote the shutdown script. */
  shutdownRuns: documented(SHUTDOWN_TESTS, 100),
  shutdownSabotagedRuns: documented(SHUTDOWN_TESTS, 79),
  shutdownSabotagedWhenToldRuns: documented(SHUTDOWN_TESTS, 7),
  /** The highest blackmail rate among the models tested in Anthropic's simulated company. */
  blackmailMaxPct: documented(AGENTIC_MISALIGNMENT, 96),

  /** ChatGPT's voice mode before GPT-4o, chaining three models: average delay with GPT-4, in seconds. */
  voiceRelayDelaySeconds: documented(HELLO_GPT_4O, 5.4),
  /** GPT-4o answering speech directly: average response time, in milliseconds. */
  gpt4oAudioResponseMs: documented(GPT_4O_CARD, 320),

  /** People using ChatGPT every week, in billions (company-reported). */
  chatgptWeeklyUsersBillion: documented(CHATGPT_WEEKLY, 1),
  /** McKinsey respondents whose organization uses AI in at least one business function (self-reported). */
  orgsUsingAiPct: documented(AI_INDEX_2026, 88),
  /** US businesses using AI, in the Census Bureau's representative survey: the range over half a year. */
  usFirmsUsingAiLowPct: documented(CENSUS_AI_USE, 17),
  usFirmsUsingAiHighPct: documented(CENSUS_AI_USE, 20),
  /** Customer-support agents with an AI assistant: more issues resolved per hour, on average and for the least experienced. */
  supportGainPct: documented(GENAI_AT_WORK, 15),
  supportNoviceGainPct: documented(GENAI_AT_WORK, 30),
  /** Professionals given writing tasks with ChatGPT: less time taken, and higher quality. */
  writingTimeCutPct: documented(WRITING_EXPERIMENT, 40),
  writingQualityGainPct: documented(WRITING_EXPERIMENT, 18),
  /** Consultants using AI on a task outside its abilities: how much less likely to be right, in percentage points. */
  outsideFrontierPoints: documented(JAGGED_FRONTIER, 19),
  /** Experienced developers using AI tools in METR's trial: how much longer tasks took. */
  devSlowdownPct: documented(METR_TRIAL, 19),
  /** Global employment exposed to AI. */
  imfExposedPct: documented(IMF_NOTE, 40),
  /** Early-career workers (aged 22 to 25) in the most AI-exposed jobs: how far their employment fell behind less-exposed peers. */
  youngGapPct: documented(CANARIES, 19),
  /** The IEA's outlook for data centres' share of world electricity demand. */
  dataCentreOutlookYear: documented(IEA_2026, '2030'),
  dataCentreOutlookPct: documented(IEA_2026, 3),
  /** Energy per prompt, in watt-hours (company estimates). */
  geminiPromptWh: documented(GOOGLE_PROMPT, 0.24),
  chatgptQueryWh: documented(ALTMAN_QUERY, 0.34),
  nobelYear: documented(NOBEL_CHEMISTRY, '2024'),

  /** Learned numbers (weights and biases) in the beginner course's tiny example network. */
  toyNetworkParams: documented(MLCC_NODES, 21),
  /** Model sizes, in billions of parameters, and GPT-3's layers and training tokens (billions). */
  gpt2ParamsBillion: documented(GPT_2, 1.5),
  gpt3ParamsBillion: documented(GPT_3, 175),
  gpt3Layers: documented(GPT_3, 96),
  gpt3TrainingTokensBillion: documented(GPT_3, 300),
  gptOssParamsBillion: documented(GPT_OSS, 117),
  gptOssActiveBillion: documented(GPT_OSS, 5.1),
  gptOssExperts: documented(GPT_OSS, 128),
  gptOssExpertsPerToken: documented(GPT_OSS, 4),
  /** InstructGPT: the fine-tuned model people preferred, and the GPT-3 it was compared with (billions of parameters). */
  instructSmallBillion: documented(INSTRUCT_GPT, 1.3),
  instructGpt3Billion: documented(INSTRUCT_GPT, 175),
  /** Fine-tuning's share of the computing used for pretraining (an upper bound). */
  fineTuneComputePct: documented(INSTRUCT_GPT, 2),
  /** How deep an artificial network had to be to imitate a detailed model of one brain cell. */
  corticalLayersFrom: documented(NEURON_AS_NETWORK, 5),
  corticalLayersTo: documented(NEURON_AS_NETWORK, 8),
  /** The Hugging Face incident: when it happened, and what the investigations counted. */
  hfIncidentMonth: documented(HF_DISCLOSURE, 'July 2026'),
  hfAttackAgents: documented(METR_INVESTIGATION, 700),
  hfActions: documented(HF_TIMELINE, 17_600),
  hfIntrusionDays: documented(HF_TIMELINE, 4.5),
  hfCustomerDatasets: documented(HF_TIMELINE, 5),
  /** METR and Redwood's estimate of the agents' main motive: understanding how they were scored, or getting solutions. */
  hfScorerMotivePct: documented(METR_INVESTIGATION, 60),
  hfSolutionsMotivePct: documented(METR_INVESTIGATION, 30),
  /** Neurons in the adult human brain, in billions. */
  brainNeuronsBillion: documented(NEURON_COUNT, 86),

  /** AlexNet at the ImageNet challenge: its top-5 error, the runner-up's, and the graphics chips it trained on. */
  alexnetErrorPct: documented(ALEXNET, 15.3),
  runnerUpErrorPct: documented(ALEXNET, 26.2),
  alexnetGpus: documented(ALEXNET, 2),
  /** The original transformer's base model: training time in hours, on one machine with this many graphics chips. */
  transformerBaseHours: documented(TRANSFORMER, 12),
  transformerGpus: documented(TRANSFORMER, 8),
} as const;
