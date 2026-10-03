// The walkthrough as data (docs/PLAN.md §3.5). A PlaybackScript is a pure function of a FinalizedTrace and
// the viewer's preferences. Durations are teaching time, never measured time (CLAUDE.md A6).

import type { Depth } from '@/components/prefs/store';
import type { SourcedText } from '@/shared/sourced-text';
import type { PlaybackMs } from '@/shared/units';
import type { Scene } from '@/stages/scenes';

export type ChapterId = 'context' | 'input' | 'generation' | 'ending' | 'review';

export interface ChapterInfo {
  readonly id: ChapterId;
  readonly title: string;
  /** Compact timeline label; the complete title remains in its accessible name. */
  readonly short: string;
  readonly subtitle: string | null;
}

export const CHAPTERS: Readonly<Record<ChapterId, ChapterInfo>> = {
  context: { id: 'context', title: 'What goes into the model', short: 'What goes in', subtitle: 'Context assembly' },
  input: { id: 'input', title: 'What happens to your message', short: 'Your message', subtitle: 'Input processing: tokenization and the prompt pass' },
  generation: { id: 'generation', title: 'How the model builds its reply', short: 'Building the reply', subtitle: 'Output generation: scores, selection, and repeated model passes' },
  ending: { id: 'ending', title: 'How the reply ends', short: 'End', subtitle: 'The recorded stop reason' },
  review: { id: 'review', title: 'A closer look at your reply', short: 'Review', subtitle: 'Recorded token choices' },
};

export interface Step {
  readonly index: number;
  readonly chapter: ChapterId;
  /** Stable across recompiles, so changing depth keeps the viewer's place. */
  readonly key: string;
  readonly scene: Scene;
  readonly startMs: PlaybackMs;
  readonly durationMs: PlaybackMs;
  /** Pause at the end of this step (close-call moments), so the viewer can take it in. */
  readonly autoPause: boolean;
  /** The text alternative for exactly this step. */
  readonly describe: SourcedText;
}

export interface ChapterSpan {
  readonly id: ChapterId;
  readonly first: number;
  readonly last: number;
}

export interface PlaybackScript {
  readonly turnId: string;
  readonly depth: Depth;
  readonly steps: readonly Step[];
  readonly chapters: readonly ChapterSpan[];
  readonly totalMs: PlaybackMs;
}
