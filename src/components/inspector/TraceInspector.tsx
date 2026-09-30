// The Trace Inspector (docs/PLAN.md §4, Phase 1): every recorded and computed value for one turn, each
// with its label and source, before any visuals exist. The seed of the Transcript view.

import type { ReactNode } from 'react';

import { Datum } from '@/components/provenance/Datum';
import { ProvBadge } from '@/components/provenance/ProvBadge';
import { KIND_LABEL, sourceDetail, sourceLine, type Kind, type Sourced } from '@/shared/provenance';
import { read } from '@/shared/provenance/read';
import type { FinalizedTrace, OutputToken } from '@/trace/facts';

const OUTCOME_TEXT: Record<string, string> = {
  completed: 'Completed',
  incomplete: 'Incomplete',
  stopped: 'Stopped by you',
  interrupted: 'Interrupted',
  failed: 'Failed',
  rejected: 'Rejected before sending',
};

const STOP_TEXT: Record<string, string> = {
  end_marker: 'The model generated its end marker',
  output_limit: "Reached this app's output limit",
  content_filter: "Stopped by OpenAI's content filter",
  other_incomplete: 'Ended early (reason reported by OpenAI)',
  stopped_by_user: 'You pressed Stop',
  connection_lost: 'The connection ended before the reply finished',
  error: 'An error ended the reply',
  rejected: 'The request was rejected before anything was sent',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="inspector-section" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

const Mapped = ({ of, map }: { of: Sourced<string, Kind>; map: Record<string, string> }) => (
  <span className="datum" data-kind={of.p.kind}>
    <span className="datum-value">{map[read(of)] ?? read(of)}</span>
    <ProvBadge prov={of.p} />
  </span>
);

function TokenRow({ token }: { token: OutputToken }) {
  const top = token.alternatives.slice(0, 5);
  return (
    <tr data-close-call={read(token.closeCall) ? 'true' : undefined}>
      <td>{token.index + 1}</td>
      <td className="mono">
        <Datum of={token.text} as="token" compact />
      </td>
      <td>
        <Datum of={token.pct} as="pct" compact />
      </td>
      <td>
        {read(token.chosenRank) === null ? (
          <span className="datum" data-kind="calculated">
            <span className="datum-value">not listed</span>
            <ProvBadge prov={token.chosenRank.p} compact />
          </span>
        ) : (
          <Datum of={token.chosenRank as Sourced<number, 'calculated'>} as="int" compact />
        )}
      </td>
      <td>{read(token.closeCall) ? <Datum of={token.closeCall} as="bool" compact /> : null}</td>
      <td>{token.tokenId ? <Datum of={token.tokenId} as="id" compact /> : '—'}</td>
      <td className="mono alts">
        {top.map((alt, i) => (
          <span key={i} className={alt.isChosen ? 'alt alt-chosen' : 'alt'}>
            <Datum of={alt.text} as="token" badge={false} /> <Datum of={alt.pct} as="pct" badge={false} />
          </span>
        ))}
        <span className="sr-only">Alternatives are Recorded (reported by OpenAI); percentages are Calculated.</span>
      </td>
      <td>{token.arrivalAfterSend ? <Datum of={token.arrivalAfterSend} as="ms" compact /> : '—'}</td>
    </tr>
  );
}

export function TraceInspector({ trace }: { trace: FinalizedTrace }) {
  const { request, output, usage, timing } = trace;
  const closeCalls = read(trace.closeCalls);

  return (
    <div className="inspector">
      <p className="inspector-intro">
        Every value this app recorded or computed for this reply, with its label. <strong>Recorded</strong>: sent,
        done, reported, or measured here. <strong>Calculated</strong>: computed from recorded values.{' '}
        <strong>Reference</strong>: documented or measured earlier, with a date. No values here are examples.
      </p>

      <Section title="Summary" open>
        <table className="kv">
          <tbody>
            <Row label="Outcome">
              <Mapped of={trace.outcome} map={OUTCOME_TEXT} />
            </Row>
            <Row label="How it ended">
              <Mapped of={trace.stopReason} map={STOP_TEXT} />
            </Row>
            {trace.model ? (
              <Row label="Model (as reported)">
                <Datum of={trace.model} as="text" />
              </Row>
            ) : null}
            <Row label="Tokens returned with alternatives">
              <Datum of={output.providerTokenCount} as="int" />
            </Row>
            {output.gapTokenEstimate ? (
              <Row label="Tokens in text without alternatives (this app's count)">
                <Datum of={output.gapTokenEstimate} as="int" approx />
              </Row>
            ) : null}
            {trace.reasoningGate ? (
              <Row label="No hidden reasoning tokens">
                <Datum of={trace.reasoningGate} as="bool" />
              </Row>
            ) : null}
            <Row label="Tool calls returned">
              <Datum of={trace.toolCallsReturned} as="int" />
            </Row>
            {request ? (
              <Row label="Tools offered by this app">
                <Datum of={request.settings.toolsOffered} as="int" />
              </Row>
            ) : null}
            {trace.cost ? (
              <Row label={trace.cost.basis === 'usage' ? 'Cost' : 'Cost (estimated: OpenAI reported no usage)'}>
                <Datum of={trace.cost.usd} as="usd" approx={trace.cost.basis === 'estimate'} />
              </Row>
            ) : null}
          </tbody>
        </table>
      </Section>

      {request ? (
        <Section title="What this app sent">
          <table className="kv">
            <tbody>
              <Row label="Model requested">
                <Datum of={request.settings.model} as="text" />
              </Row>
              <Row label="Temperature">
                {read(request.settings.temperature) === null ? 'not sent' : <Datum of={request.settings.temperature as Sourced<number, 'recorded'>} as="logprob" />}
              </Row>
              <Row label="top_p">
                {read(request.settings.topP) === null ? 'not sent' : <Datum of={request.settings.topP as Sourced<number, 'recorded'>} as="logprob" />}
              </Row>
              <Row label="Alternatives requested per token">
                {read(request.settings.topLogprobs) === null ? 'none' : <Datum of={request.settings.topLogprobs as Sourced<number, 'recorded'>} as="int" />}
              </Row>
              <Row label="Output limit (tokens)">
                <Datum of={request.settings.maxOutputTokens} as="int" />
              </Row>
              <Row label="Stored by OpenAI for later use">
                <Datum of={request.settings.storedByProvider} as="bool" />
              </Row>
              <Row label="Messages included">
                <Datum of={request.context.included} as="list" />
              </Row>
              <Row label="Messages left out">
                <Datum of={request.context.dropped as Sourced<readonly { id: string; reason: string }[], 'recorded'> as unknown as Sourced<unknown, 'recorded'>} as="json" />
              </Row>
              <Row label="Input budget (tokens)">
                <Datum of={request.context.inputBudgetTokens} as="int" />
              </Row>
              <Row label="Estimated input tokens">
                <Datum of={request.context.estimatedInputTokens} as="int" approx />
              </Row>
              <Row label="Moderation model">
                <Datum of={request.moderation.model} as="text" />
              </Row>
              <Row label="Flagged by moderation">
                <Datum of={request.moderation.flagged} as="bool" />
              </Row>
            </tbody>
          </table>
          <h3>This app&apos;s instructions (word for word)</h3>
          <Datum of={request.instructions} as="text" block />
          <h3>The full request ({request.upstreamEndpoint})</h3>
          <Datum of={request.upstreamBody as unknown as Sourced<unknown, 'recorded'>} as="json" block />
          <h3>Tokens this app counted in what it sent</h3>
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Part</th>
                <th scope="col">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {request.inputRuns.map((run) => (
                <tr key={run.key}>
                  <td>{run.key === 'instructions' ? 'Instructions' : run.key}</td>
                  <td>
                    <Datum of={run.count} as="int" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {output.segments.length > 0 ? (
        <Section title="Tokens in the reply">
          <p>
            For each token: the chance of being picked (from the logprob OpenAI returned), its rank among the
            alternatives, and the top alternatives OpenAI listed. Close calls follow the rule “chosen under 50%, or
            the top two within 15 points”: they describe wording, not correctness.
          </p>
          <div className="table-scroll">
            <table className="grid tokens">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Token</th>
                  <th scope="col">Chance</th>
                  <th scope="col">Rank</th>
                  <th scope="col">Close call</th>
                  <th scope="col">Token ID (assumed tokenizer)</th>
                  <th scope="col">Top alternatives</th>
                  <th scope="col">Arrived after sending</th>
                </tr>
              </thead>
              <tbody>
                {output.segments.map((seg, i) =>
                  seg.kind === 'token' ? (
                    <TokenRow key={i} token={seg.token} />
                  ) : (
                    <tr key={i} className="gap-row">
                      <td>—</td>
                      <td className="mono">
                        <Datum of={seg.gap.text} as="token" compact />
                      </td>
                      <td colSpan={6}>
                        OpenAI returned no alternatives for these characters.
                        {seg.gap.estimatedTokens ? (
                          <>
                            {' '}
                            This app counts <Datum of={seg.gap.estimatedTokens} as="int" approx /> tokens.
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {closeCalls.all.length > 0 ? (
            <p>
              Close calls at tokens {closeCalls.all.map((i) => i + 1).join(', ')}.
              <ProvBadge prov={trace.closeCalls.p} />
            </p>
          ) : null}
        </Section>
      ) : null}

      {usage ? (
        <Section title="Usage reported by OpenAI">
          <table className="kv">
            <tbody>
              <Row label="Input tokens">
                <Datum of={usage.inputTokens} as="int" />
              </Row>
              <Row label="…of which cached (saved results for an identical start of a request; not memory)">
                <Datum of={usage.cachedInputTokens} as="int" />
              </Row>
              {usage.cacheWriteTokens ? (
                <Row label="…written to the cache">
                  <Datum of={usage.cacheWriteTokens} as="int" />
                </Row>
              ) : null}
              <Row label="Output tokens">
                <Datum of={usage.outputTokens} as="int" />
              </Row>
              <Row label="Reasoning tokens">
                <Datum of={usage.reasoningTokens} as="int" />
              </Row>
            </tbody>
          </table>
        </Section>
      ) : null}

      {trace.reconciliation.length > 0 ? (
        <Section title="Checks: this app's counts vs. OpenAI's">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">This app</th>
                <th scope="col">OpenAI / server</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {trace.reconciliation.map((line) => (
                <tr key={line.id} data-status={line.status}>
                  <th scope="row">{line.label}</th>
                  <td>{typeof read(line.ours) === 'number' ? <Datum of={line.ours as Sourced<number>} as="int" compact /> : <ProvBadge prov={line.ours.p} compact />}</td>
                  <td>{typeof read(line.theirs) === 'number' ? <Datum of={line.theirs as Sourced<number>} as="int" compact /> : <ProvBadge prov={line.theirs.p} compact />}</td>
                  <td>
                    <strong>{line.status === 'match' ? 'Match' : line.status === 'explained' ? 'Explained difference' : 'Mismatch'}</strong>
                    {'. '}
                    {line.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      <Section title="Timing (measured by this app)">
        <p>
          Waits include network travel and OpenAI&apos;s queue, so they aren&apos;t the model&apos;s processing time, and the time
          each token took to compute can&apos;t be observed.
        </p>
        <table className="kv">
          <tbody>
            {timing.durations.browserToFirstText ? (
              <Row label="First text arrived after sending (browser)">
                <Datum of={timing.durations.browserToFirstText} as="ms" />
              </Row>
            ) : null}
            {timing.durations.browserTotal ? (
              <Row label="Whole reply (browser)">
                <Datum of={timing.durations.browserTotal} as="ms" />
              </Row>
            ) : null}
            {timing.durations.serverModeration ? (
              <Row label="Moderation check (server)">
                <Datum of={timing.durations.serverModeration} as="ms" />
              </Row>
            ) : null}
            {timing.durations.serverToUpstreamOpen ? (
              <Row label="OpenAI accepted the request (server)">
                <Datum of={timing.durations.serverToUpstreamOpen} as="ms" />
              </Row>
            ) : null}
            {timing.durations.serverCreatedToFirstText ? (
              <Row label="From OpenAI's “response created” to first text (server)">
                <Datum of={timing.durations.serverCreatedToFirstText} as="ms" />
              </Row>
            ) : null}
            {timing.deliveryRate ? (
              <Row label="Delivery rate as received (browser)">
                <Datum of={timing.deliveryRate} as="rate" />
              </Row>
            ) : null}
          </tbody>
        </table>
        <h3>Tokens per streamed piece (at the server)</h3>
        <Datum of={output.tokensPerDelta as unknown as Sourced<unknown, 'calculated'>} as="json" block />
        <h3>Streamed pieces per network read (in this browser)</h3>
        <Datum of={output.eventsPerRead as unknown as Sourced<unknown, 'calculated'>} as="json" block />
      </Section>

      {trace.ledger ? (
        <Section title="Daily budget">
          <p>
            What this app charged against its daily budget for this reply (
            {read(trace.ledger).basis === 'usage' ? 'from reported usage' : read(trace.ledger).basis === 'estimate' ? 'estimated' : 'nothing was billed'}).
          </p>
          <Datum of={trace.ledger as unknown as Sourced<unknown, 'recorded'>} as="json" block />
        </Section>
      ) : null}

      {request ? (
        <Section title="Reference values used">
          <table className="grid">
            <thead>
              <tr>
                <th scope="col">Value</th>
                <th scope="col">Label</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Context window (tokens)', request.reference.contextWindowTokens],
                  ['Input price (USD per 1M tokens)', request.reference.inputPricePerMTokUsd],
                  ['Cached input price', request.reference.cachedInputPricePerMTokUsd],
                  ['Cache write price', request.reference.cacheWritePricePerMTokUsd],
                  ['Output price', request.reference.outputPricePerMTokUsd],
                  ['Output tokens counted but not returned as text', request.reference.hiddenOutputTokensPerReply],
                ] as const
              ).map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">
                    {label}: <Datum of={value} as={label.includes('price') ? 'logprob' : 'int'} badge={false} />
                  </th>
                  <td>{KIND_LABEL[value.p.kind]}</td>
                  <td>
                    {sourceLine(value.p)}. <span className="muted">{sourceDetail(value.p)}</span>
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row">
                  Tokenizer: <Datum of={request.reference.tokenizer} as="text" badge={false} />
                </th>
                <td>{KIND_LABEL.reference}</td>
                <td>{sourceLine(request.reference.tokenizer.p)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      ) : null}

      {trace.anomalies.length > 0 ? (
        <Section title="Anomalies" open>
          <ul>
            {trace.anomalies.map((a) => (
              <li key={a}>{a.replaceAll('_', ' ')}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
