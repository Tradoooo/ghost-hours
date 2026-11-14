/**
 * Artefact of the `spec vs vibe coding` laboratory — path B (vibe) (run 3 of 3).
 *
 * Produced by combo/cheap (InferHub) on 2026-11-14, from the prompt stored in `README.md` §2.
 * The code below is **verbatim** from the model; only this header was added.
 * It is never shipped: it is a measurement, and the test next to it is the ruler.
 */
export interface TimeRange {
  start: number;
  end: number;
}

export function mergeTimeRanges(
  ranges: readonly TimeRange[],
): TimeRange[] {
  const sorted: TimeRange[] = [];

  for (const range of ranges) {
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
      throw new RangeError("Range bounds must be finite numbers");
    }
    if (range.start > range.end) {
      throw new RangeError("Range start must not be greater than end");
    }

    // Empty ranges do not affect the union.
    if (range.start < range.end) {
      sorted.push({ ...range });
    }
  }

  sorted.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];

    if (last === undefined || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }

  return merged;
}
