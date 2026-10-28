import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Small helpers shared by this chapter's checks.
// ---------------------------------------------------------------------------

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** `<input class="spell">`-style description of an element, for failure messages. */
function describe(el) {
  if (!el || !el.tagName) return 'nothing';
  if (el === el.ownerDocument.body) return 'nothing in particular (the page itself)';
  const tag = el.tagName.toLowerCase();
  const cls = el.getAttribute('class');
  return `<${tag}${cls ? ` class="${cls}"` : ''}>`;
}

/** The element that currently has keyboard focus. */
const focused = (t) => t.container.ownerDocument.activeElement;

/** " (Your code crashed: …)" if one of the player's handlers threw since `from`. */
function crashNote(t, from) {
  const crash = t.warnings.slice(from).find((w) => /^(TypeError|ReferenceError|RangeError|Error):/.test(w));
  return crash ? ` (Your code crashed: ${crash.split('\n')[0].slice(0, 160)})` : '';
}

/** Source without comments, so a comment mentioning an API never trips a check. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/**
 * Runs `fn(calls)` while `scrollIntoView` is replaced by a spy that records
 * which element it was called on. (It also stops real scrolling during checks.)
 */
function withScrollSpy(t, fn) {
  const proto = t.container.ownerDocument.defaultView.Element.prototype;
  const own = Object.prototype.hasOwnProperty.call(proto, 'scrollIntoView');
  const original = proto.scrollIntoView;
  const calls = [];
  proto.scrollIntoView = function scrollIntoViewSpy(options) {
    calls.push({ el: this, options });
  };
  try {
    return fn(calls);
  } finally {
    if (own) proto.scrollIntoView = original;
    else delete proto.scrollIntoView;
  }
}

/** Finds a <button> containing `label` inside `scope`. */
function buttonIn(scope, label) {
  const btn = Array.from(scope.querySelectorAll('button')).find((b) => norm(b.textContent).toLowerCase().includes(label.toLowerCase()));
  if (!btn) throw new Error(`Could not find a "${label}" button inside ${describe(scope)}.`);
  return btn;
}

