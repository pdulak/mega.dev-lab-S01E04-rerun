// The digest contract (plan.md § 1). Every part of § 2 builds against this file only.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job of one night, aggregated from runs/<night>.jsonl. */
export type DigestRow = {
  job: string;
  /** null when the log line had no owner; views show it as "—". */
  owner: string | null;
  /** Lines logged for this job. */
  runs: number;
  /** Lines with status "retry". */
  retries: number;
  lastStatus: RunStatus;
  /** error of the last line, if it had one. */
  lastError: string | null;
  /** ISO time of the first and the last line. */
  first: string;
  last: string;
};

export type Night = {
  night: string;
  /** Sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse; counted, never thrown. */
  badLines: number;
};

/**
 * Reads runs/<night>.jsonl. Returns null when the night has no file.
 * An empty file gives rows: [].
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
