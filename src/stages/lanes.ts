// The three lanes (docs/PLAN.md §2): where each step happens.
// - "This app": what it sent, did, and measured (Recorded).
// - "OpenAI's service": a black box; only what it reports.
// - "Inside a model like this": Example views only.

import type { Scene } from './scenes';

export type Lane = 'app' | 'service' | 'model';

export const LANES: Readonly<Record<Lane, { readonly title: string; readonly note: string }>> = {
  app: { title: 'This app', note: 'What it sent, did, and measured' },
  service: { title: "OpenAI's service", note: 'A black box: only what it reports' },
  model: { title: 'Inside a model like this', note: 'Example views only' },
};

export const LANE_ORDER: readonly Lane[] = ['app', 'service', 'model'];

/** The lane a step is about. */
export function laneOf(scene: Scene): Lane {
  switch (scene.stage) {
    case 'context':
    case 'tokenize':
    case 'followup':
      return 'app';
    case 'embed':
    case 'layers':
      return 'model';
    case 'probs':
      // The score strip is a drawing; the listed options are what OpenAI reported.
      return scene.view === 'strip' ? 'model' : 'service';
    case 'sample':
      // The settings are what this app sent; the pick itself happens in OpenAI's service.
      return scene.view === 'settings' ? 'app' : 'service';
    case 'loop':
    case 'stop':
      return 'service';
  }
}
