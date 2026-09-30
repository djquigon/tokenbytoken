// The Transcript view (CLAUDE.md §8): the whole walkthrough as headings and text, with every value's label
// spelled out. The same content as the animated view, for screen readers and anyone who prefers reading.

import { read } from '@/shared/provenance/read';
import { plainText } from '@/shared/sourced-text';
import { CHAPTERS, type PlaybackScript } from '@/playback/types';

import { DEEP_DIVE_TITLES, EXERCISES } from '@/content/deep-dives';
import { EXAMPLE_BANNER } from '@/content/walkthrough';
import { DEEP_DIVE_IDS, deepDiveCopy, recordedWrongCase } from '@/stages/deep-dives';
import type { FinalizedTrace } from '@/trace/facts';

import { fluentCaseTrace } from './fluent-case';
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
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section aria-labelledby="transcript-deeper">
        <h3 id="transcript-deeper">Go deeper</h3>
        {DEEP_DIVE_IDS.filter((id) => !EXERCISES.has(id)).map((id) => {
          const copy = deepDiveCopy(id, trace, id === 'fluent' ? recordedWrongCase(fluentCaseTrace()) : null);
          return copy ? (
            <section key={id} aria-labelledby={`transcript-dive-${id}`} className="transcript-dive">
              <h4 id={`transcript-dive-${id}`}>{DEEP_DIVE_TITLES[id]}</h4>
              {copy.paragraphs.map((p, i) => (
                <p key={i}>
                  <RichText text={p} />
                </p>
              ))}
            </section>
          ) : null;
        })}
      </section>
    </div>
  );
}
