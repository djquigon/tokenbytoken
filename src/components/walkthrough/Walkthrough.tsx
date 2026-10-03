'use client';

// The manual walkthrough (ADR 0014): the viewer chooses every step and section.
// React renders once per step; within-step motion is the --p custom property, written by
// the controller's progress stream straight to the stage element.

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { DecodeText } from '@/components/effects/DecodeText';
import { Datum } from '@/components/provenance/Datum';
import { usePrefs, useReducedMotion } from '@/components/prefs/hooks';
import { DEPTHS, prefsStore, type Depth } from '@/components/prefs/store';
import {
  ChapterNextIcon,
  ChapterPrevIcon,
  StepBackIcon,
  StepForwardIcon,
} from '@/components/ui/icons';
import { DEEP_DIVE_TITLES, type DeepDiveId } from '@/content/deep-dives';
import { EXAMPLE_BANNER } from '@/content/walkthrough';
import { compileScript } from '@/playback/compile/compile';
import { createPlaybackController, type PlaybackController } from '@/playback/controller';
import { CHAPTERS, type ChapterId, type PlaybackScript, type Step } from '@/playback/types';
import { read } from '@/shared/provenance/read';
import { plainText } from '@/shared/sourced-text';
import type { FinalizedTrace } from '@/trace/facts';

import { laneOf } from '@/stages/lanes';

import { DeepDive } from './DeepDive';
import { Lanes } from './Lanes';
import { RichText } from './RichText';
import { StageView } from './StageView';
import { TokenCard } from './TokenCard';
import { WhereFrom } from './WhereFrom';
import { Transcript } from './Transcript';

const DEPTH_LABEL: Record<Depth, string> = { simple: 'Simple', detailed: 'Detailed', technical: 'Technical' };
/** Deep dives offered beside each chapter; the last step offers all of them. */
const DIVES_BY_CHAPTER: Partial<Record<ChapterId, readonly DeepDiveId[]>> = {
  context: ['context', 'learning'],
  input: ['learning'],
  generation: ['temperature', 'fluent', 'guess'],
  ending: ['timing'],
  review: ['fluent', 'temperature', 'context', 'learning', 'timing', 'guess', 'check'],
};
const ALL_DIVES: readonly DeepDiveId[] = ['fluent', 'temperature', 'context', 'learning', 'timing', 'guess', 'check'];

const browserClock = {
  requestFrame: (cb: (t: number) => void) => requestAnimationFrame(cb),
  cancelFrame: (id: number) => cancelAnimationFrame(id),
  now: () => performance.now(),
};

