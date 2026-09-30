# Token by Token

An interactive, honest look at how large language models generate a reply, token by token. You chat with a
real OpenAI model, then replay a walkthrough of how that reply was produced. The walkthrough is built from
your own conversation, and everything in it is labeled **Recorded**, **Calculated**, **Reference**, or
**Example**.

**Status:** Phase 0 (foundations). No product features yet.

## Documents
- [docs/PLAN.md](docs/PLAN.md): product framework, visualization plan, architecture, and roadmap
- [docs/decisions/](docs/decisions/): architecture decision records
- [docs/probe/](docs/probe/): model capability probe results
- [CLAUDE.md](CLAUDE.md): project rules and conventions

## Development
Requires Node.js 24.

```bash
npm install
cp .env.example .env.local   # then add your OpenAI key
npm run dev
```

See [CLAUDE.md §14](CLAUDE.md) for all commands, including tests and the capability probe.
