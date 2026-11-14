# The `spec vs vibe coding` laboratory

`KIRO_JOURNAL.md` §4 promised a comparison **before** it was run: the same prompt to the same
model, once with the specification and once without, then the same property test applied to both
results. This folder holds that comparison — the two prompts, the six artefacts the model
produced, the ruler that was applied to them, and the numbers.

**What is measured here**: the code quality of a specification, measured by a property suite
that already exists. **What is not**: everything that only a Kiro session can produce (the
IDE/CLI/Web split, the hook trigger counts, the effect of the three custom agents). Those stay
`TODO(measure)` in the journal — they are not here, and nothing in this folder pretends
otherwise.

## 1. The protocol

- **Function**: `normalize(ranges)` in `packages/intervals` — sort, merge touching or overlapping
  ranges, drop the empty and inverted ones.
- **Path A (spec)**: the requirements and the design of `.kiro/specs/intervals/` are given to the
  model, and it is asked for the implementation and a `fast-check` property.
- **Path B (vibe)**: the same model, the same day, the same parameters, one plain prompt:
  *"Write a function that merges overlapping time ranges."* No steering, no property, no spec.
- **Measured**: wall-clock duration, completion tokens, number of round trips (prompt → usable
  code), and the defects the **same** property suite finds in each result.
- **Ruler**: `packages/intervals/src/properties.ts` — six properties, one seed (`20261114`),
  `numRuns: 200`. The shipped implementation and the six artefacts are all measured with it.

## 2. The prompts (verbatim)

**Path B — vibe** (244 prompt tokens):

> Write a function that merges overlapping time ranges.
>
> TypeScript. A range is `{ start: number, end: number }` in epoch milliseconds, half-open
> `[start, end)`.
> Return the merged ranges.

**Path A — spec** (907 prompt tokens): the prompt is the excerpt of
`.kiro/specs/intervals/requirements.md` (requirement 1, HEU-P-01) and of
`.kiro/specs/intervals/design.md` (§7, the properties to test), followed by:

> Implement the function `normalize(ranges)` for a package called `intervals`.
> […]
> Deliver, in this order:
> 1. the TypeScript implementation of `normalize(ranges)` (pure: no `Date`, no time zone, no I/O);
> 2. a `fast-check` property test for HEU-P-01, with a fixed seed, using a generator of small
>    integer ranges so that a failing case is readable.
>
> Return only the two code blocks, nothing else.

The exact prompts are rebuilt from the repository by `prompts.mjs`, so they cannot drift from
the specification they quote.

## 3. The runs

Model `combo/cheap` (InferHub), temperature 0, 2026-11-14. Three runs, in alternating orders,
because the first call of a pair is systematically the slow one:

| run | order | path | wall-clock | completion tokens | of which reasoning | round trips |
|---|---|---|---|---|---|---|
| 1 | B → A | B (vibe) | 132.41 s | 995 | 730 | 1 |
| 1 | B → A | A (spec) | 31.84 s | 5 218 | 4 573 | 1 |
| 2 | A → B | A (spec) | 86.08 s | 10 415 | 9 497 | 1 |
| 2 | A → B | B (vibe) | 4.95 s | 803 | 515 | 1 |
| 3 | B → A | B (vibe) | 24.51 s | 4 507 | 4 102 | 1 |
| 3 | B → A | A (spec) | 218.70 s | 2 242 | 1 031 | 1 |

**Round trips: 1 for both paths, in all three runs.** The first answer of each path was kept as
it was. The spec answer passed the whole contract immediately; the vibe answer was never
corrected, because the vibe path has no property to correct it with.

## 4. What discriminates, and what is noise

Read the three columns of the table above as three distributions:

| metric | path A (spec) | path B (vibe) | discriminates? |
|---|---|---|---|
| wall-clock | 31.84 / 86.08 / 218.70 s | 132.41 / 4.95 / 24.51 s | **no** — the ranges overlap |
| reasoning tokens | 4 573 / 9 497 / 1 031 | 730 / 515 / 4 102 | **no** — the ranges overlap |
| round trips | 1 / 1 / 1 | 1 / 1 / 1 | no — identical |
| **defects found by the ruler** | **0 / 0 / 0** | **2 / 2 / 2** | **yes** — disjoint |

