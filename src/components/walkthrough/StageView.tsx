// Picks the view for a scene. Each view is a pure function of its scene; within-step motion comes only from
// the --p custom property on the stage container (CLAUDE.md §7).

import type { FinalizedTrace } from '@/trace/facts';

import { CardsView, ExtrasView, LayoutView } from '@/stages/context/View';
import { GaugeView, PackingView } from '@/stages/followup/View';
import { DecodeView, EndView, MomentView, MontageView } from '@/stages/loop/View';
import { AttentionView, LookupView, PrefillView } from '@/stages/network/View';
import { BarsView, HookView, StripView, UnavailableView } from '@/stages/probs/View';
import { DrawView, SettingsView } from '@/stages/sample/View';
import type { Scene } from '@/stages/scenes';
import { CalloutsView, ChipsView, CountView, IdsView } from '@/stages/tokenize/View';

export function StageView({ scene, trace, onToken }: { scene: Scene; trace: FinalizedTrace; onToken: (tokenIndex: number) => void }) {
  switch (scene.stage) {
    case 'probs':
      if (scene.view === 'hook') return <HookView scene={scene} />;
      if (scene.view === 'strip') return <StripView scene={scene} />;
      if (scene.view === 'unavailable') return <UnavailableView />;
      return <BarsView scene={scene} />;
    case 'context':
      if (scene.view === 'cards') return <CardsView scene={scene} />;
      if (scene.view === 'layout') return <LayoutView scene={scene} />;
      return <ExtrasView scene={scene} />;
    case 'tokenize':
      if (scene.view === 'chips') return <ChipsView scene={scene} />;
      if (scene.view === 'ids') return <IdsView scene={scene} />;
      if (scene.view === 'callouts') return <CalloutsView scene={scene} />;
      return <CountView scene={scene} />;
    case 'embed':
      return <LookupView scene={scene} />;
    case 'layers':
      if (scene.view === 'prefill') return <PrefillView scene={scene} />;
      if (scene.view === 'attention') return <AttentionView scene={scene} />;
      return <DecodeView scene={scene} />;
    case 'sample':
      if (scene.view === 'draw') return <DrawView scene={scene} />;
      return <SettingsView scene={scene} />;
    case 'loop':
      if (scene.view === 'moment') return <MomentView scene={scene} />;
      return <MontageView scene={scene} trace={trace} onToken={onToken} />;
    case 'stop':
      return <EndView scene={scene} trace={trace} onToken={onToken} />;
    case 'followup':
      if (scene.view === 'packing') return <PackingView scene={scene} />;
      return <GaugeView scene={scene} />;
  }
}
