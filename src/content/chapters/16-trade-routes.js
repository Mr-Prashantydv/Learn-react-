import {
  Children,
  Fragment,
  createContext,
  createElement as h,
  isValidElement,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { hydrateRoot } from 'react-dom/client';
import { code, md, q, test } from '../helpers.js';

// =====================================================================
// Fake libraries handed to the player through `level.modules`.
//
// The sandbox runs inside the game page, so player code must never touch
// the real window.location / window.history. Every "browser address" in
// this region lives in a small in-memory history instead.
// =====================================================================

/**
 * Each sandbox (one per check, one per preview run) gets its own fake
 * history / API objects. Checks find the instances of *their* sandbox
 * through `t.timers`, which is the same object the modules were built with.
 */
const sandboxes = new WeakMap();
function remember(timers, key, value) {
  let entry = sandboxes.get(timers);
  if (!entry) sandboxes.set(timers, (entry = {}));
  entry[key] = value;
  return value;
}
const handle = (t, key) => sandboxes.get(t.timers)?.[key];

/** Promise that resolves with fn() after `ms` (fake time in checks). */
function later(timers, ms, fn) {
  return new Promise((resolve, reject) => {
    timers.setTimeout(() => {
      try {
        resolve(fn());
      } catch (err) {
        reject(err);
      }
    }, ms);
  });
}

/** An in-memory stand-in for the browser's history + address bar. */
function createMemoryHistory(initial = '/') {
  let entries = [initial];
  let index = 0;
  const listeners = new Set();
  // The AddressBar listens on a private channel, so listenerCount() only
  // counts the player's own subscriptions.
  const internal = new Set();
  const emit = () => {
    Array.from(listeners).forEach((listener) => listener());
    Array.from(internal).forEach((listener) => listener());
  };
  const history = {
    getPath: () => entries[index],
    push(to) {
      entries = entries.slice(0, index + 1);
      entries.push(String(to));
      index = entries.length - 1;
      emit();
    },
    replace(to) {
      entries = entries.slice();
      entries[index] = String(to);
      emit();
    },
    back() {
      if (index > 0) {
        index -= 1;
        emit();
      }
    },
    forward() {
      if (index < entries.length - 1) {
        index += 1;
        emit();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  Object.defineProperties(history, {
    listenerCount: { value: () => listeners.size },
    subscribeInternal: {
      value: (listener) => {
        internal.add(listener);
        return () => internal.delete(listener);
      },
    },
  });
  return history;
}

/** The pretend browser address bar shown at the top of the preview. */
function createAddressBar(history) {
  return function AddressBar() {
    const path = useSyncExternalStore(history.subscribeInternal, history.getPath);
    return h(
      'div',
      { className: 'address-bar' },
      h('button', { type: 'button', className: 'address-back', 'aria-label': 'Back', onClick: () => history.back() }, '←'),
      h('span', { className: 'address-url' }, h('span', { className: 'address-host' }, 'reactoria.app'), path),
    );
  };
}

// ---------------------------------------------------------------- 'reactoria-router'
// A small router whose API mirrors React Router's essentials.

const splitPath = (p) => String(p || '').split('/').filter(Boolean);

function parsePath(path) {
  const i = path.indexOf('?');
  return i < 0 ? { pathname: path || '/', search: '' } : { pathname: path.slice(0, i) || '/', search: path.slice(i) };
}

function resolveTo(to, pathname) {
  const target = String(to ?? '');
  if (target.startsWith('/')) return target;
  if (target.startsWith('?') || target === '') return pathname + target;
  return ('/' + [...splitPath(pathname), ...splitPath(target)].join('/')).replace(/\/+/g, '/');
}

function scoreOf(segments, index) {
  let score = segments.length;
  if (segments.includes('*')) score -= 2;
  if (index) score += 2;
  for (const seg of segments) {
    if (seg === '*') continue;
    score += seg.startsWith(':') ? 3 : 10;
  }
  return score;
}

function matchSegments(pattern, path) {
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const seg = pattern[i];
    if (seg === '*') {
      params['*'] = path.slice(i).map(safeDecode).join('/');
      return params;
    }
    if (i >= path.length) return null;
    if (seg.startsWith(':')) params[seg.slice(1)] = safeDecode(path[i]);
    else if (seg.toLowerCase() !== path[i].toLowerCase()) return null;
  }
  return pattern.length === path.length ? params : null;
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function createRouterModule(history) {
  const LocationContext = createContext(null);
  const RouteContext = createContext({ outlet: null, params: {} });

  function useRouterLocation(name) {
    const location = useContext(LocationContext);
    if (!location)
      throw new Error(`${name} may be used only inside <BrowserRouter>. Wrap your app in <BrowserRouter> … </BrowserRouter>.`);
    return location;
  }

  function BrowserRouter({ children }) {
    const [path, setPath] = useState(history.getPath);
    useEffect(() => {
      // Like React Router, navigations are transitions: a page that suspends
      // keeps the old page on screen until it is ready.
      const sync = () => startTransition(() => setPath(history.getPath()));
      sync();
      return history.subscribe(sync);
    }, []);
    const location = useMemo(() => ({ ...parsePath(path), hash: '', path }), [path]);
    return h(LocationContext.Provider, { value: location }, children);
  }

  function Route() {
    throw new Error('A <Route> is only ever used as a child of <Routes> (or of another <Route>), never rendered directly.');
  }

  function createRoutes(children) {
    const routes = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        routes.push(...createRoutes(child.props.children));
        return;
      }
      if (child.type !== Route) {
        const name = typeof child.type === 'string' ? child.type : child.type?.name || 'Component';
        throw new Error(`<Routes> only accepts <Route> children, but found <${name}>.`);
      }
      routes.push({
        path: child.props.path,
        index: Boolean(child.props.index),
        element: child.props.element === undefined ? null : child.props.element,
        children: createRoutes(child.props.children),
      });
    });
    return routes;
  }

  function flatten(routes, parentSegments, parentChain, out) {
    routes.forEach((route) => {
      let segments = parentSegments;
      if (route.path != null)
        segments = route.path.startsWith('/') ? splitPath(route.path) : [...parentSegments, ...splitPath(route.path)];
      const chain = [...parentChain, route];
      if (route.children.length) flatten(route.children, segments, chain, out);
      if (route.path != null || route.index) out.push({ segments, chain, score: scoreOf(segments, route.index), order: out.length });
    });
    return out;
  }

  function Routes({ children }) {
    const location = useRouterLocation('<Routes>');
    const branches = flatten(createRoutes(children), [], [], []).sort((a, b) => b.score - a.score || a.order - b.order);
    const pathSegments = splitPath(location.pathname);
    for (const branch of branches) {
      const params = matchSegments(branch.segments, pathSegments);
      if (!params) continue;
      let outlet = null;
      for (let i = branch.chain.length - 1; i >= 0; i--) {
        const element = branch.chain[i].element ?? h(Outlet);
        outlet = h(RouteContext.Provider, { value: { outlet, params } }, element);
      }
      return outlet;
    }
    return null;
  }

  function Outlet() {
    return useContext(RouteContext).outlet;
  }

  function useParams() {
    useRouterLocation('useParams()');
    return useContext(RouteContext).params;
  }

  function useLocation() {
    const { pathname, search, hash } = useRouterLocation('useLocation()');
    return useMemo(() => ({ pathname, search, hash }), [pathname, search, hash]);
  }

  function go(to, options) {
    if (options && options.replace) history.replace(to);
    else history.push(to);
  }

  function useNavigate() {
    const location = useRouterLocation('useNavigate()');
    const pathname = location.pathname;
    return useCallback(
      (to, options) => {
        if (typeof to === 'number') {
          if (to < 0) history.back();
          else if (to > 0) history.forward();
          return;
        }
        go(resolveTo(to, pathname), options);
      },
      [pathname],
    );
  }

  function useSearchParams() {
    const location = useRouterLocation('useSearchParams()');
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const setSearchParams = useCallback(
      (next, options) => {
        const value = typeof next === 'function' ? next(new URLSearchParams(location.search)) : next;
        const query = new URLSearchParams(value).toString();
        go(location.pathname + (query ? '?' + query : ''), options);
      },
      [location.pathname, location.search],
    );
    return [searchParams, setSearchParams];
  }

  function handleLinkClick(event, href, { replace, target, onClick }) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Let the browser handle new-tab clicks (ctrl/cmd/shift/middle click).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (target && target !== '_self') return;
    event.preventDefault();
    go(href, { replace });
  }

  function Link({ to, replace, onClick, children, ...rest }) {
    const location = useRouterLocation('<Link>');
    const href = resolveTo(to, location.pathname);
    return h(
      'a',
      { ...rest, href, onClick: (event) => handleLinkClick(event, href, { replace, target: rest.target, onClick }) },
      children,
    );
  }

  function NavLink({ to, end, className, replace, onClick, children, ...rest }) {
    const location = useRouterLocation('<NavLink>');
    const href = resolveTo(to, location.pathname);
    const target = parsePath(href).pathname;
    const here = location.pathname;
    const isActive =
      target === '/' ? here === '/' : here === target || (!end && here.startsWith(target.endsWith('/') ? target : target + '/'));
    const cls =
      typeof className === 'function' ? className({ isActive }) : [className, isActive ? 'active' : null].filter(Boolean).join(' ');
    return h(
      'a',
      {
        ...rest,
        href,
        className: cls || undefined,
        'aria-current': isActive ? 'page' : undefined,
        onClick: (event) => handleLinkClick(event, href, { replace, target: rest.target, onClick }),
      },
      typeof children === 'function' ? children({ isActive }) : children,
    );
  }

  return {
    BrowserRouter,
    Routes,
    Route,
    Outlet,
    Link,
    NavLink,
    useParams,
    useLocation,
    useNavigate,
    useSearchParams,
    AddressBar: createAddressBar(history),
  };
}

/** modules() for a level that uses the router (optionally starting elsewhere). */
function routerModules(timers) {
  const history = remember(timers, 'history', createMemoryHistory('/'));
  return createRouterModule(history);
}

// ---------------------------------------------------------------- check helpers

const squish = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Suspense hides content it replaced with a fallback using display: none. */
function isShown(el) {
  for (let node = el; node; node = node.parentElement) {
    if (node.style && node.style.display === 'none') return false;
  }
  return true;
}

const shownText = (t, sel) => {
  const el = t.$$(sel).find(isShown);
  return el ? squish(el.textContent) : null;
};

/** Moves the fake browser to `path` (React sees the change inside act). */
function goTo(t, path) {
  const history = handle(t, 'history');
  t.act(() => {
    history.push(path);
  });
}

function heading(t) {
  const el = t.$$('h1').find(isShown);
  return el ? squish(el.textContent) : '(no <h1>)';
}

// --- Signpost helpers
function signpostsModules({ timers }) {
  const history = remember(timers, 'history', createMemoryHistory('/'));
  return { 'tiny-history': { history, AddressBar: createAddressBar(history) } };
}

// --- Ledger helpers
function marketModules({ timers }) {
  let prices = { silk: 12, spice: 30, amber: 7 };
  const caravans = {
    1: { id: 1, name: 'Saffron Wind', cargo: 'spice' },
    2: { id: 2, name: 'Silk Serpent', cargo: 'silk' },
  };
  const calls = [];
  const market = {
    getPrices() {
      calls.push('getPrices');
      return later(timers, 300, () => ({ ...prices }));
    },
    getCaravan(id) {
      calls.push('getCaravan:' + id);
      return later(timers, 300, () => {
        if (!caravans[id]) throw new Error(`No caravan #${id}`);
        return { ...caravans[id] };
      });
    },
    raisePrice(item) {
      calls.push('raisePrice:' + item);
      return later(timers, 300, () => {
        prices = { ...prices, [item]: prices[item] + 5 };
        return prices[item];
      });
    },
  };
  Object.defineProperty(market, 'calls', { value: calls });
  remember(timers, 'market', market);
  return { 'market-api': { market } };
}

const callCount = (t, name) => handle(t, 'market').calls.filter((c) => c === name).length;

function boardSilk(t) {
  const li = t.$$('.board li').find((el) => /silk/i.test(el.textContent));
  if (li) return squish(li.textContent);
  return t.$('.loading') ? 'Loading prices…' : '(no price board)';
}

async function openLedger(t) {
  t.render();
  await t.tick(300);
  await t.flush();
  if (!t.$('.board'))
    t.fail(
      `After the prices arrived (0.3 s) the .board still isn't showing (${t.$('.loading') ? 'still "Loading prices…"' : 'nothing there'}). useQuery must return { status: 'success', data } once the fetcher resolves, read from the shared cache.`,
    );
}

// --- Mirage (SSR + hydration) helpers

/**
 * Plays both machines of a server-rendered app: renders `element` to HTML
 * like a server would, runs `between()` (time passes, the browser has its own
 * storage…), then hydrates that HTML with hydrateRoot like a browser would.
 */
