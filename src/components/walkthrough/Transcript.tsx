// The Transcript view (CLAUDE.md §8): the whole walkthrough as headings and text, with every value's label
// spelled out. The same content as the animated view, for screen readers and anyone who prefers reading.

import { read } from '@/shared/provenance/read';
import { plainText } from '@/shared/sourced-text';
import { CHAPTERS, type PlaybackScript } from '@/playback/types';

import { DEEP_DIVE_TITLES } from '@/content/deep-dives';
import { EXAMPLE_BANNER } from '@/content/walkthrough';
import { DEEP_DIVE_IDS } from '@/stages/deep-dives';
import type { FinalizedTrace } from '@/trace/facts';

import { Datum } from '@/components/provenance/Datum';
import { DeepDiveBody } from './DeepDive';
import { OptionTable } from './OptionTable';
import { RichText } from './RichText';

export function Transcript({ script, trace }: { script: PlaybackScript; trace: FinalizedTrace }) {
  return (
    <div className="transcript">
      <p className="muted">
        {script.steps.some((s) => s.scene.examples) ? <>{plainText(EXAMPLE_BANNER, read as never)} </> : null}
        Labels: Recorded (sent, done, reported, or measured by this app), Calculated (computed from recorded values), Reference
        (documented or measured earlier), Example (a teaching drawing).
      </p>
      {script.chapters.map((chapter) => (
        <section key={chapter.id} aria-labelledby={`transcript-${chapter.id}`}>
          <h3 id={`transcript-${chapter.id}`}>{CHAPTERS[chapter.id].title}</h3>
          <ol>
            {script.steps.slice(chapter.first, chapter.last + 1).map((step) => (
              <li key={step.key}>
                {step.scene.examples ? <strong>Example. </strong> : null}
                <RichText text={step.describe} />
                {step.scene.view === 'hook' ? <OptionTable token={step.scene.moment.token} /> : null}
                {step.scene.view === 'bars' || step.scene.view === 'meaning' ? <details><summary>Options for this step</summary><OptionTable token={step.scene.options.token} /></details> : null}
                {step.scene.view === 'moment' || step.scene.view === 'draw' ? <details><summary>Options for this step</summary><OptionTable token={step.scene.token} /></details> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section aria-labelledby="transcript-deeper">
        <h3 id="transcript-deeper">Go deeper</h3>
        {DEEP_DIVE_IDS.map((id) => (
            <section key={id} aria-labelledby={`transcript-dive-${id}`} className="transcript-dive">
              <h4 id={`transcript-dive-${id}`}>{DEEP_DIVE_TITLES[id]}</h4>
              <DeepDiveBody id={id} trace={trace} textOnly />
            </section>
        ))}
      </section>
      <section aria-labelledby="transcript-data">
        <h3 id="transcript-data">The input and reply</h3>
        {trace.request?.inputRuns.map((run) => <details key={run.key}>
          <summary>{run.role}: <Datum of={run.count} as="int" /> tokens (local estimate)</summary>
          <p><Datum of={run.text} as="text" /></p>
          <p>Calculated IDs, using the assumed tokenizer: <Datum of={run.ids} as="json" /></p>
        </details>)}
        <p><Datum of={trace.output.text} as="text" /></p>
        {trace.output.segments.map((segment, i) => segment.kind === 'gap' ? <p key={i}>
          <Datum of={segment.gap.text} as="text" /> — OpenAI returned no alternatives for these characters.
        </p> : <details key={i}>
          <summary><Datum of={segment.token.text} as="token" />: all returned options</summary>
          <OptionTable token={segment.token} />
        </details>)}
      </section>
    </div>
  );
}
