import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The phone layer must stay scoped to the phone.
 *
 * A rebase conflict was once resolved by leaving two closing braces where one
 * belonged (commit `8cc57df`): the `@media` block closed early and every rule
 * after it — including `.week-timetable .block-client-picker { display: none }`
 * — applied on the desktop too, hiding the client picker on a big screen. The
 * build only warned about the stray brace, and no test looked at scope, so the
 * leak survived a deploy. This test reads the file and asserts the scoping,
 * which is cheaper than a browser and runs in the five-minute verdict.
 */

const CSS = readFileSync(new URL('./mobile.css', import.meta.url), 'utf8');

/** The file with comments removed, so a brace inside a comment cannot be counted. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  readonly selector: string;
  readonly depth: number;
  readonly line: number;
}

/** Every selector or at-rule that opens a block, with its nesting depth. */
function rules(): Rule[] {
  const found: Rule[] = [];
  let depth = 0;
  CODE.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    const opener = line.match(/^([^{}]+)\{$/);
    const selector = opener?.[1]?.trim();
    if (selector !== undefined) found.push({ selector, depth, line: index + 1 });
    for (const char of line) {
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }
  });
  return found;
}

describe('the phone layer keeps its media scope', () => {
  it('has balanced braces, so no block closes early', () => {
    const opens = CODE.split('{').length - 1;
    const closes = CODE.split('}').length - 1;
    expect(opens).toBe(closes);
  });

  it('declares exactly one media query, and it wraps the whole phone layer', () => {
    const medias = rules().filter((rule) => rule.selector.startsWith('@media'));
    expect(medias).toHaveLength(1);
    expect(medias[0]?.selector).toBe('@media (max-width: 720px)');
    expect(medias[0]?.depth).toBe(0);
  });

  it('puts every rule but the viewport-height one inside the media query', () => {
    const outside = rules()
      .filter((rule) => rule.depth === 0 && !rule.selector.startsWith('@media'))
      .map((rule) => rule.selector);
    expect(outside).toEqual(['.app-shell']);
  });

  it('scopes the three rules that were once leaked', () => {
    const leaked = [
      '.week-timetable .block-client-picker',
      '.block-actions button',
      'input[type=\'checkbox\']',
    ];
    for (const selector of leaked) {
      const rule = rules().find((candidate) => candidate.selector === selector);
      expect(rule, `${selector} is missing`).toBeDefined();
      expect(rule?.depth, `${selector} escaped the media query`).toBe(1);
    }
  });
});
