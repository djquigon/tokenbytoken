# Token by Token

An interactive, honest look at how large language models generate a reply, token by token. You chat with a
real OpenAI model, then replay a walkthrough of how that reply was produced. The walkthrough is built from
your own conversation, and everything in it is labeled **Recorded**, **Calculated**, **Reference**, or
**Example**.

**Status:** Phase 1.
- The chat works: streaming, Stop, retry, and every error state.
- A data inspector shows every token of a reply, its alternatives, and exactly what was sent, each value
  with its label.
- The step-by-step walkthrough comes in Phase 2.

## Documents
- [docs/PLAN.md](docs/PLAN.md): product framework, visualization plan, architecture, and roadmap
- [docs/decisions/](docs/decisions/): architecture decision records
- [docs/probe/](docs/probe/): model capability probe results
- [content/claims.md](content/claims.md): every explanatory claim and its source
- [CLAUDE.md](CLAUDE.md): project rules and conventions

## Development
Requires Node.js 24.

```bash
npm install
cp .env.example .env.local   # then add your OpenAI key
npm run dev                  # open http://localhost:3000/chat
```

To try the chat without calling OpenAI, run `npm run mock:openai` in one terminal, then run `npm run dev`
with `OPENAI_BASE_URL=http://127.0.0.1:3299/v1` in another.

`npm run check` runs the typecheck, lint, unit tests, build, and bundle check. `npm run test:e2e` runs the
browser tests against the mock. See [CLAUDE.md §14](CLAUDE.md) for all commands.
