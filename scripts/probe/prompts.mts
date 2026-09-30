// Fixed prompt sets for the capability probe. They're our own text, never user data, so the
// recorded outputs can be committed as fixtures.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CalibrationSample {
  id: string;
  instructions?: string;
  messages: readonly ChatMessage[];
}

/** Mirrors the planned app system prompt: concise answers visualize better. */
export const APP_INSTRUCTIONS =
  'You are a friendly assistant on an educational website. Answer clearly in under 120 words.';

export const STREAM_PROMPT = 'In two or three sentences, explain why the sky looks blue.';

/** Forces emoji, a skin-tone modifier, a ZWJ sequence, CJK, and RTL text into the output. */
export const UNICODE_PROMPT =
  'Reply with exactly this text and nothing else: Hi 👋🏽 — 你好, مرحبا, ¡olé! 🧑‍🚀';

/** A first position with a genuinely spread distribution, for the temperature experiment. */
export const FIRST_POSITION_PROMPT = 'Name one color. Reply with a single word.';

export const LONG_PROMPT = 'Write a 300-word story about a lighthouse keeper.';

/**
 * A deterministic instructions block well above the 1,024-token prompt-caching threshold,
 * sent twice to see whether (and how) the API reports cached and cache-write tokens.
 */
export const CACHE_INSTRUCTIONS = Array.from(
  { length: 24 },
  (_, i) =>
    `Rule ${i + 1}: When you explain how a language model works, describe what the application ` +
    `sends, how the text becomes tokens, how the network scores every possible next token, and ` +
    `how one token is picked at random according to those scores. Keep each explanation short, ` +
    `concrete, and free of jargon unless the reader asks for more detail.`,
).join('\n');

const LONG_PARAGRAPH =
  'Language models generate text one token at a time. Each step produces a score for every ' +
  'possible next token, and a sampling step picks one of them. The chosen token is appended to ' +
  'the input, and the process repeats until the model produces an end marker or reaches a length ' +
  'limit. Because the application sends the whole conversation every time, longer chats cost ' +
  'more and eventually reach the context limit.';

