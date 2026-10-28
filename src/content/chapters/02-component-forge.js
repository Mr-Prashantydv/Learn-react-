import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Check helpers (shared by the quests below)
// ---------------------------------------------------------------------------

/** Collapse whitespace and drop emoji variation selectors, so "⚙️" matches "⚙". */
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

export default {
  id: 'component-forge',
  file: '02-component-forge.js',
  title: 'Component Forge',
  short: 'Components',
  subtitle: 'Forge reusable components, feed them props and nest them with children.',
  icon: '⚒️',
  colors: ['#431407', '#f97316'],
  scenery: ['🔥', '⚙️', '🔨', '⛏️', '🪨', '🛡️', '⚔️', '✨'],
  intro: [
    { text: 'Welcome to the Component Forge! Every button, card and menu in Reactoria was hammered into shape on these anvils.', mood: 'excited' },
    { text: 'Master Smith Hilda Hammerhand runs the place, but the Mutator froze her furnace solid. Nothing new has been forged in weeks.', mood: 'worried' },
    { text: 'Here you will forge your own components, hand them props and nest them like tools in a toolbox. And at the far end... a giant made of one enormous component.', mood: 'thinking' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'forge-first-mold',
      type: 'code',
      title: 'The First Mold',
      blurb: 'Forge a reusable Gear and nest three of them inside a Machine.',
      xp: 100,
      story: [
        { text: "Hilda's Great Bellows has stopped wheezing. Its gears were stolen, and carving each new gear by hand takes all day. One. Gear. At. A. Time.", mood: 'worried' },
        { text: 'Not any more! A component is a mold: carve it once, cast it as often as you like. Forge a Gear, build a Machine from it, and the bellows will breathe again.', mood: 'excited' },
      ],
      lesson: md`
        ## One mold, many copies

        On the Shore of JSX you wrote a single component, \`App\`. Real apps are made of
        **many** small components, each in charge of one piece of the screen: a button,
        a card, a menu... a gear.

        Define a component once:

        \`\`\`jsx
        function Gear() {
          return <span className="gear">⚙️</span>;
        }
        \`\`\`

        ...then use it like a custom HTML tag, as many times as you like:

        \`\`\`jsx
        function Machine() {
          return (
            <div className="machine">
              <Gear />
              <Gear />
              <Gear />
            </div>
          );
        }
        \`\`\`

        Each \`<Gear />\` tells React: "call the \`Gear\` function and put whatever it returns
        right here". Improve the mold once, and every gear improves with it.

        ## Nesting builds a tree

        Components can render other components, which render others, and so on.
        Together they form a **tree**:

        \`\`\`
        App
        └─ Machine
           ├─ Gear
           ├─ Gear
           └─ Gear
        \`\`\`

        A component that renders another is its **parent**; the rendered one is its
        **child**. \`App\` is the parent of \`Machine\`, and \`Machine\` is the parent of every \`Gear\`.

        :::mistake
        Never **define** a component inside another component:

        \`\`\`jsx
        function Machine() {
          function Gear() { ... }   // ❌ a brand-new Gear on every render
          return <Gear />;
        }
        \`\`\`

        React sees a *different* \`Gear\` every time \`Machine\` renders, so it throws the old
        one away and rebuilds it from scratch: slow, and anything stored inside is lost.
        Define every component at the **top level** of the file, then *use* them inside each other.
        :::

        ## Sharing components: named vs default exports

        In a real project components live in separate files and travel between them with
        \`export\` and \`import\`. There are two flavours:

        \`\`\`Forge.jsx
        export function Gear() { ... }             // named export: as many as you like
        export default function Machine() { ... }  // default export: at most one per file
        \`\`\`

        \`\`\`App.jsx
        import Machine, { Gear } from './Forge.jsx';
        \`\`\`

        - A **default** import has no braces, and you may call it anything: \`import Machine from './Forge.jsx'\`
        - A **named** import uses braces and must match the exported name: \`import { Gear } from './Forge.jsx'\`

        A common habit: a file's main component is its default export, small helpers are named exports.

        :::tip
        In Reactoria your whole program lives in one file, and the \`export default\` component
        is what the preview shows. The forge inspector (the quest checks) also tests your
        **named exports** one at a time, so when a task says \`export function Gear\`, keep the \`export\`!
        :::
      `,
      task: md`
        ## 🎯 Repair the Great Bellows

        1. Create a component named \`Gear\` and export it: \`export function Gear() { ... }\`. It returns \`<span className="gear">⚙️</span>\`.
        2. Create a component named \`Machine\`, also exported. It returns a \`<div className="machine">\` containing **three** \`<Gear />\` elements.
        3. In \`App\`, render \`<Machine />\` right below the \`<h1>\`.

        Use the \`<Gear />\` tag three times. Don't copy-paste the \`<span>\`: that's what molds are for!
      `,
      starter: code`
        // 1. Forge the Gear mold here (remember to export it!)


        // 2. Forge the Machine here (export it too!)


        export default function App() {
          return (
            <main className="forge">
              <h1>The Great Bellows</h1>
              {/* 3. Render the Machine here */}
            </main>
          );
        }
      `,
      solution: code`
        export function Gear() {
          return <span className="gear">⚙️</span>;
        }

        export function Machine() {
          return (
            <div className="machine">
              <Gear />
              <Gear />
              <Gear />
            </div>
          );
        }

        export default function App() {
          return (
            <main className="forge">
              <h1>The Great Bellows</h1>
              <Machine />
            </main>
          );
        }
      `,
      hints: [
        md`A component is a function with a Capitalized name that returns JSX. Put \`export\` in front so the inspector can find it: \`export function Gear() { return ...; }\``,
        md`Inside \`Machine\`, use the gear like a tag: \`<Gear />\`. Wrap three of them in a \`<div className="machine">...</div>\` and return it.`,
        md`
          The finished Machine:

          \`\`\`jsx
          export function Machine() {
            return (
              <div className="machine">
                <Gear />
                <Gear />
                <Gear />
              </div>
            );
          }
          \`\`\`

          Then add \`<Machine />\` under the \`<h1>\` in \`App\`.
        `,
      ],
      tests: [
        test('Gear is exported and returns <span className="gear">⚙️</span>', (t) => {
          const Gear = exported(t, 'Gear', 'Create it with "export function Gear() { ... }" (the word export matters).');
          t.renderComponent(Gear);
          const span = t.$('span.gear');
          t.expect(span, `Gear rendered ${clip(t.html())}. Expected <span className="gear">⚙️</span>.`);
          t.expect(norm(span.textContent) === norm('⚙️'), `The gear span contains "${norm(span.textContent)}". Put the ⚙️ emoji inside it.`);
        }),
        test('Machine is exported and holds three <Gear /> components', (t) => {
          const Machine = exported(t, 'Machine', 'Create it with "export function Machine() { ... }".');
          t.renderComponent(Machine);
          t.expectElement('div.machine', `Machine rendered ${clip(t.html())}. Expected a <div className="machine"> around the gears.`);
          const n = t.count('.machine .gear');
          t.expect(n === 3, `The machine holds ${n} gear(s) but needs exactly 3. Put three <Gear /> tags inside the <div className="machine">.`);
          const tags = (t.source.match(/<Gear[\s/>]/g) || []).length;
          t.expect(tags >= 3, `Your code uses the <Gear /> tag ${tags} time(s). Reuse the mold: write <Gear /> three times instead of copying the <span>.`);
        }),
        test('App shows the heading with the machine below it', (t) => {
          t.render();
          const h1 = t.$('h1');
          t.expect(h1 && norm(h1.textContent) === 'The Great Bellows', 'Keep the <h1>The Great Bellows</h1> heading in App.');
          const machine = t.$('.machine');
          t.expect(machine, 'App does not show the machine yet. Add <Machine /> right below the <h1>.');
          t.expect(t.count('.machine .gear') === 3, `The machine in App holds ${t.count('.machine .gear')} gear(s); it should hold 3.`);
          t.expect(h1.compareDocumentPosition(machine) & 4, 'Put <Machine /> below the <h1>, not above it.');
        }),
      ],
      concepts: [
        {
          id: 'forge-nesting',
          icon: '🪆',
          title: 'Nesting components',
          summary: 'Components render other components, forming a tree of parents and children.',
          snippet: code`
            function Machine() {
              return (
                <div className="machine">
                  <Gear />
                  <Gear />
                </div>
              );
            }
          `,
          detail: 'Define every component at the top level of a file, never inside another component, and use them inside each other like tags.',
        },
        {
          id: 'forge-exports',
          icon: '📤',
          title: 'Named & default exports',
          summary: 'One default export per file; as many named exports as you like.',
          snippet: code`
            export function Gear() { ... }             // import { Gear } from './Forge.jsx'
            export default function Machine() { ... }  // import Machine from './Forge.jsx'
          `,
        },
      ],
      css: `
        .forge { text-align: center; padding: 8px; }
        .forge h1 { color: #9a3412; }
        .machine {
          display: inline-flex; gap: 12px; padding: 16px 26px;
          background: linear-gradient(#57534e, #1c1917);
          border: 3px solid #f97316; border-radius: 18px;
          box-shadow: 0 0 26px rgba(249, 115, 22, 0.45);
        }
        .gear { font-size: 44px; display: inline-block; animation: forge-spin 3s linear infinite; }
        .gear:nth-child(even) { animation-direction: reverse; }
        @keyframes forge-spin { to { transform: rotate(360deg); } }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'forge-props',
      type: 'code',
      title: 'Stamped with Props',
      blurb: 'One Blade mold, three different blades: pass data in with props.',
      xp: 120,
      story: [
        { text: 'Hilda forged three fine blades... and every single one came out stamped "Nameless blade". A mold that can only make one thing is not much of a mold!', mood: 'worried' },
        { text: 'Props are how a parent hands data to a child, like stamping a name onto a blade as it leaves the mold. Same mold, different stamps!', mood: 'happy' },
      ],
      lesson: md`
        ## Props: arguments for components

        A component is a function, and **props** are its arguments. You pass them like
        HTML attributes:

        \`\`\`jsx
        <Blade name="Ember Edge" damage={12} />
        \`\`\`

        React gathers every attribute into **one object** and hands it to your component
        as its first parameter, usually called \`props\`:

        \`\`\`jsx
        function Blade(props) {
          // props is { name: 'Ember Edge', damage: 12 }
          return (
            <div className="blade">
              <h3>{props.name}</h3>
              <p>Damage: {props.damage}</p>
            </div>
          );
        }
        \`\`\`

        Now one mold makes many different blades:

        \`\`\`jsx
        <Blade name="Ember Edge" damage={12} />
        <Blade name="Frost Fang" damage={9} />
        \`\`\`

        ## Quotes for strings, braces for everything else

        - **Strings** can use quotes: \`name="Frost Fang"\`
        - **Everything else** goes in braces: numbers \`damage={9}\`, variables \`owner={hero}\`, expressions \`price={9 * 2}\`

        :::mistake
        \`damage="12"\` passes the **string** \`"12"\`, not the number 12. It *looks* fine on
        screen, until you do math with it: \`"12" + 2\` is \`"122"\`! Numbers go in braces: \`damage={12}\`.
        :::

        ## Props work in any expression

        Props are ordinary JavaScript values, so everything you know about braces still works:

        \`\`\`jsx
        <p>Sharpened: {props.damage + 2}</p>
        <p>{props.name.toUpperCase()}</p>
        \`\`\`

        ## Destructuring: the shortcut everyone uses

        Typing \`props.\` everywhere gets old. JavaScript **destructuring** unpacks the values
        right in the parameter list:

        \`\`\`jsx
        function Blade({ name, damage }) {
          return <h3>{name} deals {damage}</h3>;
        }
        \`\`\`

        That means exactly the same as \`function Blade(props)\` followed by
        \`const name = props.name;\` and \`const damage = props.damage;\`. Most React code you
        will read is written this way. In this quest, use whichever style you like.

        :::tip
        Props flow **one way**: from parent down to child. A child reads its props; it never
        reaches up to change them. (How children *talk back* to parents comes later, in the State Springs.)
        :::
      `,
      task: md`
        ## 🎯 Stamp the blades

        \`Blade\` ignores its props, so every blade looks the same. Fix it:

        1. The \`<h3>\` shows the blade's \`name\` prop.
        2. The \`<p className="damage">\` shows **Damage: X**, where X is the \`damage\` prop.
        3. The \`<p className="sharpened">\` shows **Sharpened: Y**, where Y is the damage **+ 2**.
        4. In \`App\`, give the three blades these props, in this order (numbers in braces!):

        | name | damage |
        |---|---|
        | Ember Edge | 12 |
        | Frost Fang | 9 |
        | Storm Splitter | 15 |
      `,
      starter: code`
        export function Blade(props) {
          // TODO: use props.name and props.damage instead of the placeholders
          return (
            <div className="blade">
              <h3>Nameless blade</h3>
              <p className="damage">Damage: ?</p>
              <p className="sharpened">Sharpened: ?</p>
            </div>
          );
        }

        export default function App() {
          return (
            <section className="rack">
              <h2>⚔️ Weapon rack</h2>
              {/* TODO: give each blade a name and a damage prop */}
              <Blade />
              <Blade />
              <Blade />
            </section>
          );
        }
      `,
      solution: code`
        export function Blade(props) {
          return (
            <div className="blade">
              <h3>{props.name}</h3>
              <p className="damage">Damage: {props.damage}</p>
              <p className="sharpened">Sharpened: {props.damage + 2}</p>
            </div>
          );
        }

        export default function App() {
          return (
            <section className="rack">
              <h2>⚔️ Weapon rack</h2>
              <Blade name="Ember Edge" damage={12} />
              <Blade name="Frost Fang" damage={9} />
              <Blade name="Storm Splitter" damage={15} />
            </section>
          );
        }
      `,
      hints: [
        md`The \`props\` object holds everything the parent passed. Show a value with braces: \`<h3>{props.name}</h3>\`.`,
        md`Math works on props: \`Sharpened: {props.damage + 2}\`. In \`App\`, pass props like attributes: \`<Blade name="Ember Edge" damage={12} />\`.`,
        md`If a blade shows **Sharpened: 122**, its damage arrived as the string \`"12"\`. Write \`damage={12}\` (braces), not \`damage="12"\` (quotes).`,
      ],
      tests: [
        test('Blade shows the name it receives', (t) => {
          const Blade = exported(t, 'Blade', 'Keep "export function Blade(props)" in your code.');
          t.renderComponent(Blade, { name: 'Test Dagger', damage: 4 });
          const text = textOf(t, 'h3');
          t.expect(text === 'Test Dagger', `We passed name="Test Dagger" but the <h3> says "${text}". Show the prop with {props.name}.`);
        }),
        test('The damage line reads "Damage: X" from the damage prop', (t) => {
          const Blade = exported(t, 'Blade', 'Keep "export function Blade(props)" in your code.');
          t.renderComponent(Blade, { name: 'Test Dagger', damage: 4 });
          const text = textOf(t, '.damage');
          t.expect(text === 'Damage: 4', `We passed damage={4} but .damage says "${text}". Expected "Damage: 4": use {props.damage}.`);
        }),
        test('The sharpened line shows the damage + 2', (t) => {
          const Blade = exported(t, 'Blade', 'Keep "export function Blade(props)" in your code.');
          t.renderComponent(Blade, { name: 'Test Dagger', damage: 4 });
          const text = textOf(t, '.sharpened');
          t.expect(text === 'Sharpened: 6', `With damage={4}, .sharpened says "${text}". Expected "Sharpened: 6": compute it in braces, {props.damage + 2}.`);
        }),
        test('App stamps Ember Edge (12), Frost Fang (9) and Storm Splitter (15)', (t) => {
          t.render();
          const blades = t.$$('.blade');
          t.expect(blades.length === 3, `App shows ${blades.length} blade(s). Expected 3.`);
          const expected = [
            ['Ember Edge', 12],
            ['Frost Fang', 9],
            ['Storm Splitter', 15],
          ];
          expected.forEach(([name, dmg], i) => {
            const blade = blades[i];
            const title = norm(blade.querySelector('h3')?.textContent);
            t.expect(title === name, `Blade ${i + 1} is called "${title}". Expected "${name}": pass name="${name}".`);
            const damage = norm(blade.querySelector('.damage')?.textContent);
            t.expect(damage === `Damage: ${dmg}`, `${name} shows "${damage}". Expected "Damage: ${dmg}": pass damage={${dmg}}.`);
            const sharp = norm(blade.querySelector('.sharpened')?.textContent);
            if (sharp === `Sharpened: ${dmg}2`)
              t.fail(`${name} shows "${sharp}". Its damage arrived as the string "${dmg}", and "${dmg}" + 2 is "${dmg}2"! Pass numbers in braces: damage={${dmg}}.`);
            t.expect(sharp === `Sharpened: ${dmg + 2}`, `${name} shows "${sharp}". Expected "Sharpened: ${dmg + 2}".`);
          });
        }),
      ],
      concepts: [
        {
          id: 'forge-props',
          icon: '📦',
          title: 'Props',
          summary: 'Data a parent passes to a child, written like attributes on a tag.',
          snippet: code`
            <Blade name="Ember Edge" damage={12} />

            function Blade(props) {
              return <h3>{props.name}: {props.damage}</h3>;
            }
          `,
          detail: 'React gathers all attributes into one props object and passes it as the first argument. Strings may use quotes; everything else goes in braces.',
        },
        {
          id: 'forge-destructuring',
          icon: '🧰',
          title: 'Destructuring props',
          summary: 'Unpack props right in the parameter list: function Blade({ name, damage }).',
          snippet: code`
            function Blade({ name, damage }) {
              return <h3>{name} deals {damage}</h3>;
            }
          `,
        },
      ],
      css: `
        .rack { background: #1c1917; color: #fafaf9; border-radius: 16px; padding: 14px 18px; }
        .rack h2 { color: #fdba74; }
        .blade {
          display: inline-block; vertical-align: top; width: 150px; margin: 6px; padding: 10px 12px;
          border-radius: 12px; background: linear-gradient(160deg, #f5f5f4, #a8a29e); color: #1c1917;
          box-shadow: 0 4px 0 #57534e;
        }
        .blade h3 { margin: 0 0 6px; color: #7c2d12; font-size: 1.05em; }
        .blade p { margin: 2px 0; font-size: 0.9em; }
        .sharpened { color: #c2410c; font-weight: 700; }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'forge-order-board',
      type: 'code',
      title: 'The Order Board',
      blurb: 'Objects, booleans, functions and defaults: props can carry anything.',
      xp: 140,
      story: [
        { text: 'Orders are pouring in now that the forge is warming up! Every ticket on the board is an Order component.', mood: 'excited' },
        { text: 'But orders carry all sorts of things: text, numbers, a whole customer object, a yes-or-no flag, even a function. Props can hold ANY JavaScript value!', mood: 'happy' },
        { text: 'Oh, and some customers forget to write a quantity. Give it a sensible default so the board never shows a blank.', mood: 'thinking' },
      ],
      lesson: md`
        ## Props can be any value

        Strings and numbers are just the start. A prop can hold **any** JavaScript value:

        \`\`\`jsx
        const hilda = { name: 'Hilda', guild: 'Hammerhand Smiths' };

        <Order
          item="Iron Helm"                  // string
          qty={2}                           // number
          customer={hilda}                  // object
          paid={true}                       // boolean
          formatPrice={(n) => n + ' gold'}  // function
        />
        \`\`\`

        ### Objects

        Pass a whole object and read its fields inside: \`{customer.name}\`. One object
        prop is often tidier than five separate ones.

        ### Booleans

        Booleans are perfect for yes/no settings. You can pass them straight into HTML
        attributes that expect true or false, like \`disabled\`:

        \`\`\`jsx
        <button disabled={paid}>Collect payment</button>
        \`\`\`

        A prop written with **no value** is \`true\`, so these two lines are identical:

        \`\`\`jsx
        <Order item="Tongs" paid={true} />
        <Order item="Tongs" paid />
        \`\`\`

        ### Functions as data

        A function prop lets the *parent* decide how something is done. The child just calls it:

        \`\`\`jsx
        function Order({ qty, formatPrice }) {
          return <p className="price">{formatPrice(qty * 10)}</p>;
        }

        <Order qty={2} formatPrice={(n) => n + ' gold'} />   // shows "20 gold"
        <Order qty={2} formatPrice={(n) => '🪙 ' + n} />      // shows "🪙 20"
        \`\`\`

        Same component, two ways of showing a price: the parent picks.

        ## Default values

        If a parent leaves a prop out, its value is \`undefined\`, and \`{undefined}\` renders
        nothing, leaving a hole in your UI. Destructuring lets you give a **default value**:

        \`\`\`jsx
        function Order({ item, qty = 1, paid = false }) {
          return <h3>{item} × {qty}</h3>;
        }

        <Order item="Nails" />           // qty is 1, paid is false
        <Order item="Nails" qty={50} />  // qty is 50
        \`\`\`

        The default only kicks in when the prop is **missing** (\`undefined\`). Passing
        \`qty={0}\` keeps 0.

        :::mistake
        Defaults belong in the destructuring pattern, \`{ qty = 1 }\`, not on the tag.
        Writing \`<Order qty />\` passes \`true\`, not 1!
        :::

        :::tip
        Destructuring with defaults at the top of a component reads like a little contract:
        one glance tells you every prop the component understands.
        :::
      `,
      task: md`
        ## 🎯 Fill the order board

        \`Order\` only reads \`props.item\` so far. Make it handle every kind of prop:

        1. Unpack the props with destructuring: \`{ item, qty = 1, customer, paid = false, formatPrice }\`. That also gives **qty** a default of **1** and **paid** a default of **false**.
        2. The \`<h3 className="item">\` shows **ITEM × QTY**, e.g. **Iron Helm × 2**.
        3. The \`<p className="customer">\` shows **For NAME of the GUILD** from the \`customer\` object, e.g. **For Hilda of the Hammerhand Smiths**.
        4. The \`<p className="price">\` shows the result of calling \`formatPrice(qty * 10)\` (10 gold per piece).
        5. The **Collect payment** button is \`disabled\` when the order is \`paid\`.
        6. In \`App\`, mark the third order (Ember Tongs) as paid with the boolean shorthand: just write \`paid\`.
      `,
      starter: code`
        const hilda = { name: 'Hilda', guild: 'Hammerhand Smiths' };
        const bram = { name: 'Bram', guild: 'Lantern Keepers' };

        // TODO 1: destructure the props, with defaults for qty and paid
        export function Order(props) {
          return (
            <article className="order">
              <h3 className="item">{props.item} × ?</h3>
              <p className="customer">For ??? of the ???</p>
              <p className="price">???</p>
              <button className="collect">💰 Collect payment</button>
            </article>
          );
        }

        export default function App() {
          return (
            <section className="board">
              <h2>📜 Order board</h2>
              <Order item="Iron Helm" qty={2} customer={hilda} formatPrice={(n) => n + ' gold'} />
              <Order item="Lantern Hook" customer={bram} formatPrice={(n) => '🪙 ' + n} />
              {/* TODO 6: this order is already paid */}
              <Order item="Ember Tongs" qty={3} customer={hilda} formatPrice={(n) => n + ' gold'} />
            </section>
          );
        }
      `,
      solution: code`
        const hilda = { name: 'Hilda', guild: 'Hammerhand Smiths' };
        const bram = { name: 'Bram', guild: 'Lantern Keepers' };

        export function Order({ item, qty = 1, customer, paid = false, formatPrice }) {
          return (
            <article className="order">
              <h3 className="item">{item} × {qty}</h3>
              <p className="customer">For {customer.name} of the {customer.guild}</p>
              <p className="price">{formatPrice(qty * 10)}</p>
              <button className="collect" disabled={paid}>💰 Collect payment</button>
            </article>
          );
        }

        export default function App() {
          return (
            <section className="board">
              <h2>📜 Order board</h2>
              <Order item="Iron Helm" qty={2} customer={hilda} formatPrice={(n) => n + ' gold'} />
              <Order item="Lantern Hook" customer={bram} formatPrice={(n) => '🪙 ' + n} />
              <Order item="Ember Tongs" qty={3} customer={hilda} formatPrice={(n) => n + ' gold'} paid />
            </section>
          );
        }
      `,
      hints: [
        md`Replace \`(props)\` with a destructuring pattern: \`function Order({ item, qty = 1, customer, paid = false, formatPrice })\`. Then use the names directly: \`{item} × {qty}\`.`,
        md`\`customer\` is an object: \`For {customer.name} of the {customer.guild}\`. \`formatPrice\` is a function, so call it: \`{formatPrice(qty * 10)}\`.`,
        md`Booleans go straight into attributes: \`<button className="collect" disabled={paid}>\`. In \`App\`, add the word \`paid\` to the Ember Tongs tag: \`<Order item="Ember Tongs" ... paid />\`.`,
      ],
      tests: [
        test('The heading shows "ITEM × QTY"', (t) => {
          const Order = exported(t, 'Order', 'Keep "export function Order(...)" in your code.');
          t.renderComponent(Order, orderProps());
          const text = textOf(t, '.item');
          t.expect(text === 'Test Anvil × 4', `With item="Test Anvil" and qty={4}, the .item heading says "${text}". Expected "Test Anvil × 4".`);
        }),
        test('qty defaults to 1 when it is left out', (t) => {
          const Order = exported(t, 'Order', 'Keep "export function Order(...)" in your code.');
          const props = orderProps();
          delete props.qty;
          t.renderComponent(Order, props);
          const text = textOf(t, '.item');
          t.expect(text === 'Test Anvil × 1', `Without a qty prop the heading says "${text}". Expected "Test Anvil × 1": give qty a default, function Order({ item, qty = 1, ... }).`);
        }),
        test('The customer object shows as "For NAME of the GUILD"', (t) => {
          const Order = exported(t, 'Order', 'Keep "export function Order(...)" in your code.');
          t.renderComponent(Order, orderProps());
          const text = textOf(t, '.customer');
          t.expect(text === 'For Zed of the Test Guild', `With customer={{ name: 'Zed', guild: 'Test Guild' }}, .customer says "${text}". Expected "For Zed of the Test Guild": read {customer.name} and {customer.guild}.`);
        }),
        test('The price comes from calling formatPrice(qty * 10)', (t) => {
          const Order = exported(t, 'Order', 'Keep "export function Order(...)" in your code.');
          t.renderComponent(Order, orderProps());
          const text = textOf(t, '.price');
          t.expect(text === '40 test-coins', `We passed qty={4} and formatPrice={(n) => n + ' test-coins'}, so .price should say "40 test-coins". It says "${text}". Call the function prop: {formatPrice(qty * 10)}.`);
          const props = orderProps();
          delete props.qty;
          t.renderComponent(Order, props);
          const fallback = textOf(t, '.price');
          t.expect(fallback === '10 test-coins', `Without a qty, the price should use the default qty of 1 and say "10 test-coins". It says "${fallback}".`);
        }),
        test('Paid orders disable the Collect button, and Ember Tongs is paid', (t) => {
          const Order = exported(t, 'Order', 'Keep "export function Order(...)" in your code.');
          t.renderComponent(Order, orderProps({ paid: true }));
          const button = t.$('button');
          t.expect(button, 'The Collect payment <button> is missing from Order. Keep it in the JSX.');
          t.expect(button.disabled, 'With paid={true}, the Collect payment button should be disabled. Pass the boolean through: <button disabled={paid}>.');
          t.renderComponent(Order, orderProps());
          t.expect(!t.$('button').disabled, 'Without a paid prop, the button should be enabled: paid defaults to false.');
          t.render();
          const buttons = t.$$('.order button');
          t.expect(buttons.length === 3, `App shows ${buttons.length} order button(s). Keep all three orders.`);
          t.expect(!buttons[0].disabled && !buttons[1].disabled, 'Only the third order (Ember Tongs) is paid. The first two buttons should stay enabled.');
          t.expect(buttons[2].disabled, 'Mark the Ember Tongs order as paid with the boolean shorthand: <Order item="Ember Tongs" ... paid />.');
        }),
      ],
      concepts: [
        {
          id: 'forge-prop-types',
          icon: '🎁',
          title: 'Props of any type',
          summary: 'Strings, numbers, booleans, objects, arrays, functions and even JSX can be props.',
          snippet: code`
            <Order
              item="Iron Helm"
              qty={2}
              customer={hilda}
              paid
              formatPrice={(n) => n + ' gold'}
            />
          `,
          detail: 'A prop with no value (paid) means true. A function prop lets the parent decide how the child does something.',
        },
        {
          id: 'forge-default-props',
          icon: '🧷',
          title: 'Default prop values',
          summary: 'function Order({ qty = 1 }): used whenever the prop is missing.',
          snippet: code`
            function Order({ item, qty = 1, paid = false }) {
              return <h3>{item} × {qty}</h3>;
            }
          `,
        },
      ],
      css: `
        .board { background: #a16207; padding: 14px; border-radius: 12px; display: grid; gap: 12px; }
        .board h2 { color: #fef3c7; margin: 0; }
        .order {
          background: #fffbeb; border-radius: 6px; padding: 10px 14px;
          box-shadow: 0 4px 0 rgba(0, 0, 0, 0.25); transform: rotate(-0.6deg);
        }
        .order:nth-of-type(even) { transform: rotate(0.7deg); }
        .order h3 { margin: 0 0 4px; color: #78350f; }
        .order p { margin: 2px 0; }
        .price { font-weight: 700; color: #b45309; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'forge-gem-setter',
      type: 'code',
      title: 'The Gem Setter',
      blurb: 'Build a Frame that wraps anything: children and JSX as props.',
      xp: 140,
      story: [
        { text: "Meet Mirabel, the forge's jeweller. Her golden frames are famous, and a good frame doesn't care WHAT you put inside it.", mood: 'happy' },
        { text: "In React that superpower is called children: whatever you nest between a component's tags is handed to it. Let's build a Frame that can hold anything!", mood: 'excited' },
      ],
      lesson: md`
        ## The children prop

        So far our components were self-closing: \`<Blade />\`. But you can also nest content
        between a component's opening and closing tags, just like with a \`<div>\`:

        \`\`\`jsx
        <Frame title="Ruby of Rendering">
          <p>Glows whenever a component returns JSX.</p>
        </Frame>
        \`\`\`

        Whatever sits between the tags arrives in a special prop called \`children\`.
        The component decides where to put it:

        \`\`\`jsx
        function Frame({ title, children }) {
          return (
            <section className="frame">
              <h3 className="frame-title">{title}</h3>
              <div className="frame-body">{children}</div>
            </section>
          );
        }
        \`\`\`

        \`children\` can be text, one element, many elements or other components. \`Frame\`
        doesn't need to know: it just wraps them. Building bigger things by fitting
        smaller pieces together like this is called **composition**. Cards, panels,
        dialogs and page layouts are usually made this way.

        ## JSX is a value, so it can be any prop

        JSX produces ordinary JavaScript objects, so you can pass JSX in **any** prop, not just
        \`children\`. That's handy when a component has more than one "slot" to fill:

        \`\`\`jsx
        function Frame({ title, icon, children }) {
          return (
            <section className="frame">
              <h3 className="frame-title">{icon} {title}</h3>
              <div className="frame-body">{children}</div>
            </section>
          );
        }

        <Frame title="Amulet of Props" icon={<span className="gem">📿</span>}>
          <p>Carries data from parent to child.</p>
        </Frame>
        \`\`\`

        :::mistake
        If a component forgets to render \`{children}\`, whatever you nest inside it silently
        disappears. No error, just... nothing. If your content vanished, check that
        \`{children}\` is somewhere in the returned JSX!
        :::

        ## Spreading props (a quick peek)

        Sometimes you already have the props in an object. The **spread syntax** \`{...obj}\`
        turns every key of the object into a prop:

        \`\`\`jsx
        const ruby = { title: 'Ruby of Rendering', icon: '💎' };

        <Frame {...ruby} />
        // same as: <Frame title="Ruby of Rendering" icon="💎" />
        \`\`\`

        It's also used to forward props: \`function Box(props) { return <div className="box" {...props} />; }\`.
        Use it with care, because it hides which props are actually being passed.

        :::pro
        React apps rarely build components by "inheriting" from other components. They
        **compose** instead: \`<Frame><Ruby /></Frame>\` puts one piece inside another.
        :::
      `,
      task: md`
        ## 🎯 Set the gems

        ### 1. Finish the \`Frame\` component

        It receives \`title\`, \`icon\` and \`children\`, and returns a \`<section className="frame">\` with:

        - an \`<h3 className="frame-title">\` showing the \`icon\` first, then the \`title\`
        - a \`<div className="frame-body">\` that renders the \`children\`

        ### 2. Frame a second treasure in \`App\`

        The Ruby is already framed. Below it, add a \`<Frame>\` for the amulet:

        - \`title\`: **Amulet of Props**
        - \`icon\`: the JSX \`<span className="gem">📿</span>\`
        - children: a \`<p>\` saying **Carries data from parent to child.** and a \`<p className="price">\` saying **Price: 300 gold**
      `,
      starter: code`
        // Mirabel's frame: it should wrap ANY content you put inside it.
        export function Frame(props) {
          // TODO: show the icon and title, and render the children in .frame-body
          return (
            <section className="frame">
              <h3 className="frame-title">Untitled</h3>
              <div className="frame-body">(empty)</div>
            </section>
          );
        }

        export default function App() {
          return (
            <div className="gallery">
              <Frame title="Ruby of Rendering" icon={<span className="gem">💎</span>}>
                <p>Glows whenever a component returns JSX.</p>
              </Frame>
              {/* TODO: frame the Amulet of Props here */}
            </div>
          );
        }
      `,
      solution: code`
        export function Frame({ title, icon, children }) {
          return (
            <section className="frame">
              <h3 className="frame-title">{icon} {title}</h3>
              <div className="frame-body">{children}</div>
            </section>
          );
        }

        export default function App() {
          return (
            <div className="gallery">
              <Frame title="Ruby of Rendering" icon={<span className="gem">💎</span>}>
                <p>Glows whenever a component returns JSX.</p>
              </Frame>
              <Frame title="Amulet of Props" icon={<span className="gem">📿</span>}>
                <p>Carries data from parent to child.</p>
                <p className="price">Price: 300 gold</p>
              </Frame>
            </div>
          );
        }
      `,
      hints: [
        md`Destructure all three props: \`function Frame({ title, icon, children })\`. Then place them: \`<h3 className="frame-title">{icon} {title}</h3>\`.`,
        md`\`children\` is rendered like any other value: \`<div className="frame-body">{children}</div>\`.`,
        md`
          The amulet frame in \`App\`:

          \`\`\`jsx
          <Frame title="Amulet of Props" icon={<span className="gem">📿</span>}>
            <p>Carries data from parent to child.</p>
            <p className="price">Price: 300 gold</p>
          </Frame>
          \`\`\`
        `,
      ],
      tests: [
        test('Frame shows its title in the .frame-title heading', (t) => {
          const Frame = exported(t, 'Frame', 'Keep "export function Frame(...)" in your code.');
          t.renderComponent(Frame, { title: 'Test Relic' });
          const h3 = t.$('h3.frame-title');
          t.expect(h3, `Frame rendered ${clip(t.html())}. Expected an <h3 className="frame-title"> inside it.`);
          t.expect(norm(h3.textContent).includes('Test Relic'), `We passed title="Test Relic" but the heading says "${norm(h3.textContent)}". Show {title} in the <h3>.`);
        }),
        test('Frame puts the JSX icon prop before the title', (t) => {
          const Frame = exported(t, 'Frame', 'Keep "export function Frame(...)" in your code.');
          t.renderComponent(Frame, { title: 'Test Relic', icon: t.h('i', { className: 'probe-icon' }, '★') });
          t.expect(t.$('.frame-title .probe-icon'), 'We passed icon={<i className="probe-icon">★</i>} but it is not inside the .frame-title heading. Render {icon} in the <h3>.');
          const text = textOf(t, '.frame-title').replace(/\s/g, '');
          t.expect(text === '★TestRelic', `The heading reads "${textOf(t, '.frame-title')}". Expected the icon first, then the title: "★ Test Relic".`);
        }),
        test('Frame wraps whatever children it receives in .frame-body', (t) => {
          const Frame = exported(t, 'Frame', 'Keep "export function Frame(...)" in your code.');
          t.render(t.h(Frame, { title: 'Test Relic' }, t.h('em', { className: 'probe-a' }, 'anything'), t.h('b', { className: 'probe-b' }, 'at all')));
          const body = t.$('.frame-body');
          t.expect(body, 'Frame needs a <div className="frame-body"> for its children.');
          t.expect(
            body.querySelector('.probe-a') && body.querySelector('.probe-b'),
            `We nested <em>anything</em> <b>at all</b> inside <Frame>, but .frame-body contains "${norm(body.textContent)}". Render {children} inside the <div className="frame-body">.`,
          );
        }),
        test('App frames the Ruby and the Amulet of Props', (t) => {
          t.render();
          const frames = t.$$('.frame');
          t.expect(frames.length === 2, `App shows ${frames.length} frame(s). Expected 2: the Ruby and the Amulet.`);
          const amulet = frames[1];
          const title = norm(amulet.querySelector('.frame-title')?.textContent);
          t.expect(title.includes('Amulet of Props'), `The second frame's title is "${title}". Expected "Amulet of Props".`);
          const gem = amulet.querySelector('.frame-title .gem');
          t.expect(gem && norm(gem.textContent) === norm('📿'), 'Pass the amulet icon as JSX: icon={<span className="gem">📿</span>}.');
          const body = amulet.querySelector('.frame-body');
          t.expect(body && norm(body.textContent).includes('Carries data from parent to child.'), 'Nest <p>Carries data from parent to child.</p> inside the amulet frame.');
          const price = body.querySelector('.price');
          t.expect(price && norm(price.textContent) === 'Price: 300 gold', 'Nest <p className="price">Price: 300 gold</p> inside the amulet frame too.');
        }),
      ],
      concepts: [
        {
          id: 'forge-children',
          icon: '🖼️',
          title: 'The children prop',
          summary: 'Content nested between <Comp>…</Comp> arrives as props.children.',
          snippet: code`
            function Frame({ title, children }) {
              return (
                <section>
                  <h3>{title}</h3>
                  {children}
                </section>
              );
            }
          `,
          detail: 'Wrapping arbitrary content like this is called composition: it is how cards, panels and layouts are built.',
        },
        {
          id: 'forge-jsx-props',
          icon: '💎',
          title: 'JSX as props',
          summary: 'JSX is a value, so any prop can hold it: icon={<Gem />}.',
          snippet: code`
            <Frame title="Amulet" icon={<span>📿</span>}>
              <p>Carries data.</p>
            </Frame>
          `,
        },
        {
          id: 'forge-spread',
          icon: '🫗',
          title: 'Spreading props',
          summary: '<Frame {...ruby} /> turns every key of ruby into a prop.',
          snippet: code`
            const ruby = { title: 'Ruby', icon: '💎' };
            <Frame {...ruby} />  // = <Frame title="Ruby" icon="💎" />
          `,
        },
      ],
      css: `
        .gallery { display: grid; gap: 14px; }
        .frame {
          border: 6px double #d4a017; border-radius: 14px; background: #fffdf5; padding: 10px 16px;
          box-shadow: 0 0 0 3px #fff3c4, 0 6px 16px rgba(180, 120, 0, 0.25);
        }
        .frame-title { margin: 0 0 6px; color: #7c4a03; }
        .gem { display: inline-block; animation: forge-glint 2.4s ease-in-out infinite; }
        @keyframes forge-glint { 50% { transform: scale(1.2) rotate(-8deg); filter: drop-shadow(0 0 6px #fde68a); } }
        .frame-body { color: #3f3f46; }
        .price { font-weight: 700; color: #a16207; }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'forge-cursed-whetstone',
      type: 'bug',
      title: 'The Cursed Whetstone',
      blurb: 'Bug hunt! Two components change things while they render. Make them pure.',
      xp: 150,
      story: [
        { text: "Something is wrong with the whetstone. The blade's label should say sharpness 3, but it says 5: the stone changed the blade itself while it was rendering!", mood: 'worried' },
        { text: "And the ticket printer is cursed too. The customer copy shows different numbers than the original. Same component, same props, different result?!", mood: 'thinking' },
        { text: 'This is Mutator work: components changing things during render. Track down both curses and make the components PURE again!', mood: 'excited' },
      ],
      lesson: md`
        ## Rendering must be a pure calculation

        React may call your component **any number of times**: when it first appears, when
        its parent re-renders, when data changes... You don't control when or how often.
        So every component must behave like a maths formula:

        - **Same inputs, same output.** Given the same props, it returns the same JSX. Every time.
        - **No side effects during render.** It never changes anything that existed *before* it was called: no editing outside variables, no changing its props.

        A pure function in plain JavaScript only calculates:

        \`\`\`js
        function double(n) {
          return n * 2;          // ✅ same n in, same result out
        }
        \`\`\`

        An impure one changes the world around it:

        \`\`\`js
        let total = 0;
        function addToTotal(n) {
          total = total + n;     // ❌ changes something outside
          return total;          // different results for the same n!
        }
        \`\`\`

        ## Curse 1: changing outside variables

        \`\`\`jsx
        let guest = 0;

        function Cup() {
          guest = guest + 1;     // ❌ side effect during render
          return <p>Cup for guest #{guest}</p>;
        }
        \`\`\`

        Three cups show #1, #2, #3... until React renders again and they show #4, #5, #6!
        The output depends on how many times React *happened* to render. The cure is to pass
        the number in as a prop:

        \`\`\`jsx
        function Cup({ guest }) {
          return <p>Cup for guest #{guest}</p>;   // ✅ pure
        }

        <Cup guest={1} />
        <Cup guest={2} />
        \`\`\`

        ## Curse 2: changing props

        Props are **read-only**. A component must never change them: not \`props.x = ...\`,
        and not the fields of an object it received either:

        \`\`\`jsx
        function Sharpen({ blade }) {
          blade.sharpness = blade.sharpness + 2;   // ❌ mutates the parent's object!
          return <p>{blade.sharpness}</p>;
        }
        \`\`\`

        That object belongs to the parent, and other components may be showing it too.
        They would suddenly display the changed value, and every re-render adds another 2.
        Instead, **calculate a new value** in a local variable:

        \`\`\`jsx
        function Sharpen({ blade }) {
          const sharpened = blade.sharpness + 2;   // ✅ a new value; nothing changed
          return <p>{sharpened}</p>;
        }
        \`\`\`

        :::tip
        **Local** variables created *during* the render are fine to change: they're brand new
        on every call. What you must not touch is anything that existed before: outside
        variables, props, and objects or arrays you received.
        :::

        :::pro
        In development, React freezes the props object, so \`props.title = 'x'\` throws an error.
        And React's **StrictMode** renders every component twice in development, precisely to
        flush out impure components like the ones in this quest.
        :::
      `,
      task: md`
        ## 🐛 Lift the curses

        Two impure components hide in the forge. Look at the preview: the label shows the
        wrong sharpness, and the customer copy doesn't match the original tickets.

        1. **The whetstone changes the blade it receives.** Make \`Whetstone\` pure: compute the sharpened value (sharpness **+ 2**) in a local variable and show that. Never assign to \`blade.sharpness\`.
        2. **The tickets count themselves with an outside variable.** Delete \`ticketCount\` and give \`Ticket\` a \`number\` prop instead. In \`TicketRoll\`, pass \`number={1}\`, \`number={2}\` and \`number={3}\`.

        When the curses are lifted the screen shows the whetstone at **sharpness 5**, the label
        at **3**, and both rolls reading **#1, #2, #3**, no matter how many times React renders.
      `,
      starter: code`
        const emberEdge = { name: 'Ember Edge', sharpness: 3 };

        // 🐛 Curse 1: this component changes the blade it receives!
        export function Whetstone({ blade }) {
          blade.sharpness = blade.sharpness + 2;
          return (
            <p className="whetstone">
              🪨 {blade.name} sharpened to {blade.sharpness}
            </p>
          );
        }

        export function BladeLabel({ blade }) {
          return <p className="label">🏷️ Label: sharpness {blade.sharpness}</p>;
        }

        // 🐛 Curse 2: tickets count themselves with a variable outside the component!
        let ticketCount = 0;

        export function Ticket({ item }) {
          ticketCount = ticketCount + 1;
          return (
            <li className="ticket">
              Ticket #{ticketCount}: {item}
            </li>
          );
        }

        export function TicketRoll() {
          return (
            <ul className="tickets">
              <Ticket item="Iron Helm" />
              <Ticket item="Lantern Hook" />
              <Ticket item="Ember Tongs" />
            </ul>
          );
        }

        export default function App() {
          return (
            <main className="workbench">
              <h2>🪨 The whetstone</h2>
              <Whetstone blade={emberEdge} />
              <BladeLabel blade={emberEdge} />
              <h2>🎟️ Tickets</h2>
              <TicketRoll />
              <h2>🧾 Customer copy</h2>
              <TicketRoll />
            </main>
          );
        }
      `,
      solution: code`
        const emberEdge = { name: 'Ember Edge', sharpness: 3 };

        export function Whetstone({ blade }) {
          const sharpened = blade.sharpness + 2;
          return (
            <p className="whetstone">
              🪨 {blade.name} sharpened to {sharpened}
            </p>
          );
        }

        export function BladeLabel({ blade }) {
          return <p className="label">🏷️ Label: sharpness {blade.sharpness}</p>;
        }

        export function Ticket({ number, item }) {
          return (
            <li className="ticket">
              Ticket #{number}: {item}
            </li>
          );
        }

        export function TicketRoll() {
          return (
            <ul className="tickets">
              <Ticket number={1} item="Iron Helm" />
              <Ticket number={2} item="Lantern Hook" />
              <Ticket number={3} item="Ember Tongs" />
            </ul>
          );
        }

        export default function App() {
          return (
            <main className="workbench">
              <h2>🪨 The whetstone</h2>
              <Whetstone blade={emberEdge} />
              <BladeLabel blade={emberEdge} />
              <h2>🎟️ Tickets</h2>
              <TicketRoll />
              <h2>🧾 Customer copy</h2>
              <TicketRoll />
            </main>
          );
        }
      `,
      hints: [
        md`In \`Whetstone\`, the line \`blade.sharpness = ...\` changes an object that belongs to the parent. Replace it with a **new** local variable, \`const sharpened = blade.sharpness + 2;\`, and show \`{sharpened}\`.`,
        md`\`ticketCount\` lives outside the component and changes on every render: a side effect. Delete it (and the line that increases it), then read a prop instead: \`function Ticket({ number, item })\`.`,
        md`\`TicketRoll\` hands out the numbers: \`<Ticket number={1} item="Iron Helm" />\`, then \`number={2}\` and \`number={3}\`. The ticket shows \`Ticket #{number}: {item}\`.`,
      ],
      tests: [
        test('Whetstone shows sharpness + 2 without changing the blade', (t) => {
          const Whetstone = exported(t, 'Whetstone', 'Keep "export function Whetstone(...)" in your code.');
          const blade = { name: 'Test Blade', sharpness: 1 };
          t.renderComponent(Whetstone, { blade });
          t.expect(
            blade.sharpness === 1,
            `Whetstone changed the blade it was given: its sharpness went from 1 to ${blade.sharpness}. Props are read-only! Compute a local value instead: const sharpened = blade.sharpness + 2;`,
          );
          const text = textOf(t, '.whetstone');
          t.expect(text.endsWith('sharpened to 3'), `With sharpness 1, the whetstone says "${text}". Expected it to end with "sharpened to 3" (1 + 2).`);
        }),
        test('The label still shows the original sharpness: 3', (t) => {
          t.render();
          const label = textOf(t, '.label');
          t.expect(
            label.endsWith('sharpness 3'),
            `The label says "${label}" but should still say sharpness 3. Whetstone rendered first and changed the shared emberEdge object, so the label shows the changed value.`,
          );
          const stone = textOf(t, '.whetstone');
          t.expect(stone.endsWith('sharpened to 5'), `The whetstone says "${stone}". Expected it to end with "sharpened to 5" (3 + 2).`);
        }),
        test('Ticket shows the number it receives as a prop', (t) => {
          const Ticket = exported(t, 'Ticket', 'Keep "export function Ticket(...)" in your code.');
          t.renderComponent(Ticket, { number: 7, item: 'Test Axe' });
          const text = textOf(t, '.ticket');
          t.expect(
            text === 'Ticket #7: Test Axe',
            `We rendered <Ticket number={7} item="Test Axe" /> and got "${text}". Expected "Ticket #7: Test Axe": read the number from props, function Ticket({ number, item }).`,
          );
        }),
        test('Rendering again gives the same result (pure components)', (t) => {
          t.render();
          const first = t.text();
          const tickets = t.$$('.ticket').map((li) => norm(li.textContent));
          const roll = ['Ticket #1: Iron Helm', 'Ticket #2: Lantern Hook', 'Ticket #3: Ember Tongs'];
          t.expect(
            tickets.join(' | ') === [...roll, ...roll].join(' | '),
            `The tickets read: ${tickets.join(', ')}. Both rolls should read #1, #2, #3. A component that counts with an outside variable gives a different result every time it renders.`,
          );
          t.render();
          t.expect(
            t.text() === first,
            'The forge looked different after React rendered it a second time. A pure component returns the same JSX for the same props, every time. Remove any code that changes outside variables or props while rendering.',
          );
        }),
      ],
      concepts: [
        {
          id: 'forge-pure',
          icon: '🧪',
          title: 'Pure components',
          summary: 'Same props in, same JSX out, with no side effects during render.',
          snippet: code`
            // ✅ pure: only calculates
            function Cup({ guest }) {
              return <p>Cup for guest #{guest}</p>;
            }
          `,
          detail: 'React may render a component many times. If rendering changes outside variables, the screen depends on how often React happened to render.',
        },
        {
          id: 'forge-readonly-props',
          icon: '🔒',
          title: 'Props are read-only',
          summary: 'Never change props or objects you received; compute new values instead.',
          snippet: code`
            function Sharpen({ blade }) {
              const sharpened = blade.sharpness + 2;  // ✅ new value
              return <p>{sharpened}</p>;
            }
          `,
        },
      ],
      css: `
        .workbench { background: #292524; color: #fafaf9; border-radius: 14px; padding: 12px 18px; }
        .workbench h2 { color: #fdba74; font-size: 1.05em; margin: 12px 0 6px; }
        .whetstone, .label { background: #44403c; border-radius: 8px; padding: 6px 10px; }
        .tickets { list-style: none; padding: 0; display: flex; gap: 8px; flex-wrap: wrap; }
        .ticket {
          background: #fef3c7; color: #78350f; padding: 4px 10px; border-radius: 4px;
          border-left: 4px dashed #b45309; font-size: 0.9em;
        }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'forge-trial',
      type: 'quiz',
      title: 'Trial of the Anvil',
      blurb: 'Eight questions on components, props, children and purity.',
      xp: 100,
      story: [
        { text: "Hilda never lets an apprentice leave without passing her Trial of the Anvil. Eight questions, and every answer comes with a lesson, so even a miss makes you sharper.", mood: 'happy' },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What does this render?\n\n```jsx\nfunction Badge({ label, level = 1 }) {\n  return <p>{label} · Lv {level}</p>;\n}\n\n<Badge label="Smith" />\n```',
          ['`Smith · Lv`', '`Smith · Lv 1`', '`Smith · Lv undefined`', 'Nothing: it crashes'],
          1,
          '`level` was not passed, so the default value `1` kicks in. A default in the destructuring pattern is used whenever the prop is missing (`undefined`).',
        ),
        q(
          'A blade is stamped with `<Blade damage="10" />`. Inside, the component renders `{damage + 5}`. What appears on screen?',
          ['`15`', '`NaN`', '`damage + 5`', '`105`'],
          3,
          'Quotes pass a **string**, and `"10" + 5` glues text together: `"105"`. Pass numbers in braces, `damage={10}`, and you get 15.',
        ),
        q(
          'What does `Frame` receive as its `children` prop here?\n\n```jsx\n<Frame title="Loot">\n  <p>Gold</p>\n  <p>Gems</p>\n</Frame>\n```',
          ['The two `<p>` elements', 'The string `"Loot"`', 'Nothing: children only works with plain text', 'An error, because `Frame` must be self-closing'],
          0,
          'Everything nested between the opening and closing tags arrives in `props.children`: here, both paragraphs. `title` is a separate, ordinary prop.',
        ),
        q(
          'Which of these components is **pure**?',
          [
            '`function A() { count++; return <p>{count}</p>; }`',
            '`function B({ items }) { items.push("new"); return <p>{items.length}</p>; }`',
            '`function C({ price }) { const total = price * 2; return <p>{total}</p>; }`',
            '`function D({ hero }) { hero.hp = 0; return <p>{hero.hp}</p>; }`',
          ],
          2,
          '`C` only calculates with its own local variable. `A` changes an outside variable, `B` pushes into an array it received and `D` overwrites a field of a prop object. Those are all side effects during render.',
        ),
        q(
          'The paragraph inside this frame never shows up. Why?\n\n```jsx\nfunction Frame({ title }) {\n  return <section><h3>{title}</h3></section>;\n}\n\n<Frame title="Ruby">\n  <p>Shiny!</p>\n</Frame>\n```',
          ['`<p>` is not allowed inside components', 'The `title` prop overwrites the children', '`Frame` has to be written as `<Frame />`', '`Frame` never renders `{children}`'],
          3,
          'Nested content is delivered in the `children` prop, but the component has to *place* it somewhere. Destructure `children` and render it: `<section><h3>{title}</h3>{children}</section>`.',
        ),
        q(
          'What is wrong with this code?\n\n```jsx\nfunction Machine() {\n  function Gear() {\n    return <span>⚙️</span>;\n  }\n  return <Gear />;\n}\n```',
          [
            '`Gear` is re-created on every render, so React rebuilds it from scratch each time',
            'Nothing: defining components inside each other is the recommended style',
            'Components are not allowed to return a `<span>`',
            'Functions defined inside other functions cannot use JSX',
          ],
          0,
          'Define components at the **top level** of the file. A component defined inside another is a brand-new function on every render, so React treats it as a different component, throws the old one away (with anything stored inside) and builds it again.',
        ),
        q(
          '`Forge.jsx` contains `export default function Anvil() {…}` and `export function Hammer() {…}`. Which line imports **both**?',
          [
            '`import { Anvil, Hammer } from "./Forge.jsx";`',
            '`import Anvil, { Hammer } from "./Forge.jsx";`',
            '`import Anvil, Hammer from "./Forge.jsx";`',
            '`import { Hammer } from "./Forge.jsx";`',
          ],
          1,
          'The default export is imported **without** braces (and you may give it any name). Named exports go **inside** braces with their exact names. Both can share one import line.',
        ),
        q(
          'Given `const gem = { title: "Ruby", icon: "💎" };`, which tag is the same as `<Frame {...gem} />`?',
          ['`<Frame gem={gem} />`', '`<Frame>{gem}</Frame>`', '`<Frame title="Ruby" icon="💎" />`', '`<Frame title={gem} icon={gem} />`'],
          2,
          'The spread `{...gem}` turns **every key** of the object into its own prop. It is a handy shortcut for passing many props at once, but it hides which props are being passed, so use it with care.',
        ),
      ],
      concepts: [
        {
          id: 'forge-composition',
          icon: '🧱',
          title: 'Composition',
          summary: 'Build big UIs by fitting small components together: props go in, children go inside.',
          snippet: code`
            <Frame title="Amulet" icon={<Gem />}>
              <Price amount={300} />
            </Frame>
          `,
          detail: 'Instead of one huge component, React apps are trees of small, reusable ones that each do one job.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'forge-boss',
      type: 'build',
      boss: true,
      bossName: 'The Monolith',
      bossIcon: '🗿',
      title: 'Boss: The Monolith',
      blurb: 'A golem carved as one giant copy-pasted component. Break him into reusable pieces.',
      xp: 280,
      badge: { id: 'badge-forge', name: 'Monolith Breaker', icon: '⚒️', description: 'Shattered the Monolith with the power of composition in the Component Forge.' },
      story: [
        { text: 'The furnace roars again! But the exit is blocked by the Monolith: a colossal golem carved as ONE giant component.', mood: 'worried' },
        { text: "Look at his code: the same slab copy-pasted three times, every value chiselled in by hand. Nothing can scratch him... but he can be broken into pieces.", mood: 'thinking' },
        { text: 'Forge one reusable Slab, rebuild him from that single mold, and he crumbles. Show him what composition can do!', mood: 'excited' },
      ],
      lesson: md`
        ## Breaking a monolith

        Copy-pasted markup is the Monolith's armour: fix a typo in one slab and you must
        remember to fix all the others. Developers break monoliths like this every day.
        The recipe:

        1. **Spot the repetition.** Which chunk of JSX appears again and again?
        2. **Find what differs.** Every difference becomes a **prop**.
        3. **Find the free-form part.** Content that changes shape from copy to copy becomes **children**.
        4. **Forge the component**, replace each copy with it, and check the screen still looks the same.

        \`\`\`jsx
        // Before: carved by hand, values baked in
        <section className="slab">
          <h2 className="slab-title">🔥 Ember Golem</h2>
          <p className="slab-level">Level 3</p>
          ...
        </section>

        // After: one mold, many slabs
        <Slab icon="🔥" name="Ember Golem" level={3} stats={{ strength: 12, armor: 5 }}>
          <p>Born in the furnace. Hates water.</p>
        </Slab>
        \`\`\`

        Notice the double braces in \`stats={{ strength: 12, armor: 5 }}\`: the outer pair opens
        JavaScript and the inner pair is an object literal, exactly like \`style={{ ... }}\`.

        ## Your forge toolkit

        | Skill | Example |
        |---|---|
        | Named export | \`export function Slab(...)\` |
        | Destructuring + default | \`function Slab({ name, level = 1 })\` |
        | Object prop | \`{stats.armor}\` |
        | Children | \`<div className="slab-body">{children}</div>\` |
        | Spread (optional) | \`<Slab {...golem} />\` |
        | Purity | compute new values, never change props |

        :::tip
        Refactor one slab at a time. After each one, glance at the preview: if it still looks
        the same, move on to the next. Check the quest often, because every passing objective
        is another crack in the Monolith!
        :::
      `,
      task: md`
        ## 👑 Shatter the Monolith

        Rebuild the Monolith from one reusable mold. The screen must look **exactly the same** afterwards.

        ### 1. Forge the \`Slab\` component (export it!)

        \`Slab\` receives \`icon\`, \`name\`, \`level\`, \`stats\` and \`children\`, and returns a \`<section className="slab">\` containing, in order:

        1. \`<h2 className="slab-title">\` with the icon, a space and the name, e.g. **🔥 Ember Golem**
        2. \`<p className="slab-level">\` with **Level N**, where \`level\` defaults to **1** when it is left out
        3. \`<p className="slab-stats">\` with **Strength S · Armor A**, read from the \`stats\` object (\`{ strength, armor }\`)
        4. \`<div className="slab-body">\` that renders the \`children\`

        ### 2. Rebuild \`App\` from slabs

        Replace the three copy-pasted \`<section>\`s with three \`<Slab>\`s, keeping every value
        and every paragraph. The Moss Golem is level 1: leave its \`level\` out and let the default do the work.
      `,
      starter: code`
        // 🗿 THE MONOLITH
        // One giant component: the same slab copy-pasted three times,
        // every value carved straight into the stone.

        export default function App() {
          return (
            <main className="monolith">
              <h1>🗿 The Monolith</h1>

              <section className="slab">
                <h2 className="slab-title">🔥 Ember Golem</h2>
                <p className="slab-level">Level 3</p>
                <p className="slab-stats">Strength 12 · Armor 5</p>
                <div className="slab-body">
                  <p>Born in the furnace. Hates water.</p>
                </div>
              </section>

              <section className="slab">
                <h2 className="slab-title">❄️ Frost Golem</h2>
                <p className="slab-level">Level 5</p>
                <p className="slab-stats">Strength 9 · Armor 11</p>
                <div className="slab-body">
                  <p>Carved from a glacier.</p>
                  <p>Moves slowly. Hits hard.</p>
                </div>
              </section>

              <section className="slab">
                <h2 className="slab-title">🌿 Moss Golem</h2>
                <p className="slab-level">Level 1</p>
                <p className="slab-stats">Strength 4 · Armor 7</p>
                <div className="slab-body">
                  <p>Just woke up. Very polite.</p>
                </div>
              </section>
            </main>
          );
        }
      `,
      solution: code`
        export function Slab({ icon, name, level = 1, stats, children }) {
          return (
            <section className="slab">
              <h2 className="slab-title">{icon} {name}</h2>
              <p className="slab-level">Level {level}</p>
              <p className="slab-stats">Strength {stats.strength} · Armor {stats.armor}</p>
              <div className="slab-body">{children}</div>
            </section>
          );
        }

        export default function App() {
          return (
            <main className="monolith">
              <h1>🗿 The Monolith</h1>
              <Slab icon="🔥" name="Ember Golem" level={3} stats={{ strength: 12, armor: 5 }}>
                <p>Born in the furnace. Hates water.</p>
              </Slab>
              <Slab icon="❄️" name="Frost Golem" level={5} stats={{ strength: 9, armor: 11 }}>
                <p>Carved from a glacier.</p>
                <p>Moves slowly. Hits hard.</p>
              </Slab>
              <Slab icon="🌿" name="Moss Golem" stats={{ strength: 4, armor: 7 }}>
                <p>Just woke up. Very polite.</p>
              </Slab>
            </main>
          );
        }
      `,
      hints: [
        md`Start by copying one \`<section className="slab">...</section>\` into a new \`export function Slab(...)\`, then replace each baked-in value with a prop: \`{icon} {name}\`, \`Level {level}\`, and so on.`,
        md`Destructure with a default: \`function Slab({ icon, name, level = 1, stats, children })\`. The stats line is \`Strength {stats.strength} · Armor {stats.armor}\` and the body is \`<div className="slab-body">{children}</div>\`.`,
        md`
          Each copy in \`App\` becomes a Slab:

          \`\`\`jsx
          <Slab icon="🔥" name="Ember Golem" level={3} stats={{ strength: 12, armor: 5 }}>
            <p>Born in the furnace. Hates water.</p>
          </Slab>
          \`\`\`

          For the Moss Golem, leave out \`level\` entirely.
        `,
      ],
      tests: [
        test("Hit 1: Slab is exported and shows any golem's icon and name", (t) => {
          const Slab = exported(t, 'Slab', 'Forge it with "export function Slab({ icon, name, ... }) { ... }".');
          t.renderComponent(Slab, golemProps());
          t.expectElement('section.slab', `Slab rendered ${clip(t.html())}. Expected a <section className="slab">.`);
          const title = textOf(t, '.slab-title');
          t.expect(title === '🌀 Test Golem', `We passed icon="🌀" and name="Test Golem", but .slab-title says "${title || 'nothing'}". Expected "🌀 Test Golem": use {icon} {name}.`);
        }),
        test('Hit 2: the level reads "Level N" and defaults to 1', (t) => {
          const Slab = exported(t, 'Slab', 'Forge it with "export function Slab({ icon, name, ... }) { ... }".');
          t.renderComponent(Slab, golemProps());
          const level = textOf(t, '.slab-level');
          t.expect(level === 'Level 9', `With level={9}, .slab-level says "${level || 'nothing'}". Expected "Level 9".`);
          const props = golemProps();
          delete props.level;
          t.renderComponent(Slab, props);
          const fallback = textOf(t, '.slab-level');
          t.expect(fallback === 'Level 1', `Without a level prop, .slab-level says "${fallback || 'nothing'}". Expected "Level 1": add a default, { level = 1 }.`);
        }),
        test('Hit 3: the stats come from the stats object', (t) => {
          const Slab = exported(t, 'Slab', 'Forge it with "export function Slab({ icon, name, ... }) { ... }".');
          t.renderComponent(Slab, golemProps());
          const stats = textOf(t, '.slab-stats');
          t.expect(
            stats === 'Strength 1 · Armor 2',
            `With stats={{ strength: 1, armor: 2 }}, .slab-stats says "${stats || 'nothing'}". Expected "Strength 1 · Armor 2": use {stats.strength} and {stats.armor}.`,
          );
        }),
        test('Hit 4: whatever is nested inside <Slab> lands in .slab-body', (t) => {
          const Slab = exported(t, 'Slab', 'Forge it with "export function Slab({ icon, name, ... }) { ... }".');
          t.render(t.h(Slab, golemProps(), t.h('p', { className: 'probe-a' }, 'Rumble'), t.h('p', { className: 'probe-b' }, 'Crack')));
          const body = t.$('.slab-body');
          t.expect(body, 'Slab needs a <div className="slab-body"> for its children.');
          t.expect(
            body.querySelector('.probe-a') && body.querySelector('.probe-b'),
            `We nested two paragraphs inside <Slab>, but .slab-body contains "${norm(body.textContent) || 'nothing'}". Render {children} inside it.`,
          );
        }),
        test('Final blow: App is rebuilt from three <Slab>s and looks the same', (t) => {
          t.render();
          const slabs = t.$$('.slab');
          t.expect(slabs.length === 3, `App shows ${slabs.length} slab(s). Expected 3: Ember, Frost and Moss.`);
          const want = [
            ['🔥 Ember Golem', 'Level 3', 'Strength 12 · Armor 5', ['Born in the furnace. Hates water.']],
            ['❄️ Frost Golem', 'Level 5', 'Strength 9 · Armor 11', ['Carved from a glacier.', 'Moves slowly. Hits hard.']],
            ['🌿 Moss Golem', 'Level 1', 'Strength 4 · Armor 7', ['Just woke up. Very polite.']],
          ];
          want.forEach(([title, level, stats, paragraphs], i) => {
            const slab = slabs[i];
            const got = (sel) => norm(slab.querySelector(sel)?.textContent);
            t.expect(got('.slab-title') === norm(title), `Slab ${i + 1} is titled "${got('.slab-title')}". Expected "${title}".`);
            t.expect(got('.slab-level') === level, `${title} shows "${got('.slab-level')}". Expected "${level}".`);
            t.expect(got('.slab-stats') === stats, `${title} shows "${got('.slab-stats')}". Expected "${stats}".`);
            const body = Array.from(slab.querySelectorAll('.slab-body p')).map((p) => norm(p.textContent));
            t.expect(body.join(' / ') === paragraphs.join(' / '), `${title}'s body reads "${body.join(' / ')}". Expected "${paragraphs.join(' / ')}" (as children of the <Slab>).`);
          });
          const uses = (t.source.match(/<Slab[\s/>]/g) || []).length;
          t.expect(uses >= 3, `App uses <Slab> ${uses} time(s). Replace each of the three copy-pasted <section>s with a <Slab>.`);
          const carved = (t.source.match(/className=["']slab["']/g) || []).length;
          t.expect(
            carved <= 1,
            `${carved} copies of <section className="slab"> are still carved into your code, and the Monolith regenerates from copies! Only the Slab component itself should contain that markup.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'forge-extract',
          icon: '🔨',
          title: 'Extracting components',
          summary: 'Repeated markup becomes one component: differences become props, free-form parts become children.',
          snippet: code`
            <Slab icon="🔥" name="Ember Golem" level={3} stats={{ strength: 12, armor: 5 }}>
              <p>Born in the furnace.</p>
            </Slab>
          `,
          detail: 'Refactor in small steps and make sure the screen looks the same after each one.',
        },
      ],
      css: `
        .monolith { background: linear-gradient(#57534e, #1c1917); color: #f5f5f4; padding: 16px; border-radius: 18px; }
        .monolith h1 { color: #fafaf9; text-align: center; letter-spacing: 2px; }
        .slab {
          background: #78716c; border: 3px solid #44403c; border-radius: 10px; padding: 10px 14px; margin: 10px 0;
          box-shadow: inset 0 -5px 0 rgba(0, 0, 0, 0.25);
        }
        .slab-title { color: #ffffff; margin: 0 0 6px; }
        .slab-level {
          display: inline-block; background: #fbbf24; color: #451a03; border-radius: 999px;
          padding: 0 10px; font-weight: 700; font-size: 0.85em;
        }
        .slab-stats { font-family: ui-monospace, monospace; color: #e7e5e4; }
        .slab-body { border-top: 2px dashed #a8a29e; margin-top: 6px; padding-top: 4px; }
      `,
    },
  ],
};

// ---------------------------------------------------------------------------
// Sample props used by the checks (deliberately different from the App data,
// so hard-coded values can't sneak through).
// ---------------------------------------------------------------------------

function orderProps(extra = {}) {
  return {
    item: 'Test Anvil',
    qty: 4,
    customer: { name: 'Zed', guild: 'Test Guild' },
    formatPrice: (n) => n + ' test-coins',
    ...extra,
  };
}

function golemProps(extra = {}) {
  return { icon: '🌀', name: 'Test Golem', level: 9, stats: { strength: 1, armor: 2 }, ...extra };
}
