// The context policy (docs/PLAN.md §3.6): which earlier turns this app sends with a new message.
// Pure and shared; the server's result is authoritative and reported to the browser in `start`.
//
// - The instructions and the newest user message are always sent. If they alone don't fit, the request
//   fails with context_too_long rather than being cut.
// - Earlier messages are kept as one contiguous run of the most recent turns. An older turn is never kept
//   in place of a newer one, so the model sees an unbroken recent history.
// - A turn is a user message plus the replies that follow it; turns are kept or dropped whole.

export interface PolicyMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  /** This app's token count for the message text. */
  readonly tokens: number;
}

export interface ContextBudget {
  /** The most input tokens (estimated) this app sends per request. */
  readonly inputBudgetTokens: number;
  /** The most user turns sent, counting the new message. */
  readonly maxTurns: number;
  /** Formatting tokens OpenAI adds: per request and per message (instructions count as a message). */
  readonly overhead: { readonly perRequest: number; readonly perMessage: number };
}

export type DropReason = 'over_budget' | 'turn_limit';

export type PolicyResult =
  | {
      readonly ok: true;
      readonly included: readonly string[];
      readonly dropped: readonly { readonly id: string; readonly reason: DropReason }[];
      readonly estimatedInputTokens: number;
    }
  | { readonly ok: false; readonly reason: 'context_too_long'; readonly estimatedInputTokens: number };

interface Turn {
  readonly messages: readonly PolicyMessage[];
  readonly tokens: number;
  readonly users: number;
}

function groupTurns(messages: readonly PolicyMessage[], perMessage: number): Turn[] {
  const turns: PolicyMessage[][] = [];
  for (const m of messages) {
    const current = turns.at(-1);
    if (m.role === 'user' || current === undefined) turns.push([m]);
    else current.push(m);
  }
  return turns.map((ms) => ({
    messages: ms,
    tokens: ms.reduce((n, m) => n + m.tokens + perMessage, 0),
    users: ms.filter((m) => m.role === 'user').length,
  }));
}

export function estimateInputTokens(
  instructionsTokens: number | null,
  messageTokens: readonly number[],
  overhead: ContextBudget['overhead'],
): number {
  const instructions = instructionsTokens === null ? 0 : instructionsTokens + overhead.perMessage;
  return Math.ceil(overhead.perRequest + instructions + messageTokens.reduce((n, t) => n + t + overhead.perMessage, 0));
}

export function applyContextPolicy(
  input: { readonly instructionsTokens: number | null; readonly messages: readonly PolicyMessage[] },
  budget: ContextBudget,
): PolicyResult {
  const { messages } = input;
  const newest = messages.at(-1);
  if (!newest || newest.role !== 'user') throw new Error('the newest message must be from the user');

  const base = estimateInputTokens(input.instructionsTokens, [newest.tokens], budget.overhead);
  if (base > budget.inputBudgetTokens) return { ok: false, reason: 'context_too_long', estimatedInputTokens: base };

  const earlier = groupTurns(messages.slice(0, -1), budget.overhead.perMessage);
  let total = base;
  let users = 1;
  let keepFrom = earlier.length; // index of the oldest turn kept
  let reason: DropReason | null = null;
  for (let i = earlier.length - 1; i >= 0; i -= 1) {
    const turn = earlier[i];
    if (!turn) break;
    if (users + turn.users > budget.maxTurns) {
      reason = 'turn_limit';
      break;
    }
    if (total + turn.tokens > budget.inputBudgetTokens) {
      reason = 'over_budget';
      break;
    }
    total += turn.tokens;
    users += turn.users;
    keepFrom = i;
  }

  const dropped = earlier.slice(0, keepFrom).flatMap((turn) =>
    turn.messages.map((m) => ({ id: m.id, reason: reason ?? 'over_budget' })),
  );
  const included = [...earlier.slice(keepFrom).flatMap((turn) => turn.messages.map((m) => m.id)), newest.id];
  return { ok: true, included, dropped, estimatedInputTokens: total };
}
