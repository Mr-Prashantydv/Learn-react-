/**
 * A tiny JSX-aware tokenizer used to colour code blocks inside lessons.
 * Returns an array of `{ type, value }` tokens.
 */
const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
  'break', 'continue', 'new', 'class', 'extends', 'import', 'from', 'export', 'default', 'async',
  'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'this', 'super',
  'static', 'yield', 'delete', 'void',
]);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
// After these keywords a `<` starts JSX, never a comparison (`return <p>…</p>`).
const JSX_AFTER = new Set([
  'return', 'yield', 'await', 'case', 'default', 'else', 'in', 'of', 'typeof', 'void', 'delete', 'throw', 'new', 'do',
]);

export function tokenize(code) {
  const tokens = [];
  let i = 0;
  const n = code.length;
  const push = (type, value) => {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === type && (type === 'plain' || type === 'text')) last.value += value;
    else tokens.push({ type, value });
  };

  // JSX tracking: when we see `<Tag` we switch into tag mode until `>`;
  // inside JSX children we treat text as plain until `{` or `<`.
  let jsxDepth = 0;
  let mode = 'code'; // 'code' | 'tag' | 'jsxtext'
  const braceStack = []; // remembers the mode to restore when a `}` closes an expression

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];

    if (mode === 'jsxtext') {
      if (ch === '<') {
        mode = 'tag';
        continue;
      }
      if (ch === '{') {
        braceStack.push('jsxtext');
        push('punct', '{');
        mode = 'code';
        i++;
        continue;
      }
      let j = i;
      while (j < n && code[j] !== '<' && code[j] !== '{') j++;
      push('text', code.slice(i, j));
      i = j;
      continue;
    }

    if (mode === 'tag') {
      if (ch === '<') {
        if (next === '/') {
          push('punct', '</');
          i += 2;
          let j = i;
          while (j < n && /[\w.:-]/.test(code[j])) j++;
          push('tag', code.slice(i, j));
          i = j;
          continue;
        }
        push('punct', '<');
        i++;
        let j = i;
        while (j < n && /[\w.:-]/.test(code[j])) j++;
        push('tag', code.slice(i, j));
        i = j;
        continue;
      }
      if (ch === '/' && next === '>') {
        push('punct', '/>');
        i += 2;
        mode = jsxDepth > 0 ? 'jsxtext' : 'code';
        continue;
      }
      if (ch === '>') {
        push('punct', '>');
        i++;
        // Was this a closing tag? Look back for "</".
        const lastTagIdx = findLastIndex(tokens, (t) => t.type === 'punct' && (t.value === '<' || t.value === '</'));
        const wasClosing = lastTagIdx >= 0 && tokens[lastTagIdx].value === '</';
        if (wasClosing) jsxDepth = Math.max(0, jsxDepth - 1);
        else jsxDepth++;
        mode = jsxDepth > 0 ? 'jsxtext' : 'code';
        continue;
      }
      if (ch === '{') {
        braceStack.push('tag');
        push('punct', '{');
        mode = 'code';
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const j = scanString(code, i, ch);
        push('string', code.slice(i, j));
        i = j;
        continue;
      }
      if (/\s/.test(ch)) {
        push('plain', ch);
        i++;
        continue;
      }
      if (ch === '=') {
        push('punct', '=');
        i++;
        continue;
      }
      let j = i;
      while (j < n && /[\w-]/.test(code[j])) j++;
      if (j === i) {
        push('plain', ch);
        i++;
        continue;
      }
      push('attr', code.slice(i, j));
      i = j;
      continue;
    }

    // --- code mode ---
    if (ch === '/' && next === '/') {
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      push('comment', code.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '/' && next === '*') {
      const j = code.indexOf('*/', i + 2);
      const end = j === -1 ? n : j + 2;
      push('comment', code.slice(i, end));
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const j = scanString(code, i, ch);
      push('string', code.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '<' && (next === '>' || /[A-Za-z]/.test(next) || next === '/')) {
      // JSX opening: `<Tag`, fragment `<>` or closing `</`
      const prevSig = lastSignificant(code, i);
      const looksLikeJsx =
        next === '/' || next === '>' || JSX_AFTER.has(lastWord(code, i)) || !/[\w$)\]]/.test(prevSig);
      if (looksLikeJsx) {
        if (next === '>') {
          push('punct', '<>');
          i += 2;
          jsxDepth++;
          mode = 'jsxtext';
          continue;
        }
        if (next === '/' && code[i + 2] === '>') {
          push('punct', '</>');
          i += 3;
          jsxDepth = Math.max(0, jsxDepth - 1);
          mode = jsxDepth > 0 ? 'jsxtext' : 'code';
          continue;
        }
        mode = 'tag';
        continue;
      }
    }
    if (ch === '{') {
      braceStack.push('code');
      push('punct', '{');
      i++;
      continue;
    }
    if (ch === '}') {
      const restore = braceStack.pop() || 'code';
      push('punct', '}');
      i++;
      mode = restore === 'code' ? 'code' : restore;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9._xa-fA-F]/.test(code[j])) j++;
      push('number', code.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[\w$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (KEYWORDS.has(word)) push('keyword', word);
      else if (LITERALS.has(word)) push('literal', word);
      else if (/^use[A-Z]/.test(word)) push('hook', word);
      else if (/^[A-Z]/.test(word)) push('type', word);
      else if (code[j] === '(') push('fn', word);
      else push('plain', word);
      i = j;
      continue;
    }
    if (/[()[\];,.=+\-*/%!&|?:<>]/.test(ch)) {
      push('punct', ch);
      i++;
      continue;
    }
    push('plain', ch);
    i++;
  }
  return tokens;
}

function scanString(code, start, quote) {
  let i = start + 1;
  while (i < code.length) {
    const c = code[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (quote !== '`' && c === '\n') return i;
    i++;
  }
  return code.length;
}

function lastSignificant(code, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(code[j])) j--;
  return j >= 0 ? code[j] : '';
}

/** The identifier that ends right before position `i` (skipping whitespace), if any. */
function lastWord(code, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(code[j])) j--;
  const end = j + 1;
  while (j >= 0 && /[\w$]/.test(code[j])) j--;
  if (j >= 0 && code[j] === '.') return '';
  return code.slice(j + 1, end);
}

function findLastIndex(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}
