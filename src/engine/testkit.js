import { guardNavigation } from './navigationGuard.js';

/**
 * The context object handed to every quest check (`test.run(ctx)`).
 * Interactions are synchronous (React's `act` flushes updates + effects);
 * anything involving time or promises is async (`await ctx.tick(ms)`).
 */
export function createTestContext({ level, source, sandbox, evaluated, act, React, createRoot, warnings = [] }) {
  const { App, exports } = evaluated;
  let container = null;
  let wrapper = null;
  let unguard = null;
  let root = null;
  const blockedNavigations = [];

  // Wraps React's act() so that crashes in the player's component surface as
  // a friendly message instead of a raw stack trace.
  const run = (fn) => {
    try {
      return act(fn);
    } catch (err) {
      throw crash(err);
    }
  };
  const runAsync = async (fn) => {
    try {
      return await act(fn);
    } catch (err) {
      throw crash(err);
    }
  };

  const ensureContainer = () => {
    if (!container) {
      // wrapper > container: the wrapper's listeners run after React's (which
      // live on the container), so un-prevented form submits / link clicks can
      // be kept from navigating the page without hiding them from checks.
      wrapper = document.createElement('div');
      wrapper.setAttribute('data-reactoria-test', '');
      wrapper.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;';
      container = document.createElement('div');
      wrapper.appendChild(container);
      document.body.appendChild(wrapper);
      unguard = guardNavigation(wrapper, { mode: 'sink', onBlocked: (info) => blockedNavigations.push(info) });
      root = createRoot(container);
    }
    return container;
  };

  const resolve = (target) => {
    if (typeof target === 'string') {
      const el = ensureContainer().querySelector(target);
      if (!el) throw new Error(`Could not find an element matching \`${target}\`.`);
      return el;
    }
    if (!target) throw new Error('Expected an element but got nothing.');
    return target;
  };

  const normalize = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

  const ctx = {
    level,
    source,
    exports,
    App,
    React,
    h: React.createElement,
    timers: sandbox.timers,
    fetchCalls: sandbox.fetch.calls,
    logs: sandbox.logs,
    /** console output of the player's code as plain strings */
    logLines: () => sandbox.logs.map((l) => l.args.map(stringify).join(' ')),
    /** React's own warnings (missing keys, etc.) captured during this check */
    warnings,
    storage: sandbox.localStorage,
    /** forms submitted / links followed WITHOUT preventDefault() during this check */
    blockedNavigations,
    act,

    get container() {
      return ensureContainer();
    },

    /** Render `<App {...props} />` (or any element) into the test container. */
    render(elementOrProps, maybeProps) {
      ensureContainer();
      let element;
      if (React.isValidElement(elementOrProps)) element = elementOrProps;
      else {
        if (!App)
          throw new Error(
            'No component was exported. Finish with `export default function App() { ... }` (or export a component named App).',
          );
        element = React.createElement(App, elementOrProps || maybeProps || {});
      }
      run(() => {
        root.render(element);
      });
      return container;
    },

    /**
     * Like render(), but awaits React — use it when the component suspends
     * on first render (use(promise), lazy components).
     */
    async renderAsync(elementOrProps, maybeProps) {
      ensureContainer();
      let element;
      if (React.isValidElement(elementOrProps)) element = elementOrProps;
      else {
        if (!App)
          throw new Error(
            'No component was exported. Finish with `export default function App() { ... }` (or export a component named App).',
          );
        element = React.createElement(App, elementOrProps || maybeProps || {});
      }
      await runAsync(async () => {
        root.render(element);
      });
      return container;
    },

    renderComponent(Component, props = {}) {
      if (typeof Component !== 'function')
        throw new Error('Expected a component function but got ' + typeof Component + '.');
      return ctx.render(React.createElement(Component, props));
    },

    unmount() {
      if (root) {
        run(() => {
          root.unmount();
        });
        root = null;
        unguard?.();
        unguard = null;
        if (wrapper) wrapper.remove();
        wrapper = null;
        container = null;
      }
    },

    $: (sel) => ensureContainer().querySelector(sel),
    $$: (sel) => Array.from(ensureContainer().querySelectorAll(sel)),
    find: (sel) => resolve(sel),
    count: (sel) => ensureContainer().querySelectorAll(sel).length,
    text: () => normalize(ensureContainer().textContent),
    html: () => ensureContainer().innerHTML,
    hasText: (t) => normalize(ensureContainer().textContent).includes(normalize(t)),

    /** Finds the innermost element whose text equals (or contains) `text`. */
    findText(text, { exact = true, within } = {}) {
      const scope = within ? resolve(within) : ensureContainer();
      const wanted = normalize(text);
      const all = Array.from(scope.querySelectorAll('*'));
      const matches = all.filter((el) => {
        const t = normalize(el.textContent);
        return exact ? t === wanted : t.includes(wanted);
      });
      if (!matches.length) return null;
      // innermost = the one with no matching descendants
      return matches.find((el) => !matches.some((other) => other !== el && el.contains(other))) || matches[0];
    },

    /** Finds a <button> by its text (case-insensitive, substring). */
    button(text) {
      const wanted = normalize(text).toLowerCase();
      const buttons = Array.from(ensureContainer().querySelectorAll('button'));
      const found = buttons.find((b) => normalize(b.textContent).toLowerCase().includes(wanted));
      if (!found)
        throw new Error(
          `Could not find a <button> containing "${text}". Buttons found: ${
            buttons.map((b) => `"${normalize(b.textContent)}"`).join(', ') || 'none'
          }.`,
        );
      return found;
    },

    click(target) {
      const el = resolve(target);
      run(() => {
        el.click();
      });
      return el;
    },

    /** Types into an input/textarea the way a user would (React sees onChange). */
    type(target, value) {
      const el = resolve(target);
      const proto =
        el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      run(() => {
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return el;
    },

    /** Changes a <select> (or checkbox/radio) value. */
    change(target, value) {
      const el = resolve(target);
      run(() => {
        if (el instanceof HTMLSelectElement) {
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
          if (setter) setter.call(el, value);
          else el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.type === 'checkbox' || el.type === 'radio') {
          if (Boolean(el.checked) !== Boolean(value)) el.click();
        } else {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, value);
          else el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      return el;
    },

    submit(target) {
      const el = resolve(target);
      const form = el.tagName === 'FORM' ? el : el.closest('form');
      if (!form) throw new Error('Expected a <form> element to submit.');
      run(() => {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      return form;
    },

    keyDown(target, key, extra = {}) {
      const el = resolve(target);
      run(() => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
      });
      return el;
    },

    fire(target, eventName, init = {}) {
      const el = resolve(target);
      run(() => {
        el.dispatchEvent(new Event(eventName, { bubbles: true, cancelable: true, ...init }));
      });
      return el;
    },

    focus(target) {
      const el = resolve(target);
      run(() => {
        el.focus();
        el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });
      return el;
    },

    blur(target) {
      const el = resolve(target);
      run(() => {
        el.blur();
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });
      return el;
    },

    /** Awaited click — use when the click makes something suspend (use(), lazy). */
    async clickAsync(target) {
      const el = resolve(target);
      await runAsync(async () => {
        el.click();
      });
      return el;
    },

    /** Awaited submit — use when submitting makes something suspend. */
    async submitAsync(target) {
      const el = resolve(target);
      const form = el.tagName === 'FORM' ? el : el.closest('form');
      if (!form) throw new Error('Expected a <form> element to submit.');
      await runAsync(async () => {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      return form;
    },

    /** Advance fake time by `ms` and let promises settle. */
    async tick(ms = 0) {
      await runAsync(async () => {
        sandbox.timers.advance(ms);
        await macrotask();
      });
    },

    /** Let pending promises / state updates settle without advancing timers. */
    async flush() {
      await runAsync(async () => {
        await macrotask();
        await macrotask();
      });
    },

    expect(condition, message) {
      if (!condition) throw new Error(message || 'Check failed.');
    },
    fail(message) {
      throw new Error(message);
    },
    expectText(text, message) {
      if (!ctx.hasText(text))
        throw new Error(message || `Expected to see the text "${text}" but it isn't on screen.`);
    },
    expectNoText(text, message) {
      if (ctx.hasText(text)) throw new Error(message || `Did not expect to see the text "${text}" on screen.`);
    },
    expectElement(sel, message) {
      if (!ensureContainer().querySelector(sel))
        throw new Error(message || `Expected an element matching \`${sel}\` on screen.`);
      return ensureContainer().querySelector(sel);
    },
    /** Regex / substring check of the raw source — handy for "uses useState" style checks. */
    sourceIncludes(pattern, message) {
      const ok = pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
      if (!ok) throw new Error(message || `Expected your code to include ${pattern}.`);
    },
    sourceExcludes(pattern, message) {
      const bad = pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern);
      if (bad) throw new Error(message || `Your code should not include ${pattern}.`);
    },

    async cleanup() {
      try {
        ctx.unmount();
      } catch {
        /* ignore */
      }
    },
  };
  return ctx;
}

function stringify(a) {
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function crash(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (/^(Expected|Could not find|Did not expect)/.test(message)) return err;
  const e = new Error(`Your component crashed: ${message}`);
  e.cause = err;
  return e;
}

function macrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
