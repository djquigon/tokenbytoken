import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Import boundaries (docs/PLAN.md §3.3). Each layer lists what it may NOT import. `no-restricted-imports`
// settings don't merge across config objects, so each file group gets its complete list.
const forbid = (...groups) => groups.flat();
const APP_LAYERS = ["@/server/**", "@/trace/**", "@/generation/**", "@/components/**", "@/app/**"];
const REACT = ["react", "react-dom", "react/*", "next", "next/*"];
// Only src/trace/ mints Recorded and Reference values (CLAUDE.md §4). One exception: the FAQ's documented
// facts (src/content/faq-facts.ts) mint Reference values, each with its document (ADR 0010).
const MINT = ["**/provenance/mint", "@/shared/provenance/mint"];

const layer = (files, groups, message, ignores = []) => ({
  files,
  ignores: ["**/*.test.ts", "**/*.test.tsx", "**/*.test-d.ts", "**/*.test-d.tsx", "src/test/**", ...ignores],
  rules: { "no-restricted-imports": ["error", { patterns: [{ group: groups, message }] }] },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  layer(
    ["src/shared/**/*.{ts,tsx}"],
    forbid(APP_LAYERS, REACT, MINT),
    "src/shared is pure and imports nothing from the app (and only src/trace mints labels).",
    ["src/shared/provenance/mint.ts"],
  ),
  layer(
    ["src/server/**/*.{ts,tsx}"],
    forbid(["@/trace/**", "@/generation/**", "@/components/**", "@/app/**", "react", "react-dom"], MINT),
    "src/server imports only src/shared.",
  ),
  layer(
    ["src/trace/**/*.{ts,tsx}"],
    forbid(["@/server/**", "@/generation/**", "@/components/**", "@/app/**"], REACT),
    "src/trace is pure and imports only src/shared.",
  ),
  layer(
    ["src/generation/**/*.{ts,tsx}"],
    forbid(["@/server/**", "@/components/**", "@/app/**"], MINT),
    "src/generation imports only src/shared and src/trace.",
  ),
  layer(
    ["src/content/**/*.{ts,tsx}"],
    forbid(["@/server/**"], MINT),
    "Copy never imports server code, and only src/trace mints labels (and faq-facts.ts, Reference only).",
    ["src/content/faq-facts.ts"],
  ),
  layer(
    ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}", "src/instrumentation-client.ts"],
    forbid(["@/server/**"], MINT),
    "Client code never imports server code; only src/trace mints labels.",
    ["src/app/api/**"],
  ),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
