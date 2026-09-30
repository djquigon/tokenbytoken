import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // Next.js handles `server-only` itself; in tests it is an empty module.
    alias: { 'server-only': fileURLToPath(new URL('./src/test/empty-module.ts', import.meta.url)) },
  },
  test: {
    // Most tests cover pure logic. Component tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mts'],
    typecheck: { enabled: true, include: ['src/**/*.test-d.{ts,tsx}'] },
  },
});
