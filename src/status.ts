import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countStatuses, readNight } from './digest/reader.js';
import type { RunStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

/** Last-status counts of one night on disk, for the board. */
export type NightCount = { night: string; counts: Record<RunStatus, number> };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  /** Nights on disk, newest first. */
  nights: string[];
  /** Same nights, same order, with their ok / retry / fail counts. */
  nightCounts: NightCount[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightCounts: nights.map((night) => {
      const n = readNight(config.runsDir, night);
      return { night, counts: n ? countStatuses(n) : { ok: 0, retry: 0, fail: 0 } };
    }),
  };
}
