import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { code, md, q, test } from '../helpers.js';

const h = React.createElement;

/** Collapse whitespace so text comparisons are tolerant. */
const squish = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ===========================================================================
// Accessibility helpers: roles and accessible names (a small, honest subset
// of what dom-accessibility-api does for the real Testing Library). Used by
// the mini testing library below AND by this chapter's own checks.
// ===========================================================================

const INLINE_TAGS = new Set(['SPAN', 'B', 'I', 'STRONG', 'EM', 'CODE', 'SMALL', 'ABBR', 'KBD', 'MARK', 'S', 'U', 'SUB', 'SUP', 'A', 'LABEL', 'BDI', 'Q']);
const NAME_FROM_CONTENT = new Set([
  'button', 'link', 'heading', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox',
  'radio', 'switch', 'cell', 'gridcell', 'columnheader', 'rowheader', 'row', 'treeitem', 'tooltip',
]);

function implicitRole(el) {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'button':
      return 'button';
    case 'a':
    case 'area':
      return el.hasAttribute('href') ? 'link' : null;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'input': {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      if (type === 'range') return 'slider';
      if (type === 'number') return 'spinbutton';
      if (type === 'search') return 'searchbox';
      if (['hidden', 'password', 'file', 'color', 'date', 'datetime-local', 'month', 'time', 'week'].includes(type)) return null;
      return 'textbox';
    }
    case 'textarea':
      return 'textbox';
    case 'select':
      return el.multiple || Number(el.getAttribute('size')) > 1 ? 'listbox' : 'combobox';
    case 'option':
      return 'option';
    case 'ul':
    case 'ol':
    case 'menu':
      return 'list';
    case 'li':
      return 'listitem';
    case 'nav':
      return 'navigation';
    case 'main':
      return 'main';
    case 'header':
      return 'banner';
    case 'footer':
      return 'contentinfo';
    case 'aside':
      return 'complementary';
    case 'section':
      return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') ? 'region' : null;
    case 'form':
      return 'form';
    case 'dialog':
      return 'dialog';
    case 'img':
      return el.getAttribute('alt') === '' ? 'presentation' : 'img';
    case 'table':
      return 'table';
    case 'tr':
      return 'row';
    case 'td':
      return 'cell';
    case 'th':
      return 'columnheader';
    case 'progress':
      return 'progressbar';
    case 'meter':
      return 'meter';
    case 'output':
      return 'status';
    case 'article':
      return 'article';
    case 'p':
      return 'paragraph';
    case 'hr':
      return 'separator';
    case 'fieldset':
    case 'details':
      return 'group';
    default:
      return null;
  }
}

/** The element's role: an explicit role="…" wins over the tag's implicit role. */
function getRole(el) {
  const explicit = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
  return explicit || implicitRole(el);
}

/** Hidden from assistive technology (and from *ByRole queries by default)? */
function isInaccessible(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden) return true;
    if (n.getAttribute('aria-hidden') === 'true') return true;
    const st = n.style;
    if (st && (st.display === 'none' || st.visibility === 'hidden')) return true;
  }
  return false;
}

/** Visible to a sighted user? (aria-hidden does not hide things visually.) */
function isVisible(el) {
  if (!el.ownerDocument.contains(el)) return false;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden) return false;
    const st = n.style;
    if (st && (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0')) return false;
    if (n.tagName === 'DETAILS' && !n.open && n !== el && !(el.tagName === 'SUMMARY' && el.parentElement === n)) return false;
  }
  return true;
}

/** Text a screen reader would read for the contents of `el`. */
function contentText(el) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === 3) out += node.textContent;
    else if (node.nodeType === 1) {
      if (node.getAttribute('aria-hidden') === 'true' || node.hidden) continue;
      if (node.tagName === 'IMG') out += node.getAttribute('alt') || '';
      else if (INLINE_TAGS.has(node.tagName)) out += contentText(node);
      else out += ' ' + contentText(node) + ' ';
    }
  }
  return out;
}

/** The accessible name: aria-labelledby, aria-label, <label>, alt, contents, title/placeholder. */
function accessibleName(el) {
  const doc = el.ownerDocument;
  const ids = el.getAttribute('aria-labelledby');
  if (ids) {
    const parts = ids
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter(Boolean)
      .map((n) => n.getAttribute('aria-label') || contentText(n));
    if (parts.length) return squish(parts.join(' '));
  }
  const label = el.getAttribute('aria-label');
  if (label && label.trim()) return squish(label);
  const tag = el.tagName;
  if (['INPUT', 'SELECT', 'TEXTAREA', 'METER', 'PROGRESS', 'OUTPUT', 'BUTTON'].includes(tag) && el.labels && el.labels.length) {
    const text = squish(Array.from(el.labels).map((l) => contentText(l)).join(' '));
    if (text) return text;
  }
  if (tag === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) {
    return squish(el.value || (el.type === 'submit' ? 'Submit' : el.type === 'reset' ? 'Reset' : ''));
  }
  if (tag === 'IMG') return squish(el.getAttribute('alt') || el.getAttribute('title') || '');
  if (tag === 'FIELDSET') {
    const legend = el.querySelector(':scope > legend');
    if (legend) return squish(contentText(legend));
  }
  if (NAME_FROM_CONTENT.has(getRole(el))) {
    const text = squish(contentText(el));
    if (text) return text;
  }
  return squish(el.getAttribute('title') || el.getAttribute('placeholder') || '');
}

const isRegExp = (m) => Object.prototype.toString.call(m) === '[object RegExp]';

function textMatches(text, matcher, { exact = true } = {}) {
  if (isRegExp(matcher)) {
    matcher.lastIndex = 0;
    return matcher.test(text);
  }
  if (typeof matcher === 'function') return Boolean(matcher(text));
  const wanted = squish(matcher);
  return exact ? text === wanted : text.toLowerCase().includes(wanted.toLowerCase());
}

const showMatcher = (m) => (isRegExp(m) ? String(m) : typeof m === 'function' ? 'a custom function' : `"${m}"`);

/** The text of an element's *own* text nodes, like Testing Library's getNodeText. */
function ownText(el) {
  return squish(
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(''),
  );
}

/** The form control a <label> points at (htmlFor, or a control nested inside it). */
function labelControl(label) {
  if (label.control) return label.control;
  const forId = label.getAttribute('for');
  if (forId) return label.ownerDocument.getElementById(forId);
  return label.querySelector('input, select, textarea, button, meter, output, progress');
}

function describeEl(el) {
  if (!el || el.nodeType !== 1) return String(el);
  const tag = el.tagName.toLowerCase();
  const role = getRole(el);
  const name = accessibleName(el);
  return `<${tag}>${role && role !== tag ? ` (role "${role}")` : ''}${name ? ` "${name}"` : ''}`;
}

// ===========================================================================
// Queries (screen.getByRole, getByText, getByLabelText, …)
// ===========================================================================

function queryAllByRole(root, role, opts = {}) {
  const roles = String(role).split(/\s+/);
  return Array.from(root.querySelectorAll('*')).filter((el) => {
    if (!roles.includes(getRole(el))) return false;
    if (!opts.hidden && isInaccessible(el)) return false;
    if (opts.name !== undefined && !textMatches(accessibleName(el), opts.name)) return false;
    if (opts.level !== undefined) {
      const level = Number(el.getAttribute('aria-level')) || Number((el.tagName.match(/^H(\d)$/) || [])[1]);
      if (level !== opts.level) return false;
    }
    if (opts.selected !== undefined && (el.getAttribute('aria-selected') === 'true') !== opts.selected) return false;
    if (opts.expanded !== undefined && (el.getAttribute('aria-expanded') === 'true') !== opts.expanded) return false;
    if (opts.pressed !== undefined && (el.getAttribute('aria-pressed') === 'true') !== opts.pressed) return false;
    if (opts.checked !== undefined) {
      const checked = 'checked' in el && (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.getAttribute('aria-checked') === 'true';
      if (checked !== opts.checked) return false;
    }
    return true;
  });
}

function rolesReport(root) {
  const items = Array.from(root.querySelectorAll('*'))
    .filter((el) => getRole(el) && !isInaccessible(el) && !['paragraph', 'generic', 'none', 'presentation'].includes(getRole(el)))
    .map((el) => {
      const name = accessibleName(el);
      return `${getRole(el)}${name ? ` "${name}"` : ''}`;
    });
  return items.length ? `Accessible roles on screen: ${items.slice(0, 12).join(', ')}${items.length > 12 ? ', …' : ''}.` : 'There are no accessible roles on screen at all.';
}

function queryAllByText(root, text, { exact = true, selector = '*' } = {}) {
  return Array.from(root.querySelectorAll(selector)).filter((el) => {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
    const own = ownText(el);
    return own !== '' && textMatches(own, text, { exact });
  });
}

function queryAllByLabelText(root, text, { exact = true } = {}) {
  const found = new Set();
  let orphanLabel = null;
  for (const label of root.querySelectorAll('label')) {
    if (!textMatches(squish(contentText(label)), text, { exact })) continue;
    const control = labelControl(label);
    if (control) found.add(control);
    else orphanLabel = label;
  }
  for (const el of root.querySelectorAll('[aria-label]')) {
    if (textMatches(squish(el.getAttribute('aria-label')), text, { exact })) found.add(el);
  }
  for (const el of root.querySelectorAll('[aria-labelledby]')) {
    const ids = el.getAttribute('aria-labelledby').split(/\s+/);
    const joined = squish(
      ids
        .map((id) => el.ownerDocument.getElementById(id))
        .filter(Boolean)
        .map((n) => contentText(n))
        .join(' '),
    );
    if (joined && textMatches(joined, text, { exact })) found.add(el);
  }
  const list = Array.from(found);
  list.orphanLabel = orphanLabel;
  return list;
}

const QUERY_KINDS = {
  Role: {
    all: (root, role, opts) => queryAllByRole(root, role, opts),
    what: (role, opts = {}) =>
      `an accessible element with the role "${role}"${opts.name !== undefined ? ` and name ${showMatcher(opts.name)}` : ''}`,
    help: (root) => rolesReport(root),
  },
  Text: {
    all: (root, text, opts) => queryAllByText(root, text, opts),
    what: (text) => `an element with the text ${showMatcher(text)}`,
    help: (root) => {
      const shown = squish(contentText(root));
      return `The screen reads: "${shown.length > 160 ? shown.slice(0, 160) + '…' : shown}". (The text may be split across several elements; try a regex, { exact: false }, or a *ByRole query.)`;
    },
  },
  LabelText: {
    all: (root, text, opts) => queryAllByLabelText(root, text, opts),
    what: (text) => `a form control with the label ${showMatcher(text)}`,
    help: (root, args) => {
      const r = queryAllByLabelText(root, args[0], args[1]);
      if (r.orphanLabel)
        return 'Found a <label> with that text, but no form control is associated with it. Give the input an id and the label a matching htmlFor (useId is perfect), or nest the input inside the label.';
      const labels = Array.from(root.querySelectorAll('label')).map((l) => `"${squish(contentText(l))}"`);
      return labels.length ? `Labels on screen: ${labels.join(', ')}.` : 'There are no <label> elements on screen.';
    },
  },
  PlaceholderText: {
    all: (root, text, opts = {}) =>
      Array.from(root.querySelectorAll('[placeholder]')).filter((el) => textMatches(squish(el.getAttribute('placeholder')), text, opts)),
    what: (text) => `an element with the placeholder ${showMatcher(text)}`,
    help: () => 'A placeholder is not a label: prefer getByLabelText.',
  },
  DisplayValue: {
    all: (root, value, opts = {}) =>
      Array.from(root.querySelectorAll('input, select, textarea')).filter((el) => textMatches(squish(el.value), value, opts)),
    what: (value) => `a form control with the value ${showMatcher(value)}`,
    help: () => '',
  },
  TestId: {
    all: (root, id) => Array.from(root.querySelectorAll('[data-testid]')).filter((el) => textMatches(el.getAttribute('data-testid'), id)),
    what: (id) => `an element with data-testid ${showMatcher(id)}`,
    help: () => 'Test ids are a last resort: users never see them. Prefer *ByRole or *ByLabelText.',
  },
};

class TestingLibraryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TestingLibraryError';
  }
}

function buildQueries(getRoot, waitFor) {
  const api = {};
  for (const [kind, k] of Object.entries(QUERY_KINDS)) {
    const notFound = (args) => new TestingLibraryError(`Unable to find ${k.what(...args)}. ${k.help(getRoot(), args)}`.trim());
    const multiple = (args, list) =>
      new TestingLibraryError(
        `Found multiple elements (${list.length}) for ${k.what(...args)}: ${list.slice(0, 4).map(describeEl).join(', ')}. ` +
          (kind === 'Role' ? 'Narrow it down with { name: … }, or use getAllByRole if you expect several.' : `Use getAllBy${kind} if you expect several.`),
      );
    api[`queryAllBy${kind}`] = (...args) => k.all(getRoot(), ...args);
    api[`getAllBy${kind}`] = (...args) => {
      const list = k.all(getRoot(), ...args);
      if (!list.length) throw notFound(args);
      return list;
    };
    api[`queryBy${kind}`] = (...args) => {
      const list = k.all(getRoot(), ...args);
      if (list.length > 1) throw multiple(args, list);
      return list[0] || null;
    };
    api[`getBy${kind}`] = (...args) => {
      const list = k.all(getRoot(), ...args);
      if (!list.length) throw notFound(args);
      if (list.length > 1) throw multiple(args, list);
      return list[0];
    };
    api[`findBy${kind}`] = (...args) => waitFor(() => api[`getBy${kind}`](...args));
    api[`findAllBy${kind}`] = (...args) => waitFor(() => api[`getAllBy${kind}`](...args));
  }
  return api;
}

// ===========================================================================
// expect() with the jest-dom matchers a React test actually uses
// ===========================================================================

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

