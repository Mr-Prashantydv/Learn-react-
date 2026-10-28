import { jsx } from 'react/jsx-runtime';
import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Check helpers (local to this chapter)
// ---------------------------------------------------------------------------

/** Whitespace-collapsed text. */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** A short, readable description of any value for failure messages. */
function show(value) {
  if (typeof value === 'function') return 'a function';
  if (value === undefined) return 'undefined';
  if (value && typeof value === 'object' && 'nativeEvent' in value) return 'a click event object';
  try {
    const json = JSON.stringify(value);
    return json.length > 120 ? json.slice(0, 117) + '...' : json;
  } catch {
    return String(value);
  }
}

/** Source with JS comments removed, so commented-out code never trips a source check. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** The source text of a top-level component/function `name` (up to the next top-level declaration). */
function sourceOf(src, name) {
  const clean = stripComments(src);
  const start = clean.search(new RegExp(`(function\\s+${name}\\b|(const|let|var)\\s+${name}\\s*=)`));
  if (start < 0) return '';
  const rest = clean.slice(start + 1);
  const end = rest.search(/\n(export\s+)?(default\s+)?(function|const|let|var|class)\s/);
  return clean.slice(start, end < 0 ? undefined : start + 1 + end);
}

/** A function that records every call's arguments. */
function spy() {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
  };
  fn.calls = calls;
  return fn;
}

/** Gets an exported component or fails with a message showing how to export it. */
function getComponent(t, name, how) {
  const value = t.exports?.[name];
  t.expect(typeof value === 'function', `Could not find an exported component named ${name}. ${how}`);
  return value;
}

/**
 * Renders `element` inside a tiny error boundary and returns the error thrown
 * while rendering (or null). Lets checks look at the message a component throws.
 */
