import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];
export const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error?: string };

function parse(text: string): Line | null {
  try {
    const v = JSON.parse(text) as Record<string, unknown>;
    if (typeof v !== 'object' || v === null) return null;
    if (typeof v.at !== 'string' || typeof v.job !== 'string') return null;
    if (!STATUSES.includes(v.status as RunStatus)) return null;
    if (v.owner !== null && typeof v.owner !== 'string' && v.owner !== undefined) return null;
    return {
      at: v.at,
      job: v.job,
      status: v.status as RunStatus,
      owner: (v.owner as string | null | undefined) ?? null,
      error: typeof v.error === 'string' ? v.error : undefined,
    };
  } catch {
    return null;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (raw.trim() === '') continue;
    const l = parse(raw);
    if (!l) {
      badLines++;
      continue;
    }
    const row = byJob.get(l.job);
    if (!row) {
      byJob.set(l.job, {
        job: l.job, owner: l.owner, runs: 1, retries: l.status === 'retry' ? 1 : 0,
        lastStatus: l.status, lastError: l.error ?? null, first: l.at, last: l.at,
      });
      continue;
    }
    row.runs++;
    if (l.status === 'retry') row.retries++;
    if (Date.parse(l.at) < Date.parse(row.first)) row.first = l.at;
    if (Date.parse(l.at) >= Date.parse(row.last)) {
      row.last = l.at;
      row.lastStatus = l.status;
      row.lastError = l.error ?? null;
      if (l.owner !== null) row.owner = l.owner;
    }
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};

/** Jobs of a night by their last status (ok / retry / fail), for the board. */
export function countStatuses(n: Night): Record<RunStatus, number> {
  const c = { ok: 0, retry: 0, fail: 0 };
  for (const r of n.rows) c[r.lastStatus]++;
  return c;
}
