import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countStatuses, readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const n = readNight('runs', '2026-10-28')!;

  it('has 5 jobs and 1 bad line', () => {
    expect(n.rows.map((r) => r.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(n.badLines).toBe(1);
  });

  it('aggregates runs, retries, last status and times', () => {
    const f = n.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(f).toMatchObject({ owner: 'rook', runs: 4, retries: 3, lastStatus: 'ok', lastError: null,
      first: '2026-10-29T01:30:00+01:00', last: '2026-10-29T01:37:00+01:00' });
    const b = n.rows.find((r) => r.job === 'notes/backup')!;
    expect(b).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
    const s = n.rows.find((r) => r.job === 'lane/sync')!;
    expect(s).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok' });
  });

  it('keeps a row with a null owner', () => {
    expect(n.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('counts jobs by last status', () => {
    expect(countStatuses(n)).toEqual({ ok: 4, retry: 0, fail: 1 });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(join(dir, '2026-01-02.jsonl'), 'not json\n{"at":"x","job":"a","status":"weird"}\n');

  it('returns null for a night with no file or a bad name', () => {
    expect(readNight(dir, '2026-01-09')).toBeNull();
    expect(readNight(dir, '../etc/passwd')).toBeNull();
  });

  it('an empty file has no rows', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('never throws on bad lines', () => {
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 2 });
  });
});
