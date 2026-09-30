// Fails if the browser build contains secrets or server-only code (CLAUDE.md §10), and reports how much
// JavaScript the browser downloads. Run after `npm run build`:
//
//   npm run check:bundle
//
// With .env.local present, the actual OPENAI_API_KEY value is also searched for (and never printed).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const STATIC_DIR = '.next/static';
// The o200k_base ranks are megabytes; any client chunk this large means the tokenizer leaked in.
const MAX_CHUNK_BYTES = 1_000_000;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

let scripts: string[];
try {
  scripts = files(STATIC_DIR).filter((f) => f.endsWith('.js'));
} catch {
  console.error(`No ${STATIC_DIR} directory. Run \`npm run build\` first.`);
  process.exit(2);
}

const checks: { name: string; test: (text: string) => boolean }[] = [
  { name: 'an OpenAI API key pattern', test: (t) => /sk-[A-Za-z0-9_-]{20,}/.test(t) },
  {
    name: 'a server secret variable name',
    test: (t) => /OPENAI_API_KEY|HISTORY_SIGNING_SECRET|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN/.test(t),
  },
];
const key = process.env.OPENAI_API_KEY;
if (key && key.length >= 20) checks.push({ name: 'the OPENAI_API_KEY value from .env.local', test: (t) => t.includes(key) });

const problems: string[] = [];
let totalRaw = 0;
let totalGzip = 0;
const sizes: { file: string; raw: number; gzip: number }[] = [];
for (const file of scripts) {
  const buf = readFileSync(file);
  const text = buf.toString('utf8');
  const gzip = gzipSync(buf).length;
  totalRaw += buf.length;
  totalGzip += gzip;
  sizes.push({ file, raw: buf.length, gzip });
  for (const check of checks) if (check.test(text)) problems.push(`${file}: contains ${check.name}`);
  if (buf.length > MAX_CHUNK_BYTES) problems.push(`${file}: ${buf.length} bytes (server-only code such as the tokenizer may have leaked in)`);
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Checked ${scripts.length} browser scripts: ${kb(totalRaw)} raw, ${kb(totalGzip)} gzipped in total.`);
for (const s of sizes.sort((a, b) => b.gzip - a.gzip).slice(0, 5)) console.log(`  ${kb(s.gzip).padStart(9)} gz  ${s.file}`);

if (problems.length > 0) {
  console.error('\nBundle check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nNo secrets or server-only code found in the browser build.');
