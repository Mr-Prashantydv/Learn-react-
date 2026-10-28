import { code, md, q, test } from '../helpers.js';

// Small helpers shared by the checks in this chapter.
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const textOf = (t, sel) => norm(t.find(sel).textContent);
const quoteList = (lines) => (lines.length ? lines.map((l) => `"${l}"`).join(', ') : 'nothing');

export default {
  id: 'state-springs',
  file: '04-state-springs.js',
  title: 'State Springs',
  short: 'State',
  subtitle: 'Make things happen: events, useState, snapshots and updater functions.',
  icon: '♨️',
  colors: ['#3b0764', '#a78bfa'],
  scenery: ['♨️', '💧', '🫧', '🐸', '🪷', '🌫️', '✨'],
  intro: [
    { text: 'Welcome to the State Springs! Feel that warm mist? The water here remembers things. Every spring holds a little bit of state.', mood: 'happy' },
    { text: "The Mutator drained their memory. Click a fountain and... nothing. No splash, no re-render. Brr.", mood: 'worried' },
    { text: "Here you'll learn to answer clicks and give components a memory. And somewhere in the steam hides the Stale Snapshot, a ghost who lives one render in the past...", mood: 'thinking' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'springs-silent-bells',
      type: 'code',
      title: 'The Silent Bells',
      blurb: 'Wire up your first event handlers and make the bell tower ring.',
      xp: 110,
      story: [
        { text: 'The bell tower above the springs has gone quiet. Pull the rope — nothing. And the little bells? They all rang at once when the page loaded, then never again!', mood: 'worried' },
        { text: "Elements learn to respond through event handlers. Let's wire them up. Keep an eye on the Console panel under the preview — that's where the bells ring.", mood: 'happy' },
      ],
      lesson: md`
        ## Making things happen

        So far your components only *show* things. To make them **respond** to clicks,
        key presses or hovering, you give an element an **event handler**: a function
        that React calls when the event happens.

        \`\`\`jsx
        export default function Bell() {
          function handleClick() {
            console.log('Ding!');
          }

          return <button onClick={handleClick}>Ring</button>;
        }
        \`\`\`

        Three things to notice:

        1. \`handleClick\` is declared **inside** the component, so it can read the component's props (and, soon, its state).
        2. It is passed to the \`onClick\` prop. Event props are camelCase: \`onClick\`, \`onMouseEnter\`, \`onKeyDown\`, \`onSubmit\`...
        3. By convention, handler names start with \`handle\` followed by the event: \`handleClick\`, \`handlePull\`.

        ## Pass the function — don't call it

        This is the most common beginner bug in React:

        | ✅ passes a function | ❌ calls it during render |
        |---|---|
        | \`onClick={handleClick}\` | \`onClick={handleClick()}\` |
        | \`onClick={() => ring('Gold')}\` | \`onClick={ring('Gold')}\` |

        With parentheses, the function runs **immediately, while React renders** the
        component, and whatever it *returns* (usually \`undefined\`) becomes the click
        handler. The bell rings once when the page loads and never on click.

        ## Passing arguments: wrap it in an arrow

        If the handler needs an argument, wrap the call in an arrow function. The arrow
        is a brand-new function that React calls later, and *it* calls \`ring\`:

        \`\`\`jsx
        const bells = ['Copper', 'Gold'];

        function ring(name) {
          console.log('Ring: ' + name);
        }

        function Tower() {
          return (
            <div>
              {bells.map((bell) => (
                <button key={bell} onClick={() => ring(bell)}>
                  {bell}
                </button>
              ))}
            </div>
          );
        }
        \`\`\`

        ## The event object

        React passes every handler an **event object** describing what happened:

        \`\`\`jsx
        function handleClick(e) {
          console.log(e.type);                      // "click"
          console.log(e.currentTarget.textContent); // the button's text
        }
        \`\`\`

        You can ignore it when you don't need it. You'll put it to real work in the Echo Caverns.

        :::tip
        Event handlers are the place for **side effects**: logging, playing a sound and
        (very soon) changing state. Rendering must stay pure, but handlers don't have to be.
        :::

        :::mistake
        \`onClick={ring(bell)}\` looks so reasonable! But it rings every bell during render.
        If a handler fires the moment the page loads, look for parentheses that shouldn't be there.
        :::
      `,
      task: md`
        ## 🎯 Wake the bell tower

        1. Inside \`App\`, write a function \`handlePull\` that logs exactly **Ding dong!** with \`console.log\`.
        2. Pass it to the \`onClick\` of the \`<button className="rope">\`. Every pull logs **Ding dong!** once.
        3. The small bells ring at the wrong time: \`onClick={ring(bell)}\` calls \`ring\` while rendering. Fix it so clicking the Silver bell logs **Ring: Silver** (and so on), and nothing is logged until somebody clicks.

        Open the **Console** panel under the preview to hear the bells.
      `,
      starter: code`
        const bells = ['Copper', 'Silver', 'Gold'];

        function ring(name) {
          console.log('Ring: ' + name);
        }

        export default function App() {
          // TODO 1: write a handlePull function here that logs 'Ding dong!'

          return (
            <div className="tower">
              <h1>🔔 The Bell Tower</h1>
              {/* TODO 2: give the rope an onClick that uses handlePull */}
              <button className="rope">Pull the rope</button>
              <div className="bells">
                {bells.map((bell) => (
                  // TODO 3: this calls ring() while rendering! Ring on click instead.
                  <button key={bell} className="bell" onClick={ring(bell)}>
                    {bell} bell
                  </button>
                ))}
              </div>
            </div>
          );
        }
      `,
      solution: code`
        const bells = ['Copper', 'Silver', 'Gold'];

        function ring(name) {
          console.log('Ring: ' + name);
        }

        export default function App() {
          function handlePull() {
            console.log('Ding dong!');
          }

          return (
            <div className="tower">
              <h1>🔔 The Bell Tower</h1>
              <button className="rope" onClick={handlePull}>
                Pull the rope
              </button>
              <div className="bells">
                {bells.map((bell) => (
                  <button key={bell} className="bell" onClick={() => ring(bell)}>
                    {bell} bell
                  </button>
                ))}
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`A handler is just a function: \`function handlePull() { console.log('Ding dong!'); }\`. Put it inside \`App\`, above the \`return\`.`,
        md`Pass the function itself, **without** parentheses: \`<button className="rope" onClick={handlePull}>\`.`,
        md`For the bells, wrap the call in an arrow so it runs later: \`onClick={() => ring(bell)}\`.`,
      ],
      tests: [
        test('Nothing rings while the tower renders', (t) => {
          t.render();
          t.expect(
            t.count('.bell') === 3,
            `Found ${t.count('.bell')} .bell buttons — expected 3. Keep the bells.map(...) that renders one button per bell.`,
          );
          const lines = t.logLines();
          const culprit = lines.some((l) => l.startsWith('Ring:'))
            ? 'onClick={ring(bell)} CALLS ring while React renders. Pass a function instead: onClick={() => ring(bell)}.'
            : 'A handler is being CALLED while React renders, e.g. onClick={handlePull()}. Pass the function itself: onClick={handlePull}.';
          t.expect(lines.length === 0, `Before any click, the console already shows ${quoteList(lines)}. ${culprit}`);
        }),
        test('Pulling the rope logs "Ding dong!" once per pull', (t) => {
          t.render();
          const before = t.logLines().length;
          t.click('.rope');
          const fresh = t.logLines().slice(before);
          t.expect(
            fresh.length === 1 && fresh[0] === 'Ding dong!',
            `Pulling the rope logged ${quoteList(fresh)} — expected exactly "Ding dong!". Write function handlePull() { console.log('Ding dong!'); } inside App and pass it with onClick={handlePull} (no parentheses).`,
          );
          t.click('.rope');
          t.click('.rope');
          const dings = t.logLines().slice(before).filter((l) => l === 'Ding dong!').length;
          t.expect(dings === 3, `Three pulls gave ${dings} "Ding dong!" lines — expected 3, one per click.`);
        }),
        test('Each bell rings its own name when clicked', (t) => {
          t.render();
          let before = t.logLines().length;
          t.click(t.button('Silver'));
          let fresh = t.logLines().slice(before);
          t.expect(
            fresh.length === 1 && fresh[0] === 'Ring: Silver',
            `Clicking the Silver bell logged ${quoteList(fresh)} — expected exactly "Ring: Silver". Use onClick={() => ring(bell)} so each button calls ring with its own name when clicked.`,
          );
          before = t.logLines().length;
          t.click(t.button('Gold'));
          fresh = t.logLines().slice(before);
          t.expect(
            fresh.length === 1 && fresh[0] === 'Ring: Gold',
            `Clicking the Gold bell logged ${quoteList(fresh)} — expected exactly "Ring: Gold".`,
          );
        }),
      ],
      concepts: [
        {
          id: 'springs-event-handler',
          icon: '👆',
          title: 'Event handlers',
          summary: 'Pass a function to onClick; React calls it when the event happens.',
          snippet: code`
            <button onClick={handleClick}>Ring</button>
            <button onClick={() => ring('Gold')}>Gold</button>
          `,
          detail: 'Pass the function itself, not its result: onClick={handleClick()} runs it during render. Wrap calls that need arguments in an arrow function.',
        },
      ],
      css: `
        .tower { text-align: center; padding: 14px; border-radius: 18px; background: linear-gradient(#ede9fe, #fbfaf6); border: 2px solid #ddd6fe; }
        .rope { font-size: 1.15em; padding: 12px 24px; background: #7c3aed; box-shadow: 0 4px 0 #5b21b6; }
        .rope:hover { background: #8b5cf6; }
        .bells { margin-top: 14px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
        .bell { background: #f59e0b; box-shadow: 0 3px 0 #b45309; }
        .bell:hover { background: #fbbf24; }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'springs-forgetful-fountain',
      type: 'code',
      title: 'The Forgetful Fountain',
      blurb: 'A plain variable cannot remember. Give the fountains real memory with useState.',
      xp: 130,
      story: [
        { text: "These wishing wells count the coins people toss in... or they should. Toss one: the console says the count went up, but the sign still says 0!", mood: 'worried' },
        { text: 'A plain variable forgets everything between renders, and React never hears that it changed. Components need a memory — and that memory is called state.', mood: 'thinking' },
      ],
      lesson: md`
        ## When a variable isn't enough

        \`\`\`jsx
        function Fountain() {
          let coins = 0;

          function handleToss() {
            coins = coins + 1;   // the variable changes...
          }

          return <button onClick={handleToss}>Coins: {coins}</button>; // ...the screen doesn't
        }
        \`\`\`

        Two things go wrong:

        1. **Local variables don't survive renders.** Each time React renders \`Fountain\`, it calls the function again from the top, so \`let coins = 0\` runs again.
        2. **Changing a local variable doesn't trigger a render.** React has no idea anything changed, so it never calls your component again.

        To update the screen you need **data that persists between renders** *and* a way to
        **tell React to render again**. That's exactly what \`useState\` gives you.

        ## useState

        \`\`\`jsx
        import { useState } from 'react';

        function Fountain() {
          const [coins, setCoins] = useState(0);

          function handleToss() {
            setCoins(coins + 1);
          }

          return <button onClick={handleToss}>Coins: {coins}</button>;
        }
        \`\`\`

        - \`useState(0)\` declares a **state variable** with the initial value \`0\` (only used on the very first render).
        - It returns a pair, which we unpack with array destructuring: the **current value** and a **setter function**.
        - Calling \`setCoins(1)\` stores the new value and **asks React to render again**. On that next render, \`useState\` returns \`1\`.
        - Name the pair \`[something, setSomething]\`: \`[coins, setCoins]\`, \`[isOpen, setIsOpen]\`.

        \`useState\` is a **Hook**: a special function whose name starts with \`use\`. Call
        Hooks only at the **top level** of a component — not inside conditions, loops or
        handlers. (The Hook Workshop explains why.)

        ## Trigger → render → commit

        Every screen update in React happens in three steps:

        1. **Trigger** — the first render, or a call to a state setter.
        2. **Render** — React *calls your component function* to get the new JSX.
        3. **Commit** — React compares the result with the previous one and changes **only the DOM nodes that differ**.

        "Rendering" means *calling your component*, not painting pixels. That's why render
        must stay pure: React may call it whenever it needs fresh JSX.

        ## State is per instance

        State belongs to each **place** a component is rendered:

        \`\`\`jsx
        <Fountain />  {/* has its own coins */}
        <Fountain />  {/* has its own coins too */}
        \`\`\`

        Clicking one fountain leaves the other untouched. State is also **private**: the
        parent can't reach in and read or change it.

        :::mistake
        Calling a setter directly in the component body — \`setCoins(coins + 1)\` outside
        any handler — triggers a render, which calls it again, forever. React stops with
        "Too many re-renders". Set state in **event handlers**.
        :::

        :::try
        In the starter, toss a coin a few times and watch the console: the variable really
        does count up. The screen just never hears about it.
        :::
      `,
      task: md`
        ## 🎯 Give the fountains a memory

        1. Import \`useState\` from \`'react'\` and replace \`let coins = 0\` in \`Fountain\` with a state variable: \`const [coins, setCoins] = useState(0)\`.
        2. Clicking the \`<button className="toss">\` adds one coin: the \`<p className="coins">\` goes from **Coins: 0** to **Coins: 1**, **Coins: 2**...
        3. \`App\` renders two fountains. Each one must keep its **own** count.
        4. When a fountain has **3 or more** coins, show \`<p className="wish">✨ Wish granted!</p>\` inside that fountain (and only that one).
      `,
      starter: code`
        // TODO 1: import useState from 'react'

        function Fountain({ name }) {
          // 🐛 A plain variable: it starts over on every render,
          // and changing it doesn't tell React to render again.
          let coins = 0;

          function handleToss() {
            coins = coins + 1;
            console.log(name + ' has ' + coins + ' coins... says the variable.');
          }

          return (
            <div className="fountain">
              <h2>⛲ {name}</h2>
              <p className="coins">Coins: {coins}</p>
              <button className="toss" onClick={handleToss}>
                🪙 Toss a coin
              </button>
              {/* TODO 4: show <p className="wish">✨ Wish granted!</p> at 3+ coins */}
            </div>
          );
        }

        export default function App() {
          return (
            <div className="plaza">
              <Fountain name="Moon Well" />
              <Fountain name="Sun Well" />
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        function Fountain({ name }) {
          const [coins, setCoins] = useState(0);

          function handleToss() {
            setCoins(coins + 1);
          }

          return (
            <div className="fountain">
              <h2>⛲ {name}</h2>
              <p className="coins">Coins: {coins}</p>
              <button className="toss" onClick={handleToss}>
                🪙 Toss a coin
              </button>
              {coins >= 3 && <p className="wish">✨ Wish granted!</p>}
            </div>
          );
        }

        export default function App() {
          return (
            <div className="plaza">
              <Fountain name="Moon Well" />
              <Fountain name="Sun Well" />
            </div>
          );
        }
      `,
      hints: [
        md`Start with the import on the first line: \`import { useState } from 'react';\`. Then inside \`Fountain\`: \`const [coins, setCoins] = useState(0);\`.`,
        md`Don't assign to \`coins\` anymore. In \`handleToss\`, ask React for a new value: \`setCoins(coins + 1);\`.`,
        md`For the wish, use conditional rendering from the Branching Woods: \`{coins >= 3 && <p className="wish">✨ Wish granted!</p>}\`.`,
      ],
      tests: [
        test('The coins live in state: useState(0)', (t) => {
          t.sourceIncludes(/useState\s*\(/, "Store the coins with the useState Hook: const [coins, setCoins] = useState(0); (and import { useState } from 'react').");
          t.render();
          const fountains = t.$$('.fountain');
          t.expect(fountains.length === 2, `Found ${fountains.length} .fountain element(s) — App should render two <Fountain /> components.`);
          fountains.forEach((f, i) => {
            const txt = norm(f.querySelector('.coins')?.textContent);
            t.expect(txt === 'Coins: 0', `Fountain ${i + 1} starts with "${txt}" — expected "Coins: 0".`);
          });
        }),
        test('Tossing a coin updates the screen', (t) => {
          t.render();
          t.click(t.$$('.fountain .toss')[0]);
          let txt = norm(t.$$('.fountain .coins')[0].textContent);
          t.expect(
            txt === 'Coins: 1',
            `After one toss the first fountain shows "${txt}" — expected "Coins: 1". Changing a local variable doesn't re-render. Use state and call setCoins(coins + 1) in handleToss.`,
          );
          t.click(t.$$('.fountain .toss')[0]);
          txt = norm(t.$$('.fountain .coins')[0].textContent);
          t.expect(txt === 'Coins: 2', `After two tosses the first fountain shows "${txt}" — expected "Coins: 2".`);
        }),
        test('Each fountain remembers its own coins', (t) => {
          t.render();
          t.click(t.$$('.fountain .toss')[0]);
          t.click(t.$$('.fountain .toss')[0]);
          t.click(t.$$('.fountain .toss')[1]);
          const [a, b] = t.$$('.fountain .coins').map((el) => norm(el.textContent));
          t.expect(
            a === 'Coins: 2' && b === 'Coins: 1',
            `After 2 tosses into Moon Well and 1 into Sun Well, they show "${a}" and "${b}" — expected "Coins: 2" and "Coins: 1". Each <Fountain /> should call useState itself, so each one gets its own coins.`,
          );
        }),
        test('Three coins grant a wish', (t) => {
          t.render();
          t.expect(!t.$('.wish'), 'No wish should be granted before anyone tosses a coin.');
          for (let i = 0; i < 3; i++) t.click(t.$$('.fountain .toss')[0]);
          const [moon, sun] = t.$$('.fountain');
          const wish = moon.querySelector('.wish');
          t.expect(
            wish && norm(wish.textContent).includes('Wish granted!'),
            'After 3 coins, Moon Well should show <p className="wish">✨ Wish granted!</p>. Try {coins >= 3 && <p className="wish">✨ Wish granted!</p>}.',
          );
          t.expect(!sun.querySelector('.wish'), 'Sun Well has no coins, so it must not show a wish.');
        }),
      ],
      concepts: [
        {
          id: 'springs-use-state',
          icon: '💧',
          title: 'useState',
          summary: 'Gives a component memory: the current value plus a setter that triggers a re-render.',
          snippet: code`
            const [coins, setCoins] = useState(0);

            <button onClick={() => setCoins(coins + 1)}>
              Coins: {coins}
            </button>
          `,
          detail: 'Local variables reset on every render and changing them does not re-render. State survives between renders, and setting it asks React to render again.',
        },
        {
          id: 'springs-render-commit',
          icon: '🎬',
          title: 'Trigger → render → commit',
          summary: 'A setter triggers a render (React calls your component), then React commits only the DOM changes.',
          detail: 'Rendering means calling your component to get JSX. Committing means updating the real DOM, and React only touches the nodes that changed.',
        },
        {
          id: 'springs-state-per-instance',
          icon: '🪣',
          title: 'State is per instance',
          summary: 'Every rendered copy of a component has its own private state.',
          snippet: code`
            <Fountain />  {/* own coins */}
            <Fountain />  {/* own coins */}
          `,
        },
      ],
      css: `
        .plaza { display: flex; gap: 14px; flex-wrap: wrap; }
        .fountain { flex: 1 1 180px; text-align: center; background: linear-gradient(#e0f2fe, #f0f9ff); border: 2px solid #7dd3fc; border-radius: 18px; padding: 12px; }
        .coins { font-size: 1.3em; font-weight: 800; color: #0369a1; }
        .toss { background: #0ea5e9; box-shadow: 0 3px 0 #0369a1; }
        .wish { color: #a21caf; font-weight: 700; animation: glow 1.2s ease-in-out infinite alternate; }
        @keyframes glow { from { text-shadow: 0 0 2px #f0abfc; } to { text-shadow: 0 0 12px #e879f9; } }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'springs-spirit-gallery',
      type: 'code',
      title: 'The Spirit Gallery',
      blurb: 'Several pieces of state and your first handler prop: bring the gallery to life.',
      xp: 140,
      story: [
        { text: 'The spirits of the springs sat for portraits, but the gallery is stuck on the first one. Next does nothing, the lore is locked away...', mood: 'worried' },
        { text: 'A component can have as many state variables as it needs. And a child can tell its parent "I was clicked!" through a handler prop. Props go down, events come up!', mood: 'excited' },
      ],
      lesson: md`
        ## More than one piece of state

        A component can call \`useState\` as many times as it needs. Each call creates a
        separate, independent state variable:

        \`\`\`jsx
        const [index, setIndex] = useState(0);           // which spirit is shown
        const [showLore, setShowLore] = useState(false); // is the lore visible?
        \`\`\`

        Use separate variables when the values change independently, like here: moving
        to the next spirit doesn't open the lore, and opening the lore doesn't move you.
        State can hold numbers, strings, booleans — and objects and arrays, which the
        Immutable Isles are all about.

        ### Booleans: toggle with !

        \`\`\`jsx
        <button onClick={() => setShowLore(!showLore)}>
          {showLore ? 'Hide lore' : 'Show lore'}
        </button>
        {showLore && <p className="lore">{spirit.lore}</p>}
        \`\`\`

        ### Derive what you can

        Notice what is *not* state: the current spirit. It is **calculated** from \`index\`
        during render:

        \`\`\`jsx
        const spirit = spirits[index];
        \`\`\`

        The same goes for "should Back be disabled?": \`disabled={index === 0}\`.
        Store the minimum; compute the rest.

        ### Wrapping around with %

        The remainder operator \`%\` is perfect for cycling: \`(index + 1) % spirits.length\`
        counts 0, 1, 2, 3, 4, 0, 1... because \`5 % 5\` is \`0\`.

        ## Handler props: the child reports, the parent decides

        Built-in elements have \`onClick\`. Your own components can accept **event handler
        props** too. They're just functions passed as props:

        \`\`\`jsx
        function Thumb({ spirit, isActive, onSelect }) {
          return (
            <button className={isActive ? 'thumb active' : 'thumb'} onClick={onSelect}>
              {spirit.emoji}
            </button>
          );
        }

        // in App:
        <Thumb key={s.id} spirit={s} isActive={i === index} onSelect={() => setIndex(i)} />
        \`\`\`

        - The **child** (\`Thumb\`) knows *when* something happened: it was clicked.
        - The **parent** (\`App\`) owns the state, so it decides *what* happens.
        - Naming: props start with \`on\` (\`onSelect\`, \`onPlay\`); the functions that handle them start with \`handle\`.

        This is how data flows in React: **props go down, events come up**.

        :::mistake
        \`onSelect={setIndex(i)}\` calls the setter *during render*, which triggers another
        render, which calls it again... React stops with "Too many re-renders". Wrap it:
        \`onSelect={() => setIndex(i)}\`.
        :::
      `,
      task: md`
        ## 🎯 Bring the gallery to life

        1. Replace the constants \`index\` and \`showLore\` with **state variables** (starting at \`0\` and \`false\`).
        2. **Next ▸** (\`className="next"\`) shows the next spirit and wraps from the last back to the first. The \`<p className="counter">\` reads e.g. **Spirit 2 of 5**.
        3. **◂ Back** (\`className="back"\`) shows the previous spirit, and is \`disabled\` while the first spirit is shown.
        4. The \`lore-toggle\` button shows and hides \`<p className="lore">\`. Its label reads **Show lore** while hidden and **Hide lore** while shown.
        5. Give \`Thumb\` an \`onSelect\` prop that it calls when clicked, and pass \`onSelect={() => setIndex(i)}\` from \`App\`. Clicking the 4th thumbnail shows **Spirit 4 of 5**.
      `,
      starter: code`
        const spirits = [
          { id: 'nix', name: 'Nix the Bubbler', emoji: '🫧', lore: 'Blows a fresh bubble for every render.' },
          { id: 'koi', name: 'Old Koi', emoji: '🐟', lore: 'Remembers every value anyone ever set.' },
          { id: 'lily', name: 'Lily of the Pad', emoji: '🪷', lore: 'Only blooms when her state changes.' },
          { id: 'fog', name: 'Mister Fog', emoji: '🌫️', lore: 'Hides things until a boolean says otherwise.' },
          { id: 'toad', name: 'Sir Toad', emoji: '🐸', lore: 'Hops forward exactly one index at a time.' },
        ];

        // TODO 5: accept an onSelect prop and call it when the button is clicked
        function Thumb({ spirit, isActive }) {
          return (
            <button className={isActive ? 'thumb active' : 'thumb'}>
              {spirit.emoji}
            </button>
          );
        }

        export default function App() {
          // TODO 1: turn these into state variables
          const index = 0;
          const showLore = false;

          const spirit = spirits[index];

          return (
            <div className="gallery">
              <div className="thumbs">
                {spirits.map((s, i) => (
                  <Thumb key={s.id} spirit={s} isActive={i === index} />
                ))}
              </div>
              <h2 className="spirit-name">
                {spirit.emoji} {spirit.name}
              </h2>
              <p className="counter">
                Spirit {index + 1} of {spirits.length}
              </p>
              {showLore && <p className="lore">{spirit.lore}</p>}
              <div className="controls">
                {/* TODO 2-4: wire up these buttons */}
                <button className="back">◂ Back</button>
                <button className="lore-toggle">Show lore</button>
                <button className="next">Next ▸</button>
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const spirits = [
          { id: 'nix', name: 'Nix the Bubbler', emoji: '🫧', lore: 'Blows a fresh bubble for every render.' },
          { id: 'koi', name: 'Old Koi', emoji: '🐟', lore: 'Remembers every value anyone ever set.' },
          { id: 'lily', name: 'Lily of the Pad', emoji: '🪷', lore: 'Only blooms when her state changes.' },
          { id: 'fog', name: 'Mister Fog', emoji: '🌫️', lore: 'Hides things until a boolean says otherwise.' },
          { id: 'toad', name: 'Sir Toad', emoji: '🐸', lore: 'Hops forward exactly one index at a time.' },
        ];

        function Thumb({ spirit, isActive, onSelect }) {
          return (
            <button className={isActive ? 'thumb active' : 'thumb'} onClick={onSelect}>
              {spirit.emoji}
            </button>
          );
        }

        export default function App() {
          const [index, setIndex] = useState(0);
          const [showLore, setShowLore] = useState(false);

          const spirit = spirits[index];

          function handleNext() {
            setIndex((index + 1) % spirits.length);
          }

          function handleBack() {
            setIndex(index - 1);
          }

          return (
            <div className="gallery">
              <div className="thumbs">
                {spirits.map((s, i) => (
                  <Thumb key={s.id} spirit={s} isActive={i === index} onSelect={() => setIndex(i)} />
                ))}
              </div>
              <h2 className="spirit-name">
                {spirit.emoji} {spirit.name}
              </h2>
              <p className="counter">
                Spirit {index + 1} of {spirits.length}
              </p>
              {showLore && <p className="lore">{spirit.lore}</p>}
              <div className="controls">
                <button className="back" onClick={handleBack} disabled={index === 0}>
                  ◂ Back
                </button>
                <button className="lore-toggle" onClick={() => setShowLore(!showLore)}>
                  {showLore ? 'Hide lore' : 'Show lore'}
                </button>
                <button className="next" onClick={handleNext}>
                  Next ▸
                </button>
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Two \`useState\` calls: \`const [index, setIndex] = useState(0);\` and \`const [showLore, setShowLore] = useState(false);\`. Don't forget the import.`,
        md`Next: \`setIndex((index + 1) % spirits.length)\`. Back: \`setIndex(index - 1)\` plus \`disabled={index === 0}\`. Lore: \`setShowLore(!showLore)\`, and the label \`{showLore ? 'Hide lore' : 'Show lore'}\`.`,
        md`In \`Thumb\`, destructure \`onSelect\` and use it: \`<button ... onClick={onSelect}>\`. In \`App\`: \`<Thumb key={s.id} spirit={s} isActive={i === index} onSelect={() => setIndex(i)} />\`.`,
      ],
      tests: [
        test('Next ▸ moves forward through the spirits', (t) => {
          t.render();
          let counter = textOf(t, '.counter');
          t.expect(counter === 'Spirit 1 of 5', `The counter starts at "${counter}" — expected "Spirit 1 of 5".`);
          t.click('.next');
          counter = textOf(t, '.counter');
          t.expect(
            counter === 'Spirit 2 of 5',
            `After one click on Next the counter reads "${counter}" — expected "Spirit 2 of 5". Make index state with useState(0) and call setIndex in the Next button's onClick.`,
          );
          t.expect(textOf(t, '.spirit-name').includes('Old Koi'), 'The second spirit, Old Koi, should be shown after clicking Next.');
        }),
        test('...and wraps around after the last spirit', (t) => {
          t.render();
          for (let i = 0; i < 4; i++) t.click('.next');
          let counter = textOf(t, '.counter');
          t.expect(counter === 'Spirit 5 of 5', `After four clicks on Next the counter reads "${counter}" — expected "Spirit 5 of 5".`);
          t.click('.next');
          counter = textOf(t, '.counter');
          t.expect(
            counter === 'Spirit 1 of 5',
            `After the last spirit, Next should go back to the first, but the counter reads "${counter}". Try setIndex((index + 1) % spirits.length).`,
          );
        }),
        test('◂ Back goes back, and is disabled on the first spirit', (t) => {
          t.render();
          t.expect(t.find('.back').disabled, 'On the first spirit the Back button should be disabled: disabled={index === 0}.');
          t.click('.next');
          t.click('.next');
          t.expect(!t.find('.back').disabled, 'Once you have moved past the first spirit, Back should be enabled again.');
          t.click('.back');
          const counter = textOf(t, '.counter');
          t.expect(counter === 'Spirit 2 of 5', `Next, Next, Back should land on "Spirit 2 of 5", but the counter reads "${counter}". Back should call setIndex(index - 1).`);
        }),
        test('The lore button shows and hides the lore', (t) => {
          t.render();
          t.expect(!t.$('.lore'), 'The lore should be hidden at first (showLore starts as false).');
          t.expect(textOf(t, '.lore-toggle') === 'Show lore', 'While the lore is hidden, the button should read "Show lore".');
          t.click('.lore-toggle');
          t.expect(t.$('.lore'), 'Clicking "Show lore" should show <p className="lore">. Make showLore state and toggle it with setShowLore(!showLore).');
          t.expect(
            textOf(t, '.lore') === 'Blows a fresh bubble for every render.',
            `The lore reads "${textOf(t, '.lore')}" — expected the current spirit's lore, "Blows a fresh bubble for every render.". Render {spirit.lore} inside <p className="lore">.`,
          );
          t.expect(
            textOf(t, '.lore-toggle') === 'Hide lore',
            `While the lore is shown, the button reads "${textOf(t, '.lore-toggle')}" — expected "Hide lore". Use {showLore ? 'Hide lore' : 'Show lore'}.`,
          );
          t.click('.lore-toggle');
          t.expect(!t.$('.lore'), 'Clicking "Hide lore" should hide the lore again.');
        }),
        test('Clicking a thumbnail selects that spirit (onSelect)', (t) => {
          t.render();
          const thumbs = t.$$('.thumb');
          t.expect(thumbs.length === 5, `Found ${thumbs.length} .thumb buttons — expected one per spirit (5).`);
          t.click(thumbs[3]);
          const counter = textOf(t, '.counter');
          t.expect(
            counter === 'Spirit 4 of 5',
            `After clicking the 4th thumbnail the counter reads "${counter}" — expected "Spirit 4 of 5". Thumb should call its onSelect prop on click, and App should pass onSelect={() => setIndex(i)}.`,
          );
          t.expect(textOf(t, '.spirit-name').includes('Mister Fog'), 'The 4th spirit, Mister Fog, should be shown.');
          const active = t.$$('.thumb.active');
          t.expect(active.length === 1 && active[0] === t.$$('.thumb')[3], 'Exactly one thumbnail, the selected one, should have the class "active".');
        }),
      ],
      concepts: [
        {
          id: 'springs-multiple-state',
          icon: '🎛️',
          title: 'Multiple state variables',
          summary: 'Call useState once per independent value; derive everything else.',
          snippet: code`
            const [index, setIndex] = useState(0);
            const [showLore, setShowLore] = useState(false);
            const spirit = spirits[index]; // derived, not state
          `,
        },
        {
          id: 'springs-handler-props',
          icon: '📣',
          title: 'Handler props',
          summary: 'Pass functions like onSelect to children: the child calls them, the parent decides what happens.',
          snippet: code`
            function Thumb({ onSelect }) {
              return <button onClick={onSelect}>🐸</button>;
            }

            <Thumb onSelect={() => setIndex(3)} />
          `,
          detail: 'Props go down, events come up. Name handler props onSomething and the functions that handle them handleSomething.',
        },
      ],
      css: `
        .gallery { text-align: center; background: linear-gradient(160deg, #f5f3ff, #ecfeff); border: 2px solid #c4b5fd; border-radius: 18px; padding: 14px; }
        .thumbs { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
        .thumb { font-size: 1.4em; padding: 6px 10px; background: white; color: inherit; border: 2px solid #ddd6fe; box-shadow: 0 3px 0 #ddd6fe; }
        .thumb:hover { background: #f5f3ff; }
        .thumb.active { border-color: #7c3aed; background: #ede9fe; }
        .spirit-name { font-size: 1.6em; }
        .counter { color: #6d28d9; font-weight: 700; }
        .lore { font-style: italic; background: white; border-radius: 10px; padding: 8px 12px; border: 1px dashed #c4b5fd; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'springs-triple-splash',
      type: 'bug',
      title: 'The Triple Splash',
      blurb: 'Bug hunt! Three splashes in, one splash out. Discover state snapshots and updater functions.',
      xp: 140,
      story: [
        { text: "The Old Geyser should rise three times per click. Go on, press +3 Splash... it rose by ONE. The Stale Snapshot has been here, I can smell the old state.", mood: 'worried' },
        { text: "Nothing is 'broken' in the usual sense. To fix it, you need to know how state really behaves: as a snapshot. Read the lesson first — it's the most important one in these springs!", mood: 'thinking' },
      ],
      lesson: md`
        ## State is a snapshot

        When React renders your component, it hands you the state **for that render**.
        Think of each render as a photograph: the props, the state, the event handlers
        and the JSX are all frozen with the values of that moment.

        \`\`\`jsx
        const [water, setWater] = useState(0);

        function handleSplash() {
          setWater(water + 1); // setWater(0 + 1)
          setWater(water + 1); // setWater(0 + 1)
          setWater(water + 1); // setWater(0 + 1)
        }
        \`\`\`

        Inside this render, \`water\` is \`0\` — it's a \`const\`! Calling the setter does
        **not** change the variable you already have. It asks for a **new render**, in which
        \`useState\` will return the new value. So all three calls say "set water to 1".

        You can see the snapshot with a log:

        \`\`\`jsx
        function handleSplash() {
          setWater(water + 1);
          console.log(water); // still 0!
        }
        \`\`\`

        ## Batching

        React waits until **all the code in an event handler has finished** before it
        re-renders. Then it processes every state update together: one re-render, however
        many setters you called. This is **batching** — like a waiter who takes the whole
        table's order before walking to the kitchen.

        ## Updater functions

        To update state based on its previous value, several times in a row, pass a
        **function** instead of a value:

        \`\`\`jsx
        function handleSplash() {
          setWater((w) => w + 1);
          setWater((w) => w + 1);
          setWater((w) => w + 1);
        }
        \`\`\`

        React puts each updater in a **queue**. During the next render it runs them in
        order, handing each one the result of the previous one:

        | queued update | receives | returns |
        |---|---|---|
        | \`w => w + 1\` | 0 | 1 |
        | \`w => w + 1\` | 1 | 2 |
        | \`w => w + 1\` | 2 | 3 |

        Values and updaters can be mixed. A plain value simply means "replace with this":

        \`\`\`jsx
        setWater(water + 5);    // replace with 5 (water is 0 in this snapshot)
        setWater((w) => w * 2); // 5 * 2 → 10
        \`\`\`

        Updater parameters are usually named after the state: \`w\` for water, \`c\` for count,
        or \`prev\`.

        :::tip
        Use \`setX(newValue)\` when the new value doesn't depend on the old one, like
        \`setWater(0)\`. Use \`setX(x => ...)\` when it does, especially if you update more
        than once in the same event.
        :::

        :::mistake
        Updaters must be **pure**: just compute and return the next value. No logging, no
        other setters inside. React may call them twice in development to check.
        :::

        :::try
        The starter logs \`render\` every time the component renders. Click **+3 Splash**:
        one click, three setter calls... and exactly one new \`render\` line. Batching!
        :::
      `,
      task: md`
        ## 🐛 Fix the triple splash

        Both geyser buttons are broken by stale snapshots. The \`<p className="water">\` shows the level, e.g. **Water: 7**.

        1. **💦 +3 Splash** calls \`splash()\` three times, but the water only rises by 1. Fix \`splash\` with an **updater function** so one click adds **3**.
        2. **✖️ Double, then +1** should double the water and then add one: from 3 it must reach **7**. Fix both setter calls with updater functions.
        3. Keep the three separate \`splash()\` calls (don't replace them with one \`setWater(water + 3)\`), and keep the \`console.log('render')\` line.
      `,
      starter: code`
        import { useState } from 'react';

        export default function App() {
          const [water, setWater] = useState(0);
          console.log('render');

          function splash() {
            setWater(water + 1);
          }

          function handleTriple() {
            splash();
            splash();
            splash();
          }

          function handleDoublePlusOne() {
            setWater(water * 2);
            setWater(water + 1);
          }

          return (
            <div className="geyser">
              <h2>♨️ The Old Geyser</h2>
              <div className="column" style={{ height: Math.min(160, 12 + water * 6) }} />
              <p className="water">Water: {water}</p>
              <button className="triple" onClick={handleTriple}>
                💦 +3 Splash
              </button>
              <button className="double" onClick={handleDoublePlusOne}>
                ✖️ Double, then +1
              </button>
              <button className="reset" onClick={() => setWater(0)}>
                ↺ Reset
              </button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export default function App() {
          const [water, setWater] = useState(0);
          console.log('render');

          function splash() {
            setWater((w) => w + 1);
          }

          function handleTriple() {
            splash();
            splash();
            splash();
          }

          function handleDoublePlusOne() {
            setWater((w) => w * 2);
            setWater((w) => w + 1);
          }

          return (
            <div className="geyser">
              <h2>♨️ The Old Geyser</h2>
              <div className="column" style={{ height: Math.min(160, 12 + water * 6) }} />
              <p className="water">Water: {water}</p>
              <button className="triple" onClick={handleTriple}>
                💦 +3 Splash
              </button>
              <button className="double" onClick={handleDoublePlusOne}>
                ✖️ Double, then +1
              </button>
              <button className="reset" onClick={() => setWater(0)}>
                ↺ Reset
              </button>
            </div>
          );
        }
      `,
      hints: [
        md`In this render \`water\` is a constant. Every \`setWater(water + 1)\` asks for the *same* value. You need each update to start from the result of the previous one.`,
        md`Pass a function to the setter: React calls it with the latest queued value. \`setWater((w) => w + 1)\`.`,
        md`\`splash\` becomes \`setWater((w) => w + 1);\` and the double handler becomes \`setWater((w) => w * 2); setWater((w) => w + 1);\`.`,
      ],
      tests: [
        test('💦 +3 Splash raises the water by 3 per click', (t) => {
          t.render();
          t.click('.triple');
          let water = textOf(t, '.water');
          t.expect(
            water === 'Water: 3',
            `After one splash the geyser shows "${water}" — expected "Water: 3". All three splash() calls read the same snapshot (water is 0), so each one says "set water to 1". Use an updater: setWater((w) => w + 1).`,
          );
          t.click('.triple');
          water = textOf(t, '.water');
          t.expect(water === 'Water: 6', `After two splashes the geyser shows "${water}" — expected "Water: 6".`);
        }),
        test('✖️ Double, then +1 works from the latest value', (t) => {
          t.render();
          t.click('.triple');
          let current = Number(textOf(t, '.water').replace(/[^\d-]/g, ''));
          for (let round = 0; round < 2; round++) {
            const expected = current * 2 + 1;
            t.click('.double');
            const got = Number(textOf(t, '.water').replace(/[^\d-]/g, ''));
            t.expect(
              got === expected,
              `From ${current}, "Double, then +1" gave ${got} — expected ${expected} (${current} × 2 + 1). The second setter still reads the old snapshot. Queue updaters instead: setWater((w) => w * 2); setWater((w) => w + 1);`,
            );
            current = got;
          }
        }),
        test('Every update uses the updater form (and the three splash() calls stay)', (t) => {
          t.sourceExcludes(
            /setWater\(\s*water\b(?!\s*=>)/,
            'A setter still computes from the stale snapshot: setWater(water ...). Use the updater form, e.g. setWater((w) => w + 1).',
          );
          t.sourceIncludes(/setWater\(\s*\(?\s*\w+\s*\)?\s*=>/, 'Use updater functions: setWater((w) => w + 1).');
          t.sourceIncludes(
            /splash\(\)\s*;?\s*splash\(\)\s*;?\s*splash\(\)/,
            'Keep the three separate splash() calls in handleTriple. The quest is to make queued updates work, not to merge them.',
          );
        }),
        test('React batches: one click, one re-render', (t) => {
          t.render();
          const renders = () => t.logLines().filter((l) => l === 'render').length;
          t.expect(renders() === 1, "Keep the console.log('render') line at the top of App — this check counts renders with it.");
          t.click('.triple');
          t.expect(
            renders() === 2,
            `One click caused ${renders() - 1} re-render(s). React should batch the three updates into a single render.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'springs-snapshot',
          icon: '📸',
          title: 'State as a snapshot',
          summary: "Within one render, state is a constant. Setting it schedules the next render; it doesn't change the current variable.",
          snippet: code`
            setCount(count + 1);
            console.log(count); // still the old value
          `,
        },
        {
          id: 'springs-batching',
          icon: '🧺',
          title: 'Batching',
          summary: 'React applies all state updates after the event handler finishes: one click, one re-render.',
        },
        {
          id: 'springs-updater',
          icon: '🔁',
          title: 'Updater functions',
          summary: 'setX(x => x + 1) computes from the latest queued value instead of a stale snapshot.',
          snippet: code`
            setWater((w) => w + 1);
            setWater((w) => w + 1); // 2 in total
          `,
          detail: 'React queues updaters and runs them in order during the next render. Use them whenever the next value depends on the previous one.',
        },
      ],
      css: `
        .geyser { text-align: center; background: linear-gradient(#f0f9ff, #fdf4ff); border: 2px solid #a5f3fc; border-radius: 18px; padding: 14px; }
        .column { width: 46px; margin: 8px auto; border-radius: 23px 23px 6px 6px; background: linear-gradient(#a5f3fc, #0ea5e9); transition: height 0.3s; }
        .water { font-size: 1.4em; font-weight: 800; color: #0369a1; }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'springs-echo-caverns',
      type: 'code',
      title: 'The Echo Caverns',
      blurb: 'Events bubble up like echoes. Learn stopPropagation and preventDefault.',
      xp: 140,
      story: [
        { text: 'Deep in the Echo Caverns every click echoes. Bless a crystal and the whole card lights up as if you picked it. The click keeps travelling upward!', mood: 'thinking' },
        { text: "Events in React bubble up through their parents, like echoes. Today you'll stop an echo and cancel something the browser wants to do on its own.", mood: 'happy' },
      ],
      lesson: md`
        ## Events bubble up

        When you click a button, the click doesn't stop there. It **bubbles** (or
        *propagates*) up through every parent element, and any parent with an \`onClick\`
        handler runs too:

        \`\`\`jsx
        <div className="crystal" onClick={() => console.log('crystal selected')}>
          <button onClick={() => console.log('blessed!')}>Bless</button>
        </div>
        // Clicking Bless logs "blessed!" and THEN "crystal selected"
        \`\`\`

        Often that's handy: a parent can react to clicks anywhere inside it. Sometimes it's
        a bug: blessing a crystal shouldn't also select it.

        ## The event object

        Every handler receives an **event object** as its first argument, usually named \`e\`:

        | property / method | what it does |
        |---|---|
        | \`e.target\` | the element the event started on (the innermost one clicked) |
        | \`e.currentTarget\` | the element whose handler is running right now |
        | \`e.stopPropagation()\` | stops the event from bubbling up to the parents |
        | \`e.preventDefault()\` | cancels the browser's built-in action |

        ## Stopping propagation

        \`\`\`jsx
        function handleBless(e) {
          e.stopPropagation(); // the card's onClick will not run
          setBlessings(blessings + 1);
        }
        \`\`\`

        Call it in the **inner** handler: the event travels from the button upward, so by
        the time a parent's handler runs, it has already arrived there.

        ## Preventing the default

        Some elements come with browser behaviour built in:

        - clicking a link \`<a href="...">\` navigates to it,
        - submitting a \`<form>\` sends it and **reloads the page**.

        \`e.preventDefault()\` cancels that, so your React code can handle it instead:

        \`\`\`jsx
        function handleSubmit(e) {
          e.preventDefault(); // no page reload
          setSent(true);
        }

        <form onSubmit={handleSubmit}>...</form>
        \`\`\`

        Routing libraries do exactly this for links: they call \`preventDefault\`, then
        show the new screen by changing state.

        ## Two different jobs

        \`stopPropagation()\` stops **the parents' handlers**. \`preventDefault()\` stops
        **the browser's default action**. Neither does the other's job; sometimes you need both.

        :::tip
        Instead of relying on bubbling, a child can call a handler prop (like the
        \`onSelect\` you wrote in the Spirit Gallery). That keeps the flow explicit and easy to follow.
        :::

        :::mistake
        Calling \`e.stopPropagation()\` in the **parent's** handler is too late — the event
        has already reached the parent. Stop it in the child, where the click started.
        :::
      `,
      task: md`
        ## 🎯 Tame the echoes

        The cavern holds three crystals. Clicking a \`.crystal\` card selects it, so \`<p className="selected">\` reads e.g. **Selected: Amethyst** (that part already works).

        1. Each card has a \`<button className="bless">\`. A click on it must add one blessing (\`<p className="blessings">\` reads **Blessings: 1**) **without** selecting the crystal. Use \`e.stopPropagation()\` in \`handleBless\`.
        2. The \`<a className="map-link" href="#map">\` must toggle the cave map: clicking it shows \`<div className="map">\`, clicking again hides it. Make \`showMap\` change in \`handleMapClick\`.
        3. In \`handleMapClick\`, call \`e.preventDefault()\` so the browser doesn't follow the link.
      `,
      starter: code`
        import { useState } from 'react';

        const crystals = [
          { id: 'ame', name: 'Amethyst', emoji: '💜' },
          { id: 'aqua', name: 'Aquamarine', emoji: '💎' },
          { id: 'jade', name: 'Jade', emoji: '💚' },
        ];

        export default function App() {
          const [selected, setSelected] = useState('none');
          const [blessings, setBlessings] = useState(0);
          const [showMap, setShowMap] = useState(false);

          function handleBless() {
            // TODO 1: stop this click from echoing up to the crystal card
            setBlessings(blessings + 1);
          }

          function handleMapClick() {
            // TODO 3: stop the browser from following the link
            // TODO 2: toggle the map
          }

          return (
            <div className="cavern">
              <p className="selected">Selected: {selected}</p>
              <p className="blessings">Blessings: {blessings}</p>
              <div className="crystals">
                {crystals.map((c) => (
                  <div
                    key={c.id}
                    className={selected === c.name ? 'crystal picked' : 'crystal'}
                    onClick={() => setSelected(c.name)}
                  >
                    <span className="gem">{c.emoji}</span>
                    <h3>{c.name}</h3>
                    <button className="bless" onClick={handleBless}>
                      ✨ Bless
                    </button>
                  </div>
                ))}
              </div>
              <a className="map-link" href="#map" onClick={handleMapClick}>
                🗺️ Cave map
              </a>
              {showMap && <div className="map">Entrance → 💜 → 💎 → 💚 → the deep spring ♨️</div>}
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const crystals = [
          { id: 'ame', name: 'Amethyst', emoji: '💜' },
          { id: 'aqua', name: 'Aquamarine', emoji: '💎' },
          { id: 'jade', name: 'Jade', emoji: '💚' },
        ];

        export default function App() {
          const [selected, setSelected] = useState('none');
          const [blessings, setBlessings] = useState(0);
          const [showMap, setShowMap] = useState(false);

          function handleBless(e) {
            e.stopPropagation();
            setBlessings(blessings + 1);
          }

          function handleMapClick(e) {
            e.preventDefault();
            setShowMap(!showMap);
          }

          return (
            <div className="cavern">
              <p className="selected">Selected: {selected}</p>
              <p className="blessings">Blessings: {blessings}</p>
              <div className="crystals">
                {crystals.map((c) => (
                  <div
                    key={c.id}
                    className={selected === c.name ? 'crystal picked' : 'crystal'}
                    onClick={() => setSelected(c.name)}
                  >
                    <span className="gem">{c.emoji}</span>
                    <h3>{c.name}</h3>
                    <button className="bless" onClick={handleBless}>
                      ✨ Bless
                    </button>
                  </div>
                ))}
              </div>
              <a className="map-link" href="#map" onClick={handleMapClick}>
                🗺️ Cave map
              </a>
              {showMap && <div className="map">Entrance → 💜 → 💎 → 💚 → the deep spring ♨️</div>}
            </div>
          );
        }
      `,
      hints: [
        md`Handlers receive the event object as their first parameter. Add it: \`function handleBless(e) { ... }\`.`,
        md`First line of \`handleBless\`: \`e.stopPropagation();\`. The card's \`onClick\` will no longer hear the click.`,
        md`\`handleMapClick(e)\` needs two lines: \`e.preventDefault();\` and \`setShowMap(!showMap);\`.`,
      ],
      tests: [
        test('Clicking a crystal card selects it', (t) => {
          t.render();
          t.click(t.$$('.crystal')[1]);
          const sel = textOf(t, '.selected');
          t.expect(sel === 'Selected: Aquamarine', `After clicking the Aquamarine card, .selected reads "${sel}" — expected "Selected: Aquamarine". Keep the card's onClick.`);
        }),
        test('✨ Bless adds a blessing without selecting the crystal', (t) => {
          t.render();
          t.click(t.$$('.crystal')[2].querySelector('.bless'));
          const bl = textOf(t, '.blessings');
          t.expect(bl === 'Blessings: 1', `After one blessing, .blessings reads "${bl}" — expected "Blessings: 1".`);
          const sel = textOf(t, '.selected');
          t.expect(
            sel === 'Selected: none',
            `Blessing Jade also selected it ("${sel}"): the click bubbled up to the .crystal card. Call e.stopPropagation() at the start of handleBless(e).`,
          );
          t.click(t.$$('.crystal')[0]);
          t.click(t.$$('.crystal')[1].querySelector('.bless'));
          t.expect(
            textOf(t, '.selected') === 'Selected: Amethyst' && textOf(t, '.blessings') === 'Blessings: 2',
            `Select Amethyst, then bless Aquamarine: expected "Selected: Amethyst" and "Blessings: 2", got "${textOf(t, '.selected')}" and "${textOf(t, '.blessings')}".`,
          );
        }),
        test('The map link toggles the cave map', (t) => {
          t.render();
          t.expect(!t.$('.map'), 'The cave map should be hidden at first.');
          t.click('.map-link');
          t.expect(t.$('.map'), 'Clicking the map link should show <div className="map">. In handleMapClick, call setShowMap(!showMap).');
          t.click('.map-link');
          t.expect(!t.$('.map'), 'Clicking the map link again should hide the map.');
        }),
        test("The map link cancels the browser's navigation", (t) => {
          t.render();
          const link = t.find('a.map-link');
          const event = new MouseEvent('click', { bubbles: true, cancelable: true });
          t.act(() => {
            link.dispatchEvent(event);
          });
          t.expect(
            event.defaultPrevented,
            'The browser would still follow the link to #map. Give handleMapClick the event parameter and call e.preventDefault() in it.',
          );
        }),
      ],
      concepts: [
        {
          id: 'springs-propagation',
          icon: '🫧',
          title: 'Event propagation',
          summary: 'Events bubble from the clicked element up through its parents; e.stopPropagation() stops them.',
          snippet: code`
            function handleBless(e) {
              e.stopPropagation(); // parents won't hear it
              setBlessings(blessings + 1);
            }
          `,
        },
        {
          id: 'springs-prevent-default',
          icon: '🛑',
          title: 'preventDefault',
          summary: "e.preventDefault() cancels the browser's built-in action, like following a link or reloading on submit.",
          snippet: code`
            <form onSubmit={(e) => {
              e.preventDefault();
              send();
            }}>
          `,
        },
      ],
      css: `
        .cavern { background: radial-gradient(circle at top, #3730a3, #0f172a); color: #e0e7ff; border-radius: 18px; padding: 14px; }
        .cavern h3 { color: #e0e7ff; margin: 4px 0; }
        .selected, .blessings { font-weight: 700; margin: 2px 0; }
        .crystals { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
        .crystal { flex: 1 1 120px; text-align: center; background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(165, 180, 252, 0.4); border-radius: 14px; padding: 10px; cursor: pointer; }
        .crystal:hover { border-color: #a5b4fc; }
        .crystal.picked { border-color: #fde68a; box-shadow: 0 0 14px rgba(253, 230, 138, 0.6); }
        .gem { font-size: 2em; display: block; }
        .bless { background: #a855f7; box-shadow: 0 3px 0 #7e22ce; }
        .map-link { color: #fde68a; font-weight: 700; display: inline-block; margin-top: 4px; }
        .map { margin-top: 8px; padding: 10px; background: #fef3c7; color: #78350f; border-radius: 10px; font-family: ui-monospace, monospace; }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'springs-trial',
      type: 'quiz',
      title: 'Trial of the Steam Oracle',
      blurb: 'Eight riddles in the steam. Prove you can think in snapshots.',
      xp: 100,
      story: [
        { text: 'The Steam Oracle speaks only in riddles about state. Answer well — and read every explanation, even for the ones you get right. The boss is listening.', mood: 'thinking' },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**. Tip: when in doubt, ask yourself *"what is the value in **this** render's snapshot?"*`,
      questions: [
        q(
          "What happens when this component renders?\n\n```jsx\nfunction Gong() {\n  function strike() {\n    console.log('BONG');\n  }\n  return <button onClick={strike()}>Strike</button>;\n}\n```",
          [
            'Nothing until the button is clicked; then it logs BONG',
            'BONG is logged right away during render, and clicking does nothing',
            'BONG is logged on render and again on every click',
            'React throws an error because onClick must be a string',
          ],
          1,
          '`strike()` **calls** the function while React renders, and its return value (`undefined`) becomes the click handler. Pass the function itself: `onClick={strike}`, or wrap it: `onClick={() => strike()}`.',
        ),
        q(
          'Why does this button always show 0?\n\n```jsx\nfunction Counter() {\n  let clicks = 0;\n  return (\n    <button onClick={() => { clicks = clicks + 1; }}>\n      {clicks}\n    </button>\n  );\n}\n```',
          [
            '`let` should be `const`',
            'Arrow functions cannot change variables from outside',
            'The button needs a `key`',
            "Changing a local variable doesn't trigger a re-render, and every render starts over with `let clicks = 0`",
          ],
          3,
          'Local variables don\'t survive between renders, and React has no idea they changed. `useState` fixes both: it keeps the value between renders, and its setter asks React to render again.',
        ),
        q(
          '`score` is `0`. What does the screen show after one click?\n\n```jsx\nfunction handleClick() {\n  setScore(score + 1);\n  setScore(score + 1);\n  setScore(score + 1);\n}\n```',
          ['`1`', '`3`', '`0`', 'It depends on how fast you click'],
          0,
          'In this render `score` is the constant `0`, so all three calls mean "set score to 1". Setting state doesn\'t change the variable you already have; it schedules a new render. With updaters — `setScore(s => s + 1)` three times — you would get `3`.',
        ),
        q(
          '`score` is `0`. What does the screen show after one click?\n\n```jsx\nfunction handleClick() {\n  setScore(score + 5);\n  setScore(s => s + 1);\n}\n```',
          ['`1`', '`5`', '`6`', '`11`'],
          2,
          'React queues both updates. `score + 5` is just the value `5` ("replace with 5"). Then the updater `s => s + 1` receives the queued result `5` and returns `6`.',
        ),
        q(
          '`count` is `0`. What gets logged when the button is clicked?\n\n```jsx\nfunction handleClick() {\n  setCount(count + 1);\n  console.log(count);\n}\n```',
          ['`1`', '`0`', '`undefined`', 'Nothing, because the component re-renders before the log runs'],
          1,
          "The setter doesn't touch `count` inside the running handler: this render's `count` is `0` forever. The *next* render will see `1`. And React waits for the whole handler to finish before re-rendering (batching).",
        ),
        q(
          "`App` renders `<Lantern />` twice. Each `Lantern` has `const [lit, setLit] = useState(false)` and a button that calls `setLit(true)`. You click the first lantern's button. What happens?",
          [
            'Both lanterns light up, because they share the same code',
            "Neither lights up: state doesn't work in components rendered twice",
            'Only the second lantern lights up',
            'Only the first lantern lights up',
          ],
          3,
          'State belongs to each component **instance**, each place it is rendered. Two `<Lantern />` elements get two independent `lit` values.',
        ),
        q(
          'A card has `onClick={selectCard}` and contains a Like button with `onClick={handleLike}`. Clicking Like also selects the card. What is the fix?',
          [
            'Call `e.preventDefault()` in `handleLike`',
            'Call `e.stopPropagation()` in `selectCard`',
            'Call `e.stopPropagation()` in `handleLike`',
            'Rename the button\'s `onClick` to `onclick`',
          ],
          2,
          "The click bubbles from the button up to the card, so it must be stopped in the **button's** handler while it's still on its way up. `preventDefault()` does something else: it cancels the browser's default action, like following a link.",
        ),
        q(
          'In React, what does "rendering" mean?',
          [
            'React calling your component function to find out what the UI should look like',
            'The browser painting pixels on the screen',
            "React replacing the whole page's HTML with brand-new HTML",
            'Saving the current state to a server',
          ],
          0,
          'A setter call **triggers** a render. During the **render**, React calls your component to get fresh JSX. In the **commit**, React updates only the DOM nodes that actually changed. Painting comes after that, done by the browser.',
        ),
      ],
      concepts: [
        {
          id: 'springs-thinking-snapshots',
          icon: '🧭',
          title: 'Thinking in snapshots',
          summary: 'Each render sees its own fixed props and state; handlers created in that render see those values.',
          detail: 'To predict what a handler does, ask: what are the values in this render? Setters schedule the next render; they never change the current one.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'springs-boss',
      type: 'build',
      boss: true,
      title: 'Boss: The Stale Snapshot',
      bossName: 'The Stale Snapshot',
      bossIcon: '👻',
      blurb: 'A ghost who lives one render in the past. Build the battle and land the Triple Strike.',
      xp: 300,
      badge: {
        id: 'badge-springs',
        name: 'Snapshot Slayer',
        icon: '📸',
        description: 'Defeated the Stale Snapshot in the State Springs.',
      },
      story: [
        { text: 'The steam thickens... There! The Stale Snapshot, a ghost who lives one render in the past. Every attack that reads old state passes right through him.', mood: 'worried' },
        { text: 'Build the battle yourself: HP bars, attacks, potions. His weakness is the Triple Strike — but it only lands if you use updater functions!', mood: 'excited' },
        { text: "Take a deep breath. Everything you need, you learned in these springs. Let's send him into the past for good.", mood: 'happy' },
      ],
      lesson: md`
        ## Everything from the Springs

        | Skill | Example |
        |---|---|
        | Event handlers | \`<button onClick={handleAttack}>\` |
        | State | \`const [bossHp, setBossHp] = useState(100);\` |
        | Several state variables | \`bossHp\`, \`heroHp\`, \`potions\` |
        | Updater functions | \`setBossHp((hp) => hp - 10)\` |
        | Disabled from state | \`disabled={potions === 0}\` |
        | Conditional rendering | \`{isOver && <h2 className="result">...</h2>}\` |

        ## Clamping numbers

        HP should never drop below 0 or rise above 100. \`Math.max\` picks the bigger
        number and \`Math.min\` the smaller one:

        \`\`\`js
        Math.max(0, 15 - 20);   // 0
        Math.min(100, 90 + 30); // 100
        \`\`\`

        They fit right inside an updater: \`setHeroHp((hp) => Math.max(0, hp - 20))\`.

        ## UI is a function of state

        You never "switch on" the victory banner or "disable" a button by hand. Everything
        on screen is **calculated from state during render**:

        \`\`\`jsx
        const isOver = bossHp === 0 || heroHp === 0;

        <button className="attack" onClick={handleAttack} disabled={isOver}>⚔️ Attack</button>
        {isOver && <h2 className="result">{bossHp === 0 ? '🏆 Victory!' : '💀 Defeat...'}</h2>}
        \`\`\`

        Change the state, and React re-renders everything that depends on it.

        ## A bar that follows a number

        A style object can be computed, too: \`style={{ width: hp + '%' }}\` turns \`70\`
        into \`'70%'\`, so the bar shrinks as the fighter gets hurt.

        :::warn
        Triple Strike calls \`strike()\` three times in **one** event. If \`strike\` uses
        \`setBossHp(bossHp - 10)\`, all three read the same snapshot and only one hit lands.
        That is the Stale Snapshot's whole trick. Use the updater form!
        :::

        :::tip
        Build it in small steps and press **✓ Check quest** often. The objective list
        tells you which parts already work.
        :::
      `,
      task: md`
        ## 👑 Defeat the Stale Snapshot

        The arena is drawn, but nothing fights back yet. Make it work:

        1. Turn \`bossHp\` (100), \`heroHp\` (100) and \`potions\` (2) into **state**. The texts read **Boss HP: 100**, **Hero HP: 100** and **Potions: 2**.
        2. In \`HpBar\`, make the \`.hp-fill\` width follow the HP in percent: \`style={{ width: hp + '%' }}\`.
        3. **⚔️ Attack** calls \`strike()\` once (the boss loses **10**), then \`bossStrikesBack()\` (the hero loses **20**).
        4. **🌀 Triple Strike** calls \`strike()\` **three times** (the boss loses **30** in one click), then the boss strikes back once.
        5. **🧪 Potion** heals the hero by **30**, but never above **100**, and uses up one potion. The button is \`disabled\` when no potions are left.
        6. HP never drops below **0**. When the boss reaches 0, show \`<h2 className="result">\` containing **Victory**. When the hero reaches 0, it contains **Defeat**. Once the battle is over, all three action buttons are \`disabled\`.
      `,
      starter: code`
        import { useState } from 'react';

        function HpBar({ hp }) {
          // TODO 2: the fill's width should be the HP in percent, e.g. '70%'
          return (
            <div className="hp-bar">
              <div className="hp-fill" style={{ width: '100%' }} />
            </div>
          );
        }

        export default function App() {
          // TODO 1: make these three values state
          const bossHp = 100;
          const heroHp = 100;
          const potions = 2;

          // TODO 6: the battle is over when either HP reaches 0
          const isOver = false;

          function strike() {
            // TODO 3: the boss loses 10 HP (never below 0). Use an updater function!
          }

          function bossStrikesBack() {
            // TODO 3: the hero loses 20 HP (never below 0)
          }

          function handleAttack() {
            strike();
            bossStrikesBack();
          }

          function handleTripleStrike() {
            // TODO 4: strike three times, then the boss strikes back once
          }

          function handlePotion() {
            // TODO 5: heal 30 HP (max 100) and use up one potion
          }

          return (
            <div className="arena">
              <section className="fighter boss">
                <div className="avatar">👻</div>
                <h2>The Stale Snapshot</h2>
                <p className="taunt">"Hit me three times? You'll only ever hit the past..."</p>
                <p className="hp-text">Boss HP: {bossHp}</p>
                <HpBar hp={bossHp} />
              </section>

              <section className="fighter hero">
                <div className="avatar">🧙</div>
                <h2>You, the Render Mage</h2>
                <p className="hp-text">Hero HP: {heroHp}</p>
                <HpBar hp={heroHp} />
                <p className="potions">Potions: {potions}</p>
              </section>

              {/* TODO 6: show <h2 className="result">...</h2> when the battle is over */}

              <div className="actions">
                <button className="attack" onClick={handleAttack}>
                  ⚔️ Attack
                </button>
                <button className="triple" onClick={handleTripleStrike}>
                  🌀 Triple Strike
                </button>
                <button className="potion" onClick={handlePotion}>
                  🧪 Potion
                </button>
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        function HpBar({ hp }) {
          return (
            <div className="hp-bar">
              <div className="hp-fill" style={{ width: hp + '%' }} />
            </div>
          );
        }

        export default function App() {
          const [bossHp, setBossHp] = useState(100);
          const [heroHp, setHeroHp] = useState(100);
          const [potions, setPotions] = useState(2);

          const isOver = bossHp === 0 || heroHp === 0;

          function strike() {
            setBossHp((hp) => Math.max(0, hp - 10));
          }

          function bossStrikesBack() {
            setHeroHp((hp) => Math.max(0, hp - 20));
          }

          function handleAttack() {
            strike();
            bossStrikesBack();
          }

          function handleTripleStrike() {
            strike();
            strike();
            strike();
            bossStrikesBack();
          }

          function handlePotion() {
            setHeroHp((hp) => Math.min(100, hp + 30));
            setPotions(potions - 1);
          }

          return (
            <div className="arena">
              <section className="fighter boss">
                <div className="avatar">👻</div>
                <h2>The Stale Snapshot</h2>
                <p className="taunt">"Hit me three times? You'll only ever hit the past..."</p>
                <p className="hp-text">Boss HP: {bossHp}</p>
                <HpBar hp={bossHp} />
              </section>

              <section className="fighter hero">
                <div className="avatar">🧙</div>
                <h2>You, the Render Mage</h2>
                <p className="hp-text">Hero HP: {heroHp}</p>
                <HpBar hp={heroHp} />
                <p className="potions">Potions: {potions}</p>
              </section>

              {isOver && (
                <h2 className="result">
                  {bossHp === 0 ? '🏆 Victory! The Stale Snapshot fades away.' : '💀 Defeat... frozen in the past.'}
                </h2>
              )}

              <div className="actions">
                <button className="attack" onClick={handleAttack} disabled={isOver}>
                  ⚔️ Attack
                </button>
                <button className="triple" onClick={handleTripleStrike} disabled={isOver}>
                  🌀 Triple Strike
                </button>
                <button className="potion" onClick={handlePotion} disabled={isOver || potions === 0}>
                  🧪 Potion
                </button>
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Start with state: \`const [bossHp, setBossHp] = useState(100);\` and the same for \`heroHp\` and \`potions\`. Then \`HpBar\` gets \`style={{ width: hp + '%' }}\`.`,
        md`\`strike\` is \`setBossHp((hp) => Math.max(0, hp - 10));\` and \`bossStrikesBack\` is \`setHeroHp((hp) => Math.max(0, hp - 20));\`. Triple Strike: three \`strike();\` calls, then \`bossStrikesBack();\`.`,
        md`Potion: \`setHeroHp((hp) => Math.min(100, hp + 30)); setPotions(potions - 1);\`. Then \`const isOver = bossHp === 0 || heroHp === 0;\`, \`disabled={isOver}\` on the actions (\`disabled={isOver || potions === 0}\` on the potion) and \`{isOver && <h2 className="result">{bossHp === 0 ? 'Victory!' : 'Defeat...'}</h2>}\`.`,
      ],
      tests: [
        test('The battle starts at full strength', (t) => {
          t.render();
          t.expect(textOf(t, '.boss .hp-text') === 'Boss HP: 100', `The boss's .hp-text reads "${textOf(t, '.boss .hp-text')}" — expected "Boss HP: 100".`);
          t.expect(textOf(t, '.hero .hp-text') === 'Hero HP: 100', `The hero's .hp-text reads "${textOf(t, '.hero .hp-text')}" — expected "Hero HP: 100".`);
          t.expect(textOf(t, '.potions') === 'Potions: 2', `The .potions text reads "${textOf(t, '.potions')}" — expected "Potions: 2".`);
          t.expect(!t.$('.result'), 'No .result should be shown before the battle is over.');
          const widths = t.$$('.hp-fill').map((el) => el.style.width);
          t.expect(widths.length === 2 && widths.every((w) => w === '100%'), `The two .hp-fill bars should start at width 100% (found: ${widths.join(', ') || 'none'}).`);
        }),
        test('⚔️ Attack: the boss loses 10, then hits back for 20', (t) => {
          t.render();
          t.click('.attack');
          const boss = textOf(t, '.boss .hp-text');
          const hero = textOf(t, '.hero .hp-text');
          t.expect(boss === 'Boss HP: 90', `After one attack the boss shows "${boss}" — expected "Boss HP: 90". Make bossHp state and have strike() call setBossHp((hp) => Math.max(0, hp - 10)).`);
          t.expect(hero === 'Hero HP: 80', `After one attack the hero shows "${hero}" — expected "Hero HP: 80". bossStrikesBack() should call setHeroHp((hp) => Math.max(0, hp - 20)).`);
          const [bossBar, heroBar] = t.$$('.hp-fill').map((el) => el.style.width);
          t.expect(
            bossBar === '90%' && heroBar === '80%',
            `The bars are ${bossBar} and ${heroBar} wide — expected 90% and 80%. In HpBar use style={{ width: hp + '%' }}.`,
          );
        }),
        test('🌀 Triple Strike lands all three hits', (t) => {
          t.render();
          t.click('.triple');
          const boss = textOf(t, '.boss .hp-text');
          t.expect(
            boss === 'Boss HP: 70',
            boss === 'Boss HP: 90'
              ? 'Only one of the three strikes landed ("Boss HP: 90"): the Stale Snapshot dodged the others! All three strike() calls read the same bossHp. Use an updater in strike(): setBossHp((hp) => Math.max(0, hp - 10)).'
              : `After a Triple Strike the boss shows "${boss}" — expected "Boss HP: 70". handleTripleStrike should call strike() three times, then bossStrikesBack() once.`,
          );
          const hero = textOf(t, '.hero .hp-text');
          t.expect(hero === 'Hero HP: 80', `After a Triple Strike the hero shows "${hero}" — expected "Hero HP: 80" (the boss strikes back once).`);
          t.sourceIncludes(
            /strike\(\)\s*;?\s*strike\(\)\s*;?\s*strike\(\)/,
            'handleTripleStrike must really strike three times: call strike(); strike(); strike(); — that is what makes it a test of updater functions.',
          );
        }),
        test('🧪 Potions heal 30, never above 100, and run out', (t) => {
          t.render();
          t.click('.attack');
          t.click('.attack');
          t.click('.potion');
          let hero = textOf(t, '.hero .hp-text');
          t.expect(hero === 'Hero HP: 90', `Two attacks (60 HP) and a potion should give "Hero HP: 90", but the hero shows "${hero}". The potion heals 30: setHeroHp((hp) => Math.min(100, hp + 30)).`);
          t.expect(textOf(t, '.potions') === 'Potions: 1', `After one potion, .potions reads "${textOf(t, '.potions')}" — expected "Potions: 1".`);
          t.click('.potion');
          hero = textOf(t, '.hero .hp-text');
          t.expect(hero === 'Hero HP: 100', `Healing 30 from 90 must stop at 100, but the hero shows "${hero}". Clamp it: Math.min(100, hp + 30).`);
          t.expect(textOf(t, '.potions') === 'Potions: 0', `After two potions, .potions reads "${textOf(t, '.potions')}" — expected "Potions: 0".`);
          t.expect(t.find('.potion').disabled, 'With no potions left, the potion button should be disabled: disabled={potions === 0}.');
        }),
        test('The battle ends in Victory or Defeat, and the buttons lock', (t) => {
          t.render();
          for (let i = 0; i < 4; i++) t.click('.triple');
          const boss = textOf(t, '.boss .hp-text');
          const left = Number(boss.replace(/[^\d-]/g, ''));
          t.expect(
            boss === 'Boss HP: 0',
            left < 0
              ? `After four Triple Strikes the boss shows "${boss}". HP must never go below 0: setBossHp((hp) => Math.max(0, hp - 10)).`
              : `Four Triple Strikes should defeat the boss (100 → 70 → 40 → 10 → 0), but he shows "${boss}". Make sure every strike lands (updater functions!) and clamp with Math.max(0, ...).`,
          );
          const win = t.$('.result');
          t.expect(win && norm(win.textContent).includes('Victory'), 'When the boss reaches 0 HP, show <h2 className="result"> containing "Victory".');
          t.expect(
            ['.attack', '.triple', '.potion'].every((sel) => t.find(sel).disabled),
            'Once the battle is over, the Attack, Triple Strike and Potion buttons should all be disabled: disabled={isOver}.',
          );
          t.expect(t.$$('.hp-fill')[0].style.width === '0%', "At 0 HP the boss's bar should be 0% wide.");

          t.unmount();
          t.render();
          for (let i = 0; i < 5; i++) t.click('.attack');
          const hero = textOf(t, '.hero .hp-text');
          t.expect(hero === 'Hero HP: 0', `After five attacks the hero shows "${hero}" — expected "Hero HP: 0" (five counter-hits of 20).`);
          const loss = t.$('.result');
          t.expect(loss && norm(loss.textContent).includes('Defeat'), 'When the hero reaches 0 HP, show <h2 className="result"> containing "Defeat".');
          t.expect(t.find('.attack').disabled, 'After a defeat the action buttons should be disabled too.');
        }),
      ],
      concepts: [
        {
          id: 'springs-state-drives-ui',
          icon: '🎮',
          title: 'UI is a function of state',
          summary: 'Bars, texts, banners and disabled buttons are all calculated from state during render.',
          snippet: code`
            const isOver = bossHp === 0 || heroHp === 0;
            <button disabled={isOver}>⚔️ Attack</button>
          `,
          detail: 'Never toggle things on screen by hand. Change the state, and let React re-render everything that depends on it.',
        },
      ],
      css: `
        .arena { background: linear-gradient(#1e1b4b, #4c1d95); color: #ede9fe; border-radius: 18px; padding: 14px; }
        .arena h2 { color: #f5f3ff; }
        .fighter { background: rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 10px 12px; margin: 8px 0; overflow: hidden; }
        .avatar { font-size: 2.4em; float: right; }
        .taunt { font-style: italic; color: #c4b5fd; }
        .hp-text { font-weight: 800; margin: 4px 0; }
        .hp-bar { height: 14px; background: rgba(0, 0, 0, 0.35); border-radius: 7px; overflow: hidden; }
        .hp-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #a3e635); transition: width 0.35s; }
        .boss .hp-fill { background: linear-gradient(90deg, #f43f5e, #fb923c); }
        .potions { margin: 6px 0 0; }
        .result { text-align: center; color: #fde68a; }
        .actions { text-align: center; margin-top: 8px; }
      `,
    },
  ],
};
