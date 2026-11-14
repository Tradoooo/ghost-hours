#!/usr/bin/env node
/**
 * demo.mjs — the whole demonstration, relaunched with one command.
 *
 * The demo has four parts that must never drift apart: the real month's
 * figures, the anchor that freezes them, the tests that recompute them, and the
 * static site that shows them. This script runs them in order and stops at the
 * first thing that breaks, so "the demo" is a command, not a memory.
 *
 *   node scripts/demo.mjs                # the whole chain
 *   node scripts/demo.mjs --from anchor  # resume from one step
 *   node scripts/demo.mjs --help
 *
 * Steps, in order:
 *   fixture  regenerate fixtures/real-month/expected.json from the evidence
 *   anchor   hash the day's proofs into a chained ledger, then verify it
 *   check    unit tests + typecheck + lint
 *   build    the static site
 *   browser  the built site in a real browser (`pnpm e2e`, self-served)
 *   record   (documented, not run: it needs the video rig and a display — see
 *            docs/DEMO.md or `~/Bureau/ghost-hours-video/record-real.mjs`)
 *
 * Collecting a *different* month is upstream of this script and is described in
 * docs/DEMO.md; the fixture ships already collected and anonymized, so a fresh
 * machine does not need the author's repositories.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;
const STEPS = ['fixture', 'anchor', 'check', 'build', 'browser'];

/** Same fallbacks as `e2e/playwright.config.ts`, in the same order. */
const BROWSER_FALLBACKS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/**
 * The browser of the chain. `GHOST_HOURS_BROWSER`, when set, is authoritative:
 * it names the one browser to use, and a value that does not exist must skip
 * loudly rather than fall back to another engine — a run that claims to check
 * WebKit and silently tests Chromium would prove nothing.
 */
function findBrowser() {
  const named = process.env.GHOST_HOURS_BROWSER ?? '';
  if (named.length > 0) return existsSync(named) ? named : undefined;
  return BROWSER_FALLBACKS.find((candidate) => existsSync(candidate));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: REPO, stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function stepFixture() {
  process.stdout.write('\n[1/5] fixture — the real month, recomputed\n');
  run('node', ['fixtures/real-month/regenerate.mjs']);
}

function stepAnchor() {
  process.stdout.write('\n[2/5] anchor — the proofs, frozen and verified\n');
  const anchors = join(tmpdir(), 'ghost-hours-demo-anchors.jsonl');
  if (existsSync(anchors)) rmSync(anchors);
  run('node', ['scripts/anchor-evidence.mjs', 'add', 'fixtures/real-month/evidence.json', anchors]);
  run('node', ['scripts/anchor-evidence.mjs', 'verify', 'fixtures/real-month/evidence.json', anchors]);
}

function stepCheck() {
  process.stdout.write('\n[3/5] check — tests, types, lint\n');
  run('pnpm', ['test']);
  run('pnpm', ['typecheck']);
  run('pnpm', ['lint']);
}

function stepBuild() {
  process.stdout.write('\n[4/5] build — the static site\n');
  run('pnpm', ['build']);
}

/**
 * The only step that proves the bundle boots in a real browser. It used to be
 * outside the chain, so `pnpm demo` went green while the shipped site was
 * showing a stale-CSS bug on desktop. A machine without a system browser
 * reports `skipped`, and the summary treats a skipped check as not a passed
 * one rather than swallowing it.
 */
function stepBrowser() {
  const browser = findBrowser();
  if (browser === undefined) {
    process.stdout.write(
      '\n[5/5] browser — SKIPPED, no system browser found\n' +
        '  install one, or point the chain at it: GHOST_HOURS_BROWSER=/path/to/chrome pnpm demo\n',
    );
    return 'skipped';
  }
  process.stdout.write(`\n[5/5] browser — the built site in ${browser}\n`);
  run('pnpm', ['e2e']);
  return undefined;
}

function printRecord() {
  process.stdout.write(
    '\nTo record the video, on a machine with a display and ffmpeg:\n' +
      '  node ~/Bureau/ghost-hours-video/record-real.mjs https://tradoooo.github.io/ghost-hours/\n',
  );
}

function printUsage() {
  process.stdout.write(
    'demo.mjs — relaunch the whole demonstration.\n\n' +
      'Usage:\n' +
      `  node scripts/demo.mjs [--from <step>]\n\n` +
      `Steps: ${STEPS.join(', ')} (record is documented, not run).\n`,
  );
}

function main(argv) {
  let from = 'fixture';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--help' || argv[index] === '-h') {
      printUsage();
      return 0;
    }
    if (argv[index] === '--from') {
      from = argv[++index];
      continue;
    }
    process.stderr.write(`demo: unknown argument ${argv[index]}\n`);
    printUsage();
    return 2;
  }
  const startIndex = STEPS.indexOf(from);
  if (startIndex === -1) {
    process.stderr.write(`demo: unknown step "${from}"\n`);
    return 2;
  }
  const runners = [
    { name: 'fixture', run: stepFixture },
    { name: 'anchor', run: stepAnchor },
    { name: 'check', run: stepCheck },
    { name: 'build', run: stepBuild },
    { name: 'browser', run: stepBrowser },
  ];
  const skipped = [];
  for (let index = startIndex; index < runners.length; index += 1) {
    const step = runners[index];
    if (step === undefined) continue;
    if (step.run() === 'skipped') skipped.push(step.name);
  }
  printRecord();
  if (skipped.length > 0) {
    process.stdout.write(
      `\ndemo: the steps before ran clean, but ${skipped.join(' and ')} was SKIPPED — that is not a pass.\n`,
    );
    return 3;
  }
  process.stdout.write('\ndemo: every step succeeded\n');
  return 0;
}

process.exit(main(process.argv.slice(2)));