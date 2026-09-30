// The three lanes (docs/PLAN.md §2). At Simple depth, a one-line ticker says which lane the step is about.
// At Detailed depth, each lane lists this reply's recorded events in order, with the measured durations
// between them. Durations come from one clock each (browser or server) and are never mixed (CLAUDE.md
// L4). The time inside OpenAI's service isn't split into phases (A6).

import { Datum } from '@/components/provenance/Datum';
import { LANE_ORDER, LANES, type Lane } from '@/stages/lanes';
import type { FinalizedTrace } from '@/trace/facts';

function Ticker({ lane }: { lane: Lane }) {
  return (
    <p className="lane-ticker">
      <span className="sr-only">This step is about: </span>
      {LANE_ORDER.map((l, i) => (
        <span key={l} className="lane-name" data-lane={l} aria-current={l === lane ? 'true' : undefined}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          {LANES[l].title}
          {l === lane ? <span className="sr-only"> (this step)</span> : null}
        </span>
      ))}
    </p>
  );
}

function Event({ children }: { children: React.ReactNode }) {
  return <li className="lane-event">{children}</li>;
}

export function Lanes({ trace, lane, detailed }: { trace: FinalizedTrace; lane: Lane; detailed: boolean }) {
  if (!detailed) return <Ticker lane={lane} />;
  const d = trace.timing.durations;
  const usage = trace.usage;
  return (
    <div className="lanes" role="group" aria-label="Where each part happens">
      <div className="lane" data-lane="app" aria-current={lane === 'app' ? 'true' : undefined}>
        <p className="lane-title">
          {LANES.app.title} <span className="lane-note">{LANES.app.note}</span>
        </p>
        <ol className="lane-events">
          <Event>Request sent</Event>
          {d.serverModeration ? (
            <Event>
              Moderation check: <Datum of={d.serverModeration} as="ms" compact />
            </Event>
          ) : null}
          <Event>Sent on to OpenAI</Event>
          {d.browserTotal ? (
            <Event>
              Reply received, <Datum of={d.browserTotal} as="ms" compact /> after sending (this browser)
            </Event>
          ) : (
            <Event>Reply received</Event>
          )}
        </ol>
      </div>
      <div className="lane" data-lane="service" aria-current={lane === 'service' ? 'true' : undefined}>
        <p className="lane-title">
          {LANES.service.title} <span className="lane-note">{LANES.service.note}</span>
        </p>
        <ol className="lane-events">
          <Event>Response started</Event>
          {d.serverCreatedToFirstText ? (
            <Event>
              Wait before the first text: <Datum of={d.serverCreatedToFirstText} as="ms" compact /> (how it splits can&rsquo;t be seen)
            </Event>
          ) : null}
          {d.serverFirstToLastText ? (
            <Event>
              Text streamed for <Datum of={d.serverFirstToLastText} as="ms" compact />
            </Event>
          ) : (
            <Event>Text streamed</Event>
          )}
          {usage ? (
            <Event>
              Reported: <Datum of={usage.inputTokens} as="int" compact /> tokens in, <Datum of={usage.outputTokens} as="int" compact /> out
            </Event>
          ) : null}
        </ol>
      </div>
      <div className="lane" data-lane="model" aria-current={lane === 'model' ? 'true' : undefined}>
        <p className="lane-title">
          {LANES.model.title} <span className="lane-note">{LANES.model.note}</span>
        </p>
        <p className="lane-events muted">Nothing in this lane is measured: the steps marked Example draw how models like this work.</p>
      </div>
    </div>
  );
}
