import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  clampTo,
  coverageRatio,
  difference,
  durationMs,
  findOverlaps,
  gapsWithin,
  intersectSets,
  intersection,
  overlaps,
  splitAt,
  subtractAll,
  totalDurationMs,
  union,
} from './index.ts';
import type { Interval } from './index.ts';
import { RUNS, contract } from './properties.ts';
import {
  MAX_INSTANT,
  intervalArb,
  intervalsArb,
  nonEmptyIntervalArb,
  nonEmptyIntervalsArb,
} from './test-support.ts';

const anyOverlap = (a: readonly Interval[], b: readonly Interval[]): boolean =>
  a.some((left) => b.some((right) => left !== right && overlaps(left, right)));

const containerArb = fc
  .tuple(fc.integer({ min: 0, max: MAX_INSTANT }), fc.integer({ min: 1, max: MAX_INSTANT }))
  .map(([start, length]) => ({ start, end: start + length }));

describe('the normalising sweep honours its contract', () => {
  for (const { id, property } of contract(union)) {
    it(id, () => {
      fc.assert(property, RUNS);
    });
  }
});

describe('HEU-P-02 basis: covered time never exceeds the container', () => {
  it('HEU-P-02 basis: covered time never exceeds the container', () => {
    fc.assert(
      fc.property(containerArb, intervalsArb, (container, xs) => {
        const covered = intersectSets([container], xs);
        expect(totalDurationMs(covered)).toBeLessThanOrEqual(durationMs(container));
        expect(coverageRatio(xs, container)).toBeLessThanOrEqual(1);
      }),
      RUNS,
    );
  });
});

describe('HEU-P-04 basis: monotonicity', () => {
  it('HEU-P-04 basis: monotonicity', () => {
    fc.assert(
      fc.property(intervalsArb, intervalArb, containerArb, (xs, extra, container) => {
        const grown = [...xs, extra];
        expect(totalDurationMs(grown)).toBeGreaterThanOrEqual(totalDurationMs(xs));
        expect(coverageRatio(grown, container)).toBeGreaterThanOrEqual(
          coverageRatio(xs, container),
        );
      }),
      RUNS,
    );
  });
});

describe('difference and subtraction', () => {
  it('difference(a, b) plus the intersection covers exactly a', () => {
    fc.assert(
      fc.property(intervalArb, intervalArb, (a, b) => {
        const rest = difference(a, b);
        const common = intersection(a, b);
        const rebuilt = common === null ? rest : [...rest, common];
        expect(JSON.stringify(union(rebuilt))).toBe(JSON.stringify(union([a])));
        expect(totalDurationMs(rebuilt)).toBe(durationMs(a));
        expect(findOverlaps(rebuilt)).toEqual([]);
      }),
      RUNS,
    );
  });

  it('subtractAll never overlaps the removals and keeps the subject', () => {
    fc.assert(
      fc.property(intervalArb, intervalsArb, (subject, removals) => {
        const rest = subtractAll(subject, removals);
        expect(anyOverlap(rest, removals)).toBe(false);
        expect(findOverlaps(rest)).toEqual([]);
        expect(totalDurationMs(rest) + totalDurationMs(intersectSets([subject], removals))).toBe(
          durationMs(subject),
        );
      }),
      RUNS,
    );
  });
});

describe('splitAt and gaps', () => {
  it('splitAt conserves the total duration and the covered set', () => {
    fc.assert(
      fc.property(nonEmptyIntervalArb, fc.array(fc.integer({ min: -50, max: MAX_INSTANT })), (i, points) => {
        const pieces = splitAt(i, points);
        expect(totalDurationMs(pieces)).toBe(durationMs(i));
        expect(JSON.stringify(union(pieces))).toBe(JSON.stringify(union([i])));
        expect(findOverlaps(pieces)).toEqual([]);
      }),
      RUNS,
    );
  });

  it('gapsWithin plus the clamped coverage rebuilds the container', () => {
    fc.assert(
      fc.property(containerArb, nonEmptyIntervalsArb, (container, covered) => {
        const gaps = gapsWithin(container, covered, 0);
        const inside = intersectSets([container], covered);
        expect(totalDurationMs(gaps) + totalDurationMs(inside)).toBe(durationMs(container));
        expect(anyOverlap(gaps, covered)).toBe(false);
        expect(coverageRatio(covered, container)).toBeGreaterThanOrEqual(0);
        expect(coverageRatio(covered, container)).toBeLessThanOrEqual(1);
      }),
      RUNS,
    );
  });

  it('coverageRatio stays within [0, 1] and is monotone in the container', () => {
    fc.assert(
      fc.property(containerArb, nonEmptyIntervalsArb, (container, covered) => {
        const ratio = coverageRatio(covered, container);
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
        expect(coverageRatio(covered, container)).toBe(ratio);
        const clamped = covered
          .map((interval) => clampTo(interval, container))
          .filter((interval): interval is Interval => interval !== null);
        expect(totalDurationMs(clamped) / durationMs(container)).toBeCloseTo(ratio, 10);
      }),
      RUNS,
    );
  });
});