**The wall-clock is not a result.** The same vibe prompt took 132.41 s, then 4.95 s, then 24.51 s.
The latency belongs to the provider's queue, not to the path.

**The tokens are not a result either.** The third run inverts the order: the vibe answer burned
4 102 reasoning tokens against the spec answer's 1 031. Over three runs the two paths' token
ranges overlap (spec 1 031–9 497, vibe 515–4 102). An earlier version of this file claimed the
tokens were the discriminator; run 3 refuted it, and the claim is withdrawn rather than
softened.

**Only the defects discriminate.** The two distributions do not overlap: the code written from the
specification passes the whole contract three times out of three, the code written from the plain
prompt fails two properties three times out of three. Everything else that was measured — the
seconds, the tokens, the round trips — is provider noise that a reader could mistake for a
result.

## 5. The results

Same six properties, same seed, same budget:

| property | path A (3 samples) | path B (3 samples) |
|---|---|---|
| `HEU-P-01.c3.empty-piece` | pass | **fail** (3/3) |
| `HEU-P-01.c3.inverted-dropped` | pass | **fail** (3/3) |
| `HEU-P-01.c1c2.sorted-disjoint` | pass | pass |
| `HEU-P-03.order` | pass | pass |
| `HEU-P-02.covered-time` | pass | pass |
| `laws.union` | pass | pass |

Every vibe artefact fails the two properties of criterion 3 and the four others hold: the vibe
code merges overlapping **and touching** ranges correctly, and it never loses a range. The
failure is always the same criterion — *a malformed range must not survive* — but not always the
same **mode**, which is why the ruler probes the behaviour and not only the property:

| artefact | empty range (`end === start`) | inverted range (`end < start`) |
|---|---|---|
| `path-b-vibe-1` | survives in the output | survives in the output |
| `path-b-vibe-2` | survives in the output | survives in the output |
| `path-b-vibe-3` | dropped | **`RangeError` thrown** |

The third artefact is the interesting one: it drops the empty range correctly, and throws
`RangeError` on an inverted one. A test that only checked "does the property pass?" would have
recorded a defect without saying *how*; the probe says it, and the artefact says it in its own
code (`throw new RangeError("Range start must not be greater than end")`).

## 6. What the prediction said, and what happened

§4 of the journal predicted three failures for the vibe path. Two did not happen:

1. *touching ranges not merged* — **not observed**. The model wrote `range.start <= previous.end`,
   so touching ranges are merged. The journal's prediction was wrong, and says so.
2. *an inverted range surviving* — **observed**, in two samples out of three; in the third it
   throws instead of surviving, which is a defect of the same criterion.
3. *a `difference`-style merge that loses a range* — **not observed**.

One failure was **not predicted**: an empty range (`end === start`) survives. The specification
names it (criterion 3 covers `end <= start`), the plain prompt does not mention it, and the
model filled the gap the way it filled every other gap — by assuming the input is well formed.
Two of the three artefacts say so in their own words: *"assumes each range has `start <= end`"*.

## 7. The finding that mattered more than the comparison

The specification's own generator could not produce a malformed range: `.kiro/specs/intervals/
design.md` §7 draws `end = start + len` with `len >= 0`. **Criterion 3 was written but not
testable** — the property suite could not have caught either defect, on either path.

Widening the generator (`malformedIntervalArb`, `invertedIntervalsArb` in
`packages/intervals/src/test-support.ts`) turned the criterion into a detector, and the detector
separated the two paths on the first run. A specification nobody can test is a wish; the
generator is what makes it a rule.

## 8. Reproducing

```bash
node fixtures/vibe-lab/measure.mjs /tmp/vibe-lab-run
```

The script reads the provider from `~/.zeroclaw/config.toml` (`ZEROCLAW_CONFIG` overrides it),
sends the two prompts, times them, and writes the artefacts and `result.json` into the
directory it is given. It never writes inside the repository: the artefacts committed here are
the ones the journal quotes.

Then the ruler, on any machine, with no network:

```bash
pnpm vitest run fixtures/vibe-lab
```
