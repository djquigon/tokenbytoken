// Records the sample conversation (docs/PLAN.md §1: "a real trace, recorded on a stated date with a named
// model snapshot") and a recorded "fluent but wrong" case for the deep dive, through the real app.
//
// It starts a production server on a spare port with the real OPENAI_API_KEY from .env.local, drives it in
// a browser, and saves exactly what the browser recorded (the TraceLogs in sessionStorage). Nothing is
// invented: the only edit is removing reply signatures, which are specific to one session.
//
//   npm run build
//   node --env-file-if-exists=.env.local scripts/record-sample.mts
//
// Costs well under a cent (at most MAX_TURNS short turns). Never run in CI.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test') as typeof import('@playwright/test');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fixtures', 'sample');
const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const CONVERSATION_KEY = 'tbt:conversation:v1';
const MAX_TURNS = 10;

const SAMPLE_PROMPTS = ['Why is the sky blue?', 'Why are sunsets red, then?'];

/** Letter counts this script can check itself, so a wrong answer is known to be wrong. */
const COUNT_CASES = [
  { word: 'strawberry', letter: 'r' },
  { word: 'bookkeeper', letter: 'e' },
  { word: 'Mississippi', letter: 's' },
  { word: 'excellence', letter: 'e' },
  { word: 'raspberry', letter: 'r' },
  { word: 'committee', letter: 't' },
  { word: 'necessary', letter: 's' },
  { word: 'banana', letter: 'a' },
] as const;

const countPrompt = (c: (typeof COUNT_CASES)[number]) =>
  `How many times does the letter "${c.letter}" appear in the word "${c.word}"? Answer with just the number.`;
const trueCount = (c: (typeof COUNT_CASES)[number]) => [...c.word.toLowerCase()].filter((ch) => ch === c.letter).length;

if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing: run with --env-file-if-exists=.env.local');
if (process.env.OPENAI_BASE_URL) throw new Error('OPENAI_BASE_URL is set: this script records the real API, so unset it');

// --- the server ---------------------------------------------------------------------------------------
let spentMicroUsd = 0;
let turnsSent = 0;
const server = spawn(`npx next start -p ${PORT}`, { cwd: ROOT, shell: true, env: { ...process.env, LIMITS_STORE: 'memory' } });
server.stdout.on('data', (chunk: Buffer) => {
  for (const line of chunk.toString().split('\n')) {
    const m = line.match(/"microUsd":(\d+)/);
    if (line.includes('"evt":"chat"') && m) spentMicroUsd += Number(m[1]);
  }
});
server.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error('the server did not start');
}

// --- the browser ----------------------------------------------------------------------------------------
type Stored = { v: 1; sessionId: string; conversationId: string; turns: { log: { entries: { k: string; ev?: unknown }[] } | null; assistant: { sig: string | null } | null }[] };

