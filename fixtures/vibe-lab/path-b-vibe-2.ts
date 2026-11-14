/**
 * Artefact of the `spec vs vibe coding` laboratory — path B (vibe) (run 2 of 2).
 *
 * Produced by combo/cheap (InferHub) on 2026-11-14, from the prompt stored in `README.md` §2.
 * The code below is **verbatim** from the model; only this header was added.
 * It is never shipped: it is a measurement, and the test next to it is the ruler.
 */
export type TimeRange = {
  start: number;
  end: number;
};

export function mergeTimeRanges(
  ranges: readonly TimeRange[],
): TimeRange[] {
  if (ranges.length < 2) {
    return ranges.map((range) => ({ ...range }));
  }

  const sorted = [...ranges].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );

  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];

    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}
