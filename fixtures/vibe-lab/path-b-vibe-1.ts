/**
 * Artefact of the `spec vs vibe coding` laboratory — path B (vibe) (run 1 of 2).
 *
 * Produced by combo/cheap (InferHub) on 2026-11-14, from the prompt stored in `README.md` §2.
 * The code below is **verbatim** from the model; only this header was added.
 * It is never shipped: it is a measurement, and the test next to it is the ruler.
 */
export interface TimeRange {
  start: number;
  end: number;
}

export function mergeTimeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort(
    (a, b) => a.start - b.start || a.end - b.end
  );

  const merged: TimeRange[] = [];
  let current: TimeRange = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (next.start <= current.end) {
      // Overlapping or directly adjacent ranges.
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}
