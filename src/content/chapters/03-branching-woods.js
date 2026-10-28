import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Check helpers (shared by the quests below)
// ---------------------------------------------------------------------------

/** Collapse whitespace and drop emoji variation selectors, so "❄️" matches "❄". */
const norm = (s) =>
  String(s ?? '')
    .replace(/️/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Short, readable version of some rendered HTML/text for failure messages. */
const clip = (s, n = 110) => {
  const str = norm(s);
  if (!str) return 'nothing';
  return str.length > n ? `${str.slice(0, n)}…` : str;
};

/** Returns the player's named export `name`, or fails with a friendly message. */
function exported(t, name, how) {
  const C = t.exports && t.exports[name];
  if (typeof C !== 'function') t.fail(`No exported component named ${name} was found. ${how}`);
  return C;
}

/** Text of the first element matching `sel` (normalized), or '' if it is missing. */
const textOf = (t, sel) => {
  const el = t.$(sel);
  return el ? norm(el.textContent) : '';
};

/** The first element matching `selector` whose text contains `name` (or null). */
const rowWith = (t, selector, name) => t.$$(selector).find((el) => norm(el.textContent).includes(name)) || null;

/** For every element matching `selector`, which of `names` it shows ('?' if none). */
const namesIn = (t, selector, names) =>
  t.$$(selector).map((el) => names.find((n) => norm(el.textContent).includes(n)) || '?');

/** Which of `names` the element shows (or 'nothing'). */
const nameIn = (el, names) => (el && names.find((n) => norm(el.textContent).includes(n))) || 'nothing';

const trav = (id, name) => ({ id, name });
const shroom = (id, name, price, poisonous = false, tags = ['🧪 test']) => ({ id, name, price, poisonous, tags });
const gob = (id, name, power, extra = {}) => ({ id, name, power, awake: true, chief: false, loot: 0, ...extra });

export default {
  id: 'branching-woods',
  file: '03-branching-woods.js',
  title: 'Branching Woods',
  short: 'Lists',
  subtitle: 'Paths that fork and trails that never end: conditional rendering, lists and keys.',
  icon: '🌲',
  colors: ['#052e16', '#22c55e'],
  scenery: ['🌲', '🍄', '🦉', '🌿', '🍂', '🦊', '🪵', '✨'],
  intro: [
    { text: 'Welcome to the Branching Woods! Every path in here forks: show this, show that... or show nothing at all.', mood: 'happy' },
    { text: 'And the trails go on forever. Rows of travellers, baskets of mushrooms, swarms of fireflies: you will learn to turn whole arrays into lists with a single map().', mood: 'excited' },
    { text: 'Stay close, though. The Keyless Horde roams these trees. Without keys, React cannot tell one goblin from another...', mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'woods-owl-gate',
      type: 'code',
      title: "The Owl's Gate",
      blurb: 'Teach the gate to branch with if, early returns, null and a ternary.',
      xp: 110,
      story: [
        { text: "Hootsworth the owl guards the gate into the woods. He should greet each traveller properly, but the Mutator scrambled him: now he says the same thing to everyone!", mood: 'worried' },
        { text: 'A component can make decisions before it returns. Teach the gate to branch: frozen travellers, lantern bearers and empty paths each deserve their own answer.', mood: 'happy' },
      ],
      lesson: md`
        ## Components can make decisions

        A component is a function, so it can use plain JavaScript \`if\` statements to decide
        **what to return**. Showing different things in different situations is called
        **conditional rendering**.

        \`\`\`jsx
        function Gate({ traveler }) {
          if (traveler.frozen) {
            return <p className="frozen">❄️ {traveler.name} is frozen!</p>;
          }
          return <h3>Welcome, {traveler.name}!</h3>;
        }
        \`\`\`

        The moment a \`return\` runs, the function stops, so a frozen traveller never reaches
        the welcome. Handling the special cases first and leaving early is called an
        **early return** (or a *guard clause*). It keeps the main JSX at the bottom simple.

        ## Rendering nothing: return null

        Sometimes the right answer is *nothing at all*. Return \`null\`:

        \`\`\`jsx
        function Gate({ traveler }) {
          if (!traveler) {
            return null;   // nobody on the path: render nothing
          }
          // from here on, traveler definitely exists
          return <h3>Welcome, {traveler.name}!</h3>;
        }
        \`\`\`

        Order matters: the guard runs *before* anything reads \`traveler.name\`. Without it,
        \`traveler.name\` would crash with "Cannot read properties of undefined".

        ## The ternary: if/else inside JSX

        You can't put an \`if\` statement inside \`{ }\`, because braces want an *expression*.
        JavaScript's **conditional operator** \`condition ? a : b\` is an expression, so it fits:

        \`\`\`jsx
        <div className="welcome">
          <h3>Welcome, {traveler.name}!</h3>
          {traveler.hasLantern ? (
            <p className="lantern">🏮 Lantern lit</p>
          ) : (
            <p className="dark">🌑 Too dark to pass</p>
          )}
        </div>
        \`\`\`

        Read it as: "does the traveller have a lantern? *Then* this, *otherwise* that".
        Ternaries can also pick plain values: \`className={lit ? 'lamp on' : 'lamp off'}\`.

        :::tip
        **Which one when?** Use \`if\` with an early \`return\` when a whole different result
        should appear. Use a ternary when only a small *part* of the JSX changes.
        :::

        :::mistake
        \`{if (traveler.hasLantern) { ... }}\` is a syntax error: \`if\` is a statement, not an
        expression. Move the \`if\` above the \`return\`, or use a ternary.
        :::

        :::pro
        Ternaries can be nested (\`a ? x : b ? y : z\`), but they get hard to read fast. With
        three or more branches, prefer \`if\` statements or split the JSX into small components.
        :::
      `,
      task: md`
        ## 🎯 Teach the gate to branch

        Make \`Gate\` answer differently depending on its \`traveler\` prop:

        1. **Nobody there:** if \`traveler\` is missing, return \`null\` so nothing renders.
        2. **Frozen traveller:** if \`traveler.frozen\` is true, return early with only a \`<p className="frozen">\` saying **❄️ NAME is frozen by the Mutator!**
        3. **Everyone else** gets the \`<div className="welcome">\` with its \`<h3>\` **Welcome, NAME!** (already written).
        4. Inside the welcome, below the \`<h3>\`, add a **ternary**: travellers with \`hasLantern\` get \`<p className="lantern">\` **🏮 Lantern lit**, all others get \`<p className="dark">\` **🌑 Too dark to pass**.

        :::try
        Once step 1 works, add an empty \`<Gate />\` to \`App\`. It should render nothing, and nothing crashes.
        :::
      `,
      starter: code`
        export function Gate({ traveler }) {
          // TODO 1: no traveler? Render nothing.
          // TODO 2: a frozen traveler? Return early with the frozen message.

          return (
            <div className="welcome">
              <h3>Welcome, {traveler.name}!</h3>
              {/* TODO 4: a ternary that picks the lantern or the dark message */}
            </div>
          );
        }

        export default function App() {
          return (
            <main className="gate">
              <h2>🦉 Hootsworth's Gate</h2>
              <Gate traveler={{ name: 'Ada', hasLantern: true }} />
              <Gate traveler={{ name: 'Linus', hasLantern: false }} />
              <Gate traveler={{ name: 'Grace', frozen: true }} />
            </main>
          );
        }
      `,
      solution: code`
        export function Gate({ traveler }) {
          if (!traveler) {
            return null;
          }
          if (traveler.frozen) {
            return <p className="frozen">❄️ {traveler.name} is frozen by the Mutator!</p>;
          }
          return (
            <div className="welcome">
              <h3>Welcome, {traveler.name}!</h3>
              {traveler.hasLantern ? (
                <p className="lantern">🏮 Lantern lit</p>
              ) : (
                <p className="dark">🌑 Too dark to pass</p>
              )}
            </div>
          );
        }

        export default function App() {
          return (
            <main className="gate">
              <h2>🦉 Hootsworth's Gate</h2>
              <Gate traveler={{ name: 'Ada', hasLantern: true }} />
              <Gate traveler={{ name: 'Linus', hasLantern: false }} />
              <Gate traveler={{ name: 'Grace', frozen: true }} />
              <Gate />
            </main>
          );
        }
      `,
      hints: [
        md`An \`if\` goes **before** the main \`return\`: \`if (!traveler) { return null; }\`. When a \`return\` runs, the function stops right there.`,
        md`The frozen check comes next: \`if (traveler.frozen) { return <p className="frozen">❄️ {traveler.name} is frozen by the Mutator!</p>; }\``,
        md`
          Inside the welcome \`<div>\`, under the \`<h3>\`:

          \`\`\`jsx
          {traveler.hasLantern ? (
            <p className="lantern">🏮 Lantern lit</p>
          ) : (
            <p className="dark">🌑 Too dark to pass</p>
          )}
          \`\`\`
        `,
      ],
      tests: [
        test('No traveller: Gate renders nothing (null)', (t) => {
          const Gate = exported(t, 'Gate', 'Keep "export function Gate({ traveler })" in your code.');
          try {
            t.renderComponent(Gate, {});
          } catch {
            t.fail('Gate crashed when it got no traveler: traveler is undefined, so traveler.name blows up. Start Gate with: if (!traveler) { return null; }');
          }
          t.expect(t.container.innerHTML === '', `With no traveler, Gate should render nothing, but it rendered: ${clip(t.html())}. Return null.`);
        }),
        test('Frozen travellers get an early return with only the frozen message', (t) => {
          const Gate = exported(t, 'Gate', 'Keep "export function Gate({ traveler })" in your code.');
          t.renderComponent(Gate, { traveler: { name: 'Testa', frozen: true } });
          const p = t.$('p.frozen');
          t.expect(p, `A frozen traveller got ${clip(t.html())}. Expected <p className="frozen">: add if (traveler.frozen) { return ...; } before the main return.`);
          const text = norm(p.textContent);
          t.expect(text === norm('❄️ Testa is frozen by the Mutator!'), `The frozen message says "${text}". Expected "❄️ Testa is frozen by the Mutator!".`);
          t.expect(!t.$('.welcome'), 'Frozen travellers should ONLY see the frozen message. Return early, so the welcome <div> is never reached.');
        }),
        test('Lantern bearers see "🏮 Lantern lit" in the welcome', (t) => {
          const Gate = exported(t, 'Gate', 'Keep "export function Gate({ traveler })" in your code.');
          t.renderComponent(Gate, { traveler: { name: 'Testa', hasLantern: true } });
          const heading = textOf(t, '.welcome h3');
          t.expect(heading === 'Welcome, Testa!', `The welcome heading says "${heading || 'nothing'}". Expected "Welcome, Testa!".`);
          const lit = t.$('.welcome .lantern');
          t.expect(lit, 'A traveller with hasLantern: true should see <p className="lantern">🏮 Lantern lit</p> inside the welcome <div>.');
          t.expect(norm(lit.textContent) === norm('🏮 Lantern lit'), `The lantern line says "${norm(lit.textContent)}". Expected "🏮 Lantern lit".`);
          t.expect(!t.$('.dark'), 'A lantern bearer should not also see the dark message. Use a ternary: cond ? <A /> : <B />.');
        }),
        test('Travellers without a lantern see "🌑 Too dark to pass"', (t) => {
          const Gate = exported(t, 'Gate', 'Keep "export function Gate({ traveler })" in your code.');
          t.renderComponent(Gate, { traveler: { name: 'Testa', hasLantern: false } });
          const dark = t.$('.welcome .dark');
          t.expect(dark, 'A traveller without a lantern should see <p className="dark">🌑 Too dark to pass</p> inside the welcome <div>.');
          t.expect(norm(dark.textContent) === norm('🌑 Too dark to pass'), `The dark line says "${norm(dark.textContent)}". Expected "🌑 Too dark to pass".`);
          t.expect(!t.$('.lantern'), 'Without a lantern, the 🏮 Lantern lit line must not appear.');
        }),
      ],
      concepts: [
        {
          id: 'woods-early-return',
          icon: '🚪',
          title: 'if and early return',
          summary: 'Use if statements before the return to pick completely different JSX.',
          snippet: code`
            function Gate({ traveler }) {
              if (traveler.frozen) {
                return <p>❄️ Frozen!</p>;
              }
              return <h3>Welcome!</h3>;
            }
          `,
          detail: 'Handle special cases first and return early; the main JSX stays simple.',
        },
        {
          id: 'woods-null',
          icon: '🫥',
          title: 'Rendering nothing',
          summary: 'return null to render nothing at all.',
          snippet: code`
            if (!traveler) {
              return null;
            }
          `,
          detail: 'Inside JSX, null, undefined, false and true render nothing too.',
        },
        {
          id: 'woods-ternary',
          icon: '🔀',
          title: 'Ternary in JSX',
          summary: '{cond ? <A /> : <B />}: an if/else that fits inside braces.',
          snippet: code`
            {hasLantern ? <p>🏮 Lit</p> : <p>🌑 Dark</p>}
          `,
        },
      ],
      css: `
        .gate { background: linear-gradient(#14532d, #052e16); color: #ecfccb; border-radius: 16px; padding: 14px 18px; }
        .gate h2 { color: #bef264; }
        .welcome { background: rgba(255, 255, 255, 0.08); border-left: 4px solid #84cc16; border-radius: 8px; padding: 6px 12px; margin: 8px 0; }
        .welcome h3 { color: #f7fee7; margin: 0; }
        .lantern { color: #fde047; }
        .dark { color: #94a3b8; }
        .frozen { background: #e0f2fe; color: #075985; border-radius: 8px; padding: 6px 12px; font-weight: 600; }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'woods-firefly-camp',
      type: 'code',
      title: 'The Firefly Camp',
      blurb: 'Show it or not with &&, and banish the ghostly stray 0.',
      xp: 120,
      story: [
        { text: "Ranger Fern's camp board shows notices: night falls, fireflies arrive, wolves prowl. On most nights, most of them shouldn't appear at all.", mood: 'happy' },
        { text: "And something spooky is going on at Sunny Glade: a lonely 0 floats on the board. Nobody wrote it. Let's find out who did!", mood: 'thinking' },
      ],
      lesson: md`
        ## Show it... or not: &&

        Often you don't need an *else*: you want something to appear **only if** a condition
        is true. JavaScript's \`&&\` operator does exactly that inside JSX:

        \`\`\`jsx
        {isNight && <p className="moon">🌙 Night has fallen</p>}
        \`\`\`

        How it works: \`a && b\` gives back \`a\` if \`a\` is falsy, otherwise it gives back \`b\`.

        - \`isNight\` is \`true\`: the expression becomes the \`<p>\`, so it renders.
        - \`isNight\` is \`false\`: the expression becomes \`false\`, and React renders nothing for \`false\`.

        ## The ghost of the stray 0

        React renders nothing for \`false\`, \`null\`, \`undefined\` and \`true\`... but it **does**
        render numbers, including \`0\`!

        \`\`\`jsx
        // fireflies is 0
        {fireflies && <p>✨ {fireflies} fireflies</p>}
        \`\`\`

        \`0\` is falsy, so \`0 && ...\` gives back \`0\`, and React happily prints a lonely
        **0** on the screen. 👻 Fix it by making the left side a real **boolean**:

        \`\`\`jsx
        {fireflies > 0 && <p>✨ {fireflies} fireflies</p>}   // ✅
        {items.length > 0 && <ItemList items={items} />}    // ✅
        \`\`\`

        (\`!!fireflies && ...\` or a ternary \`fireflies ? ... : null\` work too, but \`> 0\` says
        exactly what you mean.)

        :::mistake
        \`{items.length && <List />}\` is the most famous version of this bug: an empty list
        shows a **0** instead of nothing.
        :::

        ## Strings are safe

        An empty string \`''\` is falsy as well, and React renders an empty string as...
        nothing. So \`{warning && <p>⚠️ {warning}</p>}\` is fine for strings. Only numbers are sneaky.

        ## Pick the right tool

        | You want... | Use |
        |---|---|
        | a completely different result | \`if\` + early \`return\` |
        | this **or** that | a ternary \`cond ? a : b\` |
        | this **or nothing** | \`cond && a\`, with a boolean on the left |
        | nothing at all | \`return null\` |

        :::tip
        JSX can live in variables too: \`let notice = null; if (danger) notice = <p>⚠️ Run!</p>;\`
        and then \`{notice}\` in the returned JSX. Handy when the logic gets long.
        :::
      `,
      task: md`
        ## 🎯 Fix the camp board

        \`Camp\` receives \`name\`, \`isNight\` (a boolean), \`fireflies\` (a number) and \`warning\` (a string that may be empty). Use \`&&\` for all three notices:

        1. Show \`<p className="moon">\` **🌙 Night has fallen** only when \`isNight\` is true.
        2. Show \`<p className="fireflies">\` **✨ N fireflies** only when there is **at least one** firefly. With 0 fireflies nothing about fireflies may appear, not even a stray **0**!
        3. Show \`<p className="warning">\` **⚠️ WARNING** (the warning text) only when \`warning\` is not empty.

        The firefly line in the starter is haunted. Exorcise it!
      `,
      starter: code`
        export function Camp({ name, isNight, fireflies, warning }) {
          return (
            <section className="camp">
              <h3>⛺ {name}</h3>
              {/* TODO 1: the moon notice, only at night */}

              {/* 👻 Something is haunting this line... */}
              {fireflies && <p className="fireflies">✨ {fireflies} fireflies</p>}

              {/* TODO 3: the warning, only when there is one */}
            </section>
          );
        }

        export default function App() {
          return (
            <main className="camps">
              <Camp name="Mossy Hollow" isNight={true} fireflies={12} warning="Wolves nearby" />
              <Camp name="Sunny Glade" isNight={false} fireflies={0} warning="" />
            </main>
          );
        }
      `,
      solution: code`
        export function Camp({ name, isNight, fireflies, warning }) {
          return (
            <section className="camp">
              <h3>⛺ {name}</h3>
              {isNight && <p className="moon">🌙 Night has fallen</p>}
              {fireflies > 0 && <p className="fireflies">✨ {fireflies} fireflies</p>}
              {warning && <p className="warning">⚠️ {warning}</p>}
            </section>
          );
        }

        export default function App() {
          return (
            <main className="camps">
              <Camp name="Mossy Hollow" isNight={true} fireflies={12} warning="Wolves nearby" />
              <Camp name="Sunny Glade" isNight={false} fireflies={0} warning="" />
            </main>
          );
        }
      `,
      hints: [
        md`\`{isNight && <p className="moon">🌙 Night has fallen</p>}\`: when \`isNight\` is false, the whole expression is \`false\` and React shows nothing.`,
        md`The ghostly 0 comes from \`{fireflies && ...}\`: when \`fireflies\` is \`0\`, the expression *is* \`0\`, and React renders numbers. Make the left side a real boolean: \`fireflies > 0 && ...\`.`,
        md`An empty string is falsy and renders nothing, so this one is safe: \`{warning && <p className="warning">⚠️ {warning}</p>}\`.`,
      ],
      tests: [
        test('The moon notice appears only at night', (t) => {
          const Camp = exported(t, 'Camp', 'Keep "export function Camp(...)" in your code.');
          t.renderComponent(Camp, { name: 'Test Camp', isNight: true, fireflies: 3, warning: '' });
          const moon = t.$('.camp .moon');
          t.expect(moon, 'With isNight={true}, the camp should show <p className="moon">🌙 Night has fallen</p>. Use {isNight && ...}.');
          t.expect(norm(moon.textContent) === norm('🌙 Night has fallen'), `The moon notice says "${norm(moon.textContent)}". Expected "🌙 Night has fallen".`);
          t.renderComponent(Camp, { name: 'Test Camp', isNight: false, fireflies: 3, warning: '' });
          t.expect(!t.$('.moon'), 'With isNight={false}, the moon notice must not appear.');
        }),
        test('Fireflies show up when there are some', (t) => {
          const Camp = exported(t, 'Camp', 'Keep "export function Camp(...)" in your code.');
          t.renderComponent(Camp, { name: 'Test Camp', isNight: false, fireflies: 5, warning: '' });
          const text = textOf(t, '.camp .fireflies');
          t.expect(text === norm('✨ 5 fireflies'), `With fireflies={5}, the firefly line says "${text || 'nothing'}". Expected "✨ 5 fireflies".`);
        }),
        test('No fireflies: no firefly line and no stray 0', (t) => {
          const Camp = exported(t, 'Camp', 'Keep "export function Camp(...)" in your code.');
          t.renderComponent(Camp, { name: 'Test Camp', isNight: false, fireflies: 0, warning: 'Bears!' });
          t.expect(!t.$('.fireflies'), 'With fireflies={0}, the .fireflies line must not appear.');
          const text = t.text();
          t.expect(
            !text.includes('0'),
            `A ghostly 0 haunts the board: "${text}". fireflies is 0, and 0 && ... gives back 0, which React renders! Write fireflies > 0 && ... instead.`,
          );
          t.render();
          const glade = rowWith(t, '.camp', 'Sunny Glade');
          t.expect(
            glade && !norm(glade.textContent).includes('0'),
            `Sunny Glade in App shows "${norm(glade?.textContent)}": a stray 0 is still haunting it. Every && in Camp needs a real boolean on its left side.`,
          );
        }),
        test('The warning shows only when there is one', (t) => {
          const Camp = exported(t, 'Camp', 'Keep "export function Camp(...)" in your code.');
          t.renderComponent(Camp, { name: 'Test Camp', isNight: false, fireflies: 0, warning: 'Bears!' });
          const text = textOf(t, '.camp .warning');
          t.expect(text === norm('⚠️ Bears!'), `With warning="Bears!", the warning line says "${text || 'nothing'}". Expected "⚠️ Bears!". Use {warning && ...}.`);
          t.renderComponent(Camp, { name: 'Test Camp', isNight: false, fireflies: 2, warning: '' });
          t.expect(!t.$('.warning'), 'With an empty warning (""), the .warning line must not appear.');
          t.expect(
            !t.text().includes('0'),
            `With an empty warning the board shows "${t.text()}": a stray 0! warning.length && ... gives back 0 for an empty string. Strings are safe on their own: {warning && ...}.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'woods-and',
          icon: '🔦',
          title: 'Conditional &&',
          summary: '{cond && <A />} renders A only when cond is true; otherwise nothing.',
          snippet: code`
            {isNight && <p>🌙 Night has fallen</p>}
          `,
        },
        {
          id: 'woods-stray-zero',
          icon: '👻',
          title: 'The stray 0',
          summary: '{count && …} renders "0" when count is 0. Write count > 0 && … instead.',
          snippet: code`
            {fireflies && <p>✨</p>}      // ❌ shows 0
            {fireflies > 0 && <p>✨</p>}  // ✅
          `,
          detail: 'React renders nothing for false, null, undefined and true, but it does render numbers, including 0.',
        },
      ],
      css: `
        .camps { display: grid; gap: 12px; }
        .camp { background: #1e293b; color: #e2e8f0; border-radius: 14px; padding: 12px 16px; border: 2px solid #334155; }
        .camp h3 { color: #f8fafc; margin: 0 0 6px; }
        .moon { color: #c4b5fd; }
        .fireflies { color: #fde047; text-shadow: 0 0 8px #facc15; }
        .warning { color: #fecaca; background: rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 2px 8px; display: inline-block; }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'woods-packing-list',
      type: 'code',
      title: "Fern's Packing List",
      blurb: 'Turn an array into a list with map(), and give every item a key.',
      xp: 130,
      story: [
        { text: "Fern is heading into the deep woods. Her supplies live in an array, but her packing list only shows the first item, written out by hand.", mood: 'thinking' },
        { text: 'Arrays plus map() equals lists: one line of JSX for every item, however many there are. And each item needs a key, so React keeps every checkmark next to the right thing.', mood: 'happy' },
      ],
      lesson: md`
        ## From arrays to lists

        Data often arrives as an **array**. To show one element per item, transform the
        array of data into an array of JSX with \`.map()\`:

        \`\`\`jsx
        const supplies = [
          { id: 'rope', icon: '🪢', name: 'Rope' },
          { id: 'lamp', icon: '🏮', name: 'Lantern' },
          { id: 'bread', icon: '🍞', name: 'Bread' },
        ];

        function PackingList() {
          return (
            <ul>
              {supplies.map((item) => (
                <li key={item.id}>{item.icon} {item.name}</li>
              ))}
            </ul>
          );
        }
        \`\`\`

        React renders an array of elements one after another. \`.map()\` doesn't care whether
        the array holds 3 items or 300: the same line of JSX handles them all.

        :::tip
        The arrow function \`(item) => ( <li>...</li> )\` uses **parentheses**, so it returns the
        JSX automatically. With curly braces, \`(item) => { ... }\`, you must write \`return\` yourself!
        :::

        ## Keys: name tags for list items

        Every element created in a list needs a \`key\` prop: a string or number that
        **uniquely identifies** that item among its siblings.

        Why? When the array changes (an item is added, removed or moved), React compares
        the old list with the new one. Keys tell it *which item is which*. Without them,
        React can only go by **position**: "the first \`<li>\` is still the first \`<li>\`".

        Imagine each \`<li>\` has a checkbox and you've ticked **Rope**. Then the list is
        re-ordered so that Bread comes first:

        - **With good keys**, React sees that Rope moved and moves Rope's \`<li>\`, checkmark included. ✅
        - **Matched by position**, React just rewrites the texts: the first \`<li>\` now says "Bread"... and still has the tick. Your checkmark jumped to the wrong item! ❌

        ## What makes a good key?

        - **Unique** among its siblings: two items can't share one.
        - **Stable**: the same item gets the same key on every render.
        - Usually an **id from your data**: \`key={item.id}\`.

        :::mistake
        Don't use the array **index** as a key (\`map((item, i) => <li key={i}>\`) when the list
        can be re-ordered, filtered or have items inserted. Index keys describe *positions*,
        not *items*, so they bring back exactly the bug above. And never invent keys on the
        fly like \`key={Math.random()}\`: a new key on every render makes React throw away and
        rebuild every item.
        :::

        Keys are just for React: they're not shown on screen and your component can't read
        them (\`props.key\` is \`undefined\`). In development, React warns in the console when
        they're missing: *Each child in a list should have a unique "key" prop.*
      `,
      task: md`
        ## 🎯 Pack the bag

        \`PackingList\` receives an \`items\` prop: an array of \`{ id, icon, name }\` objects.

        1. Replace the hand-written \`<li>\` with \`items.map(...)\` so there is one \`<li className="item">\` per item, in the same order as the array.
        2. Each \`<li>\` contains an \`<input type="checkbox" />\` followed by the item's **icon** and **name**, e.g. **🪢 Rope**.
        3. Give each \`<li>\` a **key** that is unique and stable. Use \`item.id\`, not the index!

        The quest checks tick a checkbox and then shuffle the list. With good keys, the tick stays next to its item.
      `,
      starter: code`
        const supplies = [
          { id: 'rope', icon: '🪢', name: 'Rope' },
          { id: 'lamp', icon: '🏮', name: 'Lantern' },
          { id: 'bread', icon: '🍞', name: 'Bread' },
          { id: 'map', icon: '🗺️', name: 'Map' },
        ];

        export function PackingList({ items }) {
          return (
            <ul className="packing">
              {/* TODO: one <li> per item with items.map(), and a key on each */}
              <li className="item">
                <input type="checkbox" /> {items[0].icon} {items[0].name}
              </li>
            </ul>
          );
        }

        export default function App() {
          return (
            <main className="pack">
              <h2>🎒 Fern's packing list</h2>
              <PackingList items={supplies} />
            </main>
          );
        }
      `,
      solution: code`
        const supplies = [
          { id: 'rope', icon: '🪢', name: 'Rope' },
          { id: 'lamp', icon: '🏮', name: 'Lantern' },
          { id: 'bread', icon: '🍞', name: 'Bread' },
          { id: 'map', icon: '🗺️', name: 'Map' },
        ];

        export function PackingList({ items }) {
          return (
            <ul className="packing">
              {items.map((item) => (
                <li key={item.id} className="item">
                  <input type="checkbox" /> {item.icon} {item.name}
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          return (
            <main className="pack">
              <h2>🎒 Fern's packing list</h2>
              <PackingList items={supplies} />
            </main>
          );
        }
      `,
      hints: [
        md`\`.map()\` turns each item into JSX: \`{items.map((item) => <li>...</li>)}\`. Put it inside the \`<ul>\` in place of the hand-written \`<li>\`.`,
        md`Inside the map, use the \`item\` parameter instead of \`items[0]\`: \`{item.icon} {item.name}\`. Keep the \`<input type="checkbox" />\` at the start of each \`<li>\`.`,
        md`
          The finished list:

          \`\`\`jsx
          {items.map((item) => (
            <li key={item.id} className="item">
              <input type="checkbox" /> {item.icon} {item.name}
            </li>
          ))}
          \`\`\`
        `,
      ],
      tests: [
        test("Fern's list shows one <li className=\"item\"> per supply, in order", (t) => {
          t.render();
          const rows = t.$$('li.item').map((li) => norm(li.textContent));
          const want = ['🪢 Rope', '🏮 Lantern', '🍞 Bread', '🗺️ Map'].map(norm);
          t.expect(rows.length === 4, `The list shows ${rows.length} item(s) but Fern packed 4. Use items.map(...) to create one <li className="item"> per item.`);
          t.expect(rows.join(' | ') === want.join(' | '), `The rows read "${rows.join(' | ')}". Expected "${want.join(' | ')}".`);
        }),
        test('PackingList works for any list you pass in', (t) => {
          const PackingList = exported(t, 'PackingList', 'Keep "export function PackingList({ items })" in your code.');
          const items = [trav('i1', 'Compass'), trav('i2', 'Gloves'), trav('i3', 'Kettle'), trav('i4', 'Firewood'), trav('i5', 'Whistle')].map((it, i) => ({
            ...it,
            icon: ['🧭', '🧤', '🫖', '🪵', '📯'][i],
          }));
          t.renderComponent(PackingList, { items });
          const rows = t.$$('li.item').map((li) => norm(li.textContent));
          t.expect(rows.length === 5, `We passed 5 items but PackingList shows ${rows.length}. Map over the items prop instead of writing the <li> by hand.`);
          const want = items.map((it) => norm(`${it.icon} ${it.name}`));
          t.expect(rows.join(' | ') === want.join(' | '), `The rows read "${rows.join(' | ')}". Expected each item's icon and name, in order: "${want.join(' | ')}".`);
        }),
        test('Every item has its own checkbox', (t) => {
          t.render();
          const rows = t.$$('li.item');
          t.expect(rows.length > 1, 'Render every item first (only one <li> is showing).');
          const missing = rows.filter((li) => !li.querySelector('input[type="checkbox"]'));
          t.expect(missing.length === 0, `${missing.length} item(s) have no checkbox. Start each <li> with <input type="checkbox" />.`);
        }),
        test('Ticks stay with their item when the list is re-ordered (keys!)', (t) => {
          const PackingList = exported(t, 'PackingList', 'Keep "export function PackingList({ items })" in your code.');
          const rope = { id: 'r1', icon: '🪢', name: 'Rope' };
          const lamp = { id: 'l2', icon: '🏮', name: 'Lantern' };
          const bread = { id: 'b3', icon: '🍞', name: 'Bread' };
          t.renderComponent(PackingList, { items: [rope, lamp, bread] });
          const box = rowWith(t, 'li.item', 'Rope')?.querySelector('input[type="checkbox"]');
          t.expect(box, 'Could not find a checkbox in the Rope row. Each <li className="item"> needs its <input type="checkbox" />.');
          t.change(box, true);
          t.renderComponent(PackingList, { items: [bread, rope, lamp] });
          const after = rowWith(t, 'li.item', 'Rope');
          t.expect(after, 'After re-ordering, Rope is not in the list at all. Render every item with items.map(...).');
          if (!after.querySelector('input[type="checkbox"]')?.checked) {
            const ticked = t.$$('li.item').find((li) => li.querySelector('input[type="checkbox"]')?.checked);
            if (!ticked)
              t.fail(
                'We ticked Rope, then moved Bread to the top, and the tick vanished: React threw every row away and built new ones. Keys must be stable (never Math.random()). Give each <li> key={item.id}.',
              );
            t.fail(
              `We ticked Rope, then moved Bread to the top. Now the tick is next to ${nameIn(ticked, ['Rope', 'Lantern', 'Bread'])} instead! React matched the rows by position (that's what index keys, or no keys, do). Give each <li> key={item.id}.`,
            );
          }
        }),
      ],
      concepts: [
        {
          id: 'woods-map',
          icon: '🗂️',
          title: 'Lists with map()',
          summary: 'items.map(item => <li key={item.id}>…</li>) turns data into elements.',
          snippet: code`
            <ul>
              {items.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          `,
        },
        {
          id: 'woods-keys',
          icon: '🔑',
          title: 'Keys',
          summary: 'A unique, stable key per list item lets React track items as the list changes.',
          snippet: code`
            <li key={item.id}>…</li>   // ✅ id from the data
            <li key={index}>…</li>     // ❌ for lists that change
          `,
          detail: 'Keys must be unique among siblings and stable between renders. Never use Math.random(), and avoid indexes for lists that can be re-ordered, filtered or inserted into.',
        },
      ],
      css: `
        .pack { background: #fefce8; border: 3px solid #a3e635; border-radius: 16px; padding: 12px 18px; }
        .pack h2 { color: #3f6212; }
        .packing { list-style: none; padding: 0; }
        .item { padding: 6px 8px; border-bottom: 1px dashed #d9f99d; font-size: 1.05em; }
        .item:has(input:checked) { text-decoration: line-through; color: #65a30d; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'woods-mushroom-market',
      type: 'code',
      title: 'The Mushroom Market',
      blurb: 'Filter out the poison, sort a copy, and give each mushroom its own card.',
      xp: 160,
      story: [
        { text: "Morel's mushroom stall lists EVERY mushroom she has ever picked, poisonous ones included. Customers keep fainting. It's bad for business.", mood: 'worried' },
        { text: "Let's filter out the dangerous ones, sort the rest by price and give each mushroom its own card component. A proper market!", mood: 'excited' },
      ],
      lesson: md`
        ## filter, then map

        \`.filter()\` keeps only the items that pass a test and returns a **new** array.
        Chain it with \`.map()\` to show just some of the items:

        \`\`\`jsx
        const edible = mushrooms.filter((m) => !m.poisonous);

        return (
          <ul>
            {edible.map((m) => (
              <li key={m.id}>{m.name}</li>
            ))}
          </ul>
        );
        \`\`\`

        Do this right in the component body, before the \`return\`: it's plain JavaScript.
        There's no need to store the filtered list anywhere, it is simply recalculated on every render.

        ## Sorting without breaking things

        \`.sort()\` sorts an array **in place**: it changes the original array. If that array
        came from props, you've just rearranged your parent's data during render. Remember
        the Cursed Whetstone? That's impure. Make a sorted **copy** instead:

        \`\`\`jsx
        const cheapest = edible.toSorted((a, b) => a.price - b.price);   // ✅ modern
        const cheapest = [...edible].sort((a, b) => a.price - b.price);  // ✅ classic
        mushrooms.sort((a, b) => a.price - b.price);                     // ❌ changes the prop!
        \`\`\`

        The compare function returns a negative number when \`a\` should come first and a
        positive one when \`b\` should. \`a.price - b.price\` sorts low to high;
        \`b.price - a.price\` sorts high to low.

        :::tip
        \`.filter()\` and \`.map()\` already return new arrays, so \`items.filter(...).sort(...)\`
        sorts the filtered *copy*, which is safe. The danger is calling \`.sort()\` straight on a prop.
        :::

        ## A component for each item

        When each item needs more than a line of JSX, move it into its own component:

        \`\`\`jsx
        function MushroomCard({ mushroom }) {
          return <li className="mushroom">{mushroom.name}: {mushroom.price} 🪙</li>;
        }

        function Market({ mushrooms }) {
          return (
            <ul>
              {mushrooms.map((m) => (
                <MushroomCard key={m.id} mushroom={m} />
              ))}
            </ul>
          );
        }
        \`\`\`

        :::mistake
        The \`key\` goes on the element that \`.map()\` **returns**, here \`<MushroomCard key={m.id} />\`,
        not on the \`<li>\` inside \`MushroomCard\`. React needs the keys on the items of the
        array it is comparing.
        :::

        ## Lists inside lists

        A list item can hold its own list: just \`.map()\` again inside it. Keys only need to be
        unique **among siblings**, so each inner list can use simple keys:

        \`\`\`jsx
        <ul className="tags">
          {mushroom.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        \`\`\`
      `,
      task: md`
        ## 🎯 Open the market

        ### 1. Extract \`MushroomCard\`

        Move the \`<li className="mushroom">\` out of the \`.map()\` into a new exported component, \`MushroomCard({ mushroom })\`. Keep its \`<label className="basket">\` line as it is, and below that label add a nested list:

        - a \`<ul className="tags">\` with one \`<li className="tag">\` per string in \`mushroom.tags\` (the tag itself makes a fine key)

        ### 2. Fix the \`Market\`

        - Show only the mushrooms that are **not** \`poisonous\`.
        - Sort them by \`price\`, **cheapest first**, without changing the \`mushrooms\` array (\`.toSorted\` or a copy).
        - Render one \`<MushroomCard>\` per mushroom inside the \`<ul className="market">\`, with the key on the \`<MushroomCard>\` element itself.
      `,
      starter: code`
        const stock = [
          { id: 'm1', name: 'Fly Agaric', price: 2, poisonous: true, tags: ['☠️ deadly'] },
          { id: 'm2', name: 'Porcini', price: 9, poisonous: false, tags: ['🍲 soup', '🔥 roast'] },
          { id: 'm3', name: 'Chanterelle', price: 4, poisonous: false, tags: ['🧈 butter'] },
          { id: 'm4', name: 'Death Cap', price: 1, poisonous: true, tags: ['☠️ deadly', '🚫 never'] },
          { id: 'm5', name: 'Saffron Milk Cap', price: 6, poisonous: false, tags: ['🔥 roast', '🥗 salad', '🍞 toast'] },
        ];

        // TODO 1: extract the <li className="mushroom"> below into
        //         export function MushroomCard({ mushroom }) { ... }
        //         and give it a nested <ul className="tags"> list.

        export function Market({ mushrooms }) {
          // TODO 2: keep only the mushrooms that are NOT poisonous
          // TODO 3: sort them cheapest first, on a copy
          return (
            <ul className="market">
              {mushrooms.map((m) => (
                <li className="mushroom">
                  <label className="basket">
                    <input type="checkbox" /> {m.name} — {m.price} 🪙
                  </label>
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          return (
            <main className="stall">
              <h2>🍄 Morel's Mushroom Market</h2>
              <Market mushrooms={stock} />
            </main>
          );
        }
      `,
      solution: code`
        const stock = [
          { id: 'm1', name: 'Fly Agaric', price: 2, poisonous: true, tags: ['☠️ deadly'] },
          { id: 'm2', name: 'Porcini', price: 9, poisonous: false, tags: ['🍲 soup', '🔥 roast'] },
          { id: 'm3', name: 'Chanterelle', price: 4, poisonous: false, tags: ['🧈 butter'] },
          { id: 'm4', name: 'Death Cap', price: 1, poisonous: true, tags: ['☠️ deadly', '🚫 never'] },
          { id: 'm5', name: 'Saffron Milk Cap', price: 6, poisonous: false, tags: ['🔥 roast', '🥗 salad', '🍞 toast'] },
        ];

        export function MushroomCard({ mushroom }) {
          return (
            <li className="mushroom">
              <label className="basket">
                <input type="checkbox" /> {mushroom.name} — {mushroom.price} 🪙
              </label>
              <ul className="tags">
                {mushroom.tags.map((tag) => (
                  <li key={tag} className="tag">
                    {tag}
                  </li>
                ))}
              </ul>
            </li>
          );
        }

        export function Market({ mushrooms }) {
          const forSale = mushrooms
            .filter((m) => !m.poisonous)
            .toSorted((a, b) => a.price - b.price);

          return (
            <ul className="market">
              {forSale.map((m) => (
                <MushroomCard key={m.id} mushroom={m} />
              ))}
            </ul>
          );
        }

        export default function App() {
          return (
            <main className="stall">
              <h2>🍄 Morel's Mushroom Market</h2>
              <Market mushrooms={stock} />
            </main>
          );
        }
      `,
      hints: [
        md`Cut the \`<li className="mushroom">...</li>\` out of the map and paste it into \`export function MushroomCard({ mushroom })\`, renaming \`m\` to \`mushroom\`. Below the label, add \`<ul className="tags">{mushroom.tags.map((tag) => <li key={tag} className="tag">{tag}</li>)}</ul>\`.`,
        md`In \`Market\`, build the list before the \`return\`: \`const forSale = mushrooms.filter((m) => !m.poisonous).toSorted((a, b) => a.price - b.price);\``,
        md`Then map \`forSale\` (not \`mushrooms\`!) and put the key on the component: \`{forSale.map((m) => <MushroomCard key={m.id} mushroom={m} />)}\`.`,
      ],
      tests: [
        test('MushroomCard shows its tags in a nested <ul className="tags">', (t) => {
          const Card = exported(t, 'MushroomCard', 'Extract the <li> into "export function MushroomCard({ mushroom }) { ... }".');
          t.renderComponent(Card, { mushroom: shroom('x1', 'Test Truffle', 7, false, ['🧪 one', '🧪 two', '🧪 three']) });
          const card = t.$('li.mushroom');
          t.expect(card, `MushroomCard rendered ${clip(t.html())}. Expected an <li className="mushroom">.`);
          t.expect(norm(card.textContent).includes('Test Truffle'), 'MushroomCard should show the mushroom name and price in its .basket label (use the mushroom prop).');
          const tags = t.$$('.mushroom .tags .tag').map((li) => norm(li.textContent));
          t.expect(tags.length === 3, `For a mushroom with 3 tags, the card shows ${tags.length}. Map mushroom.tags to <li className="tag"> items inside a <ul className="tags">.`);
          t.expect(tags.join(', ') === '🧪 one, 🧪 two, 🧪 three', `The tags read "${tags.join(', ')}". Expected "🧪 one, 🧪 two, 🧪 three", in that order.`);
        }),
        test('The market hides poisonous mushrooms', (t) => {
          const Market = exported(t, 'Market', 'Keep "export function Market({ mushrooms })" in your code.');
          t.renderComponent(Market, { mushrooms: testStock() });
          const shown = namesIn(t, '.mushroom', STOCK_NAMES);
          const poison = shown.filter((n) => n === 'Webcap' || n === 'Toadstool');
          t.expect(poison.length === 0, `The market still sells ${poison.join(' and ')} (poisonous!). Keep only safe ones: mushrooms.filter((m) => !m.poisonous).`);
          t.expect(shown.length === 3, `The market shows ${shown.length} mushroom(s). Expected the 3 safe ones.`);
        }),
        test('Mushrooms are sorted by price, cheapest first', (t) => {
          const Market = exported(t, 'Market', 'Keep "export function Market({ mushrooms })" in your code.');
          t.renderComponent(Market, { mushrooms: testStock() });
          const order = namesIn(t, '.mushroom', STOCK_NAMES).filter((n) => n !== 'Webcap' && n !== 'Toadstool');
          t.expect(
            order.join(', ') === 'Oyster, Velvet Foot, Blewit',
            `The market lists ${order.join(', ') || 'nothing'}. Expected cheapest first: Oyster (2), Velvet Foot (5), Blewit (8). Sort with .toSorted((a, b) => a.price - b.price).`,
          );
        }),
        test('The mushrooms prop is never changed (sort a copy)', (t) => {
          const Market = exported(t, 'Market', 'Keep "export function Market({ mushrooms })" in your code.');
          const stock = testStock();
          const before = stock.map((m) => m.name).join(', ');
          t.renderComponent(Market, { mushrooms: stock });
          const after = stock.map((m) => m.name).join(', ');
          t.expect(
            stock.length === 5 && after === before,
            `Market rearranged the array it was given (from "${before}" to "${after}"). .sort() works in place; use .toSorted(...) or [...array].sort(...) to sort a copy.`,
          );
        }),
        test('Basket ticks stay with their mushroom when prices change (key on <MushroomCard>)', (t) => {
          const Market = exported(t, 'Market', 'Keep "export function Market({ mushrooms })" in your code.');
          const alpha = shroom('k1', 'Alpha Cap', 3);
          const beta = shroom('k2', 'Beta Bolete', 1);
          const gamma = shroom('k3', 'Gamma Puffball', 2);
          const names = ['Alpha Cap', 'Beta Bolete', 'Gamma Puffball'];
          t.renderComponent(Market, { mushrooms: [alpha, beta, gamma] });
          const box = rowWith(t, '.mushroom', 'Alpha Cap')?.querySelector('input[type="checkbox"]');
          t.expect(box, 'Could not find the basket checkbox for Alpha Cap. Keep <input type="checkbox" /> inside each card\'s .basket label.');
          t.change(box, true);
          // Alpha Cap's price drops to 0, so it jumps to the top of the market.
          t.renderComponent(Market, { mushrooms: [gamma, beta, { ...alpha, price: 0 }] });
          const after = rowWith(t, '.mushroom', 'Alpha Cap');
          t.expect(after, 'After the price change, Alpha Cap is missing from the market.');
          if (!after.querySelector('input[type="checkbox"]')?.checked) {
            const ticked = t.$$('.mushroom').find((el) => el.querySelector('input[type="checkbox"]')?.checked);
            if (!ticked)
              t.fail(
                "We put Alpha Cap in the basket, then its price dropped and it moved to the top, and the tick vanished: React threw the cards away and rebuilt them. Put a stable key={m.id} on the <MushroomCard> in Market's map (a key on the <li> inside MushroomCard doesn't count).",
              );
            t.fail(
              `We put Alpha Cap in the basket, then its price dropped and it moved to the top. Now the tick is next to ${nameIn(ticked, names)}! React matched the cards by position. Put key={m.id} on the <MushroomCard> in Market's map (a key inside MushroomCard doesn't count).`,
            );
          }
        }),
      ],
      concepts: [
        {
          id: 'woods-filter-map',
          icon: '🧹',
          title: 'filter + map',
          summary: 'items.filter(test).map(toJSX) shows only the matching items.',
          snippet: code`
            {mushrooms
              .filter((m) => !m.poisonous)
              .map((m) => <li key={m.id}>{m.name}</li>)}
          `,
        },
        {
          id: 'woods-sort-copy',
          icon: '📶',
          title: 'Sorting a copy',
          summary: 'items.toSorted(fn) or [...items].sort(fn); never .sort() a prop in place.',
          snippet: code`
            const cheapest = items.toSorted((a, b) => a.price - b.price);
          `,
          detail: 'a.price - b.price sorts low to high; b.price - a.price sorts high to low.',
        },
        {
          id: 'woods-item-components',
          icon: '🧺',
          title: 'List item components',
          summary: 'Extract a component per row; the key goes on <Row key={id} /> inside the map.',
          snippet: code`
            {items.map((m) => (
              <MushroomCard key={m.id} mushroom={m} />
            ))}
          `,
        },
      ],
      css: `
        .stall { background: #fff7ed; border: 3px solid #fdba74; border-radius: 16px; padding: 12px 16px; }
        .stall h2 { color: #9a3412; }
        .market { list-style: none; padding: 0; display: grid; gap: 8px; }
        .mushroom { background: #ffffff; border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 0 #fed7aa; }
        .basket { font-weight: 700; color: #7c2d12; }
        .mushroom:has(input:checked) { outline: 3px solid #fb923c; }
        .tags { list-style: none; padding: 0; margin: 6px 0 0; display: flex; gap: 6px; flex-wrap: wrap; }
        .tag { background: #ffedd5; color: #9a3412; border-radius: 999px; padding: 1px 10px; font-size: 0.85em; margin: 0; }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'woods-muddled-ledger',
      type: 'bug',
      title: 'The Muddled Ledger',
      blurb: 'Bug hunt! A mutating sort, index keys and a stray 0 in one old ledger.',
      xp: 150,
      story: [
        { text: 'Old Mossback the tortoise has written down every traveller who passed through these woods for three hundred years. Today his ledger is a mess.', mood: 'worried' },
        { text: "The arrival order got shuffled, notes jump between travellers, and an empty page shows a mysterious 0. Three bugs, one ledger. Let's squash them!", mood: 'excited' },
      ],
      lesson: md`
        ## Three classic list bugs

        Lists are where React bugs love to hide. Here are the three most common ones;
        you've met all of them in these woods.

        ### 1. Sorting in place

        \`.sort()\` (and \`.reverse()\`) **change the array they are called on**. If that array
        came in as a prop, you've just reshuffled your parent's data during render, and every
        other component showing that data sees the new order too.

        \`\`\`jsx
        travelers.sort(byName);          // ❌ rearranges the prop itself
        travelers.toSorted(byName);      // ✅ returns a new, sorted array
        [...travelers].sort(byName);     // ✅ sorts a copy
        \`\`\`

        To sort text alphabetically, compare with \`localeCompare\`:
        \`(a, b) => a.name.localeCompare(b.name)\`.

        ### 2. Index keys on a list that changes

        \`\`\`jsx
        {byName.map((t, index) => <li key={index}>...</li>)}   // ❌
        {byName.map((t) => <li key={t.id}>...</li>)}           // ✅
        \`\`\`

        When a new item is inserted, every item after it shifts position. With index keys,
        React thinks "row 1 is still row 1" and keeps the old row there, including whatever
        the user typed into it. Notes and checkmarks end up next to the wrong item.

        ### 3. The stray 0

        \`\`\`jsx
        {travelers.length && <ul>...</ul>}       // ❌ shows 0 for an empty array
        {travelers.length > 0 && <ul>...</ul>}   // ✅
        \`\`\`

        :::tip
        How to hunt bugs like these: **change the data and watch**. Add an item, empty the
        array, re-order it. Bugs that hide while everything sits still appear the moment the
        list changes, and that's exactly what the quest checks do!
        :::
      `,
      task: md`
        ## 🐛 Untangle the ledger

        Three bugs hide in \`Ledger\`. Fix them all:

        1. **The sort mutates the prop.** After the ledger renders, the *Arrival order* list is sorted A to Z as well, because \`.sort()\` rearranged the \`arrivals\` array itself. Sort a copy instead.
        2. **Notes jump between travellers.** The entries use the array index as their key, so when a new traveller arrives, notes slide onto the wrong person. Use a stable key.
        3. **A stray 0 haunts the empty page.** *Yesterday's page* has no travellers and shows **0**. An empty ledger must render no list and no 0.

        Keep everything else working: the ledger lists travellers **A to Z**, each in an \`<li className="entry">\` with its \`<input className="note" />\`.
      `,
      starter: code`
        // 🐛 Three bugs hide in Ledger. Can you find them all?

        const arrivals = [
          { id: 't1', name: 'Willow' },
          { id: 't2', name: 'Bramble' },
          { id: 't3', name: 'Acorn' },
        ];

        // Shows travellers in the order they arrived. (This one is fine!)
        export function ArrivalLog({ travelers }) {
          return (
            <ol className="arrivals">
              {travelers.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ol>
          );
        }

        // Shows travellers A to Z, each with a note field.
        export function Ledger({ travelers }) {
          const byName = travelers.sort((a, b) => a.name.localeCompare(b.name));
          return (
            <section className="ledger">
              {travelers.length && (
                <ul className="by-name">
                  {byName.map((t, index) => (
                    <li key={index} className="entry">
                      {t.name} <input className="note" placeholder="Note..." />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        }

        export default function App() {
          return (
            <main className="book">
              <h2>📖 Mossback's Ledger</h2>
              <Ledger travelers={arrivals} />
              <h3>🕰️ Arrival order</h3>
              <ArrivalLog travelers={arrivals} />
              <h3>📄 Yesterday's page</h3>
              <Ledger travelers={[]} />
            </main>
          );
        }
      `,
      solution: code`
        const arrivals = [
          { id: 't1', name: 'Willow' },
          { id: 't2', name: 'Bramble' },
          { id: 't3', name: 'Acorn' },
        ];

        export function ArrivalLog({ travelers }) {
          return (
            <ol className="arrivals">
              {travelers.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ol>
          );
        }

        export function Ledger({ travelers }) {
          const byName = travelers.toSorted((a, b) => a.name.localeCompare(b.name));
          return (
            <section className="ledger">
              {travelers.length > 0 && (
                <ul className="by-name">
                  {byName.map((t) => (
                    <li key={t.id} className="entry">
                      {t.name} <input className="note" placeholder="Note..." />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        }

        export default function App() {
          return (
            <main className="book">
              <h2>📖 Mossback's Ledger</h2>
              <Ledger travelers={arrivals} />
              <h3>🕰️ Arrival order</h3>
              <ArrivalLog travelers={arrivals} />
              <h3>📄 Yesterday's page</h3>
              <Ledger travelers={[]} />
            </main>
          );
        }
      `,
      hints: [
        md`\`travelers.sort(...)\` sorts the parent's array in place. Use \`travelers.toSorted(...)\` (or \`[...travelers].sort(...)\`) to get a sorted **copy**.`,
        md`\`key={index}\` follows positions, not travellers. Every traveller has an \`id\`: use \`key={t.id}\` (and drop the unused \`index\` parameter).`,
        md`\`travelers.length && ...\` renders \`0\` for an empty array. Compare instead: \`travelers.length > 0 && ...\`.`,
      ],
      tests: [
        test('Sorting leaves the prop alone: Arrival order stays Willow, Bramble, Acorn', (t) => {
          t.render();
          const arrivals = t.$$('.arrivals li').map((li) => norm(li.textContent));
          t.expect(
            arrivals.join(', ') === 'Willow, Bramble, Acorn',
            `The Arrival order list reads ${arrivals.join(', ')}. It should stay Willow, Bramble, Acorn. Ledger's .sort() rearranged the shared arrivals array: use travelers.toSorted(...) or [...travelers].sort(...).`,
          );
          const Ledger = exported(t, 'Ledger', 'Keep "export function Ledger({ travelers })" in your code.');
          const input = [trav('a', 'Yarrow'), trav('b', 'Clover'), trav('c', 'Moss')];
          t.renderComponent(Ledger, { travelers: input });
          const order = input.map((x) => x.name).join(', ');
          t.expect(order === 'Yarrow, Clover, Moss', `Ledger rearranged the array it was given (it is now ${order}). Sort a copy instead.`);
        }),
        test('The ledger lists travellers A to Z, each with a note field', (t) => {
          const Ledger = exported(t, 'Ledger', 'Keep "export function Ledger({ travelers })" in your code.');
          t.renderComponent(Ledger, { travelers: [trav('a', 'Yarrow'), trav('b', 'Clover'), trav('c', 'Moss')] });
          const names = t.$$('li.entry').map((li) => norm(li.textContent));
          t.expect(names.join(', ') === 'Clover, Moss, Yarrow', `The ledger lists ${names.join(', ') || 'nobody'}. Expected A to Z: Clover, Moss, Yarrow.`);
          t.expect(t.count('li.entry input.note') === 3, 'Each <li className="entry"> needs its <input className="note" />.');
        }),
        test('Notes stay with their traveller when someone new arrives (keys)', (t) => {
          const Ledger = exported(t, 'Ledger', 'Keep "export function Ledger({ travelers })" in your code.');
          const willow = trav('w1', 'Willow');
          const bramble = trav('b2', 'Bramble');
          const acorn = trav('a3', 'Acorn');
          t.renderComponent(Ledger, { travelers: [willow, bramble] });
          const note = rowWith(t, 'li.entry', 'Willow')?.querySelector('input.note');
          t.expect(note, 'Could not find the note field in Willow\'s entry. Keep <input className="note" /> in each <li className="entry">.');
          t.type(note, 'owes 3 gold');
          // Acorn arrives and slots in at the top of the A-to-Z list.
          t.renderComponent(Ledger, { travelers: [acorn, willow, bramble] });
          const after = rowWith(t, 'li.entry', 'Willow')?.querySelector('input.note');
          if (!after || after.value !== 'owes 3 gold') {
            const holder = t.$$('li.entry').find((li) => li.querySelector('input.note')?.value === 'owes 3 gold');
            if (!holder)
              t.fail('We wrote "owes 3 gold" next to Willow, then Acorn arrived, and the note vanished: React rebuilt the rows from scratch. Keys must be stable: use key={t.id}.');
            t.fail(
              `We wrote "owes 3 gold" next to Willow, then Acorn arrived. Now the note is next to ${nameIn(holder, ['Acorn', 'Bramble', 'Willow'])}! Index keys follow positions, not travellers. Use key={t.id}.`,
            );
          }
        }),
        test('An empty ledger shows no list and no stray 0', (t) => {
          const Ledger = exported(t, 'Ledger', 'Keep "export function Ledger({ travelers })" in your code.');
          t.renderComponent(Ledger, { travelers: [] });
          const text = t.text();
          t.expect(!text.includes('0'), `The empty ledger shows "${text}". travelers.length is 0, and 0 && ... renders 0! Write travelers.length > 0 && ...`);
          t.expect(!t.$('li.entry'), 'An empty ledger should not show any entries.');
        }),
      ],
      concepts: [
        {
          id: 'woods-index-keys',
          icon: '🎭',
          title: 'Why not index keys?',
          summary: 'Index keys follow positions, not items, so typed text and ticks jump when the list changes.',
          snippet: code`
            {list.map((t, i) => <li key={i}>…</li>)}  // ❌ positions
            {list.map((t) => <li key={t.id}>…</li>)}  // ✅ identities
          `,
          detail: 'Index keys are only safe for lists that never change order or length.',
        },
      ],
      css: `
        .book {
          background: #fdf6e3; border: 3px solid #a16207; border-radius: 8px 16px 16px 8px; padding: 12px 18px;
          box-shadow: inset 8px 0 0 #ca8a04; font-family: Georgia, 'Times New Roman', serif;
        }
        .book h2, .book h3 { color: #713f12; }
        .by-name, .arrivals { margin: 4px 0 10px; }
        .entry { padding: 3px 0; }
        .note { width: 170px; font-size: 0.85em; padding: 3px 8px; margin-left: 8px; }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'woods-trial',
      type: 'quiz',
      title: 'Trial of the Branches',
      blurb: "Hootsworth's eight riddles about conditions, lists and keys.",
      xp: 100,
      story: [
        { text: 'Hootsworth has one last test before the deep woods: eight riddles about branches and lists. Every answer comes with an explanation. Owls LOVE explaining.', mood: 'happy' },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What does this render when `count` is `0`?\n\n```jsx\nfunction Bag({ count }) {\n  return <p>Potions: {count && <b>{count}</b>}</p>;\n}\n```',
          ['`Potions:`', '`Potions: 0`', '`Potions: false`', 'Nothing at all'],
          1,
          '`0 && anything` gives back `0`, and React renders numbers: that is the famous stray zero! Write `count > 0 && ...` so the left side is a real boolean.',
        ),
        q(
          'Which of these is **not** allowed inside JSX braces?',
          ['`{isOpen ? <Door /> : <Wall />}`', '`{isOpen && <Door />}`', '`{if (isOpen) { <Door /> }}`', '`{isOpen ? <Door /> : null}`'],
          2,
          'Braces need an **expression**. `if` is a statement, so it has to live above the `return`. Ternaries and `&&` are expressions, so they fit right in.',
        ),
        q(
          'What does `<Profile user={null} />` render?\n\n```jsx\nfunction Profile({ user }) {\n  if (!user) {\n    return null;\n  }\n  return <h2>{user.name}</h2>;\n}\n```',
          ['An empty `<h2>`', 'The text "null"', 'It crashes: cannot read `name` of null', 'Nothing'],
          3,
          'The guard runs first: `!null` is `true`, so the component returns `null` and renders nothing. The line that reads `user.name` never runs, which is exactly why the guard comes first.',
        ),
        q(
          'These quests can be sorted, added and deleted. Which key is best?\n\n```jsx\n{quests.map((quest, index) => (\n  <QuestRow key={???} quest={quest} />\n))}\n```',
          ['`quest.id`', '`index`', '`Math.random()`', '`quest.title + index`'],
          0,
          'A good key is **unique and stable**: the same item always gets the same key. `index` describes a position, which changes when the list is re-ordered; `Math.random()` changes on every render; `title + index` still depends on the position.',
        ),
        q(
          '`Row` renders one `<li>`. Where does the key go?\n\n```jsx\nfunction Row({ item }) {\n  return <li>{item.name}</li>;\n}\n```',
          [
            'On the `<li>` inside `Row`: `<li key={item.id}>`',
            'On `Row` inside the map: `items.map((item) => <Row key={item.id} item={item} />)`',
            'In both places',
            'Nowhere: components get keys automatically',
          ],
          1,
          'Keys belong on the elements **directly inside the array**, the ones `.map()` returns. Here that is `<Row />`. A key on the inner `<li>` does nothing for the list.',
        ),
        q(
          'This list shows nothing at all. Why?\n\n```jsx\n<ul>\n  {trees.map((tree) => {\n    <li key={tree.id}>{tree.name}</li>;\n  })}\n</ul>\n```',
          ['`<li>` cannot be used inside `map`', 'Keys must be strings', '`trees` has to be sorted first', 'The arrow function uses `{ }` but never returns the JSX'],
          3,
          'With curly braces, an arrow function needs an explicit `return`. Write `(tree) => { return <li>...</li>; }` or use parentheses: `(tree) => (<li>...</li>)`.',
        ),
        q(
          'What is the problem with this line inside a component?\n\n```jsx\nconst ranked = props.heroes.sort((a, b) => b.level - a.level);\n```',
          [
            'It sorts the lowest level first',
            '`sort` cannot take a function',
            'It rearranges the `heroes` array that belongs to the parent: a mutation during render',
            'Nothing, this is the recommended way',
          ],
          2,
          '`.sort()` changes the array it is called on. Use `props.heroes.toSorted(...)` or `[...props.heroes].sort(...)` to sort a **copy** and keep your component pure.',
        ),
        q(
          'What does this render?\n\n```jsx\nconst trees = ["Oak", "Pine", "Birch"];\n\n<ul>\n  {trees\n    .filter((t) => t !== "Pine")\n    .map((t) => <li key={t}>{t}</li>)}\n</ul>\n```',
          ['Oak, Pine, Birch', 'Oak, Birch', 'Pine', 'Birch, Oak'],
          1,
          '`.filter` keeps every tree that is not "Pine", then `.map` turns the survivors into `<li>`s in their original order: Oak, Birch.',
        ),
      ],
      concepts: [
        {
          id: 'woods-choosing',
          icon: '🧭',
          title: 'Choosing a conditional',
          summary: 'if + return for whole results, a ternary for this-or-that, && for this-or-nothing.',
          snippet: code`
            if (!user) return null;                  // nothing at all
            {open ? <Door /> : <Wall />}             // this or that
            {count > 0 && <Badge count={count} />}   // this or nothing
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'woods-boss',
      type: 'build',
      boss: true,
      bossName: 'The Keyless Horde',
      bossIcon: '👺',
      title: 'Boss: The Keyless Horde',
      blurb: 'Warbands of goblins that shuffle every turn. Give every last one of them a key.',
      xp: 300,
      badge: { id: 'badge-woods', name: 'Keymaster', icon: '🔑', description: 'Tagged every goblin of the Keyless Horde in the Branching Woods.' },
      story: [
        { text: 'Drums in the dark... The Keyless Horde! Warband after warband of goblins, and not one of them has a key.', mood: 'worried' },
        { text: "Every turn they shuffle their ranks. Without keys, React mixes them up and the rangers' name tags end up on the wrong goblins. That's how they slip through!", mood: 'thinking' },
        { text: 'Build the rangers a war board: every warband, only the goblins that are awake, strongest first, and a key on EVERY one. Tag them all!', mood: 'excited' },
      ],
      lesson: md`
        ## Everything from the Woods

        | Skill | Example |
        |---|---|
        | Early return | \`if (warbands.length === 0) return <p>...</p>;\` |
        | Ternary | \`{awake.length > 0 ? <ul>...</ul> : <p>💤</p>}\` |
        | \`&&\` with a boolean | \`{goblin.loot > 0 && <span>...</span>}\` |
        | map + key | \`{list.map((g) => <Goblin key={g.id} goblin={g} />)}\` |
        | filter | \`goblins.filter((g) => g.awake)\` |
        | sorted copy | \`awake.toSorted((a, b) => b.power - a.power)\` |

        ## Lists of lists

        The horde is a **list of warbands**, and every warband holds a **list of goblins**.
        That's a nested list: one \`.map()\` inside another. It reads best with one component
        per level:

        \`\`\`jsx
        function HordeBoard({ warbands }) {
          return (
            <div className="board">
              {warbands.map((band) => (
                <Warband key={band.id} band={band} />
              ))}
            </div>
          );
        }

        function Warband({ band }) {
          return (
            <section className="warband">
              <h3>{band.name}</h3>
              <ul className="goblins">
                {band.goblins.map((g) => (
                  <Goblin key={g.id} goblin={g} />
                ))}
              </ul>
            </section>
          );
        }
        \`\`\`

        **Both** levels need keys: warbands among warbands, goblins among their siblings.
        A goblin's key only has to be unique **inside its own warband**. That's why two
        goblins in different warbands of the horde can both have the id \`'g1'\`.

        :::tip
        Derive, don't store: work out \`awake\` and its sorted order right in the component body,
        from the props you receive. Every render starts fresh from the data.
        :::

        :::story
        The rangers have a saying: *"A goblin without a key is a goblin you'll lose."*
        The horde reshuffles between every check. Only stable keys keep your name tags on the right goblins.
        :::
      `,
      task: md`
        ## 👑 Tag the Keyless Horde

        Finish three exported components. A warband looks like this: \`{ id, name, goblins }\`, and each goblin like this: \`{ id, name, power, awake, chief, loot }\`.

        ### \`Goblin({ goblin })\`

        Returns an \`<li className="goblin">\` containing, in order:

        1. \`<span className="crown">👑</span>\`, **only** if \`goblin.chief\` is true
        2. \`<span className="name">\` with the goblin's **name**
        3. \`<span className="power">\` showing **⚔️ POWER**
        4. \`<span className="loot">\` showing **💰 LOOT**, only if \`loot\` is **more than 0** (no stray zeros!)
        5. a name-tag field: \`<input className="tag" placeholder="Tag" />\`

        ### \`Warband({ band })\`

        Returns a \`<section className="warband">\` with an \`<h3>\` showing the band's **name**, followed by **either**:

        - a \`<ul className="goblins">\` with only the **awake** goblins, sorted by **power, strongest first** (don't mutate the data!), each one a \`<Goblin>\` with a key, **or**
        - if no goblin is awake: a \`<p className="asleep">\` saying **💤 All asleep** instead of the list.

        ### \`HordeBoard({ warbands })\`

        - If there are no warbands, return early with \`<p className="quiet">\` saying **🌲 The woods are quiet.**
        - Otherwise return a \`<div className="board">\` with one \`<Warband>\` per warband, with a key.

        \`App\` is done already: it renders \`<HordeBoard warbands={horde} />\`.
      `,
      starter: code`
        const horde = [
          {
            id: 'w1',
            name: 'The Rootgnawers',
            goblins: [
              { id: 'g1', name: 'Snag', power: 7, awake: true, chief: false, loot: 3 },
              { id: 'g2', name: 'Grub', power: 4, awake: false, chief: false, loot: 0 },
              { id: 'g3', name: 'Mudfang', power: 9, awake: true, chief: true, loot: 12 },
              { id: 'g4', name: 'Nib', power: 2, awake: true, chief: false, loot: 0 },
            ],
          },
          {
            id: 'w2',
            name: 'The Mossbiters',
            goblins: [
              { id: 'g1', name: 'Wort', power: 5, awake: false, chief: true, loot: 8 },
              { id: 'g2', name: 'Pox', power: 3, awake: false, chief: false, loot: 0 },
            ],
          },
          {
            id: 'w3',
            name: 'The Thornhides',
            goblins: [
              { id: 'g1', name: 'Bristle', power: 6, awake: true, chief: false, loot: 0 },
              { id: 'g2', name: 'Skulk', power: 8, awake: true, chief: true, loot: 5 },
            ],
          },
        ];

        export function Goblin({ goblin }) {
          // TODO: 👑 crown (chiefs only), name, ⚔️ power, 💰 loot (only if > 0), tag input
          return <li className="goblin">{goblin.name}</li>;
        }

        export function Warband({ band }) {
          // TODO: only the awake goblins, strongest first (sort a copy!)
          // TODO: "💤 All asleep" instead of the list when nobody is awake
          return (
            <section className="warband">
              <h3>{band.name}</h3>
              <ul className="goblins">
                {band.goblins.map((goblin) => (
                  <Goblin goblin={goblin} />
                ))}
              </ul>
            </section>
          );
        }

        export function HordeBoard({ warbands }) {
          // TODO: "🌲 The woods are quiet." when there are no warbands
          return (
            <div className="board">
              {warbands.map((band) => (
                <Warband band={band} />
              ))}
            </div>
          );
        }

        export default function App() {
          return (
            <main className="horde">
              <h2>🥁 The Keyless Horde</h2>
              <HordeBoard warbands={horde} />
            </main>
          );
        }
      `,
      solution: code`
        const horde = [
          {
            id: 'w1',
            name: 'The Rootgnawers',
            goblins: [
              { id: 'g1', name: 'Snag', power: 7, awake: true, chief: false, loot: 3 },
              { id: 'g2', name: 'Grub', power: 4, awake: false, chief: false, loot: 0 },
              { id: 'g3', name: 'Mudfang', power: 9, awake: true, chief: true, loot: 12 },
              { id: 'g4', name: 'Nib', power: 2, awake: true, chief: false, loot: 0 },
            ],
          },
          {
            id: 'w2',
            name: 'The Mossbiters',
            goblins: [
              { id: 'g1', name: 'Wort', power: 5, awake: false, chief: true, loot: 8 },
              { id: 'g2', name: 'Pox', power: 3, awake: false, chief: false, loot: 0 },
            ],
          },
          {
            id: 'w3',
            name: 'The Thornhides',
            goblins: [
              { id: 'g1', name: 'Bristle', power: 6, awake: true, chief: false, loot: 0 },
              { id: 'g2', name: 'Skulk', power: 8, awake: true, chief: true, loot: 5 },
            ],
          },
        ];

        export function Goblin({ goblin }) {
          return (
            <li className="goblin">
              {goblin.chief && <span className="crown">👑</span>}
              <span className="name">{goblin.name}</span>
              <span className="power">⚔️ {goblin.power}</span>
              {goblin.loot > 0 && <span className="loot">💰 {goblin.loot}</span>}
              <input className="tag" placeholder="Tag" />
            </li>
          );
        }

        export function Warband({ band }) {
          const awake = band.goblins
            .filter((g) => g.awake)
            .toSorted((a, b) => b.power - a.power);

          return (
            <section className="warband">
              <h3>{band.name}</h3>
              {awake.length > 0 ? (
                <ul className="goblins">
                  {awake.map((g) => (
                    <Goblin key={g.id} goblin={g} />
                  ))}
                </ul>
              ) : (
                <p className="asleep">💤 All asleep</p>
              )}
            </section>
          );
        }

        export function HordeBoard({ warbands }) {
          if (warbands.length === 0) {
            return <p className="quiet">🌲 The woods are quiet.</p>;
          }
          return (
            <div className="board">
              {warbands.map((band) => (
                <Warband key={band.id} band={band} />
              ))}
            </div>
          );
        }

        export default function App() {
          return (
            <main className="horde">
              <h2>🥁 The Keyless Horde</h2>
              <HordeBoard warbands={horde} />
            </main>
          );
        }
      `,
      hints: [
        md`Start with \`Goblin\`: \`{goblin.chief && <span className="crown">👑</span>}\` and \`{goblin.loot > 0 && <span className="loot">💰 {goblin.loot}</span>}\`. Booleans on the left of \`&&\`, never a bare number.`,
        md`In \`Warband\`, derive the list before \`return\`: \`const awake = band.goblins.filter((g) => g.awake).toSorted((a, b) => b.power - a.power);\` Then choose with a ternary: \`{awake.length > 0 ? <ul className="goblins">...</ul> : <p className="asleep">💤 All asleep</p>}\`.`,
        md`Keys at both levels: \`<Goblin key={g.id} goblin={g} />\` in the warband and \`<Warband key={band.id} band={band} />\` in \`HordeBoard\`, which starts with \`if (warbands.length === 0) { return <p className="quiet">🌲 The woods are quiet.</p>; }\`.`,
      ],
      tests: [
        test('Goblin: a crown for chiefs, name and power, loot only when above 0', (t) => {
          const Goblin = exported(t, 'Goblin', 'Keep "export function Goblin({ goblin })" in your code.');
          t.renderComponent(Goblin, { goblin: gob('q1', 'Quill', 6, { chief: true, loot: 4 }) });
          t.expectElement('li.goblin', `Goblin rendered ${clip(t.html())}. Expected an <li className="goblin">.`);
          t.expect(textOf(t, '.goblin .crown') === '👑', 'A chief (chief: true) should wear <span className="crown">👑</span>. Use {goblin.chief && ...}.');
          t.expect(textOf(t, '.goblin .name') === 'Quill', `The .name span says "${textOf(t, '.goblin .name') || 'nothing'}". Expected the goblin's name, "Quill".`);
          t.expect(textOf(t, '.goblin .power') === norm('⚔️ 6'), `The .power span says "${textOf(t, '.goblin .power') || 'nothing'}". Expected "⚔️ 6".`);
          t.expect(textOf(t, '.goblin .loot') === norm('💰 4'), `With loot: 4, the .loot span says "${textOf(t, '.goblin .loot') || 'nothing'}". Expected "💰 4".`);
          t.expectElement('.goblin input.tag', 'Each goblin needs a name-tag field: <input className="tag" placeholder="Tag" />.');
          t.renderComponent(Goblin, { goblin: gob('q2', 'Quill', 6) });
          t.expect(!t.$('.crown'), 'Only chiefs wear the crown. With chief: false there should be no .crown.');
          t.expect(!t.$('.loot'), 'With loot: 0 there should be no .loot span.');
          t.expect(!t.text().includes('0'), `A goblin with no loot shows "${t.text()}": a stray 0! Write goblin.loot > 0 && ... so the left side is a real boolean.`);
        }),
        test('Warband: only awake goblins, strongest first, without mutating the data', (t) => {
          const Warband = exported(t, 'Warband', 'Keep "export function Warband({ band })" in your code.');
          const band = { id: 'b1', name: 'Test Band', goblins: [gob('a', 'Ash', 3), gob('b', 'Burr', 8, { awake: false }), gob('c', 'Cob', 9), gob('d', 'Dent', 5)] };
          const before = band.goblins.map((g) => g.name).join(', ');
          t.renderComponent(Warband, { band });
          t.expectElement('section.warband', `Warband rendered ${clip(t.html())}. Expected a <section className="warband">.`);
          t.expect(textOf(t, '.warband h3') === 'Test Band', `The warband heading says "${textOf(t, '.warband h3') || 'nothing'}". Expected the band's name, "Test Band".`);
          const shown = namesIn(t, '.goblin', ['Ash', 'Burr', 'Cob', 'Dent']);
          t.expect(!shown.includes('Burr'), 'Burr is asleep (awake: false) but still stands on the board. Keep only the awake goblins: band.goblins.filter((g) => g.awake).');
          t.expect(
            shown.join(', ') === 'Cob, Dent, Ash',
            `The goblins appear as ${shown.join(', ') || 'nothing'}. Expected the strongest first: Cob (9), Dent (5), Ash (3). Sort a copy with .toSorted((a, b) => b.power - a.power).`,
          );
          t.expect(t.$('.warband ul.goblins .goblin'), 'Put the goblins inside a <ul className="goblins">.');
          const after = band.goblins.map((g) => g.name).join(', ');
          t.expect(after === before, `Warband rearranged the goblins array it received (now ${after}). Sort a copy: .toSorted(...) or [...array].sort(...).`);
        }),
        test('Warband: "💤 All asleep" instead of the list when nobody is awake', (t) => {
          const Warband = exported(t, 'Warband', 'Keep "export function Warband({ band })" in your code.');
          t.renderComponent(Warband, { band: { id: 'b2', name: 'Sleepy Band', goblins: [gob('e', 'Elm', 4, { awake: false }), gob('f', 'Fig', 2, { awake: false })] } });
          const asleep = t.$('.warband p.asleep');
          t.expect(asleep, `With nobody awake, the warband shows ${clip(t.html())}. Expected <p className="asleep">💤 All asleep</p> instead of the list (a ternary works great).`);
          t.expect(norm(asleep.textContent) === norm('💤 All asleep'), `The sleepy message says "${norm(asleep.textContent)}". Expected "💤 All asleep".`);
          t.expect(!t.$('.warband ul.goblins'), 'When everyone is asleep, show only the 💤 message: no <ul className="goblins">.');
          t.renderComponent(Warband, { band: { id: 'b3', name: 'Busy Band', goblins: [gob('g', 'Gnash', 4)] } });
          t.expect(!t.$('.asleep'), 'A warband with awake goblins must NOT show the 💤 All asleep message.');
        }),
        test('HordeBoard: one Warband per band, or "🌲 The woods are quiet." when there are none', (t) => {
          const HordeBoard = exported(t, 'HordeBoard', 'Keep "export function HordeBoard({ warbands })" in your code.');
          t.renderComponent(HordeBoard, { warbands: [] });
          const quiet = t.$('p.quiet');
          t.expect(
            quiet && norm(quiet.textContent) === norm('🌲 The woods are quiet.'),
            `With no warbands, HordeBoard shows ${clip(t.html())}. Return early with <p className="quiet">🌲 The woods are quiet.</p>.`,
          );
          const bands = [
            { id: 'A', name: 'Band Alpha', goblins: [gob('x1', 'Xog', 9)] },
            { id: 'B', name: 'Band Beta', goblins: [gob('z1', 'Zub', 7)] },
          ];
          t.renderComponent(HordeBoard, { warbands: bands });
          t.expectElement('div.board', `HordeBoard rendered ${clip(t.html())}. Expected a <div className="board">.`);
          const titles = t.$$('.board .warband h3').map((h) => norm(h.textContent));
          t.expect(titles.join(', ') === 'Band Alpha, Band Beta', `The board shows the warbands ${titles.join(', ') || 'nothing'}. Expected Band Alpha, Band Beta: one <Warband> per band.`);
          t.expect(!t.$('.quiet'), 'Only show the quiet message when there are no warbands.');
          t.render();
          t.expect(t.count('.warband') === 3, `App's board shows ${t.count('.warband')} warband(s). Expected all 3.`);
          t.expect(norm(rowWith(t, '.warband', 'Mossbiters')?.textContent).includes(norm('💤 All asleep')), 'In App, The Mossbiters are all asleep and should show 💤 All asleep.');
        }),
        test('Final blow: name tags stay on their goblins when the horde reshuffles', (t) => {
          const HordeBoard = exported(t, 'HordeBoard', 'Keep "export function HordeBoard({ warbands })" in your code.');
          const names = ['Xog', 'Yip', 'Zub', 'Wix', 'Vex'];
          const alpha = { id: 'A', name: 'Band Alpha', goblins: [gob('x1', 'Xog', 9), gob('y1', 'Yip', 5)] };
          const beta = { id: 'B', name: 'Band Beta', goblins: [gob('z1', 'Zub', 7), gob('w1', 'Wix', 4)] };
          t.renderComponent(HordeBoard, { warbands: [alpha, beta] });
          const tagOf = (name) => rowWith(t, '.goblin', name)?.querySelector('input.tag');
          t.expect(tagOf('Xog') && tagOf('Wix'), 'Every goblin needs its <input className="tag" /> so the rangers can tag it.');
          t.type(tagOf('Xog'), 'TAG-XOG');
          t.type(tagOf('Wix'), 'TAG-WIX');
          // The horde reshuffles: the warbands swap places, Yip powers up past Xog, and Vex joins Band Beta.
          t.renderComponent(HordeBoard, {
            warbands: [
              { ...beta, goblins: [gob('v1', 'Vex', 8), ...beta.goblins] },
              { ...alpha, goblins: [{ ...alpha.goblins[1], power: 10 }, alpha.goblins[0]] },
            ],
          });
          for (const [name, tag] of [
            ['Xog', 'TAG-XOG'],
            ['Wix', 'TAG-WIX'],
          ]) {
            if (tagOf(name)?.value === tag) continue;
            const holder = t.$$('.goblin').find((li) => li.querySelector('input.tag')?.value === tag);
            if (!holder)
              t.fail(
                `The horde reshuffled and the tag "${tag}" vanished: React threw ${name}'s row away and built a new one. Both lists need stable keys: <Warband key={band.id} ... /> in HordeBoard and <Goblin key={goblin.id} ... /> in Warband.`,
              );
            t.fail(
              `The horde reshuffled and the tag "${tag}" jumped from ${name} to ${nameIn(holder, names)}! React matched the rows by position. Give each <Goblin> key={goblin.id}, and each <Warband> key={band.id}.`,
            );
          }
        }),
      ],
      concepts: [
        {
          id: 'woods-nested-lists',
          icon: '🪺',
          title: 'Nested lists',
          summary: 'A map inside a map, with keys at both levels, unique among siblings.',
          snippet: code`
            {warbands.map((band) => (
              <section key={band.id}>
                {band.goblins.map((g) => (
                  <Goblin key={g.id} goblin={g} />
                ))}
              </section>
            ))}
          `,
          detail: 'Give each level its own component; keys only need to be unique inside their own list.',
        },
      ],
      css: `
        .horde { background: radial-gradient(circle at top, #3f1d0b, #0c0a09); color: #fde68a; border-radius: 16px; padding: 14px 18px; }
        .horde h2 { color: #fca5a5; text-align: center; letter-spacing: 1px; }
        .board { display: grid; gap: 10px; }
        .warband { background: rgba(255, 255, 255, 0.06); border: 2px solid #7f1d1d; border-radius: 12px; padding: 8px 12px; margin: 0; }
        .warband h3 { color: #fecaca; margin: 0 0 6px; }
        .goblins { list-style: none; padding: 0; margin: 0; }
        .goblin { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
        .name { font-weight: 700; color: #bbf7d0; }
        .power { color: #fca5a5; }
        .loot { color: #fde047; }
        .tag { width: 110px; padding: 2px 8px; font-size: 0.85em; margin-left: auto; }
        .asleep { color: #a8a29e; font-style: italic; }
        .quiet { color: #bbf7d0; text-align: center; }
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// Sample data used by the checks (deliberately different from the App data,
// so hard-coded values can't sneak through).
// ---------------------------------------------------------------------------

const STOCK_NAMES = ['Velvet Foot', 'Toadstool', 'Oyster', 'Blewit', 'Webcap'];

function testStock() {
  return [
    shroom('s1', 'Velvet Foot', 5),
    shroom('s2', 'Toadstool', 1, true),
    shroom('s3', 'Oyster', 2),
    shroom('s4', 'Blewit', 8),
    shroom('s5', 'Webcap', 3, true),
  ];
}
