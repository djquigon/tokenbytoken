// Regenerates content/claims.md from src/content/claims.ts (the source of truth).
//
//   npm run claims

import { writeFileSync } from 'node:fs';

import { claimsMarkdown } from '../src/content/claims.ts';

writeFileSync('content/claims.md', claimsMarkdown());
console.log('Wrote content/claims.md');
