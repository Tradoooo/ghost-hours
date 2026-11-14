/**
 * Artefact of the `spec vs vibe coding` laboratory — path A (spec) (run 2 of 2).
 *
 * Produced by combo/cheap (InferHub) on 2026-11-14, from the prompt stored in `README.md` §2.
 * The code below is **verbatim** from the model; only this header was added.
 * It is never shipped: it is a measurement, and the test next to it is the ruler.
 */
export function normalize(
  ranges: ReadonlyArray<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      if (a.end !== b.end) return a.end < b.end ? -1 : 1;
      return 0;
    });

  const normalized: Array<{ start: number; end: number }> = [];

  for (const range of sorted) {
    const previous = normalized[normalized.length - 1];

    if (previous === undefined) {
      normalized.push({ start: range.start, end: range.end });
    } else if (range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      normalized.push({ start: range.start, end: range.end });
    }
  }

  return normalized;
}