async function serverThenBrowser(t, element, between) {
  const { renderToString } = await import('react-dom/server');
  let html;
  try {
    html = renderToString(element);
  } catch (err) {
    t.fail(`Rendering on the "server" crashed: ${err.message} (Effects never run on the server, and useSyncExternalStore needs its third argument, getServerSnapshot, there.)`);
  }
  if (between) await between();
  const box = document.createElement('div');
  box.innerHTML = html;
  document.body.appendChild(box);
  const errors = [];
  const fromWarning = t.warnings.length;
  let root = null;
  try {
    await t.act(async () => {
      root = hydrateRoot(box, element, { onRecoverableError: (error) => errors.push(error) });
    });
    await t.flush();
  } catch (err) {
    box.remove();
    t.fail(`Your component crashed while hydrating: ${err.message}`);
  }
  const mismatches = () => [
    ...errors.map((e) => String(e?.message || e)),
    ...t.warnings.slice(fromWarning).filter((w) => /hydrat|didn't match|did not match/i.test(w)),
  ];
  return {
    html,
    box,
    mismatches,
    text: (sel) => {
      const el = box.querySelector(sel);
      return el ? squish(el.textContent) : null;
    },
    cleanup() {
      try {
        t.act(() => root?.unmount());
      } catch {
        /* ignore */
      }
      box.remove();
    },
  };
}

/** The first sentence of React's (long) hydration messages. */
const firstLine = (msg) => String(msg).split('\n')[0].split(/(?<=\.)\s/)[0];
const FIVE_MINUTES = 5 * 60 * 1000;

// --- Bazaar (simulated Server Components) helpers

const SERVER_FUNCTION = Symbol.for('reactoria.serverFunction');

/**
 * What React's server would say about a prop it has to serialise for a
 * Client Component (null when it can cross the boundary).
 */
function serialisationProblem(value, path, seen = new Set()) {
  if (value === null || value === undefined) return null;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') return null;
  if (type === 'function')
    return value[SERVER_FUNCTION]
      ? null
      : `"${path}" is a function. Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".`;
  if (type === 'symbol')
    return Symbol.keyFor(value) !== undefined ? null : `"${path}" is a Symbol. Only global symbols made with Symbol.for() can be serialised.`;
  if (isValidElement(value)) return null; // JSX rendered on the server is fine
  if (typeof value.then === 'function') return null; // promises stream to the client
  if (seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const problem = serialisationProblem(value[i], `${path}[${i}]`, seen);
      if (problem) return problem;
    }
    return null;
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set || ArrayBuffer.isView(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype) {
    const kind = proto && proto.constructor ? `a ${proto.constructor.name} class instance` : 'an object with a null prototype';
    return `"${path}" is ${kind}. Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported.`;
  }
  for (const key of Object.keys(value)) {
    const problem = serialisationProblem(value[key], `${path}.${key}`, seen);
    if (problem) return problem;
  }
  return null;
}

/** Wraps a component so it behaves like one imported from a 'use client' file. */
function clientComponent(name, Impl, violations) {
  function ClientBoundary(props) {
    for (const key of Object.keys(props)) {
      const problem = serialisationProblem(props[key], key);
      if (problem) {
        violations.push({ component: name, problem });
        throw new Error(`<${name}> is a Client Component ('use client'), so its props travel from the server to the browser. ${problem}`);
      }
    }
    return h(Impl, props);
  }
  ClientBoundary.displayName = name;
  return ClientBoundary;
}

function StallCardImpl({ stall, buy }) {
  const [receipt, formAction, isPending] = useActionState(buy, null);
  return h(
    'li',
    { className: 'stall' },
    h('span', { className: 'stall-name' }, stall.name),
    ' ',
    h('span', { className: 'stall-price' }, `${stall.price} gold`),
    h(
      'form',
      { action: formAction },
      h('input', { type: 'hidden', name: 'stallId', value: String(stall.id) }),
      h('button', { disabled: isPending }, isPending ? 'Buying…' : 'Buy'),
    ),
    receipt ? h('p', { className: 'receipt' }, receipt) : null,
  );
}

function CurtainImpl({ title, children }) {
  const [open, setOpen] = useState(true);
  return h(
    'section',
    { className: 'curtain' },
    h('button', { type: 'button', className: 'curtain-toggle', onClick: () => setOpen(!open) }, open ? `Hide ${title}` : `Show ${title}`),
    open ? children : null,
  );
}

function bazaarModules({ timers }) {
  class Stall {
    constructor(id, name, price) {
      this.id = id;
      this.name = name;
      this.price = price;
    }
    haggle() {
      return Math.round(this.price * 0.9);
    }
  }
  const STALLS = [new Stall(1, 'Saffron', 12), new Stall(2, 'Silk', 30), new Stall(3, 'Amber', 7)];
  const RUMOURS = ['The Waterfall Bandit rides at dusk.', 'Silk prices will rise.'];
  const purchases = [];
  const violations = [];
  // The db starts every query when the request arrives and, like React's
  // server-only cache(), hands out the same promise for the whole request.
  const stallsPromise = later(timers, 500, () => STALLS.slice());
  const rumoursPromise = later(timers, 1500, () => RUMOURS.slice());
  const db = {
    stalls: () => stallsPromise,
    rumours: () => rumoursPromise,
  };
  async function buyGoods(prevState, formData) {
    await later(timers, 300, () => {});
    // A Server Function is a public endpoint: never trust its input.
    const stall = STALLS.find((s) => String(s.id) === String(formData.get('stallId')));
    if (!stall) return 'That stall does not exist.';
    purchases.push(stall.id);
    return `Bought ${stall.name} for ${stall.price} gold`;
  }
  buyGoods[SERVER_FUNCTION] = true;
  remember(timers, 'bazaar', { purchases, violations });
  const StallCard = clientComponent('StallCard', StallCardImpl, violations);
  const Curtain = clientComponent('Curtain', CurtainImpl, violations);
  return {
    './db.js': { db },
    './actions.js': { buyGoods },
    './StallCard.jsx': { default: StallCard, __esModule: true },
    './Curtain.jsx': { default: Curtain, __esModule: true },
  };
}

function bazaarCrash(t, err) {
  const violation = handle(t, 'bazaar').violations[0];
  if (violation) t.fail(violation.problem.startsWith('"stall"') || violation.problem.startsWith('"buy"') ? `<${violation.component}> crashed: ${violation.problem} See the lesson's table of what can cross the boundary.` : `<${violation.component}> crashed: ${violation.problem}`);
  throw err;
}

async function openBazaar(t, ms) {
  try {
    await t.renderAsync();
    if (ms) {
      await t.tick(ms);
      await t.flush();
    }
  } catch (err) {
    bazaarCrash(t, err);
  }
  const violation = handle(t, 'bazaar').violations[0];
  if (violation) t.fail(`<${violation.component}> crashed: ${violation.problem}`);
  if (!t.$('h1'))
    t.fail(
      'Nothing is on screen while the bazaar loads: without a <Suspense> boundary, the waiting Stalls component suspends the whole page. Wrap <Stalls /> in <Suspense fallback={<p className="loading">Setting up stalls…</p>}>.',
    );
}

// --- Boss helpers
function banditModules({ timers }) {
  const CARAVANS = {
    1: { name: 'Saffron Wind', from: 'Sandport', to: 'Jade City' },
    2: { name: 'Silk Serpent', from: 'Jade City', to: 'Mirage Oasis' },
    3: { name: 'Amber Tortoise', from: 'Mirage Oasis', to: 'Sandport' },
  };
  const CARGO = { 1: ['saffron', 'cinnamon', 'pepper'], 2: ['silk', 'jade'], 3: ['amber', 'figs', 'lamp oil'] };
  const ESCORTS = { 1: 'Captain Ada and 4 riders', 2: 'Sergeant Lin and 2 riders', 3: 'Old Moss and his camel' };
  const calls = [];
  const known = (table, id) => {
    if (!(id in table)) throw new Error(`No caravan #${id} on the roads.`);
    return table[id];
  };
  const api = {
    getCaravan(id) {
      calls.push(`caravan:${id}`);
      return later(timers, 1000, () => ({ id: Number(id), ...known(CARAVANS, id) }));
    },
    getCargo(id) {
      calls.push(`cargo:${id}`);
      return later(timers, 1000, () => known(CARGO, id).slice());
    },
    getEscort(id) {
      calls.push(`escort:${id}`);
      return later(timers, 1000, () => known(ESCORTS, id));
    },
  };
  Object.defineProperty(api, 'calls', { value: calls });
  remember(timers, 'api', api);
  return { 'reactoria-router': routerModules(timers), 'caravan-api': { api } };
}

const apiCalls = (t) => handle(t, 'api').calls;

function tripShown(t) {
  return {
    name: shownText(t, '.trip-name'),
    cargo: t.$$('.cargo li').filter(isShown).length,
    escort: shownText(t, '.escort'),
  };
}

async function followCaravan(t, id) {
  goTo(t, `/caravans/${id}`);
  await t.renderAsync();
}

/**
 * Clicks a nav link inside an *awaited* act(): the page it opens may suspend,
 * and React only retries a suspended render that started in an async act.
 */
async function bossLink(t, label) {
  const link = t.$$('nav a').find((a) => squish(a.textContent) === label);
  if (!link) t.fail(`Could not find the "${label}" link in the <nav>. Keep the camp's links as they are.`);
  try {
    await t.act(async () => {
      link.click();
    });
  } catch (err) {
    t.fail(`Your component crashed: ${err.message}`);
  }
}

/** The layout rendered, but its <main> is empty: the Outlet is missing. */
function requireOutlet(t) {
  const main = t.$('.guild-main');
  if (main && main.childNodes.length === 0)
    t.fail('The guild layout shows, but its <main className="guild-main"> is empty. Render <Outlet /> inside it: that is where the matching child route appears.');
}

function clickLink(t, href) {
  const link = t.$(`a[href="${href}"]`);
  if (!link) t.fail(`Could not find the link to "${href}". Keep the <Link to="${href}"> in the <nav>, and make Link render <a href={to}>.`);
  t.click(link);
  return link;
}

export default {
  id: 'trade-routes',
  file: '16-trade-routes.js',
  title: 'Trade Routes',
  short: 'Routes',
  subtitle: 'Building real apps: routing, cached server data, streaming Server Components and hydration.',
  icon: '🐪',
  colors: ['#78350f', '#f59e0b'],
  scenery: ['🐪', '🏜️', '🧭', '🗺️', '🏺', '🌵', '⛺', '🪙'],
  intro: [
    { text: "Welcome to the Trade Routes! Every city in Reactoria trades along these roads: spices, silk, and above all... data.", mood: 'excited' },
    { text: "Real apps live here: many pages, each with its own address, data fetched from far-off servers, pages streamed in piece by piece.", mood: 'thinking' },
    { text: "But a bandit haunts the dunes. He makes every caravan wait for the one before it. Learn the roads, and we'll run him off!", mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'routes-signposts',
      type: 'code',
      title: 'The Signpost Crossroads',
      blurb: 'Build a tiny router: the address decides the page.',
      xp: 140,
      modules: signpostsModules,
      story: [
        { text: "The Crossroads! Four roads meet here, and the signposts are supposed to send travellers to the right city.", mood: 'happy' },
        { text: "But the Mutator scrambled them. Every signpost points back to the square, and clicking one reloads the whole world! Let's build a proper router.", mood: 'worried' },
      ],
      lesson: md`
        ## One page, many addresses

        A React app is usually a **single-page app**: the browser loads one HTML page, once,
        and React swaps what's on screen. But users still expect **addresses**: they bookmark
        \`/market\`, share \`/caravans/7\` with a friend, press **Back**, hit refresh. So the URL is
        **state** too, it just lives in the address bar instead of in \`useState\`.

        A **router** keeps that address and the screen in sync. It has three jobs:

        1. **Read** the current path, and re-render when it changes.
        2. **Match** the path to a component (\`/market\` → \`<Market />\`).
        3. **Navigate** to a new path *without* reloading the page.

        ## The browser's tools, and Reactoria's

        Browsers expose the address through \`window.location\` and \`window.history\`:
        \`history.pushState(null, '', '/market')\` changes the URL without a reload, and a
        \`popstate\` event fires when the user presses Back or Forward. Your code in Reactoria runs
        *inside the game page*, so touching the real address bar would steer the game itself!
        This quest gives you \`tiny-history\`, a pretend address bar with the same ideas:

        | Real browser | \`tiny-history\` |
        |---|---|
        | \`window.location.pathname\` | \`history.getPath()\` |
        | \`window.history.pushState(null, '', to)\` | \`history.push(to)\` |
        | \`window.history.back()\` | \`history.back()\` |
        | listening for \`popstate\` | \`history.subscribe(listener)\` (returns an unsubscribe function) |

        The \`<AddressBar />\` it also exports shows the current path in the preview, with a ← Back button.

        ## Reading the path: an external store

        The path lives *outside* React, so it's an **external store**, the job
        \`useSyncExternalStore\` was made for. Hand it a \`subscribe\` function and a
        \`getSnapshot\` function:

        \`\`\`jsx
        import { useSyncExternalStore } from 'react';

        function usePath() {
          return useSyncExternalStore(history.subscribe, history.getPath);
        }
        \`\`\`

        React subscribes when the component mounts, reads \`getPath()\` on every render, re-renders
        when a listener fires with a new path, and **unsubscribes** when the component unmounts.

        ## Links: an \`<a>\` with manners

        A plain \`<a href="/market">\` asks the browser for a **brand-new page**: everything
        reloads and all your state is gone. A router's \`Link\` still renders a real \`<a>\` (so
        screen readers announce a link, the URL shows on hover and ctrl+click opens a new tab), but it
        intercepts the click:

        \`\`\`jsx
        function Link({ to, children }) {
          function handleClick(event) {
            event.preventDefault(); // no full page load…
            history.push(to);       // …just change the address
          }
          return <a href={to} onClick={handleClick}>{children}</a>;
        }
        \`\`\`

        :::mistake
        Don't navigate with \`<button onClick={() => history.push('/market')}>\` or a clickable
        \`<div>\`. Assistive tech won't announce it as a link, and it can't be opened in a new tab.
        **Links go places; buttons do things.**
        :::

        ## Matching: from path to page

        \`\`\`jsx
        let page;
        if (path === '/') page = <Square />;
        else if (path === '/market') page = <Market />;
        else if (path.startsWith('/caravans/')) page = <Caravan id={path.split('/')[2]} />;
        else page = <NotFound path={path} />;
        \`\`\`

        \`/caravans/7\` and \`/caravans/12\` share **one** component. The part that changes (\`7\`) is
        a **route parameter**, passed down as a prop. And there's always a last resort: a
        **not-found** page for roads that lead nowhere.

        :::pro
        Real routers do much more: query strings, nested layouts, ctrl+click handling, scroll
        restoration, loading code per page. Next quest, you'll use one. But it's the same three
        jobs underneath: read, match, navigate.
        :::
      `,
      task: md`
        ## 🎯 Repair the signposts

        Import \`history\` from \`'tiny-history'\` (already done). Never touch \`window.location\` here.

        1. **\`usePath()\`** must return the current path **and re-render when it changes**:
           use \`useSyncExternalStore(history.subscribe, history.getPath)\`.
        2. **\`Link\`** renders \`<a href={to}>\`. On click it calls \`event.preventDefault()\` and
           then \`history.push(to)\`.
        3. **\`App\`** picks the page inside \`<main>\` from the path:
           - \`/\` → \`<Square />\` (**Crossroads Square**)
           - \`/market\` → \`<Market />\` (**Spice Market**)
           - \`/caravans/<id>\` → \`<Caravan id={…} />\`, e.g. \`/caravans/12\` shows **Caravan #12**
           - anything else → \`<NotFound path={path} />\` (**Lost in the Dunes**, plus "No road leads to /oasis")

        Keep the \`<AddressBar />\` and the five links in the \`<nav>\`.
      `,
      starter: code`
        import { useSyncExternalStore } from 'react';
        import { history, AddressBar } from 'tiny-history';

        // 1. The current path, kept in sync with the address bar.
        export function usePath() {
          // 🐛 Reads the path once... and never hears about changes.
          return history.getPath();
        }

        // 2. A link that travels without reloading the page.
        export function Link({ to, children }) {
          // TODO: prevent the full page load, then history.push(to)
          return <a href={to}>{children}</a>;
        }

        function Square() {
          return <h1>Crossroads Square</h1>;
        }

        function Market() {
          return <h1>Spice Market</h1>;
        }

        function Caravan({ id }) {
          return <h1>Caravan #{id}</h1>;
        }

        function NotFound({ path }) {
          return (
            <>
              <h1>Lost in the Dunes</h1>
              <p className="not-found">No road leads to {path}</p>
            </>
          );
        }

        export default function App() {
          const path = usePath();

          // 3. TODO: choose the page from the path
          let page = <Square />;

          return (
            <div className="crossroads">
              <AddressBar />
              <nav className="signposts">
                <Link to="/">Square</Link>
                <Link to="/market">Market</Link>
                <Link to="/caravans/7">Caravan 7</Link>
                <Link to="/caravans/12">Caravan 12</Link>
                <Link to="/oasis">Oasis?</Link>
              </nav>
              <main>{page}</main>
            </div>
          );
        }
      `,
      solution: code`
        import { useSyncExternalStore } from 'react';
        import { history, AddressBar } from 'tiny-history';

        // 1. The current path, kept in sync with the address bar.
        export function usePath() {
          return useSyncExternalStore(history.subscribe, history.getPath);
        }

        // 2. A link that travels without reloading the page.
        export function Link({ to, children }) {
          function handleClick(event) {
            event.preventDefault();
            history.push(to);
          }
          return (
            <a href={to} onClick={handleClick}>
              {children}
            </a>
          );
        }

        function Square() {
          return <h1>Crossroads Square</h1>;
        }

        function Market() {
          return <h1>Spice Market</h1>;
        }

        function Caravan({ id }) {
          return <h1>Caravan #{id}</h1>;
        }

        function NotFound({ path }) {
          return (
            <>
              <h1>Lost in the Dunes</h1>
              <p className="not-found">No road leads to {path}</p>
            </>
          );
        }

        export default function App() {
          const path = usePath();

          let page;
          if (path === '/') {
            page = <Square />;
          } else if (path === '/market') {
            page = <Market />;
          } else if (path.startsWith('/caravans/')) {
            const id = path.split('/')[2];
            page = <Caravan id={id} />;
          } else {
            page = <NotFound path={path} />;
          }

          return (
            <div className="crossroads">
              <AddressBar />
              <nav className="signposts">
                <Link to="/">Square</Link>
                <Link to="/market">Market</Link>
                <Link to="/caravans/7">Caravan 7</Link>
                <Link to="/caravans/12">Caravan 12</Link>
                <Link to="/oasis">Oasis?</Link>
              </nav>
              <main>{page}</main>
            </div>
          );
        }
      `,
      hints: [
        md`\`usePath\` is one line: \`return useSyncExternalStore(history.subscribe, history.getPath);\`. React calls \`subscribe\` for you and re-renders when the path changes.`,
        md`In \`Link\`, add \`onClick={handleClick}\` to the \`<a>\`, where \`handleClick(event)\` calls \`event.preventDefault()\` and then \`history.push(to)\`.`,
        md`For the pages, use an \`if / else if\` chain on \`path\`. For caravans: \`else if (path.startsWith('/caravans/')) page = <Caravan id={path.split('/')[2]} />;\` and finish with \`else page = <NotFound path={path} />;\`.`,
      ],
      tests: [
        test('Each road leads to its own page', (t) => {
          const expected = [
            ['/', 'Crossroads Square'],
            ['/market', 'Spice Market'],
            ['/caravans/7', 'Caravan #7'],
            ['/caravans/12', 'Caravan #12'],
          ];
          for (const [path, title] of expected) {
            goTo(t, path);
            t.render();
            const shown = heading(t);
            t.expect(
              shown === title,
              `At ${path} the page shows "${shown}", expected "${title}". In App, choose the page from the path: / → <Square />, /market → <Market />, /caravans/<id> → <Caravan id={…} />.`,
            );
          }
        }),
        test('Unknown roads lead to the not-found page', (t) => {
          goTo(t, '/oasis');
          t.render();
          const shown = heading(t);
          t.expect(
            shown === 'Lost in the Dunes',
            `At /oasis the page shows "${shown}", expected "Lost in the Dunes". End your if / else if chain with else page = <NotFound path={path} />.`,
          );
          const note = shownText(t, '.not-found');
          t.expect(note === 'No road leads to /oasis', `The .not-found text reads "${note}", expected "No road leads to /oasis". Pass the path along: <NotFound path={path} />.`);
        }),
        test('Links travel without reloading the game', (t) => {
          t.render();
          clickLink(t, '/market');
          const history = handle(t, 'history');
          const reloaded = t.blockedNavigations.length > 0;
          t.expect(
            history.getPath() === '/market',
            `Clicking the Market link left the address at "${history.getPath()}".${reloaded ? ' Worse, the browser tried to load /market as a whole new page!' : ''} In Link's onClick, call event.preventDefault() and then history.push(to).`,
          );
          t.expect(
            !reloaded,
            'The address changed, but the browser also tried to load /market as a brand-new page (that would wipe all state). Call event.preventDefault() in the click handler.',
          );
          const shown = heading(t);
          t.expect(
            shown === 'Spice Market',
            `The address is now /market, but the page still shows "${shown}". usePath() must re-render when the path changes: return useSyncExternalStore(history.subscribe, history.getPath).`,
          );
        }),
        test('Back returns to the previous page', (t) => {
          t.render();
          clickLink(t, '/market');
          clickLink(t, '/caravans/12');
          const history = handle(t, 'history');
          t.expect(history.getPath() === '/caravans/12', 'Clicking a Link must push its path with history.push(to) (see the objective above).');
          t.act(() => history.back());
          t.expect(
            heading(t) === 'Spice Market',
            `After pressing Back (address: /market) the page shows "${heading(t)}", expected "Spice Market". usePath() must subscribe to the history, so React re-renders on every change.`,
          );
          t.act(() => history.back());
          t.expect(heading(t) === 'Crossroads Square', `After pressing Back again the page shows "${heading(t)}", expected "Crossroads Square".`);
        }),
        test('The router stops listening when it leaves', (t) => {
          t.render();
          const history = handle(t, 'history');
          t.expect(
            history.listenerCount() > 0,
            'Nothing is subscribed to the history, so the page can never follow the address. Use useSyncExternalStore(history.subscribe, history.getPath) in usePath().',
          );
          t.unmount();
          const left = history.listenerCount();
          t.expect(
            left === 0,
            `After the app unmounted, ${left} listener(s) were still subscribed to the history. Return the unsubscribe function from your effect (useSyncExternalStore does this for you).`,
          );
        }),
      ],
      css: code`
        .crossroads { border-radius: 14px; overflow: hidden; background: #fffbeb; color: #451a03; border: 2px solid #f59e0b; }
        .address-bar { display: flex; gap: 8px; align-items: center; padding: 6px 10px; background: #292524; color: #e7e5e4; font-family: ui-monospace, monospace; font-size: 13px; }
        .address-bar button { padding: 2px 10px; }
        .address-url { flex: 1; background: #44403c; border-radius: 999px; padding: 4px 12px; }
        .address-host { color: #a8a29e; }
        .signposts { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; background: #fde68a; }
        .signposts a { padding: 4px 10px; border-radius: 999px; background: #fffbeb; color: #92400e; font-weight: 700; text-decoration: none; }
        main { padding: 16px; text-align: center; }
        .not-found { color: #b45309; font-style: italic; }
      `,
      concepts: [
        {
          id: 'routes-url-state',
          icon: '🧭',
          title: 'The URL is state',
          summary: 'A router reads the path, matches it to a component, and navigates without reloading.',
          snippet: code`
            const path = useSyncExternalStore(history.subscribe, history.getPath);
            if (path.startsWith('/caravans/')) page = <Caravan id={path.split('/')[2]} />;
          `,
          detail: 'Addresses make pages bookmarkable and shareable, and make Back/Forward work. The changing part of a path, like the 7 in /caravans/7, is a route parameter.',
        },
        {
          id: 'routes-link',
          icon: '🔗',
          title: 'Link vs <a>',
          summary: 'A Link renders a real <a href>, but prevents the full page load and pushes the new path.',
          snippet: code`
            <a href={to} onClick={(e) => { e.preventDefault(); history.push(to); }}>
              {children}
            </a>
          `,
          detail: 'Links are for going places, buttons are for doing things. A real <a> keeps right-click, ctrl+click and screen readers working.',
        },
      ],
    },
    // ---------------------------------------------------------------- 2
    {
      id: 'routes-waystation',
      type: 'code',
      title: 'The Guild Waystation',
      blurb: 'Use a real router API: layouts, params, navigate, search params and 404s.',
      xp: 150,
      modules: ({ timers }) => ({ 'reactoria-router': routerModules(timers) }),
      story: [
        { text: "This is the Caravan Guild's waystation. Their message board has a page for every caravan, but the pages are all jumbled.", mood: 'thinking' },
        { text: "Hand-built routers get messy fast, so the Guild uses a routing library. Its API is shaped exactly like React Router's, so what you learn here works in real apps!", mood: 'excited' },
      ],
      lesson: md`
        ## Meet a routing library

        Your hand-built router worked, but real apps need nested layouts, query strings, ranking
        of routes and much more. So they use a library: most often **React Router**, or the
        router built into a framework (Next.js routes by folders and files). This quest's
        \`reactoria-router\` copies React Router's essential API: same names, same shapes. Swap
        the import for \`'react-router'\` and this code runs in a real app.

        \`\`\`jsx
        import { BrowserRouter, Routes, Route } from 'reactoria-router';

        <BrowserRouter>
          <Routes>
            <Route path="/" element={<GuildLayout />}>
              <Route index element={<Welcome />} />
              <Route path="caravans" element={<CaravanList />} />
              <Route path="caravans/:id" element={<CaravanDetail />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        \`\`\`

        ## Nested routes and \`<Outlet />\`

        Routes nest like components. The parent route renders a **layout** (header, nav,
        footer), and \`<Outlet />\` marks the spot where the matching **child** route appears:

        \`\`\`jsx
        function GuildLayout() {
          return (
            <>
              <header>…</header>
              <main><Outlet /></main>
            </>
          );
        }
        \`\`\`

        - Child paths are **relative**: \`caravans\` inside \`/\` means \`/caravans\`.
        - An **\`index\`** route is the child shown at the parent's own path (\`/\`).
        - When you navigate between children, the layout **stays mounted**, and so does its state.

        ## Route params: \`useParams\`

        \`caravans/:id\` matches \`/caravans/2\`, \`/caravans/42\`… and \`useParams()\` hands you
        \`{ id: '2' }\`.

        :::mistake
        Params are always **strings**. If your data uses number ids,
        \`caravans.find((c) => c.id === id)\` never finds anything, because \`2 === '2'\` is false.
        Convert one side: \`c.id === Number(id)\` or \`String(c.id) === id\`.
        :::

        ## Links, NavLinks and navigating in code

        \`<Link to="/caravans/2">\` is the link you built last quest. \`<NavLink>\` is a Link that
        knows when it's active: it adds \`className="active"\` and \`aria-current="page"\`, perfect
        for menus (\`end\` makes \`/\` match only exactly).

        Sometimes you navigate because **something happened**: a form was submitted, a login
        succeeded, an item was saved. That's \`useNavigate\`:

        \`\`\`jsx
        const navigate = useNavigate();

        function handleSubmit(event) {
          event.preventDefault();
          const number = new FormData(event.currentTarget).get('caravan');
          navigate('/caravans/' + number);
        }
        \`\`\`

        \`navigate(-1)\` goes back; \`navigate(to, { replace: true })\` replaces the current history
        entry (handy after a login, so Back doesn't return to the login form).

        ## Search params: state in the query string

        Filters, search terms, sort orders and page numbers belong in the URL too
        (\`/caravans?goods=silk\`), so a filtered view can be bookmarked and shared:

        \`\`\`jsx
        const [searchParams, setSearchParams] = useSearchParams();
        const goods = searchParams.get('goods'); // 'silk', or null when missing
        setSearchParams({ goods: 'spice' });     // → /caravans?goods=spice
        setSearchParams({});                     // → /caravans
        \`\`\`

        ## The not-found route

        \`path="*"\` matches whatever no other route claims. Routes are ranked by how
        **specific** they are, not by order, so \`caravans/:id\` always beats \`*\`. Put the \`*\`
        route inside the layout and even lost travellers keep the header and nav.

        :::pro
        React Router can also load data **before** a route renders (\`loader\` functions in its
        data and framework modes), and frameworks like Next.js add file-based routing on top.
        Different spellings, same ideas: path → layout + page, params, links, navigation.
        :::
      `,
      task: md`
        ## 🎯 Sort out the waystation

        Everything comes from \`'reactoria-router'\`. In \`CARAVANS\`, ids are **numbers**.

        1. **Layout**: make \`GuildLayout\` a parent route at \`/\` with the other routes nested inside it,
           and render \`<Outlet />\` inside its \`<main className="guild-main">\`. \`Welcome\` is the **index** route.
        2. **Params**: \`/caravans/:id\` shows that caravan. Read \`id\` with \`useParams()\` in
           \`CaravanDetail\` (\`/caravans/2\` shows **Silk Serpent**; an unknown id like \`/caravans/99\`
           shows "No caravan #99 on the roads.").
        3. **Navigate in code**: submitting the tracking form with \`3\` in \`<input name="caravan">\` goes to
           \`/caravans/3\` with \`useNavigate()\` (no page reload).
        4. **Search params**: \`CaravanList\` shows only the caravans whose \`goods\` match \`?goods=…\`
           (all of them when it's missing). The **Spice** / **Silk** buttons set \`?goods=spice\` /
           \`?goods=silk\`; **All** removes it (the address becomes \`/caravans\`).
        5. **Not found**: a \`*\` route inside the layout renders \`<NotFound />\`.
      `,
      starter: code`
        import {
          BrowserRouter, Routes, Route, Outlet, Link, NavLink,
          useParams, useNavigate, useSearchParams, useLocation, AddressBar,
        } from 'reactoria-router';

        const CARAVANS = [
          { id: 1, name: 'Saffron Wind', goods: 'spice' },
          { id: 2, name: 'Silk Serpent', goods: 'silk' },
          { id: 3, name: 'Amber Tortoise', goods: 'spice' },
          { id: 4, name: 'Moonlit Bolt', goods: 'silk' },
        ];

        function GuildLayout() {
          return (
            <div className="guild">
              <header className="guild-header">
                <h1>🐪 Caravan Guild</h1>
                <nav>
                  <NavLink to="/" end>Hall</NavLink>
                  <NavLink to="/caravans">Caravans</NavLink>
                </nav>
              </header>
              <main className="guild-main">
                {/* TODO: the matching child route goes here */}
              </main>
            </div>
          );
        }

        function Welcome() {
          function handleSubmit(event) {
            event.preventDefault();
            // TODO: read the "caravan" field and navigate to /caravans/<number>
          }

          return (
            <section className="welcome">
              <h2>Welcome, traveller!</h2>
              <form className="track" onSubmit={handleSubmit}>
                <label>
                  Caravan number <input name="caravan" />
                </label>
                <button>Track</button>
              </form>
            </section>
          );
        }

        function CaravanList() {
          // TODO: read ?goods= with useSearchParams and filter
          const shown = CARAVANS;

          return (
            <section>
              <h2>All caravans</h2>
              <div className="filters">
                <button>All</button>
                <button>Spice</button>
                <button>Silk</button>
              </div>
              <ul className="caravan-list">
                {shown.map((caravan) => (
                  <li key={caravan.id}>
                    <Link to={'/caravans/' + caravan.id}>{caravan.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        function CaravanDetail() {
          const id = '1'; // TODO: read it from the URL
          const caravan = CARAVANS.find((c) => c.id === id);

          if (!caravan) return <p className="missing">No caravan #{id} on the roads.</p>;
          return (
            <article className="caravan">
              <h2>{caravan.name}</h2>
              <p>Carrying {caravan.goods}</p>
              <Link to="/caravans">← All caravans</Link>
            </article>
          );
        }

        function NotFound() {
          const { pathname } = useLocation();
          return <p className="not-found">No road leads to {pathname}</p>;
        }

        export default function App() {
          return (
            <BrowserRouter>
              <AddressBar />
              <Routes>
                {/* TODO: nest these under a GuildLayout route, add index and * routes */}
                <Route path="/" element={<Welcome />} />
                <Route path="/caravans" element={<CaravanList />} />
                <Route path="/caravans/:id" element={<CaravanDetail />} />
              </Routes>
            </BrowserRouter>
          );
        }
      `,
      solution: code`
        import {
          BrowserRouter, Routes, Route, Outlet, Link, NavLink,
          useParams, useNavigate, useSearchParams, useLocation, AddressBar,
        } from 'reactoria-router';

        const CARAVANS = [
          { id: 1, name: 'Saffron Wind', goods: 'spice' },
          { id: 2, name: 'Silk Serpent', goods: 'silk' },
          { id: 3, name: 'Amber Tortoise', goods: 'spice' },
          { id: 4, name: 'Moonlit Bolt', goods: 'silk' },
        ];

        function GuildLayout() {
          return (
            <div className="guild">
              <header className="guild-header">
                <h1>🐪 Caravan Guild</h1>
                <nav>
                  <NavLink to="/" end>Hall</NavLink>
                  <NavLink to="/caravans">Caravans</NavLink>
                </nav>
              </header>
              <main className="guild-main">
                <Outlet />
              </main>
            </div>
          );
        }

        function Welcome() {
          const navigate = useNavigate();

          function handleSubmit(event) {
            event.preventDefault();
            const number = new FormData(event.currentTarget).get('caravan');
            navigate('/caravans/' + number);
          }

          return (
            <section className="welcome">
              <h2>Welcome, traveller!</h2>
              <form className="track" onSubmit={handleSubmit}>
                <label>
                  Caravan number <input name="caravan" />
                </label>
                <button>Track</button>
              </form>
            </section>
          );
        }

        function CaravanList() {
          const [searchParams, setSearchParams] = useSearchParams();
          const goods = searchParams.get('goods');
          const shown = goods ? CARAVANS.filter((c) => c.goods === goods) : CARAVANS;

          return (
            <section>
              <h2>All caravans</h2>
              <div className="filters">
                <button onClick={() => setSearchParams({})}>All</button>
                <button onClick={() => setSearchParams({ goods: 'spice' })}>Spice</button>
                <button onClick={() => setSearchParams({ goods: 'silk' })}>Silk</button>
              </div>
              <ul className="caravan-list">
                {shown.map((caravan) => (
                  <li key={caravan.id}>
                    <Link to={'/caravans/' + caravan.id}>{caravan.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }

        function CaravanDetail() {
          const { id } = useParams();
          const caravan = CARAVANS.find((c) => String(c.id) === id);

          if (!caravan) return <p className="missing">No caravan #{id} on the roads.</p>;
          return (
            <article className="caravan">
              <h2>{caravan.name}</h2>
              <p>Carrying {caravan.goods}</p>
              <Link to="/caravans">← All caravans</Link>
            </article>
          );
        }

        function NotFound() {
          const { pathname } = useLocation();
          return <p className="not-found">No road leads to {pathname}</p>;
        }

        export default function App() {
          return (
            <BrowserRouter>
              <AddressBar />
              <Routes>
                <Route path="/" element={<GuildLayout />}>
                  <Route index element={<Welcome />} />
                  <Route path="caravans" element={<CaravanList />} />
                  <Route path="caravans/:id" element={<CaravanDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          );
        }
      `,
      hints: [
        md`Nest the routes: \`<Route path="/" element={<GuildLayout />}>\` … \`</Route>\` with \`<Route index element={<Welcome />} />\`, \`<Route path="caravans" …>\`, \`<Route path="caravans/:id" …>\` and \`<Route path="*" element={<NotFound />} />\` inside. Then put \`<Outlet />\` in the layout's \`<main>\`.`,
        md`In \`CaravanDetail\`: \`const { id } = useParams();\`. In \`Welcome\`: \`const navigate = useNavigate();\` and, in the submit handler, \`navigate('/caravans/' + new FormData(event.currentTarget).get('caravan'));\`.`,
        md`In \`CaravanList\`: \`const [searchParams, setSearchParams] = useSearchParams(); const goods = searchParams.get('goods');\`, then \`const shown = goods ? CARAVANS.filter((c) => c.goods === goods) : CARAVANS;\`. The buttons call \`setSearchParams({ goods: 'spice' })\`, \`setSearchParams({ goods: 'silk' })\` and \`setSearchParams({})\`.`,
      ],
      tests: [
        test('The guild layout wraps every page', (t) => {
          t.render();
          t.expect(
            t.$('.guild-header'),
            'At / there is no .guild-header. Make GuildLayout the parent route: <Route path="/" element={<GuildLayout />}> with the other routes nested inside.',
          );
          t.expect(
            t.$('.guild-main .welcome'),
            'At / the layout shows, but the Welcome page is not inside <main className="guild-main">. Render <Outlet /> there, and make Welcome the index route: <Route index element={<Welcome />} />.',
          );
          goTo(t, '/caravans');
          t.expect(t.$('.guild-header'), 'At /caravans the layout header disappeared. Nest the caravans routes inside the GuildLayout route.');
          t.expect(t.$('.guild-main .caravan-list'), 'At /caravans the caravan list should appear inside <main className="guild-main"> (through <Outlet />).');
        }),
        test('Each caravan has its own address', (t) => {
          t.render();
          const title = () => shownText(t, '.caravan h2');
          for (const [path, name] of [['/caravans/2', 'Silk Serpent'], ['/caravans/4', 'Moonlit Bolt']]) {
            goTo(t, path);
            requireOutlet(t);
            const missing = shownText(t, '.missing');
            if (missing && missing.includes('#' + path.split('/')[2]))
              t.fail(
                `At ${path} the page says "${missing}". The id arrived, but CARAVANS.find() matched nothing: params are always strings, while the ids in CARAVANS are numbers. Compare String(c.id) === id (or c.id === Number(id)).`,
              );
            t.expect(
              title() === name,
              `At ${path} the page shows ${title() ? `"${title()}"` : 'no caravan'}, expected "${name}". In CaravanDetail, read the id from the URL: const { id } = useParams(); (it's a string!).`,
            );
          }
          goTo(t, '/caravans/99');
          const missing = shownText(t, '.missing');
          t.expect(missing === 'No caravan #99 on the roads.', `At /caravans/99 expected "No caravan #99 on the roads." but found ${missing ? `"${missing}"` : 'nothing'}.`);
          goTo(t, '/caravans');
          const link = t.$$('.caravan-list a').find((a) => squish(a.textContent) === 'Amber Tortoise');
          t.expect(link, 'The caravan list should link to every caravan, e.g. "Amber Tortoise".');
          t.click(link);
          t.expect(handle(t, 'history').getPath() === '/caravans/3' && title() === 'Amber Tortoise', 'Clicking "Amber Tortoise" in the list should open /caravans/3.');
        }),
        test('The tracking form navigates in code', (t) => {
          t.render();
          requireOutlet(t);
          const input = t.$('input[name="caravan"]');
          t.expect(input, 'The Welcome page needs its <input name="caravan"> (shown at / through the layout).');
          t.type(input, '3');
          t.submit(input);
          const path = handle(t, 'history').getPath();
          t.expect(t.blockedNavigations.length === 0, 'Submitting the form reloaded the page. Keep event.preventDefault() in handleSubmit.');
          t.expect(
            path === '/caravans/3',
            `After tracking caravan 3 the address is "${path}", expected "/caravans/3". Call const navigate = useNavigate(); in Welcome, then navigate('/caravans/' + number) in handleSubmit.`,
          );
          t.expect(shownText(t, '.caravan h2') === 'Amber Tortoise', 'The address is /caravans/3, so the page should show "Amber Tortoise".');
        }),
        test('The goods filter lives in the URL', (t) => {
          const names = () => t.$$('.caravan-list li').map((li) => squish(li.textContent));
          goTo(t, '/caravans?goods=silk');
          t.render();
          requireOutlet(t);
          t.expect(
            names().join(', ') === 'Silk Serpent, Moonlit Bolt',
            `At /caravans?goods=silk the list shows [${names().join(', ')}], expected only the silk caravans [Silk Serpent, Moonlit Bolt]. Read it with const [searchParams, setSearchParams] = useSearchParams(); and searchParams.get('goods').`,
          );
          t.click(t.button('Spice'));
          const path = handle(t, 'history').getPath();
          t.expect(path === '/caravans?goods=spice', `After clicking "Spice" the address is "${path}", expected "/caravans?goods=spice". The button should call setSearchParams({ goods: 'spice' }).`);
          t.expect(names().join(', ') === 'Saffron Wind, Amber Tortoise', `With ?goods=spice the list shows [${names().join(', ')}], expected [Saffron Wind, Amber Tortoise].`);
          t.click(t.button('All'));
          const after = handle(t, 'history').getPath();
          t.expect(after === '/caravans', `After clicking "All" the address is "${after}", expected "/caravans". Call setSearchParams({}).`);
          t.expect(names().length === 4, `Without a filter all 4 caravans should be listed, found ${names().length}.`);
        }),
        test('Lost roads show the not-found page inside the layout', (t) => {
          goTo(t, '/oasis');
          t.render();
          const note = shownText(t, '.not-found');
          t.expect(note === 'No road leads to /oasis', `At /oasis expected "No road leads to /oasis" but found ${note ? `"${note}"` : 'nothing'}. Add <Route path="*" element={<NotFound />} />.`);
          t.expect(t.$('.guild-header'), 'The not-found page should keep the guild header: put the * route inside the GuildLayout route.');
        }),
      ],
      css: code`
        .address-bar { display: flex; gap: 8px; align-items: center; padding: 6px 10px; background: #292524; color: #e7e5e4; font-family: ui-monospace, monospace; font-size: 13px; border-radius: 10px 10px 0 0; }
        .address-bar button { padding: 2px 10px; }
        .address-url { flex: 1; background: #44403c; border-radius: 999px; padding: 4px 12px; }
        .address-host { color: #a8a29e; }
        .guild { background: #fffbeb; color: #451a03; border: 2px solid #f59e0b; border-top: 0; border-radius: 0 0 14px 14px; overflow: hidden; }
        .guild-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 14px; background: #fde68a; }
        .guild-header h1 { font-size: 1.2em; margin: 0; }
        .guild-header nav { display: flex; gap: 8px; }
        .guild-header a { padding: 4px 10px; border-radius: 999px; color: #92400e; font-weight: 700; text-decoration: none; }
        .guild-header a.active { background: #92400e; color: #fffbeb; }
        .guild-main { padding: 14px; }
        .filters { display: flex; gap: 6px; }
        .missing, .not-found { color: #b45309; font-style: italic; }
      `,
      concepts: [
        {
          id: 'routes-nested',
          icon: '🏛️',
          title: 'Nested routes & <Outlet />',
          summary: 'A parent route renders a layout; <Outlet /> shows the matching child route inside it.',
          snippet: code`
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="caravans/:id" element={<Caravan />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          `,
          detail: 'The layout stays mounted while you move between its children. The * route catches every path nothing else matches.',
        },
        {
          id: 'routes-router-hooks',
          icon: '🪝',
          title: 'Router hooks',
          summary: 'useParams for :params, useNavigate to navigate in code, useSearchParams for ?query state.',
          snippet: code`
            const { id } = useParams();           // always a string
            const navigate = useNavigate();       // navigate('/caravans/3')
            const [params, setParams] = useSearchParams();
            params.get('goods');                  // 'silk' or null
          `,
          detail: 'Use <Link> for links the user clicks, and navigate() only after something happens (a submit, a login, a save).',
        },
      ],
    },
    // ---------------------------------------------------------------- 3
    {
      id: 'routes-ledger',
      type: 'code',
      title: 'The Caravanserai Ledger',
      blurb: 'Build useQuery: one shared cache for server data, with dedupe and invalidation.',
      xp: 160,
      modules: marketModules,
      story: [
        { text: "The caravanserai keeps a ledger of market prices. Every clerk who wants a price sends a runner all the way to the market. Even when another runner is already on the way!", mood: 'worried' },
        { text: "And close the ledger for a second? All forgotten, start over. Let's give the whole caravanserai ONE shared memory: a query cache.", mood: 'excited' },
      ],
      lesson: md`
        ## Server state is different

        Data that comes from a server isn't like \`useState\`: you don't own it, someone else
        can change it at any moment, it's slow to get, and many components want the **same**
        piece of it. A \`useFetch\` hook that keeps a private copy in each component has
        three problems:

        1. **Duplicate requests**: two components ask for \`prices\`, so two identical requests go out.
        2. **Amnesia**: unmount and remount a component and it shows a spinner and fetches again,
           even though you saw the data a second ago.
        3. **No way to refresh**: after you *change* something on the server, nothing tells the
           components that their copy is now out of date.

        ## A query cache

        The fix is **one cache for the whole app**, outside React, keyed by a **query key**
        (\`'prices'\`, \`'caravan-1'\`). Each entry remembers everything about that query:

        \`\`\`js
        const cache = new Map();
        // 'prices' → { status: 'success', data: {...}, error: null, isFetching: false, fetcher }

        const listeners = new Set();
        function subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
        function notify() {
          listeners.forEach((listener) => listener());
        }
        \`\`\`

        It's an external store, so components read it with \`useSyncExternalStore\`, and an
        effect makes sure a request is on its way:

        \`\`\`jsx
        const EMPTY = { status: 'pending', data: undefined, error: null, isFetching: true };

        export function useQuery(key, fetcher) {
          const entry = useSyncExternalStore(subscribe, () => cache.get(key));
          useEffect(() => {
            fetchQuery(key, fetcher);
          }, [key]);
          return entry ?? EMPTY;
        }
        \`\`\`

        The effect depends on \`[key]\` only: the **key identifies the data**, so a fresh
        \`() => market.getCaravan(id)\` arrow on every render doesn't trigger a refetch. That's also
        why a key must contain everything the fetcher depends on (\`'caravan-' + id\`, not just \`'caravan'\`).

        :::mistake
        \`getSnapshot\` must return the **same object** until something changes. That's why every
        update *replaces* the entry with a new object (\`cache.set(key, { ...old, isFetching: true })\`)
        and \`getSnapshot\` simply returns \`cache.get(key)\`. Building \`{ ...entry }\` inside
        \`getSnapshot\` would be a new object on every call, and React would re-render forever.
        :::

        ## fetchQuery: the heart of it

        \`fetchQuery(key, fetcher)\` follows four rules:

        1. **Dedupe**: if the entry is already \`isFetching\`, do nothing. One runner per key.
        2. Otherwise store a new entry with \`isFetching: true\` (keeping any old \`data\`, plus
           the \`fetcher\` so you can refetch later) and \`notify()\`.
        3. Call \`fetcher()\`. When it resolves, store \`{ status: 'success', data, isFetching: false }\`;
           when it rejects, \`{ status: 'error', error, isFetching: false }\`. Then \`notify()\`.
        4. Because old \`data\` is kept while refetching, a remounted component shows the cached
           data **instantly** and refreshes it in the background. This is
           **stale-while-revalidate**.

        | Moment | \`status\` | \`isFetching\` | Screen |
        |---|---|---|---|
        | very first load | \`'pending'\` | \`true\` | spinner |
        | data arrived | \`'success'\` | \`false\` | data |
        | refetching cached data | \`'success'\` | \`true\` | data + a small "updating" hint |

        ## Invalidation

        After a **mutation** (a change on the server: buying, saving, raising a price), cached data
        is stale. \`invalidate(key)\` refetches it using the stored \`fetcher\`, and every subscribed
        component updates together.

        ## What the real libraries give you

        You've just built the core of **TanStack Query** (and **SWR**, and the data layer in
        frameworks). In a real app you'd write:

        \`\`\`jsx
        const { data, status, isFetching } = useQuery({
          queryKey: ['prices'],
          queryFn: () => fetch('/api/prices').then((res) => res.json()),
          staleTime: 30_000, // fresh for 30 s: no background refetch on mount
        });

        const queryClient = useQueryClient();
        const raise = useMutation({
          mutationFn: raisePrice,
          onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prices'] }),
        });
        \`\`\`

        On top of your four rules they add \`staleTime\` (skip refetches while data is fresh),
        garbage collection of unused entries, retries, refetching when the window regains focus
        or the network reconnects, pagination, optimistic updates, devtools and server-rendering
        support. SWR's version is \`const { data, isValidating, mutate } = useSWR('/api/prices', fetcher)\`.

        :::tip
        Don't copy server data into \`useState\` or context "to keep it around". The cache **is**
        the single source of truth: components just ask it for a key.
        :::
      `,
      task: md`
        ## 🎯 Give the caravanserai one memory

        \`market\` (from \`'market-api'\`) talks to the market; every call takes **0.3 s**.
        The cache, \`subscribe\` and \`notify\` are ready at the top of the file.

        1. **\`useQuery(key, fetcher)\`** reads the shared cache entry for \`key\` with
           \`useSyncExternalStore\` and returns \`{ status, data, error, isFetching }\`
           (\`{ status: 'pending', data: undefined, error: null, isFetching: true }\` before the first answer).
        2. **One request per key at a time**: \`PriceBoard\` and \`PriceTicker\` both use \`'prices'\`,
           so \`market.getPrices\` must be called **once**. \`'caravan-1'\` and \`'caravan-2'\` stay separate.
        3. **Cached data comes back instantly**: close and reopen the board and it shows the cached
           prices **immediately** (no "Loading prices…"), refetches in the background (\`.refreshing\`
           shows while \`isFetching\` is \`true\`) and then updates.
        4. **\`invalidate(key)\`** refetches that key with its stored fetcher. Call
           \`invalidate('prices')\` after \`market.raisePrice('silk')\` finishes, so the board and ticker
           both show **silk: 17 gold**.

        Keep the components' markup as it is.
      `,
      starter: code`
        import { useEffect, useState, useSyncExternalStore } from 'react';
        import { market } from 'market-api';

        // ---------- The shared query cache: one for the whole app ----------
        const cache = new Map(); // key → { status, data, error, isFetching, fetcher }
        const listeners = new Set();

        function subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }

        function notify() {
          listeners.forEach((listener) => listener());
        }

        // 🐛 Every component fetches on its own and keeps a private copy.
        // TODO: read the shared cache instead (and fill it with a fetchQuery helper).
        export function useQuery(key, fetcher) {
          const [entry, setEntry] = useState({ status: 'pending', data: undefined, error: null, isFetching: true });

          useEffect(() => {
            let ignore = false;
            fetcher().then(
              (data) => {
                if (!ignore) setEntry({ status: 'success', data, error: null, isFetching: false });
              },
              (error) => {
                if (!ignore) setEntry({ status: 'error', data: undefined, error, isFetching: false });
              },
            );
            return () => {
              ignore = true;
            };
          }, [key]);

          return entry;
        }

        // TODO: refetch \`key\` with the fetcher stored in its cache entry.
        export function invalidate(key) {}

        // ---------- The caravanserai ----------
        function PriceBoard() {
          const { data, status, isFetching } = useQuery('prices', market.getPrices);
          if (status === 'pending') return <p className="loading">Loading prices…</p>;
          if (status === 'error') return <p className="error">The ledger is smudged.</p>;
          return (
            <div className="board">
              <h3>
                Price board {isFetching && <span className="refreshing">↻ updating</span>}
              </h3>
              <ul>
                {Object.entries(data).map(([item, price]) => (
                  <li key={item}>{item}: {price} gold</li>
                ))}
              </ul>
            </div>
          );
        }

        function PriceTicker() {
          const { data } = useQuery('prices', market.getPrices);
          return <p className="ticker">📈 Silk: {data ? data.silk + ' gold' : '…'}</p>;
        }

        function CaravanCard({ id }) {
          const { data, status } = useQuery('caravan-' + id, () => market.getCaravan(id));
          return <li className="caravan-card">{status === 'success' ? \`\${data.name} (\${data.cargo})\` : 'Scouting…'}</li>;
        }

        export default function App() {
          const [boardOpen, setBoardOpen] = useState(true);
          const [trading, setTrading] = useState(false);

          async function raiseSilk() {
            setTrading(true);
            await market.raisePrice('silk');
            setTrading(false);
            // TODO: the cached prices are stale now
          }

          return (
            <div className="ledger">
              <PriceTicker />
              <div className="actions">
                <button onClick={() => setBoardOpen(!boardOpen)}>{boardOpen ? 'Close board' : 'Open board'}</button>
                <button onClick={raiseSilk} disabled={trading}>
                  {trading ? 'Trading…' : 'Raise silk price'}
                </button>
              </div>
              {boardOpen && <PriceBoard />}
              <ul className="caravans">
                <CaravanCard id={1} />
                <CaravanCard id={2} />
              </ul>
            </div>
          );
        }
      `,
      solution: code`
        import { useEffect, useState, useSyncExternalStore } from 'react';
        import { market } from 'market-api';

        // ---------- The shared query cache: one for the whole app ----------
        const cache = new Map(); // key → { status, data, error, isFetching, fetcher }
        const listeners = new Set();

        function subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }

        function notify() {
          listeners.forEach((listener) => listener());
        }

        const EMPTY = { status: 'pending', data: undefined, error: null, isFetching: true };

        function fetchQuery(key, fetcher) {
          const entry = cache.get(key) ?? EMPTY;
          if (cache.has(key) && entry.isFetching) return; // a runner is already on the way
          cache.set(key, { ...entry, isFetching: true, fetcher });
          notify();
          fetcher().then(
            (data) => {
              cache.set(key, { ...cache.get(key), status: 'success', data, error: null, isFetching: false });
              notify();
            },
            (error) => {
              cache.set(key, { ...cache.get(key), status: 'error', error, isFetching: false });
              notify();
            },
          );
        }

        export function useQuery(key, fetcher) {
          const entry = useSyncExternalStore(subscribe, () => cache.get(key));
          useEffect(() => {
            fetchQuery(key, fetcher);
          }, [key]);
          return entry ?? EMPTY;
        }

        export function invalidate(key) {
          const entry = cache.get(key);
          if (entry) fetchQuery(key, entry.fetcher);
        }

        // ---------- The caravanserai ----------
        function PriceBoard() {
          const { data, status, isFetching } = useQuery('prices', market.getPrices);
          if (status === 'pending') return <p className="loading">Loading prices…</p>;
          if (status === 'error') return <p className="error">The ledger is smudged.</p>;
          return (
            <div className="board">
              <h3>
                Price board {isFetching && <span className="refreshing">↻ updating</span>}
              </h3>
              <ul>
                {Object.entries(data).map(([item, price]) => (
                  <li key={item}>{item}: {price} gold</li>
                ))}
              </ul>
            </div>
          );
        }

        function PriceTicker() {
          const { data } = useQuery('prices', market.getPrices);
          return <p className="ticker">📈 Silk: {data ? data.silk + ' gold' : '…'}</p>;
        }

        function CaravanCard({ id }) {
          const { data, status } = useQuery('caravan-' + id, () => market.getCaravan(id));
          return <li className="caravan-card">{status === 'success' ? \`\${data.name} (\${data.cargo})\` : 'Scouting…'}</li>;
        }

        export default function App() {
          const [boardOpen, setBoardOpen] = useState(true);
          const [trading, setTrading] = useState(false);

          async function raiseSilk() {
            setTrading(true);
            await market.raisePrice('silk');
            setTrading(false);
            invalidate('prices');
          }

          return (
            <div className="ledger">
              <PriceTicker />
              <div className="actions">
                <button onClick={() => setBoardOpen(!boardOpen)}>{boardOpen ? 'Close board' : 'Open board'}</button>
                <button onClick={raiseSilk} disabled={trading}>
                  {trading ? 'Trading…' : 'Raise silk price'}
                </button>
              </div>
              {boardOpen && <PriceBoard />}
              <ul className="caravans">
                <CaravanCard id={1} />
                <CaravanCard id={2} />
              </ul>
            </div>
          );
        }
      `,
      hints: [
        md`Replace the body of \`useQuery\` with \`const entry = useSyncExternalStore(subscribe, () => cache.get(key));\`, an effect that calls a new \`fetchQuery(key, fetcher)\` helper (deps \`[key]\`), and \`return entry ?? EMPTY;\` where \`EMPTY\` is the "pending" object defined **outside** the hook.`,
        md`\`fetchQuery\`: \`const entry = cache.get(key) ?? EMPTY;\` If \`cache.has(key) && entry.isFetching\`, return (dedupe!). Otherwise \`cache.set(key, { ...entry, isFetching: true, fetcher }); notify();\` then call \`fetcher()\`.`,
        md`When \`fetcher()\` resolves: \`cache.set(key, { ...cache.get(key), status: 'success', data, error: null, isFetching: false }); notify();\` (similar for errors). \`invalidate(key)\` is \`const entry = cache.get(key); if (entry) fetchQuery(key, entry.fetcher);\`, and \`raiseSilk\` calls \`invalidate('prices')\` after the \`await\`.`,
      ],
      tests: [
        test('Components sharing a key share one request', async (t) => {
          await openLedger(t);
          const calls = callCount(t, 'getPrices');
          t.expect(
            calls === 1,
            `market.getPrices was called ${calls} times, but PriceBoard and PriceTicker both ask for the same key 'prices'. Keep one entry per key in the shared cache, and skip fetching when that entry is already isFetching.`,
          );
          t.expect(boardSilk(t) === 'silk: 12 gold', `The board shows "${boardSilk(t)}", expected "silk: 12 gold".`);
          const ticker = shownText(t, '.ticker');
          t.expect(ticker === '📈 Silk: 12 gold', `The ticker shows "${ticker}", expected "📈 Silk: 12 gold". It reads the same 'prices' entry as the board.`);
        }),
        test('Different keys never collide', async (t) => {
          await openLedger(t);
          const cards = t.$$('.caravan-card').map((li) => squish(li.textContent));
          t.expect(
            cards.join(' | ') === 'Saffron Wind (spice) | Silk Serpent (silk)',
            `The caravan cards show [${cards.join(' | ')}], expected [Saffron Wind (spice) | Silk Serpent (silk)]. Each key ('caravan-1', 'caravan-2') needs its own cache entry.`,
          );
          const c1 = callCount(t, 'getCaravan:1');
          const c2 = callCount(t, 'getCaravan:2');
          t.expect(c1 === 1 && c2 === 1, `Each caravan should be fetched exactly once (caravan 1: ${c1} times, caravan 2: ${c2} times).`);
        }),
        test('Cached data comes back instantly, then refreshes', async (t) => {
          await openLedger(t);
          t.click(t.button('Close board'));
          t.click(t.button('Open board'));
          t.expect(
            t.$('.board') && !t.$('.loading'),
            'Reopening the board showed "Loading prices…" again. The prices are already in the cache: useQuery should return that cached entry right away (status stays \'success\' while it refetches).',
          );
          t.expect(boardSilk(t) === 'silk: 12 gold', `The reopened board shows "${boardSilk(t)}", expected the cached "silk: 12 gold".`);
          const calls = callCount(t, 'getPrices');
          t.expect(
            calls === 2,
            `Reopening the board should refetch 'prices' once in the background (getPrices calls: ${calls}, expected 2). Call fetchQuery from useQuery's effect on mount, keeping the old data in the entry.`,
          );
          t.expect(t.$('.refreshing'), 'While the background refetch runs, isFetching should be true, so the board shows "↻ updating".');
          await t.tick(300);
          await t.flush();
          t.expect(!t.$('.refreshing'), 'When the refetch finishes, isFetching should go back to false and "↻ updating" should disappear.');
        }),
        test('invalidate refetches after a trade', async (t) => {
          await openLedger(t);
          t.click(t.button('Raise silk price'));
          await t.tick(300);
          await t.flush();
          await t.tick(300);
          await t.flush();
          t.expect(
            boardSilk(t) === 'silk: 17 gold',
            `After the trade the board still shows "${boardSilk(t)}", expected "silk: 17 gold". Call invalidate('prices') after market.raisePrice('silk') finishes, and make invalidate refetch the key with the fetcher stored in its cache entry.`,
          );
          const calls = callCount(t, 'getPrices');
          t.expect(calls === 2, `After the trade, getPrices was called ${calls} time(s) in total, expected 2 (the first load + one refetch for both components).`);
          const ticker = shownText(t, '.ticker');
          t.expect(ticker === '📈 Silk: 17 gold', `After the trade the ticker shows "${ticker}", expected "📈 Silk: 17 gold". Both read the same cache entry, so one refetch updates both.`);
        }),
      ],
      css: code`
        .ledger { padding: 14px; border-radius: 14px; background: #fffbeb; color: #451a03; border: 2px solid #f59e0b; }
        .ticker { margin: 0 0 8px; font-weight: 700; }
        .actions { display: flex; gap: 8px; margin-bottom: 8px; }
        .board { padding: 8px 12px; border-radius: 10px; background: #fde68a; }
        .board h3 { margin: 0; }
        .refreshing { margin-left: 6px; font-size: 0.7em; color: #b45309; }
        .loading { color: #b45309; font-style: italic; }
        .caravans { padding-left: 18px; }
      `,
      concepts: [
        {
          id: 'routes-query-cache',
          icon: '🗃️',
          title: 'Query cache',
          summary: 'One shared, keyed cache for server data: dedupe requests, show cached data, refetch in the background.',
          snippet: code`
            const { data, status, isFetching } = useQuery('prices', market.getPrices);
            // later, after a change on the server:
            invalidate('prices');
          `,
          detail: 'status says whether you have data at all; isFetching says whether a request is running. Stale-while-revalidate shows the old data while new data loads.',
        },
        {
          id: 'routes-tanstack-query',
          icon: '🌸',
          title: 'TanStack Query & SWR',
          summary: 'Libraries that give you useQuery with caching, dedupe, invalidation, retries and more.',
          snippet: code`
            useQuery({ queryKey: ['prices'], queryFn: fetchPrices, staleTime: 30_000 });
            queryClient.invalidateQueries({ queryKey: ['prices'] });
          `,
          detail: 'Reach for one (or your framework\'s data loading) instead of hand-written fetch effects in real apps.',
        },
      ],
    },
    // ---------------------------------------------------------------- 4
    {
      id: 'routes-mirage',
      type: 'bug',
      title: 'The Mirage Oasis',
      blurb: 'Bug hunt! The server and the browser see different oases. Fix the hydration mismatches.',
      xp: 150,
      story: [
        { text: "An oasis! Or... is it? The page arrives from the server looking one way, then the browser draws something else on top. A mirage!", mood: 'thinking' },
        { text: "The preview only ever renders in the browser, so it looks fine there. The checks play BOTH machines: server first, then the browser hydrating its HTML. Three things in this file can't agree. Find them!", mood: 'excited' },
      ],
      lesson: md`
        ## Two renders on two machines

        With **server-side rendering (SSR)**, your components run twice:

        1. **On the server**, React renders them to HTML (\`renderToString\`, or the streaming
           \`renderToPipeableStream\`; frameworks like Next.js and React Router do this for you).
           The user sees real content before any JavaScript has loaded. Great for speed and
           search engines.
        2. **In the browser**, the JavaScript arrives and React **hydrates** that HTML:

           \`\`\`jsx
           import { hydrateRoot } from 'react-dom/client';
           hydrateRoot(document.getElementById('root'), <App />);
           \`\`\`

           Instead of building the DOM from scratch, React renders your components again and
           **adopts** the existing HTML, attaching event handlers to it.

        For that to work, the browser's **first render must produce exactly the same output as
        the server's**. Anything that differs between the two machines breaks the deal:

        | Differs because… | Examples |
        |---|---|
        | time passes | \`new Date()\`, \`Date.now()\` |
        | randomness | \`Math.random()\`, \`crypto.randomUUID()\` |
        | only the browser has it | \`localStorage\`, \`window.innerWidth\`, \`navigator.language\` |
        | code that checks where it runs | \`typeof window !== 'undefined' ? … : …\` |

        ## What a mismatch costs

        - **Different text**: React reports a recoverable error ("Hydration failed because the
          server rendered text didn't match the client"), **throws away** the server's HTML up to
          the nearest \`<Suspense>\` boundary and renders it again on the client. Slower, it can
          flicker, and you lose what SSR bought you.
        - **Different attributes**: only a development warning, and the attribute is **not
          patched**: the DOM keeps the server's value. A \`<label htmlFor>\` can silently point at
          the wrong \`id\`.

        ## The fixes

        **1. Render the server-safe version first, then switch in an effect.** Effects never run
        on the server, and they run *after* hydration in the browser:

        \`\`\`jsx
        const [now, setNow] = useState(null);
        useEffect(() => {
          setNow(new Date());
          const id = setInterval(() => setNow(new Date()), 60_000);
          return () => clearInterval(id);
        }, []);
        return <p>{now ? formatTime(now) : '--:--'}</p>;
        \`\`\`

        **2. Give \`useSyncExternalStore\` a \`getServerSnapshot\`.** Its third argument is used on
        the server *and during hydration*; afterwards React switches to the real snapshot:

        \`\`\`jsx
        const theme = useSyncExternalStore(
          subscribe,
          () => localStorage.getItem('theme'), // in the browser
          () => null,                           // on the server and while hydrating
        );
        \`\`\`

        **3. Use \`useId()\` for ids.** It builds an id from the component's position in the tree,
        so the server and the browser compute the **same** one, and two instances get **different** ones:

        \`\`\`jsx
        const id = useId();
        return <><label htmlFor={id}>Name</label><input id={id} /></>;
        \`\`\`

        **4. \`suppressHydrationWarning\`** on one element silences a text mismatch *one level deep*
        (e.g. a timestamp). React keeps the **server's** text, so use it only when that's fine.

        :::mistake
        \`useState(() => localStorage.getItem('x'))\` doesn't help: the initializer runs during the
        browser's first render, which *is* the hydration render. Same for
        \`typeof window !== 'undefined'\` checks during render: the server picks one branch and the
        browser the other, which is the textbook mismatch.
        :::

        :::tip
        **How the checks simulate SSR:** they render your component to HTML with
        \`renderToString\` (the "server": 09:00, nothing in storage), let five minutes pass, store
        a favourite road (the browser has \`localStorage\`!), and then call \`hydrateRoot\` on that
        HTML, exactly what a server-rendered app does.
        :::
      `,
      task: md`
        ## 🐛 Make server and browser agree

        Fix the three mirages. Each must hydrate **without a mismatch**:

        1. **\`OasisClock\`** renders \`new Date()\` straight away. Render \`🕰️ Oasis time: --:--\` on
           the server and during hydration, then show the browser's current time (e.g. **09:05**)
           right after hydrating: keep the time in state, set it in an effect. (Updating it every
           minute with \`setInterval\` is a nice bonus; clean it up!)
        2. **\`RoadSignup\`** makes its id with \`Math.random()\`, so the server and the browser
           disagree. Use \`useId()\`: each signup's \`<label htmlFor>\` must match its own
           \`<input id>\`, and the two signups need **different** ids.
        3. **\`FavouriteRoad\`** reads \`localStorage\` while rendering, but the server has no storage.
           Render "⭐ Pick a favourite road!" on the server and during hydration, then
           "⭐ Your road: Silk Road" once the browser has read \`'favourite-road'\` (in an effect, or
           with \`useSyncExternalStore\` + a \`getServerSnapshot\`).

        Keep the components exported with these names.
      `,
      starter: code`
        import { useEffect, useId, useState } from 'react';

        // Caravan time is kept in UTC: "09:05"
        function formatTime(date) {
          return date.toISOString().slice(11, 16);
        }

        export function OasisClock() {
          const now = new Date();
          return <p className="clock">🕰️ Oasis time: {formatTime(now)}</p>;
        }

        export function RoadSignup({ road }) {
          const id = 'road-' + Math.random().toString(36).slice(2);
          return (
            <div className="signup">
              <label htmlFor={id}>Join the {road} caravan</label>
              <input id={id} placeholder="Your name" />
            </div>
          );
        }

        export function FavouriteRoad() {
          const favourite = localStorage.getItem('favourite-road');
          return (
            <p className="favourite">
              ⭐ {favourite ? 'Your road: ' + favourite : 'Pick a favourite road!'}
            </p>
          );
        }

        export default function App() {
          return (
            <div className="oasis">
              <h1>The Mirage Oasis</h1>
              <OasisClock />
              <FavouriteRoad />
              <RoadSignup road="Silk" />
              <RoadSignup road="Spice" />
            </div>
          );
        }
      `,
      solution: code`
        import { useEffect, useId, useState } from 'react';

        // Caravan time is kept in UTC: "09:05"
        function formatTime(date) {
          return date.toISOString().slice(11, 16);
        }

        export function OasisClock() {
          const [now, setNow] = useState(null); // the server has no "now" to agree on

          useEffect(() => {
            setNow(new Date());
            const id = setInterval(() => setNow(new Date()), 60 * 1000);
            return () => clearInterval(id);
          }, []);

          return <p className="clock">🕰️ Oasis time: {now ? formatTime(now) : '--:--'}</p>;
        }

        export function RoadSignup({ road }) {
          const id = useId();
          return (
            <div className="signup">
              <label htmlFor={id}>Join the {road} caravan</label>
              <input id={id} placeholder="Your name" />
            </div>
          );
        }

        export function FavouriteRoad() {
          const [favourite, setFavourite] = useState(null);

          useEffect(() => {
            setFavourite(localStorage.getItem('favourite-road'));
          }, []);

          return (
            <p className="favourite">
              ⭐ {favourite ? 'Your road: ' + favourite : 'Pick a favourite road!'}
            </p>
          );
        }

        export default function App() {
          return (
            <div className="oasis">
              <h1>The Mirage Oasis</h1>
              <OasisClock />
              <FavouriteRoad />
              <RoadSignup road="Silk" />
              <RoadSignup road="Spice" />
            </div>
          );
        }
      `,
      hints: [
        md`Everything the server can't know must wait until **after** hydration. Effects never run on the server, so they're the place: start with \`useState(null)\`, render a placeholder while it's \`null\`, and fill it in \`useEffect\`.`,
        md`\`RoadSignup\`: replace the \`Math.random()\` line with \`const id = useId();\`. \`FavouriteRoad\`: \`const [favourite, setFavourite] = useState(null);\` and \`useEffect(() => { setFavourite(localStorage.getItem('favourite-road')); }, []);\`.`,
        md`\`OasisClock\`: \`const [now, setNow] = useState(null);\`, \`useEffect(() => { setNow(new Date()); }, []);\` and render \`{now ? formatTime(now) : '--:--'}\`.`,
      ],
      tests: [
        test('The clock hydrates, then shows the browser\'s time', async (t) => {
          const clock = t.exports.OasisClock;
          t.expect(typeof clock === 'function', 'Keep exporting the OasisClock component: export function OasisClock() { … }');
          const run = await serverThenBrowser(t, t.h(clock), () => t.tick(FIVE_MINUTES));
          try {
            const problems = run.mismatches();
            t.expect(
              problems.length === 0,
              `Hydration failed! The server's HTML said "${squish(run.html.replace(/<[^>]+>/g, ' '))}", but five minutes later the browser rendered a different time. React threw the server's HTML away: "${firstLine(problems[0])}". Render "--:--" first and set the real time in an effect.`,
            );
            const shown = run.text('.clock');
            t.expect(
              shown === '🕰️ Oasis time: 09:05',
              `Right after hydrating, the clock reads "${shown}", expected the browser's time "🕰️ Oasis time: 09:05". ${/09:00/.test(shown || '') ? 'suppressHydrationWarning only hides the mismatch and keeps the server\'s stale text. ' : ''}Set the time in an effect (setNow(new Date())) so it updates as soon as the page has hydrated.`,
            );
            t.expect(
              /--:--/.test(run.html),
              `The server rendered "${squish(run.html.replace(/<[^>]+>/g, ' '))}". The server can't know the browser's time: render "🕰️ Oasis time: --:--" until an effect has run.`,
            );
          } finally {
            run.cleanup();
          }
        }),
        test('Each signup\'s label matches its own input, on both machines', async (t) => {
          const Signup = t.exports.RoadSignup;
          t.expect(typeof Signup === 'function', 'Keep exporting the RoadSignup component: export function RoadSignup({ road }) { … }');
          const pair = t.h('div', null, t.h(Signup, { road: 'Silk' }), t.h(Signup, { road: 'Spice' }));
          const run = await serverThenBrowser(t, pair);
          try {
            const problems = run.mismatches();
            t.expect(
              problems.length === 0,
              `The browser computed different ids than the server: "${firstLine(problems[0])}" Attributes are never patched, so the page keeps the server's ids while React thinks it has others. Generate the id with useId(), which gives the same id on both machines.`,
            );
            const labels = Array.from(run.box.querySelectorAll('label'));
            const inputs = Array.from(run.box.querySelectorAll('input'));
            t.expect(labels.length === 2 && inputs.length === 2, 'Each RoadSignup should render one <label> and one <input>.');
            labels.forEach((label, i) => {
              t.expect(
                label.htmlFor && label.htmlFor === inputs[i].id,
                `The ${i === 0 ? 'Silk' : 'Spice'} signup's <label htmlFor="${label.htmlFor}"> doesn't match its <input id="${inputs[i].id}">. Use the same id variable for both.`,
              );
            });
            t.expect(inputs[0].id !== inputs[1].id, `Both signups use the id "${inputs[0].id}". Ids must be unique on the page: useId() gives every component instance its own.`);
          } finally {
            run.cleanup();
          }
        }),
        test('The favourite road waits for the browser\'s storage', async (t) => {
          const Favourite = t.exports.FavouriteRoad;
          t.expect(typeof Favourite === 'function', 'Keep exporting the FavouriteRoad component: export function FavouriteRoad() { … }');
          const run = await serverThenBrowser(t, t.h(Favourite), async () => {
            t.storage.setItem('favourite-road', 'Silk Road');
          });
          try {
            const problems = run.mismatches();
            t.expect(
              problems.length === 0,
              `Hydration failed: the server (no storage) rendered "Pick a favourite road!", but the browser's first render read "Silk Road" from localStorage. "${firstLine(problems[0])}" Read localStorage in an effect (or with useSyncExternalStore and a getServerSnapshot that returns null).`,
            );
            const shown = run.text('.favourite');
            t.expect(
              shown === '⭐ Your road: Silk Road',
              `After hydrating, the favourite reads "${shown}", expected "⭐ Your road: Silk Road". Once the page has hydrated, read 'favourite-road' from localStorage and show it.`,
            );
          } finally {
            run.cleanup();
          }
        }),
        test('The whole oasis hydrates cleanly', async (t) => {
          const run = await serverThenBrowser(t, t.h(t.App), async () => {
            await t.tick(FIVE_MINUTES);
            t.storage.setItem('favourite-road', 'Silk Road');
          });
          try {
            const problems = run.mismatches();
            t.expect(problems.length === 0, `Hydrating the whole App still reports a mismatch: "${firstLine(problems[0])}"`);
            t.expect(run.text('h1') === 'The Mirage Oasis', 'App should still render the <h1>The Mirage Oasis</h1> with the clock, the favourite and both signups.');
            t.expect(run.text('.clock') === '🕰️ Oasis time: 09:05' && run.text('.favourite') === '⭐ Your road: Silk Road', 'After hydrating, App should show the browser\'s time and favourite road.');
            t.expect(run.box.querySelectorAll('.signup').length === 2, 'App should render both RoadSignups (Silk and Spice).');
          } finally {
            run.cleanup();
          }
        }),
      ],
      css: code`
        .oasis { padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #fde68a, #fbbf24); color: #451a03; text-align: center; }
        .oasis h1 { margin-top: 0; }
        .clock, .favourite { font-weight: 700; }
        .signup { display: flex; gap: 8px; justify-content: center; align-items: center; margin: 8px 0; }
      `,
      concepts: [
        {
          id: 'routes-hydration',
          icon: '💧',
          title: 'Hydration',
          summary: 'The browser re-renders server HTML and adopts it; its first render must match the server exactly.',
          snippet: code`
            // server: renderToString(<App />) → HTML
            // browser:
            hydrateRoot(document.getElementById('root'), <App />);
          `,
          detail: 'Text mismatches make React throw the server HTML away and re-render; attribute mismatches are never patched. Time, randomness and browser-only APIs are the usual culprits.',
        },
        {
          id: 'routes-hydration-safe',
          icon: '🛡️',
          title: 'Hydration-safe patterns',
          summary: 'Browser-only values go in effects (or useSyncExternalStore with getServerSnapshot); ids come from useId.',
          snippet: code`
            const [now, setNow] = useState(null);
            useEffect(() => setNow(new Date()), []);
            const id = useId();
          `,
          detail: 'suppressHydrationWarning silences one element\'s text mismatch but keeps the server\'s text: an escape hatch, not a fix.',
        },
      ],
    },
    // ---------------------------------------------------------------- 5
    {
      id: 'routes-bazaar',
      type: 'code',
      title: 'The Streaming Bazaar',
      blurb: 'Stream a Server Component page with nested Suspense, and send only plain data across the client boundary.',
      xp: 160,
      modules: bazaarModules,
      story: [
        { text: "The Grand Bazaar is run from a palace far away: the server. It sends the market out piece by piece, as each stall gets ready.", mood: 'thinking' },
        { text: "But right now the whole bazaar waits for the slowest stall, and the server keeps trying to post things that can't travel: whole merchants and loose functions! Let's sort out what crosses the border.", mood: 'excited' },
      ],
      lesson: md`
        ## Server Components, in practice

        Back in the Arcane Spire you met **Server Components**: they run only on the server and
        send their *result* to the browser, while **Client Components** (\`'use client'\`) ship their
        code and can use state and events. Now let's practise the rules that trip people up.
        A typical page in a framework like Next.js looks like this:

        \`\`\`
        app/bazaar/page.jsx       ← Server Component (the default: no directive)
        app/bazaar/StallCard.jsx  ← 'use client' (it has state and a form)
        app/bazaar/Curtain.jsx    ← 'use client' (it has a toggle)
        app/bazaar/actions.js     ← 'use server' (every export is a Server Function)
        lib/db.js                 ← server-only code
        \`\`\`

        ## Async components and streaming

        A Server Component can be \`async\` and simply \`await\` its data:

        \`\`\`jsx
        async function Stalls() {
          const stalls = await db.stalls();
          return <ul>{stalls.map((s) => <li key={s.id}>{s.name}</li>)}</ul>;
        }
        \`\`\`

        The server **streams**: it sends the page shell at once, then each \`<Suspense>\` boundary's
        content the moment its data is ready, replacing the fallback. Boundaries **nest**: an
        inner boundary can only appear once the section around it has arrived, so pages reveal
        from the outside in.

        \`\`\`jsx
        <Suspense fallback={<p>Setting up stalls…</p>}>
          <Stalls>                        {/* arrives first */}
            <Suspense fallback={<p>Listening for rumours…</p>}>
              <Rumours />                 {/* streams in later, on its own */}
            </Suspense>
          </Stalls>
        </Suspense>
        \`\`\`

        :::story
        **In this quest:** the sandbox has no real server, so your file *plays* \`page.jsx\`, and
        \`use(db.stalls())\` plays \`await db.stalls()\`. The \`db\` functions are wrapped like React's
        server-only \`cache()\`: the same call returns the **same** promise for the whole request,
        so reading them during render is safe here (unlike a fresh \`fetch\`!). The db starts every
        query when the request arrives: stalls take **0.5 s**, rumours **1.5 s**.
        :::

        ## Props that cross the boundary must be serialisable

        When a Server Component renders a Client Component, its props are **sent over the network**.
        Only things that can be serialised may cross:

        | ✅ Can cross | ❌ Can't cross |
        |---|---|
        | strings, numbers, booleans, \`null\`, \`undefined\` | ordinary functions (event handlers, callbacks) |
        | plain objects and arrays of those | class instances (e.g. database rows with methods) |
        | \`Date\`, \`Map\`, \`Set\`, typed arrays, promises | |
        | JSX (already rendered on the server) | symbols (except global \`Symbol.for(…)\` ones) |
        | Server Functions (\`'use server'\`) | |

        The fix is usually to pick the fields you need:

        \`\`\`jsx
        <StallCard stall={{ id: stall.id, name: stall.name, price: stall.price }} />
        \`\`\`

        That's also a **security** habit: everything in those props ends up in the browser. Never
        pass a whole \`user\` row that holds a \`passwordHash\`!

        ## Server Functions

        A function can't travel... unless it's a **Server Function**. Files that start with
        \`'use server'\` export functions the browser can *call*, as a network request:

        \`\`\`js
        // actions.js
        'use server';
        export async function buyGoods(prevState, formData) {
          const stall = await db.findStall(formData.get('stallId'));
          if (!stall) return 'That stall does not exist.';
          // …check who is buying, then save…
          return \`Bought \${stall.name} for \${stall.price} gold\`;
        }
        \`\`\`

        Pass it to a Client Component and use it as a form action, with \`useActionState\` as you
        did in the Spire.

        :::warn
        A Server Function is a **public endpoint**: anyone can call it with any data, not just
        your form. Validate the input and check permissions *inside* every one.
        :::

        ## Server content inside Client Components

        A \`'use client'\` file can't *import* a Server Component (the import would turn it into
        client code). But it can **receive** server-rendered JSX as \`children\`:

        \`\`\`jsx
        <Curtain title="rumours">     {/* client: owns the open/closed state */}
          <Rumours />                 {/* server: rendered on the server, passed in */}
        </Curtain>
        \`\`\`

        :::tip
        Push \`'use client'\` **down to the leaves**: keep pages and layouts as Server Components and
        mark only the small interactive parts. Less JavaScript ships, and data stays on the server.
        :::
      `,
      task: md`
        ## 🎯 Open the bazaar

        Your file plays \`page.jsx\`, a Server Component. \`StallCard\` and \`Curtain\` come from
        \`'use client'\` files, \`buyGoods\` from a \`'use server'\` file.

        1. **Stream the stalls**: wrap \`<Stalls />\` in \`<Suspense>\` with the fallback
           \`<p className="loading">Setting up stalls…</p>\`, so the \`<h1>\` shows at once.
        2. **Plain data only**: \`StallCard\`'s \`stall\` prop must be a plain object
           \`{ id, name, price }\`, not the \`Stall\` class instance from the db.
        3. **A Server Function, not a function**: pass \`buy={buyGoods}\` instead of the inline arrow.
        4. **Rumours stream in separately**: inside \`.stalls-section\`, below the list, render
           \`<Curtain title="rumours">\` with a **nested** \`<Suspense>\`
           (fallback \`<p className="loading">Listening for rumours…</p>\`) around \`<Rumours />\` as its children.

        Timeline: \`h1\` + "Setting up stalls…" → at 0.5 s the stalls + "Listening for rumours…" → at
        1.5 s the rumours.
      `,
      starter: code`
        import { Suspense, use } from 'react';
        import { db } from './db.js';
        import { buyGoods } from './actions.js'; // 'use server'
        import StallCard from './StallCard.jsx'; // 'use client'
        import Curtain from './Curtain.jsx'; // 'use client'

        // This file plays a Server Component file (page.jsx).
        // use(db.stalls()) plays the part of: const stalls = await db.stalls();

        function Rumours() {
          const rumours = use(db.rumours());
          return (
            <ul className="rumours">
              {rumours.map((rumour) => (
                <li key={rumour}>🗣️ {rumour}</li>
              ))}
            </ul>
          );
        }

        function Stalls() {
          const stalls = use(db.stalls());
          return (
            <section className="stalls-section">
              <ul className="stalls">
                {stalls.map((stall) => (
                  <StallCard
                    key={stall.id}
                    stall={stall}
                    buy={async (prevState, formData) => 'Bought ' + stall.name}
                  />
                ))}
              </ul>
              {/* TODO: <Curtain title="rumours"> with a nested Suspense around <Rumours /> */}
            </section>
          );
        }

        export default function Bazaar() {
          return (
            <div className="bazaar">
              <h1>The Grand Bazaar</h1>
              {/* TODO: stream the stalls in with a Suspense boundary */}
              <Stalls />
            </div>
          );
        }
      `,
      solution: code`
        import { Suspense, use } from 'react';
        import { db } from './db.js';
        import { buyGoods } from './actions.js'; // 'use server'
        import StallCard from './StallCard.jsx'; // 'use client'
        import Curtain from './Curtain.jsx'; // 'use client'

        // This file plays a Server Component file (page.jsx).
        // use(db.stalls()) plays the part of: const stalls = await db.stalls();

        function Rumours() {
          const rumours = use(db.rumours());
          return (
            <ul className="rumours">
              {rumours.map((rumour) => (
                <li key={rumour}>🗣️ {rumour}</li>
              ))}
            </ul>
          );
        }

        function Stalls() {
          const stalls = use(db.stalls());
          return (
            <section className="stalls-section">
              <ul className="stalls">
                {stalls.map((stall) => (
                  <StallCard
                    key={stall.id}
                    stall={{ id: stall.id, name: stall.name, price: stall.price }}
                    buy={buyGoods}
                  />
                ))}
              </ul>
              <Curtain title="rumours">
                <Suspense fallback={<p className="loading">Listening for rumours…</p>}>
                  <Rumours />
                </Suspense>
              </Curtain>
            </section>
          );
        }

        export default function Bazaar() {
          return (
            <div className="bazaar">
              <h1>The Grand Bazaar</h1>
              <Suspense fallback={<p className="loading">Setting up stalls…</p>}>
                <Stalls />
              </Suspense>
            </div>
          );
        }
      `,
      hints: [
        md`Start with the outer boundary in \`Bazaar\`: \`<Suspense fallback={<p className="loading">Setting up stalls…</p>}><Stalls /></Suspense>\`. Then read the error StallCard reports: it names the prop that can't cross.`,
        md`Pass a plain object, \`stall={{ id: stall.id, name: stall.name, price: stall.price }}\`, and the Server Function itself: \`buy={buyGoods}\`.`,
        md`Below the \`<ul className="stalls">\`, add \`<Curtain title="rumours"><Suspense fallback={<p className="loading">Listening for rumours…</p>}><Rumours /></Suspense></Curtain>\`.`,
      ],
      tests: [
        test('The page shell appears at once', async (t) => {
          await openBazaar(t);
          t.expect(shownText(t, 'h1') === 'The Grand Bazaar', 'The <h1>The Grand Bazaar</h1> should be on screen immediately.');
          const loading = shownText(t, '.loading');
          t.expect(
            loading === 'Setting up stalls…',
            `While the stalls load, expected the fallback "Setting up stalls…" but found ${loading ? `"${loading}"` : 'none'}. Wrap <Stalls /> in <Suspense fallback={<p className="loading">Setting up stalls…</p>}>.`,
          );
        }),
        test('Only plain data and Server Functions cross into StallCard', async (t) => {
          await openBazaar(t, 500);
          const names = t.$$('.stall-name').map((el) => squish(el.textContent));
          t.expect(
            names.join(', ') === 'Saffron, Silk, Amber',
            `After 0.5 s the stalls should show [Saffron, Silk, Amber], found [${names.join(', ')}].${names.length ? '' : ' They are still hidden: if the rumours share the stalls\' <Suspense> boundary, the whole section waits 1.5 s for them. Give <Rumours /> its own, nested boundary.'}`,
          );
          const prices = t.$$('.stall-price').map((el) => squish(el.textContent));
          t.expect(prices[0] === '12 gold', `The first stall's price reads "${prices[0]}", expected "12 gold". Pass { id, name, price } in the stall object.`);
        }),
        test('Stalls stream in first while rumours keep loading', async (t) => {
          await openBazaar(t, 500);
          const stalls = t.$$('.stall').filter(isShown).length;
          t.expect(stalls === 3, `At 0.5 s, ${stalls} stalls are visible, expected 3. The stalls should not wait for the slower rumours: give the rumours their own, nested <Suspense>.`);
          const curtain = t.$('.stalls-section .curtain');
          t.expect(curtain, 'Below the stalls list, inside .stalls-section, render <Curtain title="rumours"> … </Curtain>.');
          const waiting = t.$$('.curtain .loading').find(isShown);
          t.expect(
            waiting && squish(waiting.textContent) === 'Listening for rumours…',
            'While the rumours load, the curtain should show the fallback "Listening for rumours…": put <Suspense fallback={<p className="loading">Listening for rumours…</p>}> around <Rumours /> inside the Curtain.',
          );
        }),
        test('Rumours arrive last, behind an interactive curtain', async (t) => {
          await openBazaar(t, 1500);
          const rumours = t.$$('.curtain .rumours li').filter(isShown);
          t.expect(rumours.length === 2, `At 1.5 s, ${rumours.length} rumours are visible inside the .curtain, expected 2. Pass <Suspense><Rumours /></Suspense> to <Curtain title="rumours"> as children.`);
          t.click(t.button('Hide rumours'));
          t.expect(!t.$('.curtain .rumours'), 'Clicking "Hide rumours" should hide them: the client Curtain owns that state, the server-rendered Rumours are just its children.');
          t.click(t.button('Show rumours'));
          t.expect(t.$$('.curtain .rumours li').length === 2, 'Clicking "Show rumours" should bring them back (already loaded, no new wait).');
        }),
        test('Buying calls the Server Function', async (t) => {
          await openBazaar(t, 500);
          const form = t.$('.stall form');
          t.expect(form, 'Each StallCard should show its Buy form.');
          t.submit(form);
          await t.flush();
          await t.tick(300);
          await t.flush();
          const receipt = shownText(t, '.receipt');
          const { purchases } = handle(t, 'bazaar');
          t.expect(
            purchases.length === 1 && receipt === 'Bought Saffron for 12 gold',
            `After buying Saffron the receipt reads ${receipt ? `"${receipt}"` : 'nothing'}, expected "Bought Saffron for 12 gold" from the server. Pass the Server Function: buy={buyGoods}.`,
          );
        }),
      ],
      css: code`
        .bazaar { padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #7c2d12, #c2410c); color: #fff7ed; }
        .bazaar h1 { margin-top: 0; text-align: center; }
        .loading { color: #fed7aa; font-style: italic; }
        .stalls { list-style: none; padding: 0; display: grid; gap: 8px; }
        .stall { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-radius: 10px; background: #fff7ed; color: #431407; }
        .stall-name { font-weight: 700; flex: 1; }
        .stall form { margin: 0; }
        .receipt { width: 100%; margin: 0; color: #15803d; font-weight: 700; }
        .curtain { margin-top: 12px; padding: 8px 12px; border-radius: 10px; border: 2px dashed #fdba74; }
        .rumours { margin: 8px 0 0; padding-left: 18px; }
      `,
      concepts: [
        {
          id: 'routes-streaming',
          icon: '🌊',
          title: 'Streaming with nested Suspense',
          summary: 'The server sends the shell first, then each Suspense boundary as soon as its data is ready.',
          snippet: code`
            <Suspense fallback={<p>Setting up stalls…</p>}>
              <Stalls />  {/* async Server Component */}
              <Suspense fallback={<p>Listening…</p>}>
                <Rumours />
              </Suspense>
            </Suspense>
          `,
          detail: 'Nested boundaries reveal from the outside in. Each slow part gets its own boundary, so it never holds back the rest.',
        },
        {
          id: 'routes-client-boundary',
          icon: '🛂',
          title: 'Crossing the client boundary',
          summary: 'Props from Server to Client Components must be serialisable: plain data, JSX, promises, Server Functions.',
          snippet: code`
            <StallCard
              stall={{ id: stall.id, name: stall.name }}  // not the class instance
              buy={buyGoods}                               // a 'use server' function
            >
              <ServerRenderedThing />                      // JSX as children is fine
            </StallCard>
          `,
          detail: 'Everything in those props reaches the browser, so pick only the fields you need. Server Functions are public endpoints: validate and authorise inside them.',
        },
      ],
    },
    // ---------------------------------------------------------------- 6
    {
      id: 'routes-customs',
      type: 'quiz',
      title: 'The Customs House',
      blurb: 'Spot the boundary mistakes: what may cross between server and browser?',
      xp: 100,
      story: [
        { text: "Every caravan stops at the Customs House on the border between Server Lands and the Browser Kingdom.", mood: 'thinking' },
        { text: "The customs officer has eight suspicious shipments for you. Server code in the browser, functions trying to sneak across, mirages at the gate... Inspect them all, and read every explanation!", mood: 'happy' },
      ],
      task: md`Eight shipments to inspect: **\`'use client'\` / \`'use server'\` placement**, what can cross the boundary, Server Function security, hydration, SSR vs Server Components and query caching.`,
      questions: [
        q(
          "What's wrong with this file?\n\n```jsx\n// ProfileCard.jsx\n'use client';\nimport { useState } from 'react';\nimport { db } from '../lib/db.js';\n\nexport default async function ProfileCard({ id }) {\n  const user = await db.users.find(id);\n  const [open, setOpen] = useState(false);\n  return <button onClick={() => setOpen(!open)}>{user.name}</button>;\n}\n```",
          [
            "`'use client'` must come after the imports",
            'Nothing, this is a normal Client Component',
            'It mixes server work (an async component reading the database) with client state. Split it: a Server Component loads the user, a small Client Component owns the toggle',
            '`useState` cannot be used in a component that receives props',
          ],
          2,
          "A `'use client'` file is shipped to the browser, so its database import would be bundled for the browser (and fail, or leak secrets), and Client Components can't be `async`. Keep data access in a Server Component and pass plain data down: `<ProfileToggle name={user.name} />`. The directive itself must be the very **first** statement of the file, before the imports.",
        ),
        q(
          "A Server Component renders a Client Component like this. What happens?\n\n```jsx\n// page.jsx (Server Component)\n<LikeButton onLike={() => db.likes.add(post.id)} />\n```",
          [
            "An error: an ordinary function can't be passed to a Client Component. Move the logic into a `'use server'` Server Function and pass that instead",
            'It works: the arrow function is copied to the browser and runs there',
            'It works: the browser calls the arrow function on the server automatically',
            '`LikeButton` silently becomes a Server Component',
          ],
          0,
          "Props crossing from server to client must be serialisable, and a closure over server variables can't be sent. A **Server Function** can: `export async function like(postId) { 'use server'; … }` (or a `'use server'` file). React sends the browser a reference, and calling it becomes a network request to the server.",
        ),
        q(
          "Only the admin page shows the delete button. Is this Server Function safe?\n\n```js\n// actions.js\n'use server';\nexport async function deleteCaravan(id) {\n  await db.caravans.delete(id);\n}\n```",
          [
            "Yes: Server Functions can only be called from the component that renders them",
            "Yes: `'use server'` encrypts the function, so nobody can call it",
            'No: it should be a Client Component instead',
            "No: a Server Function is a public endpoint that anyone can call with any `id`. Check the user's permissions and validate the input inside it",
          ],
          3,
          'Hiding a button is not security. The browser just sends a request, and anyone can send that request themselves. Treat every Server Function like an API route: authenticate, authorise (`if (!user.isAdmin) throw …`), validate the arguments, and only then touch the database.',
        ),
        q(
          "A single theme toggle in the header needs `useState`, so someone put `'use client'` at the top of `app/layout.jsx`. What's the better approach?",
          [
            "Add `'use client'` to every file as well, to be consistent",
            "Keep the layout a Server Component; move the toggle into its own `'use client'` file and render `<ThemeToggle />` from the layout",
            'Replace `useState` with a global variable, so no directive is needed',
            "Put `'use server'` on the layout instead",
          ],
          1,
          "`'use client'` marks a boundary: that module **and everything it imports** become client code. On a layout, that drags the whole app into the browser bundle. Push the directive down to the **leaves**: small interactive components, rendered from Server Components.",
        ),
        q(
          "The rumours never show up, and the build warns about server code in the client. How do you fix it?\n\n```jsx\n// Curtain.jsx\n'use client';\nimport Rumours from './Rumours.jsx'; // async, reads the db\n\nexport function Curtain() {\n  const [open, setOpen] = useState(true);\n  return open && <Rumours />;\n}\n```",
          [
            "Remove the `useState` from Curtain",
            "Add `'use server'` to the top of Curtain.jsx as well",
            "Let Curtain accept `children`, and compose them in a Server Component: `<Curtain><Rumours /></Curtain>`",
            'Wrap `<Rumours />` in `<Suspense>` inside Curtain',
          ],
          2,
          "Importing a module into a `'use client'` file makes it client code, so `Rumours` can't stay a Server Component there. Instead, pass server-rendered content **through** the Client Component as `children` (or any JSX prop). The server renders `Rumours`; Curtain only decides whether to show it.",
        ),
        q(
          "In a server-rendered app, what happens with this component?\n\n```jsx\nfunction Stamp() {\n  return <p>Rendered at {new Date().toLocaleTimeString()}</p>;\n}\n```",
          [
            "Hydration mismatch: the browser's first render produces a different time than the server's HTML, so React reports an error and re-renders that part on the client",
            'React quietly updates the text, at no cost',
            'The server waits for the browser to send its time',
            'Nothing: dates are serialisable, so they always match',
          ],
          0,
          "Hydration expects the browser's first render to equal the server's HTML. Time, randomness, `localStorage` and `typeof window` branches break that. Show a placeholder and fill in the time from an effect, or, for a timestamp where the server's value is fine, add `suppressHydrationWarning` to that element.",
        ),
        q(
          'How do **SSR** and **Server Components** differ?',
          [
            'They are two names for the same feature',
            "SSR only works with class components",
            'Server Components run in the browser first, then on the server',
            "SSR renders components (Client Components included) to HTML for a fast first load, then hydrates them in the browser. Server Components never ship their code and never hydrate: they send their rendered output, and work with or without SSR",
          ],
          3,
          "SSR is about the **first paint**: HTML now, interactivity after hydration, so every component still ships its JavaScript. Server Components are about **where code runs**: their code stays on the server, and the browser receives a serialised tree. Frameworks use both together: Server Components for data-heavy parts, SSR so even Client Components arrive as HTML.",
        ),
        q(
          'With TanStack Query, the price board refetches every time it mounts, but prices only change hourly. What should you change?',
          [
            'Wrap the `useQuery` call in `useMemo`',
            'Set `staleTime: 60 * 60 * 1000`, so cached data counts as fresh for an hour and mounting reuses it without refetching',
            'Copy the prices into `useState` the first time they arrive',
            'Set `gcTime: 0`',
          ],
          1,
          "`staleTime` says how long data stays **fresh** (default 0: refetch in the background on every mount, exactly like your ledger). `gcTime` is how long **unused** data stays in the cache before it's dropped. After a change, `queryClient.invalidateQueries({ queryKey: ['prices'] })` marks data stale and refetches it, just like your `invalidate()`.",
        ),
      ],
      concepts: [
        {
          id: 'routes-boundary-rules',
          icon: '🧱',
          title: 'Boundary rules of thumb',
          summary: "'use client' at the leaves, data access on the server, plain data across, Server Functions guarded.",
          snippet: code`
            // page.jsx (server)      → reads the db, renders:
            <Curtain>                 {/* 'use client' leaf */}
              <Rumours />             {/* server content as children */}
            </Curtain>
          `,
          detail: "A Client Component can't import a Server Component, but it can receive one as children. SSR (HTML first, then hydrate) and Server Components (code never ships) are different tools that work together.",
        },
      ],
    },
    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'routes-boss',
      type: 'build',
      boss: true,
      title: 'Boss: The Waterfall Bandit',
      bossName: 'The Waterfall Bandit',
      bossIcon: '🦂',
      blurb: 'Break the chain of waiting: load every part of a page at once, and never fetch the same road twice.',
      xp: 300,
      modules: banditModules,
      badge: {
        id: 'badge-routes',
        name: 'Master of the Trade Routes',
        icon: '🐪',
        description: 'Drove the Waterfall Bandit from the dunes with parallel loading and a route cache.',
      },
      story: [
        { text: "There he is, the Waterfall Bandit! He stops every caravan at the gate: the cargo may only leave once the caravan has arrived, and the escort only once the cargo has. One... after... another.", mood: 'worried' },
        { text: "Three legs of one second each. And every time you look at a caravan again, he makes the whole convoy start over!", mood: 'worried' },
        { text: "Beat him with everything from the Trade Routes: route params, a cache keyed by id, every request sent at once, and Suspense to wait for them. Charge!", mood: 'excited' },
      ],
      lesson: md`
        ## The request waterfall

        Look at the starter. \`CaravanPage\` fetches the caravan in an effect; only when that
        arrives does it render \`<Cargo>\`, whose effect fetches the cargo; only when *that*
        arrives does \`<Escort>\` start fetching. Each request waits for the one before it:

        \`\`\`
        caravan  ██████████
        cargo              ██████████
        escort                       ██████████    → 3 s
        \`\`\`

        This is a **waterfall**, the classic cost of "fetch-on-render": a component can only start
        loading once its parent has finished loading. None of these requests needs the others' data,
        so they could all leave **together**:

        \`\`\`
        caravan  ██████████
        cargo    ██████████
        escort   ██████████                        → 1 s
        \`\`\`

        ## Render-as-you-fetch

        The fix: **start every request as soon as you know what the page needs** (here: as soon as
        you know the \`id\` from the URL), and let the components *read* the results:

        \`\`\`jsx
        function CaravanPage() {
          const { id } = useParams();
          const trip = loadTrip(id); // { caravan, cargo, escort }: three promises, all started

          return (
            <Suspense fallback={<p className="loading">Scouting the road…</p>}>
              <TripHeader promise={trip.caravan} />
              <Cargo promise={trip.cargo} />
              <Escort promise={trip.escort} />
            </Suspense>
          );
        }

        function Cargo({ promise }) {
          const cargo = use(promise);
          return <ul className="cargo">{cargo.map((item) => <li key={item}>📦 {item}</li>)}</ul>;
        }
        \`\`\`

        ## A cache keyed by the route param

        "Never create a promise during render", said the Spire's librarian, because a new promise
        on every render starts a new request every time. \`loadTrip\` must therefore **look the trip
        up** in a cache, and only start the requests the first time:

        \`\`\`js
        const trips = new Map(); // id → { caravan, cargo, escort }

        function loadTrip(id) {
          if (!trips.has(id)) {
            trips.set(id, {
              caravan: api.getCaravan(id),
              cargo: api.getCargo(id),
              escort: api.getEscort(id),
            });
          }
          return trips.get(id);
        }
        \`\`\`

        Same \`id\`, same promises: a re-render or a return visit reads the already-resolved
        promises and shows the page **instantly**, without a single new request. That's the trick
        every data library and router uses.

        ## Navigations are transitions

        Like React Router, \`reactoria-router\` wraps navigations in \`startTransition\`. When you move
        from one caravan to another that isn't loaded yet, React keeps the **old** page on screen
        until the new one is ready, instead of flashing the fallback. (Give the boundary a
        \`key={id}\` if you'd rather show the fallback for each new caravan.)

        :::pro
        In real apps this is built in:

        - **React Router** \`loader({ params })\` functions run on navigation, **in parallel** for
          all nested routes, before the page renders.
        - **Next.js** Server Components start fetches up front (\`Promise.all\`, or start promises
          before awaiting them) and stream each part with \`<Suspense>\`.
        - **TanStack Query** caches by key: \`useSuspenseQuery\`, plus \`queryClient.prefetchQuery\` in a loader
          or on hover.

        A real cache also evicts old entries and forgets failed requests so they can be retried.
        :::
      `,
      task: md`
        ## 👑 Defeat the Waterfall Bandit

        \`api.getCaravan(id)\`, \`api.getCargo(id)\` and \`api.getEscort(id)\` (from \`'caravan-api'\`)
        each take **1 s** and return promises. Rebuild \`CaravanPage\` (route \`/caravans/:id\`):

        1. **One cache**: a \`Map\` at the top level of the file, from caravan id to its trip.
        2. **\`loadTrip(id)\`** returns \`{ caravan, cargo, escort }\`, starting **all three** requests
           **at once** the first time an id is asked for, and returning the cached promises after that.
        3. **\`CaravanPage\`** reads \`id\` with \`useParams()\`, calls \`loadTrip(id)\`, and renders the parts
           inside \`<Suspense fallback={<p className="loading">Scouting the road…</p>}>\`. The parts read
           their promise with \`use()\` and keep the starter's markup:
           - \`<h2 className="trip-name">\` with the caravan's name (and its \`.route\` line)
           - \`<ul className="cargo">\` with one \`<li>\` per cargo item
           - \`<p className="escort">\` with the escort

        Goal: the whole page arrives in **1 s**, and a caravan you've already seen comes back
        **instantly**, with no new requests.
      `,
      starter: code`
        import { Suspense, use, useEffect, useState } from 'react';
        import { BrowserRouter, Routes, Route, Link, useParams, AddressBar } from 'reactoria-router';
        import { api } from 'caravan-api';

        // TODO: a cache (id → trip) and loadTrip(id) that starts all three requests at once

        // 🦂 The Bandit's waterfall: each part waits for the one above it.
        function Escort({ id }) {
          const [escort, setEscort] = useState(null);
          useEffect(() => {
            api.getEscort(id).then(setEscort);
          }, [id]);
          if (!escort) return <p className="loading">Waiting for the escort…</p>;
          return <p className="escort">🛡️ {escort}</p>;
        }

        function Cargo({ id }) {
          const [cargo, setCargo] = useState(null);
          useEffect(() => {
            api.getCargo(id).then(setCargo);
          }, [id]);
          if (!cargo) return <p className="loading">Loading the cargo…</p>;
          return (
            <>
              <ul className="cargo">
                {cargo.map((item) => (
                  <li key={item}>📦 {item}</li>
                ))}
              </ul>
              <Escort id={id} />
            </>
          );
        }

        function CaravanPage() {
          const { id } = useParams();
          const [caravan, setCaravan] = useState(null);
          useEffect(() => {
            setCaravan(null);
            api.getCaravan(id).then(setCaravan);
          }, [id]);
          if (!caravan) return <p className="loading">Scouting the road…</p>;
          return (
            <article className="trip">
              <h2 className="trip-name">{caravan.name}</h2>
              <p className="route">
                {caravan.from} → {caravan.to}
              </p>
              <Cargo id={id} />
            </article>
          );
        }

        function Camp() {
          return <p className="camp">🔥 Pick a caravan to follow across the dunes.</p>;
        }

        export default function App() {
          return (
            <BrowserRouter>
              <AddressBar />
              <div className="dunes">
                <nav className="trips">
                  <Link to="/">Camp</Link>
                  <Link to="/caravans/1">Saffron Wind</Link>
                  <Link to="/caravans/2">Silk Serpent</Link>
                  <Link to="/caravans/3">Amber Tortoise</Link>
                </nav>
                <Routes>
                  <Route path="/" element={<Camp />} />
                  <Route path="/caravans/:id" element={<CaravanPage />} />
                </Routes>
              </div>
            </BrowserRouter>
          );
        }
      `,
      solution: code`
        import { Suspense, use } from 'react';
        import { BrowserRouter, Routes, Route, Link, useParams, AddressBar } from 'reactoria-router';
        import { api } from 'caravan-api';

        // One cache for the whole app: caravan id → its trip (three promises).
        const trips = new Map();

        function loadTrip(id) {
          if (!trips.has(id)) {
            // All three requests leave at the same moment.
            trips.set(id, {
              caravan: api.getCaravan(id),
              cargo: api.getCargo(id),
              escort: api.getEscort(id),
            });
          }
          return trips.get(id);
        }

        function TripHeader({ promise }) {
          const caravan = use(promise);
          return (
            <>
              <h2 className="trip-name">{caravan.name}</h2>
              <p className="route">
                {caravan.from} → {caravan.to}
              </p>
            </>
          );
        }

        function Cargo({ promise }) {
          const cargo = use(promise);
          return (
            <ul className="cargo">
              {cargo.map((item) => (
                <li key={item}>📦 {item}</li>
              ))}
            </ul>
          );
        }

        function Escort({ promise }) {
          const escort = use(promise);
          return <p className="escort">🛡️ {escort}</p>;
        }

        function CaravanPage() {
          const { id } = useParams();
          const trip = loadTrip(id);
          return (
            <article className="trip">
              <Suspense fallback={<p className="loading">Scouting the road…</p>}>
                <TripHeader promise={trip.caravan} />
                <Cargo promise={trip.cargo} />
                <Escort promise={trip.escort} />
              </Suspense>
            </article>
          );
        }

        function Camp() {
          return <p className="camp">🔥 Pick a caravan to follow across the dunes.</p>;
        }

        export default function App() {
          return (
            <BrowserRouter>
              <AddressBar />
              <div className="dunes">
                <nav className="trips">
                  <Link to="/">Camp</Link>
                  <Link to="/caravans/1">Saffron Wind</Link>
                  <Link to="/caravans/2">Silk Serpent</Link>
                  <Link to="/caravans/3">Amber Tortoise</Link>
                </nav>
                <Routes>
                  <Route path="/" element={<Camp />} />
                  <Route path="/caravans/:id" element={<CaravanPage />} />
                </Routes>
              </div>
            </BrowserRouter>
          );
        }
      `,
      hints: [
        md`Add \`const trips = new Map();\` at the top level, and \`function loadTrip(id)\` that, if \`!trips.has(id)\`, stores \`{ caravan: api.getCaravan(id), cargo: api.getCargo(id), escort: api.getEscort(id) }\`, then returns \`trips.get(id)\`.`,
        md`Turn the parts into readers: \`function Cargo({ promise }) { const cargo = use(promise); return <ul className="cargo">…</ul>; }\`, and the same for the escort and a \`TripHeader\` for the name + route. No more effects or \`useState\`.`,
        md`\`CaravanPage\`: \`const { id } = useParams(); const trip = loadTrip(id);\` then return \`<article className="trip"><Suspense fallback={<p className="loading">Scouting the road…</p>}><TripHeader promise={trip.caravan} /><Cargo promise={trip.cargo} /><Escort promise={trip.escort} /></Suspense></article>\`.`,
      ],
      tests: [
        test('All three requests leave at the same moment', async (t) => {
          await followCaravan(t, 1);
          const calls = apiCalls(t);
          const missing = ['caravan:1', 'cargo:1', 'escort:1'].filter((c) => !calls.includes(c));
          t.expect(
            missing.length === 0,
            `When /caravans/1 opened, only [${calls.join(', ') || 'nothing'}] set off; ${missing.join(', ')} had to wait. That's the Bandit's waterfall! Start all three in loadTrip(id) the moment the page knows its id.`,
          );
          t.expect(calls.length === 3, `Opening one caravan made ${calls.length} requests: [${calls.join(', ')}], expected exactly 3. Keep the trips in a cache so a re-render reuses the same promises.`);
          t.expect(shownText(t, '.loading') === 'Scouting the road…', 'While the trip loads, show the fallback <p className="loading">Scouting the road…</p> from a <Suspense> boundary.');
        }),
        test('The whole caravan arrives in one leg (1 s)', async (t) => {
          await followCaravan(t, 1);
          await t.tick(1000);
          await t.flush();
          const trip = tripShown(t);
          t.expect(trip.name === 'Saffron Wind', `After 1 s the page shows ${trip.name ? `"${trip.name}"` : 'no .trip-name'}, expected "Saffron Wind".`);
          t.expect(
            trip.cargo === 3 && trip.escort === '🛡️ Captain Ada and 4 riders',
            `After 1 s the cargo (${trip.cargo} items) and the escort (${trip.escort ? `"${trip.escort}"` : 'missing'}) should be there too: 3 items and "🛡️ Captain Ada and 4 riders". The Bandit still has them waiting in line. Start all three requests together and read them with use().`,
          );
          t.expect(!t.$$('.loading').some(isShown), 'After 1 s nothing should still be loading.');
        }),
        test('A caravan you have seen returns instantly', async (t) => {
          await followCaravan(t, 1);
          await t.tick(1000);
          await t.flush();
          t.expect(shownText(t, '.trip-name') === 'Saffron Wind', 'The caravan must load first (see the objectives above).');
          await bossLink(t, 'Camp');
          t.expect(t.$('.camp'), 'Clicking "Camp" should show the camp page.');
          await bossLink(t, 'Saffron Wind');
          t.expect(t.blockedNavigations.length === 0, 'A link reloaded the whole page. Keep using <Link>.');
          const trip = tripShown(t);
          t.expect(
            trip.name === 'Saffron Wind' && trip.cargo === 3 && trip.escort,
            `Coming back to Saffron Wind showed ${trip.name ? `"${trip.name}" without all its parts` : 'a loading screen'} instead of the whole trip at once. loadTrip(id) should return the cached promises for an id it has seen, so use() can read them right away.`,
          );
          const calls = apiCalls(t);
          t.expect(calls.length === 3, `Coming back sent the convoy out again: ${calls.length} requests in total ([${calls.join(', ')}]), expected 3. Reuse the cached trip.`);
        }),
        test('Every caravan has its own cache entry', async (t) => {
          await followCaravan(t, 1);
          await t.tick(1000);
          await t.flush();
          await bossLink(t, 'Silk Serpent');
          await t.flush();
          const calls = apiCalls(t);
          t.expect(
            ['caravan:2', 'cargo:2', 'escort:2'].every((c) => calls.includes(c)),
            `Opening Silk Serpent should send its three requests at once, but so far only [${calls.join(', ')}] went out. Key the cache by the id from useParams().`,
          );
          await t.tick(1000);
          await t.flush();
          const trip = tripShown(t);
          t.expect(
            trip.name === 'Silk Serpent' && trip.cargo === 2 && trip.escort === '🛡️ Sergeant Lin and 2 riders',
            `After 1 s the page shows ${trip.name ? `"${trip.name}"` : 'no caravan'}, expected Silk Serpent with its 2 cargo items and "🛡️ Sergeant Lin and 2 riders".${trip.name === 'Saffron Wind' ? ' The new page never finished loading: if loadTrip(id) makes new promises on every render, each retry starts the requests over. Look the trip up in the cache first.' : ''}`,
          );
          await bossLink(t, 'Saffron Wind');
          t.expect(shownText(t, '.trip-name') === 'Saffron Wind', 'Going back to Saffron Wind should show it instantly from the cache.');
          t.expect(apiCalls(t).length === 6, `Two caravans should cost exactly 6 requests, but ${apiCalls(t).length} were sent.`);
        }),
      ],
      css: code`
        .address-bar { display: flex; gap: 8px; align-items: center; padding: 6px 10px; background: #292524; color: #e7e5e4; font-family: ui-monospace, monospace; font-size: 13px; border-radius: 10px 10px 0 0; }
        .address-bar button { padding: 2px 10px; }
        .address-url { flex: 1; background: #44403c; border-radius: 999px; padding: 4px 12px; }
        .address-host { color: #a8a29e; }
        .dunes { padding: 14px; border-radius: 0 0 14px 14px; background: linear-gradient(180deg, #fbbf24, #b45309); color: #451a03; }
        .trips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .trips a { padding: 4px 10px; border-radius: 999px; background: #fffbeb; color: #92400e; font-weight: 700; text-decoration: none; }
        .trip { padding: 12px; border-radius: 12px; background: #fffbeb; }
        .trip-name { margin: 0; }
        .route { margin: 2px 0 8px; color: #92400e; }
        .loading { font-style: italic; }
        .escort { font-weight: 700; }
      `,
      concepts: [
        {
          id: 'routes-waterfall',
          icon: '🌊',
          title: 'Request waterfalls',
          summary: 'Fetching in each component after its parent loads makes requests wait in line. Start them all at once.',
          snippet: code`
            // ❌ fetch-on-render: caravan → then cargo → then escort (3 s)
            // ✅ render-as-you-fetch: start all three, then read them (1 s)
            const trip = loadTrip(id); // { caravan, cargo, escort } promises
          `,
          detail: 'Router loaders, Server Components with Promise.all, and prefetching in data libraries all exist to start requests early and in parallel.',
        },
        {
          id: 'routes-promise-cache',
          icon: '🧺',
          title: 'Caching promises by key',
          summary: 'Look promises up in a cache instead of creating them during render; revisits read them instantly.',
          snippet: code`
            const trips = new Map();
            function loadTrip(id) {
              if (!trips.has(id)) trips.set(id, startRequests(id));
              return trips.get(id);
            }
          `,
          detail: 'use() reads an already-resolved cached promise without suspending, so a page you have seen comes back with no loading state and no new requests.',
        },
      ],
    },
  ],
};