export default {
  id: 'ref-ruins',
  file: '08-ref-ruins.js',
  title: 'Ref Ruins',
  short: 'Refs',
  subtitle: 'Ancient escape hatches: remember values without re-rendering and reach the real DOM.',
  icon: '🏛️',
  colors: ['#3b2f2a', '#d6a35c'],
  scenery: ['🏛️', '🗿', '📜', '🕯️', '🦇', '⏳', '🏺', '🪨'],
  intro: [
    { text: 'Welcome to the Ref Ruins! Long ago, this city kept its secrets in stone pockets that never made a sound.', mood: 'happy' },
    { text: 'Those pockets are refs: values React holds on to between renders without re-rendering. Some of them even hold real DOM nodes!', mood: 'excited' },
    { text: 'Watch your step. A Phantom haunts these halls, and every timer you lose track of becomes one of his ghosts...', mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'ruins-echo-stone',
      type: 'code',
      title: 'The Echo Stone',
      blurb: 'Give a forgetful stone a memory that survives re-renders — silently.',
      xp: 110,
      story: [
        { text: 'Professor Pointer, our archaeologist owl, dug up an Echo Stone. Whisper to it and it counts your whispers... without making a sound.', mood: 'happy' },
        { text: 'But the Mutator scrubbed its memory down to a plain variable. Every re-render, it forgets everything. Let\'s carve it a proper ref!', mood: 'worried' },
      ],
      lesson: md`
        ## A pocket that survives renders

        Sometimes a component must **remember** something that has nothing to do with
        what's on screen: how many times a button was pressed, a timer id, the previous
        value of a prop... For that, React gives you **refs**.

        \`\`\`jsx
        import { useRef } from 'react';

        function EchoStone() {
          const whispers = useRef(0); // { current: 0 }

          function handleWhisper() {
            whispers.current = whispers.current + 1; // change it freely
            console.log('Whispers so far:', whispers.current);
          }

          return <button onClick={handleWhisper}>Whisper</button>;
        }
        \`\`\`

        \`useRef(initialValue)\` returns a plain object with one property, \`current\`.
        React hands you **the very same object on every render**, so whatever you store in
        \`current\` is still there next time. You can read and change it whenever you like.

        ## Refs vs local variables vs state

        | Kind | Survives re-renders? | Changing it re-renders? | Use it for |
        |---|---|---|---|
        | \`let x = 0\` (local variable) | ❌ reset every render | ❌ | scratch values inside one render |
        | \`useState\` | ✅ | ✅ | anything shown on screen |
        | \`useRef\` | ✅ | ❌ | values only your handlers and effects need |

        - A **local variable** is created fresh each time the component function runs. Any re-render wipes it.
        - **State** survives, and every \`setX\` triggers a re-render so the screen stays in sync.
        - A **ref** survives too, but React has no idea when you change \`ref.current\` — so **nothing re-renders**.

        Refs are **per component instance**, just like state: two Echo Stones on the page each get their own pocket.

        ## Showing a ref's value

        Because changing a ref is silent, the screen won't show the new value on its own. When
        you *do* want to show it, copy it into state — that triggers a render:

        \`\`\`jsx
        function handleListen() {
          setHeard(whispers.current); // state → re-render with the value
        }
        \`\`\`

        :::mistake
        Don't read or write \`ref.current\` **while rendering** (in the component body or the JSX).
        React can't track refs, so the UI may show stale values. Use refs inside **event handlers**
        and **effects**. (One exception: filling an empty ref once, \`if (ref.current === null) ref.current = ...\`.)
        :::

        ## Remembering a previous value

        Refs are also perfect for "what was it last time?" — for use in effects or handlers:

        \`\`\`jsx
        const prevDepth = useRef(depth);

        useEffect(() => {
          if (depth > prevDepth.current) console.log('Going deeper!');
          prevDepth.current = depth; // remember it for next time
        }, [depth]);
        \`\`\`

        :::tip
        Think of a ref as React's **secret pocket**: put anything in it — a number, an object,
        a timer id, a DOM node — and it stays put between renders without making a sound.
        :::
      `,
      task: md`
        ## 🎯 Give the Echo Stone a memory

        The stone counts whispers in a plain \`let\` variable, so every re-render wipes the count.

        1. Import \`useRef\` and keep the count in a ref inside \`App\`: \`const whispers = useRef(0);\`
        2. **🤫 Whisper** adds 1 to \`whispers.current\`. It must **not** re-render the stone — keep the \`console.log('render EchoStone')\` line, the checks use it to count renders.
        3. **👂 Listen** copies the count into the existing \`heard\` state, so \`<p className="echo">\` shows **Echoes heard: 3** after three whispers.
        4. The count must survive re-renders: 3 whispers → Listen → 2 more whispers → Listen shows **Echoes heard: 5**.
        5. Every stone has its own memory: two stones side by side never share a count.
      `,
      starter: code`
        import { useState } from 'react';

        export default function App() {
          const [heard, setHeard] = useState(null);
          let whispers = 0; // forgotten on every render!
          console.log('render EchoStone');

          function handleWhisper() {
            whispers = whispers + 1;
          }

          function handleListen() {
            setHeard(whispers);
          }

          return (
            <div className="stone">
              <div className="rune">🪨</div>
              <h2>The Echo Stone</h2>
              <div className="actions">
                <button onClick={handleWhisper}>🤫 Whisper</button>
                <button onClick={handleListen}>👂 Listen</button>
              </div>
              <p className="echo">{heard === null ? 'The stone is silent...' : \`Echoes heard: \${heard}\`}</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useRef, useState } from 'react';

        export default function App() {
          const [heard, setHeard] = useState(null);
          const whispers = useRef(0);
          console.log('render EchoStone');

          function handleWhisper() {
            whispers.current = whispers.current + 1;
          }

          function handleListen() {
            setHeard(whispers.current);
          }

          return (
            <div className="stone">
              <div className="rune">🪨</div>
              <h2>The Echo Stone</h2>
              <div className="actions">
                <button onClick={handleWhisper}>🤫 Whisper</button>
                <button onClick={handleListen}>👂 Listen</button>
              </div>
              <p className="echo">{heard === null ? 'The stone is silent...' : \`Echoes heard: \${heard}\`}</p>
            </div>
          );
        }
      `,
      hints: [
        md`Add \`useRef\` to the import: \`import { useRef, useState } from 'react';\` — then replace \`let whispers = 0;\` with \`const whispers = useRef(0);\`.`,
        md`A ref is an object: read and write its \`current\` property. In \`handleWhisper\`: \`whispers.current = whispers.current + 1;\``,
        md`In \`handleListen\`, copy the value into state so React re-renders: \`setHeard(whispers.current);\``,
      ],
      tests: [
        test('The stone renders with 🤫 Whisper and 👂 Listen buttons', (t) => {
          t.render();
          t.button('Whisper');
          t.button('Listen');
          t.expectElement('p.echo', 'Keep the <p className="echo"> paragraph — it shows what the stone heard.');
        }),
        test('Each stone keeps its own whispers in a ref', (t) => {
          t.sourceIncludes(/\buseRef\s*\(/, "Create the ref with useRef(0) — and import useRef from 'react'.");
          t.render(t.h('div', null, t.h(t.App), t.h(t.App)));
          const [first, second] = t.$$('.stone');
          t.expect(first && second, 'Could not find two <div className="stone"> elements. Keep the outer stone <div>.');
          t.click(buttonIn(first, 'Whisper'));
          t.click(buttonIn(first, 'Whisper'));
          t.click(buttonIn(second, 'Listen'));
          const other = norm(second.querySelector('.echo')?.textContent);
          t.expect(
            other === 'Echoes heard: 0',
            `Whispering twice into the first stone made the second one say "${other}" — expected "Echoes heard: 0". A variable outside the component is shared by every stone; keep the count in a ref inside App.`,
          );
          t.click(buttonIn(first, 'Listen'));
          const own = norm(first.querySelector('.echo')?.textContent);
          t.expect(own === 'Echoes heard: 2', `The first stone says "${own}" after two whispers — expected "Echoes heard: 2".`);
        }),
        test('Whispering does not re-render the stone', (t) => {
          t.render();
          const renders = () => t.logLines().filter((l) => l.includes('render EchoStone')).length;
          t.expect(renders() > 0, "Keep the line console.log('render EchoStone') inside App — the checks use it to count renders.");
          const before = renders();
          const whisper = t.button('Whisper');
          t.click(whisper);
          t.click(whisper);
          t.click(whisper);
          const extra = renders() - before;
          t.expect(
            extra === 0,
            `Three whispers re-rendered the stone ${extra} time(s). Changing a ref is silent: use whispers.current = whispers.current + 1 instead of a state setter.`,
          );
        }),
        test('👂 Listen shows "Echoes heard: 3" after three whispers', (t) => {
          t.render();
          const whisper = t.button('Whisper');
          for (let i = 0; i < 3; i++) t.click(whisper);
          t.click(t.button('Listen'));
          const text = norm(t.find('.echo').textContent);
          t.expect(
            text === 'Echoes heard: 3',
            `The stone says "${text}" — expected "Echoes heard: 3". In handleListen, copy the ref into state: setHeard(whispers.current).`,
          );
        }),
        test('The count survives re-renders: 3 whispers + 2 whispers → "Echoes heard: 5"', (t) => {
          t.render();
          const whisper = t.button('Whisper');
          const listen = t.button('Listen');
          for (let i = 0; i < 3; i++) t.click(whisper);
          t.click(listen);
          t.click(whisper);
          t.click(whisper);
          t.click(listen);
          const text = norm(t.find('.echo').textContent);
          const why =
            text === 'Echoes heard: 2'
              ? 'The count restarted from 0 after the re-render: a let variable is created fresh on every render, but a ref keeps its value.'
              : text === 'Echoes heard: 3'
                ? 'The screen did not update after the second Listen. Copy the ref into state so React re-renders: setHeard(whispers.current).'
                : 'Keep the count in a ref (whispers.current) and copy it into state when Listen is pressed.';
          t.expect(
            text === 'Echoes heard: 5',
            `After 3 whispers, Listen, 2 more whispers and Listen again, the stone says "${text}" — expected "Echoes heard: 5". ${why}`,
          );
        }),
      ],
      css: `
        .stone { text-align: center; padding: 24px; border-radius: 18px; background: radial-gradient(circle at 50% 25%, #57534e, #1c1917 75%); color: #fef3c7; }
        .stone h2 { margin: 6px 0; color: inherit; }
        .stone .rune { font-size: 56px; filter: drop-shadow(0 0 14px #fbbf24); }
        .stone .actions { display: flex; gap: 8px; justify-content: center; margin: 12px 0; }
        .stone .echo { font-style: italic; color: #fcd34d; min-height: 1.5em; }
      `,
      concepts: [
        {
          id: 'ruins-useref',
          icon: '🫙',
          title: 'useRef',
          summary: 'A box React keeps between renders. Changing ref.current does not re-render.',
          snippet: code`
            const clicks = useRef(0);

            function handleClick() {
              clicks.current += 1; // silent: no re-render
            }
          `,
          detail: 'Read and write refs in event handlers and effects, not during rendering. Copy a ref into state when the screen needs to show it.',
        },
        {
          id: 'ruins-ref-vs-state',
          icon: '⚖️',
          title: 'Refs vs state',
          summary: 'Shown on screen? State. Only handlers/effects need it? A ref.',
          detail: 'Both survive re-renders and are per component instance. Only state updates trigger a re-render; local let variables are reset by every render.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'ruins-swapped-sigils',
      type: 'bug',
      title: 'The Swapped Sigils',
      blurb: 'Bug hunt! State and refs swapped places — the charger is frozen and can\'t be stopped.',
      xp: 120,
      story: [
        { text: 'This crystal is a Rune Charger: press Charge and it gains one spark every second, until you press Halt.', mood: 'happy' },
        { text: 'The Mutator swapped two sigils. The sparks on screen live in a ref, so the display is frozen. The timer id lives in a plain variable, so Halt can\'t find it.', mood: 'worried' },
        { text: 'Swap them back! Careful: fixing the first bug wakes up the second one.', mood: 'thinking' },
      ],
      lesson: md`
        ## Which pocket does it go in?

        Ask one question about every value: **does the screen need to show it?**

        - **Yes** → it's **state**. Changing it must re-render.
        - **No — only event handlers or effects need it** → a **ref** is perfect.

        A timer is the classic example. The number of sparks is shown on screen (**state**).
        The **interval id** returned by \`setInterval\` is never shown; you only need it later
        to stop the timer (**ref**).

        \`\`\`jsx
        function Charger() {
          const [sparks, setSparks] = useState(0); // shown → state
          const intervalRef = useRef(null);         // hidden helper → ref

          function handleCharge() {
            clearInterval(intervalRef.current);     // never run two timers at once
            intervalRef.current = setInterval(() => {
              setSparks((s) => s + 1);              // updater: always the latest count
            }, 1000);
          }

          function handleHalt() {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // ...
        }
        \`\`\`

        ## Why a plain variable loses the timer

        \`\`\`jsx
        let intervalId; // ❌ a brand-new variable on every render

        function handleCharge() {
          intervalId = setInterval(tick, 1000);
        }
        function handleHalt() {
          clearInterval(intervalId);
        }
        \`\`\`

        The first tick calls \`setSparks\`, React re-renders, and the component function runs
        **again** — creating a fresh \`intervalId\` that is \`undefined\`. The new \`handleHalt\`
        clears... nothing. The timer runs forever. 👻

        ## Why a ref freezes the screen

        \`\`\`jsx
        const sparks = useRef(0);
        // ... in the interval:
        sparks.current = sparks.current + 1; // React never hears about it
        // ... in the JSX:
        <p>Sparks: {sparks.current}</p>        // ❌ stays at 0 forever
        \`\`\`

        Changing a ref never re-renders, so the screen keeps showing the old number.

        :::mistake
        **When not to use refs:** if a value appears in your JSX (or decides what appears), it
        belongs in **state**. Refs are an *escape hatch* for things React doesn't need to know
        about: timer ids, DOM nodes, previous values, counters nobody sees.
        :::

        ## Stale values inside intervals

        The interval callback is created **once**, during one render. If it uses
        \`setSparks(sparks + 1)\`, it keeps seeing *that* render's \`sparks\` forever — the
        count gets stuck at 1. Always use the **updater form** \`setSparks((s) => s + 1)\` in
        timers.

        :::tip
        \`clearInterval(null)\` and \`clearInterval(undefined)\` are harmless no-ops, so it's
        safe to clear "just in case" before starting a new interval.
        :::
      `,
      task: md`
        ## 🐛 Swap the sigils back

        The Rune Charger is broken. Fix it so that:

        1. **The screen updates.** The spark count is shown in \`<p className="sparks">\`, so it must be **state**: \`const [sparks, setSparks] = useState(0)\`. Each tick calls \`setSparks((s) => s + 1)\`.
        2. **✋ Halt stops the timer.** Keep the interval id in a **ref** (\`intervalRef.current = setInterval(...)\`) and clear it with \`clearInterval(intervalRef.current)\`.
        3. **⚡ Charge twice ≠ two timers.** Clear the old interval before starting a new one.
        4. **Charge works again after Halt.** (If Charge ignores clicks while a timer exists, set \`intervalRef.current = null\` in Halt.)

        The paragraph must read exactly **Sparks: N**, one spark per second.
      `,
      starter: code`
        import { useRef } from 'react';

        export default function App() {
          const sparks = useRef(0);
          let intervalId = null;

          function handleCharge() {
            intervalId = setInterval(() => {
              sparks.current = sparks.current + 1;
            }, 1000);
          }

          function handleHalt() {
            clearInterval(intervalId);
          }

          return (
            <div className="charger">
              <div className="crystal">🔮</div>
              <p className="sparks">Sparks: {sparks.current}</p>
              <button onClick={handleCharge}>⚡ Charge</button>
              <button onClick={handleHalt}>✋ Halt</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useRef, useState } from 'react';

        export default function App() {
          const [sparks, setSparks] = useState(0);
          const intervalRef = useRef(null);

          function handleCharge() {
            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
              setSparks((s) => s + 1);
            }, 1000);
          }

          function handleHalt() {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          return (
            <div className="charger">
              <div className="crystal">🔮</div>
              <p className="sparks">Sparks: {sparks}</p>
              <button onClick={handleCharge}>⚡ Charge</button>
              <button onClick={handleHalt}>✋ Halt</button>
            </div>
          );
        }
      `,
      hints: [
        md`Sigil 1: \`const [sparks, setSparks] = useState(0);\` (import \`useState\`), render \`{sparks}\`, and inside the interval call \`setSparks((s) => s + 1)\`.`,
        md`Sigil 2: \`const intervalRef = useRef(null);\` replaces \`let intervalId\`. Store the id with \`intervalRef.current = setInterval(...)\`.`,
        md`Start \`handleCharge\` with \`clearInterval(intervalRef.current);\`. In \`handleHalt\`: \`clearInterval(intervalRef.current); intervalRef.current = null;\``,
      ],
      tests: [
        test('⚡ Charge adds one spark per second', async (t) => {
          t.render();
          t.click(t.button('Charge'));
          await t.tick(1000);
          const one = norm(t.find('.sparks').textContent);
          t.expect(
            one === 'Sparks: 1',
            `After 1 second the charger shows "${one}" — expected "Sparks: 1". The screen only updates when state changes: keep the count in useState and call setSparks((s) => s + 1) in the interval.`,
          );
          await t.tick(2000);
          const three = norm(t.find('.sparks').textContent);
          t.expect(
            three === 'Sparks: 3',
            `After 3 seconds the charger shows "${three}" — expected "Sparks: 3". Inside setInterval use the updater form setSparks((s) => s + 1); setSparks(sparks + 1) keeps seeing the old count.`,
          );
        }),
        test('✋ Halt stops the charging (the interval id lives in a ref)', async (t) => {
          t.render();
          t.click(t.button('Charge'));
          await t.tick(2000);
          const charged = norm(t.find('.sparks').textContent);
          t.expect(charged === 'Sparks: 2', `After charging for 2 seconds the charger shows "${charged}" — expected "Sparks: 2". Fix sigil 1 first: the count must be state.`);
          t.click(t.button('Halt'));
          await t.tick(3000);
          const text = norm(t.find('.sparks').textContent);
          t.expect(
            text === 'Sparks: 2',
            `3 seconds after Halt the charger shows "${text}" — it should stay at "Sparks: 2". The let variable is reset by every re-render, so Halt clears nothing. Keep the id in a ref: intervalRef.current = setInterval(...).`,
          );
          t.expect(t.timers.pendingIntervals() === 0, 'An interval is still running after Halt. Call clearInterval(intervalRef.current) in handleHalt.');
          t.sourceIncludes(/clearInterval\s*\(\s*[\w$]+\.current\s*\)/, 'Clear the timer through the ref: clearInterval(intervalRef.current).');
        }),
        test('Charging twice still runs only one timer', async (t) => {
          t.render();
          const charge = t.button('Charge');
          t.click(charge);
          t.click(charge);
          await t.tick(1000);
          const running = t.timers.pendingIntervals();
          t.expect(running === 1, `Two clicks on Charge left ${running} interval(s) running — expected exactly 1. Before starting a new interval, clear the old one: clearInterval(intervalRef.current).`);
          const text = norm(t.find('.sparks').textContent);
          t.expect(text === 'Sparks: 1', `After two Charge clicks and 1 second the charger shows "${text}" — expected "Sparks: 1" (one timer, one spark per second).`);
        }),
        test('You can charge again after halting', async (t) => {
          t.render();
          t.click(t.button('Charge'));
          await t.tick(1000);
          t.click(t.button('Halt'));
          t.click(t.button('Charge'));
          await t.tick(2000);
          const text = norm(t.find('.sparks').textContent);
          t.expect(
            text === 'Sparks: 3',
            `Charge 1 s → Halt → Charge 2 s shows "${text}" — expected "Sparks: 3". If Charge ignores clicks while a timer exists, Halt must reset the ref: intervalRef.current = null.`,
          );
        }),
      ],
      css: `
        .charger { text-align: center; padding: 24px; border-radius: 18px; background: linear-gradient(160deg, #312e81, #1e1b4b); color: #e0e7ff; }
        .charger .crystal { font-size: 56px; filter: drop-shadow(0 0 16px #a78bfa); }
        .charger .sparks { font-size: 24px; font-weight: 800; color: #fde68a; }
        .charger button { margin: 4px; }
      `,
      concepts: [
        {
          id: 'ruins-timer-ref',
          icon: '⏲️',
          title: 'Timer ids in refs',
          summary: 'Keep setInterval/setTimeout ids in a ref so any handler can clear them later.',
          snippet: code`
            const intervalRef = useRef(null);

            function start() {
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(tick, 1000);
            }
            function stop() {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          `,
        },
        {
          id: 'ruins-when-not-refs',
          icon: '🚫',
          title: 'When not to use refs',
          summary: 'If the screen shows it, it is state. Refs never trigger a re-render.',
          detail: 'Refs are an escape hatch for values React does not need to know about: timer ids, DOM nodes, previous values, invisible counters.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'ruins-scribes-desk',
      type: 'code',
      title: "The Scribe's Desk",
      blurb: 'Grab real DOM nodes with refs to focus, select and scroll.',
      xp: 120,
      story: [
        { text: 'Quill the hedgehog is the scribe of the Ruins. Her desk has three enchanted tools, and the Mutator jammed every one of them.', mood: 'worried' },
        { text: 'Focusing a field, selecting text, scrolling to a line — JSX has no attribute for those. You need the real DOM node. Refs can grab those too!', mood: 'excited' },
      ],
      lesson: md`
        ## Refs to DOM nodes

        React updates the DOM for you, so most of the time you never touch it. But a few
        browser features have **no JSX attribute** — you must call a method on the real
        element:

        - \`input.focus()\` — put the cursor in a field
        - \`input.select()\` — highlight all of its text
        - \`element.scrollIntoView()\` — scroll it into sight
        - \`element.getBoundingClientRect()\` — measure its size and position

        To get the real element, create a ref and hand it to the special \`ref\` attribute:

        \`\`\`jsx
        import { useRef } from 'react';

        function SpellBox() {
          const inputRef = useRef(null);

          function handleClick() {
            inputRef.current.focus(); // the real <input> element
          }

          return (
            <>
              <input ref={inputRef} />
              <button onClick={handleClick}>Write</button>
            </>
          );
        }
        \`\`\`

        1. \`useRef(null)\` creates an empty ref.
        2. \`ref={inputRef}\` tells React: "when you create this \`<input>\`, put its DOM node in \`inputRef.current\`".
        3. In event handlers, \`inputRef.current\` **is** that DOM node — call any browser method on it.

        ## When is \`ref.current\` filled in?

        React sets \`ref.current\` during the **commit**, after rendering:

        - In the component body during the first render it is still \`null\` — don't use it there.
        - In **event handlers** and **effects** it is ready.
        - When the element is removed, React sets it back to \`null\`.

        \`\`\`jsx
        useEffect(() => {
          inputRef.current.focus(); // ✅ focus on mount: the node exists now
        }, []);
        \`\`\`

        ## Scrolling and measuring

        \`\`\`jsx
        const lastRef = useRef(null);
        // ...
        <li ref={lastRef}>The final line</li>
        // ... in a handler:
        lastRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        const boxRef = useRef(null);
        // ... in a handler or effect:
        const { width, height } = boxRef.current.getBoundingClientRect();
        \`\`\`

        \`behavior: 'smooth'\` animates the scroll; \`block: 'nearest'\` scrolls as little as possible.

        :::mistake
        Refs give you the real DOM, but **don't use them to change what React manages** — no
        \`ref.current.textContent = ...\`, no removing children by hand. React would overwrite your
        change or get confused. Use DOM refs for *non-destructive* actions like focusing, selecting,
        scrolling and measuring; change content with state.
        :::

        :::tip
        One ref holds one node. Need to reach three elements? Make three refs.
        :::
      `,
      task: md`
        ## 🎯 Unjam the scribe's tools

        Create one ref per element with \`useRef(null)\`, attach each with the \`ref\` attribute, and wire up the three buttons:

        1. **📜 Last line** scrolls the final inscription, \`<li className="final">\`, into view: call \`scrollIntoView({ behavior: 'smooth', block: 'nearest' })\` on it.
        2. **✨ Select spell** highlights all the text in \`<input className="spell">\` by calling \`.select()\` on it.
        3. **✍️ Take notes** puts the cursor in \`<textarea className="notes">\` by calling \`.focus()\` on it.

        Keep all the buttons, classNames and texts.
      `,
      starter: code`
        import { useRef } from 'react';

        const inscriptions = [
          'In the beginning was the render.',
          'Props flow down like rain.',
          'State lives where it is used.',
          'Keys tell twins apart.',
          'Effects reach beyond the walls.',
          'Refs remember in silence.',
          'Never mutate what you render.',
          'Same input, same output.',
        ];

        export default function App() {
          // TODO: create three refs with useRef(null)

          function handleLastLine() {
            // TODO: scroll the final inscription into view
          }

          function handleSelectSpell() {
            // TODO: select all the text in the spell input
          }

          function handleTakeNotes() {
            // TODO: focus the notes textarea
          }

          return (
            <div className="desk">
              <ul className="scroll">
                {inscriptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li className="final">The password is: SILENT POCKET</li>
              </ul>
              <input className="spell" value="Accio DOM node" readOnly />
              <textarea className="notes" placeholder="Your notes..." />
              <div className="tools">
                <button onClick={handleLastLine}>📜 Last line</button>
                <button onClick={handleSelectSpell}>✨ Select spell</button>
                <button onClick={handleTakeNotes}>✍️ Take notes</button>
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useRef } from 'react';

        const inscriptions = [
          'In the beginning was the render.',
          'Props flow down like rain.',
          'State lives where it is used.',
          'Keys tell twins apart.',
          'Effects reach beyond the walls.',
          'Refs remember in silence.',
          'Never mutate what you render.',
          'Same input, same output.',
        ];

        export default function App() {
          const finalRef = useRef(null);
          const spellRef = useRef(null);
          const notesRef = useRef(null);

          function handleLastLine() {
            finalRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          function handleSelectSpell() {
            spellRef.current.select();
          }

          function handleTakeNotes() {
            notesRef.current.focus();
          }

          return (
            <div className="desk">
              <ul className="scroll">
                {inscriptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li ref={finalRef} className="final">The password is: SILENT POCKET</li>
              </ul>
              <input ref={spellRef} className="spell" value="Accio DOM node" readOnly />
              <textarea ref={notesRef} className="notes" placeholder="Your notes..." />
              <div className="tools">
                <button onClick={handleLastLine}>📜 Last line</button>
                <button onClick={handleSelectSpell}>✨ Select spell</button>
                <button onClick={handleTakeNotes}>✍️ Take notes</button>
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Make three refs at the top of \`App\`: \`const finalRef = useRef(null);\`, \`spellRef\` and \`notesRef\` the same way.`,
        md`Attach them in the JSX: \`<li ref={finalRef} className="final">\`, \`<input ref={spellRef} ... />\`, \`<textarea ref={notesRef} ... />\`.`,
        md`The handlers call the DOM methods: \`finalRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })\`, \`spellRef.current.select()\` and \`notesRef.current.focus()\`.`,
      ],
      tests: [
        test('The desk has the scroll, the spell field, the notes box and three tools', (t) => {
          t.render();
          t.expectElement('ul.scroll li.final', 'Keep the final inscription: <li className="final"> inside <ul className="scroll">.');
          t.expectElement('input.spell', 'Keep the <input className="spell">.');
          t.expectElement('textarea.notes', 'Keep the <textarea className="notes">.');
          t.button('Last line');
          t.button('Select spell');
          t.button('Take notes');
        }),
        test('📜 Last line scrolls the final inscription into view', (t) => {
          const from = t.warnings.length;
          withScrollSpy(t, (calls) => {
            t.render();
            const final = t.find('li.final');
            t.click(t.button('Last line'));
            t.expect(
              calls.length > 0,
              `Nothing was scrolled.${crashNote(t, from)} Attach ref={finalRef} to <li className="final"> and call finalRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) in handleLastLine.`,
            );
            const target = calls[calls.length - 1].el;
            t.expect(target === final, `scrollIntoView was called on ${describe(target)} — attach the ref to <li className="final"> instead.`);
          });
        }),
        test('✨ Select spell highlights all of the spell text', (t) => {
          const from = t.warnings.length;
          t.render();
          const input = t.find('input.spell');
          t.click(t.button('Select spell'));
          const len = input.value.length;
          t.expect(
            input.selectionStart === 0 && input.selectionEnd === len && len > 0,
            `The selection covers characters ${input.selectionStart}–${input.selectionEnd} — expected 0–${len} (all of it).${crashNote(t, from)} Attach ref={spellRef} to the spell input and call spellRef.current.select().`,
          );
        }),
        test('✍️ Take notes puts the cursor in the notes box', (t) => {
          const from = t.warnings.length;
          t.render();
          const notes = t.find('textarea.notes');
          t.click(t.button('Take notes'));
          const active = focused(t);
          t.expect(
            active === notes,
            `After clicking Take notes, the focus is on ${describe(active)} — expected the notes <textarea>.${crashNote(t, from)} Attach ref={notesRef} and call notesRef.current.focus().`,
          );
        }),
      ],
      css: `
        .desk { display: grid; gap: 10px; padding: 16px; border-radius: 14px; background: #fdf6e3; color: #3f2d1d; border: 2px solid #c8a26b; }
        .desk .scroll { max-height: 110px; overflow-y: auto; margin: 0; padding: 8px 8px 8px 28px; background: #f3e2c0; border-radius: 10px; font-family: Georgia, serif; }
        .desk .scroll li { padding: 3px 0; }
        .desk .final { font-weight: 700; color: #9a3412; }
        .desk .spell { font-family: Georgia, serif; }
        .desk .notes { min-height: 56px; }
        .desk .tools { display: flex; flex-wrap: wrap; gap: 8px; }
      `,
      concepts: [
        {
          id: 'ruins-dom-ref',
          icon: '🎯',
          title: 'DOM refs',
          summary: 'ref={myRef} puts the real DOM node into myRef.current after React commits.',
          snippet: code`
            const inputRef = useRef(null);
            // ...
            <input ref={inputRef} />
            // in a handler or effect:
            inputRef.current.focus();
          `,
          detail: 'It is null during the first render and goes back to null when the element is removed.',
        },
        {
          id: 'ruins-dom-actions',
          icon: '🧰',
          title: 'Focus, select, scroll, measure',
          summary: 'Use DOM refs for what JSX cannot express — never to change content React manages.',
          snippet: code`
            inputRef.current.focus();
            inputRef.current.select();
            lineRef.current.scrollIntoView({ behavior: 'smooth' });
            boxRef.current.getBoundingClientRect();
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'ruins-hollow-statue',
      type: 'code',
      title: 'The Hollow Statue',
      blurb: 'Pass a ref into your own component — the React 19 way, no forwardRef.',
      xp: 130,
      story: [
        { text: 'The Combination Statue guards the inner hall. Three rune slots: Sun, Moon, Star. Type a rune and the cursor should hop to the next slot.', mood: 'happy' },
        { text: 'But the slots were carved in the old style, with forwardRef, and the carver forgot to pass the ref inside. The statue is hollow!', mood: 'worried' },
        { text: 'Good news: in React 19, ref is just a prop. Let\'s re-carve the slots the modern way.', mood: 'excited' },
      ],
      lesson: md`
        ## Refs to your own components

        \`ref={inputRef}\` on an \`<input>\` gives you its DOM node. But what if the input lives
        **inside your own component**?

        \`\`\`jsx
        <RuneSlot ref={sunRef} label="Sun" />
        \`\`\`

        In **React 19**, \`ref\` is simply **a prop** for function components. Read it like any
        other prop and pass it on to the element that should receive it:

        \`\`\`jsx
        function RuneSlot({ label, onChange, ref }) {
          return (
            <label className="rune-slot">
              {label}
              <input ref={ref} className="rune-input" onChange={onChange} />
            </label>
          );
        }
        \`\`\`

        Now \`sunRef.current\` in the parent is the real \`<input>\` inside \`RuneSlot\`. The child
        decides **which** node to expose; the parent can't reach anything else inside it.

        ## Recognising forwardRef (legacy)

        Before React 19, function components could **not** receive \`ref\` as a prop. You had to
        wrap them in \`forwardRef\`, which hands \`ref\` over as a **second argument**:

        \`\`\`jsx
        import { forwardRef } from 'react';

        // 🏚️ the old way: you'll still meet it in plenty of codebases
        const RuneSlot = forwardRef(function RuneSlot({ label }, ref) {
          return <input ref={ref} aria-label={label} />;
        });
        \`\`\`

        \`forwardRef\` still works in React 19, but it isn't needed anymore and is on its way
        out. Migrating is two steps:

        1. Remove the \`forwardRef(...)\` wrapper (and its import).
        2. Move \`ref\` from the second argument into the props: \`function RuneSlot({ label, ref })\`.

        ## Moving focus between fields

        With refs to several inputs you can build "auto-advance" fields, like one-time-code boxes:

        \`\`\`jsx
        function handleSunChange(e) {
          if (e.target.value.length === 1) {
            moonRef.current.focus();
          }
        }
        \`\`\`

        :::mistake
        Taking the \`ref\` prop but never **attaching** it. If \`RuneSlot\` ignores \`ref\`, then
        \`sunRef.current\` stays \`null\` and \`sunRef.current.focus()\` crashes with
        *"Cannot read properties of null (reading 'focus')"*.
        :::

        :::tip
        Only expose refs when a parent truly needs the DOM node (focus, scroll, measure). Most of
        the time, components should talk through props and callbacks.
        :::
      `,
      task: md`
        ## 🎯 Re-carve the rune slots

        \`RuneSlot\` uses the legacy \`forwardRef\` and never attaches the ref, so the statue's refs stay \`null\`.

        1. Rewrite \`RuneSlot\` as a plain function component that takes \`ref\` **as a prop** — no \`forwardRef\` — and attaches it to its \`<input className="rune-input">\`. Remove \`forwardRef\` from the import.
        2. **🗝️ Wake the statue** focuses the **Sun** slot (\`sunRef\`).
        3. Typing a rune into **Sun** moves the focus to **Moon**, and typing into **Moon** moves it to **Star**: in \`handleSunChange\` / \`handleMoonChange\`, when \`e.target.value.length === 1\`, focus the next ref.

        Keep the three slots in order: Sun, Moon, Star.
      `,
      starter: code`
        import { forwardRef, useRef } from 'react';

        // Carved in the legacy style... and the ref never reaches the <input>!
        const RuneSlot = forwardRef(function RuneSlot({ label, onChange }, ref) {
          return (
            <label className="rune-slot">
              <span>{label}</span>
              <input className="rune-input" maxLength={1} onChange={onChange} />
            </label>
          );
        });

        export default function App() {
          const sunRef = useRef(null);
          const moonRef = useRef(null);
          const starRef = useRef(null);

          function handleWake() {
            // TODO: focus the Sun slot
          }

          function handleSunChange(e) {
            // TODO: one rune typed? focus the Moon slot
          }

          function handleMoonChange(e) {
            // TODO: one rune typed? focus the Star slot
          }

          return (
            <div className="statue">
              <div className="face">🗿</div>
              <div className="slots">
                <RuneSlot ref={sunRef} label="☀️ Sun" onChange={handleSunChange} />
                <RuneSlot ref={moonRef} label="🌙 Moon" onChange={handleMoonChange} />
                <RuneSlot ref={starRef} label="⭐ Star" />
              </div>
              <button onClick={handleWake}>🗝️ Wake the statue</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useRef } from 'react';

        function RuneSlot({ label, onChange, ref }) {
          return (
            <label className="rune-slot">
              <span>{label}</span>
              <input ref={ref} className="rune-input" maxLength={1} onChange={onChange} />
            </label>
          );
        }

        export default function App() {
          const sunRef = useRef(null);
          const moonRef = useRef(null);
          const starRef = useRef(null);

          function handleWake() {
            sunRef.current.focus();
          }

          function handleSunChange(e) {
            if (e.target.value.length === 1) {
              moonRef.current.focus();
            }
          }

          function handleMoonChange(e) {
            if (e.target.value.length === 1) {
              starRef.current.focus();
            }
          }

          return (
            <div className="statue">
              <div className="face">🗿</div>
              <div className="slots">
                <RuneSlot ref={sunRef} label="☀️ Sun" onChange={handleSunChange} />
                <RuneSlot ref={moonRef} label="🌙 Moon" onChange={handleMoonChange} />
                <RuneSlot ref={starRef} label="⭐ Star" />
              </div>
              <button onClick={handleWake}>🗝️ Wake the statue</button>
            </div>
          );
        }
      `,
      hints: [
        md`Drop the wrapper: \`function RuneSlot({ label, onChange, ref }) { ... }\` — \`ref\` now sits in the props next to \`label\`. Remove \`forwardRef\` from the import line.`,
        md`Inside \`RuneSlot\`, attach it: \`<input ref={ref} className="rune-input" ... />\`. Then \`handleWake\` can call \`sunRef.current.focus()\`.`,
        md`\`handleSunChange\`: \`if (e.target.value.length === 1) moonRef.current.focus();\` — and \`handleMoonChange\` does the same with \`starRef\`.`,
      ],
      tests: [
        test('Three rune slots render: Sun, Moon and Star', (t) => {
          t.render();
          const slots = t.$$('.rune-slot');
          t.expect(slots.length === 3, `Found ${slots.length} .rune-slot label(s) — expected 3 (Sun, Moon, Star).`);
          t.expect(t.count('.rune-slot input.rune-input') === 3, 'Each RuneSlot needs an <input className="rune-input"> inside its label.');
          const names = slots.map((s) => norm(s.textContent));
          t.expect(
            /Sun/.test(names[0]) && /Moon/.test(names[1]) && /Star/.test(names[2]),
            `The slots read ${names.map((n) => `"${n}"`).join(', ')} — keep them in order: Sun, Moon, Star.`,
          );
        }),
        test('RuneSlot takes ref as a plain prop — no forwardRef', (t) => {
          const src = stripComments(t.source);
          t.expect(
            !/\bforwardRef\s*\(/.test(src),
            'RuneSlot still uses forwardRef(...). In React 19, write function RuneSlot({ label, onChange, ref }) and put ref={ref} on the <input>.',
          );
          t.expect(/\bRuneSlot\b/.test(src), 'Keep the RuneSlot component — App renders three of them.');
        }),
        test('🗝️ Wake the statue focuses the Sun slot', (t) => {
          const from = t.warnings.length;
          t.render();
          const [sun] = t.$$('input.rune-input');
          t.click(t.button('Wake'));
          const active = focused(t);
          t.expect(
            active === sun,
            `After clicking Wake, the focus is on ${describe(active)} — expected the Sun input.${crashNote(t, from)} RuneSlot must attach its ref prop (<input ref={ref} ... />), and handleWake calls sunRef.current.focus().`,
          );
        }),
        test('Typing a rune hops to the next slot (Sun → Moon → Star)', (t) => {
          const from = t.warnings.length;
          t.render();
          const [sun, moon, star] = t.$$('input.rune-input');
          t.focus(sun);
          t.type(sun, 'R');
          const afterSun = focused(t);
          t.expect(
            afterSun === moon,
            `After typing into Sun, the focus is on ${afterSun === sun ? 'the Sun slot still' : describe(afterSun)} — expected the Moon slot.${crashNote(t, from)} In handleSunChange: if (e.target.value.length === 1) moonRef.current.focus();`,
          );
          t.type(moon, 'E');
          const afterMoon = focused(t);
          t.expect(
            afterMoon === star,
            `After typing into Moon, the focus is on ${afterMoon === moon ? 'the Moon slot still' : describe(afterMoon)} — expected the Star slot.${crashNote(t, from)} In handleMoonChange: if (e.target.value.length === 1) starRef.current.focus();`,
          );
        }),
      ],
      css: `
        .statue { text-align: center; padding: 20px; border-radius: 18px; background: linear-gradient(180deg, #78716c, #44403c); color: #fafaf9; }
        .statue .face { font-size: 60px; }
        .statue .slots { display: flex; gap: 14px; justify-content: center; margin: 12px 0 16px; }
        .rune-slot { display: grid; gap: 6px; justify-items: center; font-weight: 600; }
        .rune-input { width: 52px; height: 52px; text-align: center; font-size: 26px; border-radius: 12px; text-transform: uppercase; color: #1c1917; }
        .rune-input:focus { outline: 3px solid #fbbf24; }
      `,
      concepts: [
        {
          id: 'ruins-ref-prop',
          icon: '🪝',
          title: 'ref as a prop',
          summary: 'React 19: function components receive ref like any other prop and pass it to a DOM element.',
          snippet: code`
            function Field({ label, ref }) {
              return <input ref={ref} aria-label={label} />;
            }

            <Field ref={fieldRef} label="Name" />
          `,
        },
        {
          id: 'ruins-forwardref',
          icon: '🏚️',
          title: 'forwardRef (legacy)',
          summary: 'Pre-React 19 wrapper that passed ref as a second argument. Recognise it, then migrate.',
          snippet: code`
            // before React 19
            const Field = forwardRef(function Field(props, ref) {
              return <input ref={ref} {...props} />;
            });
          `,
          detail: 'To migrate: remove the wrapper and read ref from the props instead.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'ruins-sealed-gate',
      type: 'code',
      title: 'The Sealed Gate',
      blurb: 'Hand the parent two chosen powers instead of the whole DOM node.',
      xp: 140,
      story: [
        { text: "The Sealed Gate! It wants the password from Quill's scroll. Remember the very last line?", mood: 'thinking' },
        { text: 'Its rune field is shy: it won\'t hand its whole DOM node to strangers. It offers exactly two tricks — focus and shake. That\'s a job for useImperativeHandle.', mood: 'happy' },
      ],
      lesson: md`
        ## Exposing a custom handle

        When a parent passes a \`ref\` to your component, you usually attach it straight to a
        DOM node. But sometimes you'd rather give the parent **only a few chosen powers** than
        the entire \`<input>\` (which would let it restyle it, remove it, anything).

        \`useImperativeHandle\` lets **you** decide what the parent's \`ref.current\` will be:

        \`\`\`jsx
        import { useImperativeHandle, useRef, useState } from 'react';

        function RuneField({ ref }) {
          const inputRef = useRef(null);            // our own, private ref
          const [shaking, setShaking] = useState(false);

          useImperativeHandle(ref, () => ({
            focus() {
              inputRef.current.focus();
            },
            shake() {
              setShaking(true);
              setTimeout(() => setShaking(false), 500);
            },
          }), []);

          return <input ref={inputRef} className={shaking ? 'shake' : ''} />;
        }
        \`\`\`

        In the parent, \`fieldRef.current\` is now **the object you returned** — not the DOM node:

        \`\`\`jsx
        const fieldRef = useRef(null);
        // ... later, in an event handler:
        fieldRef.current.shake();
        fieldRef.current.focus();
        fieldRef.current.style; // undefined: the DOM node stays private 🔒

        <RuneField ref={fieldRef} />
        \`\`\`

        The three arguments:

        1. \`ref\` — the ref prop your component received.
        2. A **function** that returns the handle: an object with the methods the parent may call.
        3. Optionally, a **dependency array** (like \`useEffect\`'s) telling React when to rebuild the handle.

        ## Use it sparingly

        The React team's advice: use refs only for **imperative behaviours you can't express as
        props** — focusing, scrolling, selecting text, triggering an animation. If something can
        be a prop (\`<Gate open={isOpen} />\`), don't turn it into a method
        (\`gateRef.current.open()\`).

        :::tip
        A shake is a good imperative action: it's a *one-off event*, not a lasting state the
        parent wants to control.
        :::

        :::mistake
        Calling \`fieldRef.current.shake()\` **during render**. Like every ref, the handle is only
        ready after React commits — use it in event handlers and effects.
        :::
      `,
      task: md`
        ## 🎯 Teach the gate two tricks

        \`RuneField\` (keep it exported) receives \`ref\` as a prop. Instead of attaching that ref to the \`<input>\`, keep a private \`inputRef\` and use \`useImperativeHandle\` to expose **two methods**:

        1. \`focus()\` focuses the \`<input className="rune-field">\`.
        2. \`shake()\` adds the class **shake** to that input and removes it again **500 ms** later. Keep a \`shaking\` state and use \`className={shaking ? 'rune-field shake' : 'rune-field'}\`. The parent's \`ref.current\` must be this handle object, **not** the DOM node.
        3. In \`App\`'s \`handleSubmit\`, a wrong password sets the verdict to **The gate stays shut.** and calls \`fieldRef.current.shake()\` and \`fieldRef.current.focus()\`.
        4. The right password sets the verdict to **The gate swings open!** Compare with \`guess.trim().toLowerCase() === 'silent pocket'\`.
      `,
      starter: code`
        import { useRef, useState } from 'react';

        // TODO: keep a private inputRef, and expose only { focus, shake } with useImperativeHandle
        export function RuneField({ ref, value, onChange }) {
          return (
            <input
              ref={ref}
              className="rune-field"
              placeholder="Speak the password..."
              value={value}
              onChange={onChange}
            />
          );
        }

        export default function App() {
          const fieldRef = useRef(null);
          const [guess, setGuess] = useState('');
          const [verdict, setVerdict] = useState('The gate is sealed.');

          function handleSubmit(e) {
            e.preventDefault();
            // TODO: right password → 'The gate swings open!'
            //       wrong password → 'The gate stays shut.', then shake() and focus() the field
          }

          return (
            <form className="gate" onSubmit={handleSubmit}>
              <div className="door">🚪</div>
              <RuneField ref={fieldRef} value={guess} onChange={(e) => setGuess(e.target.value)} />
              <button type="submit">🗣️ Speak</button>
              <p className="verdict">{verdict}</p>
            </form>
          );
        }
      `,
      solution: code`
        import { useImperativeHandle, useRef, useState } from 'react';

        export function RuneField({ ref, value, onChange }) {
          const inputRef = useRef(null);
          const [shaking, setShaking] = useState(false);

          useImperativeHandle(ref, () => ({
            focus() {
              inputRef.current.focus();
            },
            shake() {
              setShaking(true);
              setTimeout(() => setShaking(false), 500);
            },
          }), []);

          return (
            <input
              ref={inputRef}
              className={shaking ? 'rune-field shake' : 'rune-field'}
              placeholder="Speak the password..."
              value={value}
              onChange={onChange}
            />
          );
        }

        export default function App() {
          const fieldRef = useRef(null);
          const [guess, setGuess] = useState('');
          const [verdict, setVerdict] = useState('The gate is sealed.');

          function handleSubmit(e) {
            e.preventDefault();
            if (guess.trim().toLowerCase() === 'silent pocket') {
              setVerdict('The gate swings open!');
            } else {
              setVerdict('The gate stays shut.');
              fieldRef.current.shake();
              fieldRef.current.focus();
            }
          }

          return (
            <form className="gate" onSubmit={handleSubmit}>
              <div className="door">🚪</div>
              <RuneField ref={fieldRef} value={guess} onChange={(e) => setGuess(e.target.value)} />
              <button type="submit">🗣️ Speak</button>
              <p className="verdict">{verdict}</p>
            </form>
          );
        }
      `,
      hints: [
        md`In \`RuneField\`: \`const inputRef = useRef(null);\` and \`const [shaking, setShaking] = useState(false);\` — attach \`ref={inputRef}\` to the \`<input>\` instead of the \`ref\` prop. Import \`useImperativeHandle\` from \`'react'\`.`,
        md`\`useImperativeHandle(ref, () => ({ focus() { inputRef.current.focus(); }, shake() { setShaking(true); setTimeout(() => setShaking(false), 500); } }), []);\``,
        md`In \`handleSubmit\`: \`if (guess.trim().toLowerCase() === 'silent pocket') { setVerdict('The gate swings open!'); } else { setVerdict('The gate stays shut.'); fieldRef.current.shake(); fieldRef.current.focus(); }\``,
      ],
      tests: [
        test('The gate has a form with a .rune-field input and a 🗣️ Speak button', (t) => {
          t.render();
          t.expectElement('form input.rune-field', 'Render <RuneField /> inside the form — its <input> needs className "rune-field".');
          t.button('Speak');
          t.expectElement('p.verdict', 'Keep the <p className="verdict"> paragraph.');
        }),
        test('RuneField exposes focus() and shake() — not the DOM node', (t) => {
          // renderField fails with a specific message if the handle is missing,
          // is the raw <input>, or lacks one of the two methods.
          renderField(t);
        }),
        test('shake() adds the "shake" class for 500 ms', async (t) => {
          const handle = renderField(t);
          t.act(() => {
            handle.shake();
          });
          const input = t.find('input');
          t.expect(input.classList.contains('shake'), `After shake() the input's class is "${input.className}" — expected it to include "shake". Set a shaking state and use className={shaking ? 'rune-field shake' : 'rune-field'}.`);
          t.expect(input.classList.contains('rune-field'), 'Keep the rune-field class while shaking: className={shaking ? \'rune-field shake\' : \'rune-field\'}.');
          await t.tick(500);
          t.expect(!input.classList.contains('shake'), 'The shake class is still there 500 ms later. In shake(), also call setTimeout(() => setShaking(false), 500).');
        }),
        test('focus() focuses the rune field', (t) => {
          const handle = renderField(t);
          t.act(() => {
            handle.focus();
          });
          const active = focused(t);
          t.expect(active === t.find('input'), `After focus(), the focus is on ${describe(active)} — expected the rune-field input. Call inputRef.current.focus() inside the handle's focus().`);
        }),
        test('A wrong password shakes and refocuses the field; SILENT POCKET opens the gate', (t) => {
          const from = t.warnings.length;
          t.render();
          const input = t.find('input.rune-field');
          t.type(input, 'open sesame');
          t.submit(input);
          const shut = norm(t.find('.verdict').textContent);
          t.expect(shut === 'The gate stays shut.', `After a wrong password the verdict reads "${shut}" — expected "The gate stays shut.".${crashNote(t, from)}`);
          t.expect(input.classList.contains('shake'), `A wrong password should shake the field — call fieldRef.current.shake() in handleSubmit.${crashNote(t, from)}`);
          t.expect(focused(t) === input, 'A wrong password should put the cursor back in the field — call fieldRef.current.focus() in handleSubmit.');
          t.type(input, 'Silent Pocket');
          t.submit(input);
          const open = norm(t.find('.verdict').textContent);
          t.expect(open === 'The gate swings open!', `After typing "Silent Pocket" the verdict reads "${open}" — expected "The gate swings open!". Compare guess.trim().toLowerCase() === 'silent pocket'.`);
        }),
      ],
      css: `
        .gate { display: grid; gap: 10px; justify-items: center; padding: 22px; border-radius: 18px; background: linear-gradient(180deg, #57534e, #292524); color: #fef3c7; }
        .gate .door { font-size: 56px; }
        .rune-field { text-align: center; font-size: 18px; letter-spacing: 2px; text-transform: uppercase; color: #1c1917; }
        .rune-field.shake { animation: rune-shake 0.4s; border-color: #ef4444; }
        @keyframes rune-shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
        .gate .verdict { font-style: italic; }
      `,
      concepts: [
        {
          id: 'ruins-imperative-handle',
          icon: '🎛️',
          title: 'useImperativeHandle',
          summary: "Choose what a parent's ref sees: a few methods instead of the whole DOM node.",
          snippet: code`
            function Field({ ref }) {
              const inputRef = useRef(null);
              useImperativeHandle(ref, () => ({
                focus() { inputRef.current.focus(); },
              }), []);
              return <input ref={inputRef} />;
            }
          `,
          detail: 'Use it sparingly, for imperative actions (focus, scroll, animations). Anything that can be a prop should be a prop.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'ruins-trial',
      type: 'quiz',
      title: 'Riddles of the Sphinx',
      blurb: 'Eight riddles guard the inner hall. Do you know when to reach for a ref?',
      xp: 100,
      story: [{ text: "The Ruins' sphinx loves riddles about refs. Every answer comes with an explanation, so even a wrong guess teaches you something!", mood: 'happy' }],
      task: md`Answer each riddle. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What does this button show after it is clicked 3 times?\n\n```jsx\nfunction Clicker() {\n  const clicks = useRef(0);\n  return (\n    <button onClick={() => { clicks.current++; }}>\n      Clicked {clicks.current} times\n    </button>\n  );\n}\n```',
          ['Clicked 0 times', 'Clicked 3 times', 'Clicked 1 times', 'Nothing — it crashes'],
          0,
          'The ref does count to 3, but changing `clicks.current` never re-renders, so the button keeps showing what it rendered the first time. Anything shown on screen belongs in **state** — and reading a ref during render is a mistake anyway.',
        ),
        q(
          'Which value is the best fit for a ref rather than state?',
          [
            'The text typed into a search box that filters a visible list',
            'Whether a dropdown menu is open',
            'The id returned by `setInterval`, kept so a Stop button can clear it',
            'The items in a shopping cart',
          ],
          2,
          'The interval id is never displayed — only the Stop handler needs it — so it belongs in a ref. The other three all change what the user sees, so they must be state.',
        ),
        q(
          'This effect logs whether `depth` went up or down. Why is a ref a good fit for `prevDepth`?\n\n```jsx\nconst prevDepth = useRef(depth);\nuseEffect(() => {\n  console.log(depth > prevDepth.current ? \'deeper\' : \'shallower\');\n  prevDepth.current = depth;\n}, [depth]);\n```',
          [
            'Because refs are faster than state',
            'It must survive re-renders, but updating it should not cause another render',
            'Because effects are not allowed to read state',
            'It must be shown on screen',
          ],
          1,
          'Remembering a previous value is a classic ref job: it has to persist between renders, but nothing on screen depends on it — so a silent ref is perfect. Storing it in state would trigger an extra render every time.',
        ),
        q(
          'For `<input ref={inputRef} />`, when does `inputRef.current` hold the input element?',
          [
            'As soon as `useRef(null)` is called',
            'During the first render, before the JSX is returned',
            'Only after the user clicks the input',
            'After React commits the `<input>` to the DOM — during the first render it is still `null`',
          ],
          3,
          'React fills in DOM refs during the commit, after rendering. Use them in event handlers and effects, where the node exists. When the element is removed, React sets the ref back to `null`.',
        ),
        q(
          'What is wrong with this timer?\n\n```jsx\nfunction Timer() {\n  const [secs, setSecs] = useState(0);\n  let id;\n  function start() {\n    id = setInterval(() => setSecs((s) => s + 1), 1000);\n  }\n  function stop() {\n    clearInterval(id);\n  }\n  // ...\n}\n```',
          [
            'Nothing — it works fine',
            'setInterval cannot be called from an event handler',
            'The updater `s => s + 1` should be `secs + 1`',
            'Every re-render creates a new `id` variable, so `stop` clears `undefined` and the timer runs forever',
          ],
          3,
          'Each tick updates state, React re-renders, and the function body runs again with a fresh `let id`. The new `stop` closure sees `undefined`. Keep the id in a ref (`intervalRef.current`) so it survives re-renders.',
        ),
        q(
          'In React 19, how does a function component receive a `ref` from its parent?',
          [
            'As a regular prop: `function Field({ ref }) { ... }`',
            'Only by wrapping the component in `forwardRef`',
            'Through `this.ref`',
            'It can\'t — refs only work on built-in elements like `<input>`',
          ],
          0,
          'Since React 19, `ref` is just a prop for function components: destructure it and attach it where you like. `forwardRef` was the pre-19 workaround and is no longer needed.',
        ),
        q(
          'You meet this in an older codebase. What does it do?\n\n```jsx\nconst Field = forwardRef(function Field(props, ref) {\n  return <input ref={ref} {...props} />;\n});\n```',
          [
            'It creates a brand-new ref inside `Field`',
            'It passes the parent\'s ref through to the inner `<input>` — the legacy way of doing what React 19 does with `function Field({ ref, ...props })`',
            'It stops the parent from ever reaching the input',
            'It turns the input into a controlled input',
          ],
          1,
          '`forwardRef` hands the parent\'s `ref` to the component as a second argument, so it can attach it to a DOM node. In React 19 you simply read `ref` from the props.',
        ),
        q(
          'A child calls `useImperativeHandle(ref, () => ({ focus() { inputRef.current.focus(); } }))`. What does the parent\'s `ref.current` hold?',
          [
            'The `<input>` DOM node',
            '`inputRef`',
            '`null` — imperative handles are private',
            'The object `{ focus }` returned by the function',
          ],
          3,
          'With `useImperativeHandle`, the parent\'s ref receives whatever object you return — here, just `{ focus }`. The real DOM node stays hidden behind the child\'s private `inputRef`.',
        ),
      ],
      concepts: [
        {
          id: 'ruins-escape-hatch',
          icon: '🚪',
          title: 'Refs are an escape hatch',
          summary: "Step outside React's render flow only when you must: timers, DOM APIs, previous values.",
          detail: 'If you can express it with state and props, do. Reach for refs when you need to remember something silently or talk to the browser directly.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'ruins-boss',
      type: 'build',
      boss: true,
      bossName: 'The Phantom of the DOM',
      bossIcon: '👻',
      title: 'Boss: The Phantom of the DOM',
      blurb: 'Build a ghost-proof stopwatch — start, stop, lap and reset — and banish the Phantom.',
      xp: 280,
      badge: { id: 'badge-ruins', name: 'Ghost Trapper', icon: '👻', description: 'Banished the Phantom of the DOM from the Ref Ruins.' },
      story: [
        { text: 'There he is — the Phantom of the DOM! He lives between renders, where state can\'t see him, and he has cursed the Chronolith, the great stopwatch of the Ruins.', mood: 'worried' },
        { text: 'Every interval id you lose becomes one of his ghosts, ticking forever in the dark. Press Start twice and two ghosts tick at once!', mood: 'worried' },
        { text: "Build a stopwatch that never loses track of its timer. Refs are your ghost traps. Let's banish him!", mood: 'excited' },
      ],
      lesson: md`
        ## Everything from the Ruins

        | Need | Tool |
        |---|---|
        | The time on screen | state: \`const [tenths, setTenths] = useState(0)\` |
        | The laps on screen | state: an array, updated with spread |
        | The interval id | a ref: \`intervalRef.current = setInterval(...)\` |
        | "Is it running?" (inside handlers) | \`intervalRef.current !== null\` |
        | Focus the Start button | a DOM ref: \`startRef.current.focus()\` |
        | No ghosts after unmount | an effect cleanup that clears the interval |

        ## A ghost-proof start

        \`\`\`jsx
        function handleStart() {
          if (intervalRef.current !== null) return; // already running: no second ghost
          intervalRef.current = setInterval(() => {
            setTenths((t) => t + 1);                // updater: never stale
          }, 100);
        }

        function handleStop() {
          clearInterval(intervalRef.current);
          intervalRef.current = null;               // so Start works again
        }
        \`\`\`

        ## Cleaning up when the component disappears

        Remember the Effect Volcano: an effect's cleanup runs when the component unmounts.
        With an empty dependency array, the effect sets up once and cleans up once:

        \`\`\`jsx
        useEffect(() => {
          return () => clearInterval(intervalRef.current);
        }, []);
        \`\`\`

        Reading \`intervalRef.current\` inside the cleanup gives you whichever interval is running
        **at that moment** — exactly the ghost you want to banish.

        ## Store raw numbers, derive the text

        Keep plain numbers in state and format them while rendering:
        \`(tenths / 10).toFixed(1)\` turns \`15\` into \`"1.5"\` and \`30\` into \`"3.0"\`.

        :::mistake
        \`setTenths(tenths + 1)\` inside the interval. The callback was created during one render
        and keeps seeing *that* render's \`tenths\` forever, so the clock sticks at 0.1. Use the
        updater form \`setTenths((t) => t + 1)\`.
        :::

        :::tip
        Laps only ever get appended (and are cleared all at once), so the index is a fine \`key\`
        for them here.
        :::
      `,
      task: md`
        ## 👑 Build the Chronolith

        Make \`App\` a stopwatch that counts in **tenths of a second**. Keep the existing JSX: \`<p className="time">\` shows \`(tenths / 10).toFixed(1)\` and \`<ol className="laps">\` lists the laps.

        1. **▶ Start** starts a \`setInterval\` that adds one tenth every **100 ms** (so the time reads **1.5** after 1.5 s). Keep the interval id in a **ref**. Pressing Start while it's running must **not** start a second interval. (Don't disable the button — guard with the ref.)
        2. **⏸ Stop** clears the interval. Pressing Start again continues from the same time.
        3. **🏁 Lap** appends the current \`tenths\` to the \`laps\` state, so the list shows **Lap 1: 1.5**, **Lap 2: 3.0**, ...
        4. **↺ Reset** stops the timer, sets the time back to **0.0**, clears the laps and **focuses the ▶ Start button** (attach a DOM ref to it).
        5. If the stopwatch unmounts while running, its interval must be cleared — add a cleanup effect.
      `,
      starter: code`
        import { useEffect, useRef, useState } from 'react';

        export default function App() {
          const [tenths, setTenths] = useState(0);
          const [laps, setLaps] = useState([]);
          // TODO: a ref for the interval id, and a ref for the Start button

          function handleStart() {
            // TODO: add one tenth every 100 ms — but never start a second interval!
          }

          function handleStop() {
            // TODO: clear the interval
          }

          function handleLap() {
            // TODO: append the current tenths to laps
          }

          function handleReset() {
            // TODO: stop, back to 0, no laps, focus the Start button
          }

          // TODO: clear the interval if the stopwatch unmounts

          return (
            <div className="chronolith">
              <div className="phantom">👻</div>
              <p className="time">{(tenths / 10).toFixed(1)}</p>
              <div className="controls">
                <button onClick={handleStart}>▶ Start</button>
                <button onClick={handleStop}>⏸ Stop</button>
                <button onClick={handleLap}>🏁 Lap</button>
                <button onClick={handleReset}>↺ Reset</button>
              </div>
              <ol className="laps">
                {laps.map((lap, i) => (
                  <li key={i}>Lap {i + 1}: {(lap / 10).toFixed(1)}</li>
                ))}
              </ol>
            </div>
          );
        }
      `,
      solution: code`
        import { useEffect, useRef, useState } from 'react';

        export default function App() {
          const [tenths, setTenths] = useState(0);
          const [laps, setLaps] = useState([]);
          const intervalRef = useRef(null);
          const startRef = useRef(null);

          function handleStart() {
            if (intervalRef.current !== null) return;
            intervalRef.current = setInterval(() => {
              setTenths((t) => t + 1);
            }, 100);
          }

          function handleStop() {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          function handleLap() {
            setLaps([...laps, tenths]);
          }

          function handleReset() {
            handleStop();
            setTenths(0);
            setLaps([]);
            startRef.current.focus();
          }

          useEffect(() => {
            return () => clearInterval(intervalRef.current);
          }, []);

          return (
            <div className="chronolith">
              <div className="phantom">👻</div>
              <p className="time">{(tenths / 10).toFixed(1)}</p>
              <div className="controls">
                <button ref={startRef} onClick={handleStart}>▶ Start</button>
                <button onClick={handleStop}>⏸ Stop</button>
                <button onClick={handleLap}>🏁 Lap</button>
                <button onClick={handleReset}>↺ Reset</button>
              </div>
              <ol className="laps">
                {laps.map((lap, i) => (
                  <li key={i}>Lap {i + 1}: {(lap / 10).toFixed(1)}</li>
                ))}
              </ol>
            </div>
          );
        }
      `,
      hints: [
        md`Two refs: \`const intervalRef = useRef(null);\` for the timer and \`const startRef = useRef(null);\` attached with \`<button ref={startRef} ...>\`.`,
        md`Start: \`if (intervalRef.current !== null) return;\` then \`intervalRef.current = setInterval(() => setTenths((t) => t + 1), 100);\`. Stop: clear it **and** set \`intervalRef.current = null\`.`,
        md`Lap: \`setLaps([...laps, tenths])\`. Reset: \`handleStop(); setTenths(0); setLaps([]); startRef.current.focus();\`. Cleanup: \`useEffect(() => () => clearInterval(intervalRef.current), []);\``,
      ],
      tests: [
        test('The Chronolith shows 0.0, four buttons and the lap list', (t) => {
          t.render();
          const time = norm(t.find('.time').textContent);
          t.expect(time === '0.0', `The time reads "${time}" — expected "0.0" at the start.`);
          ['Start', 'Stop', 'Lap', 'Reset'].forEach((label) => t.button(label));
          t.expectElement('ol.laps', 'Keep the <ol className="laps"> for the lap times.');
        }),
        test('▶ Start counts tenths, ⏸ Stop pauses, Start resumes', async (t) => {
          t.render();
          t.click(t.button('Start'));
          await t.tick(1500);
          const running = norm(t.find('.time').textContent);
          t.expect(
            running === '1.5',
            `1.5 s after Start the time reads "${running}" — expected "1.5". Start should run setInterval(() => setTenths((t) => t + 1), 100) and keep the id in a ref.`,
          );
          t.click(t.button('Stop'));
          await t.tick(1000);
          const paused = norm(t.find('.time').textContent);
          t.expect(paused === '1.5', `1 s after Stop the time reads "${paused}" — it should stay at "1.5". Stop must call clearInterval(intervalRef.current).`);
          t.expect(t.timers.pendingIntervals() === 0, 'A ghost interval is still running after Stop. Clear it with clearInterval(intervalRef.current).');
          t.click(t.button('Start'));
          await t.tick(500);
          const resumed = norm(t.find('.time').textContent);
          t.expect(
            resumed === '2.0',
            `Start → 1.5 s → Stop → Start → 0.5 s reads "${resumed}" — expected "2.0". If Start ignores clicks while a timer exists, Stop must reset the ref: intervalRef.current = null.`,
          );
        }),
        test('🏁 Lap records "Lap 1: 1.5", then "Lap 2: 3.0"', async (t) => {
          t.render();
          t.click(t.button('Start'));
          await t.tick(1500);
          t.click(t.button('Lap'));
          await t.tick(1500);
          t.click(t.button('Lap'));
          const laps = t.$$('ol.laps li').map((li) => norm(li.textContent));
          t.expect(laps.length === 2, `The lap list has ${laps.length} item(s) after two laps — expected 2. Lap should append the current tenths: setLaps([...laps, tenths]).`);
          t.expect(
            laps[0] === 'Lap 1: 1.5' && laps[1] === 'Lap 2: 3.0',
            `The laps read ${laps.map((l) => `"${l}"`).join(' and ')} — expected "Lap 1: 1.5" and "Lap 2: 3.0".`,
          );
        }),
        test('↺ Reset zeroes everything and focuses ▶ Start', async (t) => {
          const from = t.warnings.length;
          t.render();
          t.click(t.button('Start'));
          await t.tick(800);
          t.click(t.button('Lap'));
          t.click(t.button('Reset'));
          const time = norm(t.find('.time').textContent);
          t.expect(time === '0.0', `After Reset the time reads "${time}" — expected "0.0".${crashNote(t, from)}`);
          t.expect(t.count('ol.laps li') === 0, `After Reset there are still ${t.count('ol.laps li')} lap(s) — clear them with setLaps([]).`);
          t.expect(t.timers.pendingIntervals() === 0, 'A ghost interval survived Reset. Reset must clear the interval too (call handleStop()).');
          const start = t.button('Start');
          const active = focused(t);
          t.expect(
            active === start,
            `After Reset the focus is on ${describe(active)} — expected the ▶ Start button.${crashNote(t, from)} Attach ref={startRef} to it and call startRef.current.focus() in handleReset.`,
          );
          await t.tick(1000);
          const still = norm(t.find('.time').textContent);
          t.expect(still === '0.0', `1 s after Reset the time reads "${still}" — the clock should stay stopped at "0.0".`);
        }),
        test('No ghost intervals: double Start and unmounting leave none behind', async (t) => {
          t.render();
          const start = t.button('Start');
          t.click(start);
          t.click(start);
          await t.tick(1000);
          const ghosts = t.timers.pendingIntervals();
          t.expect(
            ghosts === 1,
            ghosts === 0
              ? 'Clicking Start did not start any interval. Start should run intervalRef.current = setInterval(() => setTenths((t) => t + 1), 100).'
              : `Two clicks on Start left ${ghosts} intervals running — expected exactly 1. Check intervalRef.current before starting a new one.`,
          );
          const time = norm(t.find('.time').textContent);
          t.expect(time === '1.0', `After a double Start and 1 s the time reads "${time}" — expected "1.0".`);
          t.unmount();
          t.expect(
            t.timers.pendingIntervals() === 0,
            'The Phantom kept an interval alive after the stopwatch unmounted. Add useEffect(() => () => clearInterval(intervalRef.current), []).',
          );
        }),
      ],
      css: `
        .chronolith { text-align: center; padding: 24px; border-radius: 20px; background: radial-gradient(circle at 50% 0%, #4c1d95, #0c0a09 70%); color: #ede9fe; border: 2px solid #a78bfa; }
        .chronolith .phantom { font-size: 44px; filter: drop-shadow(0 0 12px #c4b5fd); }
        .chronolith .time { font-size: 52px; font-family: ui-monospace, monospace; margin: 6px 0 12px; text-shadow: 0 0 18px #a78bfa; }
        .chronolith .controls { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
        .chronolith .laps { text-align: left; max-width: 220px; margin: 14px auto 0; font-family: ui-monospace, monospace; }
      `,
      concepts: [
        {
          id: 'ruins-stopwatch',
          icon: '⏱️',
          title: 'The ghost-proof timer',
          summary: 'State for what you see, a ref for the interval id, a cleanup effect for unmount.',
          snippet: code`
            const intervalRef = useRef(null);

            function start() {
              if (intervalRef.current !== null) return;
              intervalRef.current = setInterval(() => setTenths((t) => t + 1), 100);
            }

            useEffect(() => () => clearInterval(intervalRef.current), []);
          `,
        },
      ],
    },
  ],
};

/**
 * Renders the exported RuneField with a ref and returns its handle,
 * failing with a helpful message if the handle is missing or is the DOM node.
 */
function renderField(t) {
  const RuneField = t.exports.RuneField;
  t.expect(typeof RuneField === 'function', 'Keep RuneField exported: export function RuneField({ ref, value, onChange }) { ... }');
  const ref = t.React.createRef();
  t.render(t.h(RuneField, { ref, value: '', onChange: () => {} }));
  const handle = ref.current;
  t.expect(handle, "The parent's ref.current is still null after rendering <RuneField ref={ref} />. Call useImperativeHandle(ref, () => ({ focus() { ... }, shake() { ... } })).");
  t.expect(
    handle.nodeType !== 1,
    "The parent's ref.current is the <input> DOM node itself. Attach a private inputRef to the input, and expose only { focus, shake } with useImperativeHandle(ref, () => ({ ... })).",
  );
  const missing = ['focus', 'shake'].filter((m) => typeof handle[m] !== 'function');
  t.expect(
    missing.length === 0,
    `The handle is missing ${missing.map((m) => `${m}()`).join(' and ')}. Return an object with both methods from useImperativeHandle.`,
  );
  return handle;
}
