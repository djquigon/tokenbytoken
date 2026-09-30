'use client';

// The first-visit tour of the chat page (docs/PLAN.md §1, journey step 2): three short steps, the chat,
// the walkthrough, and the labels. Skippable at any point; Settings can show it again. Server-rendered,
// and hidden before paint once seen (see THEME_INIT_SCRIPT), so it never shifts the page.

import { useId, useState } from 'react';

import { prefsStore } from '@/components/prefs/store';
import { LabelChip } from '@/components/provenance/ProvBadge';

const STEPS = [
  {
    title: 'Ask a real AI model',
    body: 'Type a question. The reply streams in like any chatbot, from OpenAI’s API.',
  },
  {
    title: 'Then see how it was made',
    body: 'When the reply finishes, “How it works” walks through it step by step, at your pace. Play, pause, step, or skip at any time.',
  },
  {
    title: 'Know what’s real',
    body: 'Every value is labeled with where it came from. Anything marked Example is a teaching drawing, not this model’s data.',
  },
] as const;

/** `ready` is false until the page is interactive: the tour is server-rendered, and earlier clicks would be lost. */
export function Tour({ ready }: { ready: boolean }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const current = STEPS[step] ?? STEPS[0];
  const last = step === STEPS.length - 1;
  const done = () => prefsStore.getState().set({ tourSeen: true });
  return (
    <section className="tour notice" aria-labelledby={`${id}-title`}>
      <p className="eyebrow" data-control>
        Quick tour · {step + 1} of {STEPS.length}
      </p>
      <h2 id={`${id}-title`} className="notice-title">
        {current.title}
      </h2>
      <p>{current.body}</p>
      {last ? (
        <p className="tour-labels">
          <LabelChip kind="recorded" /> <LabelChip kind="calculated" /> <LabelChip kind="reference" /> <LabelChip kind="example" />
        </p>
      ) : null}
      <div className="notice-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-quiet" onClick={() => setStep((s) => s - 1)} disabled={!ready}>
            Back
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={last ? done : () => setStep((s) => s + 1)} disabled={!ready}>
          {last ? 'Start' : 'Next'}
        </button>
        {last ? null : (
          <button type="button" className="btn btn-quiet" onClick={done} disabled={!ready}>
            Skip the tour
          </button>
        )}
      </div>
    </section>
  );
}