function renderCatching(t, element) {
  const R = t.React;
  const box = { error: null };
  class Catcher extends R.Component {
    constructor(props) {
      super(props);
      this.state = { failed: false };
    }
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch(error) {
      box.error = error;
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  t.render(t.h(Catcher, null, element));
  return box.error;
}

/** Runs an interaction and turns a crash into a specific, friendly message. */
function attempt(action, advice) {
  try {
    return action();
  } catch (err) {
    const why = String(err?.message || err).replace(/^Your component crashed:\s*/, '');
    throw new Error(`React crashed: "${why}" ${advice}`);
  }
}

/** Renders something; a crash becomes `advice`-flavoured feedback. */
function renderOrExplain(t, element, advice) {
  attempt(() => (element === undefined ? t.render() : t.render(element)), advice);
}

/** Calls a function inside act (for functions a hook returned). */
function callInAct(t, fn, label) {
  t.expect(typeof fn === 'function', `${label} is not a function (got ${show(fn)}).`);
  attempt(
    () =>
      t.act(() => {
        fn();
      }),
    `(while calling ${label})`,
  );
}

/** Renders a probe component that calls `useHook(...args)` and remembers what it returned. */
function probeHook(t, useHook, ...args) {
  const box = { value: undefined };
  function HookProbe() {
    box.value = useHook(...args);
    return null;
  }
  t.render(t.h(HookProbe));
  return {
    get value() {
      return box.value;
    },
  };
}

/** Text of the element, or null when it is missing. */
const textOf = (el) => (el ? norm(el.textContent) : null);

/** The visible .panel texts inside `scope`. */
const panelsIn = (scope) => Array.from(scope.querySelectorAll('.panel')).map((p) => norm(p.textContent));

/** The <button className="tab"> in `scope` whose text contains `label`. */
function tabIn(scope, label) {
  const tabs = Array.from(scope.querySelectorAll('.tab'));
  const found = tabs.find((b) => norm(b.textContent).includes(label));
  if (!found)
    throw new Error(
      `Could not find a .tab containing "${label}". Tabs found: ${tabs.map((b) => `"${norm(b.textContent)}"`).join(', ') || 'none'}. Tabs.Tab should render <button className="tab">{children}</button>.`,
    );
  return found;
}

const isActiveTab = (el) => el.classList.contains('active') && el.getAttribute('aria-selected') === 'true';

/** Checks that exactly the tab labelled `label` is active inside `scope`. */
function expectActiveTab(t, scope, label, after) {
  const tabs = Array.from(scope.querySelectorAll('.tab'));
  const active = tabs.filter(isActiveTab).map((b) => norm(b.textContent));
  t.expect(
    active.length === 1 && active[0].includes(label),
    `${after}, the active tab(s) are ${active.length ? active.map((s) => `"${s}"`).join(', ') : 'none'} — expected only "${label}". The selected Tab needs className="tab active" and aria-selected={true}; the others className="tab" and aria-selected={false}.`,
  );
}

/** Gets Tabs plus its List/Tab/Panel parts, failing with a helpful message. */
function tabsFamily(t) {
  const Tabs = getComponent(t, 'Tabs', 'Write export function Tabs({ defaultValue, children }) { ... }.');
  for (const part of ['List', 'Tab', 'Panel']) {
    t.expect(
      typeof Tabs[part] === 'function',
      `Tabs.${part} is missing. Attach the part to Tabs after defining it, e.g. Tabs.${part} = ${part === 'List' ? 'TabList' : part};`,
    );
  }
  return Tabs;
}

/** The .switch button whose text starts with `label`. */
function switchFor(t, label) {
  const all = t.$$('.switch');
  const found = all.find((b) => norm(b.textContent).startsWith(label));
  t.expect(
    found,
    `Could not find a .switch labelled "${label}". Switches found: ${all.map((b) => `"${norm(b.textContent)}"`).join(', ') || 'none'}. Switch should render <button className="switch" ...>{label}: ON/OFF</button>.`,
  );
  return found;
}

/** Describes the state of a switch button. */
function switchState(el) {
  const text = norm(el.textContent);
  return {
    text,
    on: text.endsWith(': ON'),
    off: text.endsWith(': OFF'),
    cls: el.classList.contains('on'),
    aria: el.getAttribute('aria-checked'),
  };
}

function expectSwitch(t, el, wantOn, situation, advice = '') {
  const s = switchState(el);
  const ok = wantOn ? s.on && s.cls && s.aria === 'true' : s.off && !s.cls && s.aria === 'false';
  t.expect(
    ok,
    `${situation}, the switch reads "${s.text}" (class "${el.className}", aria-checked="${s.aria}") — expected ${
      wantOn ? '"…: ON", className "switch on" and aria-checked="true"' : '"…: OFF", className "switch" and aria-checked="false"'
    }.${advice ? ' ' + advice : ''}`,
  );
}

/** Gets Notice plus its parts. */
function noticeFamily(t) {
  const Notice = getComponent(t, 'Notice', 'Write export function Notice({ tone, open, defaultOpen, onOpenChange, children }) { ... }.');
  for (const part of ['Title', 'Body', 'Footer', 'Close']) {
    t.expect(typeof Notice[part] === 'function', `Notice.${part} is missing. Define the part and attach it: Notice.${part} = Notice${part};`);
  }
  return Notice;
}

/** Collects React's key warnings added since `from`. */
const keyWarningsSince = (t, from) => t.warnings.slice(from).filter((w) => /unique "key"|"key" prop/.test(w));

// ---------------------------------------------------------------------------
// Shared look
// ---------------------------------------------------------------------------

const PAVILION_CSS = `
.stall {
  background: linear-gradient(160deg, #fff1f2, #fce7f3);
  border: 3px solid #be185d;
  border-radius: 16px;
  padding: 14px 16px;
  color: #500724;
  box-shadow: 0 4px 0 #9d174d;
}
.stall h2, .stall h3 { color: #831843; margin: 4px 0 10px; }
.stall button { background: #be185d; box-shadow: 0 3px 0 #831843; }
.stall button:hover { background: #db2777; }
`;

export default {
  id: 'pattern-pavilion',
  file: '14-pattern-pavilion.js',
  title: 'Pattern Pavilion',
  short: 'Patterns',
  subtitle: 'Design components other people love to use: compound parts, render props and two-way controls.',
  icon: '🎪',
  colors: ['#500724', '#f472b6'],
  scenery: ['🎪', '🧩', '🧵', '🪡', '🪟', '🎨', '🪆', '🏮'],
  intro: [
    { text: 'Welcome to the Pattern Pavilion! Under these striped tents, artisans build components out of interchangeable parts that click together like mosaic tiles.', mood: 'excited' },
    { text: "Master Tessa runs the place. She says a component is only finished when *other* people can use it in ways you never imagined. Big words. Very sparkly tent.", mood: 'happy' },
    { text: 'But something hisses behind the notice board... a creature that grows a new head for every boolean prop. Let’s learn the patterns that tame it.', mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'pavilion-screens',
      type: 'code',
      title: 'The Folding Screens',
      blurb: 'Build a Tabs family whose parts share one state through context.',
      xp: 140,
      story: [
        { text: "This is Tessa's stall. She paints folding screens: one panel shows at a time, and little tabs on top pick which.", mood: 'happy' },
        { text: "Her old screen took one giant 'tabs' array prop. Then customers wanted an icon here, a wrapper there... Let's rebuild it from parts that snap together.", mood: 'thinking' },
      ],
      lesson: md`
        ## One big component vs. a family of parts

        The first idea for a tab widget is usually a single component configured by data:

        \`\`\`jsx
        <Tabs
          tabs={[
            { label: 'Glass', content: <p>Stained glass</p> },
            { label: 'Wood', content: <p>Carved oak</p> },
          ]}
        />
        \`\`\`

        It works until someone wants an icon in *one* tab, a tooltip around another, or the
        panels above the tabs. Each wish becomes another prop (\`tabIcons\`, \`tabClassName\`,
        \`panelsFirst\`...), and the component slowly turns into a monster.

        **Compound components** split the widget into parts that the user assembles, like
        HTML. You already know a compound pair: \`<select>\` and \`<option>\`.

        \`\`\`jsx
        <Tabs defaultValue="glass">
          <Tabs.List>
            <Tabs.Tab value="glass">🪟 Glass</Tabs.Tab>
            <Tabs.Tab value="wood">🪵 Wood</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="glass">Stained glass</Tabs.Panel>
          <Tabs.Panel value="wood">Carved oak</Tabs.Panel>
        </Tabs>
        \`\`\`

        The user controls the markup and the order; the family handles the behaviour.

        ## The parent provides, the parts read

        The parts must agree on one thing: which tab is active. The parent \`Tabs\` owns that
        state and shares it through **context** (Context Canopy); every part reads it:

        \`\`\`jsx
        const TabsContext = createContext(null);

        function Tabs({ defaultValue, children }) {
          const [active, setActive] = useState(defaultValue);
          return (
            <TabsContext value={{ active, setActive }}>
              <div className="tabs">{children}</div>
            </TabsContext>
          );
        }

        function Tab({ value, children }) {
          const { active, setActive } = useContext(TabsContext);
          const selected = active === value;
          return (
            <button
              className={selected ? 'tab active' : 'tab'}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(value)}
            >
              {children}
            </button>
          );
        }

        function Panel({ value, children }) {
          const { active } = useContext(TabsContext);
          if (active !== value) return null;
          return <div className="panel" role="tabpanel">{children}</div>;
        }
        \`\`\`

        The \`value\` strings link each Tab to its Panel. Because context reaches **any depth**,
        a Tab keeps working when it's wrapped in a \`<span>\`, a tooltip or your own component.
        And since every \`<Tabs>\` provides its *own* value, two tab groups on one page never mix.

        ## Tabs.Tab: hanging the parts on the parent

        Functions are objects in JavaScript, so you can attach the parts as properties:

        \`\`\`jsx
        Tabs.List = TabList;
        Tabs.Tab = Tab;
        Tabs.Panel = Panel;
        \`\`\`

        One import brings the whole family, and typing \`Tabs.\` lists the parts in your editor.
        Exporting separate names (\`TabList\`, \`Tab\`, \`TabPanel\`) is just as valid; many
        libraries do that instead.

        :::mistake
        Keeping the state in the wrong place:

        - \`useState\` inside each \`Tab\`: every tab thinks it's the selected one.
        - a \`let active\` variable at the top of the file: every tab group on the page shares
          one selection, and React doesn't re-render when it changes.

        The state lives in the family's **parent**, once per \`<Tabs>\`.
        :::

        :::tip
        \`role="tablist"\`, \`role="tab"\`, \`aria-selected\` and \`role="tabpanel"\` tell screen
        readers "this is a tab widget". Libraries such as Radix and React Aria ship exactly these
        compound components, plus arrow-key support.
        :::
      `,
      task: md`
        ## 🎯 Assemble Tessa's folding screen

        \`App\` already uses the compound API. Make the family work:

        1. Create a context (e.g. \`TabsContext\`) with \`createContext(null)\`.
        2. \`export function Tabs({ defaultValue, children })\` keeps the active value in state
           (starting at \`defaultValue\`), provides it plus a way to change it to its parts, and
           renders \`<div className="tabs">{children}</div>\`.
        3. \`Tabs.List\` renders \`<div className="tab-list" role="tablist">{children}</div>\` (done).
        4. \`Tabs.Tab({ value, children })\` renders a \`<button role="tab">\`. When its \`value\` is
           active: \`className="tab active"\` and \`aria-selected={true}\`; otherwise
           \`className="tab"\` and \`aria-selected={false}\`. Clicking it makes its value active.
        5. \`Tabs.Panel({ value, children })\` renders \`<div className="panel" role="tabpanel">\`
           only while its \`value\` is active, and \`null\` otherwise.

        The checks also build their **own** tab sets: tabs wrapped in extra elements, panels
        placed before the list, and two tab groups side by side.
      `,
      starter: code`
        import { createContext, useContext, useState } from 'react';

        // TODO 1: const TabsContext = createContext(null);

        export function Tabs({ defaultValue, children }) {
          // TODO 2: keep the active value in state and provide it to the parts
          return <div className="tabs">{children}</div>;
        }

        function TabList({ children }) {
          return (
            <div className="tab-list" role="tablist">
              {children}
            </div>
          );
        }

        function Tab({ value, children }) {
          // TODO 4: read the active value from context, select this tab on click
          return (
            <button className="tab" role="tab" aria-selected={false}>
              {children}
            </button>
          );
        }

        function Panel({ value, children }) {
          // TODO 5: only show the panel whose value is active
          return (
            <div className="panel" role="tabpanel">
              {children}
            </div>
          );
        }

        Tabs.List = TabList;
        Tabs.Tab = Tab;
        Tabs.Panel = Panel;

        export default function App() {
          return (
            <div className="stall">
              <h2>🪟 Tessa's Folding Screen</h2>
              <Tabs defaultValue="glass">
                <Tabs.List>
                  <Tabs.Tab value="glass">🪟 Glass</Tabs.Tab>
                  <Tabs.Tab value="wood">🪵 Wood</Tabs.Tab>
                  <Tabs.Tab value="silk">🧵 Silk</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="glass">Stained glass that glows at dusk.</Tabs.Panel>
                <Tabs.Panel value="wood">Carved oak with a secret drawer.</Tabs.Panel>
                <Tabs.Panel value="silk">Painted silk, light as a whisper.</Tabs.Panel>
              </Tabs>
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, useContext, useState } from 'react';

        const TabsContext = createContext(null);

        export function Tabs({ defaultValue, children }) {
          const [active, setActive] = useState(defaultValue);
          return (
            <TabsContext value={{ active, setActive }}>
              <div className="tabs">{children}</div>
            </TabsContext>
          );
        }

        function TabList({ children }) {
          return (
            <div className="tab-list" role="tablist">
              {children}
            </div>
          );
        }

        function Tab({ value, children }) {
          const { active, setActive } = useContext(TabsContext);
          const selected = active === value;
          return (
            <button
              className={selected ? 'tab active' : 'tab'}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(value)}
            >
              {children}
            </button>
          );
        }

        function Panel({ value, children }) {
          const { active } = useContext(TabsContext);
          if (active !== value) return null;
          return (
            <div className="panel" role="tabpanel">
              {children}
            </div>
          );
        }

        Tabs.List = TabList;
        Tabs.Tab = Tab;
        Tabs.Panel = Panel;

        export default function App() {
          return (
            <div className="stall">
              <h2>🪟 Tessa's Folding Screen</h2>
              <Tabs defaultValue="glass">
                <Tabs.List>
                  <Tabs.Tab value="glass">🪟 Glass</Tabs.Tab>
                  <Tabs.Tab value="wood">🪵 Wood</Tabs.Tab>
                  <Tabs.Tab value="silk">🧵 Silk</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="glass">Stained glass that glows at dusk.</Tabs.Panel>
                <Tabs.Panel value="wood">Carved oak with a secret drawer.</Tabs.Panel>
                <Tabs.Panel value="silk">Painted silk, light as a whisper.</Tabs.Panel>
              </Tabs>
            </div>
          );
        }
      `,
      hints: [
        md`Create the context at the top level, then in \`Tabs\`: \`const [active, setActive] = useState(defaultValue);\` and wrap the \`<div className="tabs">\` in \`<TabsContext value={{ active, setActive }}>\`.`,
        md`In \`Tab\`: \`const { active, setActive } = useContext(TabsContext); const selected = active === value;\`. Use \`selected\` for the className and \`aria-selected\`, and add \`onClick={() => setActive(value)}\`.`,
        md`In \`Panel\`: \`const { active } = useContext(TabsContext); if (active !== value) return null;\`, then return the \`<div className="panel" role="tabpanel">\` as before.`,
      ],
      tests: [
        test("Tessa's screen starts on Glass and shows only that panel", (t) => {
          tabsFamily(t);
          renderOrExplain(t, undefined, 'Does every part read the context that Tabs provides?');
          t.expect(t.count('.tab') === 3, `Found ${t.count('.tab')} .tab buttons — expected 3 (Glass, Wood, Silk).`);
          const panels = panelsIn(t.container);
          t.expect(
            panels.length === 1 && panels[0] === 'Stained glass that glows at dusk.',
            `The screen shows ${panels.length} panel(s): ${panels.map((p) => `"${p}"`).join(', ') || 'none'} — expected only the Glass panel. Tabs.Panel should return null unless its value is the active one (which starts at defaultValue).`,
          );
          expectActiveTab(t, t.container, 'Glass', 'On first render');
        }),
        test('Clicking a tab shows its panel and marks it active', (t) => {
          const Tabs = tabsFamily(t);
          const h = t.h;
          renderOrExplain(
            t,
            h(
              Tabs,
              { defaultValue: 'basalt' },
              h(
                Tabs.List,
                null,
                h(Tabs.Tab, { value: 'amber' }, 'Amber'),
                h(Tabs.Tab, { value: 'basalt' }, 'Basalt'),
                h(Tabs.Tab, { value: 'cobalt' }, 'Cobalt'),
              ),
              h(Tabs.Panel, { value: 'amber' }, 'Warm amber tiles'),
              h(Tabs.Panel, { value: 'basalt' }, 'Dark basalt tiles'),
              h(Tabs.Panel, { value: 'cobalt' }, 'Deep cobalt tiles'),
            ),
            'Does every part read the context that Tabs provides?',
          );
          let panels = panelsIn(t.container);
          t.expect(
            panels.join('|') === 'Dark basalt tiles',
            `With defaultValue="basalt" the panels shown are ${panels.map((p) => `"${p}"`).join(', ') || 'none'} — expected only "Dark basalt tiles". Start the state at defaultValue instead of a fixed value.`,
          );
          expectActiveTab(t, t.container, 'Basalt', 'With defaultValue="basalt"');
          t.click(tabIn(t.container, 'Cobalt'));
          panels = panelsIn(t.container);
          t.expect(
            panels.join('|') === 'Deep cobalt tiles',
            `After clicking Cobalt the panels shown are ${panels.map((p) => `"${p}"`).join(', ') || 'none'} — expected only "Deep cobalt tiles". Tab's onClick should set the active value in Tabs' state: onClick={() => setActive(value)}.`,
          );
          expectActiveTab(t, t.container, 'Cobalt', 'After clicking Cobalt');
          t.click(tabIn(t.container, 'Amber'));
          panels = panelsIn(t.container);
          t.expect(panels.join('|') === 'Warm amber tiles', `After clicking Amber the panels shown are ${panels.map((p) => `"${p}"`).join(', ') || 'none'} — expected only "Warm amber tiles".`);
        }),
        test('Parts work at any depth: wrapped tabs, panels before the list', (t) => {
          const Tabs = tabsFamily(t);
          const h = t.h;
          function Frame({ children }) {
            return h('section', { className: 'frame' }, children);
          }
          renderOrExplain(
            t,
            h(
              Tabs,
              { defaultValue: 'moon' },
              h(Frame, null, h(Tabs.Panel, { value: 'moon' }, 'Moon glass'), h('div', { className: 'deep' }, h(Tabs.Panel, { value: 'sun' }, 'Sun glass'))),
              h('hr'),
              h(
                Tabs.List,
                null,
                h('span', { className: 'wrap' }, h(Tabs.Tab, { value: 'moon' }, '🌙 Moon')),
                h('div', null, h('em', null, h(Tabs.Tab, { value: 'sun' }, '☀️ Sun'))),
              ),
            ),
            'Parts nested inside other elements must still find their Tabs: read the shared state from context.',
          );
          let panels = panelsIn(t.container);
          t.expect(
            panels.join('|') === 'Moon glass',
            `With parts nested inside other elements (a custom <Frame>, <div>, <span>), the panels shown are ${panels.map((p) => `"${p}"`).join(', ') || 'none'} — expected only "Moon glass". Every part must read the active value from context: Children.map or cloneElement only reach direct children.`,
          );
          t.click(tabIn(t.container, 'Sun'));
          panels = panelsIn(t.container);
          t.expect(
            panels.join('|') === 'Sun glass',
            `A Tab wrapped in <div><em> was clicked, but the panels shown are ${panels.map((p) => `"${p}"`).join(', ') || 'none'} — expected only "Sun glass". Share the state through context: Children.map or cloneElement only reach direct children.`,
          );
          expectActiveTab(t, t.container, 'Sun', 'After clicking the wrapped Sun tab');
        }),
        test('Each <Tabs> group keeps its own selection', (t) => {
          const Tabs = tabsFamily(t);
          const h = t.h;
          const group = (cls, defaultValue, n) =>
            h(
              'div',
              { className: cls },
              h(
                Tabs,
                { defaultValue },
                h(Tabs.List, null, h(Tabs.Tab, { value: 'x' }, 'Ex ' + n), h(Tabs.Tab, { value: 'y' }, 'Why ' + n)),
                h(Tabs.Panel, { value: 'x' }, 'X panel ' + n),
                h(Tabs.Panel, { value: 'y' }, 'Y panel ' + n),
              ),
            );
          renderOrExplain(t, h('div', null, group('g1', 'x', 1), group('g2', 'y', 2)), 'Does every part read the context that Tabs provides?');
          const g1 = t.find('.g1');
          const g2 = t.find('.g2');
          t.expect(
            panelsIn(g1).join('|') === 'X panel 1' && panelsIn(g2).join('|') === 'Y panel 2',
            `Two groups with defaultValue "x" and "y" show ${show(panelsIn(g1))} and ${show(panelsIn(g2))} — expected ["X panel 1"] and ["Y panel 2"]. Keep the state inside Tabs (one useState per <Tabs>), not in a variable shared by the whole file.`,
          );
          t.click(tabIn(g1, 'Why 1'));
          t.expect(
            panelsIn(g1).join('|') === 'Y panel 1' && panelsIn(g2).join('|') === 'Y panel 2',
            `After clicking "Why 1", group 1 shows ${show(panelsIn(g1))} and group 2 shows ${show(panelsIn(g2))} — expected ["Y panel 1"] and ["Y panel 2"].`,
          );
          t.click(tabIn(g2, 'Ex 2'));
          t.expect(
            panelsIn(g1).join('|') === 'Y panel 1' && panelsIn(g2).join('|') === 'X panel 2',
            `Clicking "Ex 2" in the second group changed the first one: group 1 shows ${show(panelsIn(g1))} — expected ["Y panel 1"]. Each <Tabs> must own its own state.`,
          );
        }),
      ],
      css: `${PAVILION_CSS}
.tabs { background: #fff; border-radius: 12px; padding: 10px; border: 2px solid #f9a8d4; }
.tab-list { display: flex; gap: 6px; border-bottom: 2px solid #fbcfe8; padding-bottom: 8px; margin-bottom: 8px; }
.stall .tab { background: #fbcfe8; color: #831843; box-shadow: none; }
.stall .tab.active { background: #be185d; color: #fff; }
.panel { padding: 14px; border-radius: 10px; background: linear-gradient(135deg, #fdf2f8, #ede9fe); font-style: italic; }
`,
      concepts: [
        {
          id: 'pavilion-compound',
          icon: '🧩',
          title: 'Compound components',
          summary: 'A family of parts (Tabs, Tabs.Tab, Tabs.Panel) that share state through context.',
          snippet: code`
            function Tabs({ defaultValue, children }) {
              const [active, setActive] = useState(defaultValue);
              return <TabsContext value={{ active, setActive }}>{children}</TabsContext>;
            }
            function Tab({ value, children }) {
              const { active, setActive } = useContext(TabsContext);
              return <button onClick={() => setActive(value)}>{children}</button>;
            }
          `,
          detail: 'The parent owns the state once per instance; parts read it from context, so they work at any depth and in any order the user chooses.',
        },
        {
          id: 'pavilion-static-parts',
          icon: '🪝',
          title: 'Parts as properties',
          summary: 'Tabs.Tab = Tab — hang the parts on the parent so one import brings the family.',
          snippet: code`
            Tabs.List = TabList;
            Tabs.Tab = Tab;
            Tabs.Panel = Panel;
            // <Tabs.Tab value="glass">Glass</Tabs.Tab>
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'pavilion-seals',
      type: 'code',
      title: 'The Guild Seals',
      blurb: 'Read context with use(), even after an early return, and fail loudly without a provider.',
      xp: 130,
      story: [
        { text: 'The guild halls stamp their crest into a wax seal on every sealed ware. Plain wares from the street stalls need no seal at all.', mood: 'happy' },
        { text: "But the market crashes with a cryptic 'Cannot read properties of null'. Let's read the guild only when we need it, with React 19's use(), and leave a clear message when it's missing.", mood: 'thinking' },
      ],
      lesson: md`
        ## use: another way to read context

        React 19 added \`use\`. Given a context, it returns exactly what \`useContext\` returns:
        the value of the nearest provider above, or the default.

        \`\`\`jsx
        import { use } from 'react';

        const guild = use(GuildContext);   // same result as useContext(GuildContext)
        \`\`\`

        ## The difference: use may be called conditionally

        Hooks must run in the same order on every render (Hook Workshop). \`use\` is more
        flexible: it may be called **inside an \`if\`, a loop, or after an early \`return\`**.
        It doesn't occupy one of the component's hook slots: it simply looks up the nearest
        provider at the moment it's called.

        \`\`\`jsx
        function Ware({ name, sealed }) {
          if (!sealed) {
            return <li className="ware">{name}</li>;   // plain wares need no guild
          }
          const guild = use(GuildContext);              // ✅ fine after an early return
          return (
            <li className="ware sealed">
              <span className="crest">{guild.crest}</span> {name}
            </li>
          );
        }
        \`\`\`

        Writing \`useContext\` on that line would break the Rules of Hooks. With \`use\`, a
        component reads context only on the paths that need it.

        What \`use\` still requires:

        - Call it **while rendering**, inside a component or a custom hook, never in an event
          handler or a plain helper function.
        - Don't call it inside a \`try\` / \`catch\` block.
        - \`useContext\` isn't deprecated: you'll see it everywhere, and both are fine when the
          read is unconditional.

        ## Fail loudly when the provider is missing

        With \`createContext(null)\`, a component used outside its provider gets \`null\`, and
        \`guild.crest\` crashes with *"Cannot read properties of null"*. That tells the next
        developer nothing. Check for it and **throw an error that explains the fix**:

        \`\`\`jsx
        const guild = use(GuildContext);
        if (guild === null) {
          throw new Error('A sealed <Ware> must be inside a <GuildHall>.');
        }
        \`\`\`

        An error thrown while rendering stops that render and shows up in the console with
        your message. (In the Arcane Spire you'll learn to catch such errors with error
        boundaries.) Every serious compound library does this: *"Tabs.Tab must be used within
        Tabs"*.

        :::tip
        For parts that always need the context, wrap the read and the check in a small custom
        hook and call it at the top level:

        \`\`\`jsx
        function useGuild() {
          const guild = use(GuildContext);
          if (guild === null) throw new Error('useGuild() must be used inside a <GuildHall>.');
          return guild;
        }
        \`\`\`

        Careful: \`useGuild\` is a \`use…\` hook, so *it* follows the Rules of Hooks. Only the bare
        \`use(...)\` call may sit inside a condition.
        :::

        :::mistake
        Calling \`use\` in an event handler: \`onClick={() => alert(use(GuildContext).name)}\`.
        Like hooks, \`use\` only works while rendering. Read the value during render, then use
        the variable inside the handler.
        :::
      `,
      task: md`
        ## 🎯 Seal the wares

        \`GuildContext\` already exists (default \`null\`). A guild is an object \`{ name, crest }\`.

        1. \`GuildHall({ guild, children })\` must **provide** \`guild\` to everything inside it
           (keep its \`<section className="guild-hall">\` markup).
        2. \`Ware({ name, sealed })\` when **not** sealed: return \`<li className="ware">{name}</li>\`
           straight away. Plain wares must work **anywhere**, even outside every \`GuildHall\`.
        3. When sealed: read the guild with \`use(GuildContext)\` (after that early return). If it
           is \`null\`, \`throw new Error('A sealed <Ware> must be inside a <GuildHall>.')\`.
           Otherwise render \`<li className="ware sealed"><span className="crest">{guild.crest}</span> {name}</li>\`.
        4. Replace \`useContext\` with \`use\` (import it from \`'react'\`). Keep \`GuildHall\` and \`Ware\` exported.

        Sealed wares take the crest of the **nearest** hall, so a hall inside a hall wins.
      `,
      starter: code`
        import { createContext, useContext } from 'react';

        export const GuildContext = createContext(null);

        export function GuildHall({ guild, children }) {
          // TODO 1: provide guild to everything inside
          return (
            <section className="guild-hall">
              <h3>{guild.crest} {guild.name}</h3>
              <ul>{children}</ul>
            </section>
          );
        }

        export function Ware({ name, sealed }) {
          // TODO 2 + 3: plain wares return early; sealed wares read the guild with use()
          // and throw a helpful error when there is no GuildHall above.
          const guild = useContext(GuildContext);
          return (
            <li className={sealed ? 'ware sealed' : 'ware'}>
              {sealed && <span className="crest">{guild.crest}</span>} {name}
            </li>
          );
        }

        const glassblowers = { name: 'Glassblowers', crest: '🔮' };
        const weavers = { name: 'Weavers', crest: '🧵' };

        export default function App() {
          return (
            <div className="stall">
              <h2>🏛️ The Guild Market</h2>
              <GuildHall guild={glassblowers}>
                <Ware name="Moon lens" sealed />
                <Ware name="Glass bead" />
              </GuildHall>
              <GuildHall guild={weavers}>
                <Ware name="Silk banner" sealed />
              </GuildHall>
              <h3>Street stalls</h3>
              <ul className="street">
                <Ware name="Clay pot" />
                <Ware name="Rope" />
              </ul>
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, use } from 'react';

        export const GuildContext = createContext(null);

        export function GuildHall({ guild, children }) {
          return (
            <GuildContext value={guild}>
              <section className="guild-hall">
                <h3>{guild.crest} {guild.name}</h3>
                <ul>{children}</ul>
              </section>
            </GuildContext>
          );
        }

        export function Ware({ name, sealed }) {
          if (!sealed) {
            return <li className="ware">{name}</li>;
          }
          const guild = use(GuildContext);
          if (guild === null) {
            throw new Error('A sealed <Ware> must be inside a <GuildHall>.');
          }
          return (
            <li className="ware sealed">
              <span className="crest">{guild.crest}</span> {name}
            </li>
          );
        }

        const glassblowers = { name: 'Glassblowers', crest: '🔮' };
        const weavers = { name: 'Weavers', crest: '🧵' };

        export default function App() {
          return (
            <div className="stall">
              <h2>🏛️ The Guild Market</h2>
              <GuildHall guild={glassblowers}>
                <Ware name="Moon lens" sealed />
                <Ware name="Glass bead" />
              </GuildHall>
              <GuildHall guild={weavers}>
                <Ware name="Silk banner" sealed />
              </GuildHall>
              <h3>Street stalls</h3>
              <ul className="street">
                <Ware name="Clay pot" />
                <Ware name="Rope" />
              </ul>
            </div>
          );
        }
      `,
      hints: [
        md`In \`GuildHall\`, wrap the \`<section>\` in \`<GuildContext value={guild}>...</GuildContext>\`.`,
        md`Start \`Ware\` with \`if (!sealed) { return <li className="ware">{name}</li>; }\`. Only below that line, write \`const guild = use(GuildContext);\` (and import \`use\` instead of \`useContext\`).`,
        md`After reading it: \`if (guild === null) { throw new Error('A sealed <Ware> must be inside a <GuildHall>.'); }\`, then return \`<li className="ware sealed"><span className="crest">{guild.crest}</span> {name}</li>\`.`,
      ],
      tests: [
        test('Plain wares work anywhere, even outside a GuildHall', (t) => {
          const Ware = getComponent(t, 'Ware', 'Keep export function Ware({ name, sealed }) { ... }.');
          renderOrExplain(
            t,
            t.h('ul', null, t.h(Ware, { name: 'Clay pot' }), t.h(Ware, { name: 'Rope' })),
            'A plain (unsealed) Ware must not need a GuildHall: return its <li> before reading the guild.',
          );
          const items = t.$$('li.ware');
          t.expect(items.length === 2, `Rendering two plain wares gave ${items.length} <li className="ware"> — expected 2.`);
          t.expect(
            items.map((li) => norm(li.textContent)).join('|') === 'Clay pot|Rope',
            `The plain wares read ${show(items.map((li) => norm(li.textContent)))} — expected ["Clay pot", "Rope"].`,
          );
          t.expect(!items.some((li) => li.classList.contains('sealed')), 'Plain wares should have className="ware" only, without "sealed".');
        }),
        test('Sealed wares wear the crest of the nearest GuildHall', (t) => {
          const GuildHall = getComponent(t, 'GuildHall', 'Keep export function GuildHall({ guild, children }) { ... }.');
          const Ware = getComponent(t, 'Ware', 'Keep export function Ware({ name, sealed }) { ... }.');
          const h = t.h;
          renderOrExplain(
            t,
            h(
              'div',
              null,
              h(GuildHall, { guild: { name: 'Lampwrights', crest: '🏮' } }, h(Ware, { name: 'Paper lantern', sealed: true }), h(Ware, { name: 'Wick' })),
              h(
                GuildHall,
                { guild: { name: 'Potters', crest: '🏺' } },
                h('div', { className: 'inner' }, h(GuildHall, { guild: { name: 'Painters', crest: '🎨' } }, h(Ware, { name: 'Glazed vase', sealed: true }))),
              ),
            ),
            'GuildHall must provide its guild: <GuildContext value={guild}>...</GuildContext>.',
          );
          const titles = t.$$('.guild-hall h3').map((el) => norm(el.textContent));
          t.expect(titles[0] === '🏮 Lampwrights', `The first hall's heading reads "${titles[0]}" — expected "🏮 Lampwrights". Keep GuildHall's markup.`);
          const sealed = t.$$('li.ware.sealed');
          t.expect(sealed.length === 2, `Found ${sealed.length} <li className="ware sealed"> — expected 2 (Paper lantern and Glazed vase).`);
          const lantern = sealed.find((li) => norm(li.textContent).includes('Paper lantern'));
          t.expect(lantern, 'Could not find the sealed "Paper lantern" ware.');
          t.expect(
            textOf(lantern.querySelector('.crest')) === '🏮' && norm(lantern.textContent) === '🏮 Paper lantern',
            `The sealed lantern reads "${norm(lantern.textContent)}" — expected "🏮 Paper lantern" with the crest inside <span className="crest">.`,
          );
          const vase = sealed.find((li) => norm(li.textContent).includes('Glazed vase'));
          t.expect(
            vase && textOf(vase.querySelector('.crest')) === '🎨',
            `A ware inside the Painters hall (itself inside the Potters hall) shows the crest "${textOf(vase?.querySelector('.crest'))}" — expected "🎨". use(GuildContext) reads the NEAREST provider.`,
          );
          const wick = t.$$('li.ware').find((li) => norm(li.textContent) === 'Wick');
          t.expect(wick && !wick.classList.contains('sealed') && !wick.querySelector('.crest'), 'The plain "Wick" inside a hall should stay plain: <li className="ware">Wick</li>, no crest.');
        }),
        test('A sealed ware outside every GuildHall throws a helpful error', (t) => {
          const Ware = getComponent(t, 'Ware', 'Keep export function Ware({ name, sealed }) { ... }.');
          const error = renderCatching(t, t.h('ul', null, t.h(Ware, { name: 'Lost seal', sealed: true })));
          t.expect(
            error,
            'A sealed Ware with no GuildHall above rendered without complaint. When use(GuildContext) gives null, throw new Error(\'A sealed <Ware> must be inside a <GuildHall>.\').',
          );
          const message = String(error.message || error);
          t.expect(
            /<GuildHall>/.test(message),
            /Cannot (read|destructure)|null|undefined/.test(message)
              ? `It threw "${message}" — that's the cryptic crash. Check for null first and throw new Error('A sealed <Ware> must be inside a <GuildHall>.') so the message says how to fix it.`
              : `It threw "${message}". Good instinct! Now make the message name the missing provider: throw new Error('A sealed <Ware> must be inside a <GuildHall>.').`,
          );
        }),
        test('Ware reads the guild with use(GuildContext)', (t) => {
          const src = stripComments(t.source);
          t.expect(/\buse\s*\(\s*GuildContext\s*\)/.test(src), 'Read the guild with use(GuildContext) (import { use } from \'react\').');
          t.expect(
            !/\buseContext\s*\(\s*GuildContext\s*\)/.test(src),
            'There is still a useContext(GuildContext). Replace it with use(GuildContext), which may be called after the early return.',
          );
          renderOrExplain(t, undefined, "App's sealed wares need their GuildHall to provide the guild: <GuildContext value={guild}>...</GuildContext>.");
          t.expect(t.count('.street li.ware') === 2, `The street stalls show ${t.count('.street li.ware')} wares — expected 2 (Clay pot and Rope).`);
          const crests = t.$$('li.ware.sealed .crest').map((el) => norm(el.textContent));
          t.expect(crests.join(' ') === '🔮 🧵', `The market's sealed wares show crests ${show(crests)} — expected ["🔮", "🧵"].`);
        }),
      ],
      css: `${PAVILION_CSS}
.guild-hall { background: #fff; border: 2px solid #f9a8d4; border-radius: 12px; padding: 8px 12px; margin-bottom: 10px; }
.guild-hall ul, .street { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
.ware { padding: 6px 10px; border-radius: 8px; background: #fdf2f8; }
.ware.sealed { background: #fce7f3; font-weight: 700; }
.crest { display: inline-block; background: #be185d; border-radius: 50%; width: 1.6em; text-align: center; box-shadow: 0 0 0 2px #fbcfe8; }
`,
      concepts: [
        {
          id: 'pavilion-use-context',
          icon: '🪄',
          title: 'use(Context)',
          summary: 'Reads context like useContext, but may be called inside if, loops or after an early return.',
          snippet: code`
            function Ware({ name, sealed }) {
              if (!sealed) return <li>{name}</li>;
              const guild = use(GuildContext); // ✅ conditional read
              return <li>{guild.crest} {name}</li>;
            }
          `,
          detail: 'Still only while rendering (components and hooks), and not inside try/catch.',
        },
        {
          id: 'pavilion-provider-guard',
          icon: '🚨',
          title: 'Fail loudly without a provider',
          summary: 'createContext(null), then throw an error that names the missing provider.',
          snippet: code`
            const tabs = use(TabsContext);
            if (tabs === null) {
              throw new Error('Tabs.Tab must be used inside <Tabs>.');
            }
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'pavilion-loom',
      type: 'code',
      title: 'The Pattern Loom',
      blurb: 'Slots, render props and function-as-children — and when a custom hook is better.',
      xp: 140,
      story: [
        { text: "Clack-clack! Wendel the weaver's loom takes a pattern card and weaves every thread with it. The pattern card is... a function!", mood: 'excited' },
        { text: "Let's give the Loom slots for fixed decorations, a renderItem for each thread, and see how a dye-cycler can be a render prop AND a hook.", mood: 'happy' },
      ],
      lesson: md`
        ## Slots: props that hold JSX

        In the Component Forge you passed JSX as \`children\` and as props. A component can
        have several named holes, often called **slots**:

        \`\`\`jsx
        function Card({ header, footer, children }) {
          return (
            <div className="card">
              {header}
              <div className="card-body">{children}</div>
              {footer}
            </div>
          );
        }

        <Card header={<h3>🧵 Silk</h3>} footer={<button>Buy</button>}>
          Soft and shiny.
        </Card>
        \`\`\`

        If a slot isn't passed it's \`undefined\`, and \`{undefined}\` renders nothing. For a
        fallback, use a default parameter value or \`??\` (\`a ?? b\` gives \`b\` when \`a\` is
        \`null\` or \`undefined\`): \`{empty ?? <p>Nothing here.</p>}\`.

        ## Render props: slots that receive data

        A slot is JSX the parent builds *before* rendering you. But what if the markup depends
        on data only your component has, like each item of a list? Accept a **function** that
        returns JSX, and call it. That's a **render prop**:

        \`\`\`jsx
        function Loom({ items, renderItem }) {
          return (
            <ul>
              {items.map((item, index) => (
                <li key={item.id}>{renderItem(item, index)}</li>
              ))}
            </ul>
          );
        }

        <Loom items={bolts} renderItem={(bolt) => <b>{bolt.name}</b>} />
        <Loom items={bolts} renderItem={(bolt, i) => i + 1 + '. ' + bolt.name} />
        \`\`\`

        The Loom owns the structure (the list, the keys, the empty state); the caller decides
        how each thread looks. You'll meet \`renderItem\`, \`renderOption\` and friends in list,
        select and autocomplete libraries.

        ## Function as children

        \`children\` is a prop too, so it can also be a function:

        \`\`\`jsx
        <Cycler options={['rose', 'gold']}>
          {({ value, next }) => <button onClick={next}>{value}</button>}
        </Cycler>
        \`\`\`

        ## Render props vs custom hooks

        Before hooks existed (2019), render props were *the* way to share stateful logic. Today
        a custom hook usually does that job more directly, with no extra component and no nesting:

        \`\`\`jsx
        const { value, next } = useCycle(['rose', 'gold']);
        \`\`\`

        A render-prop component is often just a thin wrapper around the hook:

        \`\`\`jsx
        function Cycler({ options, children }) {
          return children(useCycle(options));
        }
        \`\`\`

        | You want to... | Reach for |
        |---|---|
        | share **stateful logic** between components | a custom hook |
        | let callers customise **part of your markup** using data you own | a render prop |
        | let callers drop in **fixed** JSX | a slot prop or \`children\` |

        :::mistake
        Forgetting to *call* the render prop: \`<li>{renderItem}</li>\` renders nothing and React
        warns that functions aren't valid children. Write \`{renderItem(item, index)}\`.
        :::

        :::tip
        The \`key\` belongs on the element **you** create in the \`.map()\` (the \`<li>\`), not
        inside the caller's function: the caller can't see your list.
        :::

        :::pro
        Another API-design trick you'll see: a **polymorphic** \`as\` prop picks which element a
        component renders, e.g. \`<Text as="h2">\` or \`<Button as="a" href="/map">\`. Inside:
        \`const Tag = as ?? 'p'; return <Tag {...rest} />;\` (capitalised so JSX treats it as a variable).
        :::
      `,
      task: md`
        ## 🎯 Thread Wendel's loom

        1. \`export function Loom({ items, renderItem, header, empty })\` renders
           \`<div className="loom">\` containing, in order:
           - the \`header\` slot (nothing when it isn't passed);
           - when \`items\` is **empty**: the \`empty\` slot, or \`<p className="empty">The loom is bare.</p>\` when no \`empty\` was passed;
           - otherwise \`<ul className="threads">\` with one \`<li className="thread">\` per item (key: \`item.id\`) containing \`renderItem(item, index)\`.
        2. \`export function useCycle(options)\` returns \`{ value, next }\`. \`value\` starts at
           \`options[0]\`; \`next()\` moves to the following option and wraps back to the first
           after the last.
        3. \`export function Cycler({ options, children })\` calls \`useCycle(options)\` and returns
           \`children(...)\` called with that \`{ value, next }\` object.

        The checks pass their own \`renderItem\` and \`children\` functions, so don't hard-code App's.
      `,
      starter: code`
        import { useState } from 'react';

        // TODO 1: add the header and empty slots, and call renderItem for each thread
        export function Loom({ items, renderItem, header, empty }) {
          return (
            <div className="loom">
              <ul className="threads">
                {items.map((item) => (
                  <li className="thread" key={item.id}>
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // TODO 2: state for the current position; next() moves on and wraps around
        export function useCycle(options) {
          return { value: options[0], next() {} };
        }

        // TODO 3: return children(...) with what useCycle gives you
        export function Cycler({ options, children }) {
          return null;
        }

        const bolts = [
          { id: 1, name: 'Silk', color: '#f472b6' },
          { id: 2, name: 'Linen', color: '#d6d3d1' },
          { id: 3, name: 'Velvet', color: '#7c3aed' },
        ];

        export default function App() {
          return (
            <div className="stall">
              <h2>🧵 Wendel's Loom</h2>
              <Loom
                items={bolts}
                header={<h3>Bolts of cloth</h3>}
                renderItem={(bolt, i) => (
                  <span>
                    <span className="swatch" style={{ background: bolt.color }} /> {i + 1}. {bolt.name}
                  </span>
                )}
              />
              <Loom items={[]} header={<h3>Spare spools</h3>} />
              <Cycler options={['🌹 Rose', '🌻 Gold', '🌊 Teal']}>
                {({ value, next }) => <button onClick={next}>Dye: {value}</button>}
              </Cycler>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export function Loom({ items, renderItem, header, empty }) {
          return (
            <div className="loom">
              {header}
              {items.length === 0 ? (
                empty ?? <p className="empty">The loom is bare.</p>
              ) : (
                <ul className="threads">
                  {items.map((item, index) => (
                    <li className="thread" key={item.id}>
                      {renderItem(item, index)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }

        export function useCycle(options) {
          const [index, setIndex] = useState(0);
          function next() {
            setIndex((i) => (i + 1) % options.length);
          }
          return { value: options[index], next };
        }

        export function Cycler({ options, children }) {
          const cycle = useCycle(options);
          return children(cycle);
        }

        const bolts = [
          { id: 1, name: 'Silk', color: '#f472b6' },
          { id: 2, name: 'Linen', color: '#d6d3d1' },
          { id: 3, name: 'Velvet', color: '#7c3aed' },
        ];

        export default function App() {
          return (
            <div className="stall">
              <h2>🧵 Wendel's Loom</h2>
              <Loom
                items={bolts}
                header={<h3>Bolts of cloth</h3>}
                renderItem={(bolt, i) => (
                  <span>
                    <span className="swatch" style={{ background: bolt.color }} /> {i + 1}. {bolt.name}
                  </span>
                )}
              />
              <Loom items={[]} header={<h3>Spare spools</h3>} />
              <Cycler options={['🌹 Rose', '🌻 Gold', '🌊 Teal']}>
                {({ value, next }) => <button onClick={next}>Dye: {value}</button>}
              </Cycler>
            </div>
          );
        }
      `,
      hints: [
        md`In \`Loom\`, render \`{header}\` first. Then a ternary: \`items.length === 0 ? (empty ?? <p className="empty">The loom is bare.</p>) : <ul className="threads">...</ul>\`. Inside the \`<li>\`, replace \`{item.name}\` with \`{renderItem(item, index)}\` (take \`index\` as the map's second argument).`,
        md`\`useCycle\` keeps an index: \`const [index, setIndex] = useState(0);\`. \`next\` does \`setIndex((i) => (i + 1) % options.length)\`, and you return \`{ value: options[index], next }\`.`,
        md`\`Cycler\` is two lines: \`const cycle = useCycle(options); return children(cycle);\``,
      ],
      tests: [
        test('Loom calls renderItem for every item, with its index', (t) => {
          const Loom = getComponent(t, 'Loom', 'Keep export function Loom({ items, renderItem, header, empty }) { ... }.');
          const h = t.h;
          const items = [
            { id: 'a', name: 'Silk' },
            { id: 'b', name: 'Wool' },
            { id: 'c', name: 'Hemp' },
          ];
          const before = t.warnings.length;
          renderOrExplain(t, h(Loom, { items, renderItem: (it) => h('b', { className: 'nm' }, it.name.toUpperCase()) }), 'Loom should call renderItem(item, index) for each item.');
          const lis = t.$$('ul.threads > li.thread');
          t.expect(lis.length === 3, `Loom rendered ${lis.length} <li className="thread"> inside <ul className="threads"> — expected one per item (3).`);
          const bolds = lis.map((li) => textOf(li.querySelector('b.nm')));
          t.expect(
            bolds.join(' ') === 'SILK WOOL HEMP',
            `With renderItem={(it) => <b className="nm">{it.name.toUpperCase()}</b>} the threads show ${show(lis.map((li) => norm(li.textContent)))} — expected SILK, WOOL, HEMP in <b> tags. Put {renderItem(item, index)} inside each <li> instead of a fixed {item.name}.`,
          );
          renderOrExplain(t, h(Loom, { items, renderItem: (it, i) => i + 1 + '. ' + it.name }), 'Loom should call renderItem(item, index) for each item.');
          const numbered = t.$$('li.thread').map((li) => norm(li.textContent));
          t.expect(
            numbered.join('|') === '1. Silk|2. Wool|3. Hemp',
            `With renderItem={(it, i) => i + 1 + '. ' + it.name} the threads read ${show(numbered)} — expected ["1. Silk", "2. Wool", "3. Hemp"]. Pass the index too: items.map((item, index) => ... renderItem(item, index) ...).`,
          );
          const keyWarnings = keyWarningsSince(t, before);
          t.expect(keyWarnings.length === 0, 'React warned about missing keys. Put key={item.id} on the <li> you create in the .map().');
        }),
        test('header and empty slots render in the right places', (t) => {
          const Loom = getComponent(t, 'Loom', 'Keep export function Loom({ items, renderItem, header, empty }) { ... }.');
          const h = t.h;
          const items = [{ id: 1, name: 'Silk' }];
          renderOrExplain(t, h(Loom, { items, header: h('h3', { className: 'hdr' }, 'Bolts'), renderItem: (it) => it.name }), 'Render {header} inside the .loom div.');
          const loom = t.find('.loom');
          const hdr = loom.querySelector('h3.hdr');
          t.expect(hdr, 'The header slot (<h3 className="hdr">Bolts</h3>) is missing. Render {header} inside <div className="loom">.');
          const list = loom.querySelector('ul.threads');
          t.expect(list && hdr.compareDocumentPosition(list) & 4, 'The header slot should come before the <ul className="threads">.');
          renderOrExplain(t, h(Loom, { items, renderItem: (it) => it.name }), 'When no header is passed, render nothing for it.');
          t.expect(!/undefined|null/.test(t.find('.loom').textContent), 'Without a header the loom shows the word "undefined" or "null". Render {header} as it is: React renders nothing for undefined.');
          renderOrExplain(t, h(Loom, { items: [], renderItem: (it) => it.name, empty: h('em', { className: 'none' }, 'No bolts today') }), 'Handle an empty items array.');
          t.expect(
            textOf(t.$('.loom em.none')) === 'No bolts today',
            'With items={[]} and empty={<em className="none">No bolts today</em>}, the empty slot should be shown inside .loom.',
          );
          t.expect(t.count('li.thread') === 0 && !t.$('p.empty'), 'When the empty slot is passed, show only it: no threads and no default <p className="empty">.');
          renderOrExplain(t, h(Loom, { items: [], renderItem: (it) => it.name }), 'Handle an empty items array.');
          t.expect(
            textOf(t.$('.loom p.empty')) === 'The loom is bare.',
            'With items={[]} and no empty slot, show <p className="empty">The loom is bare.</p> (e.g. {empty ?? <p className="empty">The loom is bare.</p>}).',
          );
        }),
        test('useCycle steps through the options and wraps around', (t) => {
          const useCycle = t.exports.useCycle;
          t.expect(typeof useCycle === 'function', 'No exported useCycle was found. Write export function useCycle(options) { ... }.');
          const probe = attempt(() => probeHook(t, useCycle, ['red', 'gold', 'blue']), 'useCycle crashed while rendering.');
          const v = () => probe.value;
          t.expect(v() && v().value === 'red', `useCycle(['red', 'gold', 'blue']) starts at ${show(v()?.value)} — expected "red" (options[0]). Return an object { value, next }.`);
          callInAct(t, v().next, 'next()');
          t.expect(v().value === 'gold', `After next() the value is ${show(v().value)} — expected "gold". Keep the position in state so next() causes a re-render.`);
          callInAct(t, v().next, 'next()');
          callInAct(t, v().next, 'next()');
          t.expect(v().value === 'red', `After three next() calls the value is ${show(v().value)} — expected "red" again (wrap around after the last option, e.g. with % options.length).`);
          const two = attempt(() => probeHook(t, useCycle, ['🌑', '🌕']), 'useCycle crashed while rendering.');
          callInAct(t, two.value.next, 'next()');
          t.expect(two.value.value === '🌕', `useCycle(['🌑', '🌕']) after one next() gives ${show(two.value.value)} — expected "🌕". Use the options you were given.`);
        }),
        test('Cycler hands { value, next } to its children function', (t) => {
          const Cycler = getComponent(t, 'Cycler', 'Write export function Cycler({ options, children }) { ... }.');
          const h = t.h;
          const moon = ({ value, next }) => h('button', { className: 'cyc', onClick: next }, 'Moon ' + value);
          const swatch = ({ value }) => h('span', { className: 'sw' }, '[' + value + ']');
          renderOrExplain(
            t,
            h('div', null, h(Cycler, { options: ['🌑', '🌓', '🌕'] }, moon), h(Cycler, { options: ['ink', 'chalk'] }, swatch), h('div', { className: 'two' }, h(Cycler, { options: ['A', 'B'] }, moon))),
            'Cycler should return children({ value, next }) — call the children function.',
          );
          const btn = t.$('.cyc');
          t.expect(btn, 'The children function\'s <button className="cyc"> did not appear. Cycler should return children(cycle), calling the function it received as children.');
          t.expect(norm(btn.textContent) === 'Moon 🌑', `The button reads "${norm(btn.textContent)}" — expected "Moon 🌑". Pass the { value, next } object from useCycle to children.`);
          t.expect(textOf(t.$('.sw')) === '[ink]', `A second Cycler with a different children function shows ${show(textOf(t.$('.sw')))} — expected "[ink]".`);
          t.click(btn);
          t.expect(norm(t.$('.cyc').textContent) === 'Moon 🌓', `After clicking, the button reads "${norm(t.$('.cyc').textContent)}" — expected "Moon 🌓". next must come from useCycle.`);
          t.expect(norm(t.find('.two .cyc').textContent) === 'Moon A', 'Clicking one Cycler changed another. Each Cycler calls useCycle, so each gets its own state.');
          const body = sourceOf(t.source, 'Cycler');
          t.expect(/\buseCycle\s*\(/.test(body), 'Cycler should reuse your hook instead of duplicating its state: const cycle = useCycle(options); return children(cycle);');
        }),
      ],
      css: `${PAVILION_CSS}
.loom { background: #fff; border: 2px dashed #f472b6; border-radius: 12px; padding: 8px 12px; margin-bottom: 10px; }
.threads { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
.thread { padding: 6px 10px; border-radius: 8px; background: repeating-linear-gradient(90deg, #fdf2f8 0 8px, #fce7f3 8px 16px); }
.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 4px; vertical-align: middle; }
.empty { color: #9d174d; font-style: italic; margin: 4px 0; }
`,
      concepts: [
        {
          id: 'pavilion-render-props',
          icon: '🎴',
          title: 'Render props',
          summary: 'Pass a function that returns JSX; the component calls it with data it owns.',
          snippet: code`
            <Loom items={bolts} renderItem={(bolt) => <b>{bolt.name}</b>} />
            <Cycler options={opts}>{({ value, next }) => <button onClick={next}>{value}</button>}</Cycler>
          `,
          detail: 'For sharing stateful logic, prefer a custom hook. Render props shine for letting callers customise part of your markup (renderItem, renderOption).',
        },
        {
          id: 'pavilion-slots',
          icon: '🕳️',
          title: 'Slots',
          summary: 'Named props that hold JSX: header={<h3/>}, footer, empty...',
          snippet: code`
            function Card({ header, children, footer }) {
              return <div>{header}{children}{footer ?? <p>No footer</p>}</div>;
            }
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'pavilion-lever',
      type: 'code',
      title: 'The Two-Way Lever',
      blurb: 'One Switch, two modes: it can keep its own state or be controlled by its parent.',
      xp: 150,
      story: [
        { text: "Lark the lever-smith has a puzzle. Some customers want a switch that just remembers itself. Others want to wire it to their fountain, so THEY decide.", mood: 'thinking' },
        { text: 'Inputs already work both ways: value or defaultValue. Let’s give our own Switch the same superpower.', mood: 'excited' },
      ],
      lesson: md`
        ## Two kinds of owner

        In the Form Fortress you met two kinds of input:

        - **controlled**: \`<input value={name} onChange={...} />\`, the parent's state is the truth;
        - **uncontrolled**: \`<input defaultValue="Ada" />\`, the input keeps its own value.

        Good reusable components offer the same choice. Libraries are full of pairs like
        \`value\` / \`defaultValue\`, \`checked\` / \`defaultChecked\`, \`open\` / \`defaultOpen\`.

        - **Uncontrolled** \`<Switch defaultChecked />\`: the switch owns its state. The parent only
          sets the starting point and may *listen* with \`onChange\`.
        - **Controlled** \`<Switch checked={on} onChange={setOn} />\`: the parent owns the state.
          The switch shows \`checked\` and merely *asks* for changes through \`onChange\`.

        ## The pattern

        \`\`\`jsx
        function Switch({ label, checked, defaultChecked = false, onChange }) {
          const [innerOn, setInnerOn] = useState(defaultChecked);
          const isControlled = checked !== undefined;
          const on = isControlled ? checked : innerOn;

          function handleClick() {
            const next = !on;
            if (!isControlled) setInnerOn(next);   // only move our OWN state
            if (onChange) onChange(next);           // always report the new value
          }

          return (
            <button className={on ? 'switch on' : 'switch'} role="switch"
                    aria-checked={on} onClick={handleClick}>
              {label}: {on ? 'ON' : 'OFF'}
            </button>
          );
        }
        \`\`\`

        Three moves make it work:

        1. **Decide the mode** with \`checked !== undefined\`. Not \`if (checked)\`: \`false\` is a
           perfectly good controlled value!
        2. **Read from one place**: the prop when controlled, your state otherwise.
        3. **In the handler**, change your own state only when uncontrolled, and always call
           \`onChange\` with the **next value** (a boolean, not the click event), so a parent can
           write \`onChange={setOn}\`.

        ## Why not copy the prop into state?

        \`\`\`jsx
        const [on, setOn] = useState(checked);   // ❌
        \`\`\`

        \`useState\` uses its argument on the **first render only**. When the parent later passes
        a new \`checked\`, the switch ignores it; and when the parent *refuses* a change, the
        switch flips anyway. Two sources of truth, fighting. Keep exactly one: the parent's prop
        **or** your state.

        :::mistake
        Switching modes halfway: \`<Switch checked={settings.sound} />\` where \`settings.sound\`
        starts \`undefined\` and later becomes \`true\`. The switch jumps from uncontrolled to
        controlled. React warns about exactly this for inputs ("A component is changing an
        uncontrolled input to be controlled"). Choose one mode for a component's lifetime;
        \`checked={Boolean(settings.sound)}\` forces controlled.
        :::

        :::pro
        Libraries put this logic in a reusable hook, often called
        \`useControllableState({ value, defaultValue, onChange })\`. Now you know what's inside.
        :::
      `,
      task: md`
        ## 🎯 Forge the two-way lever

        Rewrite \`export function Switch({ label, checked, defaultChecked = false, onChange })\`:

        1. It renders \`<button role="switch" aria-checked={on}>\` reading **{label}: ON** or
           **{label}: OFF**, with \`className="switch on"\` when on and \`"switch"\` when off.
        2. **Uncontrolled** (no \`checked\` prop): it starts at \`defaultChecked\` and flips itself
           on every click.
        3. **Controlled** (\`checked\` is passed, even \`false\`): it shows \`checked\` and never
           changes by itself.
        4. In both modes a click calls \`onChange(next)\` (when given) with the **new** boolean.

        \`App\` already wires the ⛲ Fountain switch to its \`fountain\` state, and the
        **Stop the fountain** button turns it off from outside.
      `,
      starter: code`
        import { useState } from 'react';

        export function Switch({ label, checked, defaultChecked = false, onChange }) {
          // 🐛 Copies the prop into state once: the parent can't control it any more.
          const [on, setOn] = useState(checked ?? defaultChecked);

          function handleClick() {
            setOn(!on);
            // TODO: report the new value with onChange
          }

          return (
            <button className={on ? 'switch on' : 'switch'} role="switch" aria-checked={on} onClick={handleClick}>
              {label}: {on ? 'ON' : 'OFF'}
            </button>
          );
        }

        export default function App() {
          const [fountain, setFountain] = useState(false);

          return (
            <div className="stall">
              <h2>🎚️ Lark's Lever Works</h2>
              <Switch label="🏮 Lanterns" defaultChecked />
              <Switch label="⛲ Fountain" checked={fountain} onChange={setFountain} />
              <p className="status">The fountain is {fountain ? 'flowing' : 'still'}.</p>
              <button onClick={() => setFountain(false)}>🔧 Stop the fountain</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export function Switch({ label, checked, defaultChecked = false, onChange }) {
          const [innerOn, setInnerOn] = useState(defaultChecked);
          const isControlled = checked !== undefined;
          const on = isControlled ? checked : innerOn;

          function handleClick() {
            const next = !on;
            if (!isControlled) setInnerOn(next);
            if (onChange) onChange(next);
          }

          return (
            <button className={on ? 'switch on' : 'switch'} role="switch" aria-checked={on} onClick={handleClick}>
              {label}: {on ? 'ON' : 'OFF'}
            </button>
          );
        }

        export default function App() {
          const [fountain, setFountain] = useState(false);

          return (
            <div className="stall">
              <h2>🎚️ Lark's Lever Works</h2>
              <Switch label="🏮 Lanterns" defaultChecked />
              <Switch label="⛲ Fountain" checked={fountain} onChange={setFountain} />
              <p className="status">The fountain is {fountain ? 'flowing' : 'still'}.</p>
              <button onClick={() => setFountain(false)}>🔧 Stop the fountain</button>
            </div>
          );
        }
      `,
      hints: [
        md`Keep your own state only for the uncontrolled case: \`const [innerOn, setInnerOn] = useState(defaultChecked);\`. Then \`const isControlled = checked !== undefined;\` and \`const on = isControlled ? checked : innerOn;\`.`,
        md`In \`handleClick\`, compute \`const next = !on;\`. Only call \`setInnerOn(next)\` when \`!isControlled\`.`,
        md`Finish \`handleClick\` with \`if (onChange) onChange(next);\` so both modes report the new boolean. The JSX stays as it is.`,
      ],
      tests: [
        test('Uncontrolled: starts at defaultChecked and flips itself', (t) => {
          const Switch = getComponent(t, 'Switch', 'Keep export function Switch({ label, checked, defaultChecked = false, onChange }) { ... }.');
          renderOrExplain(t, t.h(Switch, { label: 'Lamp', defaultChecked: true }), 'Check how Switch renders.');
          const lamp = switchFor(t, 'Lamp');
          t.expect(lamp.getAttribute('role') === 'switch', 'The switch button needs role="switch".');
          expectSwitch(t, lamp, true, 'With defaultChecked');
          t.click(lamp);
          expectSwitch(t, switchFor(t, 'Lamp'), false, 'After one click on an uncontrolled switch', 'Without a checked prop the switch keeps its own state and flips it.');
          renderOrExplain(t, t.h('div', null, t.h(Switch, { label: 'Bell' })), 'Check how Switch renders.');
          expectSwitch(t, switchFor(t, 'Bell'), false, 'With no defaultChecked');
          t.click(switchFor(t, 'Bell'));
          expectSwitch(t, switchFor(t, 'Bell'), true, 'After clicking an uncontrolled switch that started off');
        }),
        test('Controlled: shows the checked prop and never flips by itself', (t) => {
          const Switch = getComponent(t, 'Switch', 'Keep export function Switch({ label, checked, defaultChecked = false, onChange }) { ... }.');
          const onChange = spy();
          renderOrExplain(t, t.h(Switch, { label: 'Gate', checked: false, onChange }), 'Check how Switch renders.');
          expectSwitch(t, switchFor(t, 'Gate'), false, 'With checked={false}');
          t.click(switchFor(t, 'Gate'));
          expectSwitch(
            t,
            switchFor(t, 'Gate'),
            false,
            'With checked={false} and a parent that ignores onChange, after a click',
            'A controlled switch must show the checked prop, not its own state: const on = isControlled ? checked : innerOn; (and checked={false} counts as controlled — test checked !== undefined).',
          );
          t.expect(onChange.calls.length === 1, `onChange was called ${onChange.calls.length} time(s) for one click — expected once.`);
          renderOrExplain(t, t.h(Switch, { label: 'Gate', checked: true, onChange }), 'Check how Switch renders.');
          expectSwitch(
            t,
            switchFor(t, 'Gate'),
            true,
            'After the parent re-rendered it with checked={true}',
            "Copying the prop into useState only reads it on the first render. Read the prop directly while it's controlled.",
          );
          t.click(switchFor(t, 'Gate'));
          expectSwitch(t, switchFor(t, 'Gate'), true, 'With checked={true} and a parent that ignores onChange, after a click');
        }),
        test('onChange receives the next value (true/false) in both modes', (t) => {
          const Switch = getComponent(t, 'Switch', 'Keep export function Switch({ label, checked, defaultChecked = false, onChange }) { ... }.');
          const onChange = spy();
          renderOrExplain(t, t.h(Switch, { label: 'Bellows', onChange }), 'Check how Switch renders.');
          t.click(switchFor(t, 'Bellows'));
          t.click(switchFor(t, 'Bellows'));
          const got = onChange.calls.map((args) => args[0]);
          t.expect(
            got.length === 2 && got[0] === true && got[1] === false,
            `Clicking an uncontrolled switch (starting off) twice called onChange with ${got.length ? got.map(show).join(', then ') : 'nothing'} — expected true, then false. Call onChange(next) with the new boolean, not the event.`,
          );
          const controlled = spy();
          renderOrExplain(t, t.h(Switch, { label: 'Chime', checked: true, onChange: controlled }), 'Check how Switch renders.');
          t.click(switchFor(t, 'Chime'));
          t.expect(
            controlled.calls.length === 1 && controlled.calls[0][0] === false,
            `Clicking a controlled switch showing ON called onChange with ${controlled.calls.length ? show(controlled.calls[0][0]) : 'nothing'} — expected false (the value it asks the parent to set).`,
          );
        }),
        test("App: the fountain switch follows the App's state", (t) => {
          renderOrExplain(t, undefined, 'Check how App renders.');
          const status = () => norm(t.find('.status').textContent);
          expectSwitch(t, switchFor(t, '🏮 Lanterns'), true, 'At the start, the Lanterns switch (defaultChecked)');
          expectSwitch(t, switchFor(t, '⛲ Fountain'), false, 'At the start, the Fountain switch');
          t.click(switchFor(t, '⛲ Fountain'));
          t.expect(status() === 'The fountain is flowing.', `After switching the fountain on, the status reads "${status()}" — expected "The fountain is flowing.". The click should call onChange(true), which is App's setFountain.`);
          expectSwitch(t, switchFor(t, '⛲ Fountain'), true, 'After switching the fountain on');
          t.click(t.button('Stop the fountain'));
          t.expect(status() === 'The fountain is still.', `After "Stop the fountain" the status reads "${status()}" — expected "The fountain is still.".`);
          expectSwitch(
            t,
            switchFor(t, '⛲ Fountain'),
            false,
            'After App set fountain to false from outside',
            'A controlled switch must follow its checked prop when the parent changes it.',
          );
          t.click(switchFor(t, '🏮 Lanterns'));
          expectSwitch(t, switchFor(t, '🏮 Lanterns'), false, 'After clicking the uncontrolled Lanterns switch');
        }),
      ],
      css: `${PAVILION_CSS}
.stall .switch { display: block; width: 100%; text-align: left; margin: 6px 0; background: #e5e7eb; color: #374151; box-shadow: inset 0 -3px 0 #9ca3af; }
.stall .switch.on { background: #22c55e; color: #fff; box-shadow: inset 0 -3px 0 #15803d; }
.status { font-weight: 700; }
`,
      concepts: [
        {
          id: 'pavilion-controllable',
          icon: '🎚️',
          title: 'Controlled or uncontrolled',
          summary: 'checked + onChange (parent owns it) or defaultChecked (component owns it) — one source of truth.',
          snippet: code`
            const [innerOn, setInnerOn] = useState(defaultChecked);
            const isControlled = checked !== undefined;
            const on = isControlled ? checked : innerOn;
            function toggle() {
              if (!isControlled) setInnerOn(!on);
              if (onChange) onChange(!on);
            }
          `,
          detail: 'Never copy a controlled prop into state: useState only reads its argument once. Same idea behind value/defaultValue and open/defaultOpen in every UI library.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'pavilion-heirlooms',
      type: 'bug',
      title: 'The Heirloom Cabinet',
      blurb: 'Bug hunt! Old-style components misbehave after the upgrade to React 19.',
      xp: 150,
      story: [
        { text: "Archivist Mothwick keeps heirloom components from the old days: higher-order components, cloneElement, defaultProps. Since the pavilion upgraded to React 19, the cabinet has gone strange.", mood: 'worried' },
        { text: 'A plaque made of "undefined", runes that ignore clicks, a lamp that forgets it was lit. Learn to recognise old patterns, then fix all three!', mood: 'thinking' },
      ],
      lesson: md`
        ## Reading old React

        Plenty of code, tutorials and libraries were written before hooks (2019) or before
        React 19 (2024). You'll mostly *read* these patterns, sometimes fix them.

        ## Higher-order components (HOCs)

        \`\`\`jsx
        function withGlow(Component) {
          return function Glowing(props) {
            return <div className="glow"><Component {...props} /></div>;
          };
        }
        const GlowingLamp = withGlow(Lamp);
        \`\`\`

        An HOC is a **function that takes a component and returns a new component**. Old
        Redux's \`connect()\` and React Router's \`withRouter()\` worked like this. Today a
        custom hook (for logic) or a plain wrapper component (for markup) usually replaces them.

        :::mistake
        **Never call an HOC during render.** \`const GlowingLamp = withGlow(Lamp)\` *inside* a
        component builds a brand-new component type on every render. React sees a different
        type at that spot, throws away the old one with all its state and DOM, and mounts a
        fresh one. Create wrapped components **once, at the top level** of the file. (The same
        goes for defining a component inside another component.)
        :::

        ## Children.map and cloneElement

        Before context was easy to use, compound components injected props into their children:

        \`\`\`jsx
        function RuneGroup({ value, onPick, children }) {
          return Children.map(children, (child) =>
            cloneElement(child, { selected: child.props.value === value, onPick })
          );
        }
        \`\`\`

        It only reaches **direct** children. Wrap a \`<Rune>\` in a \`<div>\` and the *div* gets
        \`selected\` and \`onPick\`; the Rune inside gets nothing. Context reaches any depth, which
        is why the Folding Screens used it. \`Children\` and \`cloneElement\` still exist, but the
        React docs list them as legacy APIs, with context and render props as alternatives.

        ## Removed in React 19

        | Old | Use instead |
        |---|---|
        | \`defaultProps\` on a function component (now silently ignored) | default parameters: \`function Plaque({ metal = 'bronze' })\` |
        | \`propTypes\` (silently ignored) | TypeScript |
        | string refs, \`ref="input"\` (class components) | \`useRef\` or ref callbacks |
        | \`ReactDOM.render\`, \`ReactDOM.hydrate\` | \`createRoot(el).render()\`, \`hydrateRoot\` |
        | legacy context (\`contextTypes\`, \`getChildContext\`) | \`createContext\` |
        | \`ReactDOM.findDOMNode\` | DOM refs |

        Class components keep \`defaultProps\`, and \`forwardRef\` still works (but \`ref\` is now a
        plain prop, as you saw in the Ref Ruins).

        ## Class lifecycles, translated

        | Class component | Function component |
        |---|---|
        | \`this.state\`, \`this.setState\` | \`useState\` |
        | \`componentDidMount\` | \`useEffect(() => { ... }, [])\` |
        | \`componentDidUpdate(prevProps)\` | \`useEffect(() => { ... }, [dep])\` |
        | \`componentWillUnmount\` | the cleanup function your effect returns |
        | \`static contextType\` | \`useContext\` / \`use\` |

        Classes still work; error boundaries are even still written as classes (Arcane Spire).

        :::tip
        Silent removals are the sneakiest bugs: no error, no warning, just \`undefined\`. When
        an old component renders "undefined", search it for \`defaultProps\`.
        :::
      `,
      task: md`
        ## 🐛 Restore the cabinet

        Fix the **three** heirlooms. Keep \`Plaque\`, \`RuneGroup\` and \`Rune\` exported.

        1. **The bare plaque.** \`Plaque\` relies on \`Plaque.defaultProps = { metal: 'bronze' }\`,
           which React 19 ignores, so "Founders' Hall" is *cast in undefined*. Give \`metal\` a
           default parameter value of \`'bronze'\` and **delete** the \`defaultProps\` line.
        2. **The deaf runes.** \`RuneGroup\` injects props with \`Children.map\` + \`cloneElement\`,
           but the runes now sit inside \`<div className="rune-row">\`. Share \`{ value, onPick }\`
           through a context instead; \`Rune({ value, children })\` reads it (with \`use\` or
           \`useContext\`) and still renders \`<button className="rune">\` (\`"rune selected"\` when
           its value is the group's value) that calls \`onPick(value)\`.
        3. **The forgetful lamp.** \`withGlow(Lamp)\` runs *inside* \`App\`, so dusting the cabinet
           makes the lamp forget it was lit. Create \`GlowingLamp\` once, at the top level.
      `,
      starter: code`
        import { Children, cloneElement, useState } from 'react';

        export function Plaque({ title, metal }) {
          return <p className="plaque">🏅 {title} — cast in {metal}</p>;
        }
        Plaque.defaultProps = { metal: 'bronze' };

        export function RuneGroup({ value, onPick, children }) {
          return (
            <div className="runes">
              {Children.map(children, (child) =>
                cloneElement(child, { selected: child.props.value === value, onPick }),
              )}
            </div>
          );
        }

        export function Rune({ value, selected, onPick, children }) {
          return (
            <button className={selected ? 'rune selected' : 'rune'} onClick={() => onPick(value)}>
              {children}
            </button>
          );
        }

        function withGlow(Component) {
          return function Glowing(props) {
            return (
              <div className="glow">
                <Component {...props} />
              </div>
            );
          };
        }

        function Lamp() {
          const [lit, setLit] = useState(false);
          return (
            <button className="lamp" onClick={() => setLit(!lit)}>
              {lit ? '💡 Lit' : '🌑 Dark'}
            </button>
          );
        }

        export default function App() {
          const [rune, setRune] = useState('water');
          const [dusted, setDusted] = useState(0);
          const GlowingLamp = withGlow(Lamp);

          return (
            <div className="stall">
              <h2>🗄️ Mothwick's Heirloom Cabinet</h2>
              <Plaque title="Founders' Hall" />
              <Plaque title="Moon Gallery" metal="silver" />
              <RuneGroup value={rune} onPick={setRune}>
                <div className="rune-row">
                  <Rune value="fire">🔥 Fire</Rune>
                  <Rune value="water">💧 Water</Rune>
                </div>
                <div className="rune-row">
                  <Rune value="earth">🪨 Earth</Rune>
                  <Rune value="air">🌬️ Air</Rune>
                </div>
              </RuneGroup>
              <p className="chosen">Chosen rune: {rune}</p>
              <GlowingLamp />
              <button onClick={() => setDusted(dusted + 1)}>🪶 Dust the cabinet</button>
              <p className="dusted">Dusted {dusted} times</p>
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, use, useState } from 'react';

        export function Plaque({ title, metal = 'bronze' }) {
          return <p className="plaque">🏅 {title} — cast in {metal}</p>;
        }

        const RuneContext = createContext(null);

        export function RuneGroup({ value, onPick, children }) {
          return (
            <RuneContext value={{ value, onPick }}>
              <div className="runes">{children}</div>
            </RuneContext>
          );
        }

        export function Rune({ value, children }) {
          const group = use(RuneContext);
          const selected = group.value === value;
          return (
            <button className={selected ? 'rune selected' : 'rune'} onClick={() => group.onPick(value)}>
              {children}
            </button>
          );
        }

        function withGlow(Component) {
          return function Glowing(props) {
            return (
              <div className="glow">
                <Component {...props} />
              </div>
            );
          };
        }

        function Lamp() {
          const [lit, setLit] = useState(false);
          return (
            <button className="lamp" onClick={() => setLit(!lit)}>
              {lit ? '💡 Lit' : '🌑 Dark'}
            </button>
          );
        }

        const GlowingLamp = withGlow(Lamp);

        export default function App() {
          const [rune, setRune] = useState('water');
          const [dusted, setDusted] = useState(0);

          return (
            <div className="stall">
              <h2>🗄️ Mothwick's Heirloom Cabinet</h2>
              <Plaque title="Founders' Hall" />
              <Plaque title="Moon Gallery" metal="silver" />
              <RuneGroup value={rune} onPick={setRune}>
                <div className="rune-row">
                  <Rune value="fire">🔥 Fire</Rune>
                  <Rune value="water">💧 Water</Rune>
                </div>
                <div className="rune-row">
                  <Rune value="earth">🪨 Earth</Rune>
                  <Rune value="air">🌬️ Air</Rune>
                </div>
              </RuneGroup>
              <p className="chosen">Chosen rune: {rune}</p>
              <GlowingLamp />
              <button onClick={() => setDusted(dusted + 1)}>🪶 Dust the cabinet</button>
              <p className="dusted">Dusted {dusted} times</p>
            </div>
          );
        }
      `,
      hints: [
        md`Plaque: change the parameter to \`{ title, metal = 'bronze' }\` and delete \`Plaque.defaultProps = ...\`. Lamp: move \`const GlowingLamp = withGlow(Lamp);\` out of \`App\`, below the \`Lamp\` function.`,
        md`For the runes, add \`const RuneContext = createContext(null);\`. \`RuneGroup\` returns \`<RuneContext value={{ value, onPick }}><div className="runes">{children}</div></RuneContext>\` — no more \`Children.map\`.`,
        md`\`Rune({ value, children })\` reads \`const group = use(RuneContext);\` (import \`use\` and \`createContext\`), sets \`const selected = group.value === value;\` and calls \`group.onPick(value)\` on click.`,
      ],
      tests: [
        test('Plaques fall back to bronze with a default parameter', (t) => {
          const Plaque = getComponent(t, 'Plaque', 'Keep export function Plaque({ title, metal }) { ... }.');
          // Rendered through the JSX runtime (like the player's own JSX): React 19's legacy
          // createElement still applies defaultProps, the JSX runtime does not.
          renderOrExplain(
            t,
            jsx('div', { children: [jsx(Plaque, { title: 'Bell Tower' }, 'a'), jsx(Plaque, { title: 'Sun Gate', metal: 'gold' }, 'b')] }),
            'Check how Plaque renders.',
          );
          const texts = t.$$('.plaque').map((p) => norm(p.textContent));
          t.expect(
            texts[0] === '🏅 Bell Tower — cast in bronze',
            `<Plaque title="Bell Tower" /> reads "${texts[0]}" — expected "🏅 Bell Tower — cast in bronze". React 19 ignores defaultProps on function components: write function Plaque({ title, metal = 'bronze' }).`,
          );
          t.expect(texts[1] === '🏅 Sun Gate — cast in gold', `<Plaque title="Sun Gate" metal="gold" /> reads "${texts[1]}" — expected "🏅 Sun Gate — cast in gold".`);
          t.expect(!/\bdefaultProps\b/.test(stripComments(t.source)), 'Delete the Plaque.defaultProps line: React 19 ignores it, so it only misleads the next reader.');
        }),
        test('Runes light up and report the pick, even inside wrappers', (t) => {
          renderOrExplain(t, undefined, 'Check how App renders.');
          const runeButton = (label) => {
            const found = t.$$('.rune').find((b) => norm(b.textContent).includes(label));
            t.expect(found, `Could not find the "${label}" rune (a <button className="rune">).`);
            return found;
          };
          const selected = () => t.$$('.rune.selected').map((b) => norm(b.textContent));
          t.expect(
            selected().join('|') === '💧 Water',
            `At the start the selected rune(s) are ${show(selected())} — expected only "💧 Water". Runes wrapped in <div className="rune-row"> never receive props from cloneElement: read the group's value from context instead.`,
          );
          attempt(() => t.click(runeButton('Fire')), 'Rune should call the onPick it reads from the RuneGroup context.');
          t.expect(
            norm(t.find('.chosen').textContent) === 'Chosen rune: fire',
            `After clicking Fire the cabinet says "${norm(t.find('.chosen').textContent)}" — expected "Chosen rune: fire". Rune's click should call onPick(value) from the context.`,
          );
          t.expect(selected().join('|') === '🔥 Fire', `After clicking Fire the selected rune(s) are ${show(selected())} — expected only "🔥 Fire".`);
          const RuneGroup = getComponent(t, 'RuneGroup', 'Keep export function RuneGroup({ value, onPick, children }) { ... }.');
          const Rune = getComponent(t, 'Rune', 'Keep export function Rune({ value, children }) { ... }.');
          const h = t.h;
          const onPick = spy();
          function Shelf({ children }) {
            return h('section', { className: 'shelf' }, h('span', null, children));
          }
          renderOrExplain(
            t,
            h(RuneGroup, { value: 'ice', onPick }, h(Shelf, null, h(Rune, { value: 'ice' }, '❄️ Ice')), h(t.React.Fragment, null, h('div', null, h(Rune, { value: 'bolt' }, '⚡ Bolt')))),
            'Rune should read value and onPick from the RuneGroup context.',
          );
          t.expect(selected().join('|') === '❄️ Ice', `In a group with value="ice" (runes inside a custom Shelf component and a fragment), the selected rune(s) are ${show(selected())} — expected only "❄️ Ice".`);
          attempt(() => t.click(runeButton('Bolt')), 'Rune should call the onPick it reads from the RuneGroup context.');
          t.expect(
            onPick.calls.length === 1 && onPick.calls[0][0] === 'bolt',
            `Clicking the Bolt rune called onPick with ${onPick.calls.length ? show(onPick.calls[0][0]) : 'nothing'} — expected "bolt".`,
          );
        }),
        test('The lamp stays lit while the cabinet is dusted', (t) => {
          renderOrExplain(t, undefined, 'Check how App renders.');
          t.click(t.find('.lamp'));
          t.expect(norm(t.find('.lamp').textContent) === '💡 Lit', `After clicking the lamp it reads "${norm(t.find('.lamp').textContent)}" — expected "💡 Lit".`);
          t.click(t.button('Dust the cabinet'));
          t.click(t.button('Dust the cabinet'));
          t.expect(norm(t.find('.dusted').textContent) === 'Dusted 2 times', `After dusting twice the cabinet reads "${norm(t.find('.dusted').textContent)}" — expected "Dusted 2 times".`);
          t.expect(
            norm(t.find('.lamp').textContent) === '💡 Lit',
            `After dusting, the lamp reads "${norm(t.find('.lamp').textContent)}" — it forgot it was lit. withGlow(Lamp) runs inside App, so every App render creates a new component type and React remounts the lamp. Move const GlowingLamp = withGlow(Lamp); to the top level of the file.`,
          );
          t.expect(t.$('.glow .lamp'), 'Keep the lamp wrapped by withGlow: render <GlowingLamp /> (it adds the <div className="glow">).');
        }),
      ],
      css: `${PAVILION_CSS}
.plaque { background: linear-gradient(90deg, #fde68a, #f59e0b); color: #451a03; border-radius: 8px; padding: 6px 10px; font-weight: 700; }
.runes { display: grid; gap: 6px; margin: 10px 0; }
.rune-row { display: flex; gap: 6px; }
.stall .rune { background: #fbcfe8; color: #831843; box-shadow: none; }
.stall .rune.selected { background: #7c3aed; color: #fff; box-shadow: 0 0 12px #a78bfa; }
.glow { display: inline-block; padding: 6px; border-radius: 12px; background: radial-gradient(circle, #fef08a, transparent 70%); }
.stall .lamp { background: #1f2937; }
.chosen, .dusted { font-weight: 700; }
`,
      concepts: [
        {
          id: 'pavilion-hoc',
          icon: '🎁',
          title: 'Higher-order components',
          summary: 'withX(Component) returns a new component. Legacy pattern: prefer hooks or wrapper components.',
          snippet: code`
            const GlowingLamp = withGlow(Lamp); // ✅ once, at the top level
            function App() {
              // ❌ const GlowingLamp = withGlow(Lamp); — new type every render
              return <GlowingLamp />;
            }
          `,
          detail: 'Creating a component during render gives React a new type each time, so it remounts it and the state is lost.',
        },
        {
          id: 'pavilion-react19-removals',
          icon: '🗑️',
          title: 'React 19 removals',
          summary: 'defaultProps on functions, propTypes, string refs, ReactDOM.render, legacy context: gone.',
          snippet: code`
            // ❌ Plaque.defaultProps = { metal: 'bronze' };   (ignored)
            function Plaque({ title, metal = 'bronze' }) { ... }  // ✅
          `,
          detail: 'Children.map + cloneElement still exist but are legacy: they only reach direct children. Use context for compound components.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'pavilion-appraisal',
      type: 'quiz',
      title: "The Appraiser's Trial",
      blurb: 'Eight questions on patterns old and new. Tell an heirloom from a modern masterpiece.',
      xp: 100,
      story: [
        { text: "Before anyone may face the beast behind the notice board, Old Appraiser Quill examines their eye for patterns. Old ones, new ones, and the ones React 19 threw out.", mood: 'happy' },
      ],
      task: md`Answer each question. Every answer comes with an explanation, so even a wrong turn teaches you something.`,
      questions: [
        q(
          'What is `withLogger` here?\n\n```jsx\nfunction withLogger(Component) {\n  return function Logged(props) {\n    console.log(\'render\', props);\n    return <Component {...props} />;\n  };\n}\n\nexport default withLogger(Profile);\n```',
          ['A custom hook', 'A render prop', 'A higher-order component: a function that takes a component and returns a new one', 'A context provider'],
          2,
          'It takes `Profile` and returns a new component that wraps it: a **higher-order component**. HOCs were the main way to share logic before hooks (`connect()`, `withRouter()`). For new code, a custom hook usually does the same job without the extra wrapper.',
        ),
        q(
          'Which hook code does the same job as this class?\n\n```jsx\nclass Clock extends Component {\n  componentDidMount() {\n    this.id = setInterval(this.tick, 1000);\n  }\n  componentWillUnmount() {\n    clearInterval(this.id);\n  }\n  // ...\n}\n```',
          [
            '`useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);`',
            '`useEffect(() => { setInterval(tick, 1000); });`',
            '`useState(() => setInterval(tick, 1000));`',
            '`useRef(setInterval(tick, 1000));`',
          ],
          0,
          '`componentDidMount` becomes an effect with `[]` (run after the first render), and `componentWillUnmount` becomes the **cleanup** it returns. The second option starts a new interval after every render and never clears any.',
        ),
        q(
          'How do you translate this to a function component?\n\n```jsx\ncomponentDidUpdate(prevProps) {\n  if (prevProps.roomId !== this.props.roomId) {\n    this.loadRoom(this.props.roomId);\n  }\n}\n```',
          [
            '`useEffect(() => loadRoom(roomId));` with no dependency array',
            '`useMemo(() => loadRoom(roomId), []);`',
            'Call `loadRoom(roomId)` directly in the component body',
            '`useEffect(() => { loadRoom(roomId); }, [roomId]);`',
          ],
          3,
          'The dependency array does the `prevProps` comparison for you: the effect re-runs only when `roomId` changed. It also runs after the first render, which a class needed `componentDidMount` for. Effects think in "keep in sync with `roomId`", not in lifecycle moments.',
        ),
        q(
          'In React 19, what className does `<Badge />` get?\n\n```jsx\nfunction Badge({ tone }) {\n  return <span className={\'badge \' + tone}>New</span>;\n}\nBadge.defaultProps = { tone: \'gold\' };\n```',
          ['`badge gold`', '`badge undefined`', 'React throws an error', '`badge`'],
          1,
          'React 19 removed `defaultProps` for function components and ignores them **silently**: no error, no warning. `tone` is `undefined`, and `\'badge \' + undefined` is `"badge undefined"`. Fix: `function Badge({ tone = \'gold\' })`.',
        ),
        q(
          'Which of these still works in React 19?',
          [
            '`Button.propTypes = { size: PropTypes.string }` warning you about wrong props at runtime',
            '`<input ref="name" />` string refs in a class component',
            '`ReactDOM.render(<App />, rootElement)`',
            '`static defaultProps = { size: \'md\' }` on a **class** component',
          ],
          3,
          'Only function components lost `defaultProps`; classes keep them. `propTypes` checks were removed (use TypeScript), string refs are gone (use `useRef` or ref callbacks), and `ReactDOM.render` was replaced by `createRoot(rootElement).render(<App />)`.',
        ),
        q(
          'Item `b` never looks active. Why?\n\n```jsx\nfunction Menu({ active, children }) {\n  return Children.map(children, (child) =>\n    cloneElement(child, { active: child.props.id === active })\n  );\n}\n\n<Menu active="b">\n  <Item id="a" />\n  <Tooltip text="Second">\n    <Item id="b" />\n  </Tooltip>\n</Menu>\n```',
          [
            '`Children.map` skips every second child',
            '`cloneElement` cannot add boolean props',
            '`cloneElement` only reaches direct children: the `Tooltip` receives `active`, and the `Item` inside it gets nothing',
            'Item ids must be numbers',
          ],
          2,
          'The direct child is the `Tooltip`, so that is what gets cloned (with `child.props.id` undefined, too). This fragility is why modern compound components share state through **context**: every part reads it, at any depth.',
        ),
        q(
          'Which of these is allowed?',
          [
            '`if (sealed) { const guild = use(GuildContext); }` while rendering a component',
            '`if (sealed) { const guild = useContext(GuildContext); }` while rendering a component',
            '`onClick={() => alert(use(GuildContext).name)}`',
            'A plain helper `function crestOf() { return use(GuildContext).crest; }` called from an event handler',
          ],
          0,
          'Unlike hooks, `use` may be called inside conditions and loops. But like hooks it only works **while rendering** a component or custom hook, never in event handlers or helpers called from them. `useContext` inside an `if` breaks the Rules of Hooks.',
        ),
        q(
          'An old library shares the mouse position like this:\n\n```jsx\n<MousePosition>\n  {(pos) => <Cursor x={pos.x} y={pos.y} />}\n</MousePosition>\n```\n\nWriting a new library today, what is the usual choice for sharing this stateful logic?',
          [
            'A higher-order component, `withMousePosition(Cursor)`',
            'A custom hook: `const pos = useMousePosition();`',
            'A global variable updated by a `mousemove` listener',
            'Copy the listener code into every component that needs it',
          ],
          1,
          'Sharing **stateful logic** is exactly what custom hooks are for: no extra component, no nesting. Render props are still great when callers should customise **markup** with your data (`renderItem`), and a render-prop component can simply call the hook.',
        ),
      ],
      concepts: [
        {
          id: 'pavilion-class-to-hooks',
          icon: '🔁',
          title: 'Class lifecycles → hooks',
          summary: 'didMount/willUnmount → useEffect(..., []) + cleanup; didUpdate(prevProps) → useEffect(..., [dep]).',
          snippet: code`
            useEffect(() => {
              const id = setInterval(tick, 1000);  // componentDidMount
              return () => clearInterval(id);      // componentWillUnmount
            }, []);
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'pavilion-hydra',
      type: 'build',
      boss: true,
      bossName: 'The Prop Hydra',
      bossIcon: '🐉',
      title: 'Boss: The Prop Hydra',
      blurb: 'Every new need grew another boolean head. Cut them all off: rebuild the Notice as a compound component.',
      xp: 300,
      badge: { id: 'badge-pavilion', name: 'Master Artisan', icon: '🧩', description: 'Tamed the Prop Hydra in the Pattern Pavilion.' },
      story: [
        { text: "HSSSS! The Prop Hydra has coiled around the notice board. Every time someone needed a slightly different notice, it grew a new head: showIcon, dismissible, showFooter, compact...", mood: 'worried' },
        { text: "Look at its Notice in the editor: eleven props, a thicket of && checks, and STILL nobody can put a close button in the footer. Cut off one head and two more grow back.", mood: 'thinking' },
        { text: 'Starve it instead! Parts instead of flags: rebuild Notice as a compound component with everything this pavilion taught you.', mood: 'excited' },
      ],
      lesson: md`
        ## Your Pavilion toolkit

        | Pattern | Remember |
        |---|---|
        | Compound components | a parent owns the state, parts read it from context |
        | \`use(Context)\` | may sit after an early return; still only while rendering |
        | Provider guard | \`createContext(null)\`, then throw a helpful error |
        | Slots | props that hold JSX |
        | Render props | functions that return JSX, called with your data |
        | Controlled or not | \`open\` + \`onOpenChange\`, or \`defaultOpen\` |

        ## How the Hydra grows

        Every request adds a flag: \`showIcon\`, then \`dismissible\`, then \`showFooter\`, then
        \`footerAction\`... Each flag doubles the number of combinations to test, the
        component fills with \`&&\`, and callers *still* can't do the one thing you didn't
        foresee (a close button in the footer? a link in the title?).

        ## Parts instead of flags

        Turn every optional region into a **part** and let callers compose:

        \`\`\`jsx
        // 🐉 before
        <Notice title="Dragon sighted" showIcon icon="🐉" dismissible
                body="Keep the lanterns lit." showFooter={false} />

        // 🧩 after
        <Notice tone="danger">
          <Notice.Title icon="🐉">Dragon sighted</Notice.Title>
          <Notice.Body>Keep the lanterns lit.</Notice.Body>
          <Notice.Close />
        </Notice>
        \`\`\`

        No icon? Don't pass one. No footer? Leave it out. Close button in the footer? Put it
        there. The component gets *smaller* as it gets more flexible.

        ## Sketch of the root

        \`\`\`jsx
        const NoticeContext = createContext(null);

        function Notice({ tone = 'info', open, defaultOpen = true, onOpenChange, children }) {
          const [innerOpen, setInnerOpen] = useState(defaultOpen);
          const isControlled = open !== undefined;
          const isOpen = isControlled ? open : innerOpen;

          function close() {
            if (!isControlled) setInnerOpen(false);
            if (onOpenChange) onOpenChange(false);
          }

          if (!isOpen) return null;
          return (
            <NoticeContext value={{ close }}>
              <div className={'notice ' + tone}>{children}</div>
            </NoticeContext>
          );
        }
        \`\`\`

        Note the order: the hook runs first, *then* the early return (Rules of Hooks). And
        \`Notice.Close\` reads the context with \`use\`, throwing a helpful error when it's
        been placed outside a Notice.

        :::tip
        A good smell test for any component API: when a new need arrives, can callers meet it
        by **composing** what exists, or do you have to add another prop? Composition keeps the
        Hydra away.
        :::

        :::pro
        Real libraries go further: \`asChild\` props, keyboard handling and focus management. The
        heart is the same compound pattern you just learned.
        :::
      `,
      task: md`
        ## 👑 Starve the Hydra

        Replace the Hydra's \`Notice\` with a compound component (all parts exported via \`Notice\`):

        1. \`export function Notice({ tone = 'info', open, defaultOpen = true, onOpenChange, children })\`:
           - **controlled or uncontrolled** open state, like the Two-Way Lever: \`open\` controls it,
             otherwise it keeps its own state starting at \`defaultOpen\`;
           - when closed it renders \`null\`; when open \`<div className={'notice ' + tone}>{children}</div>\`;
           - it provides a \`close\` function to its parts: closing sets its own state (uncontrolled)
             and calls \`onOpenChange(false)\` when given.
        2. \`Notice.Title({ icon, children })\` renders \`<h3 className="notice-title">\`. When an
           \`icon\` is passed, it starts with \`<span className="icon">{icon}</span>\`, then a space and the children.
        3. \`Notice.Body\` renders \`<div className="notice-body">\` and \`Notice.Footer\` renders
           \`<div className="notice-footer">\`, each around its children.
        4. \`Notice.Close({ children })\` renders \`<button className="notice-close">\` showing its
           children, or **✕** when it has none. A click closes the nearest Notice. Outside a
           Notice it must throw an \`Error\` whose message contains \`<Notice>\`.
        5. Rebuild \`App\`'s \`<div className="board">\` with the parts, same texts, same order:
           - \`tone="danger"\`: title 🐉 **Dragon sighted**, body **Keep the lanterns lit tonight.**, a ✕ close button.
           - \`tone="info"\`: title **Market day** (no icon), body **Stalls open at dawn.**, footer **Bring your own basket.**
           - \`tone="success"\`, **controlled** by App's \`questOpen\` state: title 🏆 **Quest complete**,
             body **The Hydra is defeated!**, and a footer holding a \`Notice.Close\` that reads **Collect reward**.

        Keep \`<p className="reward">\`. When you're done, none of the Hydra's flag props
        (\`showIcon\`, \`dismissible\`, \`showFooter\`, \`compact\`) may remain.
      `,
      starter: code`
        import { useState } from 'react';

        // 🐉 The Prop Hydra: every new need grew another prop.
        export function Notice({
          title, icon, showIcon, body, dismissible, showFooter, footerText,
          footerClose, closeLabel, tone = 'info', compact,
        }) {
          const [open, setOpen] = useState(true);
          if (!open) return null;
          return (
            <div className={'notice ' + tone + (compact ? ' compact' : '')}>
              <h3 className="notice-title">
                {showIcon && <span className="icon">{icon}</span>} {title}
              </h3>
              {body && <div className="notice-body">{body}</div>}
              {showFooter && (
                <div className="notice-footer">
                  {footerText}
                  {footerClose && (
                    <button className="notice-close" onClick={() => setOpen(false)}>
                      {closeLabel}
                    </button>
                  )}
                </div>
              )}
              {dismissible && (
                <button className="notice-close" onClick={() => setOpen(false)}>
                  ✕
                </button>
              )}
            </div>
          );
        }

        // TODO: Notice.Title, Notice.Body, Notice.Footer, Notice.Close

        export default function App() {
          const [questOpen, setQuestOpen] = useState(true);

          return (
            <div className="stall">
              <h2>📜 The Notice Board</h2>
              <div className="board">
                <Notice tone="danger" title="Dragon sighted" showIcon icon="🐉"
                  body="Keep the lanterns lit tonight." dismissible compact={false} />
                <Notice tone="info" title="Market day" showIcon={false}
                  body="Stalls open at dawn." showFooter footerText="Bring your own basket." />
                <Notice tone="success" title="Quest complete" showIcon icon="🏆"
                  body="The Hydra is defeated!" showFooter footerClose closeLabel="Collect reward" />
              </div>
              <p className="reward">{questOpen ? 'A reward is waiting…' : '💰 Reward collected!'}</p>
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, use, useState } from 'react';

        const NoticeContext = createContext(null);

        export function Notice({ tone = 'info', open, defaultOpen = true, onOpenChange, children }) {
          const [innerOpen, setInnerOpen] = useState(defaultOpen);
          const isControlled = open !== undefined;
          const isOpen = isControlled ? open : innerOpen;

          function close() {
            if (!isControlled) setInnerOpen(false);
            if (onOpenChange) onOpenChange(false);
          }

          if (!isOpen) return null;
          return (
            <NoticeContext value={{ close }}>
              <div className={'notice ' + tone}>{children}</div>
            </NoticeContext>
          );
        }

        function NoticeTitle({ icon, children }) {
          return (
            <h3 className="notice-title">
              {icon && <span className="icon">{icon}</span>}
              {icon && ' '}
              {children}
            </h3>
          );
        }

        function NoticeBody({ children }) {
          return <div className="notice-body">{children}</div>;
        }

        function NoticeFooter({ children }) {
          return <div className="notice-footer">{children}</div>;
        }

        function NoticeClose({ children }) {
          const notice = use(NoticeContext);
          if (notice === null) {
            throw new Error('Notice.Close must be used inside a <Notice>.');
          }
          return (
            <button className="notice-close" onClick={notice.close}>
              {children ?? '✕'}
            </button>
          );
        }

        Notice.Title = NoticeTitle;
        Notice.Body = NoticeBody;
        Notice.Footer = NoticeFooter;
        Notice.Close = NoticeClose;

        export default function App() {
          const [questOpen, setQuestOpen] = useState(true);

          return (
            <div className="stall">
              <h2>📜 The Notice Board</h2>
              <div className="board">
                <Notice tone="danger">
                  <Notice.Title icon="🐉">Dragon sighted</Notice.Title>
                  <Notice.Body>Keep the lanterns lit tonight.</Notice.Body>
                  <Notice.Close />
                </Notice>
                <Notice tone="info">
                  <Notice.Title>Market day</Notice.Title>
                  <Notice.Body>Stalls open at dawn.</Notice.Body>
                  <Notice.Footer>Bring your own basket.</Notice.Footer>
                </Notice>
                <Notice tone="success" open={questOpen} onOpenChange={setQuestOpen}>
                  <Notice.Title icon="🏆">Quest complete</Notice.Title>
                  <Notice.Body>The Hydra is defeated!</Notice.Body>
                  <Notice.Footer>
                    <Notice.Close>Collect reward</Notice.Close>
                  </Notice.Footer>
                </Notice>
              </div>
              <p className="reward">{questOpen ? 'A reward is waiting…' : '💰 Reward collected!'}</p>
            </div>
          );
        }
      `,
      hints: [
        md`Start with the root: a \`NoticeContext = createContext(null)\`, then in \`Notice\` the Two-Way Lever trio: \`useState(defaultOpen)\`, \`const isControlled = open !== undefined;\`, \`const isOpen = isControlled ? open : innerOpen;\`. Write a \`close()\` that sets your state only when uncontrolled and calls \`onOpenChange(false)\` if given. Return \`null\` when closed, else wrap the \`<div>\` in \`<NoticeContext value={{ close }}>\`.`,
        md`The parts are tiny: \`function NoticeBody({ children }) { return <div className="notice-body">{children}</div>; }\`. For the title: \`{icon && <span className="icon">{icon}</span>}{icon && ' '}{children}\`. Attach each one: \`Notice.Body = NoticeBody;\`.`,
        md`\`NoticeClose\`: \`const notice = use(NoticeContext); if (notice === null) throw new Error('Notice.Close must be used inside a <Notice>.');\` then \`<button className="notice-close" onClick={notice.close}>{children ?? '✕'}</button>\`. In App, the quest notice is \`<Notice tone="success" open={questOpen} onOpenChange={setQuestOpen}>\` with \`<Notice.Footer><Notice.Close>Collect reward</Notice.Close></Notice.Footer>\` inside.`,
      ],
      tests: [
        test('Notice and its parts compose in any order and nesting', (t) => {
          const Notice = noticeFamily(t);
          const h = t.h;
          renderOrExplain(
            t,
            h(
              'div',
              null,
              h(
                Notice,
                { tone: 'calm' },
                h(Notice.Footer, null, 'Footer first'),
                h('div', { className: 'wrapper' }, h(Notice.Title, { icon: '⭐' }, 'Stars')),
                h(Notice.Body, null, h('em', null, 'Twinkle')),
              ),
              h(Notice, null, h(Notice.Title, null, 'Plain title')),
            ),
            'Each part should just render its element around children; Notice renders <div className={"notice " + tone}>.',
          );
          const notices = t.$$('.notice');
          t.expect(notices.length === 2, `Found ${notices.length} .notice elements — expected 2. An uncontrolled Notice starts open (defaultOpen = true).`);
          t.expect(notices[0].classList.contains('calm'), `The first notice has className "${notices[0].className}" — expected "notice calm" (tone="calm").`);
          t.expect(notices[1].classList.contains('info'), `A Notice without a tone has className "${notices[1].className}" — expected "notice info" (tone defaults to 'info').`);
          const title = notices[0].querySelector('h3.notice-title');
          t.expect(title, 'Notice.Title (even wrapped in a <div>) should render <h3 className="notice-title">.');
          t.expect(
            textOf(title.querySelector('.icon')) === '⭐' && norm(title.textContent) === '⭐ Stars',
            `<Notice.Title icon="⭐">Stars</Notice.Title> reads "${norm(title.textContent)}" — expected "⭐ Stars" with the icon in <span className="icon">.`,
          );
          const plain = notices[1].querySelector('h3.notice-title');
          t.expect(
            plain && !plain.querySelector('.icon') && norm(plain.textContent) === 'Plain title',
            `A Title without an icon should render just "Plain title", with no <span className="icon"> — got "${textOf(plain)}".`,
          );
          const footer = notices[0].querySelector('.notice-footer');
          const body = notices[0].querySelector('.notice-body');
          t.expect(footer && norm(footer.textContent) === 'Footer first', 'Notice.Footer should render <div className="notice-footer">{children}</div>.');
          t.expect(body && body.querySelector('em') && norm(body.textContent) === 'Twinkle', 'Notice.Body should render <div className="notice-body">{children}</div>, keeping any JSX children.');
          t.expect(footer.compareDocumentPosition(title) & 4, 'The parts should appear in the order the caller wrote them (here the footer comes first). Render {children} as given.');
        }),
        test('Notice.Close closes its own Notice, at any depth', (t) => {
          const Notice = noticeFamily(t);
          const h = t.h;
          renderOrExplain(
            t,
            h(
              'div',
              null,
              h(Notice, { tone: 'one' }, h(Notice.Title, null, 'First'), h(Notice.Footer, null, h('div', null, h('span', null, h(Notice.Close))))),
              h(Notice, { tone: 'two' }, h(Notice.Title, null, 'Second'), h(Notice.Close, null, 'Dismiss')),
              h(Notice, { tone: 'hidden', defaultOpen: false }, h(Notice.Title, null, 'Never shown')),
            ),
            'Notice.Close should read close() from the nearest Notice through context.',
          );
          t.expect(!t.$('.notice.hidden'), 'A Notice with defaultOpen={false} should render nothing (return null when closed).');
          const closes = t.$$('.notice-close');
          t.expect(closes.length === 2, `Found ${closes.length} .notice-close buttons — expected 2.`);
          t.expect(norm(closes[0].textContent) === '✕', `A Notice.Close with no children reads "${norm(closes[0].textContent)}" — expected "✕" (e.g. {children ?? '✕'}).`);
          t.expect(norm(closes[1].textContent) === 'Dismiss', `<Notice.Close>Dismiss</Notice.Close> reads "${norm(closes[1].textContent)}" — expected "Dismiss".`);
          attempt(() => t.click(closes[0]), 'Notice.Close should call the close function from the Notice context.');
          t.expect(!t.$('.notice.one'), 'Clicking the ✕ nested inside the first notice\'s footer (inside <div><span>) did not close it. Notice.Close should call close() from the context.');
          t.expect(t.$('.notice.two'), 'Closing the first notice also closed the second. Each Notice needs its own open state.');
          t.click(t.$('.notice.two .notice-close'));
          t.expect(t.count('.notice') === 0, 'Clicking "Dismiss" should close the second notice too.');
        }),
        test('Controlled: open + onOpenChange put the parent in charge', (t) => {
          const Notice = noticeFamily(t);
          const h = t.h;
          const onOpenChange = spy();
          renderOrExplain(t, h(Notice, { open: true, onOpenChange, tone: 'ruled' }, h(Notice.Close)), 'Check how Notice handles the open prop.');
          t.click(t.find('.notice-close'));
          t.expect(
            t.$('.notice.ruled'),
            'With open={true} and a parent that ignores onOpenChange, the notice closed itself. When open is passed, show it as given and only ask via onOpenChange(false).',
          );
          t.expect(
            onOpenChange.calls.length === 1 && onOpenChange.calls[0][0] === false,
            `Clicking close called onOpenChange with ${onOpenChange.calls.length ? show(onOpenChange.calls[0][0]) : 'nothing'} — expected false.`,
          );
          renderOrExplain(t, h(Notice, { open: false, onOpenChange, tone: 'ruled' }, h(Notice.Close)), 'Check how Notice handles the open prop.');
          t.expect(!t.$('.notice'), 'After the parent passed open={false}, the notice should disappear.');
          renderOrExplain(t, h(Notice, { open: true, onOpenChange, tone: 'ruled' }, h(Notice.Close)), 'Check how Notice handles the open prop.');
          t.expect(t.$('.notice.ruled'), 'After the parent passed open={true} again, the notice should reappear.');
          const listener = spy();
          renderOrExplain(t, h('div', null, h(Notice, { onOpenChange: listener, tone: 'free' }, h(Notice.Close))), 'Check how Notice handles onOpenChange.');
          t.click(t.find('.notice.free .notice-close'));
          t.expect(!t.$('.notice.free'), 'An uncontrolled Notice with an onOpenChange listener should still close itself.');
          t.expect(listener.calls.length === 1 && listener.calls[0][0] === false, 'An uncontrolled Notice should also report onOpenChange(false) when it closes.');
        }),
        test('Notice.Close outside a Notice throws a helpful error', (t) => {
          const Notice = noticeFamily(t);
          const error = renderCatching(t, t.h('div', null, t.h(Notice.Close)));
          t.expect(error, "A Notice.Close with no Notice above rendered without complaint. Read the context with use(NoticeContext) and, when it's null, throw new Error('Notice.Close must be used inside a <Notice>.').");
          const message = String(error.message || error);
          t.expect(
            message.includes('<Notice>'),
            `It threw "${message}". Make the message explain the fix and mention <Notice>, e.g. throw new Error('Notice.Close must be used inside a <Notice>.').`,
          );
        }),
        test('The notice board is rebuilt from parts, with no boolean heads left', (t) => {
          noticeFamily(t);
          renderOrExplain(t, undefined, 'Check how App renders the board.');
          const notices = t.$$('.board > .notice, .board .notice');
          const tones = notices.map((n) => ['danger', 'info', 'success'].find((c) => n.classList.contains(c)) || n.className);
          t.expect(tones.join(',') === 'danger,info,success', `The board's notices have tones ${show(tones)} — expected ["danger", "info", "success"] in that order.`);
          const titles = notices.map((n) => textOf(n.querySelector('.notice-title')));
          t.expect(
            titles.join('|') === '🐉 Dragon sighted|Market day|🏆 Quest complete',
            `The titles read ${show(titles)} — expected ["🐉 Dragon sighted", "Market day", "🏆 Quest complete"].`,
          );
          const bodies = notices.map((n) => textOf(n.querySelector('.notice-body')));
          t.expect(
            bodies.join('|') === 'Keep the lanterns lit tonight.|Stalls open at dawn.|The Hydra is defeated!',
            `The bodies read ${show(bodies)} — expected the texts from the task.`,
          );
          t.expect(textOf(notices[1].querySelector('.notice-footer')) === 'Bring your own basket.', 'The Market day notice needs <Notice.Footer>Bring your own basket.</Notice.Footer>.');
          const collect = notices[2].querySelector('.notice-footer .notice-close');
          t.expect(collect && norm(collect.textContent) === 'Collect reward', 'The quest notice needs <Notice.Footer><Notice.Close>Collect reward</Notice.Close></Notice.Footer>.');
          const reward = () => norm(t.find('.reward').textContent);
          t.click(collect);
          t.expect(
            reward() === '💰 Reward collected!',
            `After "Collect reward" the reward line reads "${reward()}" — expected "💰 Reward collected!". Control the quest notice: <Notice tone="success" open={questOpen} onOpenChange={setQuestOpen}>.`,
          );
          t.expect(!t.$('.notice.success'), 'After "Collect reward" the quest notice should be gone.');
          const dragonClose = t.find('.notice.danger .notice-close');
          t.expect(norm(dragonClose.textContent) === '✕', 'The dragon notice needs a <Notice.Close /> showing ✕.');
          t.click(dragonClose);
          t.expect(!t.$('.notice.danger') && t.$('.notice.info'), 'Clicking ✕ should close only the dragon notice.');
          const src = stripComments(t.source);
          const heads = ['showIcon', 'dismissible', 'showFooter', 'compact'].filter((p) => new RegExp('\\b' + p + '\\b').test(src));
          t.expect(heads.length === 0, `The Hydra still has ${heads.length} head(s): ${heads.join(', ')}. Remove those flag props: callers compose parts instead.`);
        }),
      ],
      css: `${PAVILION_CSS}
.board { display: grid; gap: 10px; }
.notice { position: relative; border-radius: 12px; padding: 10px 14px; background: #fff; border-left: 6px solid #60a5fa; box-shadow: 0 2px 0 #fbcfe8; }
.notice.danger { border-left-color: #ef4444; background: #fef2f2; }
.notice.success { border-left-color: #22c55e; background: #f0fdf4; }
.stall .notice-title { margin: 0 0 4px; font-size: 1.05em; }
.notice-body { color: #4a044e; }
.notice-footer { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #f9a8d4; font-size: 0.9em; }
.stall .notice-close { padding: 2px 10px; }
.notice > .notice-close { position: absolute; top: 8px; right: 8px; }
.reward { font-weight: 700; margin-top: 10px; }
`,
      concepts: [
        {
          id: 'pavilion-parts-not-flags',
          icon: '🐉',
          title: 'Parts instead of flags',
          summary: 'When boolean props multiply, split the component into composable parts.',
          snippet: code`
            // 🐉 <Notice showIcon dismissible showFooter footerText="..." />
            <Notice tone="danger">
              <Notice.Title icon="🐉">Dragon sighted</Notice.Title>
              <Notice.Close />
            </Notice>
          `,
          detail: 'Each flag doubles the combinations to support. Compound parts let callers meet new needs by composing instead of asking for another prop.',
        },
      ],
    },
  ],
};
