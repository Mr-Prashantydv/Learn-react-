import { code, md, q, test } from '../helpers.js';

export default {
  id: 'jsx-shore',
  file: '01-jsx-shore.js',
  title: 'Shore of JSX',
  short: 'JSX',
  subtitle: 'Where every React journey begins: components, JSX and the rules of markup.',
  icon: '🏝️',
  colors: ['#0e7490', '#22d3ee'],
  scenery: ['🌴', '🐚', '🦀', '🌊', '⛵', '🐠', '☀️'],
  intro: [
    { text: 'Welcome to the Shore of JSX! Everything in Reactoria is built from the shells you find here: little bits of markup called JSX.', mood: 'happy' },
    { text: 'The Mutator froze this beach mid-render. See the crabs? Stuck in a single frame. Rude.', mood: 'worried' },
    { text: 'Each glowing spot on the path is a quest. Complete them in order — at the end waits a boss who tangles every tag he touches.', mood: 'happy' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'jsx-first-spark',
      type: 'code',
      title: 'The First Spark',
      blurb: 'Write your very first React component and light the lighthouse.',
      xp: 100,
      story: [
        { text: "The lighthouse went dark when the Mutator came. Its lamp is a component — but its render function returns nothing!", mood: 'worried' },
        { text: "Let's make it return a heading. Read the 📖 Lesson tab first if you like, then write your code on the right. When you're ready, press ✓ Check quest.", mood: 'happy' },
      ],
      lesson: md`
        ## What is React?

        **React** is a JavaScript library for building user interfaces out of small,
        reusable pieces called **components**.

        Without React you tell the browser *how* to change the page, step by step:

        \`\`\`js
        // Imperative: you perform every step yourself
        const title = document.createElement('h1');
        title.textContent = 'Hello!';
        document.body.appendChild(title);
        \`\`\`

        With React you **describe what the page should look like**, and React works out
        the steps for you. This style is called **declarative**:

        \`\`\`jsx
        function App() {
          return <h1>Hello!</h1>;
        }
        \`\`\`

        ## Components are functions

        A React component is a plain JavaScript function that **returns markup**.

        - Its name **must start with a capital letter** — \`App\`, \`Lighthouse\`, \`HeroCard\`.
          (Lowercase names like \`<h1>\` are reserved for built-in HTML tags.)
        - It returns **JSX** — or \`null\` to render nothing.

        ## JSX

        The HTML-looking code inside the function is **JSX**. It is *not* a string and it
        is *not* HTML: a build tool turns each tag into a JavaScript function call.

        \`\`\`jsx
        <h1 className="title">Hi</h1>
        // ...is compiled into roughly:
        jsx('h1', { className: 'title', children: 'Hi' })
        \`\`\`

        Those calls produce plain objects (React *elements*) that describe the UI.
        React compares them with what is on screen and updates only what changed.

        ## export default

        \`export default\` marks the main thing a file offers. In Reactoria, the component you
        \`export default\` is what appears in the **Live preview**.

        :::tip
        In a real project, one file (usually \`main.jsx\`) puts your App on the page:

        \`\`\`jsx
        import { createRoot } from 'react-dom/client';
        import App from './App.jsx';

        createRoot(document.getElementById('root')).render(<App />);
        \`\`\`

        Reactoria does that part for you, so you can focus on components.
        :::

        :::pro
        Want to build React apps on your own computer later? Install Node.js, then run
        \`npm create vite@latest my-app -- --template react\` — you get a project ready to go.
        :::
      `,
      task: md`
        ## 🎯 Light the lighthouse

        The \`App\` component currently returns \`null\` (nothing).

        Make it return an \`<h1>\` heading with exactly this text:

        **Hello, Reactoria!**

        The preview updates as you type. Press **✓ Check quest** when you're done.
      `,
      starter: code`
        // Your first component! It's just a function that returns JSX.
        export default function App() {
          // Replace null with an <h1> heading
          return null;
        }
      `,
      solution: code`
        export default function App() {
          return <h1>Hello, Reactoria!</h1>;
        }
      `,
      hints: [
        md`JSX looks like HTML. A heading is written \`<h1>some text</h1>\`.`,
        md`Replace \`null\` so the line reads \`return <h1>Hello, Reactoria!</h1>;\` — mind the comma and the exclamation mark.`,
      ],
      tests: [
        test('App renders an <h1>', (t) => {
          t.render();
          t.expectElement('h1', 'No <h1> found. Make App return <h1>...</h1> instead of null.');
        }),
        test('The heading says "Hello, Reactoria!"', (t) => {
          t.render();
          const text = t.find('h1').textContent.trim();
          t.expect(
            text === 'Hello, Reactoria!',
            `Your <h1> says "${text}". It should say exactly "Hello, Reactoria!" (comma and ! included).`,
          );
        }),
      ],
      concepts: [
        {
          id: 'component',
          icon: '🧩',
          title: 'Component',
          summary: 'A function with a Capitalized name that returns JSX.',
          snippet: code`
            function Greeting() {
              return <h1>Hello!</h1>;
            }
          `,
          detail: 'Components are the building blocks of every React app. Use them like custom HTML tags: <Greeting />.',
        },
        {
          id: 'jsx',
          icon: '🏷️',
          title: 'JSX',
          summary: 'HTML-like syntax that compiles to JavaScript function calls.',
          snippet: code`
            const element = <p className="note">Hi</p>;
            // ≈ jsx('p', { className: 'note', children: 'Hi' })
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'jsx-curly-braces',
      type: 'code',
      title: 'Curly Braces of Power',
      blurb: 'Pour JavaScript into your markup with { }.',
      xp: 120,
      story: [
        { text: 'A traveller washed ashore! Her name, title and loot are stored in JavaScript variables... but the welcome sign is blank.', mood: 'happy' },
        { text: 'Curly braces { } are little windows from JSX back into JavaScript. Use them to show her data on the sign.', mood: 'happy' },
      ],
      lesson: md`
        ## Opening a window into JavaScript

        Inside JSX, **curly braces \`{ }\`** let you drop back into JavaScript.
        Whatever *expression* is inside gets evaluated and its result is rendered.

        \`\`\`jsx
        const name = 'Ada';
        const gold = 40;

        function Sign() {
          return (
            <div>
              <h2>Welcome, {name}!</h2>
              <p>You carry {gold * 2} gold (doubled for luck).</p>
              <p>Shout: {name.toUpperCase()}</p>
            </div>
          );
        }
        \`\`\`

        You can put **any expression** in braces:

        - variables — \`{name}\`
        - math — \`{gold * 2}\`
        - property access — \`{hero.level}\`
        - function calls — \`{format(price)}\`, \`{name.toUpperCase()}\`
        - template literals, inside the braces:

          \`\`\`jsx
          <p>{\`Level \${hero.level}\`}</p>
          \`\`\`

        ## Expressions, not statements

        Braces want something that **produces a value**. Statements like \`if\`, \`for\`
        or \`const x = 1\` do not produce a value, so they cannot go inside \`{ }\`.
        (You will learn the React ways to do conditions and loops soon!)

        ## Where braces work

        - As **text content**: \`<p>{message}</p>\`
        - As **attribute values**: \`<img src={avatarUrl} alt={name} />\`

        :::mistake
        Don't wrap braces in quotes. \`alt="{name}"\` renders the literal text \`{name}\`.
        Write \`alt={name}\` instead.
        :::

        :::tip
        Text and braces mix freely: \`<p>Level {hero.level} hero</p>\`. Spaces in your JSX text are kept, so \`Level {x}\` renders as "Level 7". Careful: whitespace that contains a line break is removed, so if you put two braces on separate lines, add an explicit \`{' '}\` between them.
        :::
      `,
      task: md`
        ## 🎯 Fill in the welcome sign

        Using **curly braces**, make the sign display the traveller's data.
        Don't type the values by hand — the sign must read them from the variables.

        1. The \`<h2>\` shows her name and title: **Ada the Brave**
           (use \`hero.name\` and \`hero.title\`)
        2. The \`<p className="level">\` shows **Level 7** (use \`hero.level\`)
        3. The \`<p className="loot">\` shows **Potions: 6** — that's \`potions\` doubled
        4. The \`<p className="cry">\` shows **FOR REACTORIA!** — call \`shout('for reactoria')\`
      `,
      starter: code`
        const hero = { name: 'Ada', title: 'the Brave', level: 7 };
        const potions = 3;

        function shout(text) {
          return text.toUpperCase() + '!';
        }

        export default function App() {
          return (
            <div className="sign">
              <h2>???</h2>
              <p className="level">Level ???</p>
              <p className="loot">Potions: ???</p>
              <p className="cry">???</p>
            </div>
          );
        }
      `,
      solution: code`
        const hero = { name: 'Ada', title: 'the Brave', level: 7 };
        const potions = 3;

        function shout(text) {
          return text.toUpperCase() + '!';
        }

        export default function App() {
          return (
            <div className="sign">
              <h2>{hero.name} {hero.title}</h2>
              <p className="level">Level {hero.level}</p>
              <p className="loot">Potions: {potions * 2}</p>
              <p className="cry">{shout('for reactoria')}</p>
            </div>
          );
        }
      `,
      hints: [
        md`Put a variable inside braces to show it: \`<h2>{hero.name}</h2>\`. You can have two pairs of braces with a space between them.`,
        md`Math works inside braces: \`{potions * 2}\`. Function calls too: \`{shout('for reactoria')}\`.`,
        md`The heading can be \`<h2>{hero.name} {hero.title}</h2>\`.`,
      ],
      tests: [
        test('The heading reads "Ada the Brave" using hero.name and hero.title', (t) => {
          t.render();
          const text = t.find('h2').textContent.replace(/\s+/g, ' ').trim();
          t.expect(
            text === 'Ada the Brave',
            `The <h2> reads "${text}" — expected "Ada the Brave".` +
              (text === 'Adathe Brave' ? " (JSX drops line breaks between braces. Keep them on one line or add {' '}.)" : ''),
          );
          t.sourceIncludes(/\{[^}]*hero\.name/, 'Read the name from hero.name inside braces instead of typing it by hand.');
          t.sourceIncludes(/\{[^}]*hero\.title/, 'Read the title from hero.title inside braces instead of typing it by hand.');
        }),
        test('The level line reads "Level 7" using hero.level', (t) => {
          t.render();
          const text = t.find('.level').textContent.replace(/\s+/g, ' ').trim();
          t.expect(text === 'Level 7', `The .level paragraph reads "${text}" — expected "Level 7".`);
          t.sourceIncludes(/\{[^}]*hero\.level/, 'Read the level from hero.level inside braces, e.g. {hero.level}.');
        }),
        test('The loot line shows the doubled potions: "Potions: 6"', (t) => {
          t.render();
          const text = t.find('.loot').textContent.replace(/\s+/g, ' ').trim();
          t.expect(text === 'Potions: 6', `The .loot paragraph reads "${text}" — expected "Potions: 6".`);
          t.sourceIncludes(/potions\s*\*\s*2|2\s*\*\s*potions|potions\s*\+\s*potions/, 'Compute the doubled amount from potions, e.g. {potions * 2}, instead of typing 6.');
        }),
        test('The battle cry calls shout(): "FOR REACTORIA!"', (t) => {
          t.render();
          const text = t.find('.cry').textContent.trim();
          t.expect(text === 'FOR REACTORIA!', `The .cry paragraph reads "${text}" — expected "FOR REACTORIA!".`);
          t.sourceIncludes(/\{\s*shout\(/, "Call the function inside braces: {shout('for reactoria')}.");
        }),
      ],
      concepts: [
        {
          id: 'jsx-expressions',
          icon: '🪟',
          title: 'Curly braces in JSX',
          summary: 'Embed any JavaScript expression in markup with { }.',
          snippet: code`
            <p>Level {hero.level} · {gold * 2} gold</p>
            <img src={url} alt={name} />
          `,
          detail: 'Braces take expressions (things that produce a value), not statements like if/for.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'jsx-one-root',
      type: 'bug',
      title: 'The Tangled Net',
      blurb: 'Bug hunt! Fix broken JSX the Mutator left behind.',
      xp: 130,
      starterHasSyntaxError: true,
      story: [
        { text: "A fisher's net is tangled with broken JSX — the preview won't even run. The Mutator was here, all right.", mood: 'worried' },
        { text: 'JSX is stricter than HTML. There are exactly three rules to remember. Read them in the Lesson tab, then untangle the net!', mood: 'happy' },
      ],
      lesson: md`
        ## The three rules of JSX

        JSX looks like HTML, but it is stricter. Break rule 1 or 2 and your code won't compile. Break rule 3 and React prints a warning in the console, and the attribute may be silently ignored (a lowercase \`onclick\` never fires).

        ### 1. Return a single root element

        A component returns **one** thing. Two siblings side by side is like a function
        trying to \`return a, b\`. Wrap them in a parent:

        \`\`\`jsx
        // ❌ two roots
        return (
          <h1>Catch of the day</h1>
          <p>Three fish</p>
        );

        // ✅ wrapped in a <div>
        return (
          <div>
            <h1>Catch of the day</h1>
            <p>Three fish</p>
          </div>
        );

        // ✅ or in a Fragment, which adds no extra element to the page
        return (
          <>
            <h1>Catch of the day</h1>
            <p>Three fish</p>
          </>
        );
        \`\`\`

        \`<>...</>\` is a **Fragment**: a wrapper that groups elements without adding a
        \`<div>\` to the DOM.

        ### 2. Close every tag

        HTML lets you write \`<br>\` or \`<img src="...">\`. JSX doesn't. Tags without
        children must **self-close** with \`/>\`:

        \`\`\`jsx
        <br />
        <img src="/fish.png" alt="A fish" />
        <input />
        \`\`\`

        ### 3. camelCase (almost) everything

        JSX attributes become JavaScript object keys, so they follow JavaScript naming:

        | HTML | JSX |
        |---|---|
        | \`class\` | \`className\` |
        | \`for\` | \`htmlFor\` |
        | \`onclick\` | \`onClick\` |
        | \`tabindex\` | \`tabIndex\` |

        (\`class\` and \`for\` are reserved words in JavaScript — that's why they change.)
        \`aria-*\` and \`data-*\` attributes keep their dashes.

        :::tip
        Wrap multi-line JSX in parentheses after \`return\`. Without them, a \`return\` on its own line returns \`undefined\`!
        :::
      `,
      task: md`
        ## 🐛 Untangle the net

        The code on the right is broken in **four** places. Fixes 1–3 get the preview running again; fix 4 makes it correct JSX:

        1. The component returns **two root elements** — wrap them in a Fragment \`<>...</>\`.
        2. The \`<img>\` tag is never closed.
        3. The \`<br>\` tag is never closed.
        4. An attribute uses the HTML name \`class\` instead of the JSX name.

        Keep all the existing elements and text.
      `,
      starter: code`
        export default function App() {
          return (
            <h1 class="title">Catch of the day</h1>
            <section className="net">
              <img src="https://em-content.zobj.net/source/apple/391/tropical-fish_1f420.png" alt="Tropical fish" width="48">
              <p>Three tropical fish<br>and one very confused crab.</p>
            </section>
          );
        }
      `,
      solution: code`
        export default function App() {
          return (
            <>
              <h1 className="title">Catch of the day</h1>
              <section className="net">
                <img src="https://em-content.zobj.net/source/apple/391/tropical-fish_1f420.png" alt="Tropical fish" width="48" />
                <p>Three tropical fish<br />and one very confused crab.</p>
              </section>
            </>
          );
        }
      `,
      hints: [
        md`The error message shows a line number. Start at the top: wrap the \`<h1>\` and the \`<section>\` together inside \`<>\` and \`</>\`.`,
        md`Self-close empty tags: \`<img ... />\` and \`<br />\`.`,
        md`In JSX, \`class\` is spelled \`className\`.`,
      ],
      tests: [
        test('The code compiles and renders', (t) => {
          t.render();
          t.expectElement('h1', 'The <h1> heading is missing.');
        }),
        test('The heading uses className="title"', (t) => {
          t.render();
          t.expect(t.find('h1').className === 'title', 'Give the <h1> the attribute className="title".');
          t.sourceExcludes(/\sclass=/, 'There is still an HTML-style class= attribute. Use className= instead.');
        }),
        test('No extra wrapper: the heading and section are siblings in a Fragment', (t) => {
          t.render();
          const kids = Array.from(t.container.children).map((el) => el.tagName.toLowerCase());
          t.expect(
            kids.join(',') === 'h1,section',
            `At the top level the page has: <${kids.join('>, <')}>. Use a Fragment <>...</> so the <h1> and <section> sit side by side without an extra <div>.`,
          );
        }),
        test('The image and line break are still there', (t) => {
          t.render();
          const img = t.find('section img');
          t.expect(img.getAttribute('alt') === 'Tropical fish', 'Keep the alt text "Tropical fish" on the image.');
          t.expectElement('p br', 'Keep the <br /> inside the paragraph.');
          t.expectText('and one very confused crab.');
        }),
      ],
      concepts: [
        {
          id: 'jsx-rules',
          icon: '📏',
          title: 'The rules of JSX',
          summary: 'One root, close every tag, camelCase attributes.',
          snippet: code`
            return (
              <>
                <label htmlFor="name" className="lbl">Name</label>
                <input id="name" />
              </>
            );
          `,
        },
        {
          id: 'fragment',
          icon: '🫙',
          title: 'Fragment',
          summary: '<>...</> groups elements without adding a DOM node.',
          snippet: code`
            <>
              <dt>HP</dt>
              <dd>42</dd>
            </>
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'jsx-attributes',
      type: 'code',
      title: 'Potions of Style',
      blurb: 'Style elements with className and the double-curly style object.',
      xp: 130,
      story: [
        { text: 'The potion seller lost her labels in the storm. She needs a big, glowing label — with style!', mood: 'happy' },
        { text: "In JSX, inline styles are JavaScript objects. That's why you'll see double curly braces: {{ }}.", mood: 'happy' },
      ],
      lesson: md`
        ## Attributes are props

        Every JSX attribute is passed to React as a property. Strings use quotes, everything
        else uses braces:

        \`\`\`jsx
        <img src="/potion.png" alt="Potion" width={64} />
        <input type="checkbox" disabled={true} />
        \`\`\`

        ## className

        Use \`className\` to attach CSS classes, exactly like \`class\` in HTML:

        \`\`\`jsx
        <div className="potion rare">Elixir</div>
        \`\`\`

        ## The style object

        Inline styles in JSX are **not strings** — they are **JavaScript objects**:

        \`\`\`jsx
        <p style={{ color: 'gold', fontSize: 24, backgroundColor: 'purple' }}>
          Shiny!
        </p>
        \`\`\`

        Why double braces? The **outer** braces open the JavaScript window, the **inner**
        braces are the object literal. It's the same as:

        \`\`\`jsx
        const shiny = { color: 'gold', fontSize: 24 };
        <p style={shiny}>Shiny!</p>
        \`\`\`

        Rules for style objects:

        - Property names are **camelCase**: \`background-color\` → \`backgroundColor\`,
          \`font-size\` → \`fontSize\`.
        - Values are usually **strings**: \`'purple'\`, \`'2px solid gold'\`.
        - A plain **number** means pixels for size properties: \`fontSize: 24\` → \`24px\`.

        :::tip
        Prefer \`className\` + CSS for most styling, and use \`style\` for values that are
        computed in JavaScript (a health bar's width, a user's favourite colour...).
        :::
      `,
      task: md`
        ## 🎯 Label the potion

        Finish the \`<div>\` that wraps the potion label:

        1. Give it the class **potion**.
        2. Give it an inline \`style\` with:
           - \`backgroundColor\`: **'purple'**
           - \`color\`: **'gold'**
           - \`padding\`: **16** (a number — React adds \`px\`)
           - \`borderRadius\`: **12**
        3. The \`<img>\` must have an \`alt\` text of **Bubbling potion** and a \`width\` of **64** (a number in braces).
      `,
      starter: code`
        export default function App() {
          return (
            <div>
              <img src="https://em-content.zobj.net/source/apple/391/test-tube_1f9ea.png" />
              <h2>Elixir of Re-rendering</h2>
              <p>Shake well. Drink before every state change.</p>
            </div>
          );
        }
      `,
      solution: code`
        export default function App() {
          return (
            <div
              className="potion"
              style={{ backgroundColor: 'purple', color: 'gold', padding: 16, borderRadius: 12 }}
            >
              <img
                src="https://em-content.zobj.net/source/apple/391/test-tube_1f9ea.png"
                alt="Bubbling potion"
                width={64}
              />
              <h2>Elixir of Re-rendering</h2>
              <p>Shake well. Drink before every state change.</p>
            </div>
          );
        }
      `,
      hints: [
        md`Add \`className="potion"\` to the outer \`<div>\`.`,
        md`Styles are an object inside braces: \`style={{ backgroundColor: 'purple', color: 'gold' }}\`. Keep adding properties separated by commas.`,
        md`Numbers go in braces: \`width={64}\`. For \`padding: 16\` React adds the \`px\` automatically.`,
      ],
      tests: [
        test('The wrapper has className "potion"', (t) => {
          t.render();
          t.expectElement('div.potion', 'No <div className="potion"> found.');
        }),
        test('Background is purple and text is gold', (t) => {
          t.render();
          t.sourceExcludes(/['"][a-z]+(-[a-z]+)+['"]\s*:/, 'Style keys are camelCase: backgroundColor and borderRadius, not "background-color".');
          const el = t.find('div.potion');
          t.expect(el.style.backgroundColor === 'purple', `backgroundColor is "${el.style.backgroundColor || 'not set'}" — expected 'purple'. Remember camelCase: backgroundColor.`);
          t.expect(el.style.color === 'gold', `color is "${el.style.color || 'not set'}" — expected 'gold'.`);
        }),
        test('Padding 16px and border radius 12px (numbers become px)', (t) => {
          t.render();
          const el = t.find('div.potion');
          t.expect(el.style.padding === '16px', `padding is "${el.style.padding || 'not set'}" — expected 16 (→ 16px).`);
          t.expect(el.style.borderRadius === '12px', `borderRadius is "${el.style.borderRadius || 'not set'}" — expected 12 (→ 12px).`);
        }),
        test('The image has alt "Bubbling potion" and width 64', (t) => {
          t.render();
          const img = t.find('img');
          t.expect(img.getAttribute('alt') === 'Bubbling potion', 'Set alt="Bubbling potion" on the <img>.');
          t.expect(img.getAttribute('width') === '64', 'Set width={64} on the <img>.');
          t.sourceIncludes(/width=\{\s*64\s*\}/, 'Pass the width as a number in braces: width={64}.');
        }),
      ],
      concepts: [
        {
          id: 'style-object',
          icon: '🎨',
          title: 'Inline style objects',
          summary: 'style={{ camelCase: value }} — numbers mean px for sizes.',
          snippet: code`
            <div style={{ backgroundColor: 'purple', padding: 16 }} />
          `,
        },
        {
          id: 'classname',
          icon: '🏷️',
          title: 'className',
          summary: 'JSX spelling of the HTML class attribute.',
          snippet: code`
            <button className="btn primary">Go</button>
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'jsx-trial',
      type: 'quiz',
      title: 'Trial of the Tides',
      blurb: 'Seven questions guard the path. Prove you speak fluent JSX.',
      xp: 100,
      story: [{ text: 'The tide-keeper only lets JSX experts pass. Answer her questions — every answer comes with an explanation, so wrong ones still teach you something.', mood: 'happy' }],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What does this component render?\n\n```jsx\nconst items = 3;\nfunction Bag() {\n  return <p>Items: {items + 1}</p>;\n}\n```',
          ['Items: {items + 1}', 'Items: 31', 'Items: 4', 'Nothing — it crashes'],
          2,
          'Braces evaluate the JavaScript expression inside them. `3 + 1` is `4`, so the paragraph reads **Items: 4**.',
        ),
        q(
          'Why does JSX use `className` instead of `class`?',
          [
            'Because `class` is a reserved word in JavaScript',
            'Because React does not support CSS classes',
            'It is just a style preference; both work the same',
            'Because `class` only works on `<div>` elements',
          ],
          0,
          'JSX compiles to JavaScript objects, and `class` is a reserved keyword in JavaScript, so React uses `className` (and `htmlFor` instead of `for`).',
        ),
        q(
          'Which line is valid JSX?',
          ['`<img src="a.png">`', '`<img src="a.png" />`', '`<img src="a.png"></img/>`', '`<img/ src="a.png">`'],
          1,
          'In JSX every tag must be closed. Empty elements like `<img>`, `<br>` and `<input>` self-close with `/>`.',
        ),
        q(
          'What is wrong with this component?\n\n```jsx\nfunction Card() {\n  return (\n    <h2>Title</h2>\n    <p>Body</p>\n  );\n}\n```',
          [
            'Nothing — it is fine',
            'Components cannot contain <h2>',
            'It returns two root elements; wrap them in a parent or a Fragment',
            'The parentheses after return are not allowed',
          ],
          2,
          'A component must return a single root. Wrap siblings in a `<div>` or a Fragment `<>...</>`.',
        ),
        q(
          'How do you write an inline style that sets the font size to 20px?',
          ['`style="font-size: 20px"`', '`style={fontSize: 20}`', '`style={{ font-size: "20px" }}`', '`style={{ fontSize: 20 }}`'],
          3,
          'The style prop takes an object: the outer braces enter JavaScript, the inner braces are the object. Properties are camelCase, and a number means pixels for size properties like fontSize.',
        ),
        q(
          'Which of these can NOT go inside `{ }` in JSX?',
          ['`user.name`', '`price * 2`', '`formatDate(today)`', '`if (open) { ... }`'],
          3,
          'Braces take **expressions** — things that produce a value. An `if` statement does not produce a value. (You will meet the React ways of handling conditions in the Branching Woods.)',
        ),
        q(
          'Why must component names start with a capital letter?',
          [
            'It is required by JavaScript itself',
            'So JSX can tell your components (`<Card />`) apart from HTML tags (`<div>`)',
            'Capital letters make components render faster',
            'It is only a convention; lowercase components work too',
          ],
          1,
          'JSX treats lowercase tags as built-in HTML elements and Capitalized tags as components. `<card />` would be rendered as an unknown HTML tag!',
        ),
      ],
      concepts: [
        {
          id: 'declarative',
          icon: '🗺️',
          title: 'Declarative UI',
          summary: 'Describe WHAT the UI should look like; React figures out HOW.',
          detail: 'Instead of issuing DOM commands, you return a description of the screen. React compares it with the previous description and applies the minimal changes.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6 (boss)
    {
      id: 'jsx-boss',
      type: 'build',
      boss: true,
      title: 'Boss: The Tag Tangler',
      blurb: 'The Tangler scrambled the harbour notice board. Rebuild it from scratch.',
      xp: 250,
      badge: { id: 'badge-jsx', name: 'Tide Tamer', icon: '🌊', description: 'Defeated the Tag Tangler on the Shore of JSX.' },
      story: [
        { text: 'There he is — the Tag Tangler! He ripped down the harbour notice board and scattered its tags into the sea.', mood: 'worried' },
        { text: 'Rebuild the whole board yourself: a Fragment, headings, an image, data in braces and some style. Everything you learned on this shore!', mood: 'happy' },
        { text: "Read the task carefully — the checks are picky, just like a real boss. You've got this!", mood: 'happy' },
      ],
      lesson: md`
        ## Everything from the Shore

        | Skill | Example |
        |---|---|
        | Component | \`export default function App() { return ... }\` |
        | Expressions | \`{ship.name}\`, \`{ship.crew * 2}\` |
        | One root | \`<> ... </>\` |
        | Closing tags | \`<img ... />\`, \`<hr />\` |
        | Attributes | \`className\`, \`alt\`, \`src={url}\` |
        | Styles | \`style={{ borderColor: 'gold' }}\` |

        :::tip
        Build it step by step and watch the preview after each step. Check the quest
        early and often — the objective list tells you which parts already work.
        :::
      `,
      task: md`
        ## 👑 Rebuild the notice board

        Using the \`ship\` object, make \`App\` return a **Fragment** containing exactly
        these two elements, in order:

        1. An \`<h1>\` that says **Harbour of Reactoria**
        2. An \`<article>\` with className **notice** and an inline style setting
           \`border\` to **'3px solid gold'**. Inside it:
           - an \`<img>\` whose \`src\` is \`ship.image\` and \`alt\` is \`ship.name\` (both via braces)
           - an \`<h2>\` showing the ship's name: **The Pure Function**
           - a \`<p className="crew">\` showing **Crew: 12**
           - a \`<p className="cargo">\` showing **Cargo: 48 crates** (crates per crew × crew — compute it!)
           - a self-closing \`<hr />\`
           - a \`<p className="motto">\` showing the motto in UPPERCASE: **SAME INPUT, SAME OUTPUT**
      `,
      starter: code`
        const ship = {
          name: 'The Pure Function',
          image: 'https://em-content.zobj.net/source/apple/391/sailboat_26f5.png',
          crew: 12,
          cratesPerCrew: 4,
          motto: 'same input, same output',
        };

        export default function App() {
          // Rebuild the notice board here!
          return null;
        }
      `,
      solution: code`
        const ship = {
          name: 'The Pure Function',
          image: 'https://em-content.zobj.net/source/apple/391/sailboat_26f5.png',
          crew: 12,
          cratesPerCrew: 4,
          motto: 'same input, same output',
        };

        export default function App() {
          return (
            <>
              <h1>Harbour of Reactoria</h1>
              <article className="notice" style={{ border: '3px solid gold' }}>
                <img src={ship.image} alt={ship.name} />
                <h2>{ship.name}</h2>
                <p className="crew">Crew: {ship.crew}</p>
                <p className="cargo">Cargo: {ship.crew * ship.cratesPerCrew} crates</p>
                <hr />
                <p className="motto">{ship.motto.toUpperCase()}</p>
              </article>
            </>
          );
        }
      `,
      hints: [
        md`Start with the skeleton: \`return (<> <h1>...</h1> <article>...</article> </>);\` then fill in the article.`,
        md`Attributes from data use braces without quotes: \`<img src={ship.image} alt={ship.name} />\`.`,
        md`Cargo is \`{ship.crew * ship.cratesPerCrew}\`. The motto is \`{ship.motto.toUpperCase()}\`.`,
      ],
      tests: [
        test('A Fragment wraps exactly an <h1> and an <article>', (t) => {
          t.render();
          const kids = Array.from(t.container.children).map((el) => el.tagName.toLowerCase());
          t.expect(kids.join(',') === 'h1,article', `Top-level elements are <${kids.join('>, <') || 'nothing'}> — expected <h1> then <article>, wrapped in a Fragment.`);
          t.expect(t.find('h1').textContent.trim() === 'Harbour of Reactoria', 'The <h1> should say "Harbour of Reactoria".');
        }),
        test('The article has className "notice" and a gold 3px border', (t) => {
          t.render();
          const article = t.find('article');
          t.expect(article.className === 'notice', 'Give the <article> className="notice".');
          t.expect(article.style.border === '3px solid gold', `The article's border is "${article.style.border || 'not set'}" — expected '3px solid gold' via style={{ border: ... }}.`);
        }),
        test('The image uses ship.image and ship.name', (t) => {
          t.render();
          const img = t.find('article img');
          t.expect(img.getAttribute('alt') === 'The Pure Function', 'The image alt should be the ship name.');
          t.expect(/sailboat/.test(img.getAttribute('src') || ''), 'The image src should be ship.image.');
          t.sourceIncludes(/src=\{\s*ship\.image\s*\}/, 'Use src={ship.image}.');
          t.sourceIncludes(/alt=\{\s*ship\.name\s*\}/, 'Use alt={ship.name}.');
        }),
        test('Name, crew and computed cargo are shown from the data', (t) => {
          t.render();
          t.expect(t.find('article h2').textContent.trim() === 'The Pure Function', 'The <h2> should show the ship name.');
          t.expect(t.find('.crew').textContent.replace(/\s+/g, ' ').trim() === 'Crew: 12', 'The .crew paragraph should read "Crew: 12".');
          t.expect(t.find('.cargo').textContent.replace(/\s+/g, ' ').trim() === 'Cargo: 48 crates', 'The .cargo paragraph should read "Cargo: 48 crates".');
          t.sourceIncludes(/<h2[^>]*>[^<]*\{[^}]*ship\.name/, 'Show the name with {ship.name} inside the <h2>.');
          t.expect((t.source.match(/ship\.crew\b/g) || []).length >= 2, 'Show the crew with {ship.crew}, and use it again for the cargo.');
          t.sourceIncludes(/ship\.crew\s*\*\s*ship\.cratesPerCrew|ship\.cratesPerCrew\s*\*\s*ship\.crew/, 'Compute the cargo from ship.crew and ship.cratesPerCrew.');
        }),
        test('A divider and the motto in uppercase', (t) => {
          t.render();
          t.expectElement('article hr', 'Add a self-closing <hr /> inside the article.');
          const motto = t.find('.motto').textContent.trim();
          t.expect(motto === 'SAME INPUT, SAME OUTPUT', `The motto reads "${motto}" — expected "SAME INPUT, SAME OUTPUT".`);
          t.sourceIncludes(/ship\.motto\s*\.\s*toUpperCase\(\)/, 'Turn the motto uppercase with {ship.motto.toUpperCase()}.');
        }),
      ],
      concepts: [
        {
          id: 'react-element-tree',
          icon: '🌳',
          title: 'The element tree',
          summary: 'Your JSX forms a tree; React mirrors it into the DOM.',
          detail: 'Each JSX tag is a node. Nested tags are children. React keeps this tree in memory and updates the real DOM to match it.',
        },
      ],
    },
  ],
};
