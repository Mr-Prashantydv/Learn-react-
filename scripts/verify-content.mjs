#!/usr/bin/env node
/**
 * Verifies every quest in the game:
 *   - schema checks (ids, required fields, quiz answers in range, ...)
 *   - the reference SOLUTION passes every check
 *   - the STARTER code fails at least one check (so the quest isn't free)
 *
 * Usage:
 *   npm run verify                  # everything
 *   npm run verify -- jsx-shore     # only chapters whose id/file contains "jsx-shore"
 *   npm run verify -- --verbose     # print every check
 */
import './dom-env.mjs';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const filters = args.filter((a) => !a.startsWith('--'));

const { chapters } = await import('../src/content/index.js');
const { runQuestTests } = await import('../src/engine/runner.js');

const LEVEL_TYPES = new Set(['code', 'quiz', 'bug', 'build']);
let failures = 0;
let checked = 0;
const ids = new Set();
const conceptIds = new Set();

function problem(where, msg) {
  failures++;
  console.log(`  \x1b[31m✗ ${where}: ${msg}\x1b[0m`);
}

for (const chapter of chapters) {
  const wanted = !filters.length || filters.some((f) => chapter.id.includes(f) || (chapter.file || '').includes(f));
  // Schema checks always run on everything (cheap), solution runs only when selected.
  for (const field of ['id', 'title', 'short', 'subtitle', 'icon', 'colors', 'scenery', 'intro', 'levels']) {
    if (chapter[field] === undefined) problem(chapter.id || '?', `chapter is missing "${field}"`);
  }
  if (!wanted) continue;
  console.log(`\n\x1b[36m${chapter.icon} ${chapter.title}\x1b[0m (${chapter.levels.length} levels)`);
  const bosses = chapter.levels.filter((l) => l.boss);
  if (bosses.length !== 1) problem(chapter.id, `expected exactly one boss level, found ${bosses.length}`);
  for (const level of chapter.levels) {
    const where = `${chapter.id}/${level.id}`;
    if (ids.has(level.id)) problem(where, 'duplicate level id');
    ids.add(level.id);
    if (!LEVEL_TYPES.has(level.type)) problem(where, `unknown type "${level.type}"`);
    for (const field of ['title', 'blurb', 'xp']) if (!level[field]) problem(where, `missing "${field}"`);
    if (level.boss && !level.badge) problem(where, 'boss levels must award a badge');
    for (const c of level.concepts || []) {
      if (!c.id || !c.title || !c.summary) problem(where, `concept missing id/title/summary`);
      if (conceptIds.has(c.id)) problem(where, `duplicate concept id "${c.id}"`);
      conceptIds.add(c.id);
    }

    if (level.type === 'quiz') {
      if (!Array.isArray(level.questions) || level.questions.length < 3) problem(where, 'quiz needs at least 3 questions');
      (level.questions || []).forEach((q, i) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length < 2) problem(where, `question ${i + 1} malformed`);
        if (!(q.answer >= 0 && q.answer < q.options.length)) problem(where, `question ${i + 1} answer index out of range`);
        if (!q.explain) problem(where, `question ${i + 1} has no explanation`);
      });
      checked++;
      console.log(`  \x1b[32m✓\x1b[0m ${level.title} \x1b[2m(quiz, ${level.questions?.length} questions)\x1b[0m`);
      continue;
    }

    for (const field of ['lesson', 'task', 'starter', 'solution', 'tests']) if (!level[field]) problem(where, `missing "${field}"`);
    if (!Array.isArray(level.hints) || level.hints.length < 2) problem(where, 'needs at least 2 hints');
    if (!Array.isArray(level.tests) || level.tests.length < 2) problem(where, 'needs at least 2 tests');

    const solved = await runQuestTests(level, level.solution);
    const solutionOk = !solved.error && solved.results.every((r) => r.pass);
    if (!solutionOk) {
      if (solved.error) problem(where, `solution does not run: ${solved.error.message}`);
      for (const r of solved.results) if (!r.pass) problem(where, `solution fails "${r.name}": ${r.message}`);
    }
    const started = await runQuestTests(level, level.starter);
    const starterFails = Boolean(started.error) || started.results.some((r) => !r.pass);
    if (!starterFails) problem(where, 'starter code already passes every check — the quest would be free');
    if (started.error && started.error.kind === 'syntax' && !level.starterHasSyntaxError)
      problem(where, `starter has a syntax error (${started.error.message}). Set starterHasSyntaxError: true if intended.`);

    checked++;
    if (solutionOk && starterFails) {
      console.log(
        `  \x1b[32m✓\x1b[0m ${level.title} \x1b[2m(${level.tests.length} checks; starter fails ${
          started.error ? 'to compile/run' : started.results.filter((r) => !r.pass).length + ' of them'
        })\x1b[0m`,
      );
      if (verbose) {
        for (const r of started.results) console.log(`      starter ${r.pass ? '✓' : '✗'} ${r.name} ${r.message ? '— ' + r.message : ''}`);
      }
    }
  }
}

console.log(
  failures
    ? `\n\x1b[31m${failures} problem(s) found across ${checked} level(s).\x1b[0m`
    : `\n\x1b[32mAll ${checked} level(s) verified.\x1b[0m`,
);
process.exit(failures ? 1 : 0);
