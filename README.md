# How does an AI work?

Live at **[howdoesanai.work](https://howdoesanai.work/)**. Formerly "Token by Token".

An interactive, honest look at how AI chatbots write a reply, token by token. You chat with a real OpenAI
model, then replay a walkthrough of how that reply was produced. The walkthrough is built from your own
conversation, and everything in it is labeled **Recorded**, **Calculated**, **Reference**, or **Example**.

**Status:** Phase 2.
- The chat: streaming, Stop, retry, and every error state.
- A step-by-step walkthrough of each reply, with deep dives, a text version, and a recorded sample
  conversation.
- A FAQ with sourced answers to common questions about AI.
- A data inspector that shows every token of a reply, its alternatives, and exactly what was sent, each
  value with its label.

## Documents
- [docs/PLAN.md](docs/PLAN.md): product framework, visualization plan, architecture, and roadmap
- [docs/decisions/](docs/decisions/): architecture decision records
- [docs/probe/](docs/probe/): model capability probe results
- [content/claims.md](content/claims.md): every explanatory claim and its source
- [AGENTS.md](AGENTS.md): project rules and conventions, for every coding agent (CLAUDE.md imports it)

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
browser tests against the mock. See [AGENTS.md §14](AGENTS.md) for all commands.
