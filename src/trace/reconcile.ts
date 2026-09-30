// Reconciliation (docs/PLAN.md §3.5, CLAUDE.md A13): compare what this app counted with what OpenAI
// reported, and always show both. A difference is explained or flagged, never silently corrected.

import { derive } from '@/shared/provenance';
import { recordedWith } from '@/shared/provenance/mint';
import { read } from '@/shared/provenance/read';
import type { EndEventV1 } from '@/shared/protocol/v1';
import { sha256Hex } from '@/shared/sha256';

import type { OutputFacts, ReconciliationLine, RequestFacts, UsageFacts } from './facts';
import { PROV } from './provs';

/** Input estimates within this many tokens (or 1%) are treated as explained formatting differences. */
const INPUT_TOLERANCE_TOKENS = 2;

export function reconcile(args: {
  request: RequestFacts | null;
  output: OutputFacts;
  usage: UsageFacts | null;
  end: EndEventV1 | null;
}): ReconciliationLine[] {
  const { request, output, usage, end } = args;
  const lines: ReconciliationLine[] = [];

  if (output.finalText) {
    const same = read(output.text) === read(output.finalText);
    lines.push({
      id: 'text_vs_final',
      label: 'Streamed text vs. final text',
      ours: output.text,
      theirs: output.finalText,
      difference: null,
      status: same ? 'match' : 'mismatch',
      note: same
        ? 'The streamed pieces join to exactly the final text OpenAI reported.'
        : "The streamed pieces don't join to OpenAI's final text. Both are shown as recorded.",
    });
  }

  if (end) {
    const ours = derive('text-hash-check', [output.text], (text) => sha256Hex(text));
    const theirs = recordedWith(PROV.relayHash, end.textSha256);
    const same = read(ours) === read(theirs);
    lines.push({
      id: 'relay_hash',
      label: 'Text received vs. text relayed',
      ours,
      theirs,
      difference: null,
      status: same ? 'match' : 'mismatch',
      note: same
        ? 'This browser received exactly the text the server relayed.'
        : "The text this browser received doesn't match what the server relayed, so this reply won't be re-sent.",
    });
  }

  if (usage && request && (output.source === 'provider' || output.source === 'provider_with_gaps')) {
    const hidden = request.reference.hiddenOutputTokensPerReply;
    const visible = output.providerTokenCount;
    const gapEstimate = output.gapTokenEstimate;
    const difference = derive('difference', [usage.outputTokens, visible], (reported, seen) => reported - seen);
    const diff = read(difference);
    const expectedHidden = read(hidden);
    const gap = gapEstimate ? read(gapEstimate) : 0;
    const status = diff === 0 ? 'match' : diff === expectedHidden + gap ? 'explained' : 'mismatch';
    const gapNote = gap > 0 ? ` About ${gap} more are in text that came without alternatives (this app's count).` : '';
    lines.push({
      id: 'output_tokens',
      label: 'Output tokens',
      ours: visible,
      theirs: usage.outputTokens,
      difference,
      status,
      note:
        status === 'mismatch'
          ? `OpenAI counted ${read(usage.outputTokens)}; ${read(visible)} came back with alternatives. The difference isn't fully explained.${gapNote}`
          : `OpenAI counted ${read(usage.outputTokens)}; ${read(visible)} came back with alternatives. This model's count always includes ${expectedHidden} tokens that aren't returned as text.${gapNote}`,
    });
  }

  if (usage && request) {
    const estimate = request.context.estimatedInputTokens;
    const difference = derive('difference', [usage.inputTokens, estimate], (reported, ours) => reported - ours);
    const diff = read(difference);
    const tolerance = Math.max(INPUT_TOLERANCE_TOKENS, Math.round(read(usage.inputTokens) * 0.01));
    lines.push({
      id: 'input_tokens',
      label: 'Input tokens',
      ours: estimate,
      theirs: usage.inputTokens,
      difference,
      status: diff === 0 ? 'match' : Math.abs(diff) <= tolerance ? 'explained' : 'mismatch',
      note:
        Math.abs(diff) <= tolerance
          ? "OpenAI wraps each message in formatting this app can't see, so this app estimates it."
          : "This app's estimate differs from OpenAI's count by more than usual.",
    });
  }

  return lines;
}
