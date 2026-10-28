import { code, md, q, test } from '../helpers.js';
import { createElement as h, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';

/* -------------------------------------------------------------------------- */
/* Check helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Collapse whitespace so checks don't care about JSX line breaks. */
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Source without comments, so a comment mentioning an API never trips a check. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** Runs `fn` and turns a "Maximum update depth" crash into a getSnapshot hint. */
function renderOrExplain(t, element) {
  try {
    return element === undefined ? t.render() : t.render(element);
  } catch (err) {
    if (/Maximum update depth|185/.test(err.message))
      t.fail(
        'The gearbox spins forever ("Maximum update depth exceeded"). getSnapshot returns a brand-new object on every call, so React thinks the store changed every time it checks. Return numbers (one useSyncExternalStore per value) or a cached object.',
      );
    throw err;
  }
}

/** Is `el` visible, i.e. neither it nor an ancestor has display: none? */
function isShown(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    if (node.style && node.style.display === 'none') return false;
  }
  return true;
}

/**
 * Runs `fn(calls)` while `scrollIntoView` is replaced by a spy that records
 * which element it was called on. (jsdom has no real scrolling.)
 */
async function withScrollSpy(t, fn) {
  const proto = t.container.ownerDocument.defaultView.Element.prototype;
  const own = Object.prototype.hasOwnProperty.call(proto, 'scrollIntoView');
  const original = proto.scrollIntoView;
  const calls = [];
  proto.scrollIntoView = function scrollIntoViewSpy(options) {
    calls.push({ el: this, options });
  };
  try {
    return await fn(calls);
  } finally {
    if (own) proto.scrollIntoView = original;
    else delete proto.scrollIntoView;
  }
}

/* ---- fake layout for the tooltip level ---------------------------------- */

const TIP_HEIGHT = 64;
const rect = (top, height, left = 40, width = 180) => ({
  top,
  height,
  left,
  width,
  bottom: top + height,
  right: left + width,
  x: left,
  y: top,
  toJSON() {
    return this;
  },
});

/** Where each gauge button sits (distance from the top of the window). */
function gaugeTop(button) {
  const label = clean(button.textContent).toLowerCase();
  if (label.includes('valve')) return 12;
  return 420;
}

function fakeLayout(el) {
  if (el.closest && el.closest('.tooltip')) return rect(0, TIP_HEIGHT);
  let button = null;
  if (el.matches && el.matches('button.gauge')) button = el;
  else if (el.querySelectorAll) {
    const inside = el.querySelectorAll('button.gauge');
    if (inside.length === 1) button = inside[0];
  }
  if (button) return rect(gaugeTop(button), 40);
  return rect(0, 0);
}

/**
 * Runs `fn` while getBoundingClientRect (and offsetHeight) report a fake
 * layout: the valve sits 12px from the top of the window, every other gauge
 * 420px down, and a tooltip is 64px tall.
 */
async function withLayout(t, fn) {
  const win = t.container.ownerDocument.defaultView;
  const proto = win.Element.prototype;
  const hproto = win.HTMLElement.prototype;
  const rectDesc = Object.getOwnPropertyDescriptor(proto, 'getBoundingClientRect');
  const offsetDesc = Object.getOwnPropertyDescriptor(hproto, 'offsetHeight');
  Object.defineProperty(proto, 'getBoundingClientRect', {
    configurable: true,
    writable: true,
    value: function getBoundingClientRect() {
      return fakeLayout(this);
    },
  });
  Object.defineProperty(hproto, 'offsetHeight', {
    configurable: true,
    get() {
      return fakeLayout(this).height;
    },
  });
  try {
    return await fn();
  } finally {
    if (rectDesc) Object.defineProperty(proto, 'getBoundingClientRect', rectDesc);
    else delete proto.getBoundingClientRect;
    if (offsetDesc) Object.defineProperty(hproto, 'offsetHeight', offsetDesc);
    else delete hproto.offsetHeight;
  }
}

/**
 * Renders `element` the way a browser shows a page (outside act(), with real
 * scheduling) and records the class of `selector` each time the DOM changes,
 * as seen at the end of each task, i.e. what could reach the screen.
 */
async function framesOf(t, element, selector) {
  const doc = t.container.ownerDocument;
  const prevAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const host = doc.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:800px;';
  doc.body.appendChild(host);
  const frames = [];
  let crashed = null;
  const observer = new doc.defaultView.MutationObserver(() => {
    const el = host.querySelector(selector);
    if (el) frames.push(clean(el.getAttribute('class')));
  });
  observer.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
  const root = createRoot(host, {
    onUncaughtError: (err) => {
      crashed = err;
    },
    onRecoverableError: () => {},
  });
  try {
    root.render(element);
    for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 8));
  } finally {
    observer.disconnect();
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
    host.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = prevAct;
  }
  if (crashed) throw new Error(`Your component crashed: ${crashed.message}`);
  return frames;
}

/* -------------------------------------------------------------------------- */
/* Fake modules                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `porthole`: the Deep's stand-in for `window` + `navigator`.
 * Checks reach the instance their sandbox got through `portholes.get(t.timers)`.
 */
const portholes = new WeakMap();

function createPorthole() {
  const listeners = new Map();
  const devListeners = new Set();
  let added = 0;
  const porthole = {
    innerWidth: 800,
    innerHeight: 600,
    navigator: { onLine: true },
    addEventListener(type, fn) {
      if (typeof fn !== 'function') return;
      const set = listeners.get(type) || new Set();
      if (!set.has(fn)) added++;
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
  };
  const dispatch = (type) => {
    for (const fn of Array.from(listeners.get(type) || [])) fn({ type, target: porthole });
    devListeners.forEach((fn) => fn());
  };
  const control = {
    porthole,
    count: (type) => listeners.get(type)?.size || 0,
    added: () => added,
    setOnline(on) {
      if (porthole.navigator.onLine === on) return;
      porthole.navigator.onLine = on;
      dispatch(on ? 'online' : 'offline');
    },
    resize(width, height) {
      porthole.innerWidth = width;
      porthole.innerHeight = height;
      dispatch('resize');
    },
  };
  // Preview-only test controls. They use a private channel, so they never
  // show up in the listener counts the checks look at.
  const devSubscribe = (fn) => {
    devListeners.add(fn);
    return () => devListeners.delete(fn);
  };
  function CableSwitch() {
    const online = useSyncExternalStore(devSubscribe, () => porthole.navigator.onLine);
    return h(
      'div',
      { className: 'dev-panel' },
      h('span', null, '🧪 Test control: '),
      h(
        'button',
        { type: 'button', className: 'dev-button', onClick: () => control.setOnline(!online) },
        online ? '✂️ Cut the cable' : '🔧 Repair the cable',
      ),
    );
  }
  function ResizeKnob() {
    const width = useSyncExternalStore(devSubscribe, () => porthole.innerWidth);
    return h(
      'div',
      { className: 'dev-panel' },
      h('span', null, '🧪 Test controls: '),
      h('button', { type: 'button', className: 'dev-button', onClick: () => control.resize(Math.max(320, width - 160), porthole.innerHeight) }, '➖ Shrink porthole'),
      ' ',
      h('button', { type: 'button', className: 'dev-button', onClick: () => control.resize(width + 160, porthole.innerHeight) }, '➕ Widen porthole'),
    );
  }
  control.module = { porthole, CableSwitch, ResizeKnob };
  return control;
}

const portholeModules = ({ timers }) => {
  const control = createPorthole();
  portholes.set(timers, control);
  return { porthole: control.module };
};

/** `sonar`: a fake chat-like connection that pings every 2 seconds. */
const sonars = new WeakMap();

function createSonar(timers) {
  const stats = { connects: 0, disconnects: 0, open: new Set(), notifications: [] };
  let toasts = [];
  const toastListeners = new Set();
  function createConnection(channel) {
    let handler = null;
    let intervalId = null;
    let connected = false;
    let count = 0;
    const connection = {
      channel,
      on(event, fn) {
        if (event !== 'ping') throw new Error(`The sonar only sends "ping" events (you listened for "${event}").`);
        handler = fn;
      },
      connect() {
        if (connected) return;
        connected = true;
        stats.connects++;
        stats.open.add(connection);
        intervalId = timers.setInterval(() => {
          count++;
          if (handler) handler(`Ping from ${channel} #${count}`);
        }, 2000);
      },
      disconnect() {
        if (!connected) return;
        connected = false;
        stats.disconnects++;
        stats.open.delete(connection);
        timers.clearInterval(intervalId);
      },
    };
    return connection;
  }
  function showNotification(message, theme = 'light') {
    stats.notifications.push({ message: String(message), theme });
    toasts = [...toasts, { id: stats.notifications.length, message: String(message), theme }].slice(-3);
    toastListeners.forEach((fn) => fn());
  }
  const subscribeToasts = (fn) => {
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  };
  function Toasts() {
    const list = useSyncExternalStore(subscribeToasts, () => toasts);
    return h(
      'ul',
      { className: 'toasts' },
      list.map((toast) => h('li', { key: toast.id, className: `toast ${toast.theme}` }, `🔔 ${toast.message}`)),
    );
  }
  return { stats, module: { createConnection, showNotification, Toasts } };
}

const sonarModules = ({ timers }) => {
  const sonar = createSonar(timers);
  sonars.set(timers, sonar);
  return { sonar: sonar.module };
};

/** `pneumatic`: tube sensors, shaped like IntersectionObserver's observe/unobserve. */
const tubes = new WeakMap();

function createPneumatic() {
  let watched = [];
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());
  const sensors = {
    observe(node) {
      if (!node) return;
      watched = [...watched, node];
      notify();
    },
    unobserve(node) {
      const i = watched.indexOf(node);
      if (i === -1) return;
      watched = watched.filter((_, k) => k !== i);
      notify();
    },
  };
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  function SensorGauge() {
    const count = useSyncExternalStore(subscribe, () => watched.length);
    return h('p', { className: 'sensor-gauge' }, `📡 Sensors attached: ${count}`);
  }
  return { watched: () => watched, module: { sensors, SensorGauge } };
}

const pneumaticModules = ({ timers }) => {
  const tube = createPneumatic();
  tubes.set(timers, tube);
  return { pneumatic: tube.module };
};

/** Describes the sensors vs the capsules on screen, or '' when they match. */
function sensorProblem(t) {
  const watched = tubes.get(t.timers).watched();
  const capsules = t.$$('li.capsule');
  const stale = watched.filter((node) => !capsules.includes(node));
  if (stale.length)
    return `${stale.length} sensor(s) are still attached to capsules that left the tube. Return a cleanup from the ref callback: return () => sensors.unobserve(node);`;
  const doubled = capsules.filter((node) => watched.filter((w) => w === node).length > 1);
  if (doubled.length)
    return `${doubled.length} capsule(s) carry more than one sensor (${watched.length} sensors for ${capsules.length} capsules). A ref callback can run several times for the same node (an inline one on every re-render, and twice on mount under StrictMode): without a cleanup that unobserves, every run attaches another sensor.`;
  const missing = capsules.filter((node) => !watched.includes(node));
  if (missing.length)
    return `${missing.length} of the ${capsules.length} capsules have no sensor. Call sensors.observe(node) in each <li className="capsule">'s ref callback.`;
  return '';
}

/* -------------------------------------------------------------------------- */
/* Chapter                                                                    */
/* -------------------------------------------------------------------------- */

