import * as fc from 'fast-check';
import { expect } from 'vitest';
import { durationMs, findOverlaps, totalDurationMs } from './index.ts';
import type { Interval } from './index.ts';
import {
  invertedIntervalsArb,
  intervalsArb,
  malformedIntervalsArb,
  shuffleWith,
} from './test-support.ts';

/**
 * The normalising sweep under test: sorted, disjoint, maximal union of the inputs.
 *
 * The shipped implementation and the artefacts of the `spec vs vibe coding`
 * laboratory all have that shape, so the same contract is applied to each of them.
 */
export type Normalizer = (intervals: readonly Interval[]) => Interval[];

/** Every run of the contract uses the same budget, so the comparison is fair. */
export const RUNS = { numRuns: 200 } as const;

/**
 * A named property of the contract, quotable in a journal or a test name.
 *
 * Every property takes **one** argument — the array of ranges — so that the same ruler can be
 * applied to any implementation without knowing its arity.
 */
export interface ContractProperty {
  readonly id: string;
  readonly property: fc.IProperty<[Interval[]]>;
}

/** A deterministic seed derived from the input: the same ranges always get the same shuffle. */
function seedOf(intervals: readonly Interval[]): number {
  let seed = (intervals.length * 2_654_435_761) >>> 0;
  for (const interval of intervals) {
    seed = (Math.imul(seed ^ interval.start, 1_664_525) + Math.imul(interval.end, 1_013_904_223)) >>> 0;
  }
  return seed || 1;
}

/** HEU-P-01, criterion 3: a range whose bounds are empty or inverted is dropped. */
export function everyPieceIsNonEmpty(normalize: Normalizer): fc.IProperty<[Interval[]]> {
  return fc.property(malformedIntervalsArb, (xs) => {
    for (const piece of normalize(xs)) {
      expect(piece.end).toBeGreaterThan(piece.start);
    }
  });
}

/** HEU-P-01, criterion 3, read from the other side: an inverted input never survives. */
export function invertedRangesAreDropped(normalize: Normalizer): fc.IProperty<[Interval[]]> {
  return fc.property(invertedIntervalsArb, (xs) => {
    expect(normalize(xs)).toEqual([]);
  });
}

/** HEU-P-01, criteria 1 and 2: the output is sorted and no two pieces overlap. */
export function outputIsSortedAndDisjoint(normalize: Normalizer): fc.IProperty<[Interval[]]> {
  return fc.property(intervalsArb, (xs) => {
    const merged = normalize(xs);
    expect(findOverlaps(merged)).toEqual([]);
    for (let index = 1; index < merged.length; index += 1) {
      const previous = merged[index - 1];
      const current = merged[index];
      if (previous === undefined || current === undefined) continue;
      expect(previous.end).toBeLessThan(current.start);
    }
  });
}

/** HEU-P-03: the result does not depend on the order of the inputs. */
export function orderIndependent(normalize: Normalizer): fc.IProperty<[Interval[]]> {
  return fc.property(intervalsArb, (xs) => {
    expect(normalize(shuffleWith(xs, seedOf(xs)))).toEqual(normalize(xs));
    expect(normalize([...xs].reverse())).toEqual(normalize(xs));
  });
}

/** HEU-P-02: the covered time of the inputs is the covered time of the output. */
export function coveredTimeIsPreserved(normalize: Normalizer): fc.IProperty<[Interval[]]> {
  return fc.property(intervalsArb, (xs) => {
    const covered = normalize(xs).reduce((total, piece) => total + durationMs(piece), 0);
    expect(covered).toBe(totalDurationMs(xs));
  });
}

/** The union laws: idempotent, commutative, associative. */
export function unionLaws(normalize: Normalizer): fc.IProperty<[Interval[]]> {
  return fc.property(intervalsArb, (xs) => {
    const asSet = (values: readonly Interval[]): string => JSON.stringify(normalize(values));
    const split = Math.floor(xs.length / 2);
    const left = xs.slice(0, split);
    const right = xs.slice(split);
    expect(asSet(normalize(xs))).toBe(asSet(xs));
    expect(asSet([...left, ...right])).toBe(asSet([...right, ...left]));
    expect(asSet([...normalize(left), ...right])).toBe(asSet([...left, ...right]));
  });
}

/** The whole contract, in the order the journal quotes it. */
export function contract(normalize: Normalizer): ContractProperty[] {
  return [
    { id: 'HEU-P-01.c3.empty-piece', property: everyPieceIsNonEmpty(normalize) },
    { id: 'HEU-P-01.c3.inverted-dropped', property: invertedRangesAreDropped(normalize) },
    { id: 'HEU-P-01.c1c2.sorted-disjoint', property: outputIsSortedAndDisjoint(normalize) },
    { id: 'HEU-P-03.order', property: orderIndependent(normalize) },
    { id: 'HEU-P-02.covered-time', property: coveredTimeIsPreserved(normalize) },
    { id: 'laws.union', property: unionLaws(normalize) },
  ];
}