export const CALIBRATION_SAMPLES: readonly CalibrationSample[] = [
  { id: 'en-hi', messages: [{ role: 'user', content: 'Hi' }] },
  { id: 'en-question', messages: [{ role: 'user', content: 'What is the capital of Australia?' }] },
  { id: 'en-paragraph', messages: [{ role: 'user', content: LONG_PARAGRAPH }] },
  { id: 'en-long', messages: [{ role: 'user', content: Array.from({ length: 5 }, () => LONG_PARAGRAPH).join('\n\n') }] },
  {
    id: 'code-ts',
    messages: [
      {
        role: 'user',
        content:
          'Explain this code:\n```ts\nexport function mean(xs: number[]): number {\n  if (xs.length === 0) return NaN;\n  return xs.reduce((a, b) => a + b, 0) / xs.length;\n}\n```',
      },
    ],
  },
  { id: 'json', messages: [{ role: 'user', content: '{"name": "Token", "values": [1, 2, 3], "nested": {"ok": true}}' }] },
  { id: 'emoji', messages: [{ role: 'user', content: '🎉🔥👍🏽 Party time! 🥳🎂🎈 🧑‍🚀👩‍👩‍👧' }] },
  { id: 'emoji-single', messages: [{ role: 'user', content: '👍' }] },
  { id: 'zh', messages: [{ role: 'user', content: '请用一句话解释什么是机器学习。' }] },
  { id: 'ja', messages: [{ role: 'user', content: '機械学習とは何ですか？一文で説明してください。' }] },
  { id: 'ko', messages: [{ role: 'user', content: '머신러닝이 무엇인지 한 문장으로 설명해 주세요.' }] },
  { id: 'ar-rtl', messages: [{ role: 'user', content: 'اشرح التعلم الآلي في جملة واحدة.' }] },
  { id: 'he-rtl', messages: [{ role: 'user', content: 'הסבר מהי למידת מכונה במשפט אחד.' }] },
  { id: 'hi', messages: [{ role: 'user', content: 'मशीन लर्निंग को एक वाक्य में समझाइए।' }] },
  { id: 'ru', messages: [{ role: 'user', content: 'Объясни машинное обучение одним предложением.' }] },
  { id: 'es', messages: [{ role: 'user', content: '¿Por qué el cielo es azul? Responde en una frase.' }] },
  { id: 'de-compound', messages: [{ role: 'user', content: 'Was ist ein Donaudampfschifffahrtsgesellschaftskapitän?' }] },
  { id: 'numbers', messages: [{ role: 'user', content: '12345 + 67890 = ? Also 3.14159265358979, 1,000,000 and 2026-09-30.' }] },
  { id: 'whitespace', messages: [{ role: 'user', content: 'Line one\n\n    indented line\n\tTabbed line\n   trailing spaces   ' }] },
  { id: 'markdown-url', messages: [{ role: 'user', content: 'Summarize https://example.com/a/b?c=d&e=f in **bold** and `code`.' }] },
  { id: 'typography', messages: [{ role: 'user', content: 'Café naïve résumé coöperate — “smart quotes” and ‘apostrophes’…' }] },
  { id: 'special-token-text', messages: [{ role: 'user', content: 'Text with <|endoftext|> and <|im_start|> markers inside.' }] },
  { id: 'long-word', messages: [{ role: 'user', content: 'Pneumonoultramicroscopicsilicovolcanoconiosis' }] },
  { id: 'repetition', messages: [{ role: 'user', content: Array.from({ length: 40 }, () => 'the').join(' ') }] },
  {
    id: 'turns-3',
    messages: [
      { role: 'user', content: 'Hi!' },
      { role: 'assistant', content: 'Hello! How can I help you today?' },
      { role: 'user', content: 'Tell me a fun fact about octopuses.' },
    ],
  },
  {
    id: 'turns-5',
    messages: [
      { role: 'user', content: 'What is a token?' },
      { role: 'assistant', content: 'A token is a chunk of text, often a whole word or part of one.' },
      { role: 'user', content: 'How many tokens is this sentence?' },
      { role: 'assistant', content: 'Roughly eight, depending on the tokenizer.' },
      { role: 'user', content: 'Why does it depend on the tokenizer?' },
    ],
  },
  {
    id: 'turns-7',
    messages: [
      { role: 'user', content: 'Name a planet.' },
      { role: 'assistant', content: 'Mars.' },
      { role: 'user', content: 'Another one.' },
      { role: 'assistant', content: 'Jupiter.' },
      { role: 'user', content: 'One more, please.' },
      { role: 'assistant', content: 'Neptune.' },
      { role: 'user', content: 'Which of those is largest?' },
    ],
  },
  { id: 'instructions-1', instructions: APP_INSTRUCTIONS, messages: [{ role: 'user', content: 'Why is the sky blue?' }] },
  {
    id: 'instructions-3',
    instructions: APP_INSTRUCTIONS,
    messages: [
      { role: 'user', content: 'What is temperature in AI models?' },
      { role: 'assistant', content: 'It controls how random the pick of the next token is.' },
      { role: 'user', content: 'What happens at temperature zero?' },
    ],
  },
  { id: 'instructions-long', instructions: LONG_PARAGRAPH, messages: [{ role: 'user', content: 'Summarize the instructions.' }] },
];

/** Representative visitor questions. The outputs are for the owner to judge reply quality. */
export const QUALITY_PROMPTS: readonly string[] = [
  'Why is the sky blue?',
  'What is a large language model, in simple terms?',
  'How do vaccines work?',
  'Give me three tips for better sleep.',
  "What's the difference between weather and climate?",
  'Explain what a token is in the context of AI chatbots.',
  'Write a haiku about the ocean.',
  'What is 17 × 23? Show your working briefly.',
  'Who was Ada Lovelace?',
  'How does a refrigerator keep food cold?',
  'Translate "Where is the train station?" into French and Spanish.',
  'Suggest a name for a friendly robot and explain why.',
  'Explain recursion to a 12-year-old.',
  'What causes the seasons on Earth?',
  'Summarize the plot of Romeo and Juliet in two sentences.',
  'Is a tomato a fruit or a vegetable?',
  'What should I consider before adopting a dog?',
  "How many r's are in the word strawberry?",
  'Why do we dream?',
  'Tell me a short joke about computers.',
];
