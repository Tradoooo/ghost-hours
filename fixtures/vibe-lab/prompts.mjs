/**
 * The two prompts of the `spec vs vibe coding` laboratory.
 *
 * They are rebuilt from the repository so that they cannot drift from the specification they
 * quote. `measure.mjs` sends them; the journal quotes what came back.
 */

/** Path B — vibe coding: one plain prompt, no steering, no property, no specification. */
export const PATH_B_PROMPT = `Write a function that merges overlapping time ranges.

TypeScript. A range is \`{ start: number, end: number }\` in epoch milliseconds, half-open \`[start, end)\`.
Return the merged ranges.`;

/** Path A — spec coding: the requirements and the design of the `intervals` lot. */
export function pathAPrompt(requirements, design) {
  return `Implement the function \`normalize(ranges)\` for a package called \`intervals\`.

Here is the specification to implement (requirements and design, verbatim excerpts).

--- requirements.md ---
${requirements.trim()}
--- design.md ---
${design.trim()}
--- end of specification ---

Deliver, in this order:
1. the TypeScript implementation of \`normalize(ranges)\` (pure: no \`Date\`, no time zone, no I/O);
2. a \`fast-check\` property test for HEU-P-01, with a fixed seed, using a generator of small
   integer ranges so that a failing case is readable.

Return only the two code blocks, nothing else.`;
}

/** The excerpts of the specification, cut out of the two spec files. */
export function specExcerpts(requirementsText, designText) {
  const requirements = slice(requirementsText, '### Requirement 1 — HEU-P-01', '### Requirement 2');
  const design = slice(designText, '## 7. Properties to test', '## 8.');
  if (requirements === '' || design === '') {
    throw new Error('the specification no longer carries the sections the prompt quotes');
  }
  return { requirements, design };
}

/** The text between two markers, or an empty string when a marker moved. */
function slice(text, start, end) {
  const from = text.indexOf(start);
  if (from < 0) return '';
  const to = text.indexOf(end, from);
  return text.slice(from, to < 0 ? text.length : to);
}
