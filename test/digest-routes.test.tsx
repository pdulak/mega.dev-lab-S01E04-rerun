import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

// Fixtures live in a temp dir; runs/ is never touched.
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '' };

const line = (at: string, job: string, status: string, owner: string | null = 'rook', error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

// Jobs are written out of order on purpose, so sorting is tested.
const GOOD_NIGHT = [
  line('2026-10-30T01:00:00+01:00', 'zeta/rotate', 'ok'),
  line('2026-10-30T01:05:00+01:00', 'alpha/sync', 'retry'),
  line('2026-10-30T01:10:00+01:00', 'mid/backup', 'fail', null, 'quota exceeded'),
  line('2026-10-30T01:20:00+01:00', 'alpha/sync', 'ok'),
].join('\n') + '\n';

const BAD_NIGHT = [
  line('2026-11-01T02:00:00+01:00', 'beta/render', 'ok'),
  'not json at all',
  line('2026-11-01T02:05:00+01:00', 'alpha/fetch', 'fail', 'rook', 'timeout'),
].join('\n') + '\n';

const JOBS_GOOD = ['alpha/sync', 'mid/backup', 'zeta/rotate'];
const JOBS_BAD = ['alpha/fetch', 'beta/render'];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, '2026-10-30.jsonl'), GOOD_NIGHT);
  writeFileSync(join(runsDir, '2026-10-31.jsonl'), '');
  writeFileSync(join(runsDir, '2026-11-01.jsonl'), BAD_NIGHT);
  app = createApp({ ...config, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

/** Job names in the order they first appear in the HTML. */
function jobsInHtmlOrder(html: string, jobs: string[]): string[] {
  return jobs
    .map((job) => ({ job, at: html.indexOf(job) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.job);
}

describe('GET /digest/:night', () => {
  it('answers 200 HTML with a table that names every job', async () => {
    const res = await app.request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<table');
    for (const job of JOBS_GOOD) expect(html).toContain(job);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('answers 200 with the text "nothing ran" for an empty night file', async () => {
    const res = await app.request('/digest/2026-10-31');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('answers 200 and still lists the good jobs when a line is bad', async () => {
    const res = await app.request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of JOBS_BAD) expect(html).toContain(job);
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 JSON with night, rows and badLines', async () => {
    const res = await app.request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(body.night).toBe('2026-10-30');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_GOOD);
    expect(body.rows.find((r) => r.job === 'alpha/sync')).toMatchObject({
      runs: 2, retries: 1, lastStatus: 'ok', owner: 'rook',
    });
    expect(body.rows.find((r) => r.job === 'mid/backup')).toMatchObject({
      lastStatus: 'fail', lastError: 'quota exceeded', owner: null,
    });
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('answers 200 with rows [] for an empty night file', async () => {
    const res = await app.request('/api/digest/2026-10-31');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-31', rows: [], badLines: 0 });
  });

  it('counts a bad line in badLines and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_BAD);
  });
});

describe('digest page and JSON agree', () => {
  it.each([
    ['2026-10-30', JOBS_GOOD],
    ['2026-11-01', JOBS_BAD],
  ])('night %s lists the same jobs in the same order', async (night, jobs) => {
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as { rows: DigestRow[] };
    const jsonJobs = body.rows.map((r) => r.job);
    expect(jsonJobs).toEqual(jobs);
    expect(jobsInHtmlOrder(html, jobs)).toEqual(jsonJobs);
  });
});
