import React from 'react';
import ReactDOMClient from 'react-dom/client';
import ReactDOM from 'react-dom';
import JSXRuntime from 'react/jsx-runtime';
import { compileSource, createLoopGuard } from './compile.js';
import { createFakeTimers, createRealTimers, waitForRealTimers } from './timers.js';
import { createTestContext } from './testkit.js';

const { createRoot } = ReactDOMClient;
const { act } = React;

/**
 * Builds the pretend "fetch" a quest can hand to the player. Routes are
 * `{ '/api/monsters': data | (url, options) => data | { status, body } }`.
 */
export function createFakeFetch(routes = {}, timers, delay = 500) {
  const calls = [];
  const fetchImpl = (url, options = {}) =>
    new Promise((resolve, reject) => {
      calls.push({ url: String(url), options });
      const signal = options && options.signal;
      const abortError = () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        return err;
      };
      if (signal && signal.aborted) {
        reject(abortError());
        return;
      }
      let timerId;
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener(
          'abort',
          () => {
            timers.clearTimeout(timerId);
            reject(abortError());
          },
          { once: true },
        );
      }
      timerId = timers.setTimeout(() => {
        const path = String(url).split('?')[0];
        const route = routes[path];
        let status = 200;
        let body;
        if (route === undefined) {
          status = 404;
          body = { error: `No such route: ${path}` };
        } else if (typeof route === 'function') {
          try {
            const result = route(String(url), options);
            if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
              status = result.status;
              body = result.body;
            } else {
              body = result;
            }
          } catch (err) {
            status = 500;
            body = { error: err.message };
          }
        } else {
          body = route;
        }
        const text = JSON.stringify(body);
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(JSON.parse(text)),
          text: () => Promise.resolve(text),
        });
      }, delay);
    });
  fetchImpl.calls = calls;
  return fetchImpl;
}

/**
 * Creates everything the player's module sees: fake timers, fake fetch,
 * a console that mirrors into the in-game console, virtual modules.
 */
export function createSandbox({ level = {}, mode = 'preview', onLog } = {}) {
  const timers = mode === 'test' ? createFakeTimers() : createRealTimers();
  const logs = [];
  const log = (kind, args) => {
    const entry = { kind, args, time: Date.now() };
    logs.push(entry);
    if (logs.length > 200) logs.shift();
    onLog?.(entry);
  };
  const sandboxConsole = {
    log: (...a) => log('log', a),
    info: (...a) => log('info', a),
    warn: (...a) => log('warn', a),
    error: (...a) => log('error', a),
    debug: (...a) => log('log', a),
    table: (...a) => log('log', a),
    dir: (...a) => log('log', a),
    trace: (...a) => log('log', a),
    group: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {},
    time: (label = 'default') => {
      timeLabels.set(String(label), timers.now());
    },
    timeLog: (label = 'default', ...rest) => {
      const start = timeLabels.get(String(label));
      if (start === undefined) log('warn', [`Timer '${label}' does not exist`]);
      else log('log', [`${label}: ${timers.now() - start}ms`, ...rest]);
    },
    timeEnd: (label = 'default') => {
      const start = timeLabels.get(String(label));
      if (start === undefined) log('warn', [`Timer '${label}' does not exist`]);
      else log('log', [`${label}: ${timers.now() - start}ms`]);
      timeLabels.delete(String(label));
    },
    count: (label = 'default') => {
      const n = (counts.get(String(label)) || 0) + 1;
      counts.set(String(label), n);
      log('log', [`${label}: ${n}`]);
    },
    countReset: (label = 'default') => {
      counts.delete(String(label));
    },
    assert: (cond, ...a) => {
      if (!cond) log('error', ['Assertion failed:', ...a]);
    },
  };
  const timeLabels = new Map();
  const counts = new Map();
  const fetchDelay = mode === 'test' ? level.fetchDelay ?? 300 : level.fetchDelay ?? 700;
  const fetch = createFakeFetch(level.routes || {}, timers, fetchDelay);
  const modules = {
    react: React,
    'react-dom': ReactDOM,
    'react-dom/client': ReactDOMClient,
    'react/jsx-runtime': JSXRuntime,
    ...(typeof level.modules === 'function' ? level.modules({ timers, fetch }) : level.modules || {}),
  };
  const DateImpl = mode === 'test' ? createFakeDate(timers) : Date;
  const performanceImpl = mode === 'test' ? { now: () => timers.now() } : globalThis.performance;
  const localStorageImpl = mode === 'test' ? createMemoryStorage() : previewStorage;
  return {
    typescript: Boolean(level.typescript),
    timers,
    fetch,
    console: sandboxConsole,
    logs,
    modules,
    Date: DateImpl,
    performance: performanceImpl,
    localStorage: localStorageImpl,
    loopGuard: createLoopGuard(),
  };
}