/** Memoized: the chat page re-renders on pane switches and selection changes, which shouldn't redo this. */
export const Walkthrough = memo(function Walkthrough({
  trace,
  onFinished,
}: {
  trace: FinalizedTrace;
  /** Called once when the walkthrough ends or is skipped (unlocks the composer). */
  onFinished: (how: 'ended' | 'skipped') => void;
}) {
  const depth = usePrefs((s) => s.depth);
  const reduced = useReducedMotion();
  const compiled = useMemo(() => compileScript(trace, { depth }), [trace, depth]);
  const script = compiled.ok ? compiled.script : null;

  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });

  const [controller] = useState<PlaybackController | null>(() =>
    script ? createPlaybackController({ script, stepMode: reduced, clock: browserClock }) : null,
  );
  useEffect(() => () => controller?.destroy(), [controller]);
  useEffect(() => {
    if (controller && script && controller.getSnapshot().script !== script) controller.replaceScript(script);
  }, [controller, script]);
  useEffect(() => controller?.dispatch({ type: 'stepMode', on: reduced }), [controller, reduced]);
  useEffect(() => {
    if (!controller) return;
    const onVisibility = () => document.hidden && controller.dispatch({ type: 'hidden' });
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [controller]);


  const empty = useMemo(() => ({ subscribe: () => () => undefined, get: () => null }), []);
  const snapshot = useSyncExternalStore(controller?.subscribe ?? empty.subscribe, controller?.getSnapshot ?? empty.get, controller?.getSnapshot ?? empty.get);

  // Within-step progress goes straight to the panel element, never through React. The panel isn't
  // re-created per step (the stage is), so each navigation resets progress for the new stage.
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!controller) return;
    const set = (p: number) => panel.current?.style.setProperty('--p', p.toFixed(4));
    set(controller.getProgress());
    return controller.subscribeProgress(set);
  }, [controller]);
  useEffect(() => { controller?.dispatch({ type: 'animate' }); }, [controller]);

  // Reaching the last step or skipping unlocks the composer once.
  const skipping = useRef(false);
  const completed = useRef(false);
  const status = snapshot?.status;
  useEffect(() => {
    if (status !== 'ended' || completed.current) return;
    completed.current = true;
    finished.current(skipping.current ? 'skipped' : 'ended');
    skipping.current = false;
  }, [status]);

  const [transcript, setTranscript] = useState(false);
  const [focusToken, setFocusToken] = useState<number | null>(null);
  const [deepDive, setDeepDive] = useState<DeepDiveId | null>(null);
  const [whereFrom, setWhereFrom] = useState(false);
  const stepView = useRef<HTMLDivElement>(null);

  const current = snapshot ? snapshot.script.steps[snapshot.step] : undefined;

  if (!script || !controller || !snapshot || !current) {
    return (
      <section className="walkthrough walkthrough-empty" aria-label="How this reply was made">
        {!compiled.ok && (compiled.reason === 'hidden_reasoning' || compiled.reason === 'unknown_reasoning') ? (
          <>
            <h2>What we can show</h2>
            <p className="panel">
              {compiled.reason === 'hidden_reasoning' && trace.usage?.reasoningTokens ? <><Datum of={trace.usage.reasoningTokens} as="int" /> hidden tokens (count only).</> : 'Hidden-token count unavailable.'}
            </p>
            <p>OpenAI did not report zero hidden reasoning tokens. This app cannot show that hidden work, so the token-by-token walkthrough is unavailable for this reply.</p>
            <button type="button" className="btn" onClick={() => onFinished('skipped')}>Continue chatting</button>
          </>
        ) : <p>There is no walkthrough for this reply: nothing came back to show.</p>}
      </section>
    );
  }

  const dispatch = controller.dispatch;
  const scene = current.scene;
  const chapter = CHAPTERS[current.chapter];
  const dives = current.index === script.steps.length - 1 ? ALL_DIVES : (DIVES_BY_CHAPTER[current.chapter] ?? []);

  const skip = () => {
    skipping.current = true;
    dispatch({ type: 'skip' });
  };

  return (
    <section ref={panel} className="walkthrough" aria-labelledby="walkthrough-title" data-status={snapshot.status}>
      <header className="walkthrough-head">
        <div>
          <p className="eyebrow">How this reply was made</p>
          <h2 id="walkthrough-title">
            <DecodeText key={current.chapter} text={chapter.title} />
          </h2>
          {depth !== 'simple' && chapter.subtitle ? <p className="chapter-subtitle">{chapter.subtitle}</p> : null}
        </div>
        <div className="walkthrough-tools">
          <div className="segmented" role="group" aria-label="Depth">
            {DEPTHS.map((d) => (
              <button key={d} type="button" aria-pressed={d === depth} onClick={() => prefsStore.getState().set({ depth: d })}>
                {DEPTH_LABEL[d]}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-quiet" aria-pressed={transcript} onClick={() => setTranscript((v) => !v)}>
            {transcript ? 'Show the walkthrough' : 'Read as text'}
          </button>
        </div>
      </header>

      {transcript ? (
        <Transcript script={script} trace={trace} />
      ) : (
        <>
          <Lanes trace={trace} lane={laneOf(scene)} detailed={depth !== 'simple'} />
          {/* The step itself: what "Is this real?" reads its labels from. */}
          <div ref={stepView} className="step-view">
            <div className="caption">
              <h3 className="caption-title">
                <RichText text={scene.copy.title} />
              </h3>
              <p className="caption-body">
                <RichText text={scene.copy.body} />
              </p>
              {depth !== 'simple' && scene.copy.detail ? (
                <p className="caption-detail">
                  <RichText text={scene.copy.detail} />
                </p>
              ) : null}
              {depth === 'technical' && scene.copy.technical ? (
                <details className="technical">
                  <summary>Technical details</summary>
                  <p>
                    <RichText text={scene.copy.technical} />
                  </p>
                </details>
              ) : null}
            </div>
            {scene.examples ? (
              <details className="banner-examples">
                <summary><span className="example-tag-inline">Contains examples</span> Teaching drawing; not this model’s hidden work.</summary>
                <p><RichText text={EXAMPLE_BANNER} /></p>
              </details>
            ) : null}
            <div
              className="stage"
              data-stage={scene.stage}
              data-view={scene.view}
              data-step-mode={snapshot.stepMode ? 'true' : undefined}
              key={current.key}
            >
              <StageView
                scene={scene}
                trace={trace}
                onToken={(i) => {
                  setDeepDive(null);
                  setFocusToken(i);
                }}
              />
            </div>
          </div>
          <div className="caption-tools">
            <button
              type="button"
              className="btn btn-quiet"
              aria-expanded={whereFrom}
              aria-controls="where-from"
              onClick={() => {
                setWhereFrom((v) => !v);
              }}
            >
              {depth === 'simple' ? 'Is this real?' : 'How do we know this?'}
            </button>
            {dives.length > 0 ? (
              <nav className="go-deeper" aria-label="Go deeper">
                <span className="eyebrow">Go deeper</span>
                {dives.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn btn-quiet"
                    aria-expanded={deepDive === id}
                    onClick={() => {
                      setFocusToken(null);
                      setDeepDive(deepDive === id ? null : id);
                    }}
                  >
                    {DEEP_DIVE_TITLES[id]}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>
          {whereFrom ? (
            <section id="where-from" className="where-from-panel panel" aria-label={depth === 'simple' ? 'Is this real?' : 'How do we know this?'}>
              <WhereFrom root={stepView} stepKey={current.key} detailed={depth !== 'simple'} />
            </section>
          ) : null}
          {focusToken !== null ? <TokenCard trace={trace} index={focusToken} onClose={() => setFocusToken(null)} /> : null}
          {deepDive ? <DeepDive id={deepDive} trace={trace} onClose={() => setDeepDive(null)} /> : null}
        </>
      )}

      <PlayerBar script={script} controller={controller} onSkip={skip} />
      <Announcer step={current} total={script.steps.length} />
    </section>
  );
});

/** Navigation is deliberate, so announce each new step without a timer. */
function Announcer({ step, total }: { step: Step; total: number }) {
  return <div className="sr-only" aria-live="polite" aria-atomic="true">
    Step {step.index + 1} of {total}. {plainText(step.describe, read as never)}
  </div>;
}

function PlayerBar({
  script,
  controller,
  onSkip,
}: {
  script: PlaybackScript;
  controller: PlaybackController;
  onSkip: () => void;
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const dispatch = controller.dispatch;
  const ended = snapshot.step === script.steps.length - 1;
  const total = Math.max(1, script.totalMs);
  return (
    <div className="player" role="group" aria-label="Walkthrough controls">
      {/* The main row stays in reach while scrolling (pinned to the bottom on narrow screens). */}
      <div className="player-main">
        <button type="button" className="btn btn-icon" onClick={() => dispatch({ type: 'prev' })} disabled={snapshot.step === 0} aria-label="Previous step">
          <StepBackIcon />
        </button>
        <button type="button" className="btn btn-icon" onClick={() => dispatch({ type: 'next' })} disabled={ended} aria-label="Next step">
          <StepForwardIcon />
        </button>
        <span className="step-count">
          Step {snapshot.step + 1} of {script.steps.length}
        </span>
      </div>
      <div className="player-more">
        <button type="button" className="btn btn-icon" onClick={() => dispatch({ type: 'prevChapter' })} disabled={snapshot.step === 0} aria-label="Previous section">
          <ChapterPrevIcon />
        </button>
        <button type="button" className="btn btn-icon" onClick={() => dispatch({ type: 'nextChapter' })} disabled={ended} aria-label="Next section">
          <ChapterNextIcon />
        </button>
        <span className="player-spacer" />
        <button type="button" className="btn btn-quiet" onClick={onSkip}>
          Skip walkthrough
        </button>
      </div>
      <nav className="chapters" aria-label="Chapters">
        {script.chapters.map((c) => {
          const first = script.steps[c.first];
          const last = script.steps[c.last];
          const span = first && last ? last.startMs + last.durationMs - first.startMs : 0;
          const active = snapshot.step >= c.first && snapshot.step <= c.last;
          // The fill: whole for finished chapters; for the current one, finished steps plus this step's --p.
          const fill: Record<string, number> = active
            ? { '--done': snapshot.step - c.first, '--steps': c.last - c.first + 1 }
            : { '--done': snapshot.step > c.last ? 1 : 0, '--steps': 1, '--p': 0 };
          return (
            <button
              key={c.id}
              type="button"
              className="chapter-seg"
              style={{ '--w': span / total, ...fill } as React.CSSProperties}
              aria-current={active ? 'step' : undefined}
              data-done={snapshot.step > c.last ? 'true' : undefined}
              onClick={() => dispatch({ type: 'seekChapter', chapter: c.id })}
            >
              <span className="chapter-fill" aria-hidden="true" />
              <span className="chapter-name">{CHAPTERS[c.id].short}</span>
              <span className="sr-only">: {CHAPTERS[c.id].title}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
