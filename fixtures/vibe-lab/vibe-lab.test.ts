import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { union } from '../../packages/intervals/src/index.ts';
import { RUNS, contract } from '../../packages/intervals/src/properties.ts';
import type { Normalizer } from '../../packages/intervals/src/properties.ts';
import { normalize as pathASpec1 } from './path-a-spec-1.ts';
import { normalize as pathASpec2 } from './path-a-spec-2.ts';
import { normalize as pathASpec3 } from './path-a-spec-3.ts';
import { mergeTimeRanges as pathBVibe1 } from './path-b-vibe-1.ts';
import { mergeTimeRanges as pathBVibe2 } from './path-b-vibe-2.ts';
import { mergeTimeRanges as pathBVibe3 } from './path-b-vibe-3.ts';
import type { Interval } from '../../packages/intervals/src/index.ts';

/** One fixed seed, so the laboratory is reproducible on every machine. */
const SEED = 20261114;

/** The two properties criterion 3 of HEU-P-01 is about. */
const MALFORMED_PROPERTIES = ['HEU-P-01.c3.empty-piece', 'HEU-P-01.c3.inverted-dropped'];

interface Artefact {
  readonly id: string;
  readonly normalize: Normalizer;
}

const SPEC_ARTEFACTS: readonly Artefact[] = [
  { id: 'path-a-spec-1', normalize: pathASpec1 },
  { id: 'path-a-spec-2', normalize: pathASpec2 },
  { id: 'path-a-spec-3', normalize: pathASpec3 },
];

const VIBE_ARTEFACTS: readonly Artefact[] = [
  { id: 'path-b-vibe-1', normalize: pathBVibe1 },
  { id: 'path-b-vibe-2', normalize: pathBVibe2 },
  { id: 'path-b-vibe-3', normalize: pathBVibe3 },
];

/** Apply the shared contract to a normaliser and collect what fails. */
function runContract(normalize: Normalizer): { id: string; counterexample: unknown }[] {
  const failures: { id: string; counterexample: unknown }[] = [];
  for (const { id, property } of contract(normalize)) {
    const check = fc.check(property, { ...RUNS, seed: SEED });
    if (check.failed) failures.push({ id, counterexample: check.counterexample });
  }
  return failures;
}

/** fast-check reports the arguments of the property: `[xs]` for a unary property. */
const ranges = (counterexample: unknown): Interval[] => {
  const args = Array.isArray(counterexample) ? counterexample : [];
  const first = args[0];
  return Array.isArray(first) ? (first as Interval[]) : [];
};

const hasInverted = (xs: readonly Interval[]): boolean => xs.some((x) => x.end < x.start);

/**
 * What a normaliser does with a malformed range: drops it, keeps it, or throws.
 * Probed on an empty range and on an inverted one, in that order.
 */
function malformedBehaviour(normalize: Normalizer): string {
  const probe = (interval: Interval): string => {
    try {
      const output = normalize([interval]);
      return output.some((piece) => piece.end <= piece.start) ? 'keeps' : 'drops';
    } catch {
      return 'throws';
    }
  };
  return `${probe({ start: 0, end: 0 })}/${probe({ start: 0, end: -1 })}`;
}

describe('the shipped implementation honours the whole contract', () => {
  it('fails no property of the contract', () => {
    expect(runContract(union)).toEqual([]);
  });

  it('drops the malformed ranges instead of keeping or crashing on them', () => {
    expect(malformedBehaviour(union)).toBe('drops/drops');
  });
});

describe('path A (spec) honours the whole contract', () => {
  for (const artefact of SPEC_ARTEFACTS) {
    it(`fails no property (${artefact.id})`, () => {
      expect(runContract(artefact.normalize)).toEqual([]);
    });

    it(`drops the malformed ranges (${artefact.id})`, () => {
      expect(malformedBehaviour(artefact.normalize)).toBe('drops/drops');
    });
  }
});

describe('path B (vibe) fails exactly the malformed-range properties', () => {
  for (const artefact of VIBE_ARTEFACTS) {
    it(`fails the two properties of criterion 3 and no other (${artefact.id})`, () => {
      const failed = runContract(artefact.normalize).map((failure) => failure.id).sort();
      expect(failed).toEqual([...MALFORMED_PROPERTIES].sort());
    });

    it(`produces a shrunk counterexample that is readable (${artefact.id})`, () => {
      const failures = runContract(artefact.normalize);
      const inverted = failures.find((failure) => failure.id === 'HEU-P-01.c3.inverted-dropped');
      expect(ranges(inverted?.counterexample).length).toBeGreaterThan(0);
      expect(ranges(inverted?.counterexample).length).toBeLessThanOrEqual(6);
      expect(hasInverted(ranges(inverted?.counterexample))).toBe(true);
    });
  }

  it('never drops a malformed range, in any of the three samples', () => {
    const behaviours = VIBE_ARTEFACTS.map((artefact) => malformedBehaviour(artefact.normalize));
    expect(behaviours).toEqual(['keeps/keeps', 'keeps/keeps', 'drops/throws']);
  });
});
