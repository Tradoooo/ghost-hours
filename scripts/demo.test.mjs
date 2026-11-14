// @vitest-environment node
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The browser step of the demo chain is the one that proves the built site
 * boots, so its *absence* must be visible: before it was in the chain, `pnpm
 * demo` went green while a desktop CSS bug sat on the public site. This test
 * pins the contract of a skipped check — exit 3, and the word `SKIPPED` —
 * because a silent pass here would undo the whole point of the step.
 */

const SCRIPT = new URL('./demo.mjs', import.meta.url).pathname;

function run(args, env) {
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', env }) };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

describe('the demo chain reports a browser it does not have', () => {
  it('exits 3 and says SKIPPED when the named browser is absent', () => {
    const result = run(['--from', 'browser'], {
      ...process.env,
      GHOST_HOURS_BROWSER: '/nonexistent/browser',
    });
    expect(result.code).toBe(3);
    expect(result.out).toContain('SKIPPED');
    expect(result.out).not.toContain('every step succeeded');
  });

  it('does not fall back to another engine when the named browser is absent', () => {
    const result = run(['--from', 'browser'], {
      ...process.env,
      GHOST_HOURS_BROWSER: '/nonexistent/browser',
    });
    expect(result.out).not.toContain('the built site in');
  });

  it('lists the browser step in its usage', () => {
    const result = run(['--help'], process.env);
    expect(result.out).toContain('browser');
  });
});