export default {
  id: 'clockwork-deep',
  file: '15-clockwork-deep.js',
  title: 'Clockwork Deep',
  short: 'Escape hatches',
  subtitle: 'Advanced hooks and escape hatches: external stores, effect events, layout effects, flushSync, ref callbacks and Activity.',
  icon: '⚙️',
  colors: ['#04121f', '#0d9488'],
  scenery: ['⚙️', '🐙', '🫧', '🔩', '🐡', '🪸', '🔦', '🧭'],
  intro: [
    {
      text: 'Hold your breath! Far below the Sea of State lies the Clockwork Deep: a city of brass gears, pipes and portholes.',
      mood: 'excited',
    },
    {
      text: "Down here things change all on their own: cables snap, portholes stretch, sonar pings. React can't see any of it unless you wire it up with the right escape hatch.",
      mood: 'thinking',
    },
    {
      text: 'And somewhere in the trench lurks the Kraken of Forgetting. Every room it touches loses its memory. Stay close to me!',
      mood: 'worried',
    },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'deep-signal-buoy',
      type: 'code',
      title: 'The Signal Buoy',
      blurb: 'Subscribe to a value React does not own with useSyncExternalStore.',
      xp: 130,
      story: [
        {
          text: 'Gearfin, the old clockwork angler-fish, runs the signal buoy. Its lamp should glow red when the telegraph cable to the surface is cut... but it shines green no matter what.',
          mood: 'worried',
        },
        {
          text: "The cable's status lives outside React, so React never hears it change. Let's subscribe to it properly!",
          mood: 'excited',
        },
      ],
      lesson: md`
        ## Values React doesn't own

        State from \`useState\` belongs to React: when you call the setter, React knows it must
        re-render. But some values live **outside** React and change all on their own:

        - browser APIs: \`navigator.onLine\`, the window size, \`matchMedia('(prefers-color-scheme: dark)')\`, the URL
        - store libraries: Redux, Zustand, a cache shared with non-React code

        Reading one directly during render works exactly once:

        \`\`\`jsx
        function StatusLamp() {
          const isOnline = navigator.onLine; // read once...
          return <p>{isOnline ? 'Online' : 'Offline'}</p>;
        }
        \`\`\`

        When the network drops, nothing tells React, so the lamp keeps glowing green until
        something else happens to re-render it.

        ## Subscribing with useSyncExternalStore

        \`\`\`jsx
        import { useSyncExternalStore } from 'react';

        function subscribe(callback) {
          window.addEventListener('online', callback);
          window.addEventListener('offline', callback);
          return () => {
            window.removeEventListener('online', callback);
            window.removeEventListener('offline', callback);
          };
        }

        function getSnapshot() {
          return navigator.onLine;
        }

        function useOnlineStatus() {
          return useSyncExternalStore(subscribe, getSnapshot);
        }
        \`\`\`

        The hook takes two functions:

        1. **\`subscribe(callback)\`** starts listening. React hands you a \`callback\`; arrange for it
           to be called whenever the store changes. Return a function that **stops** listening.
        2. **\`getSnapshot()\`** returns the current value. React calls it while rendering and every
           time \`callback\` fires. If the value changed (compared with \`Object.is\`), it re-renders.

        React does the bookkeeping: it subscribes after the component mounts, unsubscribes when it
        unmounts, re-checks the snapshot right after subscribing (in case the value changed in
        between), and makes sure every component in one render sees the **same** snapshot.

        :::tip
        Define \`subscribe\` **outside** the component (or pass a store's own method). Written inline,
        it is a new function on every render, so React unsubscribes and subscribes again every time.
        :::

        ## Why not useState + useEffect?

        You *could* copy the value into state:

        \`\`\`jsx
        const [isOnline, setIsOnline] = useState(navigator.onLine);
        useEffect(() => {
          const update = () => setIsOnline(navigator.onLine);
          window.addEventListener('online', update);
          window.addEventListener('offline', update);
          return () => { /* remove both */ };
        }, []);
        \`\`\`

        It works *most* of the time, but if the value changes after the render and before the effect
        subscribes, the change is lost. And with concurrent rendering (the transitions from the
        Performance Peaks) one render can be split up, so two components could show different
        values from different moments: a "torn" screen. \`useSyncExternalStore\` was built to close
        both gaps, which is why Redux and Zustand use it under the hood.

        ## In the Deep

        There's no real network down here, so the \`porthole\` module stands in for the browser:
        \`porthole.navigator.onLine\`, \`porthole.addEventListener(...)\` and
        \`porthole.removeEventListener(...)\` work exactly like \`navigator.onLine\` and
        \`window.addEventListener\`. Its \`<CableSwitch />\` lets you cut the cable in the preview, like
        the "Offline" switch in your browser's DevTools.

        ### When NOT to use it

        - **Data your component owns:** use \`useState\` or \`useReducer\`. Wrapping your own state in an
          external store is extra machinery for nothing.
        - **Fetching data:** a request isn't a store. Use the effect patterns from the Volcano, \`use()\`
          from the Spire, or a data library.
        - **Values that never change** while the page is open: just read them.

        Reach for it when something **outside React changes on its own**: browser APIs and store libraries.

        :::pro
        For server rendering, pass a third argument, \`getServerSnapshot\`, returning the value to use
        on the server and during hydration (e.g. \`() => true\`: assume online).
        :::
      `,
      task: md`
        ## 🎯 Wire up the signal buoy

        The lamp and the button read \`porthole.navigator.onLine\` once and never notice when the cable
        is cut. (Try **✂️ Cut the cable** in the preview.)

        1. **Outside** any component, write \`subscribe(callback)\`: add \`callback\` as a listener for
           both \`'online'\` and \`'offline'\` on \`porthole\`, and **return** a function that removes both.
        2. Write \`getSnapshot()\` that returns \`porthole.navigator.onLine\`.
        3. Make \`useOnlineStatus()\` return \`useSyncExternalStore(subscribe, getSnapshot)\`.
        4. Keep \`StatusLamp\` and \`SendButton\` using the hook: the \`<p className="lamp">\` shows
           **🟢 Online** or **🔴 Offline**, and the \`<button className="send">\` reads **Send telegram**
           (enabled) or **Reconnecting...** (disabled).

        The checks cut and repair the cable, ring the bell to re-render \`App\`, and remove the buoy to
        make sure every listener goes with it.
      `,
      starter: code`
        import { useState } from 'react';
        import { porthole, CableSwitch } from 'porthole';

        // TODO 1: subscribe(callback) — listen for 'online' and 'offline', return a cleanup
        // TODO 2: getSnapshot() — return porthole.navigator.onLine

        function useOnlineStatus() {
          // TODO 3: use useSyncExternalStore(subscribe, getSnapshot) instead
          return porthole.navigator.onLine; // 🐙 read once, never updated!
        }

        function StatusLamp() {
          const isOnline = useOnlineStatus();
          return <p className="lamp">{isOnline ? '🟢 Online' : '🔴 Offline'}</p>;
        }

        function SendButton() {
          const isOnline = useOnlineStatus();
          return (
            <button className="send" disabled={!isOnline}>
              {isOnline ? 'Send telegram' : 'Reconnecting...'}
            </button>
          );
        }

        export default function App() {
          const [rings, setRings] = useState(0);
          return (
            <div className="buoy">
              <h2>🛟 The Signal Buoy</h2>
              <StatusLamp />
              <SendButton />
              <button className="bell" onClick={() => setRings((r) => r + 1)}>
                🔔 Ring the bell ({rings})
              </button>
              <CableSwitch />
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useSyncExternalStore } from 'react';
        import { porthole, CableSwitch } from 'porthole';

        function subscribe(callback) {
          porthole.addEventListener('online', callback);
          porthole.addEventListener('offline', callback);
          return () => {
            porthole.removeEventListener('online', callback);
            porthole.removeEventListener('offline', callback);
          };
        }

        function getSnapshot() {
          return porthole.navigator.onLine;
        }

        function useOnlineStatus() {
          return useSyncExternalStore(subscribe, getSnapshot);
        }

        function StatusLamp() {
          const isOnline = useOnlineStatus();
          return <p className="lamp">{isOnline ? '🟢 Online' : '🔴 Offline'}</p>;
        }

        function SendButton() {
          const isOnline = useOnlineStatus();
          return (
            <button className="send" disabled={!isOnline}>
              {isOnline ? 'Send telegram' : 'Reconnecting...'}
            </button>
          );
        }

        export default function App() {
          const [rings, setRings] = useState(0);
          return (
            <div className="buoy">
              <h2>🛟 The Signal Buoy</h2>
              <StatusLamp />
              <SendButton />
              <button className="bell" onClick={() => setRings((r) => r + 1)}>
                🔔 Ring the bell ({rings})
              </button>
              <CableSwitch />
            </div>
          );
        }
      `,
      hints: [
        md`Import \`useSyncExternalStore\` from \`'react'\`. It needs two plain functions declared at the top level of the file, next to the imports: one that subscribes and one that reads the value.`,
        md`\`subscribe\` looks like an effect's setup + cleanup: \`porthole.addEventListener('online', callback)\` and the same for \`'offline'\`, then \`return () => { /* removeEventListener both */ };\`.`,
        md`With \`subscribe\` and \`function getSnapshot() { return porthole.navigator.onLine; }\` in place, the hook is one line: \`return useSyncExternalStore(subscribe, getSnapshot);\`.`,
      ],
      tests: [
        test('The buoy reads the cable with useSyncExternalStore', (t) => {
          t.sourceIncludes(
            /useSyncExternalStore\s*\(/,
            'Call useSyncExternalStore(subscribe, getSnapshot) inside useOnlineStatus (and import it from "react").',
          );
          t.render();
          const lamp = clean(t.find('.lamp').textContent);
          t.expect(lamp === '🟢 Online', `With the cable connected the lamp reads "${lamp}" — expected "🟢 Online".`);
          const send = t.find('button.send');
          t.expect(clean(send.textContent) === 'Send telegram' && !send.disabled, 'While online, the button should read "Send telegram" and be enabled.');
          t.unmount();
          portholes.get(t.timers).setOnline(false);
          t.render();
          const lamp2 = clean(t.find('.lamp').textContent);
          t.expect(lamp2 === '🔴 Offline', `When the buoy starts with the cable already cut, the lamp reads "${lamp2}" — expected "🔴 Offline". getSnapshot should return porthole.navigator.onLine.`);
        }),
        test('The lamp and the button follow the cable', (t) => {
          const net = portholes.get(t.timers);
          t.render();
          t.act(() => net.setOnline(false));
          const lamp = clean(t.find('.lamp').textContent);
          t.expect(
            lamp === '🔴 Offline',
            `The cable was cut, but the lamp still reads "${lamp}". subscribe(callback) must add callback as a listener for 'online' AND 'offline' on porthole, so React re-reads the snapshot.`,
          );
          const send = t.find('button.send');
          t.expect(send.disabled && clean(send.textContent) === 'Reconnecting...', 'While offline, the button should read "Reconnecting..." and be disabled.');
          t.act(() => net.setOnline(true));
          const back = clean(t.find('.lamp').textContent);
          t.expect(back === '🟢 Online', `The cable was repaired, but the lamp reads "${back}". Listen for the 'online' event too.`);
        }),
        test('No change slips through before the subscription starts', (t) => {
          const net = portholes.get(t.timers);
          // A sibling cuts the cable after App rendered, before passive effects run.
          function Saboteur() {
            t.React.useLayoutEffect(() => {
              net.setOnline(false);
            }, []);
            return null;
          }
          t.render(t.h(t.React.Fragment, null, t.h(t.App), t.h(Saboteur)));
          const lamp = clean(t.find('.lamp').textContent);
          t.expect(
            lamp === '🔴 Offline',
            `The cable snapped right after the buoy rendered but before it subscribed, and the lamp still reads "${lamp}". useSyncExternalStore re-checks getSnapshot after subscribing; a value copied into useState (or read during render) misses it.`,
          );
        }),
        test('Every listener is removed when the buoy goes away', (t) => {
          const net = portholes.get(t.timers);
          t.render();
          const on = net.count('online');
          const off = net.count('offline');
          t.expect(on >= 1 && off >= 1, `While the buoy is on screen there are ${on} 'online' and ${off} 'offline' listener(s) on porthole — expected at least one of each.`);
          t.expect(on <= 2 && off <= 2, `There are ${on} 'online' and ${off} 'offline' listeners for two components. Something subscribes more than once: return the cleanup from subscribe.`);
          t.unmount();
          const left = net.count('online') + net.count('offline');
          t.expect(
            left === 0,
            `${left} listener(s) were left on porthole after the buoy was removed. subscribe must return a function that calls porthole.removeEventListener for both events.`,
          );
        }),
        test('Ringing the bell does not re-subscribe', (t) => {
          const net = portholes.get(t.timers);
          t.render();
          const before = net.added();
          t.click(t.button('Ring the bell'));
          t.click(t.button('Ring the bell'));
          t.click(t.button('Ring the bell'));
          const extra = net.added() - before;
          t.expect(
            extra === 0,
            `Three re-renders added ${extra} new listener(s). subscribe is a new function on every render, so React unsubscribes and subscribes again each time. Declare subscribe once, outside the components.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'deep-sync-external-store',
          icon: '🔌',
          title: 'useSyncExternalStore',
          summary: 'Subscribe a component to a value that lives outside React.',
          snippet: code`
            function subscribe(callback) {
              window.addEventListener('online', callback);
              window.addEventListener('offline', callback);
              return () => {
                window.removeEventListener('online', callback);
                window.removeEventListener('offline', callback);
              };
            }
            const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine);
          `,
          detail: 'For browser APIs and store libraries. React subscribes, unsubscribes, re-checks after subscribing and keeps every component on the same snapshot.',
        },
      ],
      modules: portholeModules,
      css: `
        .buoy { max-width: 380px; margin: 0 auto; padding: 18px; border-radius: 18px; text-align: center;
          background: radial-gradient(circle at 50% 0%, #0f766e, #04121f); color: #e0f2f1; border: 3px solid #b45309; }
        .buoy h2 { color: #fcd34d; margin-top: 0; }
        .lamp { font-size: 1.6em; font-weight: 800; margin: 10px 0; }
        .send { background: #b45309; color: white; }
        .send:disabled { background: #475569; }
        .bell { margin-left: 8px; }
        .dev-panel { margin-top: 14px; padding: 8px; border: 1px dashed #5eead4; border-radius: 10px; font-size: 0.85em; }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'deep-runaway-gear',
      type: 'bug',
      title: 'The Runaway Gear',
      blurb: 'Bug hunt! A store hook that spins forever, leaks and re-subscribes.',
      xp: 140,
      story: [
        {
          text: 'KRRRRK! The porthole gearbox is spinning so fast the whole preview crashed. Somebody wrote a useWindowSize hook in a hurry.',
          mood: 'worried',
        },
        {
          text: 'useSyncExternalStore has a contract: getSnapshot and subscribe must follow its rules. Break one and the gears grind. Three rules are broken here!',
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## The getSnapshot contract

        React calls \`getSnapshot\` **a lot**: on every render, and again whenever your callback fires
        to ask "did anything change?". It compares the new result with the previous one using
        \`Object.is\`. Different means changed, and changed means re-render.

        \`\`\`js
        // ❌ a brand-new object on every call
        function getSnapshot() {
          return { width: window.innerWidth, height: window.innerHeight };
        }
        \`\`\`

        Two objects are never \`Object.is\`-equal, even with the same contents (remember the
        Immutable Isles). So React sees a "change" every time it looks, re-renders, looks again,
        sees another "change"... In development React warns *"The result of getSnapshot should be
        cached to avoid an infinite loop"*, then gives up with **"Maximum update depth exceeded"**
        (React error #185 in production builds).

        **Fix 1: return primitives.** Numbers and strings compare by value. Use one hook per value:

        \`\`\`js
        const width = useSyncExternalStore(subscribe, () => window.innerWidth);
        const height = useSyncExternalStore(subscribe, () => window.innerHeight);
        \`\`\`

        An inline \`getSnapshot\` is fine: React simply calls the latest one. Only its *result* has
        to stay the same while nothing changed.

        **Fix 2: cache the object** and only build a new one when the values really changed:

        \`\`\`js
        let cached = { width: window.innerWidth, height: window.innerHeight };

        function getSnapshot() {
          if (cached.width !== window.innerWidth || cached.height !== window.innerHeight) {
            cached = { width: window.innerWidth, height: window.innerHeight };
          }
          return cached;
        }
        \`\`\`

        Store libraries get this for free: their state is immutable, so the snapshot is a new
        object *only* after an update. That's exactly what \`getSnapshot\` wants.

        ## The subscribe contract

        1. **Return the unsubscribe function.** React calls it when the component unmounts (and
           before switching to a different \`subscribe\`). Forget it and the listener stays on the
           window forever: a leak that keeps poking components that no longer exist.
        2. **Keep it stable.** Declare it at the top level of the module. An inline arrow is a new
           function on every render, and a new \`subscribe\` means React must unsubscribe and
           subscribe again. Harmless-looking, but it runs on *every* render.

        :::mistake
        Writing the whole store inline:

        \`\`\`js
        useSyncExternalStore(
          (cb) => { window.addEventListener('resize', cb); },      // unstable, no cleanup
          () => ({ width: window.innerWidth }),                     // new object every call
        );
        \`\`\`

        Three broken rules in four lines. You're about to fix exactly this.
        :::

        :::tip
        Whenever \`useSyncExternalStore\` crashes with "Maximum update depth exceeded", look at
        \`getSnapshot\` first. Call it twice in a row in your head: do you get the *same* value?
        :::
      `,
      task: md`
        ## 🐛 Stop the runaway gear

        \`useWindowSize()\` should give \`App\` the porthole's size as \`{ width, height }\`, so that
        the \`<p className="size">\` reads **800 × 600** and the \`<p className="mode">\` reads
        **🖥️ Wide view** (width ≥ 640) or **📱 Narrow view**. It's broken in **three** ways:

        1. **Spinning forever:** \`getSnapshot\` returns a new object on every call, so the preview
           crashes. Return values that stay the same while nothing changed: two
           \`useSyncExternalStore\` calls returning numbers, or a cached object.
        2. **A leaking listener:** \`subscribe\` adds a \`'resize'\` listener but never returns a function
           that removes it.
        3. **Re-subscribing on every render:** \`subscribe\` is written inline, so it's a new function
           each render. Move it to the top level of the file, outside the hook.

        Keep the \`<ResizeKnob />\` and the **Wind the gear** button.
      `,
      starter: code`
        import { useState, useSyncExternalStore } from 'react';
        import { porthole, ResizeKnob } from 'porthole';

        function useWindowSize() {
          return useSyncExternalStore(
            (callback) => {
              porthole.addEventListener('resize', callback);
            },
            () => ({ width: porthole.innerWidth, height: porthole.innerHeight }),
          );
        }

        export default function App() {
          const { width, height } = useWindowSize();
          const [turns, setTurns] = useState(0);
          return (
            <div className="gearbox">
              <h2>⚙️ The Porthole Gearbox</h2>
              <p className="size">{width} × {height}</p>
              <p className="mode">{width >= 640 ? '🖥️ Wide view' : '📱 Narrow view'}</p>
              <button onClick={() => setTurns((n) => n + 1)}>Wind the gear ({turns})</button>
              <ResizeKnob />
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useSyncExternalStore } from 'react';
        import { porthole, ResizeKnob } from 'porthole';

        function subscribe(callback) {
          porthole.addEventListener('resize', callback);
          return () => porthole.removeEventListener('resize', callback);
        }

        function useWindowSize() {
          const width = useSyncExternalStore(subscribe, () => porthole.innerWidth);
          const height = useSyncExternalStore(subscribe, () => porthole.innerHeight);
          return { width, height };
        }

        export default function App() {
          const { width, height } = useWindowSize();
          const [turns, setTurns] = useState(0);
          return (
            <div className="gearbox">
              <h2>⚙️ The Porthole Gearbox</h2>
              <p className="size">{width} × {height}</p>
              <p className="mode">{width >= 640 ? '🖥️ Wide view' : '📱 Narrow view'}</p>
              <button onClick={() => setTurns((n) => n + 1)}>Wind the gear ({turns})</button>
              <ResizeKnob />
            </div>
          );
        }
      `,
      hints: [
        md`Start with the crash. \`() => ({ ... })\` builds a new object every call. Split it: \`const width = useSyncExternalStore(subscribe, () => porthole.innerWidth);\` and the same for \`height\`, then \`return { width, height };\`. (A new object returned from *your hook* is fine; only \`getSnapshot\` must be stable.)`,
        md`Move the subscribe arrow out of the hook into a top-level \`function subscribe(callback) { ... }\` and pass \`subscribe\` to both calls.`,
        md`Inside \`subscribe\`, after adding the listener: \`return () => porthole.removeEventListener('resize', callback);\`.`,
      ],
      tests: [
        test('The gearbox renders without spinning forever', (t) => {
          renderOrExplain(t);
          const size = clean(t.find('.size').textContent);
          t.expect(size === '800 × 600', `The .size paragraph reads "${size}" — expected "800 × 600".`);
          const mode = clean(t.find('.mode').textContent);
          t.expect(mode === '🖥️ Wide view', `The .mode paragraph reads "${mode}" — expected "🖥️ Wide view" for an 800px porthole.`);
        }),
        test('Resizing the porthole updates the size and the view', (t) => {
          const net = portholes.get(t.timers);
          renderOrExplain(t);
          t.act(() => net.resize(500, 700));
          const size = clean(t.find('.size').textContent);
          t.expect(size === '500 × 700', `After resizing to 500 × 700 the .size paragraph reads "${size}". Subscribe to 'resize' and read innerWidth/innerHeight in the snapshot(s).`);
          const mode = clean(t.find('.mode').textContent);
          t.expect(mode === '📱 Narrow view', `A 500px porthole should show "📱 Narrow view", but .mode reads "${mode}".`);
        }),
        test('Removing the gearbox removes its resize listener', (t) => {
          const net = portholes.get(t.timers);
          renderOrExplain(t);
          t.expect(net.count('resize') >= 1, "The gearbox isn't listening for 'resize' at all. subscribe should call porthole.addEventListener('resize', callback).");
          t.unmount();
          const left = net.count('resize');
          t.expect(
            left === 0,
            `${left} 'resize' listener(s) stayed on the porthole after the gearbox was removed. subscribe must return () => porthole.removeEventListener('resize', callback).`,
          );
        }),
        test('Winding the gear does not re-subscribe', (t) => {
          const net = portholes.get(t.timers);
          renderOrExplain(t);
          const before = net.added();
          t.click(t.button('Wind the gear'));
          t.click(t.button('Wind the gear'));
          const extra = net.added() - before;
          t.expect(
            extra === 0,
            `Two re-renders added ${extra} new 'resize' listener(s): subscribe is a new function on every render, so React re-subscribes each time. Declare function subscribe(callback) { ... } at the top level, outside useWindowSize.`,
          );
          t.expect(net.count('resize') <= 2, `There are ${net.count('resize')} 'resize' listeners for one gearbox. Old listeners are never removed: return the cleanup from subscribe.`);
        }),
      ],
      concepts: [
        {
          id: 'deep-snapshot-rules',
          icon: '📸',
          title: 'The snapshot rules',
          summary: 'getSnapshot must return the same value while nothing changed; subscribe must be stable and return an unsubscribe.',
          snippet: code`
            // ✅ primitives compare by value
            const width = useSyncExternalStore(subscribe, () => window.innerWidth);
            // ❌ () => ({ width: window.innerWidth }) → infinite loop
          `,
          detail: 'A new object from getSnapshot looks like a change on every check. Cache it, or return primitives.',
        },
      ],
      modules: portholeModules,
      css: `
        .gearbox { max-width: 380px; margin: 0 auto; padding: 18px; border-radius: 50% 50% 18px 18px / 30% 30% 18px 18px;
          text-align: center; background: linear-gradient(#0e7490, #04121f); color: #ecfeff; border: 4px solid #b45309; }
        .gearbox h2 { color: #fcd34d; margin-top: 0; }
        .size { font-family: ui-monospace, monospace; font-size: 2em; font-weight: 900; margin: 6px 0; }
        .mode { font-size: 1.2em; }
        .dev-panel { margin-top: 14px; padding: 8px; border: 1px dashed #5eead4; border-radius: 10px; font-size: 0.85em; }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'deep-sonar-room',
      type: 'code',
      title: 'The Sonar Room',
      blurb: 'Read the latest props inside an effect without re-running it: useEffectEvent. Plus a live <title>.',
      xp: 150,
      story: [
        {
          text: "Echo the dolphin runs the sonar room. Every time she switches the lights between day and night theme, the sonar hangs up and dials the channel again. Pings get lost!",
          mood: 'worried',
        },
        {
          text: 'The theme should only change how pings LOOK, not restart the connection. React has a hook for exactly that split. Oh, and Echo wants the unread count in the browser tab!',
          mood: 'excited',
        },
      ],
      lesson: md`
        ## Reactive and non-reactive logic

        Inside an effect, some values should **restart** it and some should only be **read**:

        \`\`\`jsx
        useEffect(() => {
          const connection = createConnection(roomId);
          connection.on('message', (msg) => {
            showNotification(msg, theme);
          });
          connection.connect();
          return () => connection.disconnect();
        }, [roomId, theme]);
        \`\`\`

        Changing \`roomId\` must reconnect: that's what this effect synchronises. Changing \`theme\`
        shouldn't, but because the effect reads it, it's a dependency, so flipping the theme drops
        the connection and dials again.

        Deleting \`theme\` from the array is worse: the message handler keeps the \`theme\` from the
        render the effect last ran in, a **stale closure**, and the linter rightly complains.

        ## useEffectEvent

        Move the non-reactive part into an **Effect Event**:

        \`\`\`jsx
        import { useEffect, useEffectEvent } from 'react';

        function ChatRoom({ roomId, theme }) {
          const onMessage = useEffectEvent((msg) => {
            showNotification(msg, theme); // always the LATEST theme
          });

          useEffect(() => {
            const connection = createConnection(roomId);
            connection.on('message', (msg) => onMessage(msg));
            connection.connect();
            return () => connection.disconnect();
          }, [roomId]); // ✅ onMessage is not a dependency
          // ...
        }
        \`\`\`

        An Effect Event is like an event handler that your *effect* fires: whenever it's called,
        it sees the latest props and state, but it isn't reactive, so it never goes in a
        dependency array (the official \`eslint-plugin-react-hooks\` knows this). It's stable since
        React 19.2, and it replaces the "latest callback in a ref" trick from the Hook Workshop.

        The rules:

        - **Only call it from inside effects** (or other Effect Events). Never during render, and
          not from \`onClick\`: ordinary event handlers already see the latest values.
        - **Don't pass it** to other components or hooks. Declare it right next to the effect that uses it.

        ### When NOT to use it

        Don't use it to hide a value that *should* restart the effect. If the effect uses \`roomId\`
        to decide **what** to connect to, \`roomId\` stays a dependency. Ask: *"When this value changes,
        should the effect re-synchronise?"* Yes → dependency. No, I only need its latest value → Effect Event.

        ## Document metadata: \`<title>\` and \`<meta>\`

        Since React 19 you can render \`<title>\`, \`<meta>\` and \`<link>\` from **any** component. React
        hoists them into the document's \`<head>\` and updates or removes them as your component
        updates or unmounts:

        \`\`\`jsx
        function Inbox({ unread }) {
          return (
            <section>
              <title>{unread > 0 ? \`(\${unread}) Inbox\` : 'Inbox'}</title>
              <meta name="description" content="Messages from the Deep" />
              ...
            </section>
          );
        }
        \`\`\`

        - \`<title>\` needs **one string** child. \`<title>({unread}) Inbox</title>\` has *three* children
          (text, number, text): React warns and the title doesn't come out right. Build the text with
          a template literal.
        - Render only **one** \`<title>\` at a time. With several, they all land in the head and browsers
          pick unpredictably.
        - Before React 19, people set \`document.title\` in an effect or used a library such as
          react-helmet. Frameworks like Next.js also have their own metadata APIs.

        :::tip
        Effect Events don't make effects run less on their own: they let you *remove* a value
        from the dependency array **honestly**, because the code that reads it no longer belongs
        to the effect's synchronisation.
        :::
      `,
      task: md`
        ## 🎯 Tune the sonar room

        Toggling the theme reconnects the sonar, because the effect lists \`theme\` as a dependency.

        1. In \`SonarRoom\`, create \`const onPing = useEffectEvent((message) => { ... })\`. It adds one
           unread ping (\`setUnread((n) => n + 1)\`) and calls \`showNotification(message, theme)\`.
        2. In the effect, call \`onPing(message)\` for every \`'ping'\` and change the dependency array to
           \`[channel]\` only. Keep the connect/disconnect cleanup.
        3. Inside \`SonarRoom\`, render a \`<title>\`: **Sonar Room** when there are no unread pings, and
           **(2) Sonar Room** (with the real count) when there are. Give it a single string.

        The checks toggle the theme (no reconnect allowed!), wait for pings (one every 2 seconds),
        check that the next ping uses the new theme, switch channels, and read the page title.
      `,
      starter: code`
        import { useState, useEffect } from 'react';
        import { createConnection, showNotification, Toasts } from 'sonar';

        function SonarRoom({ channel, theme }) {
          const [unread, setUnread] = useState(0);

          useEffect(() => {
            const connection = createConnection(channel);
            connection.on('ping', (message) => {
              setUnread((n) => n + 1);
              showNotification(message, theme);
            });
            connection.connect();
            return () => connection.disconnect();
          }, [channel, theme]); // 🐙 every theme flip hangs up and redials!

          // TODO: a <title> showing the unread count
          return (
            <section className={\`sonar \${theme}\`}>
              <h2>📡 Listening on {channel}</h2>
              <p className="unread">Unread pings: {unread}</p>
              <button onClick={() => setUnread(0)}>Mark all read</button>
            </section>
          );
        }

        export default function App() {
          const [channel, setChannel] = useState('kelp');
          const [theme, setTheme] = useState('light');
          return (
            <div className="sonar-room">
              <label>
                Channel{' '}
                <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="kelp">kelp</option>
                  <option value="coral">coral</option>
                  <option value="trench">trench</option>
                </select>
              </label>
              <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
                Toggle theme ({theme})
              </button>
              <SonarRoom channel={channel} theme={theme} />
              <Toasts />
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect, useEffectEvent } from 'react';
        import { createConnection, showNotification, Toasts } from 'sonar';

        function SonarRoom({ channel, theme }) {
          const [unread, setUnread] = useState(0);

          const onPing = useEffectEvent((message) => {
            setUnread((n) => n + 1);
            showNotification(message, theme);
          });

          useEffect(() => {
            const connection = createConnection(channel);
            connection.on('ping', (message) => onPing(message));
            connection.connect();
            return () => connection.disconnect();
          }, [channel]);

          return (
            <section className={\`sonar \${theme}\`}>
              <title>{unread > 0 ? \`(\${unread}) Sonar Room\` : 'Sonar Room'}</title>
              <h2>📡 Listening on {channel}</h2>
              <p className="unread">Unread pings: {unread}</p>
              <button onClick={() => setUnread(0)}>Mark all read</button>
            </section>
          );
        }

        export default function App() {
          const [channel, setChannel] = useState('kelp');
          const [theme, setTheme] = useState('light');
          return (
            <div className="sonar-room">
              <label>
                Channel{' '}
                <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="kelp">kelp</option>
                  <option value="coral">coral</option>
                  <option value="trench">trench</option>
                </select>
              </label>
              <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>
                Toggle theme ({theme})
              </button>
              <SonarRoom channel={channel} theme={theme} />
              <Toasts />
            </div>
          );
        }
      `,
      hints: [
        md`Import \`useEffectEvent\` from \`'react'\` and move the body of the ping handler into it: \`const onPing = useEffectEvent((message) => { setUnread((n) => n + 1); showNotification(message, theme); });\``,
        md`Inside the effect: \`connection.on('ping', (message) => onPing(message));\`. The effect no longer reads \`theme\`, so the array becomes \`[channel]\`. Don't add \`onPing\` to it.`,
        md`
          For the title, build **one** string and put it anywhere inside the \`<section>\`:

          \`\`\`jsx
          <title>{unread > 0 ? \`(\${unread}) Sonar Room\` : 'Sonar Room'}</title>
          \`\`\`
        `,
      ],
      tests: [
        test('Connects to the chosen channel and counts pings', async (t) => {
          const { stats } = sonars.get(t.timers);
          t.render();
          const open = Array.from(stats.open).map((c) => c.channel);
          t.expect(open.length === 1 && open[0] === 'kelp', `Expected one open connection to "kelp", found: ${open.join(', ') || 'none'}. Create the connection in the effect and call connection.connect().`);
          await t.tick(2000);
          const unread = clean(t.find('.unread').textContent);
          t.expect(unread === 'Unread pings: 1', `After one ping the .unread paragraph reads "${unread}" — expected "Unread pings: 1".`);
          t.expect(stats.notifications.length === 1, `Each ping should call showNotification once (it was called ${stats.notifications.length} time(s)).`);
        }),
        test('Toggling the theme does not reconnect the sonar', (t) => {
          const { stats } = sonars.get(t.timers);
          t.render();
          t.click(t.button('Toggle theme'));
          t.click(t.button('Toggle theme'));
          t.expect(
            stats.connects === 1 && stats.disconnects === 0,
            `Two theme flips caused ${stats.disconnects} hang-up(s) and ${stats.connects - 1} redial(s). The effect must only depend on [channel]: move the code that reads theme into an Effect Event (and don't list the Effect Event as a dependency either).`,
          );
        }),
        test('Pings are announced in the current theme', async (t) => {
          const { stats } = sonars.get(t.timers);
          t.render();
          t.click(t.button('Toggle theme'));
          await t.tick(2000);
          const last = stats.notifications[stats.notifications.length - 1];
          t.expect(last, 'No notification arrived after 2 seconds. Call showNotification(message, theme) from onPing.');
          t.expect(
            last.theme === 'dark',
            `The theme is "dark" now, but the ping was announced with "${last.theme}". The handler is reading a stale theme: call showNotification from an Effect Event, which always sees the latest props.`,
          );
          t.expect(stats.connects === 1, 'The theme flip reconnected the sonar. The effect should depend on [channel] only: not on theme, and not on the Effect Event itself.');
          t.sourceIncludes(/useEffectEvent\s*\(/, 'It works, but this quest is about Effect Events: create the ping handler with useEffectEvent((message) => { ... }) (imported from "react").');
        }),
        test('Switching channel reconnects, leaving disconnects (even in StrictMode)', async (t) => {
          const { stats } = sonars.get(t.timers);
          t.render(t.h(t.React.StrictMode, null, t.h(t.App)));
          t.expect(stats.open.size === 1, `Under StrictMode (connect → disconnect → connect) ${stats.open.size} connections are open — expected 1. Return () => connection.disconnect() from the effect.`);
          t.change('select', 'coral');
          const open = Array.from(stats.open).map((c) => c.channel);
          t.expect(open.length === 1 && open[0] === 'coral', `After switching to "coral" the open connections are: ${open.join(', ') || 'none'}. Keep channel in the dependency array so the effect reconnects.`);
          t.unmount();
          t.expect(stats.open.size === 0 && t.timers.pendingIntervals() === 0, 'The sonar kept listening after the room was removed. Disconnect in the cleanup.');
        }),
        test('The page title shows the unread count', async (t) => {
          const doc = t.container.ownerDocument;
          t.render();
          let title = doc.title;
          t.expect(
            title === 'Sonar Room',
            `With no unread pings the page title is "${title}" — expected "Sonar Room". ` +
              (title === '' ? 'Your <title> has several children (text and {numbers}); give it ONE string, e.g. a template literal.' : 'Render a <title> inside SonarRoom.'),
          );
          await t.tick(4000);
          title = doc.title;
          t.expect(
            title === '(2) Sonar Room',
            `After two pings the page title is "${title}" — expected "(2) Sonar Room".` +
              (title === '' || title === 'Sonar Room' ? ' Give <title> a single string, e.g. a template literal: {`(${unread}) Sonar Room`}.' : ''),
          );
          t.click(t.button('Mark all read'));
          title = doc.title;
          t.expect(title === 'Sonar Room', `After "Mark all read" the title is "${title}" — expected "Sonar Room" again.`);
        }),
      ],
      concepts: [
        {
          id: 'deep-effect-event',
          icon: '🎐',
          title: 'useEffectEvent',
          summary: 'Logic fired by an effect that reads the latest props/state without being a dependency.',
          snippet: code`
            const onPing = useEffectEvent((msg) => notify(msg, theme));
            useEffect(() => {
              const c = createConnection(channel);
              c.on('ping', (msg) => onPing(msg));
              c.connect();
              return () => c.disconnect();
            }, [channel]);
          `,
          detail: 'Only call it from effects. Values that should re-synchronise the effect stay dependencies.',
        },
        {
          id: 'deep-metadata',
          icon: '🏷️',
          title: 'Document metadata',
          summary: '<title>, <meta> and <link> rendered anywhere are hoisted into <head> (React 19).',
          snippet: code`
            <title>{\`(\${unread}) Inbox\`}</title>
            <meta name="description" content="..." />
          `,
          detail: 'Give <title> a single string child, and render only one title at a time.',
        },
      ],
      modules: sonarModules,
      css: `
        .sonar-room { max-width: 420px; margin: 0 auto; padding: 16px; border-radius: 16px; background: #04121f; color: #ccfbf1; }
        .sonar-room label { margin-right: 8px; }
        .sonar-room select { color: #134e4a; background: #f0fdfa; }
        .sonar { margin-top: 12px; padding: 14px; border-radius: 14px; border: 2px solid #14b8a6; transition: background 0.3s; }
        .sonar.light { background: #ccfbf1; color: #134e4a; }
        .sonar.dark { background: #0f172a; color: #5eead4; }
        .sonar h2 { margin-top: 0; }
        .unread { font-weight: 800; }
        .toasts { list-style: none; padding: 0; margin: 12px 0 0; }
        .toast { padding: 6px 10px; border-radius: 10px; margin-top: 6px; font-size: 0.9em; }
        .toast.light { background: #f0fdfa; color: #134e4a; }
        .toast.dark { background: #1e293b; color: #5eead4; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'deep-lantern-fish',
      type: 'code',
      title: 'The Lantern Fish',
      blurb: 'Measure the DOM and fix the layout before the browser paints: useLayoutEffect.',
      xp: 150,
      story: [
        {
          text: "Lumen the lantern fish lights up little hint bubbles above each gauge. But the pressure valve sits right at the top of the window, so its bubble pokes out of the screen!",
          mood: 'worried',
        },
        {
          text: "We'll measure the bubble and flip it below when there's no room. The trick is doing it BEFORE anyone sees it in the wrong place.",
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## When does an effect run?

        After React renders, things happen in this order:

        1. React **commits**: it updates the DOM to match your JSX.
        2. **\`useLayoutEffect\`** callbacks run. The DOM is up to date, but the browser hasn't painted it yet.
        3. The browser **paints**: the user sees the new screen.
        4. **\`useEffect\`** callbacks run, usually after the paint.

        Most effects (fetching, subscriptions, timers, logging) belong in \`useEffect\`: they don't
        need to block the screen. But sometimes you must **measure** what was rendered and adjust it
        before the user sees it. That's \`useLayoutEffect\`.

        ## Measure, then fix before paint

        \`element.getBoundingClientRect()\` returns an element's position and size relative to the
        window: \`top\`, \`bottom\`, \`left\`, \`right\`, \`width\`, \`height\`. Here a speech bubble that
        would stick out past the right edge of the window is nudged left:

        \`\`\`jsx
        import { useLayoutEffect, useRef, useState } from 'react';

        function SpeechBubble({ children }) {
          const bubbleRef = useRef(null);
          const [shift, setShift] = useState(0);

          useLayoutEffect(() => {
            const { right } = bubbleRef.current.getBoundingClientRect();
            const overflow = right - window.innerWidth;
            setShift(overflow > 0 ? -overflow : 0);
          }, []);

          return (
            <div ref={bubbleRef} className="bubble" style={{ transform: \`translateX(\${shift}px)\` }}>
              {children}
            </div>
          );
        }
        \`\`\`

        1. The first render uses a **guess** (\`shift = 0\`).
        2. The layout effect measures the real DOM and calls \`setShift\`.
        3. A state update inside \`useLayoutEffect\` is processed **synchronously**: React re-renders
           and updates the DOM again *before* the browser paints.

        The user only ever sees the final position. With \`useEffect\` the browser would usually paint
        the guess first, then jump: a visible **flicker**.

        ## The cost

        \`useLayoutEffect\` **blocks painting** until it (and the re-render it triggers) is done. Slow
        work there makes the whole app feel stuck. So:

        - Default to \`useEffect\`. Switch only when you see a flicker caused by measuring.
        - Keep layout effects tiny: measure, set state, done.
        - It doesn't run during server rendering, so server HTML always shows your first guess.
        - Can CSS do it? Flexbox, \`position: sticky\` and CSS anchor positioning need no JavaScript at all.

        :::mistake
        Measuring during render. On the first render \`ref.current\` is still \`null\` (the element
        doesn't exist yet), and even later the layout you'd read is the *previous* one. Measure in
        a layout effect, after the commit.
        :::

        :::tip
        The DOM element must exist before you measure it, so the measuring component should
        render the element **unconditionally** with a placeholder value, then correct it.
        :::
      `,
      task: md`
        ## 🎯 Keep the bubbles on screen

        Each \`Gauge\` opens a \`Tooltip\` when you click its button. \`Tooltip\` always says \`above\`.

        1. In \`Tooltip\`, add a \`useLayoutEffect\` that measures:
           - the anchor button: \`anchorRef.current.getBoundingClientRect()\`
           - the bubble's height: \`tipRef.current.getBoundingClientRect().height\`
        2. If \`anchor.top < height\` there's no room above: \`setPlacement('below')\`. Otherwise \`setPlacement('above')\`.
        3. Keep \`export function Tooltip({ anchorRef, children })\` and its \`<div className="tooltip above">\`
           / \`<div className="tooltip below">\`.
        4. The placement must be fixed **before the browser paints**: no frame with the bubble in the wrong place.

        The checks fake the layout: the **Pressure valve** button sits 12px from the top of the
        window, the **Ballast pump** 420px down, and a bubble is 64px tall. They also watch every
        frame of a freshly mounted \`Tooltip\`.
      `,
      starter: code`
        import { useRef, useState } from 'react';

        export function Tooltip({ anchorRef, children }) {
          const tipRef = useRef(null);
          const [placement, setPlacement] = useState('above');

          // TODO: measure before paint, then flip below if there's no room above

          return (
            <div ref={tipRef} className={\`tooltip \${placement}\`} role="tooltip">
              {children}
            </div>
          );
        }

        function Gauge({ label, hint }) {
          const buttonRef = useRef(null);
          const [open, setOpen] = useState(false);
          return (
            <div className="gauge-wrap">
              <button ref={buttonRef} className="gauge" onClick={() => setOpen(!open)}>
                {label}
              </button>
              {open && <Tooltip anchorRef={buttonRef}>{hint}</Tooltip>}
            </div>
          );
        }

        export default function App() {
          return (
            <div className="control-panel">
              <Gauge label="🔴 Pressure valve" hint="Never above 9 atmospheres!" />
              <p className="pipes">〰️〰️ brass pipes 〰️〰️</p>
              <Gauge label="🟢 Ballast pump" hint="Pump slowly to rise." />
            </div>
          );
        }
      `,
      solution: code`
        import { useLayoutEffect, useRef, useState } from 'react';

        export function Tooltip({ anchorRef, children }) {
          const tipRef = useRef(null);
          const [placement, setPlacement] = useState('above');

          useLayoutEffect(() => {
            const anchor = anchorRef.current.getBoundingClientRect();
            const { height } = tipRef.current.getBoundingClientRect();
            setPlacement(anchor.top < height ? 'below' : 'above');
          }, [anchorRef]);

          return (
            <div ref={tipRef} className={\`tooltip \${placement}\`} role="tooltip">
              {children}
            </div>
          );
        }

        function Gauge({ label, hint }) {
          const buttonRef = useRef(null);
          const [open, setOpen] = useState(false);
          return (
            <div className="gauge-wrap">
              <button ref={buttonRef} className="gauge" onClick={() => setOpen(!open)}>
                {label}
              </button>
              {open && <Tooltip anchorRef={buttonRef}>{hint}</Tooltip>}
            </div>
          );
        }

        export default function App() {
          return (
            <div className="control-panel">
              <Gauge label="🔴 Pressure valve" hint="Never above 9 atmospheres!" />
              <p className="pipes">〰️〰️ brass pipes 〰️〰️</p>
              <Gauge label="🟢 Ballast pump" hint="Pump slowly to rise." />
            </div>
          );
        }
      `,
      hints: [
        md`Import \`useLayoutEffect\` from \`'react'\`. It has the same shape as \`useEffect\`: \`useLayoutEffect(() => { ... }, [anchorRef]);\`.`,
        md`Inside it: \`const anchor = anchorRef.current.getBoundingClientRect();\` and \`const { height } = tipRef.current.getBoundingClientRect();\`. Both elements exist by now: the layout effect runs after the DOM update.`,
        md`Then one line decides: \`setPlacement(anchor.top < height ? 'below' : 'above');\`. Using \`useEffect\` here would pass the first checks but fail the paint check: the user would see one frame of the bubble above.`,
      ],
      tests: [
        test('Clicking a gauge opens and closes its bubble', async (t) => {
          await withLayout(t, () => {
            t.render();
            t.expect(t.count('.tooltip') === 0, 'No bubble should be open before any gauge is clicked.');
            t.click(t.button('Ballast pump'));
            const tip = t.find('.tooltip');
            t.expect(clean(tip.textContent) === 'Pump slowly to rise.', `The bubble reads "${clean(tip.textContent)}" — expected the pump's hint "Pump slowly to rise.".`);
            t.click(t.button('Ballast pump'));
            t.expect(t.count('.tooltip') === 0, 'Clicking the gauge again should close its bubble.');
          });
        }),
        test('Near the top of the window, the bubble flips below', async (t) => {
          await withLayout(t, () => {
            t.render();
            t.click(t.button('Pressure valve'));
            const cls = clean(t.find('.tooltip').getAttribute('class'));
            t.expect(
              cls === 'tooltip below',
              `The valve is 12px from the top and the bubble is 64px tall, so it can't fit above. Its class is "${cls}" — expected "tooltip below". Measure anchorRef.current and tipRef.current with getBoundingClientRect() and compare anchor.top with the height.`,
            );
          });
        }),
        test('With room to spare, the bubble stays above', async (t) => {
          await withLayout(t, () => {
            t.render();
            t.click(t.button('Ballast pump'));
            const cls = clean(t.find('.tooltip').getAttribute('class'));
            t.expect(cls === 'tooltip above', `The pump is 420px down: plenty of room for a 64px bubble. Its class is "${cls}" — expected "tooltip above".`);
          });
        }),
        test('The bubble is placed before the browser paints', async (t) => {
          t.expect(typeof t.exports.Tooltip === 'function', 'Keep `export function Tooltip({ anchorRef, children })` so the checks can mount it on its own.');
          const Tooltip = t.exports.Tooltip;
          function Harness() {
            const ref = t.React.useRef(null);
            return t.h('div', null, t.h('button', { ref, className: 'gauge' }, '🔴 Pressure valve'), t.h(Tooltip, { anchorRef: ref }, 'Mind the pressure'));
          }
          const frames = await withLayout(t, () => framesOf(t, t.h(Harness), '.tooltip'));
          t.expect(frames.length > 0, 'The Tooltip never appeared when mounted. Make sure it renders <div className="tooltip ...">.');
          const last = frames[frames.length - 1];
          t.expect(last === 'tooltip below', `When mounted under the valve the bubble ends up as "${last}" — expected "tooltip below".`);
          t.expect(
            frames[0] === 'tooltip below',
            `The browser got to paint "${frames[0]}" before the bubble moved to "${last}": a flicker. useEffect runs after paint; measure in useLayoutEffect so the fix lands before the first paint.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'deep-layout-effect',
          icon: '📐',
          title: 'useLayoutEffect',
          summary: 'Runs after the DOM update but before paint: measure, set state, no flicker.',
          snippet: code`
            useLayoutEffect(() => {
              const { height } = tipRef.current.getBoundingClientRect();
              setPlacement(anchorTop < height ? 'below' : 'above');
            }, [anchorTop]);
          `,
          detail: 'It blocks painting, so keep it tiny and use it only for layout measurements. Everything else goes in useEffect.',
        },
      ],
      css: `
        .control-panel { max-width: 380px; margin: 0 auto; padding: 18px; border-radius: 16px;
          background: repeating-linear-gradient(45deg, #1c1917, #1c1917 10px, #292524 10px, #292524 20px); color: #fde68a; }
        .gauge-wrap { position: relative; display: flex; justify-content: center; margin: 70px 0; }
        .gauge { background: #b45309; color: white; border: 3px solid #fcd34d; border-radius: 999px; }
        .pipes { text-align: center; opacity: 0.6; }
        .tooltip { position: absolute; left: 50%; transform: translateX(-50%); width: 200px; padding: 8px 10px;
          border-radius: 12px; background: #fef9c3; color: #422006; text-align: center; font-size: 0.9em;
          box-shadow: 0 0 18px #fde047; z-index: 1; }
        .tooltip.above { bottom: calc(100% + 8px); }
        .tooltip.below { top: calc(100% + 8px); }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'deep-pneumatic-post',
      type: 'code',
      title: 'The Pneumatic Post',
      blurb: 'Update the DOM right now with flushSync, and give every list item its own ref callback with cleanup.',
      xp: 160,
      story: [
        {
          text: 'Whoosh! Capsules shoot through the pneumatic tubes. Each one carries a little sensor, and the Postmaster wants the tube to scroll to every new capsule.',
          mood: 'excited',
        },
        {
          text: "But the scroll lands on the wrong capsule, and sensors pile up on capsules that left long ago. Time for two sharp escape hatches!",
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## The DOM updates later

        A state setter doesn't change the screen immediately. React **batches** updates and
        re-renders after your event handler finishes. So right after \`setX(...)\`, the DOM still
        shows the old state:

        \`\`\`jsx
        function handleAdd() {
          setTodos([...todos, newTodo]);
          listRef.current.lastElementChild.scrollIntoView(); // ❌ still the OLD last item
        }
        \`\`\`

        ## flushSync: "update the DOM now"

        \`flushSync\` from \`react-dom\` runs the update inside it **synchronously**: when it returns,
        React has re-rendered and the DOM is up to date.

        \`\`\`jsx
        import { flushSync } from 'react-dom';

        function handleAdd() {
          flushSync(() => {
            setTodos([...todos, newTodo]);
          });
          listRef.current.lastElementChild.scrollIntoView(); // ✅ the new item exists
        }
        \`\`\`

        Use it rarely. It skips batching and can hurt performance. Good reasons: scroll to or focus
        an element you just added, or hand a third-party library the up-to-date DOM. Never call it
        during render or inside an effect (React warns and can't flush there).

        ## Ref callbacks

        Instead of a ref object you can pass a **function** as \`ref\`. React calls it with the DOM
        node when the element is attached. Since React 19 it may **return a cleanup**, which React
        calls when the element is removed:

        \`\`\`jsx
        <li
          ref={(node) => {
            observer.observe(node);                  // attached
            return () => observer.unobserve(node);   // removed
          }}
        >
        \`\`\`

        That's perfect for **lists**: you can't call \`useRef\` in a loop, but each item can have its
        own callback. The classic pattern keeps nodes in a \`Map\`:

        \`\`\`jsx
        const nodesRef = useRef(new Map());
        // ...
        {items.map((item) => (
          <li
            key={item.id}
            ref={(node) => {
              nodesRef.current.set(item.id, node);
              return () => nodesRef.current.delete(item.id);
            }}
          >
            {item.name}
          </li>
        ))}
        // later, in a handler: nodesRef.current.get(id).scrollIntoView();
        \`\`\`

        Two things to know:

        - An inline ref callback is a **new function on every render**, so React runs the old
          cleanup and the new setup each time. With a correct cleanup that's harmless. If setup
          is expensive, wrap the callback in \`useCallback\`.
        - Without a cleanup, React calls your function with \`null\` on removal (the pre-19 style).
          Forget to handle that and you keep references to dead nodes.

        ## StrictMode, in depth

        In development, \`<StrictMode>\` deliberately does extra work to flush out impure code:

        - It **renders every component twice** and calls state initialisers, updater functions
          (\`setX((x) => ...)\`) and reducers twice. Pure code can't tell the difference; code that
          mutates or pushes into shared data shows double results.
        - It runs every **effect** setup → cleanup → setup on mount (you met this in the Volcano).
        - Since React 19, it also runs every **ref callback** setup → cleanup → setup on mount.

        None of this happens in production. If StrictMode "breaks" something, a cleanup or a pure
        function is missing. Fix that; don't remove StrictMode.

        :::tip
        Only need one node? A plain \`useRef\` is simpler. Reach for ref callbacks when you need
        per-item setup and cleanup, or a node for each item of a list.
        :::
      `,
      task: md`
        ## 🎯 Fix the pneumatic post

        1. **Sensors:** each \`<li className="capsule">\`'s ref callback calls \`sensors.observe(node)\`. Make it
           **return a cleanup** that calls \`sensors.unobserve(node)\`, so every capsule on screen has
           exactly **one** sensor, delivered capsules lose theirs, and it all survives StrictMode.
        2. **Scrolling:** in \`handleSend\`, wrap the \`setCapsules(...)\` call in \`flushSync\` (import it
           from \`'react-dom'\`), so \`scrollIntoView\` targets the **new** capsule.

        Keep the **Send capsule** and **Deliver** buttons, and the capsule texts. The new capsule's
        text is **Capsule #4: New orders** (then #5, ...).
      `,
      starter: code`
        import { useRef, useState } from 'react';
        import { sensors, SensorGauge } from 'pneumatic';

        let nextId = 4;

        export default function App() {
          const [capsules, setCapsules] = useState([
            { id: 1, text: 'Capsule #1: Oil the gears' },
            { id: 2, text: 'Capsule #2: Check the boiler' },
            { id: 3, text: 'Capsule #3: Feed the angler-fish' },
          ]);
          const tubeRef = useRef(null);

          function handleSend() {
            const id = nextId++;
            setCapsules([...capsules, { id, text: \`Capsule #\${id}: New orders\` }]);
            // 🐙 The new capsule isn't in the DOM yet: this scrolls to the OLD last one!
            tubeRef.current.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          function handleDeliver(id) {
            setCapsules(capsules.filter((c) => c.id !== id));
          }

          return (
            <div className="post">
              <h2>📮 The Pneumatic Post</h2>
              <SensorGauge />
              <ul ref={tubeRef} className="tube">
                {capsules.map((c) => (
                  <li
                    key={c.id}
                    className="capsule"
                    ref={(node) => {
                      // 🐙 attached on every render, never removed
                      if (node) sensors.observe(node);
                    }}
                  >
                    {c.text} <button onClick={() => handleDeliver(c.id)}>Deliver</button>
                  </li>
                ))}
              </ul>
              <button className="send" onClick={handleSend}>Send capsule</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useRef, useState } from 'react';
        import { flushSync } from 'react-dom';
        import { sensors, SensorGauge } from 'pneumatic';

        let nextId = 4;

        export default function App() {
          const [capsules, setCapsules] = useState([
            { id: 1, text: 'Capsule #1: Oil the gears' },
            { id: 2, text: 'Capsule #2: Check the boiler' },
            { id: 3, text: 'Capsule #3: Feed the angler-fish' },
          ]);
          const tubeRef = useRef(null);

          function handleSend() {
            const id = nextId++;
            flushSync(() => {
              setCapsules([...capsules, { id, text: \`Capsule #\${id}: New orders\` }]);
            });
            tubeRef.current.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          function handleDeliver(id) {
            setCapsules(capsules.filter((c) => c.id !== id));
          }

          return (
            <div className="post">
              <h2>📮 The Pneumatic Post</h2>
              <SensorGauge />
              <ul ref={tubeRef} className="tube">
                {capsules.map((c) => (
                  <li
                    key={c.id}
                    className="capsule"
                    ref={(node) => {
                      sensors.observe(node);
                      return () => sensors.unobserve(node);
                    }}
                  >
                    {c.text} <button onClick={() => handleDeliver(c.id)}>Deliver</button>
                  </li>
                ))}
              </ul>
              <button className="send" onClick={handleSend}>Send capsule</button>
            </div>
          );
        }
      `,
      hints: [
        md`Watch the **📡 Sensors attached** counter in the preview while you click around: with three capsules it should always say 3.`,
        md`A React 19 ref callback can return a cleanup, just like an effect: \`ref={(node) => { sensors.observe(node); return () => sensors.unobserve(node); }}\`. With a cleanup, React never calls it with \`null\`, so the \`if (node)\` check can go.`,
        md`\`import { flushSync } from 'react-dom';\` then \`flushSync(() => { setCapsules([...capsules, { id, text: ... }]); });\`. The scroll line after it stays the same, but now the new \`<li>\` already exists.`,
      ],
      tests: [
        test('Every capsule on screen has exactly one sensor', async (t) => {
          await withScrollSpy(t, () => {
            t.render();
            let problem = sensorProblem(t);
            t.expect(!problem, `On first render: ${problem}`);
            t.click(t.button('Send capsule'));
            t.expect(t.count('li.capsule') === 4, `After sending, there should be 4 capsules (found ${t.count('li.capsule')}).`);
            problem = sensorProblem(t);
            t.expect(!problem, `After sending a capsule (a re-render): ${problem}`);
          });
        }),
        test('Delivered capsules lose their sensor', (t) => {
          t.render();
          const second = t.$$('li.capsule')[1];
          const del = second && Array.from(second.querySelectorAll('button')).find((b) => /deliver/i.test(b.textContent));
          t.expect(del, 'Each capsule needs its own "Deliver" button.');
          t.click(del);
          t.expect(t.count('li.capsule') === 2, `After delivering one capsule there should be 2 left (found ${t.count('li.capsule')}).`);
          t.expectNoText('Capsule #2', 'Delivering capsule #2 should remove it from the tube.');
          const problem = sensorProblem(t);
          t.expect(!problem, problem);
        }),
        test('Sending scrolls the NEW capsule into view', async (t) => {
          await withScrollSpy(t, (calls) => {
            t.render();
            t.click(t.button('Send capsule'));
            t.expect(calls.length > 0, 'Sending a capsule should call scrollIntoView() on it.');
            const target = calls[calls.length - 1].el;
            const text = clean(target.textContent);
            t.expect(
              text.includes('Capsule #4'),
              `scrollIntoView() was called on "${text.slice(0, 40)}", not on the new "Capsule #4: New orders". The new <li> isn't in the DOM yet when you scroll: wrap setCapsules in flushSync(() => { ... }).`,
            );
          });
          t.sourceIncludes(/flushSync\s*\(/, 'Use flushSync (from "react-dom") to apply the update before scrolling.');
        }),
        test('StrictMode-proof, and removing the post removes every sensor', (t) => {
          const tube = tubes.get(t.timers);
          t.render(t.h(t.React.StrictMode, null, t.h(t.App)));
          const problem = sensorProblem(t);
          t.expect(
            !problem,
            `Under StrictMode React 19 runs each ref callback setup → cleanup → setup on mount: ${problem}`,
          );
          t.unmount();
          const left = tube.watched().length;
          t.expect(left === 0, `${left} sensor(s) stayed attached after the post was removed. The ref callback's cleanup must call sensors.unobserve(node).`);
        }),
      ],
      concepts: [
        {
          id: 'deep-flush-sync',
          icon: '🚿',
          title: 'flushSync',
          summary: 'Apply a state update and update the DOM synchronously, before the next line runs.',
          snippet: code`
            flushSync(() => setItems([...items, item]));
            listRef.current.lastElementChild.scrollIntoView();
          `,
          detail: 'Rare and costly: use it to scroll to or focus something you just added, or to sync with non-React code.',
        },
        {
          id: 'deep-ref-callback',
          icon: '🪝',
          title: 'Ref callbacks with cleanup',
          summary: 'ref={(node) => { setup(node); return () => cleanup(node); }}, one per list item (React 19).',
          snippet: code`
            <li ref={(node) => {
              map.set(item.id, node);
              return () => map.delete(item.id);
            }} />
          `,
          detail: 'Inline callbacks re-run on every render (cleanup, then setup), so keep them balanced.',
        },
        {
          id: 'deep-strict-mode',
          icon: '🔬',
          title: 'StrictMode in depth',
          summary: 'Development-only double renders, double effects and (React 19) double ref callbacks.',
          detail: 'Components, initialisers, updaters and reducers run twice; effects and ref callbacks run setup → cleanup → setup on mount. Never in production.',
        },
      ],
      modules: pneumaticModules,
      css: `
        .post { max-width: 400px; margin: 0 auto; padding: 16px; border-radius: 16px; background: #1c1917; color: #fde68a; }
        .post h2 { margin-top: 0; color: #fbbf24; }
        .sensor-gauge { font-family: ui-monospace, monospace; color: #5eead4; }
        .tube { list-style: none; padding: 8px; margin: 10px 0; max-height: 170px; overflow-y: auto;
          border: 4px solid #b45309; border-radius: 40px; background: linear-gradient(90deg, #0f172a, #134e4a, #0f172a); }
        .capsule { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 6px 0;
          padding: 8px 12px; border-radius: 999px; background: #e7e5e4; color: #292524; font-size: 0.9em; }
        .capsule button { padding: 2px 10px; font-size: 0.85em; }
        .send { background: #b45309; color: white; }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'deep-trial',
      type: 'quiz',
      title: 'Trial of the Trench',
      blurb: 'The Deep Mechanics test your escape-hatch instincts. Eight questions.',
      xp: 100,
      story: [
        {
          text: "The Guild of Deep Mechanics guards the way to the trench. Their questions are tricky, but every answer explains itself. Escape hatches are only useful if you know when to use them!",
          mood: 'happy',
        },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What happens when the network drops?\n\n```jsx\nfunction Lamp() {\n  const online = navigator.onLine;\n  return <p>{online ? "Online" : "Offline"}</p>;\n}\n```',
          [
            'React notices the change and re-renders `Lamp`',
            'It throws an error: you can\'t read browser APIs during render',
            'Nothing: React was never told, so the lamp keeps showing the old value until something else re-renders it',
            'The lamp shows "Offline" only in StrictMode',
          ],
          2,
          'React only re-renders when it is told something changed. `navigator.onLine` lives outside React, so you must subscribe: `useSyncExternalStore(subscribe, () => navigator.onLine)` with a `subscribe` that listens to the `online` and `offline` events.',
        ),
        q(
          'Why does this crash with "Maximum update depth exceeded"?\n\n```js\nuseSyncExternalStore(subscribe, () => ({\n  x: mouse.x,\n  y: mouse.y,\n}));\n```',
          [
            'getSnapshot returns a new object on every call, so React sees a "change" every time it checks',
            '`subscribe` must be written inline',
            'useSyncExternalStore can only store numbers',
            'Objects are not allowed in JSX',
          ],
          0,
          'React compares snapshots with `Object.is`, and two fresh objects are never equal. Return primitives (one hook per value) or a cached object that only changes when `x` or `y` really change.',
        ),
        q(
          'A chat effect connects to `roomId` and shows each message with the current `theme`. Changing the theme should NOT reconnect. What is the idiomatic fix?',
          [
            'Remove `theme` from the dependency array and silence the linter',
            'Make `roomId` an Effect Event too',
            'Store `theme` in a module-level variable',
            'Read `theme` inside `useEffectEvent((msg) => showNotification(msg, theme))` and call it from the effect, which depends only on `[roomId]`',
          ],
          3,
          'An Effect Event always sees the latest props but isn\'t reactive, so it doesn\'t belong in the dependencies. `roomId` decides *what* to connect to, so it must stay a dependency. Simply deleting `theme` from the array leaves a stale closure.',
        ),
        q(
          'Which is a good reason to choose `useLayoutEffect` over `useEffect`?',
          [
            'Fetching data as early as possible',
            'Measuring a tooltip\'s size and repositioning it before the user sees it in the wrong place',
            'Starting an interval',
            'It is faster, so it should be the default',
          ],
          1,
          '`useLayoutEffect` runs after the DOM update but before the browser paints, and state updates inside it are processed before paint, so measure-then-adjust never flickers. It blocks painting, so everything else (data, timers, subscriptions) belongs in `useEffect`.',
        ),
        q(
          'What does this scroll to?\n\n```jsx\nfunction handleAdd() {\n  setItems([...items, newItem]);\n  listRef.current.lastElementChild.scrollIntoView();\n}\n```',
          [
            'The new item',
            'Nothing: refs are null inside event handlers',
            'The item that was last BEFORE the new one: the DOM hasn\'t been updated yet',
            'It scrolls twice',
          ],
          2,
          'State updates are batched and applied after the handler finishes. Wrap the update in `flushSync(() => setItems(...))` from `react-dom` so the DOM is updated before the next line runs.',
        ),
        q(
          'In development, `<StrictMode>` does all of these extra things EXCEPT one. Which one does it NOT do?',
          [
            'Call your component functions twice',
            'Run each effect setup → cleanup → setup when a component mounts',
            'Run each ref callback setup → cleanup → setup when it is attached (React 19)',
            'Run your `onClick` handlers twice',
          ],
          3,
          'StrictMode double-invokes code that must be pure or symmetrical: rendering (plus initialisers, updaters and reducers), effects and ref callbacks. Event handlers are allowed to have side effects, so they run once. None of the double-running happens in production.',
        ),
        q(
          'Under `<StrictMode>` in development (React 19), what does this log when the `<li>` first mounts?\n\n```jsx\n<li ref={(node) => {\n  console.log("attach");\n  return () => console.log("detach");\n}} />\n```',
          ['attach', 'attach, detach, attach', 'attach, attach', 'detach, attach'],
          1,
          'React 19\'s StrictMode runs ref callbacks setup → cleanup → setup on mount, the same stress test effects get. If your cleanup really undoes the setup, the result is identical to a single attach.',
        ),
        q(
          'You want the browser tab to read "(3) Inbox". Which line is right in React 19?',
          [
            'Render `<title>{label}</title>` inside any component, where `label` is a template literal building "(3) Inbox"',
            '`<title>({count}) Inbox</title>`, it must be in `index.html`',
            '`document.title = ...` directly in the component body',
            '`<head><title>...</title></head>` inside `App`',
          ],
          0,
          'React 19 hoists `<title>` (and `<meta>`, `<link>`) from anywhere into `<head>`. `<title>` needs a single string child, so build it with a template literal: `({count}) Inbox` would be three children. Setting `document.title` during render is a side effect in render.',
        ),
      ],
      concepts: [
        {
          id: 'deep-escape-hatches',
          icon: '🧰',
          title: 'Escape hatches',
          summary: 'Tools for stepping outside the React model: use them rarely, and only for what they were built for.',
          detail: 'External store → useSyncExternalStore. Latest value in an effect → useEffectEvent. Measure before paint → useLayoutEffect. DOM now → flushSync. Per-node setup → ref callbacks.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'deep-boss',
      type: 'build',
      boss: true,
      bossName: 'The Kraken of Forgetting',
      bossIcon: '🐙',
      title: 'Boss: The Kraken of Forgetting',
      blurb: 'Every room the Kraken touches forgets everything. Keep hidden rooms alive with <Activity>.',
      xp: 300,
      badge: {
        id: 'badge-deep',
        name: 'Deep Mechanic',
        icon: '⚙️',
        description: 'Outwitted the Kraken of Forgetting in the Clockwork Deep.',
      },
      story: [
        {
          text: "The engine rooms! And there it is, the Kraken of Forgetting, tentacles wrapped around every door. Whenever you leave a room, it wipes the room's memory clean.",
          mood: 'worried',
        },
        {
          text: "Switch from the Logbook to the Boiler and back: the half-written entry is gone, and the boiler's heat drops to zero. Hide the rooms instead of destroying them!",
          mood: 'thinking',
        },
        {
          text: "Hidden rooms must sleep, though: no furnace burning in the dark. And the status lamp and the tab title need your other Deep tricks. Let's sink this squid!",
          mood: 'excited',
        },
      ],
      lesson: md`
        ## Hiding vs removing

        You know two ways to show one tab at a time, and both have a catch:

        \`\`\`jsx
        {tab === 'logbook' && <Logbook />}   // removed: its state is destroyed
        \`\`\`

        Unmounting a component throws away its state. Come back and the draft is gone.

        \`\`\`jsx
        <div style={{ display: tab === 'logbook' ? 'block' : 'none' }}>
          <Logbook />
        </div>
        \`\`\`

        Hiding with CSS keeps the state, but the hidden component is still fully alive: its
        intervals keep ticking, subscriptions keep firing, and it re-renders like everything else.

        ## \`<Activity>\`

        React 19.2 added a built-in for exactly this:

        \`\`\`jsx
        import { Activity } from 'react';

        <Activity mode={tab === 'logbook' ? 'visible' : 'hidden'}>
          <Logbook />
        </Activity>
        \`\`\`

        When \`mode\` is \`'hidden'\`, React:

        - **hides** the children with \`display: none\` (the DOM stays in place),
        - **keeps their state**: React state, and DOM state such as an uncontrolled input's text or scroll position,
        - **cleans up their effects** (\`useEffect\` *and* \`useLayoutEffect\` cleanups run), as if
          they had unmounted, so intervals stop and subscriptions end,
        - still re-renders them when their props change, but at a **low priority**, after the visible UI.

        When \`mode\` goes back to \`'visible'\`, the effects set up again, and everything appears exactly as
        the user left it. If your effects clean up properly (and StrictMode has been checking that
        all along!), Activity just works.

        ## Pre-rendering

        Because hidden content still renders at low priority, you can put something the user is
        *likely* to open next inside a hidden Activity: it's ready before they click.

        ### When NOT to use it

        - **Huge or rarely revisited screens:** hidden trees still use memory. Unmount what you won't need again.
        - **Work that must keep running while hidden** (a music player, an upload): effects stop
          when hidden, so put that logic somewhere that stays visible, like a parent.
        - **DOM side effects:** a hidden \`<video>\` keeps playing, because the element isn't destroyed.
          Pause it in an effect cleanup.

        ## The rest of your toolkit

        | Need | Tool |
        |---|---|
        | A value outside React | \`useSyncExternalStore(subscribe, getSnapshot)\` |
        | Hide, keep state, stop effects | \`<Activity mode="hidden">\` |
        | A tab title | \`<title>{text}</title>\` anywhere, with one string child |
        | StrictMode-proof effects | setup ↔ cleanup pairs |

        :::tip
        Build it in steps and check often: the lamp first, then the title, then the Activities.
        The objectives list shows which parts already work.
        :::
      `,
      task: md`
        ## 👑 Outwit the Kraken

        The engine rooms have three tabs: **Boiler**, **Logbook** and **Periscope**.

        1. **Status lamp:** write a \`useOnlineStatus()\` hook with \`useSyncExternalStore\`, subscribing to
           \`porthole\`'s \`'online'\` and \`'offline'\` events (with cleanup) and reading
           \`porthole.navigator.onLine\`. The \`<p className="lamp">\` shows **🟢 Online** or **🔴 Offline**.
        2. **Tab title:** render a \`<title>\` reading **Boiler · Engine Rooms** (with the current room's name).
        3. **Keep every room alive:** render all three rooms, each in its own \`<Activity>\`, with
           \`mode="visible"\` for the current room and \`mode="hidden"\` for the others. Then:
           - the Logbook's draft survives a trip to another room,
           - the Boiler keeps its heat while hidden, its furnace (the interval) **stops** while
             hidden, and starts again when you come back.
        4. Keep the room classNames (\`room boiler\`, \`room logbook\`, \`room periscope\`), the tab buttons and
           the Boiler's \`<p className="heat">\` (**Heat: 3°**).

        Everything must also work under \`<StrictMode>\`.
      `,
      starter: code`
        import { useState, useEffect } from 'react';
        import { porthole, CableSwitch } from 'porthole';

        // TODO: subscribe + useOnlineStatus() with useSyncExternalStore

        function Boiler() {
          const [heat, setHeat] = useState(0);
          useEffect(() => {
            const id = setInterval(() => setHeat((h) => h + 1), 1000);
            return () => clearInterval(id);
          }, []);
          return (
            <section className="room boiler">
              <h3>🔥 Boiler</h3>
              <p className="heat">Heat: {heat}°</p>
            </section>
          );
        }

        function Logbook() {
          const [draft, setDraft] = useState('');
          return (
            <section className="room logbook">
              <h3>📓 Logbook</h3>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Today the Kraken..." />
            </section>
          );
        }

        function Periscope() {
          return (
            <section className="room periscope">
              <h3>🔭 Periscope</h3>
              <p>All clear on the surface.</p>
            </section>
          );
        }

        const ROOMS = ['Boiler', 'Logbook', 'Periscope'];

        export default function App() {
          const [room, setRoom] = useState('Boiler');
          const isOnline = porthole.navigator.onLine; // 🐙 never updates

          // TODO: a <title>, and one <Activity> per room instead of && (the Kraken wipes unmounted rooms!)
          return (
            <div className="engine-rooms">
              <header>
                <p className="lamp">{isOnline ? '🟢 Online' : '🔴 Offline'}</p>
                <nav>
                  {ROOMS.map((name) => (
                    <button key={name} className={name === room ? 'tab active' : 'tab'} onClick={() => setRoom(name)}>
                      {name}
                    </button>
                  ))}
                </nav>
              </header>
              {room === 'Boiler' && <Boiler />}
              {room === 'Logbook' && <Logbook />}
              {room === 'Periscope' && <Periscope />}
              <CableSwitch />
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect, useSyncExternalStore, Activity } from 'react';
        import { porthole, CableSwitch } from 'porthole';

        function subscribe(callback) {
          porthole.addEventListener('online', callback);
          porthole.addEventListener('offline', callback);
          return () => {
            porthole.removeEventListener('online', callback);
            porthole.removeEventListener('offline', callback);
          };
        }

        function useOnlineStatus() {
          return useSyncExternalStore(subscribe, () => porthole.navigator.onLine);
        }

        function Boiler() {
          const [heat, setHeat] = useState(0);
          useEffect(() => {
            const id = setInterval(() => setHeat((h) => h + 1), 1000);
            return () => clearInterval(id);
          }, []);
          return (
            <section className="room boiler">
              <h3>🔥 Boiler</h3>
              <p className="heat">Heat: {heat}°</p>
            </section>
          );
        }

        function Logbook() {
          const [draft, setDraft] = useState('');
          return (
            <section className="room logbook">
              <h3>📓 Logbook</h3>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Today the Kraken..." />
            </section>
          );
        }

        function Periscope() {
          return (
            <section className="room periscope">
              <h3>🔭 Periscope</h3>
              <p>All clear on the surface.</p>
            </section>
          );
        }

        const ROOMS = ['Boiler', 'Logbook', 'Periscope'];

        export default function App() {
          const [room, setRoom] = useState('Boiler');
          const isOnline = useOnlineStatus();
          const mode = (name) => (name === room ? 'visible' : 'hidden');

          return (
            <div className="engine-rooms">
              <title>{\`\${room} · Engine Rooms\`}</title>
              <header>
                <p className="lamp">{isOnline ? '🟢 Online' : '🔴 Offline'}</p>
                <nav>
                  {ROOMS.map((name) => (
                    <button key={name} className={name === room ? 'tab active' : 'tab'} onClick={() => setRoom(name)}>
                      {name}
                    </button>
                  ))}
                </nav>
              </header>
              <Activity mode={mode('Boiler')}>
                <Boiler />
              </Activity>
              <Activity mode={mode('Logbook')}>
                <Logbook />
              </Activity>
              <Activity mode={mode('Periscope')}>
                <Periscope />
              </Activity>
              <CableSwitch />
            </div>
          );
        }
      `,
      hints: [
        md`The lamp is the Signal Buoy again: a top-level \`subscribe(callback)\` that adds and removes \`'online'\`/\`'offline'\` listeners on \`porthole\`, and \`useSyncExternalStore(subscribe, () => porthole.navigator.onLine)\`.`,
        md`
          The title is one string, anywhere inside \`App\`'s JSX:

          \`\`\`jsx
          <title>{\`\${room} · Engine Rooms\`}</title>
          \`\`\`
        `,
        md`Import \`Activity\` from \`'react'\` and replace each \`{room === 'Boiler' && <Boiler />}\` with \`<Activity mode={room === 'Boiler' ? 'visible' : 'hidden'}><Boiler /></Activity>\` (same for the other two). The Boiler's existing cleanup is what lets Activity stop its furnace.`,
      ],
      tests: [
        test('The tabs switch rooms and the title follows', (t) => {
          const doc = t.container.ownerDocument;
          t.render();
          t.expect(t.$('.room.boiler') && isShown(t.$('.room.boiler')), 'The Boiler room should be visible at the start.');
          t.expect(doc.title === 'Boiler · Engine Rooms', `The page title is "${doc.title}" — expected "Boiler · Engine Rooms". Render <title>{\`\${room} · Engine Rooms\`}</title>.`);
          t.click(t.button('Logbook'));
          const logbook = t.$('.room.logbook');
          t.expect(logbook && isShown(logbook), 'After clicking "Logbook" the Logbook room should be visible.');
          const boiler = t.$('.room.boiler');
          t.expect(!boiler || !isShown(boiler), 'Only the current room should be visible: the Boiler should be hidden while you are in the Logbook.');
          t.expect(doc.title === 'Logbook · Engine Rooms', `In the Logbook the page title is "${doc.title}" — expected "Logbook · Engine Rooms".`);
        }),
        test('The Logbook keeps its draft while you look away', (t) => {
          t.render();
          t.click(t.button('Logbook'));
          t.type('.room.logbook textarea', 'The Kraken has eight arms');
          t.click(t.button('Periscope'));
          t.click(t.button('Logbook'));
          const area = t.$('.room.logbook textarea');
          const value = area ? area.value : '(no textarea)';
          t.expect(
            value === 'The Kraken has eight arms',
            `Back in the Logbook, the draft reads "${value}". The Kraken wiped it: {room === 'Logbook' && <Logbook />} unmounts the room. Wrap each room in <Activity mode={...}> instead.`,
          );
        }),
        test('The Boiler keeps its heat, but its furnace sleeps while hidden', async (t) => {
          t.render();
          await t.tick(3000);
          const heat = () => clean(t.find('.room.boiler .heat').textContent);
          t.expect(heat() === 'Heat: 3°', `After 3 seconds the Boiler reads "${heat()}" — expected "Heat: 3°".`);
          t.click(t.button('Periscope'));
          const running = t.timers.pendingIntervals();
          t.expect(
            running === 0,
            `${running} interval(s) keep burning while the Boiler is hidden. Hiding with CSS keeps effects alive; <Activity mode="hidden"> runs their cleanups.`,
          );
          await t.tick(3000);
          t.click(t.button('Boiler'));
          t.expect(heat() === 'Heat: 3°', `Back in the Boiler the heat reads "${heat()}" — expected "Heat: 3°": kept while hidden, not reset and not increased.`);
          await t.tick(2000);
          t.expect(heat() === 'Heat: 5°', `Two seconds after coming back the Boiler reads "${heat()}" — expected "Heat: 5°". The furnace should start again when the room is visible.`);
        }),
        test('The status lamp follows the cable and lets go on unmount', (t) => {
          const net = portholes.get(t.timers);
          t.render();
          t.act(() => net.setOnline(false));
          const lamp = clean(t.find('.lamp').textContent);
          t.expect(lamp === '🔴 Offline', `The cable was cut but the lamp reads "${lamp}". Read the status with useSyncExternalStore and subscribe to 'online' and 'offline'.`);
          const before = net.added();
          t.click(t.button('Logbook'));
          t.click(t.button('Boiler'));
          t.expect(net.added() === before, 'Switching rooms re-subscribed the lamp. Declare subscribe at the top level, outside the components.');
          t.unmount();
          const left = net.count('online') + net.count('offline');
          t.expect(left === 0, `${left} porthole listener(s) were left behind after unmounting. Return the cleanup from subscribe.`);
        }),
        test('Survives StrictMode: one furnace, one lamp subscription', async (t) => {
          const net = portholes.get(t.timers);
          t.render(t.h(t.React.StrictMode, null, t.h(t.App)));
          await t.tick(2000);
          const heat = clean(t.find('.room.boiler .heat').textContent);
          t.expect(heat === 'Heat: 2°', `Under StrictMode the Boiler reads "${heat}" after 2 seconds — expected "Heat: 2°". Keep the interval's cleanup.`);
          t.expect(net.count('online') === 1 && net.count('offline') === 1, `Under StrictMode the lamp holds ${net.count('online')} 'online' / ${net.count('offline')} 'offline' listener(s) — expected exactly one of each.`);
          t.click(t.button('Logbook'));
          t.expect(t.timers.pendingIntervals() === 0, 'Under StrictMode the hidden Boiler still has a running interval.');
        }),
      ],
      concepts: [
        {
          id: 'deep-activity',
          icon: '🫥',
          title: '<Activity>',
          summary: 'Hide part of the UI while keeping its state; its effects are cleaned up until it is visible again.',
          snippet: code`
            <Activity mode={tab === 'log' ? 'visible' : 'hidden'}>
              <Logbook />
            </Activity>
          `,
          detail: 'Hidden children get display: none, keep React and DOM state, and re-render at low priority. Great for tabs and pre-rendering.',
        },
      ],
      modules: portholeModules,
      css: `
        .engine-rooms { max-width: 440px; margin: 0 auto; padding: 16px; border-radius: 18px;
          background: radial-gradient(circle at 80% 0%, #134e4a, #04121f 70%); color: #ccfbf1; border: 3px solid #b45309; }
        .engine-rooms header { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .lamp { font-weight: 800; margin: 0; }
        .tab { margin-left: 4px; background: #292524; color: #fde68a; border: 2px solid #b45309; }
        .tab.active { background: #b45309; color: white; }
        .room { margin-top: 12px; padding: 14px; border-radius: 14px; background: #0f172a; border: 2px solid #14b8a6; }
        .room h3 { margin-top: 0; color: #fcd34d; }
        .heat { font-family: ui-monospace, monospace; font-size: 1.8em; font-weight: 900; color: #fb923c; }
        .room textarea { width: 100%; min-height: 80px; box-sizing: border-box; }
        .dev-panel { margin-top: 14px; padding: 8px; border: 1px dashed #5eead4; border-radius: 10px; font-size: 0.85em; }
      `,
    },
  ],
};
