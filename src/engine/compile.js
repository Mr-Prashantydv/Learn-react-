import { transform } from 'sucrase';

/**
 * Compile the player's JSX/ESM source into CommonJS that can be evaluated
 * inside the sandbox. We use sucrase because it is tiny, fast and runs in the
 * browser without any extra setup.
 */
export function compileSource(source) {
  const { code } = transform(source, {
    transforms: ['jsx', 'imports'],
    jsxRuntime: 'automatic',
    production: true,
    filePath: 'App.jsx',
  });
  return addLoopGuards(code);
}

/**
 * Best-effort protection against `while (true) {}` style mistakes: every
 * `for`/`while`/`do…while` loop condition gets a call to the guard prepended
 * (`while (c)` → `while (__loopGuard() && (c))`), so brace-less bodies are
 * covered too. `for…in`/`for…of` loops get the guard at the start of a
 * `{` body. The guard throws once a loop has been spinning for too long.
 *
 * Keywords inside strings, templates, comments and regex literals are left
 * alone. If anything about the result looks wrong (it fails to parse), we
 * fall back to the unguarded code — a hung tab is better than broken valid
 * code.
 */
export function addLoopGuards(code) {
  const mask = codeMask(code);
  const n = code.length;
  const inserts = [];
  const isCode = (k) => mask[k] === CODE;
  const skipGap = (k) => {
    while (k < n && (mask[k] === COMMENT || (isCode(k) && /\s/.test(code[k])))) k++;
    return k;
  };

  for (let i = 0; i < n; i++) {
    if (!isCode(i) || !/[A-Za-z_$]/.test(code[i]) || (i > 0 && isCode(i - 1) && /[\w$]/.test(code[i - 1]))) continue;
    let end = i;
    while (end < n && isCode(end) && /[\w$]/.test(code[end])) end++;
    const word = code.slice(i, end);
    if (word !== 'for' && word !== 'while') {
      i = end - 1;
      continue;
    }
    // Skip property accesses such as `obj.while`.
    let b = i - 1;
    while (b >= 0 && (mask[b] === COMMENT || (isCode(b) && /\s/.test(code[b])))) b--;
    if (b >= 0 && isCode(b) && code[b] === '.') continue;
    const open = skipGap(end);
    if (code[open] !== '(' || !isCode(open)) continue;
    const close = matchParen(code, mask, open);
    if (close === -1) continue;

    if (word === 'while') {
      inserts.push([open + 1, '__loopGuard() && ('], [close, ')']);
      continue;
    }
    // `for (init; test; update)`: find the two top-level semicolons.
    const semis = [];
    let depth = 0;
    for (let k = open + 1; k < close; k++) {
      if (!isCode(k)) continue;
      const ch = code[k];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === ';' && depth === 0) semis.push(k);
    }
    if (semis.length === 2) {
      const [s1, s2] = semis;
      let empty = true;
      for (let k = s1 + 1; k < s2; k++) {
        if (mask[k] !== COMMENT && !/\s/.test(code[k])) {
          empty = false;
          break;
        }
      }
      if (empty) inserts.push([s1 + 1, ' __loopGuard()']);
      else inserts.push([s1 + 1, ' __loopGuard() && ('], [s2, ')']);
    } else {
      // `for…in` / `for…of`: guard the body when it is a block.
      const body = skipGap(close + 1);
      if (code[body] === '{' && isCode(body)) inserts.push([body + 1, '__loopGuard();']);
    }
  }

  if (!inserts.length) return code;
  inserts.sort((a, b) => a[0] - b[0]);
  let out = '';
  let last = 0;
  for (const [pos, text] of inserts) {
    out += code.slice(last, pos) + text;
    last = pos;
  }
  out += code.slice(last);
  try {
    // eslint-disable-next-line no-new-func
    new Function('__loopGuard', 'require', 'exports', 'module', out);
    return out;
  } catch {
    return code;
  }
}

const LITERAL = 0;
const CODE = 1;
const COMMENT = 2;
const REGEX_AFTER_WORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await',
]);

/**
 * Classifies every character of `code` as CODE, COMMENT or LITERAL (inside a
 * string, template text or regex literal).
 */
