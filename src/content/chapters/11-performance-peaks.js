import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Check helpers (local to this chapter)
// ---------------------------------------------------------------------------

/** Whitespace-collapsed text. */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** How many console lines contain `text` (e.g. "render RouteList"). */
const countLogs = (t, text) => t.logLines().filter((line) => line.includes(text)).length;

/** Fails with a friendly message when the render-counting console.log was removed. */
function expectLogs(t, text, component) {
  const n = countLogs(t, text);
  t.expect(
    n > 0,
    `No "${text}" lines were logged. Keep the console.log('${text}') line at the top of ${component}: Pip counts renders with it.`,
  );
  return n;
}

/** Text of each matching element with any leading emoji/punctuation removed. */
const labels = (t, sel) => t.$$(sel).map((el) => norm(el.textContent).replace(/^[^A-Za-z0-9]+/, ''));

/**
 * Runs an interaction while a MutationObserver records every DOM change, so a
 * check can see short-lived intermediate commits (a pending spinner, a stale
 * class) that are gone again by the time the interaction returns.
 */
function recordMutations(t, action) {
  const records = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(t.container, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
  });
  try {
    action();
  } finally {
    records.push(...observer.takeRecords());
    observer.disconnect();
  }
  return records;
}

/** Did an element with class `cls` appear (or get that class) at any moment during the records? */
function sawClass(records, cls) {
  const has = (value) => String(value || '').split(/\s+/).includes(cls);
  return records.some((r) => {
    if (r.type === 'attributes' && r.attributeName === 'class') {
      return has(r.oldValue) || has(r.target.getAttribute('class'));
    }
    if (r.type === 'childList') {
      return Array.from(r.addedNodes).some(
        (n) => n.nodeType === 1 && (n.classList.contains(cls) || n.querySelector(`.${cls}`)),
      );
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Shared look
// ---------------------------------------------------------------------------

const SNOW_CSS = `
.peak-card {
  background: linear-gradient(180deg, #e7f5ff, #ffffff 70%);
  border: 3px solid #74c0fc;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 4px 0 #a5d8ff;
}
.peak-card h2 { color: #1864ab; }
.peak-card button { background: #1c7ed6; box-shadow: 0 3px 0 #1864ab; }
.peak-card button:hover { background: #339af0; }
`;

const TREASURE = [
  { id: 1, name: 'Golden goblet', value: 120 },
  { id: 2, name: 'Ruby ring', value: 300 },
  { id: 3, name: 'Silver shield', value: 80 },
  { id: 4, name: 'Golden crown', value: 500 },
  { id: 5, name: 'Emerald egg', value: 250 },
  { id: 6, name: 'Golden harp', value: 180 },
];

/** Names an unstable prop in the Wyrm's lair, to make failure messages specific. */
function wyrmCulprits(source) {
  const list = [];
  if (!/\bmemo\s*\(/.test(source)) list.push('Hoard is not wrapped in memo');
  if (!/\buseMemo\s*\(/.test(source)) list.push('items is a new array on every render (useMemo)');
  if (/labels=\{\{/.test(source)) list.push('labels is a new object on every render (move it into a constant)');
  if (/onClaim=\{\s*\(/.test(source)) list.push('onClaim is a new function on every render (useCallback)');
  return list.length ? ` Still waking him: ${list.join('; ')}.` : '';
}

export default {
  id: 'performance-peaks',
  file: '11-performance-peaks.js',
  title: 'Performance Peaks',
  short: 'Performance',
  subtitle: 'Learn when React re-renders, how state is kept or reset, and how to skip work that is not needed.',
  icon: '🏔️',
  colors: ['#1e3a5f', '#a5d8ff'],
  scenery: ['❄️', '🏔️', '🦅', '⛷️', '🌨️', '🐐', '⚡', '🧗'],
  intro: [
    { text: 'Brrr! Welcome to the Performance Peaks, where the air is thin and every wasted render echoes off the mountains.', mood: 'happy' },
    { text: 'Up here you will learn WHEN React re-renders, how it keeps or resets state, and the freezing spells: memo, useMemo and useCallback.', mood: 'thinking' },
    { text: 'And at the summit lives the Re-render Wyrm. He never sleeps, because nothing up there ever stops re-rendering. Yet.', mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'peaks-colocate',
      type: 'code',
      title: 'The Avalanche',
      blurb: 'Every keystroke re-renders the whole mountain. Measure it, then move the state down.',
      xp: 120,
      story: [
        { text: 'Yara the yeti keeps the Base Camp log. But every letter she types re-renders the ENTIRE mountain. Rumble... rumble...', mood: 'worried' },
        { text: "Open the console under the preview: each 'render Mountain' line is one re-render. Measure first, then fix it, without any fancy tools!", mood: 'thinking' },
      ],
      lesson: md`
        ## When does a component re-render?

        A component re-renders (React calls your function again) for one of three reasons:

        1. **Its own state changed**: you called a \`set\` function with a new value.
        2. **Its parent re-rendered**: by default React re-renders *all* children of a component that rendered, whether their props changed or not.
        3. **A context it reads changed**: every \`useContext(SomeContext)\` reader re-renders when the provided value changes.

        That's the whole list. "Its props changed" is not a separate trigger: props only
        change because the parent re-rendered.

        ## Rendering is usually cheap

        Re-rendering means calling your component function and comparing the new JSX with the
        old. React only touches the **DOM** where something actually changed. Most re-renders
        are harmless and fast, so don't panic about them.

        They matter when a component is **slow to render** (huge lists, heavy calculations)
        *and* re-renders **often** (on every keystroke, every animation frame...).

        ## Measure before you optimise

        Never guess. Find out what renders, and how slow it is:

        - Put \`console.log('render Mountain')\` in a component and watch the console.
        - Use the **React DevTools Profiler** (a browser extension): it records every render, shows how long each component took, and can highlight components as they re-render.

        ## Fix #1: move state down

        \`\`\`jsx
        function App() {
          const [note, setNote] = useState('');
          return (
            <>
              <input value={note} onChange={(e) => setNote(e.target.value)} />
              <Mountain />   {/* re-renders on every keystroke! */}
            </>
          );
        }
        \`\`\`

        \`note\` lives in \`App\`, so every keystroke re-renders \`App\`, and with it \`Mountain\`.
        But only the input needs \`note\`! Move the state **down** into a small component that owns it:

        \`\`\`jsx
        function NoteBox() {
          const [note, setNote] = useState('');
          return <input value={note} onChange={(e) => setNote(e.target.value)} />;
        }

        function App() {
          return (
            <>
              <NoteBox />
              <Mountain />   {/* App never re-renders now, so neither does Mountain */}
            </>
          );
        }
        \`\`\`

        This is **state colocation**: keep state as close as possible to where it's used. It's
        free, makes the code clearer, and is often the only "optimisation" you need.

        :::tip
        It's the mirror image of lifting state up. Lift state when several components need to
        *share* it; push it down when only one small part uses it.
        :::

        :::pro
        **Fix #2: pass slow parts as \`children\`.** If a component with fast-changing state must
        wrap a slow part, let the parent create it: \`<Weather><Mountain /></Weather>\`. When
        \`Weather\`'s state changes, its \`children\` prop is still the very same element the parent
        made, so React skips re-rendering \`Mountain\`.
        :::
      `,
      task: md`
        ## 🎯 Stop the avalanche

        Typing in the summit log re-renders the whole \`Mountain\` (watch the console!).

        1. Create a component named **\`SummitLog\`** that owns the \`note\` state and renders the \`<label>\` with the \`<input className="log">\`, plus the \`<p className="echo">\` that shows **Logged: ** followed by the note.
        2. \`App\` renders the \`<h2>\`, then \`<SummitLog />\`, then \`<Mountain />\`, and **holds no state** any more.
        3. Keep the line \`console.log('render Mountain')\`: Pip uses it to count renders. Typing must not re-render \`Mountain\`.
      `,
      starter: code`
        import { useState } from 'react';

        const PEAKS = [
          { id: 1, name: 'Mount Memo', height: 4810 },
          { id: 2, name: 'Callback Crag', height: 4478 },
          { id: 3, name: 'Deferred Dome', height: 3970 },
          { id: 4, name: 'Transition Tor', height: 4158 },
        ];

        function Mountain() {
          console.log('render Mountain'); // keep me: Pip counts renders
          return (
            <ul className="mountain">
              {PEAKS.map((peak) => (
                <li key={peak.id}>
                  🏔️ {peak.name}: {peak.height} m
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          const [note, setNote] = useState('');

          return (
            <div className="peak-card camp">
              <h2>⛺ Base Camp</h2>
              <label>
                Summit log: <input className="log" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <p className="echo">Logged: {note}</p>
              <Mountain />
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const PEAKS = [
          { id: 1, name: 'Mount Memo', height: 4810 },
          { id: 2, name: 'Callback Crag', height: 4478 },
          { id: 3, name: 'Deferred Dome', height: 3970 },
          { id: 4, name: 'Transition Tor', height: 4158 },
        ];

        function Mountain() {
          console.log('render Mountain'); // keep me: Pip counts renders
          return (
            <ul className="mountain">
              {PEAKS.map((peak) => (
                <li key={peak.id}>
                  🏔️ {peak.name}: {peak.height} m
                </li>
              ))}
            </ul>
          );
        }

        function SummitLog() {
          const [note, setNote] = useState('');

          return (
            <>
              <label>
                Summit log: <input className="log" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <p className="echo">Logged: {note}</p>
            </>
          );
        }

        export default function App() {
          return (
            <div className="peak-card camp">
              <h2>⛺ Base Camp</h2>
              <SummitLog />
              <Mountain />
            </div>
          );
        }
      `,
      hints: [
        md`Ask: who actually *uses* \`note\`? Only the input and the echo paragraph. Those, plus the state, belong in their own component.`,
        md`Create \`function SummitLog() { const [note, setNote] = useState(''); return (<>...</>); }\` and move the \`<label>\` (with the input) and the \`<p className="echo">\` into it.`,
        md`\`App\` becomes \`return (<div className="peak-card camp"><h2>⛺ Base Camp</h2><SummitLog /><Mountain /></div>);\` with no \`useState\` at all.`,
      ],
      tests: [
        test('The summit log still echoes what you type', (t) => {
          t.render();
          t.type('input.log', 'Snowy');
          const echo = norm(t.find('.echo').textContent);
          t.expect(echo === 'Logged: Snowy', `After typing "Snowy" the echo reads "${echo}" — expected "Logged: Snowy".`);
        }),
        test('Typing no longer re-renders the Mountain', (t) => {
          t.render();
          for (const text of ['S', 'Sn', 'Sno']) t.type('input.log', text);
          const n = expectLogs(t, 'render Mountain', 'Mountain');
          t.expect(
            n === 1,
            `Mountain rendered ${n} times: once at the start plus ${n - 1} more while you typed 3 letters. Expected exactly 1. Move the note state, the input and the echo into a SummitLog component, so typing only re-renders SummitLog.`,
          );
        }),
        test('The note state lives in a SummitLog component', (t) => {
          t.sourceIncludes(/function\s+SummitLog\s*\(|(?:const|let)\s+SummitLog\s*=/, 'Create a component named SummitLog: function SummitLog() { ... }');
          t.sourceIncludes(/<SummitLog\b/, 'Render <SummitLog /> inside App.');
          t.render();
          const peaks = t.count('.mountain li');
          t.expect(peaks === 4, `The mountain shows ${peaks} peak(s) — keep the Mountain with all 4 peaks.`);
          t.expectElement('h2', 'Keep the <h2> heading in App.');
        }),
      ],
      css: `${SNOW_CSS}
.log { width: 220px; }
.echo { font-style: italic; color: #495057; min-height: 1.4em; }
.mountain { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.mountain li { background: linear-gradient(135deg, #f8f9fa, #dee2e6); border-radius: 10px; padding: 6px 10px; font-weight: 600; }
`,
      concepts: [
        {
          id: 'peaks-rerender-triggers',
          icon: '🔁',
          title: 'Why components re-render',
          summary: 'Own state changed, parent re-rendered, or a context it reads changed.',
          detail: 'Re-rendering calls your function again and diffs the result; the DOM only changes where needed. It is usually cheap: measure (console.log, React DevTools Profiler) before optimising.',
        },
        {
          id: 'peaks-colocation',
          icon: '📍',
          title: 'State colocation',
          summary: 'Keep state as close as possible to the components that use it.',
          snippet: code`
            function NoteBox() {
              const [note, setNote] = useState('');
              return <input value={note} onChange={(e) => setNote(e.target.value)} />;
            }
          `,
          detail: 'Moving state down means fewer components re-render when it changes. It is free and often the only optimisation you need.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'peaks-key',
      type: 'code',
      title: 'The Twin Summits',
      blurb: 'State lives at a position in the tree. Keep it when you should, reset it with a key when you must.',
      xp: 130,
      story: [
        { text: "At the Gondola Station climbers write postcards to friends. But switch friends and the half-written postcard is still there! Ada's secrets, sent to Linus. Yikes.", mood: 'worried' },
        { text: "And whenever night falls, the altimeter forgets how high we've climbed. React keeps state by POSITION in the tree. Let's use that, and break it on purpose with a key.", mood: 'thinking' },
      ],
      lesson: md`
        ## State lives at a position, not inside a function

        When \`Altimeter\` calls \`useState\`, the state isn't stored "inside" the function. React
        stores it in the **tree**, at the spot where \`<Altimeter />\` is rendered, and keeps it
        as long as the **same component type** keeps rendering at the **same position**.

        \`\`\`jsx
        // Same type at the same position: the state is kept ✅
        {night ? <Altimeter dark /> : <Altimeter />}
        \`\`\`

        Both branches put an \`<Altimeter>\` in the same slot, so React sees *one* Altimeter that
        just received new props.

        \`\`\`jsx
        // Different structure: the state is lost ❌
        {night ? (
          <div className="frame">
            <Altimeter />
          </div>
        ) : (
          <Altimeter />
        )}
        \`\`\`

        Now that slot holds a \`<div>\` in one branch and an \`<Altimeter>\` in the other. When the
        type at a position changes, React **destroys** the old subtree, state included, and
        builds a fresh one.

        | Change | State |
        |---|---|
        | same type, same position, new props | kept |
        | a different type at that position | reset |
        | wrapped in a different parent element | reset |
        | removed, then rendered again later | reset |

        :::mistake
        **Never define a component inside another component.** \`function App() { function Card() { ... } return <Card />; }\`
        creates a *brand-new* \`Card\` type on every render of \`App\`, so React resets its state
        every time. Always declare components at the top level of the file.
        :::

        ## Resetting state on purpose: \`key\`

        Sometimes you *want* a fresh component. A postcard form keeps its text when you switch
        friends, because it's the same \`Postcard\` at the same position: only its \`climber\`
        prop changed. Give it a **key**:

        \`\`\`jsx
        <Postcard key={friend.id} climber={friend} />
        \`\`\`

        A key gives a component its **identity**. When the key changes, React treats it as a
        *different* component: it unmounts the old one (dropping its state) and mounts a new
        one. You've used keys in lists; they work on any component.

        :::tip
        Resetting with a key beats resetting with an effect like \`useEffect(() => setMessage(''), [friend])\`:
        there's no extra render showing stale text, and *all* the state inside the subtree
        resets, even in nested children.
        :::
      `,
      task: md`
        ## 🎯 Fix the Gondola Station

        1. **Night mode must keep the altitude.** At night the \`Altimeter\` is wrapped in an extra \`<div className="frame">\`, so toggling resets it. Render it at the same position in both modes (for example, just \`<Altimeter />\`; the CSS already styles it at night).
        2. **Each friend gets a fresh postcard.** Give \`<Postcard>\` a \`key\` based on the selected friend's \`id\`, so switching friends resets the message.
        3. Keep everything else: the outer \`<div>\` has className **station** (plus **night** at night), the altimeter shows **⛰️ 300 m** after three climbs, and the label reads **Postcard to Linus:** when Linus is selected.
      `,
      starter: code`
        import { useState } from 'react';

        const FRIENDS = [
          { id: 'ada', name: 'Ada' },
          { id: 'linus', name: 'Linus' },
          { id: 'grace', name: 'Grace' },
        ];

        function Altimeter() {
          const [meters, setMeters] = useState(0);
          return (
            <div className="altimeter">
              <p className="meters">⛰️ {meters} m</p>
              <button onClick={() => setMeters(meters + 100)}>Climb 100 m</button>
            </div>
          );
        }

        function Postcard({ climber }) {
          const [message, setMessage] = useState('');
          return (
            <div className="postcard">
              <label>
                Postcard to {climber.name}:{' '}
                <input className="message" value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
            </div>
          );
        }

        export default function App() {
          const [night, setNight] = useState(false);
          const [friend, setFriend] = useState(FRIENDS[0]);

          return (
            <div className={night ? 'station night' : 'station'}>
              <button onClick={() => setNight(!night)}>{night ? '☀️ Day' : '🌙 Night'}</button>
              {night ? (
                <div className="frame">
                  <Altimeter />
                </div>
              ) : (
                <Altimeter />
              )}
              <div className="friends">
                {FRIENDS.map((f) => (
                  <button key={f.id} onClick={() => setFriend(f)}>
                    {f.name}
                  </button>
                ))}
              </div>
              <Postcard climber={friend} />
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const FRIENDS = [
          { id: 'ada', name: 'Ada' },
          { id: 'linus', name: 'Linus' },
          { id: 'grace', name: 'Grace' },
        ];

        function Altimeter() {
          const [meters, setMeters] = useState(0);
          return (
            <div className="altimeter">
              <p className="meters">⛰️ {meters} m</p>
              <button onClick={() => setMeters(meters + 100)}>Climb 100 m</button>
            </div>
          );
        }

        function Postcard({ climber }) {
          const [message, setMessage] = useState('');
          return (
            <div className="postcard">
              <label>
                Postcard to {climber.name}:{' '}
                <input className="message" value={message} onChange={(e) => setMessage(e.target.value)} />
              </label>
            </div>
          );
        }

        export default function App() {
          const [night, setNight] = useState(false);
          const [friend, setFriend] = useState(FRIENDS[0]);

          return (
            <div className={night ? 'station night' : 'station'}>
              <button onClick={() => setNight(!night)}>{night ? '☀️ Day' : '🌙 Night'}</button>
              <Altimeter />
              <div className="friends">
                {FRIENDS.map((f) => (
                  <button key={f.id} onClick={() => setFriend(f)}>
                    {f.name}
                  </button>
                ))}
              </div>
              <Postcard key={friend.id} climber={friend} />
            </div>
          );
        }
      `,
      hints: [
        md`Toggle night mode in the preview and watch the altitude reset. Compare the JSX of both branches of the \`night ? ... : ...\`: what sits at the Altimeter's position in each?`,
        md`Replace the whole ternary with a single \`<Altimeter />\`. The CSS rule \`.station.night .altimeter\` already gives it a night look.`,
        md`For the postcard, add a key that changes with the friend: \`<Postcard key={friend.id} climber={friend} />\`.`,
      ],
      tests: [
        test('Night mode keeps the altitude', (t) => {
          t.render();
          for (let i = 0; i < 3; i++) t.click(t.button('Climb'));
          const meters = () => norm(t.find('.meters').textContent);
          t.expect(meters() === '⛰️ 300 m', `After three climbs the altimeter shows "${meters()}" — expected "⛰️ 300 m".`);
          t.click(t.button('Night'));
          t.expect(
            meters() === '⛰️ 300 m',
            `After switching to night mode the altimeter shows "${meters()}" — expected "⛰️ 300 m". At night the Altimeter sits inside an extra <div>, a different position in the tree, so React throws its state away. Render the same structure in both modes.`,
          );
          t.click(t.button('Day'));
          t.expect(meters() === '⛰️ 300 m', `After switching back to day mode the altimeter shows "${meters()}" — expected "⛰️ 300 m".`);
        }),
        test('Night mode still darkens the station', (t) => {
          t.render();
          t.click(t.button('Night'));
          t.expectElement('.station.night', 'In night mode the outer <div> should have className "station night".');
          t.click(t.button('Day'));
          t.expect(t.$('.station') && !t.$('.station.night'), 'Back in day mode the outer <div> should have className "station" only.');
        }),
        test('Each friend gets a fresh postcard', (t) => {
          t.render();
          t.type('input.message', 'Meet me at the summit!');
          t.click(t.button('Linus'));
          const label = norm(t.find('.postcard label').textContent);
          t.expect(label.startsWith('Postcard to Linus'), `With Linus selected the label reads "${label}" — expected "Postcard to Linus:".`);
          const leaked = t.find('input.message').value;
          t.expect(
            leaked === '',
            `After switching to Linus the message box still says "${leaked}": Ada's postcard leaked! Give <Postcard> a key that changes with the friend, key={friend.id}.`,
          );
          t.type('input.message', 'Hi Linus');
          t.click(t.button('Ada'));
          const back = t.find('input.message').value;
          t.expect(back === '', `After switching back to Ada the message box says "${back}" — every switch should start a fresh, empty postcard.`);
        }),
        test('The postcard is reset with a key', (t) => {
          t.sourceIncludes(/<Postcard\b[^>]*\bkey\s*=\s*\{/, 'Reset the postcard with a key: <Postcard key={friend.id} climber={friend} />.');
          t.render();
          t.expectElement('.postcard input.message', 'Keep the postcard with its <input className="message">.');
        }),
      ],
      css: `
.station { background: linear-gradient(180deg, #d0ebff, #f8f9fa); border: 3px solid #4dabf7; border-radius: 16px; padding: 14px 16px; transition: background 0.3s, color 0.3s; }
.station.night { background: linear-gradient(180deg, #0b1d3a, #1c3d6e); color: #e7f5ff; }
.altimeter { background: rgba(255, 255, 255, 0.7); border-radius: 12px; padding: 6px 12px; margin: 8px 0; }
.station.night .altimeter { background: rgba(255, 255, 255, 0.12); outline: 2px dashed #ffd43b; }
.frame { padding: 4px; }
.meters { font-size: 1.6em; font-weight: 800; margin: 2px 0 6px; }
.friends button { background: #1971c2; }
.postcard { background: #fff9db; color: #5c3c00; border: 2px solid #fcc419; border-radius: 10px; padding: 8px 12px; margin-top: 8px; transform: rotate(-1deg); }
`,
      concepts: [
        {
          id: 'peaks-state-position',
          icon: '📌',
          title: 'State lives at a position',
          summary: 'Same component type at the same position in the tree = same state.',
          snippet: code`
            {night ? <Altimeter dark /> : <Altimeter />}   // state kept
            {night ? <div><Altimeter /></div> : <Altimeter />} // state reset
          `,
          detail: 'Change the type or the structure around a component and React rebuilds it from scratch. Never declare components inside other components.',
        },
        {
          id: 'peaks-key-reset',
          icon: '🗝️',
          title: 'Reset state with a key',
          summary: 'A new key makes React mount a fresh component with fresh state.',
          snippet: code`
            <Postcard key={friend.id} climber={friend} />
          `,
          detail: 'Keys are identities, not just for lists. Prefer a key over an effect that clears state.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'peaks-memo',
      type: 'code',
      title: 'The Memo Glacier',
      blurb: 'Freeze a component with memo and a slow calculation with useMemo.',
      xp: 140,
      story: [
        { text: 'The Summit Hut board shows wind, snowfall and a long list of routes. Every gust of wind re-renders the routes AND re-runs a slow avalanche-risk calculation.', mood: 'worried' },
        { text: 'Time for the freezing spells: memo freezes a component, useMemo freezes a calculation. Both thaw only when their inputs change.', mood: 'excited' },
      ],
      lesson: md`
        ## \`memo\`: skip a render when the props are the same

        Wrap a component in \`memo\` and React will **skip re-rendering it when its parent
        re-renders, as long as every prop is the same as last time**:

        \`\`\`jsx
        import { memo } from 'react';

        const Forecast = memo(function Forecast({ city }) {
          console.log('render Forecast');
          return <p>Snow expected in {city}</p>;
        });
        \`\`\`

        "The same" means \`Object.is(oldProp, newProp)\` for each prop: a **shallow** comparison.
        Strings, numbers and booleans compare by value; objects, arrays and functions compare
        by **reference** (more on that trap in the next quest).

        A memoised component **still re-renders** when one of its props changes, when its own
        state changes, or when a context it reads changes. \`memo\` only skips the renders
        caused by the *parent*.

        ## \`useMemo\`: cache a calculation

        \`\`\`jsx
        const total = useMemo(() => countSnowflakes(slopes, depth), [slopes, depth]);
        \`\`\`

        On the first render React calls the function and remembers the result. On later renders
        it compares the **dependencies** with last time: unchanged, it reuses the cached
        result; changed, it calls the function again. Dependencies work just like in
        \`useEffect\`: list every reactive value the calculation reads.

        ## Should you memoise everything?

        No! Memoisation costs extra code, extra comparisons, memory, and bugs when dependencies
        are wrong. Use it where **you measured** a problem:

        - \`memo\`: a component re-renders often **with the same props**, and its render is slow.
        - \`useMemo\`: a calculation is noticeably slow and its inputs rarely change. Measure it with \`console.time('risk')\` / \`console.timeEnd('risk')\`; React's docs suggest it starts to matter around **1 ms** or more.

        If a calculation is cheap (filtering 20 items), just recompute it: simpler and plenty fast.

        :::warn
        \`memo\` and \`useMemo\` are performance hints, not promises. Your code must still work
        correctly if React decides to render or recalculate anyway.
        :::

        :::pro
        The **React Compiler** is an optional build-time tool from the React team that analyses
        your components and adds this memoisation automatically. In projects that enable it you
        rarely write \`memo\`, \`useMemo\` or \`useCallback\` yourself. You still need to understand
        them: to read existing code, and to know *why* the compiler's output is fast.
        :::
      `,
      task: md`
        ## 🎯 Freeze the Summit Hut

        1. Wrap \`RouteList\` in **\`memo\`** (import it from \`'react'\`), so a **Gust** of wind no longer re-renders it. **Switch units** must still update it.
        2. Wrap the call \`slowRiskReport(ROUTES, snow)\` in **\`useMemo\`** with the right dependencies, so a gust doesn't recalculate the risk but a **Snowfall** does.
        3. Keep both \`console.log\` lines (\`'render RouteList'\` and \`'calculating risk'\`) and the texts **💨 Wind: 10 km/h** and **⚠️ Risky routes: 3**.
      `,
      starter: code`
        import { useState } from 'react';

        const ROUTES = [
          { id: 1, name: 'Memo Ridge', height: 4810, steepness: 7 },
          { id: 2, name: 'Callback Couloir', height: 4478, steepness: 9 },
          { id: 3, name: 'Snapshot Spur', height: 3970, steepness: 4 },
          { id: 4, name: 'Keystone Arete', height: 4158, steepness: 6 },
          { id: 5, name: 'Lazy Ledge', height: 2962, steepness: 2 },
        ];

        // Imagine this is VERY slow: it simulates every snowflake on every slope.
        function slowRiskReport(routes, snow) {
          console.log('calculating risk'); // keep me: Pip counts these
          return routes.filter((route) => route.steepness * snow >= 120).length;
        }

        function RouteList({ unit }) {
          console.log('render RouteList'); // keep me: Pip counts renders
          return (
            <ul className="routes">
              {ROUTES.map((route) => (
                <li key={route.id}>
                  🧗 {route.name}: {unit === 'm' ? route.height + ' m' : Math.round(route.height * 3.281) + ' ft'}
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          const [wind, setWind] = useState(10);
          const [snow, setSnow] = useState(20);
          const [unit, setUnit] = useState('m');

          const risky = slowRiskReport(ROUTES, snow);

          return (
            <div className="peak-card hut">
              <h2>🛖 The Summit Hut</h2>
              <p className="wind">💨 Wind: {wind} km/h</p>
              <p className="risk">⚠️ Risky routes: {risky}</p>
              <div>
                <button onClick={() => setWind(wind + 5)}>Gust</button>
                <button onClick={() => setSnow(snow + 10)}>Snowfall</button>
                <button onClick={() => setUnit(unit === 'm' ? 'ft' : 'm')}>Switch units</button>
              </div>
              <RouteList unit={unit} />
            </div>
          );
        }
      `,
      solution: code`
        import { memo, useMemo, useState } from 'react';

        const ROUTES = [
          { id: 1, name: 'Memo Ridge', height: 4810, steepness: 7 },
          { id: 2, name: 'Callback Couloir', height: 4478, steepness: 9 },
          { id: 3, name: 'Snapshot Spur', height: 3970, steepness: 4 },
          { id: 4, name: 'Keystone Arete', height: 4158, steepness: 6 },
          { id: 5, name: 'Lazy Ledge', height: 2962, steepness: 2 },
        ];

        // Imagine this is VERY slow: it simulates every snowflake on every slope.
        function slowRiskReport(routes, snow) {
          console.log('calculating risk'); // keep me: Pip counts these
          return routes.filter((route) => route.steepness * snow >= 120).length;
        }

        const RouteList = memo(function RouteList({ unit }) {
          console.log('render RouteList'); // keep me: Pip counts renders
          return (
            <ul className="routes">
              {ROUTES.map((route) => (
                <li key={route.id}>
                  🧗 {route.name}: {unit === 'm' ? route.height + ' m' : Math.round(route.height * 3.281) + ' ft'}
                </li>
              ))}
            </ul>
          );
        });

        export default function App() {
          const [wind, setWind] = useState(10);
          const [snow, setSnow] = useState(20);
          const [unit, setUnit] = useState('m');

          const risky = useMemo(() => slowRiskReport(ROUTES, snow), [snow]);

          return (
            <div className="peak-card hut">
              <h2>🛖 The Summit Hut</h2>
              <p className="wind">💨 Wind: {wind} km/h</p>
              <p className="risk">⚠️ Risky routes: {risky}</p>
              <div>
                <button onClick={() => setWind(wind + 5)}>Gust</button>
                <button onClick={() => setSnow(snow + 10)}>Snowfall</button>
                <button onClick={() => setUnit(unit === 'm' ? 'ft' : 'm')}>Switch units</button>
              </div>
              <RouteList unit={unit} />
            </div>
          );
        }
      `,
      hints: [
        md`Import both helpers: \`import { memo, useMemo, useState } from 'react';\`.`,
        md`Wrap the whole component: \`const RouteList = memo(function RouteList({ unit }) { ... });\`. Mind the closing \`)\` after the function's \`}\`.`,
        md`The risk only depends on \`snow\` (\`ROUTES\` never changes): \`const risky = useMemo(() => slowRiskReport(ROUTES, snow), [snow]);\`.`,
      ],
      tests: [
        test('A gust of wind does not re-render RouteList', (t) => {
          t.render();
          for (let i = 0; i < 3; i++) t.click(t.button('Gust'));
          const wind = norm(t.find('.wind').textContent);
          t.expect(wind === '💨 Wind: 25 km/h', `After three gusts the wind reads "${wind}" — expected "💨 Wind: 25 km/h".`);
          const n = expectLogs(t, 'render RouteList', 'RouteList');
          t.expect(
            n === 1,
            `RouteList rendered ${n} times: once at the start plus ${n - 1} more for three gusts. Expected 1. Wrap it in memo: const RouteList = memo(function RouteList({ unit }) { ... });`,
          );
        }),
        test('Switching units still re-renders RouteList', (t) => {
          t.render();
          t.click(t.button('Switch units'));
          const n = expectLogs(t, 'render RouteList', 'RouteList');
          t.expect(n === 2, `RouteList rendered ${n} time(s) — expected 2 (the first render plus the unit switch).`);
          t.expectText('Memo Ridge: 15782 ft', 'After switching units the list should show feet, e.g. "Memo Ridge: 15782 ft".');
        }),
        test('A gust does not recalculate the risk', (t) => {
          t.render();
          for (let i = 0; i < 3; i++) t.click(t.button('Gust'));
          const n = expectLogs(t, 'calculating risk', 'slowRiskReport');
          t.expect(
            n === 1,
            `slowRiskReport ran ${n} times for the first render plus three gusts — expected once. Cache it: const risky = useMemo(() => slowRiskReport(ROUTES, snow), [snow]);`,
          );
          const risk = norm(t.find('.risk').textContent);
          t.expect(risk === '⚠️ Risky routes: 3', `The risk line reads "${risk}" — expected "⚠️ Risky routes: 3".`);
        }),
        test('Snowfall recalculates the risk', (t) => {
          t.render();
          t.click(t.button('Snowfall'));
          const risk = norm(t.find('.risk').textContent);
          t.expect(
            risk === '⚠️ Risky routes: 4',
            `After a snowfall the risk line reads "${risk}" — expected "⚠️ Risky routes: 4". Is snow listed in the useMemo dependencies?`,
          );
          const n = expectLogs(t, 'calculating risk', 'slowRiskReport');
          t.expect(n === 2, `slowRiskReport ran ${n} time(s) — expected 2 (the first render plus one snowfall).`);
        }),
      ],
      css: `${SNOW_CSS}
.wind, .risk { display: inline-block; background: white; border-radius: 999px; padding: 4px 12px; margin: 0 6px 6px 0; font-weight: 700; }
.risk { color: #c92a2a; }
.routes { list-style: none; padding: 0; }
.routes li { background: white; border-left: 4px solid #4dabf7; border-radius: 6px; padding: 4px 10px; margin: 4px 0; }
`,
      concepts: [
        {
          id: 'peaks-memo',
          icon: '🧊',
          title: 'memo',
          summary: 'memo(Component) skips re-renders caused by the parent while every prop is unchanged.',
          snippet: code`
            const RouteList = memo(function RouteList({ unit }) {
              return <ul>...</ul>;
            });
          `,
          detail: 'Props are compared one by one with Object.is. Own state and context changes still re-render it.',
        },
        {
          id: 'peaks-use-memo',
          icon: '🧮',
          title: 'useMemo',
          summary: 'useMemo(fn, deps) caches a calculated value until a dependency changes.',
          snippet: code`
            const risky = useMemo(() => slowRiskReport(ROUTES, snow), [snow]);
          `,
          detail: 'Only worth it for slow calculations (measure first, ~1 ms or more) or to keep an object or array the same for a memoised child.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'peaks-thaw',
      type: 'bug',
      title: 'The Thawing Memo',
      blurb: 'Bug hunt! The trail map is memoised, yet it re-renders anyway. Find the brand-new props.',
      xp: 150,
      story: [
        { text: "Someone wrapped the Trail Map in memo... and it STILL re-renders whenever the lantern flickers. The ice is melting!", mood: 'worried' },
        { text: "The Mutator's trick: brand-new objects and functions on every render. To memo they look different every single time. Hunt them down!", mood: 'thinking' },
      ],
      lesson: md`
        ## Why memo stopped working

        \`\`\`jsx
        const TrailMap = memo(function TrailMap({ trails, style, onPick }) { /* ... */ });

        function App() {
          const trails = ROUTES.filter((r) => r.grade === grade);   // a new array every render
          return (
            <TrailMap
              trails={trails}
              style={{ border: '2px solid #9cc' }}                  // a new object every render
              onPick={(name) => setPicked(name)}                    // a new function every render
            />
          );
        }
        \`\`\`

        Every render of \`App\` creates a **new** array, a **new** object and a **new** function.
        They may *look* identical, but memo compares with \`Object.is\`, which compares
        objects by **reference** (is it the very same object?), not by contents:

        \`\`\`js
        Object.is('easy', 'easy');         // true: same value
        Object.is({ a: 1 }, { a: 1 });     // false: two different objects
        Object.is(() => {}, () => {});     // false: two different functions
        \`\`\`

        So memo sees "changed props" every time and re-renders anyway. **One** unstable prop
        is enough to break it.

        ## Three ways to keep props stable

        **1. Move constants out of the component.** A value that doesn't depend on props or
        state doesn't belong inside the component at all:

        \`\`\`jsx
        const CARD_STYLE = { border: '2px solid #9cc' };   // created once, when the file loads
        \`\`\`

        **2. \`useMemo\` for calculated objects and arrays.** It returns the *same* array as last
        time until a dependency changes:

        \`\`\`jsx
        const visible = useMemo(() => items.filter((item) => item.level === level), [level]);
        \`\`\`

        **3. \`useCallback\` for functions.** It returns the *same* function until a dependency
        changes:

        \`\`\`jsx
        const handleSelect = useCallback((id) => {
          setSelected(id);
        }, []);
        \`\`\`

        \`useCallback(fn, deps)\` is shorthand for \`useMemo(() => fn, deps)\`. Here the dependency
        list can be empty, because the \`set\` functions from \`useState\` never change.

        :::tip
        Because setters never change, \`onSelect={setSelected}\` is already stable: no
        \`useCallback\` needed when you just pass a setter along.
        :::

        :::mistake
        \`useCallback\` on its own makes nothing faster! It only helps when the function goes to a
        \`memo\` component (or into another hook's dependency list). Wrapping every handler "just
        in case" only adds noise.
        :::

        :::pro
        This bookkeeping is exactly what the **React Compiler** automates: it would have kept
        the array, the style and the handler stable for you.
        :::
      `,
      task: md`
        ## 🐛 Re-freeze the Trail Map

        \`TrailMap\` is wrapped in \`memo\`, but toggling the lantern still re-renders it. Three
        props are brand new on every render. Stabilise them:

        1. \`trails\`: wrap the filter in **\`useMemo\`** (it depends on \`grade\`).
        2. \`style\`: move the object **outside** \`App\` into a constant named **\`MAP_STYLE\`** and pass \`style={MAP_STYLE}\`.
        3. \`onPick\`: wrap the handler in **\`useCallback\`**, or pass \`setPicked\` directly.

        Keep \`console.log('render TrailMap')\`. Toggling the lantern or picking a trail must
        **not** re-render the map; changing the grade must.
      `,
      starter: code`
        import { memo, useState } from 'react';

        const ROUTES = [
          { id: 1, name: 'Bunny Slope', grade: 'easy' },
          { id: 2, name: 'Pinecone Path', grade: 'easy' },
          { id: 3, name: 'Marmot Meadow', grade: 'easy' },
          { id: 4, name: 'Wyrm Ridge', grade: 'hard' },
          { id: 5, name: 'Icefall Gully', grade: 'hard' },
        ];

        const TrailMap = memo(function TrailMap({ trails, style, onPick }) {
          console.log('render TrailMap'); // keep me: Pip counts renders
          return (
            <ul className="trails" style={style}>
              {trails.map((trail) => (
                <li key={trail.id}>
                  <button onClick={() => onPick(trail.name)}>🥾 {trail.name}</button>
                </li>
              ))}
            </ul>
          );
        });

        export default function App() {
          const [grade, setGrade] = useState('easy');
          const [picked, setPicked] = useState(null);
          const [lantern, setLantern] = useState(false);

          // 🐛 The Mutator's frost: all three props below are brand new on every render
          const trails = ROUTES.filter((route) => route.grade === grade);

          return (
            <div className={lantern ? 'peak-card hut lit' : 'peak-card hut'}>
              <h2>🗺️ The Trail Hut</h2>
              <button onClick={() => setLantern(!lantern)}>{lantern ? '🕯️ Lantern off' : '🔦 Lantern on'}</button>
              <label>
                Grade:{' '}
                <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <p className="picked">Picked: {picked ?? 'nothing yet'}</p>
              <TrailMap
                trails={trails}
                style={{ border: '2px solid #99cccc', borderRadius: 12 }}
                onPick={(name) => setPicked(name)}
              />
            </div>
          );
        }
      `,
      solution: code`
        import { memo, useCallback, useMemo, useState } from 'react';

        const ROUTES = [
          { id: 1, name: 'Bunny Slope', grade: 'easy' },
          { id: 2, name: 'Pinecone Path', grade: 'easy' },
          { id: 3, name: 'Marmot Meadow', grade: 'easy' },
          { id: 4, name: 'Wyrm Ridge', grade: 'hard' },
          { id: 5, name: 'Icefall Gully', grade: 'hard' },
        ];

        const MAP_STYLE = { border: '2px solid #99cccc', borderRadius: 12 };

        const TrailMap = memo(function TrailMap({ trails, style, onPick }) {
          console.log('render TrailMap'); // keep me: Pip counts renders
          return (
            <ul className="trails" style={style}>
              {trails.map((trail) => (
                <li key={trail.id}>
                  <button onClick={() => onPick(trail.name)}>🥾 {trail.name}</button>
                </li>
              ))}
            </ul>
          );
        });

        export default function App() {
          const [grade, setGrade] = useState('easy');
          const [picked, setPicked] = useState(null);
          const [lantern, setLantern] = useState(false);

          const trails = useMemo(() => ROUTES.filter((route) => route.grade === grade), [grade]);

          const handlePick = useCallback((name) => {
            setPicked(name);
          }, []);

          return (
            <div className={lantern ? 'peak-card hut lit' : 'peak-card hut'}>
              <h2>🗺️ The Trail Hut</h2>
              <button onClick={() => setLantern(!lantern)}>{lantern ? '🕯️ Lantern off' : '🔦 Lantern on'}</button>
              <label>
                Grade:{' '}
                <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <p className="picked">Picked: {picked ?? 'nothing yet'}</p>
              <TrailMap trails={trails} style={MAP_STYLE} onPick={handlePick} />
            </div>
          );
        }
      `,
      hints: [
        md`Toggle the lantern in the preview and watch the console: every toggle logs \`render TrailMap\`. memo is fine; the *props* are the problem. Which ones are created fresh inside \`App\`?`,
        md`\`const trails = useMemo(() => ROUTES.filter((route) => route.grade === grade), [grade]);\` and, above \`App\`, \`const MAP_STYLE = { border: '2px solid #99cccc', borderRadius: 12 };\`.`,
        md`\`const handlePick = useCallback((name) => { setPicked(name); }, []);\` then \`<TrailMap trails={trails} style={MAP_STYLE} onPick={handlePick} />\`. Don't forget to import \`useMemo\` and \`useCallback\`.`,
      ],
      tests: [
        test('Toggling the lantern does not re-render the TrailMap', (t) => {
          t.render();
          t.click(t.button('Lantern'));
          t.click(t.button('Lantern'));
          const n = expectLogs(t, 'render TrailMap', 'TrailMap');
          const culprits = [];
          if (!/\buseMemo\s*\(/.test(t.source)) culprits.push('trails (wrap the filter in useMemo)');
          if (/style=\{\{/.test(t.source)) culprits.push('style (move it into a MAP_STYLE constant)');
          if (/onPick=\{\s*\(/.test(t.source)) culprits.push('onPick (useCallback, or pass setPicked)');
          t.expect(
            n === 1,
            `TrailMap rendered ${n} times after toggling the lantern twice — expected 1.${culprits.length ? ' Still brand new on every render: ' + culprits.join('; ') + '.' : ''}`,
          );
        }),
        test('Picking a trail updates the sign without re-rendering the map', (t) => {
          t.render();
          t.click(t.button('Pinecone Path'));
          const picked = norm(t.find('.picked').textContent);
          t.expect(picked === 'Picked: Pinecone Path', `After picking Pinecone Path the sign reads "${picked}" — expected "Picked: Pinecone Path".`);
          const n = expectLogs(t, 'render TrailMap', 'TrailMap');
          t.expect(
            n === 1,
            `Picking a trail re-rendered the TrailMap (${n} renders in total, expected 1). Its trails, style and onPick did not change, so memo should skip it: keep onPick stable with useCallback (or pass setPicked).`,
          );
        }),
        test('Changing the grade re-renders the map with the right trails', (t) => {
          t.render();
          t.change('select', 'hard');
          const names = labels(t, '.trails li');
          t.expect(
            names.join(', ') === 'Wyrm Ridge, Icefall Gully',
            `With grade "hard" the map shows: ${names.join(', ') || 'nothing'} — expected Wyrm Ridge, Icefall Gully. Is grade listed in the useMemo dependencies?`,
          );
          const n = expectLogs(t, 'render TrailMap', 'TrailMap');
          t.expect(n === 2, `TrailMap rendered ${n} time(s) — expected 2 (the first render plus the grade change).`);
        }),
        test('The map style comes from a MAP_STYLE constant', (t) => {
          t.sourceIncludes(/const\s+MAP_STYLE\s*=\s*\{/, "Create the style object once, outside App: const MAP_STYLE = { border: '2px solid #99cccc', borderRadius: 12 };");
          t.sourceIncludes(/style=\{\s*MAP_STYLE\s*\}/, 'Pass the constant to the map: style={MAP_STYLE}.');
          t.render();
          t.expect(t.find('.trails').getAttribute('style'), 'The trail map lost its style. Pass style={MAP_STYLE} to TrailMap.');
        }),
      ],
      css: `${SNOW_CSS}
.hut.lit { background: linear-gradient(180deg, #fff3bf, #ffe8a1 70%); border-color: #fab005; }
.picked { font-weight: 700; color: #1864ab; }
.trails { list-style: none; padding: 8px; background: white; }
.trails li { display: inline-block; }
.trails button { background: #2f9e44; box-shadow: 0 3px 0 #237032; }
`,
      concepts: [
        {
          id: 'peaks-reference-equality',
          icon: '🪞',
          title: 'Same contents ≠ same object',
          summary: 'Objects, arrays and functions created during render are new every time, which breaks memo.',
          snippet: code`
            Object.is({ a: 1 }, { a: 1 }); // false
            Object.is(() => {}, () => {}); // false
          `,
          detail: 'Hoist constants out of the component, useMemo computed objects/arrays, useCallback functions. State setters are already stable.',
        },
        {
          id: 'peaks-use-callback',
          icon: '🎣',
          title: 'useCallback',
          summary: 'useCallback(fn, deps) returns the same function until a dependency changes.',
          snippet: code`
            const handlePick = useCallback((name) => {
              setPicked(name);
            }, []);
          `,
          detail: 'Equivalent to useMemo(() => fn, deps). Only useful when the function goes to a memoised child or into a dependency list.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'peaks-lanes',
      type: 'code',
      title: 'The Two Lanes',
      blurb: 'Tell React which updates are urgent with useTransition and useDeferredValue.',
      xp: 160,
      story: [
        { text: 'The Observatory on the highest peak has two paths up: a fast lane for urgent things like typing and clicking, and a slow scenic lane for heavy rendering.', mood: 'thinking' },
        { text: 'Right now everything squeezes into the fast lane, so the whole observatory jams. Teach React which updates can wait!', mood: 'excited' },
      ],
      lesson: md`
        ## Urgent vs non-urgent updates

        Some updates must feel instant: typing a letter, pressing a button. Others can take a
        moment: re-rendering a huge list, opening a heavy tab. React lets you mark the second
        kind as **non-urgent**. React then renders it **in the background**, and if something
        urgent happens meanwhile (another keystroke), it pauses or throws away that background
        work and handles the urgent update first. The page never freezes.

        | Hook | You control... | Use it when |
        |---|---|---|
        | \`useTransition\` | the **state update** | you own the \`set\` call (switching tabs, filters) |
        | \`useDeferredValue\` | a **value** | you have a value (a query, a prop) and want a lagging copy for the slow part |

        ## useTransition

        \`\`\`jsx
        const [isPending, startTransition] = useTransition();

        function showPage(next) {
          startTransition(() => {
            setPage(next);   // non-urgent: React may interrupt it
          });
        }
        \`\`\`

        - \`startTransition(fn)\` calls \`fn\` right away, but every state update inside it is marked as a **transition**.
        - \`isPending\` is \`true\` while the transition is still rendering: perfect for a spinner. Meanwhile the old page stays on screen and stays clickable.

        :::warn
        Don't use a transition for a **controlled input's** own state:
        \`startTransition(() => setText(e.target.value))\` makes the text lag behind your typing.
        The input must update urgently; defer the *expensive part* instead (next section).
        :::

        ## useDeferredValue

        \`\`\`jsx
        const [term, setTerm] = useState('');
        const deferredTerm = useDeferredValue(term);
        const isStale = term !== deferredTerm;

        <input value={term} onChange={(e) => setTerm(e.target.value)} />
        <div style={{ opacity: isStale ? 0.5 : 1 }}>
          <SlowResults term={deferredTerm} />
        </div>
        \`\`\`

        When \`term\` changes, React first re-renders with the **old** \`deferredTerm\` (so the
        input updates instantly), then re-renders in the background with the new one. While the
        two differ, the results on screen are **stale**: dim them so users know fresh ones are coming.

        For this to help, the slow component must be wrapped in **\`memo\`**: during the urgent
        render its prop (\`deferredTerm\`) hasn't changed yet, so memo lets React skip it.

        :::mistake
        \`useDeferredValue\` is not a debounce. There's no fixed delay: on a fast device the
        background render happens almost immediately, and new keystrokes *interrupt* it rather
        than postpone it.
        :::

        :::pro
        In React 19 you can pass an **async** function to \`startTransition\`, and \`isPending\`
        stays \`true\` until it finishes. Functions like that are called **Actions**; you'll master
        them in the Arcane Spire.
        :::

        :::try
        Set \`LAG\` to 30 at the top of the starter and type fast in the star search, or click
        **Sky**. Feel the jank, then feel the difference after your fix.
        :::
      `,
      task: md`
        ## 🎯 Open the two lanes

        **Tabs** (\`useTransition\`)

        1. In \`App\`, call \`useTransition()\` and wrap \`setTab(next)\` inside \`startTransition\` in \`selectTab\`.
        2. While \`isPending\` is \`true\`, render \`<span className="pending">⏳ Loading…</span>\` inside the \`<nav>\`.

        **Star search** (\`useDeferredValue\`)

        3. Create \`deferredQuery\` with \`useDeferredValue(query)\` and pass **it**, not \`query\`, to \`<StarList>\`.
        4. Give the results wrapper the className **results stale** while \`query !== deferredQuery\`, and just **results** otherwise.
        5. Keep \`StarList\` wrapped in \`memo\`, with its \`console.log('render StarList')\`.
      `,
      starter: code`
        import { memo, useState } from 'react';

        const STARS = ['Polaris', 'Sirius', 'Vega', 'Rigel', 'Betelgeuse', 'Altair', 'Deneb', 'Capella', 'Arcturus', 'Aldebaran', 'Spica', 'Antares'];

        const NOTES = {
          peaks: '🏔️ 14 peaks charted, 3 still unnamed.',
          weather: '🌨️ Snow above 3000 m, wind from the north.',
        };

        // 🐢 Want to FEEL the lag in the preview? Set LAG to 30 and type fast.
        const LAG = 0;

        function Star({ name }) {
          for (let i = 0; i < LAG * 20000; i++) {
            // busy work: pretend that drawing one star is expensive
          }
          return <li>⭐ {name}</li>;
        }

        function TabPanel({ tab }) {
          if (tab === 'sky') {
            return (
              <ul className="panel sky">
                {STARS.map((name) => (
                  <Star key={name} name={name} />
                ))}
              </ul>
            );
          }
          return <p className="panel">{NOTES[tab]}</p>;
        }

        const StarList = memo(function StarList({ query }) {
          console.log('render StarList'); // keep me: Pip counts renders
          const shown = STARS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
          return (
            <ul className="stars">
              {shown.map((name) => (
                <Star key={name} name={name} />
              ))}
            </ul>
          );
        });

        export default function App() {
          const [tab, setTab] = useState('peaks');
          const [query, setQuery] = useState('');

          function selectTab(next) {
            // TODO: mark this update as a transition
            setTab(next);
          }

          return (
            <div className="observatory">
              <nav className="tabs">
                <button onClick={() => selectTab('peaks')}>Peaks</button>
                <button onClick={() => selectTab('weather')}>Weather</button>
                <button onClick={() => selectTab('sky')}>Sky</button>
                {/* TODO: <span className="pending">⏳ Loading…</span> while pending */}
              </nav>
              <TabPanel tab={tab} />
              <input className="search" placeholder="Search the stars…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {/* TODO: pass a deferred query, and add "stale" while it lags behind */}
              <div className="results">
                <StarList query={query} />
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { memo, useDeferredValue, useState, useTransition } from 'react';

        const STARS = ['Polaris', 'Sirius', 'Vega', 'Rigel', 'Betelgeuse', 'Altair', 'Deneb', 'Capella', 'Arcturus', 'Aldebaran', 'Spica', 'Antares'];

        const NOTES = {
          peaks: '🏔️ 14 peaks charted, 3 still unnamed.',
          weather: '🌨️ Snow above 3000 m, wind from the north.',
        };

        // 🐢 Want to FEEL the lag in the preview? Set LAG to 30 and type fast.
        const LAG = 0;

        function Star({ name }) {
          for (let i = 0; i < LAG * 20000; i++) {
            // busy work: pretend that drawing one star is expensive
          }
          return <li>⭐ {name}</li>;
        }

        function TabPanel({ tab }) {
          if (tab === 'sky') {
            return (
              <ul className="panel sky">
                {STARS.map((name) => (
                  <Star key={name} name={name} />
                ))}
              </ul>
            );
          }
          return <p className="panel">{NOTES[tab]}</p>;
        }

        const StarList = memo(function StarList({ query }) {
          console.log('render StarList'); // keep me: Pip counts renders
          const shown = STARS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
          return (
            <ul className="stars">
              {shown.map((name) => (
                <Star key={name} name={name} />
              ))}
            </ul>
          );
        });

        export default function App() {
          const [tab, setTab] = useState('peaks');
          const [query, setQuery] = useState('');
          const [isPending, startTransition] = useTransition();
          const deferredQuery = useDeferredValue(query);
          const isStale = query !== deferredQuery;

          function selectTab(next) {
            startTransition(() => {
              setTab(next);
            });
          }

          return (
            <div className="observatory">
              <nav className="tabs">
                <button onClick={() => selectTab('peaks')}>Peaks</button>
                <button onClick={() => selectTab('weather')}>Weather</button>
                <button onClick={() => selectTab('sky')}>Sky</button>
                {isPending && <span className="pending">⏳ Loading…</span>}
              </nav>
              <TabPanel tab={tab} />
              <input className="search" placeholder="Search the stars…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className={isStale ? 'results stale' : 'results'}>
                <StarList query={deferredQuery} />
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Import the two hooks: \`import { memo, useDeferredValue, useState, useTransition } from 'react';\`.`,
        md`Tabs: \`const [isPending, startTransition] = useTransition();\`, then in \`selectTab\`: \`startTransition(() => { setTab(next); });\`, and in the nav: \`{isPending && <span className="pending">⏳ Loading…</span>}\`.`,
        md`Search: \`const deferredQuery = useDeferredValue(query);\` then \`<div className={query !== deferredQuery ? 'results stale' : 'results'}><StarList query={deferredQuery} /></div>\`.`,
      ],
      tests: [
        test('Switching tabs still shows the right panel', (t) => {
          t.render();
          t.click(t.button('Weather'));
          const weather = norm(t.find('.panel').textContent);
          t.expect(weather.includes('Snow above 3000 m'), `After clicking Weather the panel reads "${weather}" — expected the weather note.`);
          t.click(t.button('Sky'));
          const stars = t.count('.panel.sky li');
          t.expect(stars === 12, `After clicking Sky the panel shows ${stars} star(s) — expected all 12.`);
        }),
        test('A tab switch is a transition: ⏳ Loading… shows while it renders', (t) => {
          t.render();
          const records = recordMutations(t, () => t.click(t.button('Weather')));
          t.expect(
            sawClass(records, 'pending'),
            'The .pending indicator never appeared while switching tabs. Call const [isPending, startTransition] = useTransition(); wrap setTab(next) in startTransition(() => { ... }) and render <span className="pending">⏳ Loading…</span> while isPending is true.',
          );
          t.expect(!t.$('.pending'), 'The ⏳ Loading… indicator is still showing after the switch finished. Only render it while isPending is true.');
          t.expect(norm(t.find('.panel').textContent).includes('Snow above 3000 m'), 'After the transition finished, the Weather panel should be showing.');
        }),
        test('The star list follows a deferred query (marked stale while it catches up)', (t) => {
          t.render();
          const records = recordMutations(t, () => t.type('input.search', 'el'));
          t.expect(
            sawClass(records, 'stale'),
            'The results never got the "stale" class. Create const deferredQuery = useDeferredValue(query), pass deferredQuery to <StarList>, and use className={query !== deferredQuery ? \'results stale\' : \'results\'}.',
          );
          t.sourceExcludes(/<StarList\s+query=\{\s*query\s*\}/, 'StarList still receives query directly. Pass the deferred copy instead: <StarList query={deferredQuery} />.');
          t.expect(!t.$('.stale'), 'The results still have the "stale" class after React caught up. Only add it while query !== deferredQuery.');
          const stars = labels(t, '.stars li');
          t.expect(stars.join(', ') === 'Rigel, Betelgeuse, Capella', `Searching "el" shows: ${stars.join(', ') || 'nothing'} — expected Rigel, Betelgeuse, Capella.`);
        }),
        test('StarList stays memoised: one render per keystroke', (t) => {
          t.render();
          t.type('input.search', 'e');
          t.type('input.search', 'el');
          const n = expectLogs(t, 'render StarList', 'StarList');
          t.expect(
            n === 3,
            `StarList rendered ${n} times for the first render plus 2 keystrokes — expected 3. Keep StarList wrapped in memo: during the urgent render its deferred query hasn't changed yet, so memo lets React skip it.`,
          );
        }),
      ],
      css: `
.observatory { background: linear-gradient(180deg, #0b1026, #1d2b64); color: #e8ecff; border-radius: 16px; padding: 14px 16px; border: 3px solid #4c6ef5; }
.observatory button { background: #3b5bdb; }
.tabs { display: flex; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.pending { margin-left: 8px; font-weight: 700; color: #ffd166; }
.panel { background: rgba(255, 255, 255, 0.08); padding: 8px 12px; border-radius: 10px; margin: 6px 0 10px; }
.panel.sky, .stars { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.stars { padding: 0; }
.panel.sky li, .stars li { background: rgba(255, 255, 255, 0.12); padding: 3px 10px; border-radius: 999px; }
.search { width: 100%; max-width: 280px; }
.results { transition: opacity 0.2s; margin-top: 6px; }
.results.stale { opacity: 0.4; }
`,
      concepts: [
        {
          id: 'peaks-use-transition',
          icon: '🚦',
          title: 'useTransition',
          summary: 'Marks state updates as non-urgent; isPending is true while they render.',
          snippet: code`
            const [isPending, startTransition] = useTransition();
            startTransition(() => {
              setTab('sky');
            });
          `,
          detail: 'Transitions render in the background and are interrupted by urgent updates. Never use them for a controlled input’s own value.',
        },
        {
          id: 'peaks-use-deferred-value',
          icon: '🐢',
          title: 'useDeferredValue',
          summary: 'A lagging copy of a value: the urgent render keeps the old one, a background render catches up.',
          snippet: code`
            const deferredQuery = useDeferredValue(query);
            const isStale = query !== deferredQuery;
            <StarList query={deferredQuery} /> // StarList wrapped in memo
          `,
          detail: 'Only helps when the slow child is memoised. It is not a debounce: there is no fixed delay.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'peaks-trial',
      type: 'quiz',
      title: 'Trial of the Summit',
      blurb: 'The mountain guides test your instincts for speed. Eight questions.',
      xp: 100,
      story: [{ text: "The summit guides only lead climbers who think before they optimise. Answer their eight questions; every answer explains itself.", mood: 'happy' }],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'Which of these does NOT make a component re-render?',
          [
            'Calling its state setter with a new value',
            'Its parent component re-rendering',
            'A context it reads getting a new value',
            'Mutating a property of an object it received as a prop',
          ],
          3,
          'React only re-renders when it is *told* something changed: a `set` call, a parent render, or a new context value. Mutating an object behind React\'s back tells it nothing (remember the Immutable Isles), so nothing re-renders.',
        ),
        q(
          'Does `Badge` re-render when `Shop` re-renders?\n\n```jsx\nconst Badge = memo(function Badge({ style }) {\n  return <span style={style}>★</span>;\n});\n\nfunction Shop() {\n  // ...some state...\n  return <Badge style={{ color: \'gold\' }} />;\n}\n```',
          [
            'No: memo always prevents it',
            "Yes: `{ color: 'gold' }` is a new object on every render, so memo sees a changed prop",
            'Only when the colour changes',
            'Only in development mode',
          ],
          1,
          'memo compares each prop with `Object.is`, and two separately created objects are never equal, even with identical contents. Move the object into a constant outside the component (or `useMemo` it) to keep it the same.',
        ),
        q(
          'Ada\'s counter shows 3. You flip `isAda` to `false`. What does the counter show now?\n\n```jsx\n{isAda ? <Counter person="Ada" /> : <Counter person="Linus" />}\n```',
          [
            '0: each person gets a brand-new counter',
            'It crashes: two components can\'t share a position',
            '3: same component type at the same position, so React keeps the state',
            'Whatever Linus had the last time he was shown',
          ],
          2,
          'React ties state to a **position** in the tree. Both branches render a `<Counter>` in the same slot, so React sees one Counter whose `person` prop changed. To give each person their own counter, add keys: `key="ada"` and `key="linus"`.',
        ),
        q(
          'Which change gives a component brand-new state?',
          [
            'Changing its `key`',
            'Passing it a different prop value',
            'Re-rendering its parent',
            'Calling its state setter with the same value',
          ],
          0,
          'A new `key` is a new identity: React unmounts the old component (dropping its state) and mounts a fresh one. New props and parent renders keep the existing state.',
        ),
        q(
          '`useCallback(fn, deps)` is the same as...',
          ['`useMemo(fn, deps)`', '`useEffect(fn, deps)`', '`useRef(fn)`', '`useMemo(() => fn, deps)`'],
          3,
          '`useMemo` caches whatever its function **returns**. To cache the function itself, return it: `useMemo(() => fn, deps)`. `useMemo(fn, deps)` would *call* `fn` and cache its result instead.',
        ),
        q(
          'Typing in a search box feels sluggish because a huge memoised list re-filters on every keystroke. What keeps typing responsive?',
          [
            'Wrap `setQuery(e.target.value)` in `startTransition`',
            'Pass `useDeferredValue(query)` to the memoised list',
            'Wrap the input\'s `onChange` handler in `useCallback`',
            'Give the input a `key`',
          ],
          1,
          'The input itself must update urgently, so its state should *not* be a transition (that makes the text lag). Give the slow list a deferred copy of the query instead: React updates the input first and re-renders the list in the background, abandoning that work if you keep typing.',
        ),
        q(
          'Your app feels slow. What is the best first step?',
          [
            'Wrap every component in `memo`, just in case',
            'Add `useMemo` around every calculation',
            'Measure: count renders or record with the React DevTools Profiler to find what is actually slow',
            'Move all state into one big context',
          ],
          2,
          'Optimising blind adds complexity and often fixes nothing. Measure first, then reach for the simplest fix that works (often just moving state down) before adding memoisation.',
        ),
        q(
          'What does the React Compiler do?',
          [
            'Adds memoisation automatically at build time, so you rarely write `memo`, `useMemo` or `useCallback` by hand',
            'Turns your JSX into HTML on the server',
            'Makes every state update a transition',
            'Removes the need for keys in lists',
          ],
          0,
          'The React Compiler is an optional build step that analyses components and caches values, functions and JSX for you. It relies on your code following the rules (pure components, Rules of Hooks), so everything you learned here still matters.',
        ),
      ],
      concepts: [
        {
          id: 'peaks-react-compiler',
          icon: '🤖',
          title: 'The React Compiler',
          summary: 'An optional build-time tool that memoises components and values automatically.',
          detail: 'With it enabled you rarely write memo, useMemo or useCallback by hand. It relies on pure components and the Rules of Hooks.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'peaks-boss',
      type: 'build',
      boss: true,
      bossName: 'The Re-render Wyrm',
      bossIcon: '🐉',
      title: 'Boss: The Re-render Wyrm',
      blurb: 'Every wasted render is a roar. Make the hoard render only when it truly changes.',
      xp: 300,
      badge: { id: 'badge-peaks', name: 'Summit Sage', icon: '🏔️', description: 'Silenced the Re-render Wyrm on the Performance Peaks.' },
      story: [
        { text: 'At the summit, coiled around a mountain of treasure, lies the Re-render Wyrm. He NEVER sleeps, and every wasted render makes him roar.', mood: 'worried' },
        { text: "Each 'render Hoard' line in the console is one roar. His heartbeat, the torch, every claim: everything wakes him.", mood: 'thinking' },
        { text: 'Silence him: the hoard may only render when what it shows really changes. Use everything you learned on these peaks!', mood: 'excited' },
      ],
      lesson: md`
        ## The Wyrm's lair

        Three things wake the Wyrm (re-render the \`Hoard\`) for no reason:

        - **His heartbeat**: an interval in \`App\` updates \`breaths\` every second, re-rendering \`App\` and everything in it.
        - **The torch**: unrelated state in \`App\`.
        - **Brand-new props**: even a memoised \`Hoard\` would wake up, because \`items\`, \`labels\` and \`onClaim\` are new on every render.

        ## The optimisation checklist

        1. **Measure.** Count renders (that's what the console lines are for) or record with the React DevTools Profiler.
        2. **Move state down.** State used by one small part belongs in that part.
        3. **\`memo\`** the slow component.
        4. **Stabilise its props**: constants outside the component, \`useMemo\` for computed objects and arrays, \`useCallback\` for functions.
        5. **\`useMemo\`** slow calculations.
        6. Still slow no matter what? Make the update non-urgent with **\`useTransition\`** or **\`useDeferredValue\`**.

        | Tool | Keeps... | Until... |
        |---|---|---|
        | \`memo(Component)\` | the last render | a prop changes (\`Object.is\`) |
        | \`useMemo(fn, deps)\` | a calculated value | a dependency changes |
        | \`useCallback(fn, deps)\` | a function | a dependency changes |
        | a constant outside | a value | forever |
        | \`key\` | nothing! | it *resets* on purpose |

        :::tip
        Use the updater form inside \`useCallback\`: \`setClaimed((c) => [...c, id])\` doesn't read
        \`claimed\`, so the dependency list can stay empty and the function never changes.
        :::

        :::pro
        With the React Compiler enabled, steps 3 to 5 happen automatically. Steps 1 and 2 stay
        yours forever: measuring and structuring state well never go out of style.
        :::
      `,
      task: md`
        ## 👑 Silence the Re-render Wyrm

        Make \`Hoard\` render **only when what it shows changes**: the search, the sort order or
        the claimed treasure. Keep both \`console.log\` lines (\`'render Hoard'\` and \`'sorting treasure'\`).

        1. Wrap \`Hoard\` in \`memo\`.
        2. Cache the filtered and sorted list with \`useMemo\`, so \`sortTreasure\` only runs when \`query\` or \`sortBy\` changes.
        3. Move the \`labels\` object into a constant outside \`App\` (e.g. \`LABELS\`).
        4. Wrap the claim handler in \`useCallback\`, using the updater form \`setClaimed((c) => [...c, id])\`.
        5. Recommended: move the heartbeat (the \`breaths\` state, its effect and the \`.breaths\` paragraph) down into its own \`WyrmHeart\` component.

        Everything must keep working: the heartbeat (**🐉 The Wyrm has breathed 3 times**), the
        torch (the lair gets the class \`lit\`), the search, sorting **By value**, and claiming
        (the claimed \`<li>\` gets the class \`claimed\`, and the counter reads **Claimed: 1**).
      `,
      starter: code`
        import { useEffect, useState } from 'react';

        const TREASURE = [
          { id: 1, name: 'Golden goblet', value: 120 },
          { id: 2, name: 'Ruby ring', value: 300 },
          { id: 3, name: 'Silver shield', value: 80 },
          { id: 4, name: 'Golden crown', value: 500 },
          { id: 5, name: 'Emerald egg', value: 250 },
          { id: 6, name: 'Golden harp', value: 180 },
        ];

        function sortTreasure(items, sortBy) {
          console.log('sorting treasure'); // keep me: Pip counts these
          return [...items].sort((a, b) => (sortBy === 'value' ? b.value - a.value : a.name.localeCompare(b.name)));
        }

        function Hoard({ items, claimed, labels, onClaim }) {
          console.log('render Hoard'); // keep me: every line is one roar of the Wyrm!
          return (
            <ul className="hoard">
              {items.map((item) => {
                const taken = claimed.includes(item.id);
                return (
                  <li key={item.id} className={taken ? 'claimed' : ''}>
                    <span className="name">{item.name}</span>
                    <span className="value">{item.value} gp</span>
                    <button onClick={() => onClaim(item.id)} disabled={taken}>
                      {taken ? labels.taken : labels.claim}
                    </button>
                  </li>
                );
              })}
            </ul>
          );
        }

        export default function App() {
          const [breaths, setBreaths] = useState(0);
          const [torch, setTorch] = useState(false);
          const [query, setQuery] = useState('');
          const [sortBy, setSortBy] = useState('name');
          const [claimed, setClaimed] = useState([]);

          // The Wyrm's heartbeat: thump... thump... (App re-renders every second!)
          useEffect(() => {
            const id = setInterval(() => setBreaths((b) => b + 1), 1000);
            return () => clearInterval(id);
          }, []);

          const found = TREASURE.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
          const items = sortTreasure(found, sortBy);

          return (
            <div className={torch ? 'lair lit' : 'lair'}>
              <p className="breaths">🐉 The Wyrm has breathed {breaths} times</p>
              <button onClick={() => setTorch(!torch)}>{torch ? 'Douse the torch' : 'Light the torch'}</button>
              <div className="controls">
                <input className="search" placeholder="Search the hoard…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">By name</option>
                  <option value="value">By value</option>
                </select>
              </div>
              <p className="loot">Claimed: {claimed.length}</p>
              <Hoard
                items={items}
                claimed={claimed}
                labels={{ claim: '🫳 Claim', taken: '✓ Taken' }}
                onClaim={(id) => setClaimed([...claimed, id])}
              />
            </div>
          );
        }
      `,
      solution: code`
        import { memo, useCallback, useEffect, useMemo, useState } from 'react';

        const TREASURE = [
          { id: 1, name: 'Golden goblet', value: 120 },
          { id: 2, name: 'Ruby ring', value: 300 },
          { id: 3, name: 'Silver shield', value: 80 },
          { id: 4, name: 'Golden crown', value: 500 },
          { id: 5, name: 'Emerald egg', value: 250 },
          { id: 6, name: 'Golden harp', value: 180 },
        ];

        const LABELS = { claim: '🫳 Claim', taken: '✓ Taken' };

        function sortTreasure(items, sortBy) {
          console.log('sorting treasure'); // keep me: Pip counts these
          return [...items].sort((a, b) => (sortBy === 'value' ? b.value - a.value : a.name.localeCompare(b.name)));
        }

        const Hoard = memo(function Hoard({ items, claimed, labels, onClaim }) {
          console.log('render Hoard'); // keep me: every line is one roar of the Wyrm!
          return (
            <ul className="hoard">
              {items.map((item) => {
                const taken = claimed.includes(item.id);
                return (
                  <li key={item.id} className={taken ? 'claimed' : ''}>
                    <span className="name">{item.name}</span>
                    <span className="value">{item.value} gp</span>
                    <button onClick={() => onClaim(item.id)} disabled={taken}>
                      {taken ? labels.taken : labels.claim}
                    </button>
                  </li>
                );
              })}
            </ul>
          );
        });

        function WyrmHeart() {
          const [breaths, setBreaths] = useState(0);

          useEffect(() => {
            const id = setInterval(() => setBreaths((b) => b + 1), 1000);
            return () => clearInterval(id);
          }, []);

          return <p className="breaths">🐉 The Wyrm has breathed {breaths} times</p>;
        }

        export default function App() {
          const [torch, setTorch] = useState(false);
          const [query, setQuery] = useState('');
          const [sortBy, setSortBy] = useState('name');
          const [claimed, setClaimed] = useState([]);

          const items = useMemo(() => {
            const found = TREASURE.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
            return sortTreasure(found, sortBy);
          }, [query, sortBy]);

          const handleClaim = useCallback((id) => {
            setClaimed((c) => [...c, id]);
          }, []);

          return (
            <div className={torch ? 'lair lit' : 'lair'}>
              <WyrmHeart />
              <button onClick={() => setTorch(!torch)}>{torch ? 'Douse the torch' : 'Light the torch'}</button>
              <div className="controls">
                <input className="search" placeholder="Search the hoard…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">By name</option>
                  <option value="value">By value</option>
                </select>
              </div>
              <p className="loot">Claimed: {claimed.length}</p>
              <Hoard items={items} claimed={claimed} labels={LABELS} onClaim={handleClaim} />
            </div>
          );
        }
      `,
      hints: [
        md`Measure first: watch the console in the preview. The heartbeat alone logs \`render Hoard\` and \`sorting treasure\` every second. Start with \`const Hoard = memo(function Hoard(...) { ... });\`.`,
        md`memo alone isn't enough: \`items\`, \`labels\` and \`onClaim\` are new on every render. \`const items = useMemo(() => sortTreasure(TREASURE.filter(...), sortBy), [query, sortBy]);\` and \`const LABELS = { claim: '🫳 Claim', taken: '✓ Taken' };\` outside \`App\`.`,
        md`\`const handleClaim = useCallback((id) => { setClaimed((c) => [...c, id]); }, []);\` then \`<Hoard items={items} claimed={claimed} labels={LABELS} onClaim={handleClaim} />\`. Bonus: move \`breaths\` and its effect into a \`WyrmHeart\` component.`,
      ],
      tests: [
        test('The heartbeat no longer wakes the Wyrm', async (t) => {
          t.render();
          for (let i = 0; i < 3; i++) await t.tick(1000);
          const breaths = norm(t.find('.breaths').textContent);
          t.expect(/breathed 3 times/.test(breaths), `After 3 seconds the heartbeat reads "${breaths}" — expected "🐉 The Wyrm has breathed 3 times". Keep the heartbeat working.`);
          const renders = expectLogs(t, 'render Hoard', 'Hoard');
          t.expect(renders === 1, `The Hoard rendered ${renders} times while the Wyrm breathed 3 times — expected 1.${wyrmCulprits(t.source)}`);
          const sorts = expectLogs(t, 'sorting treasure', 'sortTreasure');
          t.expect(sorts === 1, `sortTreasure ran ${sorts} times during 3 heartbeats — expected once. Cache the filtered and sorted list with useMemo, depending on [query, sortBy].`);
        }),
        test('Lighting the torch does not wake the Wyrm', (t) => {
          t.render();
          t.click(t.button('torch'));
          t.expectElement('.lair.lit', 'Lighting the torch should still give the lair the class "lit".');
          t.click(t.button('torch'));
          const renders = expectLogs(t, 'render Hoard', 'Hoard');
          t.expect(renders === 1, `The Hoard rendered ${renders} times after lighting and dousing the torch — expected 1.${wyrmCulprits(t.source)}`);
          const sorts = countLogs(t, 'sorting treasure');
          t.expect(sorts === 1, `sortTreasure ran ${sorts} times after toggling the torch — expected once. useMemo with [query, sortBy] skips it when only the torch changes.`);
        }),
        test('Searching re-sorts and re-renders the hoard exactly once', (t) => {
          t.render();
          t.type('input.search', 'golden');
          const names = labels(t, '.hoard .name');
          t.expect(
            names.join(', ') === 'Golden crown, Golden goblet, Golden harp',
            `Searching "golden" shows: ${names.join(', ') || 'nothing'} — expected Golden crown, Golden goblet, Golden harp (sorted by name).`,
          );
          const renders = expectLogs(t, 'render Hoard', 'Hoard');
          t.expect(renders === 2, `The Hoard rendered ${renders} time(s) — expected 2 (the first render plus the search).`);
          const sorts = expectLogs(t, 'sorting treasure', 'sortTreasure');
          t.expect(sorts === 2, `sortTreasure ran ${sorts} time(s) — expected 2. List query in the useMemo dependencies.`);
        }),
        test('Claiming treasure re-renders the hoard exactly once', async (t) => {
          t.render();
          const ruby = t.$$('.hoard li').find((li) => li.textContent.includes('Ruby ring'));
          t.expect(ruby, 'Could not find the Ruby ring in the hoard.');
          t.click(ruby.querySelector('button'));
          const loot = norm(t.find('.loot').textContent);
          t.expect(loot === 'Claimed: 1', `After claiming the Ruby ring the counter reads "${loot}" — expected "Claimed: 1".`);
          const claimedLi = t.$$('.hoard li.claimed');
          t.expect(claimedLi.length === 1 && claimedLi[0].textContent.includes('Ruby ring'), 'The claimed Ruby ring <li> should get className "claimed".');
          await t.tick(1000);
          const renders = expectLogs(t, 'render Hoard', 'Hoard');
          t.expect(
            renders === 2,
            `The Hoard rendered ${renders} time(s) for the first render, one claim and one heartbeat — expected 2.${wyrmCulprits(t.source)}`,
          );
        }),
        test('Sorting by value works', (t) => {
          t.render();
          t.change('select.sort', 'value');
          const names = labels(t, '.hoard .name');
          const expected = 'Golden crown, Ruby ring, Emerald egg, Golden harp, Golden goblet, Silver shield';
          t.expect(names.join(', ') === expected, `Sorted by value the hoard shows: ${names.join(', ')} — expected ${expected}.`);
          const renders = expectLogs(t, 'render Hoard', 'Hoard');
          t.expect(renders === 2, `The Hoard rendered ${renders} time(s) — expected 2 (the first render plus the sort change). List sortBy in the useMemo dependencies.`);
        }),
      ],
      css: `
.lair { background: radial-gradient(circle at 50% 0%, #3b2f5c, #120e1f 80%); color: #f3e8ff; border: 3px solid #7950f2; border-radius: 16px; padding: 14px 16px; transition: background 0.4s; }
.lair.lit { background: radial-gradient(circle at 50% 0%, #b8742e, #2a1a0f 80%); border-color: #fab005; }
.breaths { font-weight: 800; font-size: 1.1em; animation: thump 1s ease-in-out infinite; transform-origin: left center; }
@keyframes thump { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.lair button { background: #7950f2; box-shadow: 0 3px 0 #5f3dc4; }
.controls { margin: 8px 0; }
.loot { color: #ffd43b; font-weight: 700; }
.hoard { list-style: none; padding: 0; }
.hoard li { display: flex; align-items: center; gap: 10px; background: rgba(255, 255, 255, 0.08); margin: 4px 0; padding: 4px 10px; border-radius: 10px; }
.hoard .name { flex: 1; font-weight: 700; }
.hoard .value { color: #ffd43b; }
.hoard li.claimed { opacity: 0.55; text-decoration: line-through; }
`,
      concepts: [
        {
          id: 'peaks-optimisation-checklist',
          icon: '🐉',
          title: 'The optimisation checklist',
          summary: 'Measure, move state down, memo, stabilise props, useMemo, then transitions.',
          snippet: code`
            const items = useMemo(() => sortTreasure(found, sortBy), [found, sortBy]);
            const onClaim = useCallback((id) => setClaimed((c) => [...c, id]), []);
            <Hoard items={items} labels={LABELS} onClaim={onClaim} />
          `,
          detail: 'Each step is cheaper and simpler than the next, so stop as soon as the measurements say it is fast enough.',
        },
      ],
    },
  ],
};
