/**
 * Artefact of the `spec vs vibe coding` laboratory — path A (spec) (run 3 of 3).
 *
 * Produced by combo/cheap (InferHub) on 2026-11-14, from the prompt stored in `README.md` §2.
 * The code below is **verbatim** from the model; only this header was added.
 * It is never shipped: it is a measurement, and the test next to it is the ruler.
 */
// normalize.ts
export interface Range {
  start: number;
  end: number;
}

/**
 * Merge overlapping or touching half-open ranges, drop empty/inverted ones,
 * and return the result sorted by `start`.
 *
 * Pure: no Date, no time zone, no I/O.
 */
export function normalize(ranges: readonly Range[]): Range[] {
  // Requirement 1.3 — drop empty (end === start) and inverted (end < start) ranges.
  const kept: Range[] = [];
  for (const r of ranges) {
    if (r.end > r.start) kept.push({ start: r.start, end: r.end });
  }

  // Requirement 1.2 — sort by start (ties broken by end for determinism).
  kept.sort((a, b) => (a.start - b.start) || (a.end - b.end));

  // Requirements 1.1, 1.4, 1.5 — merge overlapping *or touching* ranges.
  // Half-open: a.end === b.start is not an overlap, but they still merge.
  const out: Range[] = [];
  for (const r of kept) {
    const last = out[out.length - 1];
    if (last !== undefined && r.start <= last.end) {
      if (r.end > last.end) last.end = r.end; // extends the current block
      // otherwise r is fully contained: identical or swallowed (keep exactly one)
    } else {
      out.push({ start: r.start, end: r.end });
    }
  }
  return out;
}