async function converse(prompts: readonly string[]): Promise<Stored> {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/chat`);
    await page.getByRole('button', { name: 'I understand' }).click();
    for (const [i, prompt] of prompts.entries()) {
      if (turnsSent >= MAX_TURNS) throw new Error('turn cap reached');
      turnsSent += 1;
      const box = page.getByRole('textbox', { name: 'Your message' });
      await box.fill(prompt);
      await box.press('Enter');
      await page.getByRole('button', { name: 'Explain this reply' }).nth(i).waitFor({ timeout: 60_000 });
      const skip = page.locator('#main').getByRole('button', { name: 'Skip walkthrough' });
      if (await skip.isVisible()) await skip.click();
    }
    const raw = await page.evaluate((key) => sessionStorage.getItem(key), CONVERSATION_KEY);
    if (!raw) throw new Error('no conversation in sessionStorage');
    return JSON.parse(raw) as Stored;
  } finally {
    await browser.close();
  }
}

/** Removes reply signatures (valid for one session only) from the stored turns and their end events. */
function withoutSignatures(c: Stored): Stored {
  return {
    ...c,
    turns: c.turns.map((t) => ({
      ...t,
      assistant: t.assistant ? { ...t.assistant, sig: null } : null,
      log: t.log
        ? {
            ...t.log,
            entries: t.log.entries.map((e) =>
              e.k === 'server' && (e.ev as { type?: string }).type === 'end' ? { ...e, ev: { ...(e.ev as object), assistantSig: null } } : e,
            ),
          }
        : null,
    })),
  };
}

type Delta = { type: 'delta'; channel: string; logprobs: { token: string; logprob: number; top: { token: string; logprob: number }[] }[] | null };
type Created = { type: 'response_created'; model: string };

const serverEvents = (c: Stored) => c.turns.flatMap((t) => t.log?.entries ?? []).filter((e) => e.k === 'server').map((e) => e.ev as { type: string });
const modelOf = (c: Stored) => (serverEvents(c).find((e) => e.type === 'response_created') as Created | undefined)?.model ?? 'unknown';

function firstAnswer(c: Stored) {
  const delta = serverEvents(c).find((e) => e.type === 'delta' && ((e as Delta).logprobs?.length ?? 0) > 0) as Delta | undefined;
  const lp = delta?.logprobs?.[0];
  if (!lp) return null;
  const top = [...lp.top].sort((a, b) => b.logprob - a.logprob)[0];
  return top ? { chosen: lp.token, chosenPct: Math.exp(lp.logprob) * 100, top: top.token, topPct: Math.exp(top.logprob) * 100 } : null;
}

const today = new Date().toISOString().slice(0, 10);
try {
  await waitForServer();
  mkdirSync(OUT, { recursive: true });

  const sample = withoutSignatures(await converse(SAMPLE_PROMPTS));
  writeFileSync(
    join(OUT, 'conversation.json'),
    `${JSON.stringify({ v: 1, recordedAt: today, model: modelOf(sample), prompts: SAMPLE_PROMPTS, notes: 'Recorded by scripts/record-sample.mts through the app; reply signatures removed.', conversation: sample })}\n`,
  );
  console.log(`sample conversation: ${sample.turns.length} turns, model ${modelOf(sample)}`);

  let found = false;
  for (const c of COUNT_CASES) {
    if (turnsSent >= MAX_TURNS) break;
    const recorded = withoutSignatures(await converse([countPrompt(c)]));
    const answer = firstAnswer(recorded);
    const correct = trueCount(c);
    const wrongAndLikely = answer && Number(answer.top.trim()) !== correct && answer.topPct >= 50 && Number(answer.chosen.trim()) !== correct;
    console.log(`${c.word}/${c.letter}: correct ${correct}, top ${JSON.stringify(answer?.top)} at ${answer?.topPct.toFixed(1)}%, chose ${JSON.stringify(answer?.chosen)}`);
    if (wrongAndLikely) {
      writeFileSync(
        join(OUT, 'fluent-case.json'),
        `${JSON.stringify({ v: 1, recordedAt: today, model: modelOf(recorded), prompt: countPrompt(c), check: { word: c.word, letter: c.letter, count: correct }, notes: 'The first of these prompts, tried in order, where the top option was a wrong count. Recorded by scripts/record-sample.mts; reply signatures removed.', tried: COUNT_CASES.slice(0, COUNT_CASES.indexOf(c) + 1).map((x) => `${x.word}/${x.letter}`), conversation: recorded })}\n`,
      );
      found = true;
      break;
    }
  }
  if (!found) console.log('no confidently wrong count found; fluent-case.json not written');
} finally {
  console.log(`turns sent: ${turnsSent}; charged to the app's ledger: ${spentMicroUsd} µ$ (≈ $${(spentMicroUsd / 1e6).toFixed(6)})`);
  // Stop the whole process tree (on Windows the shell's child outlives a plain kill), then exit.
  if (process.platform === 'win32' && server.pid) {
    await new Promise((done) => spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']).on('exit', done));
  } else {
    server.kill();
  }
  process.exit(0);
}
