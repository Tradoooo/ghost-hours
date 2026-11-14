/**
 * Artefact of the `spec vs vibe coding` laboratory — path A (spec) (run 1 of 2).
 *
 * Produced by combo/cheap (InferHub) on 2026-11-14, from the prompt stored in `README.md` §2.
 * The code below is **verbatim** from the model; only this header was added.
 * It is never shipped: it is a measurement, and the test next to it is the ruler.
 */
export interface Range {
  start: number;
  end: number;
}

export function normalize(ranges: readonly Range[]): Range[] {
  const sorted = ranges
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const normalized: Range[] = [];

  for (const range of sorted) {
    const previous = normalized[normalized.length - 1];

    if (previous !== undefined && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      normalized.push({ start: range.start, end: range.end });
    }
  }

  return normalized;
}