function show(v) {
  if (v && v.nodeType === 1) return describeEl(v);
  if (typeof v === 'function') return v._isMockFunction ? 'a mock function' : 'a function';
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (a.nodeType || b.nodeType) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

function needElement(received, matcher) {
  if (received && received.nodeType === 1) return;
  throw new AssertionError(
    `expect(…).${matcher}() needs an element, but received ${show(received)}.` +
      (received === null ? ' (queryBy… returns null when nothing matches. To assert that something exists, use getBy….)' : ''),
  );
}

function needMock(received, matcher) {
  if (typeof received === 'function' && received._isMockFunction) return;
  throw new AssertionError(`expect(…).${matcher}() needs a mock function made with vi.fn(), but received ${show(received)}.`);
}

const MATCHERS = {
  toBe: (r, e) => ({ pass: Object.is(r, e), msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to be ${show(e)}.` }),
  toEqual: (r, e) => ({ pass: deepEqual(r, e), msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to equal ${show(e)}.` }),
  toBeTruthy: (r) => ({ pass: Boolean(r), msg: (not) => `Expected ${show(r)} to be ${not ? 'falsy' : 'truthy'}.` }),
  toBeFalsy: (r) => ({ pass: !r, msg: (not) => `Expected ${show(r)} to be ${not ? 'truthy' : 'falsy'}.` }),
  toBeNull: (r) => ({ pass: r === null, msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to be null.` }),
  toBeUndefined: (r) => ({ pass: r === undefined, msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to be undefined.` }),
  toBeDefined: (r) => ({ pass: r !== undefined, msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to be defined.` }),
  toBeGreaterThan: (r, e) => ({ pass: r > e, msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to be greater than ${show(e)}.` }),
  toBeLessThan: (r, e) => ({ pass: r < e, msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to be less than ${show(e)}.` }),
  toContain: (r, e) => ({
    pass: r != null && typeof r.includes === 'function' && r.includes(e),
    msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to contain ${show(e)}.`,
  }),
  toHaveLength: (r, n) => ({
    pass: r != null && r.length === n,
    msg: (not) => `Expected length ${not ? 'not ' : ''}to be ${n}, but it is ${r == null ? r : r.length}.`,
  }),
  toMatch: (r, e) => ({
    pass: typeof r === 'string' && (isRegExp(e) ? ((e.lastIndex = 0), e.test(r)) : r.includes(e)),
    msg: (not) => `Expected ${show(r)} ${not ? 'not ' : ''}to match ${showMatcher(e)}.`,
  }),
  toBeInTheDocument: (r) => {
    if (r !== null && r !== undefined) needElement(r, 'toBeInTheDocument');
    const pass = Boolean(r) && r.ownerDocument.contains(r);
    return {
      pass,
      msg: (not) => (not ? `Expected ${show(r)} not to be in the document, but it is.` : `Expected the element to be in the document, but ${r ? 'it was removed' : 'the query found nothing (null)'}.`),
    };
  },
  toHaveTextContent: (r, text) => {
    needElement(r, 'toHaveTextContent');
    const actual = squish(r.textContent);
    const pass = isRegExp(text) ? ((text.lastIndex = 0), text.test(actual)) : actual.includes(squish(text));
    return { pass, msg: (not) => `Expected ${describeEl(r)} ${not ? 'not ' : ''}to have text content ${showMatcher(text)}, but its text is "${actual}".` };
  },
  toHaveAttribute: (r, name, value) => {
    needElement(r, 'toHaveAttribute');
    const has = r.hasAttribute(name);
    const actual = r.getAttribute(name);
    const pass = value === undefined ? has : has && actual === String(value);
    return {
      pass,
      msg: (not) =>
        `Expected ${describeEl(r)} ${not ? 'not ' : ''}to have attribute ${name}${value === undefined ? '' : `="${value}"`}, but ${has ? `it is ${name}="${actual}"` : 'it has no such attribute'}.`,
    };
  },
  toHaveClass: (r, ...names) => {
    needElement(r, 'toHaveClass');
    const pass = names.every((n) => r.classList.contains(n));
    return { pass, msg: (not) => `Expected ${describeEl(r)} ${not ? 'not ' : ''}to have class ${names.join(' ')}, but its classes are "${r.className}".` };
  },
  toBeDisabled: (r) => {
    needElement(r, 'toBeDisabled');
    return { pass: r.matches(':disabled'), msg: (not) => `Expected ${describeEl(r)} to be ${not ? 'enabled' : 'disabled'}.` };
  },
  toBeEnabled: (r) => {
    needElement(r, 'toBeEnabled');
    return { pass: !r.matches(':disabled'), msg: (not) => `Expected ${describeEl(r)} to be ${not ? 'disabled' : 'enabled'}.` };
  },
  toHaveFocus: (r) => {
    needElement(r, 'toHaveFocus');
    const active = r.ownerDocument.activeElement;
    return {
      pass: active === r,
      msg: (not) => `Expected ${describeEl(r)} ${not ? 'not ' : ''}to have focus, but the focused element is ${active === r.ownerDocument.body ? '<body> (nothing)' : describeEl(active)}.`,
    };
  },
  toBeVisible: (r) => {
    needElement(r, 'toBeVisible');
    return { pass: isVisible(r), msg: (not) => `Expected ${describeEl(r)} to be ${not ? 'hidden' : 'visible'}.` };
  },
  toBeChecked: (r) => {
    needElement(r, 'toBeChecked');
    const pass = 'checked' in r && (r.type === 'checkbox' || r.type === 'radio') ? r.checked : r.getAttribute('aria-checked') === 'true';
    return { pass, msg: (not) => `Expected ${describeEl(r)} ${not ? 'not ' : ''}to be checked.` };
  },
  toHaveValue: (r, value) => {
    needElement(r, 'toHaveValue');
    const actual = r.type === 'number' ? (r.value === '' ? null : Number(r.value)) : r.value;
    return { pass: deepEqual(actual, value), msg: (not) => `Expected ${describeEl(r)} ${not ? 'not ' : ''}to have value ${show(value)}, but it is ${show(actual)}.` };
  },
  toHaveAccessibleName: (r, name) => {
    needElement(r, 'toHaveAccessibleName');
    const actual = accessibleName(r);
    const pass = name === undefined ? actual !== '' : textMatches(actual, name);
    return { pass, msg: (not) => `Expected ${describeEl(r)} ${not ? 'not ' : ''}to have the accessible name ${name === undefined ? '' : showMatcher(name)}, but it is "${actual}".` };
  },
  toHaveBeenCalled: (r) => {
    needMock(r, 'toHaveBeenCalled');
    const n = r.mock.calls.length;
    return { pass: n > 0, msg: (not) => `Expected the mock ${not ? 'not ' : ''}to have been called, but it was called ${n} time(s).` };
  },
  toHaveBeenCalledTimes: (r, times) => {
    needMock(r, 'toHaveBeenCalledTimes');
    const n = r.mock.calls.length;
    return { pass: n === times, msg: (not) => `Expected the mock ${not ? 'not ' : ''}to have been called ${times} time(s), but it was called ${n} time(s).` };
  },
  toHaveBeenCalledWith: (r, ...args) => {
    needMock(r, 'toHaveBeenCalledWith');
    const calls = r.mock.calls;
    return {
      pass: calls.some((c) => deepEqual(c, args)),
      msg: (not) =>
        `Expected the mock ${not ? 'not ' : ''}to have been called with ${args.map(show).join(', ')}. Calls: ${calls.length ? calls.map((c) => `(${c.map(show).join(', ')})`).join(' ') : 'none'}.`,
    };
  },
  toHaveBeenLastCalledWith: (r, ...args) => {
    needMock(r, 'toHaveBeenLastCalledWith');
    const last = r.mock.calls[r.mock.calls.length - 1];
    return {
      pass: Boolean(last) && deepEqual(last, args),
      msg: (not) => `Expected the last call ${not ? 'not ' : ''}to be with ${args.map(show).join(', ')}, but it was ${last ? `(${last.map(show).join(', ')})` : 'never called'}.`,
    };
  },
};

function expect(received) {
  const build = (negate) => {
    const api = {};
    for (const [name, matcher] of Object.entries(MATCHERS)) {
      api[name] = (...args) => {
        const { pass, msg } = matcher(received, ...args);
        if (pass === negate) throw new AssertionError(msg(negate));
      };
    }
    return api;
  };
  const api = build(false);
  api.not = build(true);
  return api;
}

/** A mock function, like vi.fn() / jest.fn(). */
function mockFn(impl) {
  const mock = function (...args) {
    mock.mock.calls.push(args);
    return impl ? impl.apply(this, args) : undefined;
  };
  mock.mock = { calls: [] };
  mock._isMockFunction = true;
  mock.mockClear = () => {
    mock.mock.calls = [];
  };
  return mock;
}

// ===========================================================================
// The lab: one mini testing library per sandbox, with a swappable component
// under test (so checks can run the player's tests against mutants).
// ===========================================================================

const LABS = new WeakMap(); // sandbox timers -> lab (ctx.timers is the same object)

/** The lab created for this check's sandbox. */
function labFor(t) {
  const lab = LABS.get(t.timers);
  if (!lab) throw new Error('The test lab is missing. Keep the imports from mini-testing-library at the top of the file.');
  return lab;
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"], summary';
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'search', 'url', 'tel', 'password', 'number', '']);
const isTextField = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((el.getAttribute('type') || '').toLowerCase())));
const KEY_NAMES = { Esc: 'Escape', Space: ' ', Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown' };

function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function parseKeys(text) {
  const keys = [];
  const re = /\{([^}]+)\}|([\s\S])/g;
  let m;
  while ((m = re.exec(String(text)))) {
    if (m[1] !== undefined) keys.push({ key: KEY_NAMES[m[1]] || m[1] });
    else keys.push({ key: m[2], char: true });
  }
  return keys;
}

/**
 * Creates one mini testing library instance.
 * `subjects` maps export names to the real components; `files` maps module
 * names (like './PotionShelf') to the export names they provide.
 */
