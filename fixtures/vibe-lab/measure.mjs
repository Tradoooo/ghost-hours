#!/usr/bin/env node
/**
 * measure.mjs — re-runs the `spec vs vibe coding` measurement of `README.md`.
 *
 * It sends the two prompts (the plain one, and the one built from the specification of the
 * `intervals` lot), times each call, and writes the artefacts it gets back into the directory
 * it is given. It never writes inside the repository: the artefacts committed in this folder are
 * the ones the journal quotes, and this script is how they are re-measured.
 *
 *   node fixtures/vibe-lab/measure.mjs /tmp/vibe-lab-run
 *
 * The provider (model, endpoint, key) is read from `~/.zeroclaw/config.toml`; `ZEROCLAW_CONFIG`
 * points elsewhere. The two calls are independent, so their order is given on the command line:
 * `--order b,a` (default) or `--order a,b`. The journal runs both orders, because the first
 * call of a pair is systematically the slow one.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { PATH_B_PROMPT, pathAPrompt, specExcerpts } from './prompts.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const CONFIG = process.env.ZEROCLAW_CONFIG ?? path.join(homedir(), '.zeroclaw/config.toml');
const OUT = process.argv[2] ?? path.join(homedir(), 'tmp', 'vibe-lab-run');

/** The provider block of the local configuration: model, endpoint, key. */
function readProvider() {
  const config = readFileSync(CONFIG, 'utf8');
  const block = config.match(/\[providers\.models\.custom\.inferhub\]([\s\S]*?)(?=\n\[|$)/);
  if (block === null) throw new Error(`no inferhub provider in ${CONFIG}`);
  const field = (name) => block[1].match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];
  const provider = { model: field('model'), key: field('api_key'), uri: field('uri') };
  if (!provider.model || !provider.key || !provider.uri) {
    throw new Error(`the provider block in ${CONFIG} is incomplete`);
  }
  return provider;
}

/** The excerpts of the `intervals` specification, cut out of the two spec files. */
function readSpec() {
  const dir = path.join(REPO, '.kiro/specs/intervals');
  const requirements = readFileSync(path.join(dir, 'requirements.md'), 'utf8');
  const design = readFileSync(path.join(dir, 'design.md'), 'utf8');
  return specExcerpts(requirements, design);
}

/** One call to the model, timed. */
async function call(provider, prompt) {
  const started = process.hrtime.bigint();
  const response = await globalThis.fetch(`${provider.uri}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(`the model answered ${response.status}`);
  const payload = await response.json();
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return { text: payload.choices[0].message.content, seconds, usage: payload.usage ?? {} };
}

/** The first fenced code block of an answer. */
function firstCodeBlock(text) {
  const match = text.match(/```(?:ts|typescript)\n([\s\S]*?)```/);
  if (match === null) throw new Error('the answer carries no code block');
  return `${match[1].trimEnd()}\n`;
}

async function main() {
  const order = process.argv.includes('--order') ? process.argv[process.argv.indexOf('--order') + 1] : 'b,a';
  const provider = readProvider();
  const spec = readSpec();
  const prompts = {
    a: pathAPrompt(spec.requirements, spec.design),
    b: PATH_B_PROMPT,
  };
  const names = { a: 'path-a-spec', b: 'path-b-vibe' };
  mkdirSync(OUT, { recursive: true });
  const results = {};
  for (const key of order.split(',')) {
    const answer = await call(provider, prompts[key]);
    writeFileSync(path.join(OUT, `${names[key]}.ts`), firstCodeBlock(answer.text));
    writeFileSync(path.join(OUT, `${names[key]}.prompt.txt`), prompts[key]);
    results[names[key]] = { seconds: Number(answer.seconds.toFixed(2)), usage: answer.usage };
    process.stdout.write(`${names[key]} ${results[names[key]].seconds} s\n`);
  }
  writeFileSync(path.join(OUT, 'result.json'), `${JSON.stringify({ provider: provider.model, order, results }, null, 2)}\n`);
  process.stdout.write(`artefacts written in ${OUT}\n`);
}

await main();