function codeMask(code) {
  const n = code.length;
  const mask = new Uint8Array(n);
  const templateDepths = []; // brace depth at which each open `${` resumes its template
  let braces = 0;
  let prevSig = ''; // last significant code character
  let prevWord = ''; // identifier that ends at prevSig (if any)
  let i = 0;

  const scanTemplate = () => {
    // i is just past a backtick or a closing `}` of an interpolation.
    while (i < n) {
      const ch = code[i];
      if (ch === '\\') {
        mask[i] = LITERAL;
        if (i + 1 < n) mask[i + 1] = LITERAL;
        i += 2;
        continue;
      }
      if (ch === '`') {
        mask[i++] = CODE;
        return;
      }
      if (ch === '$' && code[i + 1] === '{') {
        mask[i] = CODE;
        mask[i + 1] = CODE;
        i += 2;
        templateDepths.push(braces);
        braces++;
        return;
      }
      mask[i++] = LITERAL;
    }
  };

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && code[i] !== '\n') mask[i++] = COMMENT;
      continue;
    }
    if (ch === '/' && next === '*') {
      const stop = code.indexOf('*/', i + 2);
      const to = stop === -1 ? n : stop + 2;
      while (i < to) mask[i++] = COMMENT;
      continue;
    }
    if (ch === '"' || ch === "'") {
      mask[i++] = CODE;
      while (i < n && code[i] !== ch && code[i] !== '\n') {
        if (code[i] === '\\') mask[i++] = LITERAL;
        if (i < n) mask[i++] = LITERAL;
      }
      if (i < n) mask[i++] = CODE;
      prevSig = ch;
      prevWord = '';
      continue;
    }
    if (ch === '`') {
      mask[i++] = CODE;
      scanTemplate();
      prevSig = '`';
      prevWord = '';
      continue;
    }
    if (ch === '}' && templateDepths.length && templateDepths[templateDepths.length - 1] === braces - 1) {
      templateDepths.pop();
      braces--;
      mask[i++] = CODE;
      scanTemplate();
      prevSig = '`';
      prevWord = '';
      continue;
    }
    if (ch === '/') {
      const division = /[\w$)\]]/.test(prevSig) && !REGEX_AFTER_WORDS.has(prevWord);
      if (!division) {
        mask[i++] = CODE;
        let inClass = false;
        while (i < n && code[i] !== '\n') {
          const c = code[i];
          if (c === '\\') {
            mask[i++] = LITERAL;
            if (i < n) mask[i++] = LITERAL;
            continue;
          }
          if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) break;
          mask[i++] = LITERAL;
        }
        if (i < n && code[i] === '/') mask[i++] = CODE;
        while (i < n && /[\w$]/.test(code[i])) mask[i++] = LITERAL;
        prevSig = ')';
        prevWord = '';
        continue;
      }
    }
    mask[i] = CODE;
    if (/[\w$]/.test(ch)) {
      const start = i;
      while (i < n && /[\w$]/.test(code[i])) mask[i++] = CODE;
      prevWord = code.slice(start, i);
      prevSig = code[i - 1];
      continue;
    }
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    if (!/\s/.test(ch)) {
      prevSig = ch;
      prevWord = '';
    }
    i++;
  }
  return mask;
}

function matchParen(code, mask, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (mask[i] !== CODE) continue;
    const ch = code[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Creates a fresh loop guard. Resets itself when the current task ends. */
export function createLoopGuard(limitMs = 1500) {
  let count = 0;
  let start = 0;
  let armed = false;
  return function __loopGuard() {
    count++;
    if ((count & 1023) !== 0) return true;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!armed) {
      armed = true;
      start = now;
      // The reset only runs once the current (possibly stuck) task finishes.
      setTimeout(() => {
        armed = false;
        count = 0;
      }, 0);
      return true;
    }
    if (now - start > limitMs) {
      armed = false;
      count = 0;
      throw new Error(
        'Reactoria stopped a loop that ran for too long — this looks like an infinite loop. Check your loop condition.',
      );
    }
    return true;
  };
}