function createLab({ timers, subjects, file, mutants = [] }) {
  const registry = [];
  const describeStack = [];
  let impls = { ...subjects };
  let stage = null;
  const mounted = [];
  const testMode = () => timers && timers.kind === 'fake' && globalThis.IS_REACT_ACT_ENVIRONMENT === true;

  // Run DOM work so React has finished re-rendering when it returns.
  const sync = (fn) => {
    let result;
    let caught = null;
    const pending = [];
    const wrapped = () => {
      try {
        result = fn();
      } catch (err) {
        caught = err;
      }
    };
    if (testMode()) React.act(wrapped);
    else flushSync(wrapped);
    for (const m of mounted) if (m.error) pending.push(m.error), (m.error = null);
    if (caught) throw caught;
    if (pending.length) throw pending[0];
    return result;
  };

  const realWait = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  const advance = async (ms) => {
    if (testMode()) {
      await React.act(async () => {
        timers.advance(ms);
        await realWait(0);
      });
    } else {
      await realWait(ms);
    }
  };

  async function waitFor(callback, { timeout = 1000, interval = 50 } = {}) {
    let waited = 0;
    for (;;) {
      try {
        return await callback();
      } catch (err) {
        if (waited >= timeout) throw err;
      }
      await advance(interval);
      waited += interval;
    }
  }

  const getStage = () => {
    if (!stage) {
      stage = document.createElement('div');
      stage.setAttribute('data-mini-testing-library', '');
      stage.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;';
      if (!testMode()) {
        // In the live preview, keep simulated events from reaching the game's own
        // window listeners (keyboard shortcuts, the companion's Enter-to-continue).
        for (const type of ['keydown', 'keyup', 'keypress', 'click', 'mousedown', 'mouseup', 'submit', 'input', 'change', 'focusin', 'focusout']) {
          stage.addEventListener(type, (e) => e.stopPropagation());
        }
      }
      document.body.appendChild(stage);
    }
    return stage;
  };

  function render(ui) {
    if (!React.isValidElement(ui)) {
      throw new TestingLibraryError(`render() expects JSX, like render(<${Object.keys(subjects)[0]} />), but received ${show(ui)}.`);
    }
    const container = document.createElement('div');
    getStage().appendChild(container);
    const entry = { container, root: null, error: null };
    entry.root = createRoot(container, {
      onUncaughtError: (error) => {
        entry.error = error;
      },
    });
    mounted.push(entry);
    sync(() => entry.root.render(ui));
    return {
      container,
      rerender: (next) => sync(() => entry.root.render(next)),
      unmount: () => sync(() => entry.root.unmount()),
      ...buildQueries(() => container, waitFor),
    };
  }

  function cleanup() {
    while (mounted.length) {
      const entry = mounted.pop();
      try {
        sync(() => entry.root.unmount());
      } catch {
        /* already unmounted */
      }
    }
    if (stage) stage.remove();
    stage = null;
  }

  const screen = buildQueries(() => {
    if (!stage) throw new TestingLibraryError('Nothing is rendered yet. Call render(<Component />) first.');
    return stage;
  }, waitFor);

  const within = (el) => buildQueries(() => el, waitFor);

  const needEl = (el, what) => {
    if (!el || el.nodeType !== 1) throw new TestingLibraryError(`${what} needs an element, but received ${show(el)}.`);
  };

  // Keys go to the focused element, like a real keyboard. (In the live preview,
  // a key pressed while nothing in the test is focused goes to the test stage
  // instead of the game's <body>.)
  const active = () => {
    const el = document.activeElement || document.body;
    if (!testMode() && stage && !stage.contains(el)) return stage;
    return el;
  };

  function pressKey(key, char) {
    const target = active();
    const KE = target.ownerDocument.defaultView.KeyboardEvent;
    const down = new KE('keydown', { key, bubbles: true, cancelable: true });
    const go = target.dispatchEvent(down);
    if (go) {
      if (key === 'Enter') {
        if (target.tagName === 'BUTTON' || (target.tagName === 'A' && target.hasAttribute('href'))) target.click();
        else if (isTextField(target) && target.form) {
          if (typeof target.form.requestSubmit === 'function') target.form.requestSubmit();
          else target.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      } else if (key === 'Backspace' && isTextField(target)) {
        setNativeValue(target, target.value.slice(0, -1));
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (char && isTextField(target)) {
        setNativeValue(target, target.value + key);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    const up = active();
    up.dispatchEvent(new KE('keyup', { key, bubbles: true, cancelable: true }));
    if (go && key === ' ' && (target.tagName === 'BUTTON' || (target.tagName === 'INPUT' && ['checkbox', 'radio'].includes(target.type)))) target.click();
  }

  function tabOnce(shift) {
    const items = Array.from(getStage().querySelectorAll(FOCUSABLE)).filter(
      (el) => el.tabIndex >= 0 && !el.matches(':disabled') && !isInaccessible(el),
    );
    if (!items.length) return;
    const KE = document.defaultView.KeyboardEvent;
    const from = active();
    const go = from.dispatchEvent(new KE('keydown', { key: 'Tab', shiftKey: Boolean(shift), bubbles: true, cancelable: true }));
    if (!go) return;
    const i = items.indexOf(from);
    const next = i === -1 ? (shift ? items[items.length - 1] : items[0]) : items[(i + (shift ? -1 : 1) + items.length) % items.length];
    next.focus();
    next.dispatchEvent(new KE('keyup', { key: 'Tab', bubbles: true, cancelable: true }));
  }

  const user = {
    async click(el) {
      needEl(el, 'user.click()');
      sync(() => {
        const MouseEv = el.ownerDocument.defaultView.MouseEvent;
        if (el.matches(':disabled')) return;
        el.dispatchEvent(new MouseEv('mousedown', { bubbles: true, cancelable: true }));
        const focusable = el.closest(FOCUSABLE);
        if (focusable && !focusable.matches(':disabled')) focusable.focus();
        el.dispatchEvent(new MouseEv('mouseup', { bubbles: true, cancelable: true }));
        el.click();
      });
    },
    async type(el, text) {
      needEl(el, 'user.type()');
      await user.click(el);
      for (const { key, char } of parseKeys(text)) sync(() => pressKey(key, char));
    },
    async clear(el) {
      needEl(el, 'user.clear()');
      sync(() => {
        el.focus();
        setNativeValue(el, '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    },
    async keyboard(text) {
      for (const { key, char } of parseKeys(text)) {
        if (key === 'Tab') sync(() => tabOnce(false));
        else sync(() => pressKey(key, char));
      }
    },
    async tab({ shift = false } = {}) {
      sync(() => tabOnce(shift));
    },
    async selectOptions(el, value) {
      needEl(el, 'user.selectOptions()');
      sync(() => {
        setNativeValue(el, value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
  };

  const fire = (type, Ctor = Event) => (el, init = {}) => {
    needEl(el, `fireEvent.${type}()`);
    return sync(() => el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, ...init })));
  };
  const fireEvent = {
    click: (el, init) => fire('click', document.defaultView.MouseEvent)(el, init),
    keyDown: (el, init) => fire('keydown', document.defaultView.KeyboardEvent)(el, init),
    keyUp: (el, init) => fire('keyup', document.defaultView.KeyboardEvent)(el, init),
    submit: (el, init) => fire('submit')(el, init),
    input: (el, init) => fire('input')(el, init),
    change: (el, init = {}) => {
      needEl(el, 'fireEvent.change()');
      return sync(() => {
        if (init.target && 'value' in init.target) setNativeValue(el, init.target.value);
        if (init.target && 'checked' in init.target) el.checked = init.target.checked;
        return el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      });
    },
    focus: (el) => sync(() => el.focus()),
    blur: (el) => sync(() => el.blur()),
  };

  function test(name, fn) {
    if (typeof name !== 'string' || typeof fn !== 'function') {
      throw new TestingLibraryError("test() takes a name and a function: test('does a thing', () => { … }).");
    }
    registry.push({ name: [...describeStack, name].join(' › '), fn });
  }
  function describe(name, fn) {
    describeStack.push(name);
    try {
      fn();
    } finally {
      describeStack.pop();
    }
  }

  // The components under test are stable wrappers, so checks can swap the
  // implementation underneath the player's imports.
  const exportsFile = {};
  for (const name of Object.keys(subjects)) {
    const Wrapper = (props) => h(impls[name], props);
    Object.defineProperty(Wrapper, 'name', { value: name });
    exportsFile[name] = Wrapper;
  }

  /** Runs every registered test against `overrides` (or the real components). */
  async function runAll(overrides = {}) {
    const results = [];
    for (const entry of registry) {
      impls = { ...subjects, ...overrides };
      let error = null;
      let timer;
      try {
        await Promise.race([
          Promise.resolve().then(() => entry.fn()),
          new Promise((resolve, reject) => {
            timer = globalThis.setTimeout(
              () => reject(new Error('This test never finished. Is it awaiting something that never happens?')),
              1500,
            );
          }),
        ]);
      } catch (err) {
        error = err;
      } finally {
        globalThis.clearTimeout(timer);
        try {
          cleanup();
        } catch {
          /* ignore */
        }
      }
      results.push({ name: entry.name, pass: !error, message: error ? String(error.message || error) : '' });
    }
    impls = { ...subjects };
    return results;
  }

  function TestReport() {
    const [report, setReport] = React.useState({ status: 'idle' });
    function start() {
      setReport({ status: 'running' });
      globalThis.setTimeout(async () => {
        let focused = document.activeElement;
        while (focused && focused.shadowRoot && focused.shadowRoot.activeElement) focused = focused.shadowRoot.activeElement;
        try {
          const real = await runAll();
          const hunt = [];
          if (real.length && real.every((r) => r.pass)) {
            for (const m of mutants) {
              const res = await runAll({ [m.subject]: m.impl });
              hunt.push({ label: m.label, caughtBy: res.filter((r, i) => !r.pass && real[i].pass).map((r) => r.name) });
            }
          }
          setReport({ status: 'done', real, hunt });
        } catch (err) {
          setReport({ status: 'error', message: String(err.message || err) });
        } finally {
          try {
            focused?.focus?.();
          } catch {
            /* ignore */
          }
        }
      }, 0);
    }
    const kids = [
      h('h2', { key: 'h' }, '🧪 Test report'),
      h('p', { key: 'n', className: 'count' }, `${registry.length} test(s) registered against ${file}`),
      h('button', { key: 'b', onClick: start, disabled: report.status === 'running' }, report.status === 'running' ? 'Running…' : '▶ Run tests'),
    ];
    if (report.status === 'error') kids.push(h('p', { key: 'e', className: 'fail' }, report.message));
    if (report.status === 'done') {
      kids.push(
        h(
          'ul',
          { key: 'r', className: 'results' },
          report.real.map((r, i) =>
            h('li', { key: i, className: r.pass ? 'pass' : 'fail' }, `${r.pass ? '✓' : '✗'} ${r.name}`, r.pass ? null : h('small', null, r.message)),
          ),
        ),
      );
      if (!report.real.length) kids.push(h('p', { key: 'z', className: 'fail' }, 'No tests yet: call test(…) at the top level of the file.'));
      else if (!report.real.every((r) => r.pass))
        kids.push(h('p', { key: 'w', className: 'fail' }, 'Some tests fail against the REAL component. Fix them before hunting mutants.'));
      else
        kids.push(
          h('h3', { key: 'mh' }, `🧟 Mutant hunt: ${report.hunt.filter((m) => m.caughtBy.length).length}/${report.hunt.length} caught`),
          h(
            'ul',
            { key: 'm', className: 'mutants' },
            report.hunt.map((m, i) =>
              h(
                'li',
                { key: i, className: m.caughtBy.length ? 'pass' : 'fail' },
                m.caughtBy.length ? `✓ ${m.label}: caught by "${m.caughtBy[0]}"` : `✗ ${m.label}: slipped past every test!`,
              ),
            ),
          ),
        );
    }
    return h('div', { className: 'test-report' }, kids);
  }

  const library = {
    render,
    screen,
    within,
    cleanup,
    waitFor,
    fireEvent,
    userEvent: { setup: () => user },
    expect,
    test,
    it: test,
    describe,
    vi: { fn: mockFn },
    fn: mockFn,
    TestReport,
  };

  const lab = {
    registry,
    runAll,
    modules: { 'mini-testing-library': library, [file]: exportsFile },
  };
  if (timers) LABS.set(timers, lab);
  return lab;
}

/** `level.modules` for a testing quest. */
function labModules(config) {
  return ({ timers }) => createLab({ timers, ...config }).modules;
}

/**
 * Runs the player's tests against the real component and against one mutant.
 * Throws with a helpful message unless some test that passes on the real
 * component fails on the mutant.
 */
async function expectCaught(t, mutant) {
  const lab = labFor(t);
  const real = await lab.runAll();
  if (!real.length) t.fail('No tests are registered yet. Call test(name, fn) at the top level of your file.');
  const broken = real.filter((r) => !r.pass);
  if (broken.length) {
    t.fail(`First make every test pass against the real component ("${broken[0].name}" fails: ${broken[0].message}).`);
  }
  const res = await lab.runAll({ [mutant.subject]: mutant.impl });
  const caught = res.filter((r, i) => !r.pass && real[i].pass);
  t.expect(caught.length > 0, `Every test passed against this mutant (${mutant.label}), so the bug would sneak into production. ${mutant.hint}`);
}

/** Check: the player's tests all pass against the real component. */
async function expectAllPass(t, { min, subject }) {
  const lab = labFor(t);
  t.expect(
    lab.registry.length >= min,
    `Only ${lab.registry.length} test(s) registered; write at least ${min}. Each one is a call like test('brewing adds a potion', async () => { … }) at the top level of the file.`,
  );
  const real = await lab.runAll();
  const broken = real.filter((r) => !r.pass);
  t.expect(
    !broken.length,
    `"${broken[0]?.name}" fails against the REAL ${subject}: ${broken[0]?.message} A test that fails on correct code is a false alarm, so fix the test (not the component).`,
  );
}

// ===========================================================================
// Components under test (and their mutants) for the testing quests
// ===========================================================================

function makePotionShelf({ step = 1, emptyWorks = true, limit = true, divButton = false } = {}) {
  return function PotionShelf({ max = 3 }) {
    const [count, setCount] = React.useState(0);
    const brew = () => setCount((c) => c + step);
    return h(
      'section',
      { className: 'shelf', 'aria-label': 'Potion shelf' },
      h('h2', null, 'Potion shelf'),
      h('p', { role: 'status' }, 'Potions: ', count),
      divButton
        ? h('div', { className: 'btn', onClick: () => count < max && brew() }, 'Brew')
        : h('button', { onClick: brew, disabled: limit && count >= max }, 'Brew'),
      h('button', { onClick: () => emptyWorks && setCount(0) }, 'Empty shelf'),
    );
  };
}

const SHELF = { subject: 'PotionShelf' };
const SHELF_MUTANTS = {
  double: {
    ...SHELF,
    label: 'Brew adds 2 potions',
    impl: makePotionShelf({ step: 2 }),
    hint: 'Write a test that clicks Brew once and expects the status to say "Potions: 1".',
  },
  noEmpty: {
    ...SHELF,
    label: 'Empty shelf does nothing',
    impl: makePotionShelf({ emptyWorks: false }),
    hint: 'Write a test that brews, clicks "Empty shelf", and expects "Potions: 0" again.',
  },
  noLimit: {
    ...SHELF,
    label: 'the shelf never fills up',
    impl: makePotionShelf({ limit: false }),
    hint: 'Write a test that clicks Brew 3 times and then expects the Brew button toBeDisabled().',
  },
  divButton: {
    ...SHELF,
    label: 'Brew is a clickable <div>, not a button',
    impl: makePotionShelf({ divButton: true }),
    hint: "It still works with a mouse, but keyboard and screen-reader users can't use it. Find Brew with screen.getByRole('button', { name: 'Brew' }) instead of getByText, and that query will catch it.",
  },
};

// ===========================================================================
// Check helpers
// ===========================================================================

/** The player's source without comments, so TODO comments never satisfy a source check. */
function codeOnly(t) {
  return t.source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function expectCode(t, pattern, message) {
  t.expect(pattern.test(codeOnly(t)), message);
}

/** The form control that a label with this text points at (null if none). */
function controlForLabel(root, text) {
  const label = Array.from(root.querySelectorAll('label')).find((l) => squish(contentText(l)) === text);
  return label ? labelControl(label) : null;
}

// ===========================================================================
// Levels
// ===========================================================================

const typedCharter = {
  id: 'guild-typed-charter',
  type: 'code',
  typescript: true,
  title: 'The Typed Charter',
  blurb: 'Type your props, children, state and events in your first App.tsx.',
  xp: 130,
  story: [
    { text: "First stop: the Typewrights' Hall. Typewright Tobi writes a type for everything. Even his cat has one: Cat.", mood: 'happy' },
    { text: 'His quest charter works, but nothing is typed, so the editor cannot warn anyone about mistakes. Look: the file is App.tsx now!', mood: 'excited' },
  ],
  lesson: md`
    ## TypeScript: JavaScript that explains itself

    **TypeScript** adds *types* to JavaScript: you write down what shape your data has, and a
    type checker (\`tsc\`, or your editor) reports mistakes **before the code runs**. Files with
    JSX use the extension **\`.tsx\`**. Most professional React code is written this way.

    Types only exist at build time: they are **erased**, and what runs is plain JavaScript.

    :::warn
    **Reactoria strips your types without checking them**, the way Vite does while you develop.
    So here, a wrong type won't stop your code from running. In a real project your editor
    underlines mistakes as you type, and \`tsc --noEmit\` (the Vite template's \`npm run build\`
    runs \`tsc -b\`) fails the build with errors like these:

    \`\`\`text
    App.tsx:41:12 - error TS2741: Property 'onToggle' is missing in type '{ quest: Quest; }'
      but required in type 'QuestCardProps'.
    App.tsx:18:7 - error TS2322: Type 'string' is not assignable to type 'number'.
    App.tsx:25:23 - error TS7006: Parameter 'e' implicitly has an 'any' type.
    App.tsx:33:17 - error TS2339: Property 'titel' does not exist on type 'Quest'.
    \`\`\`

    In this region, the checks test what your code *does*, plus a few targeted looks at your
    type annotations.
    :::

    ## Describing data

    \`\`\`tsx
    type Quest = {
      id: number;
      title: string;
      done: boolean;
      reward?: number; // ? = optional: number | undefined
    };
    \`\`\`

    ## Typing props

    Props arrive as **one object**, so you type the whole object, usually with a named type:

    \`\`\`tsx
    import type { ReactNode } from 'react';

    type QuestCardProps = {
      quest: Quest;
      onToggle: (id: number) => void; // a function prop: takes a number, returns nothing
      children?: ReactNode;           // anything React can render
    };

    function QuestCard({ quest, onToggle, children }: QuestCardProps) {
      // quest.title is a string, onToggle(quest.id) is checked, …
    }
    \`\`\`

    \`ReactNode\` covers everything renderable: JSX, strings, numbers, \`null\`, \`false\`, arrays.
    \`interface QuestCardProps { … }\` works just as well; teams usually pick one style.

    :::mistake
    \`function QuestCard({ quest: Quest })\` does **not** type anything! Inside destructuring,
    \`quest: Quest\` means "rename \`quest\` to a variable called \`Quest\`". The type goes
    **after** the whole pattern: \`({ quest }: QuestCardProps)\`.
    :::

    ## Typing state

    \`useState\` infers the type from the initial value: \`useState('')\` is a \`string\`,
    \`useState(0)\` a \`number\`. Give it a type argument when the initial value doesn't tell the
    whole story:

    \`\`\`tsx
    const [quests, setQuests] = useState<Quest[]>([]);          // [] alone would be never[]
    const [selected, setSelected] = useState<Quest | null>(null); // null for now, a Quest later
    \`\`\`

    ## Typing events

    An inline handler gets its type from the JSX attribute, so it needs nothing:
    \`onChange={(e) => setDraft(e.target.value)}\`. A handler declared separately needs the
    event type, named after the element it comes from:

    \`\`\`tsx
    import type { ChangeEvent, FormEvent } from 'react';

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      setDraft(e.target.value); // TypeScript knows target is an <input>
    }
    function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
    }
    \`\`\`

    Others you'll meet: \`MouseEvent<HTMLButtonElement>\`, \`KeyboardEvent<HTMLDivElement>\`,
    \`ChangeEvent<HTMLSelectElement>\`. Writing \`React.ChangeEvent<…>\` works too.

    :::tip
    \`import type { … }\` (or \`import { useState, type ReactNode }\`) imports **only types**, so
    it is erased completely from the JavaScript output.
    :::
  `,
  task: md`
    ## 🎯 Charter the types

    The file is **\`App.tsx\`**. The \`Quest\` type is already written.

    1. Declare \`type QuestCardProps\` with \`quest: Quest\`, \`onToggle: (id: number) => void\` and
       \`children?: ReactNode\`, and annotate \`QuestCard\`'s parameter with it.
    2. In \`QuestCard\`, show \`<span className="reward">🪙 {quest.reward}</span>\` **only when** the
       quest has a reward.
    3. Add a \`<button>\` in the card that calls \`onToggle(quest.id)\`. It reads **Done**, or
       **Undo** when the quest is done.
    4. Render \`{children}\` at the end of the card (the App passes a "Certified ✔" note for
       finished quests).
    5. In \`App\`: type the state as \`useState<Quest[]>(START)\`, type the two handlers'
       events (\`ChangeEvent<HTMLInputElement>\` and \`FormEvent<HTMLFormElement>\`), and fill in
       \`toggle(id: number)\` so it flips that quest's \`done\` (immutably, with \`map\`).
  `,
  starter: code`
    import { useState } from 'react';
    import type { ChangeEvent, FormEvent, ReactNode } from 'react';

    // A Quest, described once and used everywhere.
    type Quest = {
      id: number;
      title: string;
      done: boolean;
      reward?: number; // optional
    };

    // TODO 1: type QuestCardProps = { quest: …; onToggle: …; children?: … };
    function QuestCard({ quest, onToggle, children }) {
      return (
        <li className={quest.done ? 'quest-card done' : 'quest-card'}>
          <span className="quest-title">{quest.title}</span>
          {/* TODO 2: 🪙 reward, only when there is one */}
          {/* TODO 3: Done / Undo button that calls onToggle(quest.id) */}
          {/* TODO 4: children */}
        </li>
      );
    }

    const START: Quest[] = [
      { id: 1, title: 'Polish the guild seal', done: false, reward: 5 },
      { id: 2, title: 'Sweep the type archive', done: false },
    ];

    export default function App() {
      const [quests, setQuests] = useState(START); // TODO 5: useState<Quest[]>
      const [draft, setDraft] = useState('');

      function handleChange(e) {
        setDraft(e.target.value);
      }

      function handleSubmit(e) {
        e.preventDefault();
        const title = draft.trim();
        if (!title) return;
        const id = Math.max(0, ...quests.map((q) => q.id)) + 1;
        setQuests([...quests, { id, title, done: false }]);
        setDraft('');
      }

      function toggle(id) {
        // TODO 5: flip the done flag of the quest with this id
      }

      return (
        <div className="charter">
          <h1>📜 Quest charter</h1>
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-quest">New quest</label>
            <input id="new-quest" value={draft} onChange={handleChange} />
            <button type="submit">Add</button>
          </form>
          <ul className="quests">
            {quests.map((q) => (
              <QuestCard key={q.id} quest={q} onToggle={toggle}>
                {q.done && <small className="note">Certified ✔</small>}
              </QuestCard>
            ))}
          </ul>
        </div>
      );
    }
  `,
  solution: code`
    import { useState } from 'react';
    import type { ChangeEvent, FormEvent, ReactNode } from 'react';

    type Quest = {
      id: number;
      title: string;
      done: boolean;
      reward?: number;
    };

    type QuestCardProps = {
      quest: Quest;
      onToggle: (id: number) => void;
      children?: ReactNode;
    };

    function QuestCard({ quest, onToggle, children }: QuestCardProps) {
      return (
        <li className={quest.done ? 'quest-card done' : 'quest-card'}>
          <span className="quest-title">{quest.title}</span>
          {quest.reward !== undefined && <span className="reward">🪙 {quest.reward}</span>}
          <button onClick={() => onToggle(quest.id)}>{quest.done ? 'Undo' : 'Done'}</button>
          {children}
        </li>
      );
    }

    const START: Quest[] = [
      { id: 1, title: 'Polish the guild seal', done: false, reward: 5 },
      { id: 2, title: 'Sweep the type archive', done: false },
    ];

    export default function App() {
      const [quests, setQuests] = useState<Quest[]>(START);
      const [draft, setDraft] = useState('');

      function handleChange(e: ChangeEvent<HTMLInputElement>) {
        setDraft(e.target.value);
      }

      function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const title = draft.trim();
        if (!title) return;
        const id = Math.max(0, ...quests.map((q) => q.id)) + 1;
        setQuests([...quests, { id, title, done: false }]);
        setDraft('');
      }

      function toggle(id: number) {
        setQuests(quests.map((q) => (q.id === id ? { ...q, done: !q.done } : q)));
      }

      return (
        <div className="charter">
          <h1>📜 Quest charter</h1>
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-quest">New quest</label>
            <input id="new-quest" value={draft} onChange={handleChange} />
            <button type="submit">Add</button>
          </form>
          <ul className="quests">
            {quests.map((q) => (
              <QuestCard key={q.id} quest={q} onToggle={toggle}>
                {q.done && <small className="note">Certified ✔</small>}
              </QuestCard>
            ))}
          </ul>
        </div>
      );
    }
  `,
  hints: [
    md`The props type sits above the component: \`type QuestCardProps = { quest: Quest; onToggle: (id: number) => void; children?: ReactNode };\`. Then the parameter becomes \`({ quest, onToggle, children }: QuestCardProps)\`.`,
    md`In the card: \`{quest.reward !== undefined && <span className="reward">🪙 {quest.reward}</span>}\`, then \`<button onClick={() => onToggle(quest.id)}>{quest.done ? 'Undo' : 'Done'}</button>\`, then \`{children}\`.`,
    md`In App: \`useState<Quest[]>(START)\`, \`handleChange(e: ChangeEvent<HTMLInputElement>)\`, \`handleSubmit(e: FormEvent<HTMLFormElement>)\`, and \`function toggle(id: number) { setQuests(quests.map((q) => (q.id === id ? { ...q, done: !q.done } : q))); }\`.`,
  ],
  tests: [
    test('Cards show a 🪙 reward only when the quest has one', (t) => {
      t.render();
      const cards = t.$$('li.quest-card');
      t.expect(cards.length === 2, `Expected 2 <li className="quest-card"> cards at the start, found ${cards.length}.`);
      const reward = cards[0].querySelector('.reward');
      t.expect(reward, 'The first quest has reward: 5, but its card has no <span className="reward">. Render it when quest.reward !== undefined.');
      t.expect(squish(reward.textContent) === '🪙 5', `The reward reads "${squish(reward.textContent)}", expected "🪙 5".`);
      t.expect(
        !cards[1].querySelector('.reward'),
        'The second quest has no reward, so its card must not show a .reward span. Render it conditionally: {quest.reward !== undefined && …}.',
      );
    }),
    test('Done / Undo calls onToggle(id) and the card shows its children', (t) => {
      t.render();
      const card = () => t.$$('li.quest-card')[0];
      const btn = Array.from(card().querySelectorAll('button')).find((b) => /done/i.test(b.textContent));
      t.expect(btn, 'Each card needs a <button> that reads "Done".');
      t.click(btn);
      t.expect(
        card().classList.contains('done'),
        'Clicking Done should mark the quest as done (the card gets the class "done"). Call onToggle(quest.id), and make toggle flip that quest with map.',
      );
      t.expect(!t.$$('li.quest-card')[1].classList.contains('done'), 'Only the clicked quest should be toggled. Compare q.id === id inside map.');
      const undo = Array.from(card().querySelectorAll('button')).find((b) => /undo/i.test(b.textContent));
      t.expect(undo, 'A finished quest\'s button should read "Undo".');
      const note = card().querySelector('.note');
      t.expect(note && /Certified/.test(note.textContent), 'The App passes a "Certified ✔" note as children of a done card, but it does not show. Render {children} inside the <li>.');
      t.click(undo);
      t.expect(!card().classList.contains('done'), 'Clicking Undo should flip the quest back to not done.');
    }),
    test('Adding a quest still works', (t) => {
      t.render();
      t.type('#new-quest', 'Oil the drawbridge');
      t.submit('form');
      const cards = t.$$('li.quest-card');
      t.expect(cards.length === 3, `After adding a quest there should be 3 cards, found ${cards.length}.`);
      t.expect(squish(cards[2].querySelector('.quest-title')?.textContent) === 'Oil the drawbridge', 'The new card should show the title that was typed.');
      t.expect(!cards[2].querySelector('.reward'), 'A new quest has no reward, so it should not show a .reward span.');
      t.expect(t.blockedNavigations.length === 0, 'The form reloaded the page: keep e.preventDefault() in handleSubmit.');
    }),
    test('QuestCard has a typed props object (QuestCardProps)', (t) => {
      const src = codeOnly(t);
      t.expect(
        /(type\s+QuestCardProps\s*=|interface\s+QuestCardProps\b)/.test(src),
        'Declare the props type: type QuestCardProps = { … } (or interface QuestCardProps { … }).',
      );
      t.expect(/\bquest\s*:\s*Quest\b/.test(src), 'QuestCardProps needs quest: Quest.');
      t.expect(
        /onToggle\s*:\s*\(\s*\w+\s*:\s*number\s*\)\s*=>\s*void/.test(src),
        'Type the callback prop as a function type: onToggle: (id: number) => void.',
      );
      t.expect(
        /children\s*\??\s*:\s*(React\.)?ReactNode/.test(src) || /PropsWithChildren\s*</.test(src),
        'Type children as ReactNode: children?: ReactNode.',
      );
      t.expect(
        /:\s*QuestCardProps\s*\)|FC\s*<\s*QuestCardProps\s*>/.test(src),
        "Annotate QuestCard's parameter with the type, after the destructuring pattern: function QuestCard({ quest, onToggle, children }: QuestCardProps).",
      );
    }),
    test('State, events and toggle are typed', (t) => {
      const src = codeOnly(t);
      t.expect(/useState\s*<\s*(Quest\[\]|Array<\s*Quest\s*>)\s*>/.test(src), 'Give the quest list state a type argument: useState<Quest[]>(START).');
      t.expect(
        /\(\s*\w+\s*:\s*(React\.)?ChangeEvent\s*<\s*HTMLInputElement\s*>\s*\)|:\s*(React\.)?ChangeEventHandler\s*<\s*HTMLInputElement\s*>/.test(src),
        'Type the change handler: function handleChange(e: ChangeEvent<HTMLInputElement>).',
      );
      t.expect(
        /\(\s*\w+\s*:\s*(React\.)?FormEvent\s*<\s*HTMLFormElement\s*>\s*\)|:\s*(React\.)?FormEventHandler\s*<\s*HTMLFormElement\s*>/.test(src),
        'Type the submit handler: function handleSubmit(e: FormEvent<HTMLFormElement>).',
      );
      t.expect(/\btoggle\b[^;{]*?\(\s*\w+\s*:\s*number\s*\)/.test(src), 'Type the parameter of toggle: function toggle(id: number).');
    }),
  ],
  css: code`
    .charter { padding: 16px; border-radius: 16px; background: #fffbeb; color: #451a03; border: 2px solid #f59e0b; }
    .charter h1 { margin-top: 0; }
    .charter form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .quests { list-style: none; padding: 0; }
    .quest-card { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 12px; margin: 8px 0; border-radius: 10px; background: #fef3c7; }
    .quest-card.done .quest-title { text-decoration: line-through; opacity: 0.6; }
    .quest-title { flex: 1; font-weight: 600; }
    .reward { font-weight: 700; color: #b45309; }
    .note { color: #15803d; font-weight: 700; }
  `,
  concepts: [
    {
      id: 'guild-typed-props',
      icon: '📐',
      title: 'Typing props & children',
      summary: 'Type the whole props object; function props get function types; children are ReactNode.',
      snippet: code`
        type QuestCardProps = {
          quest: Quest;
          onToggle: (id: number) => void;
          children?: ReactNode;
        };
        function QuestCard({ quest, onToggle, children }: QuestCardProps) { … }
      `,
      detail: 'The annotation goes after the destructuring pattern. ({ quest: Quest }) would only rename a variable.',
    },
    {
      id: 'guild-typed-state-events',
      icon: '⚡',
      title: 'Typing state & events',
      summary: 'useState<T>() when the initial value is not enough; ChangeEvent / FormEvent for separate handlers.',
      snippet: code`
        const [quests, setQuests] = useState<Quest[]>([]);
        const [picked, setPicked] = useState<Quest | null>(null);
        function handleChange(e: ChangeEvent<HTMLInputElement>) { … }
      `,
      detail: 'Types are erased at build time. Vite only strips them; tsc (or your editor) does the checking.',
    },
  ],
};

const shapeshifterMould = {
  id: 'guild-mould',
  type: 'code',
  typescript: true,
  title: "The Shapeshifter's Mould",
  blurb: 'Generic components and ComponentProps: one mould, any shape.',
  xp: 140,
  story: [
    { text: "Tobi's prize mould only casts guild members. Pour in runes and you get... nothing at all.", mood: 'worried' },
    { text: 'A generic component takes a type as a parameter, like a mould that adapts to whatever you pour in. Shape-shifting, but type-safe!', mood: 'excited' },
  ],
  lesson: md`
    ## One component, many types

    A list component is useful for members, runes, potions... but if you type its props as
    \`items: Member[]\`, it only works for members. Using \`any\` makes it "work" for everything,
    and then TypeScript can't help you at all.

    **Generics** are type parameters. \`<T>\` means "some type, decided by whoever uses me":

    \`\`\`tsx
    type ListProps<T> = {
      items: T[];
      getKey: (item: T) => string | number;
      renderItem: (item: T) => ReactNode;
    };

    function List<T>({ items, getKey, renderItem }: ListProps<T>) {
      return (
        <ul>
          {items.map((item) => <li key={getKey(item)}>{renderItem(item)}</li>)}
        </ul>
      );
    }
    \`\`\`

    TypeScript **infers** \`T\` from the props you pass:

    \`\`\`tsx
    <List items={members} getKey={(m) => m.id} renderItem={(m) => m.name} />
    // T = Member, so m is a Member and m.nmae would be an error

    <List items={['ᚠ', 'ᚢ']} getKey={(r) => r} renderItem={(r) => <b>{r}</b>} />
    // T = string
    \`\`\`

    :::tip
    In a \`.tsx\` file, a generic **arrow** function needs a trailing comma, \`<T,>\`, because
    \`<T>\` on its own looks like a JSX tag: \`const List = <T,>(props: ListProps<T>) => …\`.
    With \`function List<T>(…)\` there's no ambiguity.
    :::

    ## Wrapping native elements: ComponentProps

    A \`RuneButton\` should accept **everything** a \`<button>\` accepts (\`onClick\`, \`disabled\`,
    \`type\`, \`aria-label\`, \`title\`…) without you listing them all. \`ComponentProps<'button'>\`
    is that list, ready-made. Combine it with your own props using \`&\`:

    \`\`\`tsx
    import type { ComponentProps } from 'react';

    type RuneButtonProps = ComponentProps<'button'> & {
      variant?: 'primary' | 'danger'; // a union of string literals
    };

    function RuneButton({ variant = 'primary', className, ...rest }: RuneButtonProps) {
      return <button {...rest} className={\`rune-btn \${variant} \${className ?? ''}\`} />;
    }
    \`\`\`

    - \`...rest\` collects every other prop (including \`children\`), and \`{...rest}\` passes it on.
    - Spread **first**, then set \`className\`, so your classes are not overwritten.
    - \`'primary' | 'danger'\` is a **union type**: \`variant="dangr"\` becomes a compile error.
    - \`ComponentProps<typeof Avatar>\` reads the props of one of your *own* components.

    :::pro
    In React 19, \`ref\` is a regular prop, and it's already inside \`ComponentProps<'button'>\`,
    so \`RuneButton\` forwards refs with no \`forwardRef\`. (Use \`ComponentPropsWithoutRef\` if you
    explicitly *don't* want that.) You'll also see \`React.FC<Props>\` in older code; today a plain
    function with typed props is the recommended style.
    :::

    :::mistake
    \`type Props = { variant: string }\` lets any typo through. If only a few values are valid,
    say so with a union: \`variant: 'primary' | 'danger'\`.
    :::
  `,
  task: md`
    ## 🎯 Make the mould shape-shift

    The \`App\` already uses \`List\` for members **and** for runes, and \`RuneButton\` with an
    \`aria-label\` and a \`variant\`. (A real \`tsc\` would be shouting:
    *"Property 'renderItem' does not exist on type 'ListProps'."*) Fix the two components:

    1. **\`List\`** must be generic: \`type ListProps<T>\` with \`items: T[]\`,
       \`getKey: (item: T) => string | number\`, \`renderItem: (item: T) => ReactNode\` and an
       optional \`emptyText?: string\`, and \`export function List<T>(…: ListProps<T>)\`.
       - It renders \`<ul className="list">\` with one \`<li>\` per item, keyed by \`getKey(item)\`,
         containing \`renderItem(item)\`.
       - With no items, it renders \`<p className="empty">\` showing \`emptyText\`, or
         **Nothing here yet.** when none is given.
    2. **\`RuneButton\`**: \`type RuneButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'danger' }\`.
       - It forwards **every** other prop to the \`<button>\` (use \`...rest\`).
       - Its \`className\` is \`rune-btn\` plus the variant (default \`primary\`) plus any
         \`className\` passed in.
  `,
  starter: code`
    import { useState } from 'react';
    import type { ComponentProps, ReactNode } from 'react';

    type Member = { id: number; name: string; rank: 'apprentice' | 'journeyman' | 'master' };

    const MEMBERS: Member[] = [
      { id: 1, name: 'Ada', rank: 'master' },
      { id: 2, name: 'Linus', rank: 'journeyman' },
      { id: 3, name: 'Grace', rank: 'apprentice' },
    ];

    // TODO 1: make this generic: type ListProps<T> = { items: T[]; getKey: …; renderItem: …; emptyText?: string }
    type ListProps = { items: Member[] };

    export function List({ items }: ListProps) {
      return (
        <ul className="list">
          {items.map((m) => (
            <li key={m.id}>{m.name}</li>
          ))}
        </ul>
      );
    }

    // TODO 2: type RuneButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'danger' }
    type RuneButtonProps = { children: ReactNode; onClick: () => void };

    export function RuneButton({ children, onClick }: RuneButtonProps) {
      return (
        <button className="rune-btn primary" onClick={onClick}>
          {children}
        </button>
      );
    }

    export default function App() {
      const [members, setMembers] = useState<Member[]>(MEMBERS);
      return (
        <div className="mould">
          <h1>⚒️ Guild roll</h1>
          <List
            items={members}
            getKey={(m) => m.id}
            renderItem={(m) => (
              <span>
                {m.name} · <em>{m.rank}</em>
              </span>
            )}
            emptyText="The roll is empty."
          />
          <h2>Runes</h2>
          <List items={['ᚠ', 'ᚢ', 'ᚦ']} getKey={(r) => r} renderItem={(r) => <b className="rune">{r}</b>} />
          <RuneButton variant="danger" aria-label="Dismiss every member" onClick={() => setMembers([])}>
            🔥 Dismiss all
          </RuneButton>
        </div>
      );
    }
  `,
  solution: code`
    import { useState } from 'react';
    import type { ComponentProps, ReactNode } from 'react';

    type Member = { id: number; name: string; rank: 'apprentice' | 'journeyman' | 'master' };

    const MEMBERS: Member[] = [
      { id: 1, name: 'Ada', rank: 'master' },
      { id: 2, name: 'Linus', rank: 'journeyman' },
      { id: 3, name: 'Grace', rank: 'apprentice' },
    ];

    type ListProps<T> = {
      items: T[];
      getKey: (item: T) => string | number;
      renderItem: (item: T) => ReactNode;
      emptyText?: string;
    };

    export function List<T>({ items, getKey, renderItem, emptyText = 'Nothing here yet.' }: ListProps<T>) {
      if (items.length === 0) return <p className="empty">{emptyText}</p>;
      return (
        <ul className="list">
          {items.map((item) => (
            <li key={getKey(item)}>{renderItem(item)}</li>
          ))}
        </ul>
      );
    }

    type RuneButtonProps = ComponentProps<'button'> & {
      variant?: 'primary' | 'danger';
    };

    export function RuneButton({ variant = 'primary', className, ...rest }: RuneButtonProps) {
      const classes = ['rune-btn', variant, className].filter(Boolean).join(' ');
      return <button {...rest} className={classes} />;
    }

    export default function App() {
      const [members, setMembers] = useState<Member[]>(MEMBERS);
      return (
        <div className="mould">
          <h1>⚒️ Guild roll</h1>
          <List
            items={members}
            getKey={(m) => m.id}
            renderItem={(m) => (
              <span>
                {m.name} · <em>{m.rank}</em>
              </span>
            )}
            emptyText="The roll is empty."
          />
          <h2>Runes</h2>
          <List items={['ᚠ', 'ᚢ', 'ᚦ']} getKey={(r) => r} renderItem={(r) => <b className="rune">{r}</b>} />
          <RuneButton variant="danger" aria-label="Dismiss every member" onClick={() => setMembers([])}>
            🔥 Dismiss all
          </RuneButton>
        </div>
      );
    }
  `,
  hints: [
    md`Add a type parameter to both the type and the function: \`type ListProps<T> = { items: T[]; getKey: (item: T) => string | number; renderItem: (item: T) => ReactNode; emptyText?: string };\` and \`export function List<T>({ items, getKey, renderItem, emptyText = 'Nothing here yet.' }: ListProps<T>)\`.`,
    md`Inside \`List\`: \`if (items.length === 0) return <p className="empty">{emptyText}</p>;\` and otherwise map to \`<li key={getKey(item)}>{renderItem(item)}</li>\` inside \`<ul className="list">\`.`,
    md`For the button: \`function RuneButton({ variant = 'primary', className, ...rest }: RuneButtonProps)\` returning \`<button {...rest} className={['rune-btn', variant, className].filter(Boolean).join(' ')} />\`. \`children\` travels inside \`rest\`.`,
  ],
  tests: [
    test('List renders any kind of item through renderItem', (t) => {
      const { List } = t.exports;
      t.expect(typeof List === 'function', 'Export the List component: export function List<T>(…).');
      t.renderComponent(List, { items: [3, 1, 4], getKey: (n) => n, renderItem: (n) => t.h('b', null, `#${n * 10}`) });
      const lis = t.$$('ul.list > li');
      t.expect(lis.length === 3, `List with 3 numbers should render 3 <li> inside <ul className="list">, found ${lis.length}.`);
      t.expect(
        lis.map((li) => squish(li.textContent)).join(',') === '#30,#10,#40',
        `Each <li> should contain renderItem(item). Got: ${lis.map((li) => `"${squish(li.textContent)}"`).join(', ')}. Don't read item.name: call renderItem(item).`,
      );
      t.renderComponent(List, {
        items: [{ code: 'x1', label: 'Ember' }, { code: 'x2', label: 'Frost' }],
        getKey: (p) => p.code,
        renderItem: (p) => t.h('i', null, p.label),
      });
      t.expect(squish(t.$$('ul.list > li').map((li) => li.textContent).join(' ')) === 'Ember Frost', 'List should also work for objects: render renderItem(item) for each.');
      t.expect(!t.warnings.some((w) => /unique "key"/.test(w)), 'React warned about keys. Use key={getKey(item)} on each <li>.');
    }),
    test('An empty List shows emptyText, or "Nothing here yet."', (t) => {
      const { List } = t.exports;
      t.renderComponent(List, { items: [], getKey: (x) => x, renderItem: (x) => x });
      const p = t.$('p.empty');
      t.expect(p, 'With no items, List should render <p className="empty"> instead of the list.');
      t.expect(squish(p.textContent) === 'Nothing here yet.', `The empty text reads "${squish(p.textContent)}", expected the default "Nothing here yet.".`);
      t.expect(!t.$('ul.list'), 'With no items, do not render the <ul> at all.');
      t.renderComponent(List, { items: [], getKey: (x) => x, renderItem: (x) => x, emptyText: 'No runes.' });
      t.expect(squish(t.$('p.empty')?.textContent) === 'No runes.', 'When emptyText is passed, show it in the <p className="empty">.');
    }),
    test('RuneButton forwards every native button prop', (t) => {
      const { RuneButton } = t.exports;
      t.expect(typeof RuneButton === 'function', 'Export the RuneButton component.');
      let clicks = 0;
      t.renderComponent(RuneButton, {
        type: 'submit',
        title: 'Seal it',
        'aria-label': 'Seal the scroll',
        'data-rune': 'sowilo',
        className: 'wide',
        variant: 'danger',
        onClick: () => clicks++,
        children: 'Seal',
      });
      const btn = t.find('button');
      t.expect(btn.getAttribute('type') === 'submit', 'type="submit" did not reach the <button>. Collect the other props with ...rest and spread them: <button {...rest} />.');
      t.expect(btn.getAttribute('title') === 'Seal it' && btn.getAttribute('aria-label') === 'Seal the scroll', 'title and aria-label must be forwarded to the <button> (spread ...rest).');
      t.expect(btn.getAttribute('data-rune') === 'sowilo', 'Even data-* attributes should be forwarded: spread ...rest onto the <button>.');
      t.expect(squish(btn.textContent) === 'Seal', 'children should show inside the button (they travel inside rest).');
      t.click(btn);
      t.expect(clicks === 1, 'onClick should be forwarded too.');
      const cls = btn.className.split(/\s+/);
      t.expect(
        cls.includes('rune-btn') && cls.includes('danger') && cls.includes('wide'),
        `className is "${btn.className}", expected it to contain rune-btn, danger and wide. Set className after the spread so it isn't overwritten.`,
      );
      t.expect(!cls.includes('primary'), 'variant="danger" was passed, so the button should not also have the primary class.');
      t.renderComponent(RuneButton, { disabled: true, children: 'Locked' });
      const plain = t.find('button');
      t.expect(plain.disabled, 'disabled must be forwarded to the <button>.');
      t.expect(plain.className.split(/\s+/).includes('primary'), `With no variant, the class should include "primary" (the default). Got "${plain.className}".`);
      t.expect(!/undefined|null/.test(plain.className), `className is "${plain.className}": filter out a missing className instead of printing "undefined".`);
    }),
    test('In the App, 🔥 Dismiss all empties the roll', (t) => {
      t.render();
      t.expect(t.hasText('Ada') && t.hasText('ᚦ'), 'The App should show the members and the runes through List.');
      const btn = t.find('button[aria-label="Dismiss every member"]');
      t.click(btn);
      t.expectText('The roll is empty.', 'After dismissing everyone, the members List should show its emptyText "The roll is empty.".');
    }),
    test("List is generic and RuneButton builds on ComponentProps<'button'>", (t) => {
      const src = codeOnly(t);
      t.expect(/type\s+ListProps\s*<\s*T\s*>|interface\s+ListProps\s*<\s*T\s*>/.test(src), 'Give the props type a type parameter: type ListProps<T> = { … }.');
      t.expect(/items\s*:\s*(T\[\]|Array\s*<\s*T\s*>|readonly\s+T\[\])/.test(src), 'Type the items as T[].');
      t.expect(/renderItem\s*:\s*\(\s*\w+\s*:\s*T\s*\)\s*=>/.test(src), 'Type renderItem as (item: T) => ReactNode.');
      t.expect(
        /function\s+List\s*<\s*T\b[^>]*>|List\s*=\s*<\s*T\b[^>]*>/.test(src),
        'Make the component itself generic: export function List<T>(props: ListProps<T>).',
      );
      t.expect(/ListProps\s*<\s*T\s*>\s*\)/.test(src), "Annotate List's parameter with ListProps<T>.");
      t.expect(
        /ComponentProps(WithoutRef|WithRef)?\s*<\s*['"]button['"]\s*>/.test(src),
        "Build RuneButtonProps on the native button's props: ComponentProps<'button'> & { variant?: … }.",
      );
      t.expect(/['"]primary['"]\s*\|\s*['"]danger['"]|['"]danger['"]\s*\|\s*['"]primary['"]/.test(src), "Type variant as a union of literals: variant?: 'primary' | 'danger'.");
    }),
  ],
  css: code`
    .mould { padding: 16px; border-radius: 16px; background: #1c1917; color: #fef3c7; }
    .mould h1 { margin-top: 0; }
    .list { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .list li { padding: 6px 12px; border-radius: 999px; background: #44403c; }
    .rune { font-size: 1.4em; color: #fbbf24; }
    .empty { color: #a8a29e; font-style: italic; }
    .rune-btn { border: none; border-radius: 10px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
    .rune-btn.primary { background: #f59e0b; color: #1c1917; }
    .rune-btn.danger { background: #dc2626; color: white; }
  `,
  concepts: [
    {
      id: 'guild-generic-components',
      icon: '🧬',
      title: 'Generic components',
      summary: 'A type parameter <T> lets one component work for any item type, with full type safety.',
      snippet: code`
        type ListProps<T> = { items: T[]; renderItem: (item: T) => ReactNode };
        function List<T>({ items, renderItem }: ListProps<T>) { … }

        <List items={members} renderItem={(m) => m.name} /> // T = Member
      `,
      detail: 'TypeScript infers T from the props. In .tsx, a generic arrow function is written <T,>(…) => …',
    },
    {
      id: 'guild-component-props',
      icon: '🔘',
      title: "ComponentProps<'button'>",
      summary: 'All the props of a native element (or another component), ready to extend and forward.',
      snippet: code`
        type RuneButtonProps = ComponentProps<'button'> & { variant?: 'primary' | 'danger' };
        function RuneButton({ variant = 'primary', className, ...rest }: RuneButtonProps) {
          return <button {...rest} className={\`rune-btn \${variant}\`} />;
        }
      `,
      detail: "Union types like 'primary' | 'danger' turn typos into compile errors. ComponentProps<typeof X> reads your own components' props.",
    },
  ],
};

/** Submits the register form in one of the forms on screen. */
function registerParts(t, scope) {
  const root = scope || t.container;
  const name = controlForLabel(root, 'Mage name');
  const email = controlForLabel(root, 'Guild email');
  t.expect(name && email, 'Could not find inputs labelled "Mage name" and "Guild email". Give each <input> an id and its <label> a matching htmlFor.');
  return { name, email, form: name.closest('form') };
}

/** The text of the elements an input's aria-describedby points at. */
function describedText(input) {
  const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  return squish(
    ids
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((el) => el.textContent)
      .join(' '),
  );
}

const wardensRegister = {
  id: 'guild-register',
  type: 'code',
  title: "The Warden's Register",
  blurb: 'Labels, aria-describedby, focus management and a live region.',
  xp: 140,
  story: [
    { text: "Warden Aria guards the guild register. Her friend Sable reads it with a screen reader, and so far it sounds like: \"edit text, edit text, button\".", mood: 'worried' },
    { text: "Placeholders vanish as you type, errors float about unconnected, and the welcome is never announced. Let's make the form speak!", mood: 'thinking' },
  ],
  lesson: md`
    ## Accessibility is part of "working"

    Some guild members use a **screen reader** (software that reads the page aloud), some only
    a **keyboard**, some voice control or zoom. An accessible app works for all of them, and
    many countries require it by law. The best news: most of it comes free with **semantic
    HTML**. React renders real DOM, so everything you know about accessible HTML applies.

    ## Every input needs a label

    A placeholder is **not** a label: it disappears as soon as you type, is often low contrast,
    and many screen readers skip it. Connect a \`<label>\` to its input with matching
    \`htmlFor\` / \`id\`. In a reusable component, ids must be **unique** on the page, so
    generate them with \`useId\` (you met it in the Arcane Spire):

    \`\`\`jsx
    function Field({ label, ...inputProps }) {
      const id = useId();
      return (
        <div className="field">
          <label htmlFor={id}>{label}</label>
          <input id={id} {...inputProps} />
        </div>
      );
    }
    \`\`\`

    Now the screen reader says *"Mage name, edit text"*, and clicking the label focuses the input.
    (Wrapping works too: \`<label>Mage name <input /></label>\`.)

    ## Connect errors to their field

    \`\`\`jsx
    const errorId = id + '-error';

    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    />
    {error && <p className="error" id={errorId}>{error}</p>}
    \`\`\`

    - \`aria-invalid\` tells assistive technology the value is wrong.
    - \`aria-describedby\` points at the id of extra text, which is read after the label:
      *"Mage name, invalid entry, edit text. Name is required."*
    - Passing \`undefined\` leaves the attribute out entirely.

    ## Manage focus

    When submitting fails, a sighted user sees the red text. A screen-reader user hears
    nothing, unless you **move focus** to the first invalid field. React 19 lets a component
    take \`ref\` as a normal prop, so \`Field\` can pass it straight to its \`<input>\`:

    \`\`\`jsx
    function Field({ label, ref, ...inputProps }) {
      // …
      return <input ref={ref} id={id} {...inputProps} />;
    }

    // in App
    const nameRef = useRef(null);
    <Field label="Mage name" ref={nameRef} … />
    if (errors.name) nameRef.current.focus();
    \`\`\`

    ## Announce changes with a live region

    Text that appears somewhere else on the page (a "Saved!" message) is silent to a screen
    reader unless it's in a **live region**:

    - \`role="status"\` (polite): announced when the reader has finished what it's saying.
    - \`role="alert"\` (assertive): interrupts. Save it for urgent problems.

    :::mistake
    A live region must **already be in the DOM** before its text changes. If you render
    \`{message && <p role="status">{message}</p>}\`, the region appears together with its text,
    and many screen readers say nothing. Render the region **always**, and change only its
    contents: \`<p role="status">{message}</p>\`.
    :::

    :::tip
    The first rule of ARIA: **don't use ARIA if a native element does the job**. A \`<button>\`
    beats \`<div role="button">\`, and a \`<label>\` beats \`aria-label\` on a visible field.
    The lint plugin \`eslint-plugin-jsx-a11y\` catches many of these mistakes while you type.
    :::
  `,
  task: md`
    ## 🎯 Make the register speak

    1. In \`Field\`, get an id from \`useId()\`. Render \`<label htmlFor={id}>{label}</label>\` and
       give the \`<input>\` that \`id\`. The labels are **Mage name** and **Guild email**.
    2. When a field has an \`error\`, render it as \`<p className="error" id={…}>\` with its own id,
       and give the input \`aria-invalid="true"\` and \`aria-describedby\` set to that id. Without
       an error, leave both attributes off.
    3. When a submit fails, **focus the first invalid field** (name before email). \`Field\` can
       take a \`ref\` prop and pass it to its \`<input>\`.
    4. Replace the conditional welcome with a live region that is **always rendered**:
       \`<p role="status" className="announce">{welcome}</p>\`. After a valid submit it reads
       **Welcome to the guild, Ada!** (with the typed name).
  `,
  starter: code`
    import { useId, useRef, useState } from 'react';

    function Field({ label, type = 'text', value, onChange, error }) {
      // TODO 1: const id = useId(); then <label htmlFor={id}> + <input id={id}>
      // TODO 2: link the error: aria-invalid + aria-describedby → the error's id
      // TODO 3: accept a ref prop and put it on the <input>
      return (
        <div className="field">
          <input type={type} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />
          {error && <p className="error">{error}</p>}
        </div>
      );
    }

    export default function App() {
      const [name, setName] = useState('');
      const [email, setEmail] = useState('');
      const [errors, setErrors] = useState({});
      const [welcome, setWelcome] = useState('');

      function handleSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!name.trim()) next.name = 'Name is required';
        if (!email.includes('@')) next.email = 'Enter a valid email';
        setErrors(next);
        if (next.name || next.email) {
          setWelcome('');
          // TODO 3: focus the first invalid field
          return;
        }
        setWelcome(\`Welcome to the guild, \${name.trim()}!\`);
      }

      return (
        <form className="register" onSubmit={handleSubmit} noValidate>
          <h1>🛡️ Guild register</h1>
          <Field label="Mage name" value={name} onChange={setName} error={errors.name} />
          <Field label="Guild email" type="email" value={email} onChange={setEmail} error={errors.email} />
          <button type="submit">Join the guild</button>
          {/* TODO 4: a live region must exist BEFORE its text changes */}
          {welcome && <p className="announce">{welcome}</p>}
        </form>
      );
    }
  `,
  solution: code`
    import { useId, useRef, useState } from 'react';

    function Field({ label, type = 'text', value, onChange, error, ref }) {
      const id = useId();
      const errorId = id + '-error';
      return (
        <div className="field">
          <label htmlFor={id}>{label}</label>
          <input
            ref={ref}
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p className="error" id={errorId}>
              {error}
            </p>
          )}
        </div>
      );
    }

    export default function App() {
      const [name, setName] = useState('');
      const [email, setEmail] = useState('');
      const [errors, setErrors] = useState({});
      const [welcome, setWelcome] = useState('');
      const nameRef = useRef(null);
      const emailRef = useRef(null);

      function handleSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!name.trim()) next.name = 'Name is required';
        if (!email.includes('@')) next.email = 'Enter a valid email';
        setErrors(next);
        if (next.name || next.email) {
          setWelcome('');
          if (next.name) nameRef.current.focus();
          else emailRef.current.focus();
          return;
        }
        setWelcome(\`Welcome to the guild, \${name.trim()}!\`);
      }

      return (
        <form className="register" onSubmit={handleSubmit} noValidate>
          <h1>🛡️ Guild register</h1>
          <Field label="Mage name" ref={nameRef} value={name} onChange={setName} error={errors.name} />
          <Field label="Guild email" type="email" ref={emailRef} value={email} onChange={setEmail} error={errors.email} />
          <button type="submit">Join the guild</button>
          <p role="status" className="announce">
            {welcome}
          </p>
        </form>
      );
    }
  `,
  hints: [
    md`In \`Field\`: \`const id = useId();\`, then \`<label htmlFor={id}>{label}</label>\` above \`<input id={id} … />\`. You can drop the \`placeholder\`.`,
    md`Make an error id like \`const errorId = id + '-error';\`. On the input: \`aria-invalid={error ? true : undefined}\` and \`aria-describedby={error ? errorId : undefined}\`; on the paragraph: \`<p className="error" id={errorId}>\`.`,
    md`Add \`ref\` to Field's props and \`ref={ref}\` on the \`<input>\`. In App: \`const nameRef = useRef(null)\` (and \`emailRef\`), pass \`ref={nameRef}\`, and in the failing branch \`if (next.name) nameRef.current.focus(); else emailRef.current.focus();\`. Finally: \`<p role="status" className="announce">{welcome}</p>\`.`,
  ],
  tests: [
    test('Both inputs have a real <label> (placeholders are not labels)', (t) => {
      t.render();
      const name = controlForLabel(t.container, 'Mage name');
      t.expect(
        name && name.tagName === 'INPUT',
        'No input is labelled "Mage name". Render <label htmlFor={id}>Mage name</label> and give the <input> the same id.',
      );
      const email = controlForLabel(t.container, 'Guild email');
      t.expect(email && email.type === 'email', 'The email <input type="email"> needs a <label> that says "Guild email", connected with htmlFor/id.');
      t.expect(accessibleName(name) === 'Mage name', `A screen reader would announce the name field as "${accessibleName(name)}", expected "Mage name".`);
    }),
    test('Two registers on one page keep their labels apart (useId)', (t) => {
      t.render(t.h('div', null, t.h(t.App, { key: 1 }), t.h(t.App, { key: 2 })));
      const forms = t.$$('form');
      t.expect(forms.length === 2, 'Expected two <form className="register"> elements.');
      for (const form of forms) {
        const { name, email } = registerParts(t, form);
        t.expect(form.contains(name) && form.contains(email), 'A label points at an input in the OTHER form. Each Field must use its own useId() value.');
      }
      // Submit both empty, so the error ids exist too.
      for (const form of t.$$('form')) t.submit(form);
      const ids = t.$$('[id]').map((el) => el.id);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      t.expect(
        !dupes.length,
        `Two registers on the same page produced duplicate ids (${[...new Set(dupes)].join(', ')}). Hard-coded ids clash: build every id (inputs AND errors) from useId() inside Field.`,
      );
    }),
    test('Errors are linked with aria-invalid and aria-describedby', (t) => {
      t.render();
      let { name, email, form } = registerParts(t);
      t.expect(!name.hasAttribute('aria-invalid') || name.getAttribute('aria-invalid') === 'false', 'Before submitting, the name input should not be aria-invalid.');
      t.submit(form);
      ({ name, email } = registerParts(t));
      t.expect(name.getAttribute('aria-invalid') === 'true', 'After an empty submit, the name input needs aria-invalid="true".');
      t.expect(
        /Name is required/.test(describedText(name)),
        `The name input's aria-describedby should point at the id of the <p className="error"> that says "Name is required". It points at: "${describedText(name) || 'nothing'}".`,
      );
      t.expect(email.getAttribute('aria-invalid') === 'true', 'The empty email input needs aria-invalid="true" too.');
      t.expect(/Enter a valid email/.test(describedText(email)), 'The email input\'s aria-describedby should point at its "Enter a valid email" error.');
      t.type(name, 'Ada');
      t.submit(form);
      ({ name } = registerParts(t));
      t.expect(
        name.getAttribute('aria-invalid') !== 'true',
        'Once the name is filled in and submitted again, remove aria-invalid from it (pass undefined when there is no error).',
      );
      t.expect(!/Name is required/.test(describedText(name)), 'The fixed name field still points at a "Name is required" error.');
    }),
    test('A failed submit focuses the first invalid field', (t) => {
      t.render();
      const { name, form } = registerParts(t);
      t.submit(form);
      t.expect(
        document.activeElement === registerParts(t).name,
        'After an empty submit, focus should move to the name input (the first invalid field). Pass a ref to Field, put it on the <input>, and call ref.current.focus().',
      );
      t.type(name, 'Ada');
      t.submit(form);
      t.expect(document.activeElement === registerParts(t).email, 'With a name but no valid email, focus should move to the email input.');
    }),
    test('A status live region announces the welcome', (t) => {
      t.render();
      const region = t.$('[role="status"]');
      t.expect(
        region,
        'Render <p role="status" className="announce"> from the start (empty at first). A live region must be in the page BEFORE its text changes.',
      );
      const { name, email, form } = registerParts(t);
      t.type(name, 'Ada');
      t.type(email, 'ada@guild.rx');
      t.submit(form);
      const after = t.$('[role="status"]');
      t.expect(after && squish(after.textContent) === 'Welcome to the guild, Ada!', `The status region should read "Welcome to the guild, Ada!", it reads "${squish(after?.textContent)}".`);
      t.expect(
        after === region,
        'The status region was replaced by a new element. Keep the same <p role="status"> on screen all the time and only change its text.',
      );
      t.expect(!t.$('.error'), 'After a valid submit there should be no error messages left.');
    }),
  ],
  css: code`
    .register { max-width: 360px; padding: 18px; border-radius: 16px; background: #0f172a; color: #e2e8f0; border: 2px solid #38bdf8; }
    .register h1 { margin-top: 0; font-size: 1.4em; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .field label { font-weight: 700; }
    .field input[aria-invalid="true"] { border: 2px solid #f87171; }
    .error { margin: 0; color: #fca5a5; font-size: 0.9em; }
    .announce { min-height: 1.4em; color: #86efac; font-weight: 700; }
  `,
  concepts: [
    {
      id: 'guild-labels-aria',
      icon: '🏷️',
      title: 'Labels & aria-describedby',
      summary: 'Connect every input to a <label> (useId for unique ids); link errors with aria-invalid + aria-describedby.',
      snippet: code`
        const id = useId();
        <label htmlFor={id}>Mage name</label>
        <input id={id} aria-invalid={error ? true : undefined}
               aria-describedby={error ? id + '-error' : undefined} />
        {error && <p id={id + '-error'}>{error}</p>}
      `,
      detail: 'Placeholders are not labels. Prefer native HTML over ARIA whenever a native element does the job.',
    },
    {
      id: 'guild-focus-live',
      icon: '📣',
      title: 'Focus & live regions',
      summary: 'Move focus to what needs attention; announce changes with an always-rendered role="status".',
      snippet: code`
        if (errors.name) nameRef.current.focus();

        <p role="status">{message}</p>  // always rendered
      `,
      detail: 'role="alert" interrupts: keep it for urgent errors. A region that appears together with its text is often not announced.',
    },
  ],
};

/** Finds the spell menu trigger: whatever element says "Choose a spell". */
function menuTrigger(t) {
  const el = t.findText('Choose a spell', { exact: false });
  t.expect(el, 'Keep the trigger that says "🪄 Choose a spell ▾".');
  return el.closest('button') || el;
}

function openMenu(t) {
  const trigger = menuTrigger(t);
  t.click(trigger);
  const menu = t.$('[role="menu"]');
  t.expect(menu, 'After clicking the trigger, the menu should be open with role="menu" on its container.');
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
  t.expect(items.length === 3, `The menu should contain 3 elements with role="menuitem", found ${items.length}.`);
  return { trigger, menu, items };
}

const muteMenu = {
  id: 'guild-mute-menu',
  type: 'bug',
  title: 'The Mute Menu',
  blurb: 'Bug hunt! A spell menu only a mouse can use. Fix its roles, keyboard and focus.',
  xp: 150,
  story: [
    { text: 'The guild spell menu looks lovely... and only works with a mouse. Press Tab and the focus sails right past it.', mood: 'worried' },
    { text: 'Divs pretending to be buttons, no roles, and focus that falls into the void. Warden Aria counted five bugs. Can you find them all?', mood: 'thinking' },
  ],
  lesson: md`
    ## A div is not a button

    \`<div onClick>\` works for a mouse, and for nobody else. A real \`<button>\` gives you, for
    free:

    - a place in the **Tab order** (keyboard users can reach it);
    - activation with **Enter** and **Space**;
    - the **role** "button", so a screen reader announces *"Choose a spell, button"*;
    - the \`disabled\` attribute.

    Rebuilding that on a div (\`role="button"\`, \`tabIndex={0}\`, key handlers) is lots of
    work and easy to get wrong. Use the real element.

    ## ARIA: roles and states

    When no native element fits (HTML has no "menu of actions" widget), **ARIA** attributes
    describe what your markup *is* and what *state* it's in:

    \`\`\`jsx
    <button aria-haspopup="menu" aria-expanded={open}>Choose a spell ▾</button>
    {open && (
      <div role="menu" aria-label="Spells">
        <button role="menuitem" tabIndex={-1}>Fireball</button>
        …
      </div>
    )}
    \`\`\`

    - \`aria-haspopup="menu"\`: this button opens a menu.
    - \`aria-expanded\`: is it open right now? React turns \`true\` / \`false\` into the strings
      \`"true"\` / \`"false"\`.
    - \`role="menu"\` / \`role="menuitem"\`: the widget's structure.

    ARIA changes only what assistive technology is **told**. It adds **no behaviour**: a
    \`role="menu"\` doesn't make arrow keys work. That's your job.

    ## The keyboard contract

    The WAI-ARIA Authoring Practices describe how each widget should behave. For a menu button:

    | key | does |
    |---|---|
    | Enter / Space on the button | opens the menu, focus goes to the **first item** |
    | ↓ / ↑ | next / previous item, **wrapping** around the ends |
    | Escape | closes the menu, focus goes **back to the button** |
    | Enter on an item | chooses it, closes, focus back to the button |

    \`\`\`jsx
    function handleKeyDown(e) {
      const items = itemRefs.current;
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') items[(i + 1) % items.length].focus();
      if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length].focus();
    }
    \`\`\`

    The \`+ items.length\` makes \`-1\` wrap to the last index instead of \`undefined\`.

    ## Roving focus

    Items get \`tabIndex={-1}\`: focusable **by code** (\`.focus()\`), but skipped by Tab, so the
    whole menu is *one* Tab stop and the arrows move inside it. In toolbars and tab lists, the
    active item gets \`tabIndex={0}\` and the rest \`-1\`; as the arrows move, the 0 "roves" along.

    ## Never lose focus

    When the focused element disappears (the menu closes), focus falls back to \`<body>\`, and
    a keyboard user is thrown back to the top of the page. Always send it somewhere sensible:
    \`triggerRef.current.focus()\`.

    :::mistake
    An effect that should react to \`open\` needs \`open\` in its dependency array. With \`[]\` it
    only runs once, on mount, when the menu is still closed.
    :::
  `,
  task: md`
    ## 🎯 Give the menu a voice and a keyboard

    Find and fix the five bugs:

    1. The trigger is a \`<div>\`. Make it a \`<button>\` with \`aria-haspopup="menu"\` and
       \`aria-expanded\` (\`"true"\` when open, \`"false"\` when closed). Keep its text
       **🪄 Choose a spell ▾**.
    2. The menu container needs \`role="menu"\`. Each spell must be a focusable
       \`role="menuitem"\`: make them \`<button role="menuitem" tabIndex={-1}>\`.
    3. Opening the menu should move focus to the **first** spell. (Look at that effect.)
    4. **↓ / ↑** move focus between spells and **wrap** around. ↑ on the first spell crashes!
    5. **Escape** and **choosing a spell** both close the menu and put focus **back on the
       trigger**. Choosing still shows **Chosen: Frost Nova** (etc.).
  `,
  starter: code`
    import { useEffect, useRef, useState } from 'react';

    const SPELLS = ['Fireball', 'Frost Nova', 'Healing Light'];

    export default function App() {
      const [open, setOpen] = useState(false);
      const [chosen, setChosen] = useState(null);
      const itemRefs = useRef([]);
      const triggerRef = useRef(null);

      // Move focus into the menu when it opens.
      useEffect(() => {
        if (open) itemRefs.current[0]?.focus();
      }, []);

      function close() {
        setOpen(false);
      }

      function choose(spell) {
        setChosen(spell);
        close();
      }

      function handleMenuKeyDown(e) {
        const items = itemRefs.current;
        const index = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[(index + 1) % items.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[index - 1].focus();
        } else if (e.key === 'Escape') {
          close();
        }
      }

      return (
        <div className="spell-menu">
          <div className="menu-trigger" ref={triggerRef} onClick={() => setOpen(!open)}>
            🪄 Choose a spell ▾
          </div>
          {open && (
            <div className="menu" onKeyDown={handleMenuKeyDown}>
              {SPELLS.map((spell, i) => (
                <div
                  key={spell}
                  className="menu-item"
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  onClick={() => choose(spell)}
                >
                  {spell}
                </div>
              ))}
            </div>
          )}
          <p className="chosen">{chosen ? \`Chosen: \${chosen}\` : 'No spell chosen yet'}</p>
        </div>
      );
    }
  `,
  solution: code`
    import { useEffect, useRef, useState } from 'react';

    const SPELLS = ['Fireball', 'Frost Nova', 'Healing Light'];

    export default function App() {
      const [open, setOpen] = useState(false);
      const [chosen, setChosen] = useState(null);
      const itemRefs = useRef([]);
      const triggerRef = useRef(null);

      // Move focus into the menu when it opens.
      useEffect(() => {
        if (open) itemRefs.current[0]?.focus();
      }, [open]);

      function close() {
        setOpen(false);
        triggerRef.current.focus();
      }

      function choose(spell) {
        setChosen(spell);
        close();
      }

      function handleMenuKeyDown(e) {
        const items = itemRefs.current;
        const index = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[(index + 1) % items.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          items[(index - 1 + items.length) % items.length].focus();
        } else if (e.key === 'Escape') {
          close();
        }
      }

      return (
        <div className="spell-menu">
          <button
            className="menu-trigger"
            ref={triggerRef}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            🪄 Choose a spell ▾
          </button>
          {open && (
            <div className="menu" role="menu" aria-label="Spells" onKeyDown={handleMenuKeyDown}>
              {SPELLS.map((spell, i) => (
                <button
                  key={spell}
                  className="menu-item"
                  role="menuitem"
                  tabIndex={-1}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  onClick={() => choose(spell)}
                >
                  {spell}
                </button>
              ))}
            </div>
          )}
          <p className="chosen">{chosen ? \`Chosen: \${chosen}\` : 'No spell chosen yet'}</p>
        </div>
      );
    }
  `,
  hints: [
    md`Swap both kinds of \`<div>\` for \`<button>\`. The trigger gets \`aria-haspopup="menu"\` and \`aria-expanded={open}\`; the container gets \`role="menu"\`; each spell gets \`role="menuitem"\` and \`tabIndex={-1}\`.`,
    md`The focus effect has an empty dependency array, so it only runs on mount, while the menu is closed. It must re-run when \`open\` changes: \`[open]\`.`,
    md`Wrap ↑ like ↓ does: \`items[(index - 1 + items.length) % items.length].focus()\`. And make \`close()\` return focus: \`setOpen(false); triggerRef.current.focus();\`. Both Escape and \`choose\` go through \`close()\`.`,
  ],
  tests: [
    test('The trigger is a real <button> with aria-haspopup and aria-expanded', (t) => {
      t.render();
      const trigger = menuTrigger(t);
      t.expect(
        trigger.tagName === 'BUTTON',
        "The trigger is a <div>: keyboard users can't reach it and screen readers don't know it's clickable. Make it a <button>.",
      );
      t.expect(/^(menu|true)$/.test(trigger.getAttribute('aria-haspopup') || ''), 'Add aria-haspopup="menu" to the trigger: it announces that the button opens a menu.');
      t.expect(trigger.getAttribute('aria-expanded') === 'false', `While closed, the trigger needs aria-expanded="false" (it is ${trigger.getAttribute('aria-expanded') ?? 'missing'}). Use aria-expanded={open}.`);
      t.click(trigger);
      t.expect(menuTrigger(t).getAttribute('aria-expanded') === 'true', 'After opening, the trigger should say aria-expanded="true".');
    }),
    test('The open menu has role="menu" and three focusable menuitems', (t) => {
      t.render();
      const { items } = openMenu(t);
      t.expect(
        items.map((i) => squish(i.textContent)).join(', ') === 'Fireball, Frost Nova, Healing Light',
        'The menuitems should be Fireball, Frost Nova and Healing Light.',
      );
      for (const item of items) {
        t.expect(
          item.tagName === 'BUTTON' || item.hasAttribute('tabindex'),
          `"${squish(item.textContent)}" can't receive focus. Make each spell a <button role="menuitem" tabIndex={-1}>.`,
        );
      }
      t.expect(items.every((i) => i.tabIndex === -1), 'Give each menuitem tabIndex={-1}: focusable by code (and arrow keys), but not a separate Tab stop.');
    }),
    test('Opening focuses the first spell, and ↓ / ↑ move and wrap', (t) => {
      t.render();
      const { items } = openMenu(t);
      t.expect(
        document.activeElement === items[0],
        'Opening the menu should move focus to the first spell. The focus effect needs open in its dependency array: [open].',
      );
      t.keyDown(document.activeElement, 'ArrowDown');
      t.expect(document.activeElement === items[1], '↓ from Fireball should focus Frost Nova.');
      t.keyDown(document.activeElement, 'ArrowDown');
      t.keyDown(document.activeElement, 'ArrowDown');
      t.expect(document.activeElement === items[0], '↓ on the last spell should wrap around to the first.');
      t.keyDown(document.activeElement, 'ArrowUp');
      t.expect(
        document.activeElement === items[2],
        '↑ on the first spell should wrap to the last one. Use items[(index - 1 + items.length) % items.length].',
      );
    }),
    test('Escape closes the menu and returns focus to the trigger', (t) => {
      t.render();
      openMenu(t);
      const from = document.activeElement && t.container.contains(document.activeElement) ? document.activeElement : t.$('[role="menuitem"]');
      t.keyDown(from, 'Escape');
      t.expect(!t.$('[role="menu"]'), 'Escape should close the menu.');
      const trigger = menuTrigger(t);
      t.expect(
        document.activeElement === trigger,
        'After Escape, focus fell back to <body>, so a keyboard user is lost. Call triggerRef.current.focus() when closing.',
      );
      t.expect(trigger.getAttribute('aria-expanded') === 'false', 'Once closed, aria-expanded should be "false" again.');
    }),
    test('Choosing a spell shows it, closes the menu and returns focus', (t) => {
      t.render();
      const { items } = openMenu(t);
      t.click(items[1]);
      t.expectText('Chosen: Frost Nova', 'Clicking Frost Nova should show "Chosen: Frost Nova".');
      t.expect(!t.$('[role="menu"]'), 'Choosing a spell should close the menu.');
      t.expect(document.activeElement === menuTrigger(t), 'After choosing, put focus back on the trigger (choose() can reuse close()).');
    }),
  ],
  css: code`
    .spell-menu { position: relative; padding: 18px; border-radius: 16px; background: #2e1065; color: #ede9fe; min-height: 190px; }
    .menu-trigger { font: inherit; font-weight: 700; padding: 8px 14px; border-radius: 10px; border: 2px solid #a78bfa; background: #4c1d95; color: inherit; cursor: pointer; display: inline-block; }
    .menu { position: absolute; top: 62px; left: 18px; display: flex; flex-direction: column; min-width: 190px; padding: 6px; border-radius: 12px; background: #ede9fe; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .menu-item { font: inherit; text-align: left; padding: 8px 12px; border: none; border-radius: 8px; background: transparent; color: #2e1065; cursor: pointer; }
    .menu-item:hover, .menu-item:focus { background: #c4b5fd; outline: 2px solid #6d28d9; }
    .chosen { margin-top: 130px; font-weight: 700; }
  `,
  concepts: [
    {
      id: 'guild-semantic-html',
      icon: '🧱',
      title: 'Semantic elements first',
      summary: 'A real <button> brings focus, Enter/Space, its role and disabled for free; a <div onClick> brings nothing.',
      snippet: code`
        // ❌ mouse-only
        <div onClick={open}>Choose a spell</div>
        // ✅ everyone
        <button aria-haspopup="menu" aria-expanded={isOpen} onClick={open}>Choose a spell</button>
      `,
      detail: 'ARIA roles and states only describe; they add no behaviour. No ARIA is better than bad ARIA.',
    },
    {
      id: 'guild-keyboard-focus',
      icon: '⌨️',
      title: 'Keyboard support & roving focus',
      summary: 'Arrow keys move focus inside a widget (tabIndex -1 items, wrapping); Escape closes and returns focus.',
      snippet: code`
        if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length].focus();
        if (e.key === 'Escape') { setOpen(false); triggerRef.current.focus(); }
      `,
      detail: 'Follow the WAI-ARIA Authoring Practices for each widget. Never let focus fall back to <body>.',
    },
  ],
};

const provingGrounds = {
  id: 'guild-proving-grounds',
  type: 'code',
  title: 'The Proving Grounds',
  blurb: 'Write real tests, then watch them hunt down mutant components.',
  xp: 160,
  modules: labModules({
    file: './PotionShelf',
    subjects: { PotionShelf: makePotionShelf() },
    mutants: Object.values(SHELF_MUTANTS),
  }),
  story: [
    { text: "The Testers' Hall! Master Quill doesn't trust anything that hasn't been tested. Not even her breakfast.", mood: 'happy' },
    { text: 'Her trick: she secretly breaks a component and checks whether your tests notice. A test that never fails is just decoration!', mood: 'thinking' },
  ],
  lesson: md`
    ## Why write tests?

    Every quest in Reactoria has checked your code with **tests**. Now you write them. A good test
    suite lets you change code without fear: if you break something, a test goes red **before**
    your users find out.

    ## The Testing Library mindset

    > "The more your tests resemble the way your software is used, the more confidence they can give you."

    Users don't read your state or call your functions. They **see text**, **find controls by
    their label or role**, and **click and type**. So a React Testing Library test does exactly
    that:

    \`\`\`jsx
    test('brewing adds a potion', async () => {
      const user = userEvent.setup();
      render(<PotionShelf />);                                    // 1. arrange

      await user.click(screen.getByRole('button', { name: 'Brew' })); // 2. act

      expect(screen.getByRole('status')).toHaveTextContent('Potions: 1'); // 3. assert
    });
    \`\`\`

    - \`render(<Component />)\` mounts it into a test DOM.
    - \`screen\` queries the whole rendered page.
    - \`userEvent\` simulates a real user: focus moves, keys go down and up, and disabled buttons
      can't be clicked. Its methods return promises, so \`await\` them. (\`fireEvent\` is the
      lower-level tool: it only dispatches one single event.)
    - \`expect(…)\` plus a **matcher** states what must be true.

    ## Which query? Follow the priority list

    1. \`getByRole('button', { name: 'Brew' })\`: how assistive technology sees the page.
       **Use it for almost everything.**
    2. \`getByLabelText('Email')\`: form fields, the way users find them.
    3. \`getByPlaceholderText\`, \`getByText\`, \`getByDisplayValue\`: when there's no role or label.
    4. \`getByTestId\`: a last resort, because users can't see test ids.

    A nice bonus: \`getByRole\` **fails if the element isn't accessible**. A "button" built from a
    \`<div onClick>\` has no button role, so the query can't find it, and your test has caught an
    accessibility bug for free.

    ## get, query, find

    | prefix | no match | use it for |
    |---|---|---|
    | \`getBy…\` | throws | things that must be there **now** |
    | \`queryBy…\` | returns \`null\` | asserting something is **absent**: \`expect(screen.queryByText('Error')).not.toBeInTheDocument()\` |
    | \`findBy…\` | waits, then throws | things that appear **later** (after a fetch): \`await screen.findByText('Loaded')\` |

    Each has an \`…AllBy…\` twin that returns an array.

    ## Useful matchers

    \`toBeInTheDocument()\`, \`toHaveTextContent('…')\` (a *substring* match), \`toBeDisabled()\`,
    \`toHaveAttribute('aria-expanded', 'true')\`, \`toHaveFocus()\`, \`toBeVisible()\`,
    \`toHaveValue('Ada')\`, plus the classics \`toBe\`, \`toEqual\`, \`toHaveLength\`. Put \`.not\`
    in front of any of them to flip it.

    ## What NOT to test

    - **Implementation details**: state variable names, how many times a component rendered,
      which hook you used, CSS class names. Refactor the internals and these tests break, even
      though users notice no difference.
    - **The framework itself**: you don't need to prove that \`useState\` works.
    - **Giant snapshots** that everyone re-approves without reading.

    Test **behaviour**: what appears, what happens on click, what gets disabled.

    :::mistake
    A test that cannot fail is worse than no test: it gives false confidence. The way to know is
    **mutation testing**: break the code on purpose (change \`+ 1\` to \`+ 2\`, delete a line) and
    check that a test turns red. That is exactly how this quest grades you.
    :::

    :::pro
    In a real Vite project, these come from four packages, and each test file is named something
    like \`PotionShelf.test.jsx\`:

    \`\`\`jsx
    import { test, expect, vi } from 'vitest';
    import { render, screen } from '@testing-library/react';
    import userEvent from '@testing-library/user-event';
    import '@testing-library/jest-dom/vitest'; // adds toBeInTheDocument() and friends
    \`\`\`

    \`npx vitest\` runs them and re-runs on save. RTL unmounts everything after each test (with
    Vitest, turn on \`globals: true\` or call \`cleanup()\` in a setup file for that). This quest's
    \`mini-testing-library\` is a small, faithful copy that runs in your browser and cleans up for you.
    :::
  `,
  task: md`
    ## 🎯 Prove the Potion Shelf

    The component under test lives in \`./PotionShelf\` (you can't edit it, just like a teammate's
    code). This is what it does:

    \`\`\`jsx
    export function PotionShelf({ max = 3 }) {
      const [count, setCount] = useState(0);
      return (
        <section aria-label="Potion shelf">
          <h2>Potion shelf</h2>
          <p role="status">Potions: {count}</p>
          <button onClick={() => setCount((c) => c + 1)} disabled={count >= max}>Brew</button>
          <button onClick={() => setCount(0)}>Empty shelf</button>
        </section>
      );
    }
    \`\`\`

    Write tests with \`test(name, fn)\` from \`'mini-testing-library'\`. One example is already
    there. Add tests that:

    1. click **Brew** once and expect the status to show **Potions: 1**;
    2. brew, then click **Empty shelf**, and expect **Potions: 0**;
    3. click **Brew** 3 times and expect the Brew button to be **disabled**.

    Find buttons with \`screen.getByRole('button', { name: '…' })\`, not with \`querySelector\`.

    Grading: every test must **pass** against the real \`PotionShelf\`. Then Master Quill swaps in
    four broken **mutants**, and each must make at least one of your tests **fail**. Press
    **▶ Run tests** in the preview to run the same hunt yourself.
  `,
  starter: code`
    import { render, screen, userEvent, expect, test, TestReport } from 'mini-testing-library';
    import { PotionShelf } from './PotionShelf';

    // A complete example, written the Testing Library way:
    test('starts with an empty shelf', () => {
      render(<PotionShelf />);
      expect(screen.getByRole('status')).toHaveTextContent('Potions: 0');
    });

    // TODO 1: clicking Brew once shows "Potions: 1"
    //   const user = userEvent.setup();
    //   await user.click(screen.getByRole('button', { name: 'Brew' }));

    // TODO 2: "Empty shelf" puts the count back to 0

    // TODO 3: after 3 brews, the Brew button is disabled

    // The preview shows your test report.
    export default function App() {
      return <TestReport />;
    }
  `,
  solution: code`
    import { render, screen, userEvent, expect, test, TestReport } from 'mini-testing-library';
    import { PotionShelf } from './PotionShelf';

    test('starts with an empty shelf', () => {
      render(<PotionShelf />);
      expect(screen.getByRole('status')).toHaveTextContent('Potions: 0');
    });

    test('brewing adds exactly one potion', async () => {
      const user = userEvent.setup();
      render(<PotionShelf />);
      await user.click(screen.getByRole('button', { name: 'Brew' }));
      expect(screen.getByRole('status')).toHaveTextContent('Potions: 1');
    });

    test('emptying the shelf resets the count', async () => {
      const user = userEvent.setup();
      render(<PotionShelf />);
      await user.click(screen.getByRole('button', { name: 'Brew' }));
      await user.click(screen.getByRole('button', { name: 'Empty shelf' }));
      expect(screen.getByRole('status')).toHaveTextContent('Potions: 0');
    });

    test('the shelf holds at most 3 potions', async () => {
      const user = userEvent.setup();
      render(<PotionShelf />);
      const brew = screen.getByRole('button', { name: 'Brew' });
      await user.click(brew);
      await user.click(brew);
      await user.click(brew);
      expect(brew).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent('Potions: 3');
    });

    export default function App() {
      return <TestReport />;
    }
  `,
  hints: [
    md`Copy the shape of the example. Interactions are async, so the test function becomes \`async () => { … }\` and every \`user.click(…)\` gets an \`await\` in front.`,
    md`For the Brew test: \`const user = userEvent.setup(); render(<PotionShelf />); await user.click(screen.getByRole('button', { name: 'Brew' }));\` then \`expect(screen.getByRole('status')).toHaveTextContent('Potions: 1');\`.`,
    md`For the limit, keep the button in a variable: \`const brew = screen.getByRole('button', { name: 'Brew' });\`, click it three times with \`await user.click(brew);\`, then \`expect(brew).toBeDisabled();\`. The "Empty shelf" test is: click Brew, click \`{ name: 'Empty shelf' }\`, expect \`'Potions: 0'\`.`,
  ],
  tests: [
    test('Your tests all pass against the real PotionShelf', async (t) => {
      t.sourceExcludes(
        /querySelector|getElementsBy/,
        "Query the way a user looks at the page, with screen.getByRole / getByText, not querySelector.",
      );
      await expectAllPass(t, { min: 3, subject: 'PotionShelf' });
    }),
    test('Catches mutant #1: Brew adds 2 potions', (t) => expectCaught(t, SHELF_MUTANTS.double)),
    test('Catches mutant #2: Empty shelf does nothing', (t) => expectCaught(t, SHELF_MUTANTS.noEmpty)),
    test('Catches mutant #3: the shelf never fills up', (t) => expectCaught(t, SHELF_MUTANTS.noLimit)),
    test('Catches mutant #4: Brew is a clickable <div>, not a button', (t) => expectCaught(t, SHELF_MUTANTS.divButton)),
  ],
  css: code`
    .test-report { padding: 16px; border-radius: 14px; background: #1c1917; color: #fafaf9; font-family: system-ui, sans-serif; }
    .test-report h2 { margin: 0 0 4px; }
    .test-report h3 { margin: 14px 0 6px; }
    .test-report .count { color: #a8a29e; margin: 0 0 10px; }
    .test-report ul { list-style: none; padding: 0; margin: 10px 0 0; }
    .test-report li { padding: 6px 10px; border-radius: 8px; margin-bottom: 6px; background: #292524; }
    .test-report li small { display: block; margin-top: 4px; color: #fca5a5; white-space: pre-wrap; }
    .test-report .pass { color: #86efac; }
    .test-report .fail { color: #fca5a5; }
  `,
  concepts: [
    {
      id: 'guild-rtl',
      icon: '🧪',
      title: 'React Testing Library',
      summary: 'Render, find elements like a user (by role/label/text), interact with userEvent, assert with expect.',
      snippet: code`
        test('brewing adds a potion', async () => {
          const user = userEvent.setup();
          render(<PotionShelf />);
          await user.click(screen.getByRole('button', { name: 'Brew' }));
          expect(screen.getByRole('status')).toHaveTextContent('Potions: 1');
        });
      `,
      detail: 'getBy throws, queryBy returns null (for absence), findBy waits (for async UI). Prefer *ByRole: it doubles as an accessibility check.',
    },
    {
      id: 'guild-mutation-testing',
      icon: '🧟',
      title: 'Tests that can fail',
      summary: 'Break the code on purpose; a good test turns red. Test behaviour, not implementation details.',
      detail: "Don't test state names, render counts or CSS classes: refactors break those tests while users notice nothing.",
    },
  ],
};

const shipwrightsExam = {
  id: 'guild-shipwright',
  type: 'quiz',
  title: "The Shipwright's Exam",
  blurb: 'Vite, ESLint, the React Compiler, DevTools, env vars and deploying.',
  xp: 100,
  story: [
    { text: "Down at the guild docks, Shipwright Hal launches finished apps out into the world. Nothing leaves the harbour until it's built, linted, measured and safe.", mood: 'happy' },
    { text: 'No code this time: eight questions about the tools around React. Read every explanation, they hold the real treasure!', mood: 'thinking' },
  ],
  task: md`Eight questions about **tooling and shipping**: Vite, the hooks lint rules, the React Compiler, React DevTools, environment variables and deploying.`,
  questions: [
    q(
      'You run `npm run build` in a Vite project. What do you get?',
      [
        'A Node.js server that renders your components on every request',
        'The same unbundled files `npm run dev` serves, just copied to a folder',
        'A `dist/` folder of static files (HTML plus bundled, minified JS and CSS with hashed names) that any static host can serve',
        'A TypeScript type report and nothing else',
      ],
      2,
      "`npm run dev` starts a dev server that serves your source files on demand, with hot module replacement (edits appear instantly, state kept). `npm run build` creates the production version: bundled, tree-shaken, minified files in `dist/`. Hashed names like `index-4f9a1c.js` let browsers cache them forever, since a change produces a new name. `npm run preview` serves `dist/` locally so you can try the real build before you ship it.",
    ),
    q(
      "ESLint (with `eslint-plugin-react-hooks`) reports an **error** on this component. Why?\n\n```jsx\nfunction Profile({ user }) {\n  if (!user) return <p>Loading…</p>;\n  const [tab, setTab] = useState('bio');\n  return <Tabs value={tab} onChange={setTab} />;\n}\n```",
      [
        'Hooks must run in the same order on every render, but this `useState` is skipped whenever `user` is missing',
        '`useState` cannot hold a string',
        'Components are not allowed to return early',
        'Hooks may only be called inside `useEffect`',
      ],
      0,
      'This is `react-hooks/rules-of-hooks`. React tells hooks apart by their **call order**, so a hook after an early return (or inside an `if` or a loop) scrambles them as soon as the condition changes. Fix: call `useState` above the early return. Keep this plugin on in every project: Vite\'s React template sets it up for you.',
    ),
    q(
      "The linter warns: *React Hook useEffect has a missing dependency: 'roomId'.* What's the best response?\n\n```jsx\nuseEffect(() => {\n  const connection = connect(roomId);\n  return () => connection.close();\n}, []);\n```",
      [
        'Add `// eslint-disable-next-line`, because the linter is often wrong about effects',
        'Delete the dependency array, so the effect runs after every render',
        'Copy `roomId` into a ref, so the linter stops noticing it',
        'Add `roomId` to the array: then the effect reconnects whenever the room changes',
      ],
      3,
      "`react-hooks/exhaustive-deps` points at a real bug: with `[]`, the chat stays connected to the **first** room forever. Dependencies aren't something you choose; they're every reactive value the effect reads. If part of an effect must read the latest value *without* re-running it (say, the current theme for a notification), move that part into `useEffectEvent` instead of silencing the rule.",
    ),
    q(
      'What does the **React Compiler** do?',
      [
        'It turns JSX into plain JavaScript function calls',
        'At build time, it automatically memoizes components and values, so most hand-written `useMemo`, `useCallback` and `memo` become unnecessary',
        'It replaces the virtual DOM with direct DOM manipulation',
        'It type-checks your components so you can skip TypeScript',
      ],
      1,
      "The React Compiler is a build plugin (`babel-plugin-react-compiler`, enabled in your Vite config) that analyses components and inserts the memoization you would otherwise write by hand, often more precisely. It relies on the **Rules of React**: components that mutate props or read refs during render are skipped. The hooks ESLint plugin includes compiler-powered rules that flag such code, and a `'use no memo'` directive opts a single component out. JSX compilation (option A) is done by Babel/esbuild/SWC, as always.",
    ),
    q(
      'A list feels sluggish whenever you type in the search box above it. What is the best **first** step?',
      [
        'Wrap every component in `memo`, just in case',
        'Turn off StrictMode, because it makes production render twice',
        'Record the interaction in the React DevTools **Profiler** to see which components rendered, how long each took, and why',
        'Rewrite the list as a class component',
      ],
      2,
      "**Measure first.** The Profiler tab in React DevTools records commits: the flamegraph shows each component's render time, and with *Record why each component rendered* turned on, it tells you which props, state or hooks changed. *Highlight updates when components render* flashes re-renders on screen as they happen. For numbers in code, wrap a subtree in `<Profiler id=\"list\" onRender={…}>`. StrictMode's double rendering only happens in development, so it's not the culprit in production.",
    ),
    q(
      "A Vite app has this `.env` file. Which statement is true?\n\n```text\nVITE_API_URL=https://api.guild.rx\nVITE_PAYMENT_SECRET=sk_live_8f3a…\nDB_PASSWORD=hunter2\n```",
      [
        'All three are available in the browser as `import.meta.env.*`',
        "`VITE_API_URL` and `VITE_PAYMENT_SECRET` are written into the public JavaScript bundle (`DB_PASSWORD` isn't), so the payment secret has leaked",
        'Values from `.env` files are encrypted inside the bundle',
        'In the browser you read them with `process.env.VITE_API_URL`',
      ],
      1,
      "Vite exposes only variables prefixed with `VITE_`, as `import.meta.env.VITE_API_URL`, and it **pastes their values into the bundle at build time**. Anyone can open DevTools and read them. So `VITE_` variables are for public settings (an API's URL, a feature flag). Secrets belong on a **server** (an API route, serverless function or Server Function) that the browser calls. Also handy: `import.meta.env.DEV`, `.PROD` and `.MODE`.",
    ),
    q(
      'You deploy your Vite app (with client-side routing) to a static host. The home page works, but **refreshing** `/quests/42` shows the host\'s 404 page. Why?',
      [
        "The host looks for a file at `/quests/42`, which doesn't exist. Configure a fallback (rewrite) that serves `index.html` for unknown paths, so the router can take over",
        'Client-side routers only work in development',
        'You need to run `npm run dev` on the server',
        'Tree-shaking removed the route components from the build',
      ],
      0,
      "With client-side routing, there is only **one** HTML file: the router reads the URL in the browser. Clicking a link never asks the server, but a refresh or a shared link does. Every static host has a rewrite setting for this (for example, a Netlify `_redirects` line `/* /index.html 200`, or `rewrites` in `vercel.json`). If the app lives in a sub-folder (like GitHub Pages' `/my-repo/`), set Vite's `base` option too.",
    ),
    q(
      'In a Vite + TypeScript project, `npm run dev` happily runs code that contains a type error. Why, and what catches it?',
      [
        'Type errors only exist in production builds',
        "It's a bug in Vite",
        'Type errors are only style warnings and can be ignored',
        'Vite only **strips** types, file by file, which keeps it fast. Your editor and `tsc` (in the build script and in CI) do the actual checking',
      ],
      3,
      "Exactly how Reactoria runs your `.tsx` quests! Checking types needs the whole program, which is slow, so Vite leaves it to other tools: your editor shows errors as you type, and the template's `build` script runs `tsc -b && vite build`, so a type error fails the build. In CI, run `tsc --noEmit` (and your linter and tests) on every pull request.",
    ),
  ],
  concepts: [
    {
      id: 'guild-tooling',
      icon: '🧰',
      title: 'Lint, compile, profile',
      summary: 'eslint-plugin-react-hooks enforces the Rules of Hooks; the React Compiler auto-memoizes; DevTools Profiler measures.',
      detail: "Don't silence exhaustive-deps: it points at real stale-value bugs. Measure with the Profiler before optimizing.",
    },
    {
      id: 'guild-shipping',
      icon: '🚢',
      title: 'Building & deploying',
      summary: 'vite build makes static files in dist/; VITE_ env vars are public; SPAs need an index.html fallback on the host.',
      snippet: code`
        npm run build     # tsc -b && vite build  →  dist/
        npm run preview   # try the production build locally
        // in code: import.meta.env.VITE_API_URL  (public: never a secret!)
      `,
      detail: 'Secrets stay on a server. Type-check (tsc), lint and test in CI before every deploy.',
    },
  ],
};

// ---------------------------------------------------------------- boss

function makeSpellTabs({ panelFollows = true, ariaFollows = true, keyboard = true, wrap = true, reportOffset = 0 } = {}) {
  return function SpellTabs({ tabs, defaultIndex = 0, onChange }) {
    const [selected, setSelected] = React.useState(defaultIndex);
    const [ariaSelected, setAriaSelected] = React.useState(defaultIndex);
    const [panel, setPanel] = React.useState(defaultIndex);
    const refs = React.useRef([]);
    const baseId = React.useId();
    const select = (i) => {
      setSelected(i);
      if (ariaFollows) setAriaSelected(i);
      if (panelFollows) setPanel(i);
      if (onChange) onChange(i + reportOffset);
    };
    const onKeyDown = (e, i) => {
      if (!keyboard) return;
      const n = tabs.length;
      let next = null;
      if (e.key === 'ArrowRight') next = wrap ? (i + 1) % n : Math.min(i + 1, n - 1);
      else if (e.key === 'ArrowLeft') next = wrap ? (i - 1 + n) % n : Math.max(i - 1, 0);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      select(next);
      if (refs.current[next]) refs.current[next].focus();
    };
    return h(
      'div',
      { className: 'spell-tabs' },
      h(
        'div',
        { role: 'tablist', 'aria-label': 'Spellbook' },
        tabs.map((tab, i) =>
          h(
            'button',
            {
              key: tab.label,
              role: 'tab',
              id: `${baseId}-tab-${i}`,
              'aria-selected': i === ariaSelected,
              'aria-controls': `${baseId}-panel`,
              tabIndex: i === selected ? 0 : -1,
              ref: (el) => {
                refs.current[i] = el;
              },
              onClick: () => select(i),
              onKeyDown: (e) => onKeyDown(e, i),
            },
            tab.label,
          ),
        ),
      ),
      h('div', { role: 'tabpanel', id: `${baseId}-panel`, 'aria-labelledby': `${baseId}-tab-${panel}`, tabIndex: 0 }, tabs[panel] ? tabs[panel].content : null),
    );
  };
}

const TABS = { subject: 'SpellTabs' };
const GOLEM_MUTANTS = {
  stuckPanel: {
    ...TABS,
    label: "clicking a tab doesn't change the panel",
    impl: makeSpellTabs({ panelFollows: false }),
    hint: "Click a different tab and expect screen.getByRole('tabpanel') toHaveTextContent(…) of that tab's content.",
  },
  stuckAria: {
    ...TABS,
    label: 'aria-selected stays on the first tab',
    impl: makeSpellTabs({ ariaFollows: false }),
    hint: "After clicking a tab, expect it toHaveAttribute('aria-selected', 'true'), or find it with getByRole('tab', { selected: true }).",
  },
  deadKeys: {
    ...TABS,
    label: 'the arrow keys do nothing',
    impl: makeSpellTabs({ keyboard: false }),
    hint: "Focus a tab (await user.click(tab) or await user.tab()), press await user.keyboard('{ArrowRight}'), and expect the next tab toHaveFocus().",
  },
  noWrap: {
    ...TABS,
    label: 'ArrowRight on the last tab goes nowhere',
    impl: makeSpellTabs({ wrap: false }),
    hint: 'Focus the LAST tab, press {ArrowRight}, and expect the FIRST tab to be focused and selected.',
  },
  offByOne: {
    ...TABS,
    label: 'onChange reports the wrong index',
    impl: makeSpellTabs({ reportOffset: 1 }),
    hint: 'Pass onChange={onChange} with const onChange = vi.fn(), click the second tab, and expect(onChange).toHaveBeenCalledWith(1).',
  },
};

const regressionGolem = {
  id: 'guild-boss',
  type: 'build',
  boss: true,
  typescript: true,
  title: 'Boss: The Regression Golem',
  bossName: 'The Regression Golem',
  bossIcon: '🗿',
  blurb: 'Out-test the golem that slips old bugs back into finished code.',
  xp: 300,
  modules: labModules({
    file: './SpellTabs',
    subjects: { SpellTabs: makeSpellTabs() },
    mutants: Object.values(GOLEM_MUTANTS),
  }),
  badge: {
    id: 'badge-guild',
    name: 'Master Builder of the Guild',
    icon: '🏅',
    description: 'Typed, accessible and tested: the Guildhall certified your craft.',
  },
  story: [
    { text: 'RUMBLE. The Regression Golem stomps into the hall! It is made of every bug anyone ever fixed... and it puts them back, one by one, when nobody is watching.', mood: 'worried' },
    { text: "Its target: the guild's accessible SpellTabs. The golem forges five broken copies. Only a sharp test suite can tell a forgery from the real thing. Time to certify, Render Mage!", mood: 'excited' },
  ],
  lesson: md`
    ## Regressions

    A **regression** is a bug that comes back: something that used to work breaks after an
    unrelated change. Tests are the guard that stays on duty after you've moved on. Each test
    you write today protects that behaviour **forever**.

    ## Testing a widget's contract

    \`SpellTabs\` follows the WAI-ARIA tabs pattern, so its contract is written in roles and
    keys, and Testing Library can check all of it:

    \`\`\`tsx
    test('arrow keys move between tabs', async () => {
      const user = userEvent.setup();
      render(<SpellTabs tabs={SPELLS} />);

      await user.click(screen.getByRole('tab', { name: 'Fire' })); // focus it
      await user.keyboard('{ArrowRight}');

      const frost = screen.getByRole('tab', { name: 'Frost' });
      expect(frost).toHaveFocus();
      expect(frost).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Ice shards');
    });
    \`\`\`

    - \`getByRole('tab', { selected: true })\` finds the tab whose \`aria-selected\` is \`"true"\`.
    - \`user.keyboard('{ArrowRight}')\` presses a key on whatever has focus. \`{Home}\`,
      \`{End}\`, \`{Escape}\` and \`{Enter}\` work the same way.
    - \`await user.tab()\` presses Tab: a great way to test roving focus. Only the selected tab
      is a Tab stop (\`tabIndex={0}\`); the others have \`tabIndex={-1}\`.

    ## Testing callbacks with mocks

    A **mock function** records every call, so you can assert how a component talks to its
    parent:

    \`\`\`tsx
    const onChange = vi.fn();
    render(<SpellTabs tabs={SPELLS} onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    \`\`\`

    ## Typed tests

    Test files are TypeScript too (\`SpellTabs.test.tsx\`). Typing your fixtures with the
    component's own types means a renamed prop breaks the **test** at compile time, before it
    can silently test the wrong thing:

    \`\`\`tsx
    import { SpellTabs, type Tab } from './SpellTabs';

    const SPELLS: Tab[] = [
      { label: 'Fire', content: 'Flames dance' },
      // …
    ];
    \`\`\`

    :::tip
    Name each test like a sentence about behaviour ("ArrowRight on the last tab wraps to the
    first") and keep it to one idea. When the golem breaks something, the failing test's name
    tells you exactly what went wrong.
    :::

    :::mistake
    Don't test that \`setSelected\` was called or that the state equals 2: the golem's
    forgeries keep the same internals and break the **behaviour**. Test what a user can see,
    hear (roles, names, \`aria-selected\`) and do (click, keys, focus).
    :::
  `,
  task: md`
    ## 🎯 Out-test the Regression Golem

    The real \`SpellTabs\` (in \`./SpellTabs\`) promises this contract:

    - It renders a \`tablist\` with one **\`tab\`** per item (named by its \`label\`) and one
      **\`tabpanel\`** showing the selected tab's \`content\`. \`defaultIndex\` (default \`0\`)
      picks the first selection.
    - The selected tab has \`aria-selected="true"\` and is the only one with \`tabIndex={0}\`.
    - **Clicking** a tab selects it: its panel shows, and \`onChange(index)\` is called.
    - On a focused tab, **ArrowRight / ArrowLeft** select and focus the next / previous tab,
      **wrapping** around the ends. **Home / End** jump to the first / last tab.

    Write **at least 4 tests** in \`App.tsx\` with \`'mini-testing-library'\`. Find things by role
    (\`getByRole('tab', { name: 'Frost' })\`, \`getByRole('tabpanel')\`), not with
    \`querySelector\`. Every test must pass against the real component, and the golem's five
    forgeries must each fail at least one of them. Press **▶ Run tests** in the preview to watch
    the hunt.
  `,
  starter: code`
    import { render, screen, userEvent, expect, test, vi, TestReport } from 'mini-testing-library';
    import { SpellTabs, type Tab } from './SpellTabs';

    const SPELLS: Tab[] = [
      { label: 'Fire', content: 'Flames dance in your palm.' },
      { label: 'Frost', content: 'Ice shards hang in the air.' },
      { label: 'Light', content: 'A warm glow fills the hall.' },
    ];

    test('shows the first spell by default', () => {
      render(<SpellTabs tabs={SPELLS} />);
      expect(screen.getByRole('tab', { name: 'Fire' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Flames dance');
    });

    // TODO: clicking a tab shows its panel AND marks it aria-selected
    // TODO: clicking a tab calls onChange with its index (use vi.fn())
    // TODO: ArrowRight moves focus + selection to the next tab
    // TODO: ArrowRight on the LAST tab wraps around to the first

    export default function App() {
      return <TestReport />;
    }
  `,
  solution: code`
    import { render, screen, userEvent, expect, test, vi, TestReport } from 'mini-testing-library';
    import { SpellTabs, type Tab } from './SpellTabs';

    const SPELLS: Tab[] = [
      { label: 'Fire', content: 'Flames dance in your palm.' },
      { label: 'Frost', content: 'Ice shards hang in the air.' },
      { label: 'Light', content: 'A warm glow fills the hall.' },
    ];

    test('shows the first spell by default', () => {
      render(<SpellTabs tabs={SPELLS} />);
      expect(screen.getByRole('tab', { name: 'Fire' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Flames dance');
    });

    test('clicking a tab selects it and shows its panel', async () => {
      const user = userEvent.setup();
      render(<SpellTabs tabs={SPELLS} />);
      await user.click(screen.getByRole('tab', { name: 'Frost' }));
      expect(screen.getByRole('tab', { name: 'Frost' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Fire' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Ice shards');
    });

    test('clicking a tab reports its index through onChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<SpellTabs tabs={SPELLS} onChange={onChange} />);
      await user.click(screen.getByRole('tab', { name: 'Frost' }));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    test('ArrowRight moves focus and selection to the next tab', async () => {
      const user = userEvent.setup();
      render(<SpellTabs tabs={SPELLS} />);
      await user.click(screen.getByRole('tab', { name: 'Fire' }));
      await user.keyboard('{ArrowRight}');
      const frost = screen.getByRole('tab', { name: 'Frost' });
      expect(frost).toHaveFocus();
      expect(frost).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Ice shards');
    });

    test('ArrowRight on the last tab wraps around to the first', async () => {
      const user = userEvent.setup();
      render(<SpellTabs tabs={SPELLS} defaultIndex={2} />);
      await user.click(screen.getByRole('tab', { name: 'Light' }));
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Fire' })).toHaveFocus();
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Flames dance');
    });

    export default function App() {
      return <TestReport />;
    }
  `,
  hints: [
    md`Start every interactive test with \`const user = userEvent.setup();\` and \`render(<SpellTabs tabs={SPELLS} />);\`. Click a tab with \`await user.click(screen.getByRole('tab', { name: 'Frost' }))\`, then check **both** \`toHaveAttribute('aria-selected', 'true')\` on the tab and \`toHaveTextContent('Ice shards')\` on \`screen.getByRole('tabpanel')\`.`,
    md`For \`onChange\`: \`const onChange = vi.fn();\`, render with \`onChange={onChange}\`, click Frost, then \`expect(onChange).toHaveBeenCalledWith(1);\`.`,
    md`For the keyboard, focus a tab first (clicking it focuses it), then \`await user.keyboard('{ArrowRight}');\` and \`expect(screen.getByRole('tab', { name: 'Frost' })).toHaveFocus();\`. For the wrap, render with \`defaultIndex={2}\`, click Light, press \`{ArrowRight}\` and expect **Fire** to have focus.`,
  ],
  tests: [
    test('Your tests all pass against the real SpellTabs', async (t) => {
      t.sourceExcludes(/querySelector|getElementsBy/, 'Find elements by role (getByRole), the way assistive technology does, not with querySelector.');
      await expectAllPass(t, { min: 4, subject: 'SpellTabs' });
    }),
    test("Forgery #1: clicking a tab doesn't change the panel", (t) => expectCaught(t, GOLEM_MUTANTS.stuckPanel)),
    test('Forgery #2: aria-selected stays on the first tab', (t) => expectCaught(t, GOLEM_MUTANTS.stuckAria)),
    test('Forgery #3: the arrow keys do nothing', (t) => expectCaught(t, GOLEM_MUTANTS.deadKeys)),
    test('Forgery #4: ArrowRight on the last tab goes nowhere', (t) => expectCaught(t, GOLEM_MUTANTS.noWrap)),
    test('Forgery #5: onChange reports the wrong index', (t) => expectCaught(t, GOLEM_MUTANTS.offByOne)),
  ],
  css: provingGrounds.css,
  concepts: [
    {
      id: 'guild-testing-widgets',
      icon: '🗿',
      title: 'Testing keyboard & ARIA',
      summary: "Assert a widget's contract: roles, aria-selected, focus after keys, and callback calls (vi.fn()).",
      snippet: code`
        await user.click(screen.getByRole('tab', { name: 'Fire' }));
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('tab', { name: 'Frost' })).toHaveFocus();
        expect(onChange).toHaveBeenCalledWith(1);
      `,
      detail: 'A regression is a bug that comes back. Tests that check behaviour guard it forever.',
    },
  ],
};

export default {
  id: 'guildhall',
  file: '17-guildhall.js',
  title: 'The Guildhall',
  short: 'Craft',
  subtitle: 'Where master builders certify Render Mages: TypeScript, accessibility, testing and shipping.',
  icon: '🏛️',
  colors: ['#422006', '#d97706'],
  scenery: ['🔨', '📜', '🧪', '🗝️', '⚖️', '🛡️', '🏅', '🚢'],
  intro: [
    { text: 'The Guildhall! Every great app in Reactoria was built by a guild member, and only builders certified here may call themselves Render Mages.', mood: 'excited' },
    { text: "Knowing React is one thing. The guild also asks: is it typed? Can everyone use it? Is it tested? Can you ship it?", mood: 'thinking' },
    { text: "Four halls, four masters, one exam. And something big keeps stomping around in the basement... let's not think about that yet.", mood: 'worried' },
  ],
  levels: [typedCharter, shapeshifterMould, wardensRegister, muteMenu, provingGrounds, shipwrightsExam, regressionGolem],
};
