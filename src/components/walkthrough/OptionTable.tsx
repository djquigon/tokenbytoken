import { Datum } from '@/components/provenance/Datum';
import type { OutputToken } from '@/trace/facts';

/** The complete returned list, with no animation or color needed to interpret it. */
export function OptionTable({ token }: { token: OutputToken }) {
  return (
    <div className="table-scroll" role="region" aria-label="Token options table" tabIndex={0}>
      <table className="what-if-table">
        <caption>
          Options for <Datum of={token.text} as="token" />. Chance of coming next, not chance of being true.
        </caption>
        <thead>
          <tr>
            <th scope="col">Recorded option</th>
            <th scope="col">Calculated chance</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {token.alternatives.map((a, i) => (
            <tr key={i}>
              <th scope="row"><Datum of={a.text} as="token" /></th>
              <td><Datum of={a.pct} as="pct" /></td>
              <td>{a.isChosen ? 'Picked' : ''}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">All unlisted tokens together</th>
            <td><Datum of={token.remainderPct} as="pct" /></td>
            <td />
          </tr>
          {!token.alternatives.some((a) => a.isChosen) ? (
            <tr>
              <th scope="row"><Datum of={token.text} as="token" /></th>
              <td><Datum of={token.pct} as="pct" /></td>
              <td>Picked; included in the unlisted total above</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