/** `Date` whose clock follows the fake timers (tests only). */
function createFakeDate(timers, base = Date.UTC(2026, 0, 1, 9, 0, 0)) {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(base + timers.now());
      else super(...args);
    }
    static now() {
      return base + timers.now();
    }
  }
  return FakeDate;
}

/** A tiny in-memory implementation of the Web Storage API. */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => {
      map.set(String(k), String(v));
    },
    removeItem: (k) => {
      map.delete(String(k));
    },
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

// The live preview shares one storage for the whole session, so data the
// player saves survives re-runs (but never touches the real game save).
const previewStorage = createMemoryStorage();

/**
 * Compile + evaluate the player's source. Returns `{ exports, App, error }`.
 */
export function evaluateSource(source, sandbox) {
  let compiled;
  try {
    compiled = compileSource(source, { typescript: Boolean(sandbox.typescript) });
  } catch (err) {
    return { error: formatSyntaxError(err), exports: null, App: null, compiled: null };
  }
  const exportsObj = {};
  const moduleObj = { exports: exportsObj };
  const require = (name) => {
    if (name in sandbox.modules) return sandbox.modules[name];
    throw new Error(
      `Cannot find module '${name}'. In Reactoria you can import from 'react' and the modules this quest provides.`,
    );
  };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      '__loopGuard',
      'require',
      'exports',
      'module',
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'fetch',
      'Date',
      'performance',
      'localStorage',
      compiled,
    );
    fn(
      sandbox.loopGuard,
      require,
      exportsObj,
      moduleObj,
      sandbox.console,
      sandbox.timers.setTimeout,
      sandbox.timers.setInterval,
      sandbox.timers.clearTimeout,
      sandbox.timers.clearInterval,
      sandbox.fetch,
      sandbox.Date,
      sandbox.performance,
      sandbox.localStorage,
    );
  } catch (err) {
    return { error: formatRuntimeError(err), exports: moduleObj.exports, App: null, compiled };
  }
  const exp = moduleObj.exports || {};
  const App = exp.default || exp.App;
  return { error: null, exports: exp, App: typeof App === 'function' ? App : null, compiled };
}

export function formatSyntaxError(err) {
  const msg = String(err?.message || err);
  const m = msg.match(/\((\d+):(\d+)\)/);
  const line = m ? Number(m[1]) : null;
  return {
    kind: 'syntax',
    message: msg.replace(/\s*\(\d+:\d+\)\s*$/, ''),
    line,
    hint: syntaxHint(msg),
  };
}

function syntaxHint(msg) {
  if (/Unterminated JSX/i.test(msg)) return 'Every JSX tag needs a closing tag (or a self-closing `/>`).';
  if (/Unexpected token/i.test(msg) && /</.test(msg))
    return 'JSX must return exactly one parent element. Wrap siblings in a <div> or a fragment <>...</>.';
  if (/Unexpected token/i.test(msg)) return 'Check for a missing bracket, comma or closing tag near that line.';
  if (/Adjacent JSX/i.test(msg)) return 'Wrap sibling elements in a single parent — a fragment `<>...</>` works great.';
  return null;
}

export function formatRuntimeError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return { kind: 'runtime', message, hint: runtimeHint(message) };
}

function runtimeHint(message) {
  if (/is not defined/.test(message)) {
    const name = message.match(/^(\w+) is not defined/)?.[1];
    if (name && ['useState', 'useEffect', 'useRef', 'useReducer', 'useContext', 'useMemo', 'useCallback', 'useTransition', 'useDeferredValue', 'useId', 'useOptimistic', 'useActionState', 'use', 'memo', 'createContext', 'forwardRef', 'Fragment', 'startTransition', 'Suspense', 'lazy', 'useImperativeHandle', 'useLayoutEffect', 'useSyncExternalStore', 'Component', 'StrictMode'].includes(name))
      return `Did you forget to import it? Add \`import { ${name} } from 'react';\` at the top.`;
    if (name === 'createPortal' || name === 'useFormStatus' || name === 'flushSync')
      return `Did you forget to import it? Add \`import { ${name} } from 'react-dom';\` at the top.`;
    return 'Something is used before it is declared or imported. Check the spelling.';
  }
  if (/Too many re-renders/.test(message))
    return 'You are calling a state setter during render. Call it inside an event handler or effect instead.';
  if (/Rendered more hooks|Rendered fewer hooks|change in the order of Hooks/.test(message))
    return 'Hooks must be called in the same order on every render: never inside conditions, loops or after an early return.';
  if (/Invalid hook call/.test(message))
    return 'Hooks can only be called at the top level of a function component or a custom hook.';
  if (/Objects are not valid as a React child/.test(message))
    return 'You tried to render an object directly. Render its fields instead, e.g. {hero.name}.';
  if (/Cannot read propert/.test(message))
    return 'Something is undefined. Is the data loaded yet? Are the prop names spelled right?';
  if (/is not a function/.test(message)) return 'Check that you are calling the right thing — maybe a prop or a state setter name is off.';
  if (/must return a function|is not a function or its return value is not iterable/.test(message)) return null;
  return null;
}

class SandboxErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.props.onError?.(formatRuntimeError(error));
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

/**
 * Mounts the player's App into a DOM node for the live preview.
 * Returns a handle with `unmount()`.
 */
export function mountPreview({ container, App, resetKey, onError, props = {} }) {
  const root = createRoot(container, {
    onUncaughtError: (error) => onError?.(formatRuntimeError(error)),
  });
  const element = React.createElement(
    SandboxErrorBoundary,
    { resetKey, onError },
    React.createElement(App, props),
  );
  root.render(element);
  return {
    root,
    unmount() {
      // The game itself is a React app: tearing down the preview root
      // synchronously from inside one of its effects would run while React is
      // still committing, so always defer to the next task.
      setTimeout(() => {
        try {
          root.unmount();
        } catch {
          /* ignore */
        }
      }, 0);
    },
  };
}

/**
 * Runs every test of a quest against the source.
 * Resolves with `[{ name, pass, message }]` and the compile/runtime error (if any).
 */
export async function runQuestTests(level, source, { onProgress } = {}) {
  await waitForRealTimers();
  const sandbox = createSandbox({ level, mode: 'test' });
  const evaluated = evaluateSource(source, sandbox);
  const results = [];
  const tests = level.tests || [];

  if (evaluated.error) {
    sandbox.timers.reset();
    return {
      error: evaluated.error,
      results: tests.map((t) => ({ name: t.name, pass: false, message: 'Fix the error above first.' })),
      logs: sandbox.logs,
    };
  }

  const prevActEnv = globalThis.IS_REACT_ACT_ENVIRONMENT;
  const prevTitle = typeof document !== 'undefined' ? document.title : '';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const silence = silenceConsole();
  try {
    for (const test of tests) {
      // Every check gets a fresh copy of the module, so module-level variables
      // and storage never leak from one check into the next.
      const testSandbox = createSandbox({ level, mode: 'test' });
      const testEvaluated = evaluateSource(source, testSandbox);
      const ctx = createTestContext({
        level,
        source,
        sandbox: testSandbox,
        evaluated: testEvaluated,
        act,
        React,
        createRoot,
        warnings: silence.captured,
      });
      let pass = false;
      let message = '';
      try {
        await withTimeout(test.run(ctx), test.timeout || 4000);
        pass = true;
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      } finally {
        // Let anything still in flight (async Actions awaiting a timer, fake
        // fetches) settle before tearing down. React tracks pending async
        // Actions globally, so one left hanging would block every later
        // Action on the page.
        for (let k = 0; k < 20 && testSandbox.timers.pendingTimeouts() > 0; k++) {
          try {
            await ctx.tick(2000);
          } catch {
            /* the check already has its verdict */
          }
        }
        await ctx.cleanup();
        testSandbox.timers.reset();
      }
      results.push({ name: test.name, pass, message });
      onProgress?.(results.slice());
      if (!pass && test.blocking) break;
    }
  } finally {
    sandbox.timers.reset();
    silence.restore();
    globalThis.IS_REACT_ACT_ENVIRONMENT = prevActEnv;
    if (typeof document !== 'undefined') document.title = prevTitle;
  }
  const remaining = tests.slice(results.length).map((t) => ({ name: t.name, pass: false, message: '' }));
  return { error: null, results: results.concat(remaining), logs: sandbox.logs, warnings: silence.captured };
}

function silenceConsole() {
  const original = { error: console.error, warn: console.warn };
  const captured = [];
  console.error = (...args) => captured.push(args.map(String).join(' '));
  console.warn = (...args) => captured.push(args.map(String).join(' '));
  return {
    captured,
    restore() {
      console.error = original.error;
      console.warn = original.warn;
    },
  };
}

function withTimeout(promise, ms) {
  if (!promise || typeof promise.then !== 'function') return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('This check took too long — is something stuck in a loop or waiting forever?')), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}
