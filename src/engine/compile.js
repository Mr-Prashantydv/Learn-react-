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
 * `for`/`while`/`do` loop body that opens with `{` gets a call to the guard
 * injected. The guard throws once a loop has been spinning for too long.
 *
 * If anything about the result looks wrong (it fails to parse), we fall
 * back to the unguarded code — a hung tab is better than broken valid code.
 */
export function addLoopGuards(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  const keyword = /\b(for|while)\b/g;
  let guarded = false;

  while (i < n) {
    keyword.lastIndex = i;
    const m = keyword.exec(code);
    if (!m) {
      out += code.slice(i);
      break;
    }
    const kwStart = m.index;
    const kwEnd = kwStart + m[0].length;
    // Skip if inside a string/comment? We approximate by checking the char
    // before the keyword is not part of an identifier or a quote.
    const before = code[kwStart - 1];
    if (before && /[\w$.'"`]/.test(before)) {
      out += code.slice(i, kwEnd);
      i = kwEnd;
      continue;
    }
    // Find the opening paren.
    let j = kwEnd;
    while (j < n && /\s/.test(code[j])) j++;
    if (code[j] !== '(') {
      out += code.slice(i, kwEnd);
      i = kwEnd;
      continue;
    }
    const close = matchParen(code, j);
    if (close === -1) {
      out += code.slice(i, kwEnd);
      i = kwEnd;
      continue;
    }
    let k = close + 1;
    while (k < n && /\s/.test(code[k])) k++;
    if (code[k] === '{') {
      out += code.slice(i, k + 1) + '__loopGuard();';
      i = k + 1;
      guarded = true;
    } else {
      out += code.slice(i, close + 1);
      i = close + 1;
    }
  }

  // `do { ... } while (...)` loops.
  const doLoop = out.replace(/\bdo\s*\{/g, (match, offset) => {
    const before = out[offset - 1];
    if (before && /[\w$.]/.test(before)) return match;
    guarded = true;
    return match + '__loopGuard();';
  });

  if (!guarded) return code;
  try {
    // eslint-disable-next-line no-new-func
    new Function('__loopGuard', 'require', 'exports', 'module', doLoop);
    return doLoop;
  } catch {
    return code;
  }
}

function matchParen(code, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
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
    if ((count & 1023) !== 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!armed) {
      armed = true;
      start = now;
      // The reset only runs once the current (possibly stuck) task finishes.
      setTimeout(() => {
        armed = false;
        count = 0;
      }, 0);
      return;
    }
    if (now - start > limitMs) {
      armed = false;
      count = 0;
      throw new Error(
        'Reactoria stopped a loop that ran for too long — this looks like an infinite loop. Check your loop condition.',
      );
    }
  };
}
