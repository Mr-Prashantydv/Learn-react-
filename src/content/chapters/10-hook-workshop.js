import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Check helpers (local to this chapter)
// ---------------------------------------------------------------------------

/** Whitespace-collapsed text. */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** A short, readable description of any value for failure messages. */
function show(value, depth = 0) {
  if (typeof value === 'function') return depth ? 'function' : 'a function';
  if (value === undefined) return 'undefined';
  if (value instanceof Error) return `Error("${value.message}")`;
  if (Array.isArray(value) && depth < 2) return `[${value.map((v) => show(v, depth + 1)).join(', ')}]`;
  if (value && typeof value === 'object' && depth < 2)
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${show(v, depth + 1)}`)
      .join(', ')} }`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Returns the named export or fails with a message showing how to export it. */
function requireExport(t, name, signature) {
  const fn = t.exports?.[name];
  t.expect(
    typeof fn === 'function',
    `No exported function named ${name} was found. Write it as a named export: export function ${signature} { ... }`,
  );
  return fn;
}

/**
 * Renders a tiny probe component that calls `useHook(props)` and remembers
 * what it returned, so checks can test a custom hook directly.
 */
function probeHook(t, useHook, props = {}) {
  const box = { value: undefined };
  function HookProbe(p) {
    box.value = useHook(p);
    return null;
  }
  const render = (p = {}) => t.render(t.h(HookProbe, p));
  render(props);
  return {
    get value() {
      return box.value;
    },
    rerender: render,
  };
}

/** Calls a function returned by a hook (toggle, setValue, start...) inside act. */
function callInAct(t, fn, label) {
  t.expect(typeof fn === 'function', `${label} is not a function.`);
  try {
    t.act(() => {
      fn();
    });
  } catch (err) {
    throw new Error(`Calling ${label} crashed: ${err?.message || err}`);
  }
}

/** Runs an interaction and turns a React crash into a specific, friendly message. */
function attempt(action, advice) {
  try {
    return action();
  } catch (err) {
    const why = String(err?.message || err).replace(/^Your component crashed:\s*/, '');
    throw new Error(`React crashed: "${why}" ${advice}`);
  }
}

const countMatches = (source, regex) => (source.match(regex) || []).length;

/** Source with JS comments removed, so commented-out code doesn't count. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** How many times `name(` is called, not counting a `function name(` definition. */
const callSites = (source, name) =>
  countMatches(source.replace(new RegExp(`function\\s+${name}\\s*\\(`, 'g'), ''), new RegExp(`\\b${name}\\s*\\(`, 'g'));

/** Joins de-indented code pieces with a blank line between them. */
const joinCode = (...pieces) => pieces.join('\n');

/** Text of each matching element with any leading emoji/punctuation removed. */
const labels = (t, sel) => t.$$(sel).map((el) => norm(el.textContent).replace(/^[^A-Za-z0-9]+/, ''));

// ---------------------------------------------------------------------------
// Fake API data
// ---------------------------------------------------------------------------

const BLUEPRINTS = [
  { id: 1, name: 'Clockwork owl' },
  { id: 2, name: 'Steam kettle' },
  { id: 3, name: 'Pocket orrery' },
];
const HAND_TOOLS = ['Hammer', 'Wrench', 'Screwdriver'];
const POWER_TOOLS = ['Steam drill', 'Gear press'];

const PARTS = [
  { id: 1, name: 'Brass gear' },
  { id: 2, name: 'Copper gear' },
  { id: 3, name: 'Gear shaft' },
  { id: 4, name: 'Steam valve' },
  { id: 5, name: 'Spring coil' },
  { id: 6, name: 'Pressure gauge' },
];

const partsRoute = (url) => {
  const query = (new URL(url, 'http://workshop.local').searchParams.get('q') || '').toLowerCase();
  return PARTS.filter((part) => part.name.toLowerCase().includes(query));
};

const WORKSHOP_CSS = `
.workshop {
  background: linear-gradient(160deg, #fff8e8, #fde9c4);
  border: 3px solid #b7791f;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 4px 0 #8a5a14;
}
.workshop h2 { color: #7b4a0e; }
.workshop h3 { color: #8a5a14; margin-top: 10px; }
.workshop button { background: #b7791f; box-shadow: 0 3px 0 #7b5114; }
.workshop button:hover { background: #d69e2e; }
.loading { color: #8a6d3b; font-style: italic; }
.error { color: #c92a2a; font-weight: 700; }
`;

// ---------------------------------------------------------------------------
// Shared starter code (useFetch) for the debounce quest
// ---------------------------------------------------------------------------

const USE_FETCH_SOURCE = code`
  export function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      let ignore = false;
      setLoading(true);
      setError(null);
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('Request failed: ' + res.status);
          return res.json();
        })
        .then((json) => {
          if (!ignore) {
            setData(json);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setError(err);
            setLoading(false);
          }
        });
      return () => {
        ignore = true;
      };
    }, [url]);

    return { data, loading, error };
  }
`;

export default {
  id: 'hook-workshop',
  file: '10-hook-workshop.js',
  title: 'Hook Workshop',
  short: 'Hooks',
  subtitle: 'Master the Rules of Hooks and forge your own reusable custom hooks.',
  icon: '🪝',
  colors: ['#451a03', '#f59e0b'],
  scenery: ['⚙️', '🔩', '🪝', '🔧', '🧰', '🪛', '⏱️', '💡'],
  intro: [
    { text: 'Welcome to the Hook Workshop! Gears, springs, little brass contraptions everywhere... and every one of them runs on hooks.', mood: 'excited' },
    { text: 'Master Tinker Gretta Gearwright builds reusable gizmos here, with her clockwork apprentice Bolt. Today she takes on a new apprentice: you!', mood: 'happy' },
    { text: 'But beware the Hook Breaker. He calls hooks wherever he pleases (inside ifs, inside loops) and jams every machine he touches.', mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'hook-rules',
      type: 'bug',
      title: 'The Jammed Gears',
      blurb: 'Bug hunt! Two rule-breaking hooks have seized up the workshop.',
      xp: 130,
      story: [
        { text: "Clank! KRRRK! Bolt's workbench seizes up the moment you open it, and forging a new gear jams the whole rack.", mood: 'worried' },
        { text: 'Hooks have two golden rules. Break them and React loses track of which state belongs where. Read the lesson, then free those gears!', mood: 'thinking' },
      ],
      lesson: md`
        ## What makes a hook a hook?

        Every function whose name starts with \`use\` (\`useState\`, \`useEffect\`, \`useRef\`,
        \`useReducer\`, \`useContext\`...) is a **Hook**. Hooks let a function component
        "hook into" React features like state and effects. They come with two rules.

        ## The Rules of Hooks

        1. **Only call hooks at the top level** of your component: not inside \`if\`s, loops or nested functions, and not after an early \`return\`.
        2. **Only call hooks from React functions**: function components and custom hooks (you will write your own very soon). Never from plain functions or event handlers.

        ## Why? Hooks are matched by call order

        React never sees your variable names. For each component instance it keeps a list
        of **hook slots**, and hands them out **in the order your hooks are called**:

        \`\`\`jsx
        function Workbench() {
          const [tool, setTool] = useState('🔨 hammer'); // slot 1
          const [oil, setOil] = useState(3);             // slot 2
          useEffect(() => { /* ... */ });                // slot 3
        }
        \`\`\`

        On every render React walks the list again: first hook call → slot 1, second →
        slot 2, and so on. As long as the order never changes, everything lines up. Now
        watch what an early return does:

        \`\`\`jsx
        function Workbench({ open }) {
          const [tool, setTool] = useState('🔨 hammer'); // slot 1
          if (!open) return <p>Closed</p>;               // 🛑 stops here when closed
          const [oil, setOil] = useState(3);             // slot 2... only sometimes!
        }
        \`\`\`

        | Render | open | Hooks called |
        |---|---|---|
        | 1st | false | \`useState('🔨 hammer')\` |
        | 2nd | true | \`useState('🔨 hammer')\`, \`useState(3)\`: one more than last time! |

        React can't know which slot \`oil\` should get, so it crashes with
        *"Rendered more hooks than during the previous render."* (or, the other way round,
        *"Rendered fewer hooks than expected"*). A hook inside a loop has the same
        problem: when the array grows, the number of hook calls changes.

        ## How to fix it

        **Call the hook above the early return**, every render, even if this render won't use it:

        \`\`\`jsx
        function Workbench({ open }) {
          const [tool, setTool] = useState('🔨 hammer');
          const [oil, setOil] = useState(3);   // ✅ always called
          if (!open) return <p>Closed</p>;
          // ...
        }
        \`\`\`

        **Put conditions inside the hook**, not around it:

        \`\`\`jsx
        // ❌ if (open) { useEffect(() => { ... }); }
        useEffect(() => {
          if (!open) return;   // ✅ the condition lives inside
          // ...
        }, [open]);
        \`\`\`

        **Need state for every list item? Extract a component.** Each component instance
        gets its own hook slots:

        \`\`\`jsx
        function Gear({ name }) {
          const [spins, setSpins] = useState(0); // ✅ top level of Gear
          return <button onClick={() => setSpins(spins + 1)}>{name}: {spins}</button>;
        }

        // in the parent:
        {gears.map((gear) => <Gear key={gear.id} name={gear.name} />)}
        \`\`\`

        :::mistake
        Calling a hook inside an event handler: \`onClick={() => { const [x, setX] = useState(0); }}\`.
        Hooks only work *while the component renders*. Declare the state at the top of the
        component and call its setter in the handler.
        :::

        :::tip
        Real projects use the \`eslint-plugin-react-hooks\` linter, which underlines
        rule-breaking hooks as you type. Vite's React template includes it.
        :::

        :::pro
        React 19's \`use\` API (you'll meet it in the Arcane Spire) is the one exception: it
        may be called inside conditions and loops. Every \`useSomething\` hook still follows
        the rules.
        :::
      `,
      task: md`
        ## 🐛 Unjam the workshop

        The preview looks fine... until you click. Two hooks break the rules:

        1. **Open the bench** crashes: in \`Workbench\`, the \`oil\` state is declared *after* an early \`return\`. Move it up so every hook runs on every render.
        2. **Forge a gear** crashes: \`GearRack\` calls \`useState\` inside \`gears.map(...)\`. Extract a \`Gear\` component that owns its own \`spins\` state and renders the \`<button className="gear">\`.
        3. The oil level must **survive** closing and reopening the bench (keep \`Workbench\` rendered all the time; only its output changes).
        4. Keep the texts: the oil line reads **Oil: 3** and each gear button reads like **⚙️ Brassy: 0**.

        The checks will open and close the bench, use oil, forge gears and spin them.
      `,
      starter: code`
        import { useState } from 'react';

        const GEAR_NAMES = ['Brassy', 'Copperpot', 'Ticktock', 'Sprocket', 'Whirligig'];

        function Workbench({ open }) {
          const [tool, setTool] = useState('🔨 hammer');

          if (!open) {
            return <p className="closed">🔒 The bench is closed.</p>;
          }

          // 🐛 Bug 1: this hook is skipped whenever the bench is closed!
          const [oil, setOil] = useState(3);

          return (
            <div className="bench">
              <p className="tool">Tool: {tool}</p>
              <button onClick={() => setTool(tool === '🔨 hammer' ? '🔧 wrench' : '🔨 hammer')}>Swap tool</button>
              <p className="oil">Oil: {oil}</p>
              <button onClick={() => setOil(oil - 1)} disabled={oil === 0}>
                Use oil
              </button>
            </div>
          );
        }

        function GearRack({ gears }) {
          return (
            <div className="rack">
              {gears.map((gear) => {
                // 🐛 Bug 2: a hook inside a loop!
                const [spins, setSpins] = useState(0);
                return (
                  <button key={gear.id} className="gear" onClick={() => setSpins(spins + 1)}>
                    ⚙️ {gear.name}: {spins}
                  </button>
                );
              })}
            </div>
          );
        }

        export default function App() {
          const [open, setOpen] = useState(false);
          const [gears, setGears] = useState([{ id: 1, name: 'Brassy' }]);

          function forgeGear() {
            const id = gears.length + 1;
            setGears([...gears, { id, name: GEAR_NAMES[(id - 1) % GEAR_NAMES.length] }]);
          }

          return (
            <div className="workshop">
              <h2>🛠️ Bolt's Workshop</h2>
              <button onClick={() => setOpen(!open)}>{open ? 'Close the bench' : 'Open the bench'}</button>
              <Workbench open={open} />
              <button onClick={forgeGear}>Forge a gear</button>
              <GearRack gears={gears} />
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const GEAR_NAMES = ['Brassy', 'Copperpot', 'Ticktock', 'Sprocket', 'Whirligig'];

        function Workbench({ open }) {
          const [tool, setTool] = useState('🔨 hammer');
          const [oil, setOil] = useState(3);

          if (!open) {
            return <p className="closed">🔒 The bench is closed.</p>;
          }

          return (
            <div className="bench">
              <p className="tool">Tool: {tool}</p>
              <button onClick={() => setTool(tool === '🔨 hammer' ? '🔧 wrench' : '🔨 hammer')}>Swap tool</button>
              <p className="oil">Oil: {oil}</p>
              <button onClick={() => setOil(oil - 1)} disabled={oil === 0}>
                Use oil
              </button>
            </div>
          );
        }

        function Gear({ name }) {
          const [spins, setSpins] = useState(0);
          return (
            <button className="gear" onClick={() => setSpins(spins + 1)}>
              ⚙️ {name}: {spins}
            </button>
          );
        }

        function GearRack({ gears }) {
          return (
            <div className="rack">
              {gears.map((gear) => (
                <Gear key={gear.id} name={gear.name} />
              ))}
            </div>
          );
        }

        export default function App() {
          const [open, setOpen] = useState(false);
          const [gears, setGears] = useState([{ id: 1, name: 'Brassy' }]);

          function forgeGear() {
            const id = gears.length + 1;
            setGears([...gears, { id, name: GEAR_NAMES[(id - 1) % GEAR_NAMES.length] }]);
          }

          return (
            <div className="workshop">
              <h2>🛠️ Bolt's Workshop</h2>
              <button onClick={() => setOpen(!open)}>{open ? 'Close the bench' : 'Open the bench'}</button>
              <Workbench open={open} />
              <button onClick={forgeGear}>Forge a gear</button>
              <GearRack gears={gears} />
            </div>
          );
        }
      `,
      hints: [
        md`Read the crash: *"Rendered more hooks than during the previous render"* means some hook runs on some renders but not on others. Look for a \`useState\` below \`if (!open) return ...\` and one inside \`gears.map(...)\`.`,
        md`In \`Workbench\`, move \`const [oil, setOil] = useState(3);\` up so it sits right under the \`tool\` state, *before* the \`if\`.`,
        md`Add \`function Gear({ name }) { const [spins, setSpins] = useState(0); return <button className="gear" onClick={() => setSpins(spins + 1)}>⚙️ {name}: {spins}</button>; }\` and render \`gears.map((gear) => <Gear key={gear.id} name={gear.name} />)\` in \`GearRack\`.`,
      ],
      tests: [
        test('Opening the bench works (no hook after an early return)', (t) => {
          t.render();
          const open = t.button('Open the bench');
          attempt(
            () => t.click(open),
            'Opening the bench changed how many hooks Workbench calls: useState(3) for the oil sits below the early return. Move it up next to the tool state, above the if.',
          );
          const oil = t.$('.oil');
          t.expect(oil, 'After clicking "Open the bench" there is no <p className="oil">. Keep the open bench UI (tool, oil and their buttons).');
          const text = norm(oil.textContent);
          t.expect(text === 'Oil: 3', `The oil line reads "${text}" — expected "Oil: 3".`);
        }),
        test('The oil level survives closing and reopening the bench', (t) => {
          t.render();
          const advice = 'Every hook in Workbench must run on every render: put useState(3) above the early return.';
          attempt(() => t.click(t.button('Open the bench')), advice);
          t.click(t.button('Use oil'));
          attempt(() => t.click(t.button('Close the bench')), advice);
          t.expectElement('.closed', 'When the bench is closed, Workbench should show the <p className="closed"> message.');
          attempt(() => t.click(t.button('Open the bench')), advice);
          const oil = t.$('.oil');
          t.expect(oil, 'After reopening the bench there is no <p className="oil">.');
          const text = norm(oil.textContent);
          t.expect(
            text === 'Oil: 2',
            `After using oil once, closing and reopening, the oil reads "${text}" — expected "Oil: 2". Keep <Workbench open={open} /> rendered all the time and call its hooks before the early return, so React keeps its state.`,
          );
        }),
        test('Forging gears works (no hook inside a loop)', (t) => {
          t.render();
          const advice =
            'GearRack calls useState inside gears.map(), so the number of hooks changes whenever a gear is added. Move each gear button into its own Gear component that calls useState at its top level.';
          attempt(() => t.click(t.button('Forge a gear')), advice);
          attempt(() => t.click(t.button('Forge a gear')), advice);
          const n = t.count('.gear');
          t.expect(n === 3, `There are ${n} .gear buttons after forging twice — expected 3 (Brassy plus two new gears).`);
          const names = labels(t, '.gear').map((s) => s.split(':')[0].trim());
          t.expect(
            names.join(', ') === 'Brassy, Copperpot, Ticktock',
            `The gears are named ${names.join(', ')} — expected Brassy, Copperpot, Ticktock. Pass each gear's name to <Gear>.`,
          );
        }),
        test('Each gear counts its own spins', (t) => {
          t.render();
          const advice = 'Extract a Gear component so each gear has its own useState.';
          attempt(() => t.click(t.button('Forge a gear')), advice);
          attempt(() => t.click(t.button('Forge a gear')), advice);
          t.click(t.$$('.gear')[0]);
          t.click(t.$$('.gear')[0]);
          t.click(t.$$('.gear')[2]);
          const texts = labels(t, '.gear');
          const expected = ['Brassy: 2', 'Copperpot: 0', 'Ticktock: 1'];
          t.expect(
            texts.join(' | ') === expected.join(' | '),
            `After spinning Brassy twice and Ticktock once, the gears read "${texts.join('", "')}" — expected "⚙️ Brassy: 2", "⚙️ Copperpot: 0", "⚙️ Ticktock: 1". Each Gear should own its own spins state.`,
          );
        }),
      ],
      css: `${WORKSHOP_CSS}
.bench { background: #fffaf0; border: 2px dashed #d69e2e; border-radius: 12px; padding: 8px 12px; margin: 8px 0; }
.closed { color: #8a6d3b; font-style: italic; margin: 8px 0; }
.oil { font-weight: 700; }
.rack { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.workshop .gear { background: #8d5a1c; border-radius: 999px; }
`,
      concepts: [
        {
          id: 'hook-rules-of-hooks',
          icon: '📜',
          title: 'Rules of Hooks',
          summary: 'Call hooks only at the top level of components and custom hooks.',
          snippet: code`
            function Bench({ open }) {
              const [oil, setOil] = useState(3); // ✅ before any return
              if (!open) return <p>Closed</p>;
              // ❌ never: if (...) useState(), loops, handlers
            }
          `,
          detail: 'No hooks inside conditions, loops, nested functions or after an early return. Need per-item state? Extract a component.',
        },
        {
          id: 'hook-call-order',
          icon: '🔢',
          title: 'Hooks are matched by call order',
          summary: 'React hands out state slots in the order hooks are called.',
          detail: 'React never sees variable names: the 1st hook call gets slot 1, the 2nd slot 2... If the number or order of calls changes between renders, React crashes with "Rendered more/fewer hooks".',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'hook-toggle',
      type: 'code',
      title: 'Your First Contraption',
      blurb: 'Copy-pasted state logic? Forge it into a reusable useToggle hook.',
      xp: 120,
      story: [
        { text: "Gretta has a workshop motto: 'Build the same gizmo twice? Then build a machine that builds it.'", mood: 'happy' },
        { text: "The lantern and the bellows carry identical on/off logic. Let's forge it into your very first custom hook: useToggle!", mood: 'excited' },
      ],
      lesson: md`
        ## Custom hooks: functions that call hooks

        You've used React's built-in hooks. Now you'll build your own. A **custom hook** is
        a plain JavaScript function that:

        1. has a name starting with **\`use\`** followed by a capital letter (\`useToggle\`, \`useOnlineStatus\`), and
        2. calls other hooks inside it.

        Spot the repeated logic:

        \`\`\`jsx
        function Shutters() {
          const [open, setOpen] = useState(false);
          function toggleOpen() {
            setOpen((v) => !v);
          }
          // ...
        }

        function Siren() {
          const [loud, setLoud] = useState(true);
          function toggleLoud() {
            setLoud((v) => !v);
          }
          // ...
        }
        \`\`\`

        Same shape, different names. Pull the shape out into a function whose name starts
        with \`use\`, give it parameters for what differs, and **return** what callers need:

        \`\`\`jsx
        function useSwitch(initialValue) {
          const [value, setValue] = useState(initialValue);
          function flip() {
            setValue((v) => !v);
          }
          return [value, flip];
        }

        function Shutters() {
          const [open, toggleOpen] = useSwitch(false);
          return <button onClick={toggleOpen}>{open ? 'Close' : 'Open'}</button>;
        }
        \`\`\`

        ## Sharing logic, not state

        The key idea: **every call to a custom hook gets its own, independent state.**
        \`Shutters\` and \`Siren\` can both call \`useSwitch\`, but flipping one never touches
        the other. A custom hook is a *recipe*, not a shared box.

        Why? \`useSwitch(...)\` simply runs *inside* the component that calls it, during its
        render. The \`useState\` inside becomes one of **that component's** hook slots. (To
        share the *same* state between components you still lift it up, or use context.)

        ## Why the \`use\` prefix?

        The name is a promise: *"this function calls hooks, so follow the Rules of Hooks when
        you call it"*. The linter relies on it to check your code, and readers rely on it to
        spot where state lives.

        :::mistake
        Don't name a plain function \`useSomething\` if it calls no hooks. \`useFormatPrice(n)\`
        that only formats a number should be \`formatPrice(n)\`: then it can be called anywhere,
        even inside a condition.
        :::

        ## Returning an array

        Like \`useState\`, a toggle hook returns a **pair in an array**. Arrays let each caller
        choose their own names: \`const [lit, toggleLit] = useToggle(true)\`,
        \`const [open, toggleOpen] = useToggle()\`. (When a hook returns many values, an object
        is friendlier. More on that soon.)

        :::tip
        \`export function useToggle\` makes it a **named export**. In a real project other files
        would \`import { useToggle } from './useToggle.js'\`. Reactoria's checks test your hook
        directly through that export.
        :::
      `,
      task: md`
        ## 🎯 Forge useToggle

        1. Write and **export** a custom hook: \`export function useToggle(initialValue = false)\`.
        2. It returns an **array** \`[value, toggle]\`: \`value\` starts as \`initialValue\`, and calling \`toggle()\` flips it between \`true\` and \`false\`.
        3. Use \`useToggle\` in **both** \`Lantern\` (starts \`true\`) and \`Bellows\` (starts \`false\`), replacing their own \`useState\` + toggle functions. After the refactor, \`useState\` should only appear inside \`useToggle\`.
        4. Keep the texts: **🔥 Lantern: lit** / **🌑 Lantern: dark** and **💨 Bellows: pumping** / **😴 Bellows: resting**, and the buttons **Toggle lantern** and **Toggle bellows**.
      `,
      starter: code`
        import { useState } from 'react';

        // TODO: export function useToggle(initialValue = false) { ... }

        function Lantern() {
          const [lit, setLit] = useState(true);
          function toggleLit() {
            setLit((v) => !v);
          }
          return (
            <div className="device">
              <p className="lantern">{lit ? '🔥 Lantern: lit' : '🌑 Lantern: dark'}</p>
              <button onClick={toggleLit}>Toggle lantern</button>
            </div>
          );
        }

        function Bellows() {
          const [pumping, setPumping] = useState(false);
          function togglePumping() {
            setPumping((v) => !v);
          }
          return (
            <div className="device">
              <p className="bellows">{pumping ? '💨 Bellows: pumping' : '😴 Bellows: resting'}</p>
              <button onClick={togglePumping}>Toggle bellows</button>
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>🪝 Gretta's Bench</h2>
              <Lantern />
              <Bellows />
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export function useToggle(initialValue = false) {
          const [value, setValue] = useState(initialValue);
          function toggle() {
            setValue((v) => !v);
          }
          return [value, toggle];
        }

        function Lantern() {
          const [lit, toggleLit] = useToggle(true);
          return (
            <div className="device">
              <p className="lantern">{lit ? '🔥 Lantern: lit' : '🌑 Lantern: dark'}</p>
              <button onClick={toggleLit}>Toggle lantern</button>
            </div>
          );
        }

        function Bellows() {
          const [pumping, togglePumping] = useToggle(false);
          return (
            <div className="device">
              <p className="bellows">{pumping ? '💨 Bellows: pumping' : '😴 Bellows: resting'}</p>
              <button onClick={togglePumping}>Toggle bellows</button>
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>🪝 Gretta's Bench</h2>
              <Lantern />
              <Bellows />
            </div>
          );
        }
      `,
      hints: [
        md`A custom hook is a normal function whose name starts with \`use\`. Inside it you call \`useState\` exactly like in a component. Don't forget the \`export\` keyword in front of \`function\`.`,
        md`Inside the hook: \`const [value, setValue] = useState(initialValue);\`, then \`function toggle() { setValue((v) => !v); }\`, and finally \`return [value, toggle];\`.`,
        md`In \`Lantern\`: \`const [lit, toggleLit] = useToggle(true);\`. In \`Bellows\`: \`const [pumping, togglePumping] = useToggle(false);\`. Then delete their old \`useState\` lines and toggle functions.`,
      ],
      tests: [
        test('useToggle is exported and starts with its initial value', (t) => {
          const useToggle = requireExport(t, 'useToggle', 'useToggle(initialValue = false)');
          const plain = probeHook(t, () => useToggle());
          t.expect(Array.isArray(plain.value), `useToggle() returned ${show(plain.value)} — it should return an array: return [value, toggle];`);
          t.expect(
            plain.value[0] === false,
            `useToggle() with no argument starts as ${show(plain.value[0])} — expected false. Give the parameter a default: useToggle(initialValue = false).`,
          );
          const lit = probeHook(t, () => useToggle(true));
          t.expect(lit.value?.[0] === true, `useToggle(true) starts as ${show(lit.value?.[0])} — expected true.`);
        }),
        test('toggle() flips the value back and forth', (t) => {
          const useToggle = requireExport(t, 'useToggle', 'useToggle(initialValue = false)');
          const p = probeHook(t, () => useToggle(false));
          t.expect(
            Array.isArray(p.value) && typeof p.value[1] === 'function',
            `useToggle should return [value, toggle] where toggle is a function — got ${show(p.value)}.`,
          );
          callInAct(t, p.value[1], 'toggle()');
          t.expect(p.value[0] === true, `After one toggle() the value is ${show(p.value[0])} — expected true.`);
          callInAct(t, p.value[1], 'toggle()');
          t.expect(p.value[0] === false, `After two toggle() calls the value is ${show(p.value[0])} — expected false again.`);
        }),
        test('Lantern and Bellows each keep their own state', (t) => {
          t.render();
          const lantern = () => norm(t.find('.lantern').textContent);
          const bellows = () => norm(t.find('.bellows').textContent);
          t.expect(lantern().endsWith('Lantern: lit'), `The lantern starts as "${lantern()}" — expected "🔥 Lantern: lit" (useToggle(true)).`);
          t.expect(bellows().endsWith('Bellows: resting'), `The bellows start as "${bellows()}" — expected "😴 Bellows: resting" (useToggle(false)).`);
          t.click(t.button('Toggle lantern'));
          t.expect(lantern().endsWith('Lantern: dark'), `After "Toggle lantern" the lantern reads "${lantern()}" — expected "🌑 Lantern: dark".`);
          t.expect(
            bellows().endsWith('Bellows: resting'),
            `Toggling the lantern changed the bellows to "${bellows()}"! Each component must get its own state from its own useToggle call.`,
          );
          t.click(t.button('Toggle bellows'));
          t.expect(bellows().endsWith('Bellows: pumping'), `After "Toggle bellows" the bellows read "${bellows()}" — expected "💨 Bellows: pumping".`);
          t.expect(lantern().endsWith('Lantern: dark'), `Toggling the bellows changed the lantern to "${lantern()}" — the two should be independent.`);
        }),
        test('Both devices use your useToggle hook', (t) => {
          const src = stripComments(t.source);
          const uses = callSites(src, 'useToggle');
          t.expect(uses >= 2, `useToggle is called ${uses} time(s) — expected one call in Lantern and one in Bellows.`);
          const states = countMatches(src, /\buseState\s*\(/g);
          t.expect(
            states <= 1,
            `useState( appears ${states} times — after the refactor it should appear only once, inside useToggle. Replace the useState + toggle code in Lantern and Bellows with useToggle.`,
          );
        }),
      ],
      css: `${WORKSHOP_CSS}
.device { display: inline-block; min-width: 190px; background: #fffaf0; border: 2px solid #e2b866; border-radius: 12px; padding: 8px 12px; margin: 6px 8px 6px 0; vertical-align: top; }
.lantern, .bellows { font-size: 1.15em; font-weight: 700; }
`,
      concepts: [
        {
          id: 'hook-custom-hook',
          icon: '🪝',
          title: 'Custom hook',
          summary: 'A function named useSomething that calls other hooks to package reusable logic.',
          snippet: code`
            export function useToggle(initialValue = false) {
              const [value, setValue] = useState(initialValue);
              const toggle = () => setValue((v) => !v);
              return [value, toggle];
            }
          `,
          detail: 'The use prefix promises that the function calls hooks, so the Rules of Hooks apply where it is called. Plain helpers without hooks should not use it.',
        },
        {
          id: 'hook-logic-not-state',
          icon: '🧬',
          title: 'Hooks share logic, not state',
          summary: 'Every call to a custom hook gets its own independent state.',
          snippet: code`
            const [lit, toggleLit] = useToggle(true);   // Lantern's own state
            const [on, toggleOn] = useToggle(false);    // Bellows' own state
          `,
          detail: 'A custom hook runs inside the component that calls it, so its useState becomes that component’s hook slot. To share one state, lift it up or use context.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'hook-local-storage',
      type: 'code',
      title: 'The Memory Crystal',
      blurb: 'Build useLocalStorage: like useState, but it remembers after a reload.',
      xp: 130,
      story: [
        { text: 'Every night the workshop forgets everything. This morning Gretta had to re-introduce herself to her own notebook. Embarrassing!', mood: 'worried' },
        { text: "Browsers have a little memory crystal called localStorage. Let's wrap it in a hook that works just like useState... but never forgets.", mood: 'excited' },
      ],
      lesson: md`
        ## localStorage in 30 seconds

        The browser's \`localStorage\` stores **strings** under **keys**, and keeps them even
        after the page reloads:

        \`\`\`js
        localStorage.setItem('tinker-name', 'Gretta');
        localStorage.getItem('tinker-name');   // 'Gretta'
        localStorage.getItem('missing');       // null
        \`\`\`

        To store numbers, booleans, arrays or objects, convert them with JSON:

        \`\`\`js
        localStorage.setItem('gears', JSON.stringify(['brass', 'copper']));
        JSON.parse(localStorage.getItem('gears'));   // ['brass', 'copper']
        \`\`\`

        ## Lazy initial state

        \`useState(initial)\` only *uses* its argument on the first render. But if you write
        \`useState(readSaved())\`, then \`readSaved()\` still **runs on every render**, and its
        result is thrown away. Pass a **function** instead, and React calls it only once:

        \`\`\`jsx
        const [theme, setTheme] = useState(() => {
          const saved = localStorage.getItem('theme');   // runs on the first render only
          return saved !== null ? JSON.parse(saved) : 'light';
        });
        \`\`\`

        This is a **lazy initializer**. Spot the difference: \`useState(readSaved)\` hands
        React the function; \`useState(readSaved())\` calls it on every render.

        ## Syncing with an effect

        Writing to localStorage is a side effect, so it belongs in an effect that re-runs
        whenever the value changes:

        \`\`\`jsx
        useEffect(() => {
          localStorage.setItem('theme', JSON.stringify(theme));
        }, [theme]);
        \`\`\`

        ## Hiding it all in a hook

        Combine the lazy read and the effect in a custom hook that takes the **key** and the
        **initial value** as parameters, and returns the same \`[value, setValue]\` pair as
        \`useState\`. Then any component can swap \`useState('')\` for
        \`useLocalStorage('tinker-name', '')\` and its data survives reloads.

        Callers don't need to know localStorage exists: the hook **hides the details** behind
        a familiar API. That's the real power of custom hooks.

        :::mistake
        Using \`useState(initialValue)\` plus an effect that writes, but never reading: on the
        first render the effect saves \`initialValue\` **over** whatever was stored. Always read
        the saved value in the initializer first.
        :::

        :::tip
        If your hook returns React's own setter, callers can use the updater form too:
        \`setGears((g) => g + 1)\`.
        :::

        :::pro
        Production versions wrap \`JSON.parse\` in \`try/catch\` (stored data might be broken)
        and listen to the browser's \`storage\` event to stay in sync across tabs. This simple
        version also assumes \`key\` never changes; if it can, re-read storage when it does (or
        remount the component with a different \`key\`).
        :::

        :::try
        When you're done, type your name in the preview and press **▶ Re-run**: the preview
        restarts from scratch, but your name is still there.
        :::
      `,
      task: md`
        ## 🎯 Charge the memory crystal

        1. Write and **export** \`useLocalStorage(key, initialValue)\`. It returns \`[value, setValue]\`, just like \`useState\`.
        2. On the **first render only** (use a lazy initializer), read \`localStorage.getItem(key)\`: if something is saved, use \`JSON.parse\` of it; otherwise use \`initialValue\`.
        3. Whenever the value changes, save it in an effect with \`localStorage.setItem(key, JSON.stringify(value))\`.
        4. In \`Notebook\`, replace both \`useState\` calls: the name uses the key **'tinker-name'** (initial \`''\`) and the gear count uses the key **'gear-count'** (initial \`0\`).
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        // TODO: export function useLocalStorage(key, initialValue) { ... }

        function Notebook() {
          const [name, setName] = useState('');
          const [gears, setGears] = useState(0);

          return (
            <div className="notebook">
              <label>
                Tinker name: <input className="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <p className="greeting">{name ? \`Welcome back, \${name}!\` : 'Who goes there?'}</p>
              <p className="gears">⚙️ Gears built: {gears}</p>
              <button onClick={() => setGears((g) => g + 1)}>Build a gear</button>
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>📓 The Workshop Notebook</h2>
              <Notebook />
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export function useLocalStorage(key, initialValue) {
          const [value, setValue] = useState(() => {
            const saved = localStorage.getItem(key);
            return saved !== null ? JSON.parse(saved) : initialValue;
          });

          useEffect(() => {
            localStorage.setItem(key, JSON.stringify(value));
          }, [key, value]);

          return [value, setValue];
        }

        function Notebook() {
          const [name, setName] = useLocalStorage('tinker-name', '');
          const [gears, setGears] = useLocalStorage('gear-count', 0);

          return (
            <div className="notebook">
              <label>
                Tinker name: <input className="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <p className="greeting">{name ? \`Welcome back, \${name}!\` : 'Who goes there?'}</p>
              <p className="gears">⚙️ Gears built: {gears}</p>
              <button onClick={() => setGears((g) => g + 1)}>Build a gear</button>
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>📓 The Workshop Notebook</h2>
              <Notebook />
            </div>
          );
        }
      `,
      hints: [
        md`Start with the outline: \`export function useLocalStorage(key, initialValue) { const [value, setValue] = useState(...); ... return [value, setValue]; }\`.`,
        md`The lazy initializer reads once: \`useState(() => { const saved = localStorage.getItem(key); return saved !== null ? JSON.parse(saved) : initialValue; })\`.`,
        md`Save in an effect: \`useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);\`. In \`Notebook\`: \`const [name, setName] = useLocalStorage('tinker-name', '');\` and \`const [gears, setGears] = useLocalStorage('gear-count', 0);\`.`,
      ],
      tests: [
        test('useLocalStorage is exported and starts with initialValue', (t) => {
          const useLocalStorage = requireExport(t, 'useLocalStorage', 'useLocalStorage(key, initialValue)');
          const p = probeHook(t, () => useLocalStorage('probe-key', 42));
          t.expect(
            Array.isArray(p.value) && typeof p.value[1] === 'function',
            `useLocalStorage should return [value, setValue] like useState — got ${show(p.value)}.`,
          );
          t.expect(
            p.value[0] === 42,
            `With nothing saved, useLocalStorage('probe-key', 42) returned ${show(p.value[0])} — expected 42 (the initialValue).`,
          );
        }),
        test('A saved value is read on the first render (JSON.parse)', (t) => {
          const useLocalStorage = requireExport(t, 'useLocalStorage', 'useLocalStorage(key, initialValue)');
          t.storage.setItem('probe-key', JSON.stringify({ gears: 7 }));
          const p = probeHook(t, () => useLocalStorage('probe-key', { gears: 0 }));
          const value = Array.isArray(p.value) ? p.value[0] : undefined;
          t.expect(
            value && value.gears === 7,
            `localStorage held {"gears":7} but the hook returned ${show(value)}. In the lazy initializer, read localStorage.getItem(key) and JSON.parse it when it isn't null.`,
          );
          const stored = t.storage.getItem('probe-key');
          t.expect(
            stored === '{"gears":7}',
            `The saved value was overwritten with ${show(stored)} on the first render. Read the saved value first, so the effect writes back what was already there.`,
          );
        }),
        test('Changes are saved with JSON.stringify', (t) => {
          const useLocalStorage = requireExport(t, 'useLocalStorage', 'useLocalStorage(key, initialValue)');
          const p = probeHook(t, () => useLocalStorage('probe-key', 1));
          t.expect(Array.isArray(p.value), `useLocalStorage should return [value, setValue] — got ${show(p.value)}.`);
          callInAct(t, () => p.value[1](5), 'setValue(5)');
          const afterNumber = t.storage.getItem('probe-key');
          t.expect(
            afterNumber === '5',
            `After setValue(5), localStorage holds ${show(afterNumber)} — expected "5". Save with localStorage.setItem(key, JSON.stringify(value)) in an effect that depends on [key, value].`,
          );
          callInAct(t, () => p.value[1]({ name: 'Gretta' }), "setValue({ name: 'Gretta' })");
          const afterObject = t.storage.getItem('probe-key');
          t.expect(
            afterObject === '{"name":"Gretta"}',
            `After setValue({ name: 'Gretta' }), localStorage holds ${show(afterObject)} — expected '{"name":"Gretta"}'. Use JSON.stringify(value), not String(value).`,
          );
        }),
        test('localStorage is read only once (lazy initializer)', (t) => {
          const useLocalStorage = requireExport(t, 'useLocalStorage', 'useLocalStorage(key, initialValue)');
          const realGetItem = t.storage.getItem;
          let reads = 0;
          t.storage.getItem = (key) => {
            reads += 1;
            return realGetItem(key);
          };
          try {
            const p = probeHook(t, () => useLocalStorage('probe-key', 0));
            t.expect(Array.isArray(p.value), `useLocalStorage should return [value, setValue] — got ${show(p.value)}.`);
            for (const n of [1, 2, 3]) callInAct(t, () => p.value[1](n), `setValue(${n})`);
            t.expect(p.value[0] === 3, `After setValue(1), (2), (3) the value is ${show(p.value[0])} — expected 3.`);
          } finally {
            t.storage.getItem = realGetItem;
          }
          t.expect(reads > 0, 'useLocalStorage never called localStorage.getItem(key). Read the saved value inside the lazy initializer.');
          t.expect(
            reads === 1,
            `localStorage.getItem ran ${reads} times over 4 renders — expected once. Pass a function to useState, useState(() => { ... }), so the read happens on the first render only.`,
          );
        }),
        test('The notebook remembers the tinker after a remount', (t) => {
          t.render();
          t.type('input.name', 'Gretta');
          t.click(t.button('Build a gear'));
          t.click(t.button('Build a gear'));
          const savedName = t.storage.getItem('tinker-name');
          t.expect(savedName === '"Gretta"', `localStorage 'tinker-name' holds ${show(savedName)} — expected '"Gretta"'. In Notebook use useLocalStorage('tinker-name', '').`);
          const savedGears = t.storage.getItem('gear-count');
          t.expect(savedGears === '2', `localStorage 'gear-count' holds ${show(savedGears)} — expected '2'. Use useLocalStorage('gear-count', 0) for the gear count.`);
          t.unmount();
          t.render();
          const value = t.find('input.name').value;
          t.expect(value === 'Gretta', `After a remount the name input shows "${value}" — expected "Gretta", restored from localStorage.`);
          t.expectText('Welcome back, Gretta!', 'After a remount the greeting should read "Welcome back, Gretta!".');
          const gears = norm(t.find('.gears').textContent);
          t.expect(gears.endsWith('Gears built: 2'), `After a remount the gear line reads "${gears}" — expected "⚙️ Gears built: 2".`);
        }),
      ],
      css: `${WORKSHOP_CSS}
.notebook { background: #fffdf5 repeating-linear-gradient(#fffdf5 0 26px, #e9dcc0 26px 27px); border: 2px solid #c9a46a; border-radius: 10px; padding: 10px 14px; }
.greeting { font-size: 1.2em; font-weight: 700; color: #7b4a0e; }
`,
      concepts: [
        {
          id: 'hook-lazy-init',
          icon: '🦥',
          title: 'Lazy initial state',
          summary: 'useState(() => compute()) runs the initializer on the first render only.',
          snippet: code`
            const [value, setValue] = useState(() => {
              const saved = localStorage.getItem(key);
              return saved !== null ? JSON.parse(saved) : initialValue;
            });
          `,
          detail: 'useState(compute()) would call compute() on every render and throw the result away. Pass the function itself.',
        },
        {
          id: 'hook-use-local-storage',
          icon: '💎',
          title: 'useLocalStorage',
          summary: 'A useState that persists: lazy read once, write in an effect.',
          snippet: code`
            const [name, setName] = useLocalStorage('tinker-name', '');
          `,
          detail: 'A custom hook can hide a whole browser API behind the familiar [value, setValue] shape.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'hook-fetch',
      type: 'code',
      title: 'The Fetching Contraption',
      blurb: 'Turn copy-pasted fetch effects into one useFetch(url) hook.',
      xp: 140,
      routes: {
        '/api/blueprints': BLUEPRINTS,
        '/api/tools': (url) => (url.includes('shelf=power') ? POWER_TOOLS : HAND_TOOLS),
        '/api/broken': () => ({ status: 500, body: { error: 'The boiler exploded' } }),
      },
      story: [
        { text: "The order board loads blueprints and tools from the Guild... using the same twenty lines of effect code, copy-pasted twice. And the copy has bugs.", mood: 'thinking' },
        { text: "Let's build a fetching contraption: give useFetch a URL, get back data, loading and error. One machine, used everywhere!", mood: 'excited' },
      ],
      lesson: md`
        ## From effect to hook

        In the Effect Volcano you fetched data inside a component: three pieces of state,
        a \`useEffect\` and an \`ignore\` flag against race conditions. Look closely: none of
        that logic cares *what* it fetches, only *where from*. That's perfect hook material.

        Moving it into a hook is mostly cut and paste:

        \`\`\`jsx
        export function useFetch(url) {
          // 1. the three useState calls (data, loading, error)
          // 2. the useEffect, with the hard-coded address replaced by url
          //    and [url] as its dependency array
          // 3. hand the results back to the caller:
          return { data, loading, error };
        }
        \`\`\`

        ## Hooks receive fresh values every render

        A custom hook runs inside your component on **every render**, with whatever you pass
        it *this* time:

        \`\`\`jsx
        const [shelf, setShelf] = useState('hand');
        const { data } = useFetch('/api/tools?shelf=' + shelf);
        \`\`\`

        When \`shelf\` changes, the URL string changes, and because \`url\` is in the effect's
        dependency array, the effect inside the hook re-runs and fetches again. The old
        effect's cleanup sets \`ignore = true\`, so a slow answer for the old URL can never
        overwrite the new one.

        ## Arrays or objects?

        | Return | Best when | Example |
        |---|---|---|
        | Array \`[a, b]\` | a pair callers will rename | \`const [lit, toggleLit] = useToggle()\` |
        | Object \`{ a, b, c }\` | three or more values, or optional ones | \`const { data, loading, error } = useFetch(url)\` |

        With an object, order doesn't matter and callers take only what they need. They can
        still rename: \`const { data: tools } = useFetch('/api/tools')\`.

        :::mistake
        Returning \`[data, loading, error]\` makes every caller remember the order, and write
        \`const [, , error] = useFetch(url)\` just to get the error. Name your values: return an object.
        :::

        :::tip
        Set \`loading\` back to \`true\` at the start of the effect. Otherwise, when the URL
        changes, the old data stays on screen with no hint that new data is on its way.
        Heads-up: the newest \`eslint-plugin-react-hooks\` flags a \`setState\` called directly
        in an effect body (\`react-hooks/set-state-in-effect\`). The pattern still works here; in
        real apps, the data libraries below handle loading for you.
        :::

        :::pro
        In production apps, data fetching usually goes through a framework (Next.js, React
        Router) or a library like TanStack Query or SWR, which add caching, retries and
        deduplication. Their \`useQuery(...)\` and \`useSWR(...)\` are custom hooks too, built on
        the same ideas.
        :::
      `,
      task: md`
        ## 🎯 Build the fetching contraption

        ### The hook

        - Write and **export** \`useFetch(url)\`, moving the fetching logic out of \`BlueprintBoard\`.
        - It returns an **object** \`{ data, loading, error }\` that starts as \`{ data: null, loading: true, error: null }\`.
        - On success, \`data\` holds the parsed JSON and \`loading\` is \`false\`. If \`res.ok\` is false, \`error\` holds an \`Error\` and \`loading\` is \`false\`.
        - When \`url\` changes it fetches again, sets \`loading\` back to \`true\`, and **ignores** answers for an old URL.

        ### Using it

        - \`BlueprintBoard\` calls \`useFetch('/api/blueprints')\` (keep its **Loading blueprints…** text).
        - \`ToolRack\`'s copy-pasted effect is buggy: replace its \`tools\` state and effect with \`useFetch('/api/tools?shelf=' + shelf)\`.
        - While useFetch's \`loading\` is \`true\` (also after switching shelves), \`ToolRack\` shows \`<p className="loading">Loading tools…</p>\`; afterwards the \`<ul className="tools">\`.
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        // TODO: export function useFetch(url) { ... }

        function BlueprintBoard() {
          const [data, setData] = useState(null);
          const [loading, setLoading] = useState(true);
          const [error, setError] = useState(null);

          useEffect(() => {
            let ignore = false;
            setLoading(true);
            setError(null);
            fetch('/api/blueprints')
              .then((res) => {
                if (!res.ok) throw new Error('Request failed: ' + res.status);
                return res.json();
              })
              .then((json) => {
                if (!ignore) {
                  setData(json);
                  setLoading(false);
                }
              })
              .catch((err) => {
                if (!ignore) {
                  setError(err);
                  setLoading(false);
                }
              });
            return () => {
              ignore = true;
            };
          }, []);

          if (loading) return <p className="loading">Loading blueprints…</p>;
          if (error) return <p className="error">⚠️ {error.message}</p>;
          return (
            <ul className="blueprints">
              {data.map((blueprint) => (
                <li key={blueprint.id}>📐 {blueprint.name}</li>
              ))}
            </ul>
          );
        }

        function ToolRack() {
          const [shelf, setShelf] = useState('hand');
          const [tools, setTools] = useState(null);

          // 🐛 Copy-pasted in a hurry: no loading state, no errors, no ignore flag...
          useEffect(() => {
            fetch('/api/tools?shelf=' + shelf)
              .then((res) => res.json())
              .then((json) => setTools(json));
          }, [shelf]);

          return (
            <div className="toolrack">
              <button onClick={() => setShelf('hand')}>Hand tools</button>
              <button onClick={() => setShelf('power')}>Power tools</button>
              {tools === null ? (
                <p className="loading">Loading tools…</p>
              ) : (
                <ul className="tools">
                  {tools.map((tool) => (
                    <li key={tool}>🔧 {tool}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>📋 The Order Board</h2>
              <h3>Blueprints</h3>
              <BlueprintBoard />
              <h3>Tool rack</h3>
              <ToolRack />
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export function useFetch(url) {
          const [data, setData] = useState(null);
          const [loading, setLoading] = useState(true);
          const [error, setError] = useState(null);

          useEffect(() => {
            let ignore = false;
            setLoading(true);
            setError(null);
            fetch(url)
              .then((res) => {
                if (!res.ok) throw new Error('Request failed: ' + res.status);
                return res.json();
              })
              .then((json) => {
                if (!ignore) {
                  setData(json);
                  setLoading(false);
                }
              })
              .catch((err) => {
                if (!ignore) {
                  setError(err);
                  setLoading(false);
                }
              });
            return () => {
              ignore = true;
            };
          }, [url]);

          return { data, loading, error };
        }

        function BlueprintBoard() {
          const { data, loading, error } = useFetch('/api/blueprints');

          if (loading) return <p className="loading">Loading blueprints…</p>;
          if (error) return <p className="error">⚠️ {error.message}</p>;
          return (
            <ul className="blueprints">
              {data.map((blueprint) => (
                <li key={blueprint.id}>📐 {blueprint.name}</li>
              ))}
            </ul>
          );
        }

        function ToolRack() {
          const [shelf, setShelf] = useState('hand');
          const { data: tools, loading, error } = useFetch('/api/tools?shelf=' + shelf);

          return (
            <div className="toolrack">
              <button onClick={() => setShelf('hand')}>Hand tools</button>
              <button onClick={() => setShelf('power')}>Power tools</button>
              {loading ? (
                <p className="loading">Loading tools…</p>
              ) : error ? (
                <p className="error">⚠️ {error.message}</p>
              ) : (
                <ul className="tools">
                  {tools.map((tool) => (
                    <li key={tool}>🔧 {tool}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>📋 The Order Board</h2>
              <h3>Blueprints</h3>
              <BlueprintBoard />
              <h3>Tool rack</h3>
              <ToolRack />
            </div>
          );
        }
      `,
      hints: [
        md`Create \`export function useFetch(url) { ... }\` and move BlueprintBoard's three \`useState\` calls and its \`useEffect\` into it. Replace \`'/api/blueprints'\` with \`url\` and use \`[url]\` as the dependency array.`,
        md`Finish the hook with \`return { data, loading, error };\`. Then \`BlueprintBoard\` becomes \`const { data, loading, error } = useFetch('/api/blueprints');\` plus its JSX.`,
        md`In \`ToolRack\`, delete the \`tools\` state and the buggy effect, then write \`const { data: tools, loading, error } = useFetch('/api/tools?shelf=' + shelf);\` and render \`loading ? <p className="loading">Loading tools…</p> : <ul className="tools">...</ul>\`.`,
      ],
      tests: [
        test('useFetch is exported and returns { data, loading, error }', async (t) => {
          const useFetch = requireExport(t, 'useFetch', 'useFetch(url)');
          const p = probeHook(t, () => useFetch('/api/blueprints'));
          const first = p.value;
          t.expect(
            first && typeof first === 'object' && !Array.isArray(first),
            `useFetch returned ${show(first)} — it should return an object: return { data, loading, error };`,
          );
          t.expect(
            first.loading === true && first.data == null && !first.error,
            `Right after the first render useFetch returned ${show(first)} — expected { data: null, loading: true, error: null }.`,
          );
          await t.tick(300);
          const done = p.value;
          t.expect(done.loading === false, `After the response arrived, loading is ${show(done.loading)} — expected false.`);
          t.expect(
            Array.isArray(done.data) && done.data.length === 3 && done.data[0].name === 'Clockwork owl',
            `After the response arrived, data is ${show(done.data)} — expected the 3 blueprints from /api/blueprints.`,
          );
          t.expect(!done.error, `After a successful response, error is ${show(done.error)} — expected null.`);
        }),
        test('useFetch reports failed requests in error', async (t) => {
          const useFetch = requireExport(t, 'useFetch', 'useFetch(url)');
          const p = probeHook(t, () => useFetch('/api/broken'));
          await t.tick(300);
          const result = p.value || {};
          t.expect(
            result.loading === false,
            `After /api/broken answered with status 500, loading is ${show(result.loading)} — set it to false when the request fails too.`,
          );
          t.expect(
            result.error instanceof Error || (result.error && typeof result.error.message === 'string'),
            `After a 500 response, error is ${show(result.error)} — expected an Error. Check res.ok, throw new Error(...) when it's false, and store the caught error with setError.`,
          );
          t.expect(result.data == null, `After a failed request, data is ${show(result.data)} — expected null.`);
        }),
        test('useFetch ignores answers for an old URL', async (t) => {
          const useFetch = requireExport(t, 'useFetch', 'useFetch(url)');
          const p = probeHook(t, ({ url }) => useFetch(url), { url: '/api/tools?shelf=power' });
          await t.tick(100);
          p.rerender({ url: '/api/tools?shelf=hand' });
          await t.tick(200); // the answer for the OLD url (power shelf) arrives now
          const mid = p.value || {};
          t.expect(
            !(Array.isArray(mid.data) && mid.data.includes('Steam drill')),
            `The URL changed to the hand shelf, but the late answer for the power shelf was still stored (data is ${show(mid.data)}). In the effect, start with let ignore = false, set ignore = true in the cleanup, and only call setData/setLoading when !ignore.`,
          );
          t.expect(mid.loading === true, `While the new URL is still loading, loading should be true — got ${show(mid.loading)}.`);
          await t.tick(100);
          const end = p.value || {};
          t.expect(
            Array.isArray(end.data) && end.data.includes('Hammer') && end.loading === false,
            `When the hand-shelf answer arrived, the hook returned ${show(end)} — expected the hand tools with loading false.`,
          );
        }),
        test('BlueprintBoard and ToolRack both use useFetch', async (t) => {
          const calls = callSites(stripComments(t.source), 'useFetch');
          t.expect(calls >= 2, `useFetch is called ${calls} time(s) — expected one call in BlueprintBoard and one in ToolRack.`);
          t.render();
          t.expectText('Loading blueprints…', 'While loading, BlueprintBoard should show "Loading blueprints…".');
          t.expect(t.$('.toolrack .loading'), 'While loading, ToolRack should show <p className="loading">Loading tools…</p>.');
          await t.tick(300);
          const blueprints = t.count('.blueprints li');
          t.expect(blueprints === 3, `The board shows ${blueprints} blueprint(s) — expected 3.`);
          const tools = labels(t, '.tools li');
          t.expect(tools.join(', ') === HAND_TOOLS.join(', '), `The tool rack shows: ${tools.join(', ') || 'nothing'} — expected ${HAND_TOOLS.join(', ')}.`);
        }),
        test('Switching shelves never shows the wrong tools', async (t) => {
          t.render();
          await t.tick(300);
          t.click(t.button('Power tools'));
          t.expect(
            t.$('.toolrack .loading'),
            'Right after clicking "Power tools" the rack should show <p className="loading">Loading tools…</p> again. In ToolRack, render on the loading value from useFetch (loading ? … : …), not on tools === null: the old tools stay in data while the new shelf loads.',
          );
          await t.tick(100);
          t.click(t.button('Hand tools'));
          await t.tick(200); // the power-shelf answer arrives now: it's stale!
          t.expect(
            !t.hasText('Steam drill'),
            'The rack showed power tools although "Hand tools" was clicked last: an old answer won the race. useFetch must ignore answers for an old URL.',
          );
          await t.tick(100);
          const tools = labels(t, '.tools li');
          t.expect(tools.join(', ') === HAND_TOOLS.join(', '), `After the race the rack shows: ${tools.join(', ') || 'nothing'} — expected the hand tools (${HAND_TOOLS.join(', ')}).`);
        }),
      ],
      css: `${WORKSHOP_CSS}
.blueprints, .tools { list-style: none; padding: 0; }
.blueprints li, .tools li { display: inline-block; background: #fffaf0; border: 2px solid #e2b866; border-radius: 999px; padding: 3px 12px; margin: 3px; }
.toolrack button { margin-bottom: 6px; }
`,
      concepts: [
        {
          id: 'hook-use-fetch',
          icon: '📡',
          title: 'useFetch(url)',
          summary: 'Wraps fetching (data, loading, error + an ignore flag) in one reusable hook.',
          snippet: code`
            const { data, loading, error } = useFetch('/api/tools?shelf=' + shelf);
          `,
          detail: 'The hook runs on every render; its effect re-runs only when url changes, and the cleanup ignores answers for an old url.',
        },
        {
          id: 'hook-return-shape',
          icon: '📦',
          title: 'Arrays vs objects',
          summary: 'Return an array for a pair callers rename; an object for several named values.',
          snippet: code`
            const [lit, toggleLit] = useToggle(true);
            const { data: tools, error } = useFetch(url);
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'hook-debounce',
      type: 'code',
      title: 'The Patient Spring',
      blurb: 'Build useDebounce, then snap it together with useFetch into one search hook.',
      xp: 150,
      routes: {
        '/api/parts': partsRoute,
      },
      story: [
        { text: "The parts catalogue fires a request on EVERY keystroke. Type 'gear' and the poor Guild server gets four requests in a row.", mood: 'worried' },
        { text: "We need a patient spring that waits until the typing stops. Then we'll snap it onto useFetch to make one search hook. Hooks inside hooks!", mood: 'excited' },
      ],
      lesson: md`
        ## Debouncing

        **Debouncing** means *"wait until the value stops changing for a moment, then act"*.
        A debounced search waits until you pause typing, then searches once.

        A \`useDebounce(value, delay)\` hook returns a **lagging copy** of \`value\`: it keeps its
        own state, and only copies the latest \`value\` into it after \`delay\` ms of calm. The
        trick is a timeout **plus a cleanup**:

        \`\`\`jsx
        useEffect(() => {
          const id = setTimeout(() => {
            // delay ms of calm: copy the latest value into state
          }, delay);
          return () => clearTimeout(id);   // value changed again? cancel that timer!
        }, [value, delay]);
        \`\`\`

        Each new value re-runs the effect, and React runs the previous cleanup first, which
        cancels the pending timer. Typing \`gear\` with 100 ms between keys and a 400 ms delay:

        | Time | value | What happens |
        |---|---|---|
        | 0 ms | g | timer A starts (due at 400 ms) |
        | 100 ms | ge | cleanup cancels A, timer B starts (due at 500 ms) |
        | 200 ms | gea | cancel B, timer C starts (due at 600 ms) |
        | 300 ms | gear | cancel C, timer D starts (due at 700 ms) |
        | 700 ms | gear | D fires: the debounced value becomes gear, one search 🎉 |

        :::mistake
        Forgetting the cleanup. Without \`clearTimeout\`, every keystroke's timer still fires:
        you get a *delay*, not a debounce (four searches instead of one).
        :::

        ## Composing hooks

        Custom hooks can call **other custom hooks**. That's how you build big behaviour from
        small, tested parts:

        \`\`\`jsx
        function useCityWeather(city) {
          const calmCity = useDebounce(city, 500);
          const { data, loading } = useFetch('/api/weather?city=' + calmCity);
          return { weather: data, loading };
        }
        \`\`\`

        Follow the data: \`city\` changes on every keystroke → \`useDebounce\` only lets the
        **calm** value through → the URL only changes when \`calmCity\` changes → \`useFetch\`'s
        effect only fetches then. Each piece does one job, and the component using
        \`useCityWeather\` just sees \`{ weather, loading }\`.

        :::tip
        A hook can return whatever shape is simplest: \`useDebounce\` returns a single value,
        so it needs no array or object at all.
        :::

        :::pro
        The Rules of Hooks apply all the way down: \`useCityWeather\` must call its hooks at
        its top level, and components must call \`useCityWeather\` at theirs.
        :::
      `,
      task: md`
        ## 🎯 Wind the patient spring

        \`useFetch\` is already in the file (Gretta built it from your blueprint).

        1. Write and **export** \`useDebounce(value, delay)\`. On the first render it returns \`value\` straight away; afterwards it only returns a new value once \`value\` has stayed the same for \`delay\` ms (\`setTimeout\` in an effect, \`clearTimeout\` in the cleanup).
        2. Write and **export** \`usePartSearch(query)\` that **composes** your hooks: debounce \`query\` by **400** ms, then call \`useFetch('/api/parts?q=' + debouncedQuery)\`.
        3. \`usePartSearch\` returns an **object** \`{ parts, loading }\`, where \`parts\` is the fetched array, or \`[]\` while there's no data yet.
        4. In \`Catalogue\`, replace the direct \`useFetch(...)\` call with \`usePartSearch(query)\`.
      `,
      starter: joinCode(
        code`
          import { useState, useEffect } from 'react';
        `,
        USE_FETCH_SOURCE,
        code`
        // TODO: export function useDebounce(value, delay) { ... }

        // TODO: export function usePartSearch(query) { ... }

        function Catalogue() {
          const [query, setQuery] = useState('');
          // 🐛 Fires a request on every single keystroke!
          const { data, loading } = useFetch('/api/parts?q=' + query);
          const parts = data ?? [];

          return (
            <div className="catalogue">
              <input className="search" placeholder="Search parts…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {loading && <p className="loading">Searching…</p>}
              <ul className="parts">
                {parts.map((part) => (
                  <li key={part.id}>🔩 {part.name}</li>
                ))}
              </ul>
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>🔩 Parts Catalogue</h2>
              <Catalogue />
            </div>
          );
        }
      `,
      ),
      solution: joinCode(
        code`
          import { useState, useEffect } from 'react';
        `,
        USE_FETCH_SOURCE,
        code`
        export function useDebounce(value, delay) {
          const [debounced, setDebounced] = useState(value);

          useEffect(() => {
            const id = setTimeout(() => setDebounced(value), delay);
            return () => clearTimeout(id);
          }, [value, delay]);

          return debounced;
        }

        export function usePartSearch(query) {
          const debouncedQuery = useDebounce(query, 400);
          const { data, loading } = useFetch('/api/parts?q=' + debouncedQuery);
          return { parts: data ?? [], loading };
        }

        function Catalogue() {
          const [query, setQuery] = useState('');
          const { parts, loading } = usePartSearch(query);

          return (
            <div className="catalogue">
              <input className="search" placeholder="Search parts…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {loading && <p className="loading">Searching…</p>}
              <ul className="parts">
                {parts.map((part) => (
                  <li key={part.id}>🔩 {part.name}</li>
                ))}
              </ul>
            </div>
          );
        }

        export default function App() {
          return (
            <div className="workshop">
              <h2>🔩 Parts Catalogue</h2>
              <Catalogue />
            </div>
          );
        }
      `,
      ),
      hints: [
        md`useDebounce keeps its own state that starts as \`value\`: \`const [debounced, setDebounced] = useState(value);\`. In an effect on \`[value, delay]\`, start a \`setTimeout\` that calls \`setDebounced(value)\` after \`delay\` ms, and \`return debounced;\` at the end.`,
        md`The effect must cancel the previous timer: \`const id = setTimeout(...); return () => clearTimeout(id);\`.`,
        md`\`export function usePartSearch(query) { const debouncedQuery = useDebounce(query, 400); const { data, loading } = useFetch('/api/parts?q=' + debouncedQuery); return { parts: data ?? [], loading }; }\` and in Catalogue: \`const { parts, loading } = usePartSearch(query);\`.`,
      ],
      tests: [
        test('useDebounce waits for a calm moment before updating', async (t) => {
          const useDebounce = requireExport(t, 'useDebounce', 'useDebounce(value, delay)');
          const p = probeHook(t, ({ value }) => useDebounce(value, 400), { value: 'g' });
          t.expect(p.value === 'g', `On the first render useDebounce('g', 400) returned ${show(p.value)} — expected 'g' straight away (use value as the initial state).`);
          p.rerender({ value: 'ge' });
          t.expect(p.value === 'g', `Right after the value changed to 'ge', useDebounce already returned ${show(p.value)} — it should keep returning 'g' until 400 ms have passed.`);
          await t.tick(399);
          t.expect(p.value === 'g', `After 399 ms useDebounce returned ${show(p.value)} — still too early, expected 'g'.`);
          await t.tick(1);
          t.expect(
            p.value === 'ge',
            `After 400 ms of calm useDebounce returned ${show(p.value)} — expected 'ge'. Use setTimeout(() => setDebounced(value), delay) inside an effect.`,
          );
        }),
        test('Every change restarts the wait (clearTimeout in the cleanup)', async (t) => {
          const useDebounce = requireExport(t, 'useDebounce', 'useDebounce(value, delay)');
          const p = probeHook(t, ({ value }) => useDebounce(value, 400), { value: 'g' });
          p.rerender({ value: 'ge' });
          await t.tick(300);
          p.rerender({ value: 'gea' });
          await t.tick(300); // 600 ms: the timer for 'ge' would have fired at 400 without a cleanup
          t.expect(
            p.value === 'g',
            `useDebounce returned ${show(p.value)} although the value never stayed still for 400 ms — an old timer still fired. Return () => clearTimeout(id) from the effect so every change cancels the previous timer.`,
          );
          await t.tick(100);
          t.expect(p.value === 'gea', `400 ms after the last change useDebounce returned ${show(p.value)} — expected 'gea'.`);
        }),
        test('usePartSearch combines useDebounce and useFetch', async (t) => {
          const usePartSearch = requireExport(t, 'usePartSearch', 'usePartSearch(query)');
          const p = probeHook(t, ({ q }) => usePartSearch(q), { q: '' });
          const first = p.value;
          t.expect(
            first && typeof first === 'object' && !Array.isArray(first),
            `usePartSearch returned ${show(first)} — it should return an object { parts, loading }.`,
          );
          t.expect(
            Array.isArray(first.parts) && first.parts.length === 0 && first.loading === true,
            `Before any data arrives usePartSearch should return { parts: [], loading: true } — got ${show(first)}. Use data ?? [] for parts.`,
          );
          await t.tick(300);
          t.expect(p.value.parts?.length === PARTS.length && p.value.loading === false, `After the first answer usePartSearch('') should return all ${PARTS.length} parts with loading false — got ${show(p.value)}.`);
          const before = t.fetchCalls.length;
          p.rerender({ q: 'steam' });
          await t.tick(300);
          t.expect(
            t.fetchCalls.length === before,
            `usePartSearch already fetched ${t.fetchCalls.length - before} time(s) only 300 ms after the query changed — debounce the query by 400 ms before building the URL.`,
          );
          await t.tick(100); // the debounce fires and the request starts
          await t.tick(300); // the answer arrives
          const last = t.fetchCalls[t.fetchCalls.length - 1]?.url || 'nowhere';
          t.expect(/\/api\/parts\?q=steam$/.test(last), `The last request went to ${last} — expected /api/parts?q=steam.`);
          const names = (p.value.parts || []).map((part) => part.name);
          t.expect(names.join(', ') === 'Steam valve', `After searching "steam", parts is ${show(names)} — expected ["Steam valve"].`);
        }),
        test('Typing "gear" quickly sends just one search', async (t) => {
          t.render();
          await t.tick(300); // the first (empty) search
          const before = t.fetchCalls.length;
          for (const text of ['g', 'ge', 'gea', 'gear']) {
            t.type('input.search', text);
            await t.tick(100);
          }
          await t.tick(400);
          const searches = t.fetchCalls.slice(before).map((call) => call.url);
          t.expect(
            searches.length === 1,
            `Typing "gear" letter by letter sent ${searches.length} request(s)${searches.length ? ' (' + searches.join(', ') + ')' : ''}. With a 400 ms debounce it should send exactly 1. Use usePartSearch(query) in Catalogue, and make sure useDebounce returns () => clearTimeout(id) from its effect so old timers are cancelled.`,
          );
          t.expect(/q=gear$/.test(searches[0]), `The search went to ${searches[0]} — expected /api/parts?q=gear.`);
        }),
        test('The catalogue shows the parts that match', async (t) => {
          t.render();
          await t.tick(300);
          const all = t.count('.parts li');
          t.expect(all === PARTS.length, `With an empty search the catalogue shows ${all} part(s) — expected all ${PARTS.length}.`);
          t.type('input.search', 'gear');
          await t.tick(400);
          await t.tick(300);
          const names = labels(t, '.parts li');
          t.expect(
            names.join(', ') === 'Brass gear, Copper gear, Gear shaft',
            `After searching "gear" the catalogue shows: ${names.join(', ') || 'nothing'} — expected Brass gear, Copper gear, Gear shaft.`,
          );
        }),
      ],
      css: `${WORKSHOP_CSS}
.catalogue .search { width: 100%; max-width: 320px; }
.parts { list-style: none; padding: 0; }
.parts li { background: #fffaf0; border-left: 4px solid #b7791f; border-radius: 6px; padding: 4px 10px; margin: 4px 0; }
`,
      concepts: [
        {
          id: 'hook-use-debounce',
          icon: '🌀',
          title: 'useDebounce',
          summary: 'Returns a lagging copy of a value that only updates after it stops changing.',
          snippet: code`
            useEffect(() => {
              const id = setTimeout(() => setDebounced(value), delay);
              return () => clearTimeout(id);
            }, [value, delay]);
          `,
          detail: 'The cleanup cancels the pending timer whenever the value changes again. Without it you get a delay, not a debounce.',
        },
        {
          id: 'hook-composition',
          icon: '🧩',
          title: 'Composing hooks',
          summary: 'Custom hooks can call other custom hooks to build bigger behaviour.',
          snippet: code`
            function usePartSearch(query) {
              const calm = useDebounce(query, 400);
              const { data, loading } = useFetch('/api/parts?q=' + calm);
              return { parts: data ?? [], loading };
            }
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'hook-trial',
      type: 'quiz',
      title: 'Trial of the Tinkerers',
      blurb: 'Eight questions from the Tinkers’ Guild. Prove you know your hooks.',
      xp: 100,
      story: [{ text: "Before anyone may face the Hook Breaker, the Tinkers' Guild asks its questions. Every answer comes with an explanation, so even wrong turns teach you something.", mood: 'happy' }],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'React keeps a list of hook "slots" for every component instance. How does it know which `useState` call belongs to which slot?',
          [
            'By the names of the variables you destructure into',
            'By the initial value you pass to each hook',
            'By a hidden id the compiler adds to every hook call',
            'By the order in which the hooks are called during render',
          ],
          3,
          'React never sees your variable names. On every render it hands out slots **in call order**: first hook call, first slot. That is why the order must be identical on every render, and why hooks can\'t live inside conditions or loops.',
        ),
        q(
          'Which of these follows the Rules of Hooks?',
          [
            '`if (open) { const [oil, setOil] = useState(3); }`',
            '`function useOil() { return useState(3); }`, called at the top of a component',
            '`gears.map(() => useState(0))`',
            '`<button onClick={() => useState(0)}>Add</button>`',
          ],
          1,
          'A custom hook may call hooks at its top level, and calling it at the top of a component is fine. The others call a hook inside a condition, inside a loop, or inside an event handler (which runs outside rendering).',
        ),
        q(
          'What goes wrong here?\n\n```jsx\nfunction Banner({ user }) {\n  const [seen, setSeen] = useState(false);\n  if (!user) return null;\n  const [closed, setClosed] = useState(false);\n  // ...\n}\n```',
          [
            'When `user` appears or disappears, the number of hooks changes and React crashes',
            'Nothing: early returns are allowed anywhere',
            'Components can\'t return `null`',
            'A component may only call `useState` once',
          ],
          0,
          'With no user, one hook runs; with a user, two. React reports *"Rendered more hooks than during the previous render"*. Move every hook above the early `return`.',
        ),
        q(
          '`Lantern` and `Bellows` both call `useToggle()`. You click the Lantern\'s switch. What happens to the Bellows?',
          [
            'It toggles too, because they share the hook',
            'React throws: a hook can only be used by one component',
            'It re-mounts and loses its state',
            'Nothing: every call to a custom hook gets its own independent state',
          ],
          3,
          'Custom hooks share **logic**, not **state**. The `useState` inside `useToggle` runs separately inside each component, so each gets its own slot. To share one state, lift it up or use context.',
        ),
        q(
          'Which function should NOT start with `use`?',
          [
            '`function useWindowWidth() { const [w, setW] = useState(innerWidth); /* ... */ }`',
            "`function useFormatPrice(cents) { return '$' + (cents / 100).toFixed(2); }`",
            '`function useFetch(url) { /* useState + useEffect */ }`',
            '`function useToggle(initial) { const [v, setV] = useState(initial); /* ... */ }`',
          ],
          1,
          '`useFormatPrice` calls no hooks, so it\'s an ordinary function: name it `formatPrice`. The `use` prefix promises "this calls hooks, follow the Rules of Hooks", which would needlessly stop you calling it inside a condition.',
        ),
        q(
          'A hook gives back data, a loading flag, an error and a `refetch` function. Which return shape is friendliest?',
          [
            'An array: `[data, loading, error, refetch]`',
            'Four separate global variables',
            'An object: `{ data, loading, error, refetch }`',
            'Hooks must always return arrays, like `useState`',
          ],
          2,
          'With several values, an object lets callers take only what they need, by name: `const { data, error } = useFetch(url)`. Arrays shine for **pairs** that callers want to rename, like `[lit, toggleLit]`.',
        ),
        q(
          'This debounce hook forgets its cleanup. You type `gear` quickly (four keystrokes, 100 ms apart). How many times does the returned value change?\n\n```jsx\nfunction useDebounce(value, delay) {\n  const [debounced, setDebounced] = useState(value);\n  useEffect(() => {\n    setTimeout(() => setDebounced(value), delay);\n  }, [value, delay]);\n  return debounced;\n}\n```',
          [
            'Four times: "g", "ge", "gea", "gear", each one just arrives late',
            'Once, to "gear"',
            'Never',
            'It throws an error',
          ],
          0,
          'Without `return () => clearTimeout(id)`, no timer is ever cancelled, so all four fire. You built a **delay**, not a debounce. The cleanup is what lets each new keystroke cancel the previous timer.',
        ),
        q(
          "A component calls `const { data } = useFetch('/api/parts?q=' + query)`. Why does it fetch again when `query` changes?",
          [
            'Custom hooks re-mount whenever their arguments change',
            'React only re-runs a hook when its arguments change',
            'useFetch polls the server every second',
            'The hook runs on every render, and its effect lists `url` as a dependency, so the effect re-runs when the URL string changes',
          ],
          3,
          'A custom hook is just code running inside your component\'s render, on every render. Its **effect** decides when to do work: with `[url]` as dependencies, it re-runs only when the URL differs from last time.',
        ),
      ],
      concepts: [
        {
          id: 'hook-use-prefix',
          icon: '🏷️',
          title: 'The use prefix',
          summary: 'Name a function useSomething only if it calls hooks.',
          detail: 'The prefix tells readers and the linter that the Rules of Hooks apply to every call of it. A helper that calls no hooks is a plain function: formatPrice, not useFormatPrice.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'hook-boss',
      type: 'build',
      boss: true,
      bossName: 'The Hook Breaker',
      bossIcon: '🔨',
      title: 'Boss: The Hook Breaker',
      blurb: 'The Hook Breaker jammed the Clocktower. Forge useInterval and useCountdown to rebuild it.',
      xp: 300,
      badge: { id: 'badge-hook', name: 'Master Tinker', icon: '🪝', description: 'Defeated the Hook Breaker in the Hook Workshop.' },
      story: [
        { text: 'BOOM. The Hook Breaker kicked in the Clocktower door! He calls hooks wherever he pleases, and the countdown to the Midnight Festival is ruined.', mood: 'worried' },
        { text: "Look at his work in the editor: useInterval called only when the clock is running. One click on Start and the tower jams. Classic Hook Breaker.", mood: 'thinking' },
        { text: 'Beat him at his own game: forge a useInterval that can pause WITHOUT breaking the rules, compose it into useCountdown, and rebuild the tower!', mood: 'excited' },
      ],
      lesson: md`
        ## Your Workshop toolkit

        | Idea | Remember |
        |---|---|
        | Rules of Hooks | top level only, same order on every render |
        | Custom hook | a \`useX\` function that calls hooks |
        | Logic, not state | every call gets its own state |
        | Return shape | an array for pairs, an object for many values |
        | Composition | hooks can call hooks |

        ## Pausing without breaking the rules

        The Hook Breaker writes:

        \`\`\`jsx
        if (running) {
          useInterval(tick, 1000);   // ❌ a conditional hook
        }
        \`\`\`

        You can't skip a hook... but a hook can **skip its own work**. Design \`useInterval\`
        so that a \`null\` delay means *paused*, and always call it:

        \`\`\`jsx
        useInterval(tick, running ? 1000 : null);   // ✅ called on every render
        \`\`\`

        Inside, the effect simply bails out when there's nothing to do:

        \`\`\`jsx
        useEffect(() => {
          if (delay === null) return;   // paused: no interval at all
          const id = setInterval(/* ... */, delay);
          return () => clearInterval(id);
        }, [delay]);
        \`\`\`

        ## The fresh-callback problem

        Callers pass a brand-new inline function on every render:
        \`useInterval(() => setSecondsLeft(secondsLeft - 1), 1000)\`. Both obvious designs fail:

        - **List \`callback\` as a dependency**: the interval is torn down and restarted on every render. If the component re-renders more often than \`delay\`, it never fires at all.
        - **Leave \`callback\` out**: the interval keeps calling the *first* callback forever, with \`secondsLeft\` frozen at its first value (a stale closure).

        The fix: keep the latest callback in a **ref** (remember the Ref Ruins). A ref can change
        without restarting anything:

        \`\`\`jsx
        const savedCallback = useRef(callback);

        useEffect(() => {
          savedCallback.current = callback;   // after every render: remember the newest one
        });

        useEffect(() => {
          if (delay === null) return;
          const id = setInterval(() => savedCallback.current(), delay);
          return () => clearInterval(id);
        }, [delay]);   // only restarts when the delay changes
        \`\`\`

        :::pro
        React 19.2 added \`useEffectEvent\` for exactly this job:
        \`const onTick = useEffectEvent(callback)\`, then call \`onTick()\` inside the interval and
        leave it out of the dependencies. The ref pattern above is what it does for you, and
        you'll meet it in lots of existing code.
        :::

        ## Composing the countdown

        A countdown is state plus an interval, so \`useCountdown(from)\` is two \`useState\`
        calls (\`secondsLeft\`, \`running\`), one \`useInterval\` that only runs while
        \`running\`, and a few functions to start, pause and reset. Because the interval always
        calls the *latest* callback, it can read the current \`secondsLeft\` directly.

        :::tip
        Build in order and check often: \`useInterval\` first (three of the five checks test it
        directly), then \`useCountdown\`, then wire up \`App\`.
        :::
      `,
      task: md`
        ## 👑 Rebuild the Clocktower

        ### \`useInterval(callback, delay)\` (export it)
        - Calls the **latest** \`callback\` every \`delay\` ms.
        - A \`delay\` of \`null\` means paused: no interval at all.
        - Clears its interval on unmount and when \`delay\` changes, but **not** on every re-render (keep the callback in a ref).

        ### \`useCountdown(from)\` (export it)
        - Returns an object \`{ secondsLeft, running, start, pause, reset }\`. \`secondsLeft\` starts at \`from\`, \`running\` starts \`false\`.
        - While running, \`secondsLeft\` goes down by 1 every 1000 ms, using \`useInterval\` (pass \`null\` when not running).
        - At 0 it stops by itself (\`running\` becomes \`false\`) and never goes below 0.
        - \`start()\` and \`pause()\` switch \`running\`; \`reset()\` stops and goes back to \`from\`.

        ### \`App\`
        - Calls \`useCountdown(10)\` at its top level and shows \`<p className="clock">⏳ 10</p>\` (the seconds left).
        - Has the buttons **Start**, **Pause** and **Reset**.
        - When the countdown reaches 0, also shows \`<p className="midnight">🔔 Midnight!</p>\`.
      `,
      starter: code`
        import { useState, useEffect, useRef } from 'react';

        // 💥 The Hook Breaker's useInterval. It "works"... until you look closely:
        //  - it never clears its interval
        //  - it starts ANOTHER interval after every single render
        //  - it can't be paused, so he only calls it inside an if!
        export function useInterval(callback, delay) {
          useEffect(() => {
            setInterval(callback, delay);
          });
        }

        // TODO: compose useState + useInterval into a reusable countdown
        export function useCountdown(from) {
          return { secondsLeft: from, running: false, start() {}, pause() {}, reset() {} };
        }

        export default function App() {
          const [secondsLeft, setSecondsLeft] = useState(10);
          const [running, setRunning] = useState(false);

          if (running) {
            // 💥 A hook inside an if: the Hook Breaker's signature move
            useInterval(() => setSecondsLeft(secondsLeft - 1), 1000);
          }

          return (
            <div className="tower">
              <h2>🕰️ The Clocktower</h2>
              <p className="clock">⏳ {secondsLeft}</p>
              <button onClick={() => setRunning(true)}>Start</button>
              <button onClick={() => setRunning(false)}>Pause</button>
              <button
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(10);
                }}
              >
                Reset
              </button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect, useRef } from 'react';

        export function useInterval(callback, delay) {
          const savedCallback = useRef(callback);

          useEffect(() => {
            savedCallback.current = callback;
          });

          useEffect(() => {
            if (delay === null) return;
            const id = setInterval(() => savedCallback.current(), delay);
            return () => clearInterval(id);
          }, [delay]);
        }

        export function useCountdown(from) {
          const [secondsLeft, setSecondsLeft] = useState(from);
          const [running, setRunning] = useState(false);

          useInterval(
            () => {
              if (secondsLeft <= 1) {
                setSecondsLeft(0);
                setRunning(false);
              } else {
                setSecondsLeft(secondsLeft - 1);
              }
            },
            running ? 1000 : null,
          );

          return {
            secondsLeft,
            running,
            start: () => setRunning(true),
            pause: () => setRunning(false),
            reset: () => {
              setRunning(false);
              setSecondsLeft(from);
            },
          };
        }

        export default function App() {
          const { secondsLeft, start, pause, reset } = useCountdown(10);

          return (
            <div className="tower">
              <h2>🕰️ The Clocktower</h2>
              <p className="clock">⏳ {secondsLeft}</p>
              <button onClick={start}>Start</button>
              <button onClick={pause}>Pause</button>
              <button onClick={reset}>Reset</button>
              {secondsLeft === 0 && <p className="midnight">🔔 Midnight!</p>}
            </div>
          );
        }
      `,
      hints: [
        md`Rewrite \`useInterval\`: \`const savedCallback = useRef(callback);\` plus an effect **without** a dependency array that does \`savedCallback.current = callback;\`.`,
        md`Its second effect: \`if (delay === null) return; const id = setInterval(() => savedCallback.current(), delay); return () => clearInterval(id);\` with \`[delay]\` as dependencies.`,
        md`\`useCountdown\`: two \`useState\`s, then \`useInterval(() => { if (secondsLeft <= 1) { setSecondsLeft(0); setRunning(false); } else { setSecondsLeft(secondsLeft - 1); } }, running ? 1000 : null);\` and return \`{ secondsLeft, running, start: () => setRunning(true), pause: () => setRunning(false), reset: () => { setRunning(false); setSecondsLeft(from); } }\`. In \`App\`: \`const { secondsLeft, start, pause, reset } = useCountdown(10);\`.`,
      ],
      tests: [
        test('useInterval calls back every delay ms and cleans up on unmount', async (t) => {
          const useInterval = requireExport(t, 'useInterval', 'useInterval(callback, delay)');
          let calls = 0;
          probeHook(t, () =>
            useInterval(() => {
              calls += 1;
            }, 1000),
          );
          for (let i = 0; i < 3; i++) await t.tick(1000);
          t.expect(calls === 3, `After 3000 ms the callback ran ${calls} time(s) — expected 3 (once every 1000 ms).`);
          t.unmount();
          const left = t.timers.pendingIntervals();
          t.expect(left === 0, `After unmounting, ${left} interval(s) are still running. Return a cleanup from the effect: return () => clearInterval(id);`);
        }),
        test('A null delay pauses useInterval', async (t) => {
          const useInterval = requireExport(t, 'useInterval', 'useInterval(callback, delay)');
          let calls = 0;
          const p = probeHook(
            t,
            ({ delay }) =>
              useInterval(() => {
                calls += 1;
              }, delay),
            { delay: null },
          );
          for (let i = 0; i < 3; i++) await t.tick(1000);
          t.expect(calls === 0, `With a null delay the callback still ran ${calls} time(s). When delay is null, set up no interval at all: return early from the effect.`);
          p.rerender({ delay: 500 });
          await t.tick(500);
          await t.tick(500);
          t.expect(calls === 2, `After the delay changed from null to 500 and 1000 ms passed, the callback ran ${calls} time(s) — expected 2. List delay in the effect's dependencies.`);
          p.rerender({ delay: null });
          await t.tick(1000);
          await t.tick(1000);
          t.expect(
            calls === 2 && t.timers.pendingIntervals() === 0,
            `After pausing again (delay null) the callback ran ${calls - 2} more time(s) and ${t.timers.pendingIntervals()} interval(s) are still running. The cleanup must clear the old interval when delay changes.`,
          );
        }),
        test('useInterval keeps its rhythm and calls the latest callback', async (t) => {
          const useInterval = requireExport(t, 'useInterval', 'useInterval(callback, delay)');
          let calls = 0;
          const rhythm = probeHook(
            t,
            () =>
              useInterval(() => {
                calls += 1;
              }, 1000),
            { n: 0 },
          );
          for (let n = 1; n <= 5; n++) {
            await t.tick(600);
            rhythm.rerender({ n }); // a re-render with a brand-new callback every 600 ms
          }
          t.expect(
            calls === 3,
            `The component re-rendered every 600 ms and the callback ran ${calls} time(s) in 3000 ms — expected 3. Re-renders must not restart (or duplicate) the interval: keep the callback in a ref and list only [delay] as the dependencies.`,
          );
          t.unmount();
          let total = 0;
          const latest = probeHook(
            t,
            ({ step }) =>
              useInterval(() => {
                total += step;
              }, 1000),
            { step: 1 },
          );
          await t.tick(1000);
          latest.rerender({ step: 10 });
          await t.tick(1000);
          t.expect(
            total === 11,
            `The callback changed to add 10, but the interval still called an old one (total is ${total}, expected 1 + 10 = 11). Store the newest callback in a ref after every render and call savedCallback.current() inside the interval.`,
          );
        }),
        test('useCountdown counts down, pauses, resets and stops at zero', async (t) => {
          const useCountdown = requireExport(t, 'useCountdown', 'useCountdown(from)');
          const p = probeHook(t, () => useCountdown(3));
          const v = () => p.value || {};
          t.expect(
            p.value && typeof p.value === 'object' && !Array.isArray(p.value),
            `useCountdown returned ${show(p.value)} — it should return an object { secondsLeft, running, start, pause, reset }.`,
          );
          for (const key of ['start', 'pause', 'reset']) t.expect(typeof v()[key] === 'function', `useCountdown's result has no ${key}() function.`);
          t.expect(
            v().secondsLeft === 3 && v().running === false,
            `useCountdown(3) should start as { secondsLeft: 3, running: false } — got secondsLeft ${show(v().secondsLeft)}, running ${show(v().running)}.`,
          );
          callInAct(t, () => v().start(), 'start()');
          t.expect(v().running === true, `After start(), running is ${show(v().running)} — expected true.`);
          await t.tick(1000);
          t.expect(v().secondsLeft === 2, `One second after start(), secondsLeft is ${show(v().secondsLeft)} — expected 2.`);
          callInAct(t, () => v().pause(), 'pause()');
          await t.tick(1000);
          await t.tick(1000);
          t.expect(
            v().secondsLeft === 2 && v().running === false,
            `After pause() and 2 more seconds, secondsLeft is ${show(v().secondsLeft)} and running is ${show(v().running)} — expected 2 and false. Pass null to useInterval while paused.`,
          );
          callInAct(t, () => v().start(), 'start()');
          for (let i = 0; i < 4; i++) await t.tick(1000);
          t.expect(v().secondsLeft === 0, `After running past zero, secondsLeft is ${show(v().secondsLeft)} — it should stop at 0.`);
          t.expect(v().running === false, `At 0 the countdown should stop by itself (running false) — got running ${show(v().running)}.`);
          t.expect(t.timers.pendingIntervals() === 0, 'At 0 an interval is still running. Pass null to useInterval once the countdown is not running.');
          callInAct(t, () => v().reset(), 'reset()');
          t.expect(
            v().secondsLeft === 3 && v().running === false,
            `After reset(), secondsLeft is ${show(v().secondsLeft)} and running is ${show(v().running)} — expected 3 and false.`,
          );
        }),
        test('The Clocktower counts down and rings at midnight', async (t) => {
          t.render();
          const clock = () => norm(t.find('.clock').textContent);
          t.expect(clock() === '⏳ 10', `The clock shows "${clock()}" — expected "⏳ 10".`);
          const start = t.button('Start');
          attempt(
            () => t.click(start),
            "That's the Hook Breaker's trick: clicking Start changed how many hooks App calls (a hook inside an if). Call useCountdown(10) once at the top of App, unconditionally.",
          );
          t.sourceIncludes(/useCountdown\s*\(\s*10\s*\)/, 'App should get its timer from useCountdown(10).');
          for (let i = 0; i < 3; i++) await t.tick(1000);
          t.expect(clock() === '⏳ 7', `3 seconds after Start the clock shows "${clock()}" — expected "⏳ 7".`);
          t.click(t.button('Pause'));
          await t.tick(1000);
          await t.tick(1000);
          t.expect(clock() === '⏳ 7', `After Pause the clock kept moving to "${clock()}" — expected it to stay at "⏳ 7".`);
          t.click(t.button('Reset'));
          t.expect(clock() === '⏳ 10', `After Reset the clock shows "${clock()}" — expected "⏳ 10".`);
          t.click(t.button('Start'));
          for (let i = 0; i < 12; i++) await t.tick(1000);
          t.expect(clock() === '⏳ 0', `After counting all the way down the clock shows "${clock()}" — expected "⏳ 0" (never below zero).`);
          const bell = t.$('.midnight');
          t.expect(bell && norm(bell.textContent) === '🔔 Midnight!', 'At zero, show <p className="midnight">🔔 Midnight!</p>.');
        }),
      ],
      css: `
.tower {
  text-align: center;
  background: radial-gradient(circle at 50% 0%, #7a5230, #2d1b0e 75%);
  color: #fdf3d8;
  border: 3px solid #c9a227;
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 5px 0 #6b4f12;
}
.tower h2 { color: #ffe08a; }
.clock { font-size: 2.8em; font-weight: 800; margin: 6px 0 12px; font-variant-numeric: tabular-nums; text-shadow: 0 0 12px rgba(255, 214, 102, 0.6); }
.tower button { background: #c9a227; color: #2d1b0e; box-shadow: 0 3px 0 #7d6312; }
.tower button:hover { background: #e0b93a; }
.midnight { display: inline-block; font-size: 1.5em; font-weight: 800; color: #ffd166; animation: ring 0.35s ease-in-out infinite alternate; }
@keyframes ring { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
`,
      concepts: [
        {
          id: 'hook-use-interval',
          icon: '⏱️',
          title: 'useInterval',
          summary: 'A declarative interval: latest callback in a ref, delay null to pause.',
          snippet: code`
            useInterval(() => {
              setSecondsLeft(secondsLeft - 1);
            }, running ? 1000 : null);
          `,
          detail: 'Hooks can never be skipped, so design them to skip their own work instead: a null delay means paused.',
        },
        {
          id: 'hook-latest-ref',
          icon: '📌',
          title: 'Latest-callback ref',
          summary: 'Keep the newest callback in a ref so long-lived timers never call a stale one.',
          snippet: code`
            const saved = useRef(callback);
            useEffect(() => {
              saved.current = callback;
            });
          `,
          detail: 'The interval effect then depends only on [delay]: re-renders don’t restart it, yet it always calls the freshest callback. React 19.2’s useEffectEvent does the same job.',
        },
      ],
    },
  ],
};
