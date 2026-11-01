import type { DigestRow, Night } from '../digest/types.js';

// Retries of 3 or more and any fail are marked; owner null shows as "—" (styleguide).
const RETRY_MARK = 3;

function Cell({ mark, children }: { mark: boolean; children: string }) {
  return <td class={mark ? "warn" : undefined}>{children}</td>;
}

function DigestRowView({ row }: { row: DigestRow }) {
  return (
    <tr>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <Cell mark={row.retries >= RETRY_MARK}>{String(row.retries)}</Cell>
      <Cell mark={row.lastStatus === 'fail'}>{row.lastStatus}</Cell>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.first}</td>
      <td>{row.last}</td>
    </tr>
  );
}

export function Digest({ night }: { night: Night }) {
  return (
    <>
      <h1>digest · {night.night}</h1>
      {night.badLines > 0 ? (
        <p class="mute">{`${night.badLines} ${night.badLines === 1 ? 'line' : 'lines'} did not parse`}</p>
      ) : null}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <DigestRowView row={row} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
