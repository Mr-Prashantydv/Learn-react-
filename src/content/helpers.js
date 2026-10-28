/** Small helpers used by the chapter files to describe quests. */

/** A quest check: `run(t)` throws (or rejects) to fail. */
export function test(name, run, options = {}) {
  return { name, run, ...options };
}

/** A multiple-choice question. `answer` is the index of the right option. */
export function q(question, options, answer, explain) {
  return { question, options, answer, explain };
}

/**
 * Template tag for code and markdown. Uses the RAW string so backslashes in
 * code samples (`'\n'`, `/\d+/`) survive untouched. Only two escapes are
 * processed: \` becomes ` and \$ becomes $. It also strips the leading newline
 * and common indentation so content can be indented naturally in the source.
 */
export function code(strings, ...values) {
  const raw = strings.raw.reduce(
    (acc, s, i) => acc + s.replace(/\\([`$])/g, '$1') + (i < values.length ? String(values[i]) : ''),
    '',
  );
  const lines = raw.replace(/^\n/, '').replace(/\n[ \t]*$/, '').split('\n');
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(indent)).join('\n') + '\n';
}

export const md = code;
