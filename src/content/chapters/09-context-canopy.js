import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Small helpers shared by this chapter's checks.
// ---------------------------------------------------------------------------

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Compact JSON for failure messages (handles undefined). */
function show(value) {
  if (value === undefined) return 'undefined';
  try {
    const json = JSON.stringify(value);
    return json.length > 160 ? json.slice(0, 157) + '...' : json;
  } catch {
    return String(value);
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Source without comments, so a comment never trips a source check. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

const isContext = (c) => c != null && typeof c === 'object' && 'Provider' in c && 'Consumer' in c;

/** Gets a named export or fails with `how` (a hint showing the expected export). */
function getExport(t, name, how) {
  const value = t.exports[name];
  t.expect(value !== undefined && value !== null, `Could not find an export named ${name}. ${how}`);
  return value;
}

/**
 * Calls a player's reducer with a deep-frozen COPY of `state`, so any attempt
 * to mutate it throws. Turns mutations and crashes into friendly messages.
 */
function callReducer(t, reducer, name, state, action) {
  t.expect(typeof reducer === 'function', `${name} should be a function: export function ${name}(state, action) { ... }`);
  const frozen = deepFreeze(clone(state));
  try {
    return reducer(frozen, action);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/read.?only|not extensible|Cannot (assign|add|delete|define)|can't (define|delete|assign)|frozen/i.test(msg)) {
      t.fail(
        `${name} tried to change the state it was given while handling ${show(action)} (${msg}). Never mutate: build and return a new object/array with spread, map or filter.`,
      );
    }
    if (/unknown action/i.test(msg)) {
      t.fail(
        `${name} threw "${msg}" for ${show(action)}, an action it should handle. Add (or check the spelling of) case '${action.type}' — and make sure that case returns, or it falls through into the next case (here: default).`,
      );
    }
    t.fail(`${name} crashed while handling ${show(action)}: ${msg}`);
  }
}

/** Expects the reducer to throw for an unknown action type. */
function expectThrowsOnUnknown(t, reducer, name, state) {
  let threw = false;
  try {
    reducer(clone(state), { type: 'danced_the_conga' });
  } catch {
    threw = true;
  }
  t.expect(threw, `${name} didn't complain about an unknown action ({ type: 'danced_the_conga' }). End the switch with default: throw new Error('Unknown action: ' + action.type);`);
}

/** Finds a <button> containing `label` inside `scope`. */
function buttonIn(scope, label) {
  const btn = Array.from(scope.querySelectorAll('button')).find((b) => norm(b.textContent).toLowerCase().includes(label.toLowerCase()));
  if (!btn) {
    const found = Array.from(scope.querySelectorAll('button')).map((b) => `"${norm(b.textContent)}"`);
    throw new Error(`Could not find a "${label}" button here. Buttons found: ${found.join(', ') || 'none'}.`);
  }
  return btn;
}

/** The <li> matching `selector` whose text contains `text` (or null). */
const row = (t, selector, text) => t.$$(selector).find((li) => norm(li.textContent).includes(text)) || null;

/** The button labelled `label` inside the `selector` row containing `text`. */
function rowButton(t, selector, text, label) {
  const li = row(t, selector, text);
  t.expect(li, `Could not find "${text}" on the page (looked in ${selector}).`);
  return buttonIn(li, label);
}

/** Like t.find, but fails with `message` instead of a generic one. */
function findOr(t, selector, message) {
  const el = t.$(selector);
  t.expect(el, message);
  return el;
}

/** Renders something, turning a crash into a context-flavoured hint. */
function renderOrExplain(t, element, hint) {
  try {
    if (element === undefined) t.render();
    else t.render(element);
  } catch (err) {
    t.fail(`${String(err.message).replace(/^Your component crashed: /, 'It crashed: ')} ${hint}`);
  }
}

export default {
  id: 'context-canopy',
  file: '09-context-canopy.js',
  title: 'Context Canopy',
  short: 'Context',
  subtitle: 'High in the treetops: tame tangled state with reducers and share it anywhere with context.',
  icon: '🌳',
  colors: ['#14532d', '#86efac'],
  scenery: ['🌳', '🍃', '🐿️', '🦉', '🌰', '🏮', '🪵', '🐦'],
  intro: [
    { text: 'Welcome to the Context Canopy! A whole village lives up here in the treetops, linked by rope bridges and very busy squirrels.', mood: 'happy' },
    { text: 'Two big ideas grow on these branches. Reducers gather messy update logic into one tidy function. Context lets data float down to any leaf without being handed through every twig.', mood: 'thinking' },
    { text: "Hear that tok-tok-tok? That's the Prop Driller, a woodpecker who bores holes through every component just to pass props along. We'll meet him at the top.", mood: 'worried' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'canopy-acorn-ledger',
      type: 'code',
      title: 'The Acorn Ledger',
      blurb: 'Gather scattered state updates into one reducer with useReducer.',
      xp: 120,
      story: [
        { text: "Meet Hazel, the canopy's treasurer squirrel. She guards the village acorn stash... with update logic scattered across every button.", mood: 'happy' },
        { text: "Let's gather it all into a reducer: one function that decides how the stash changes. Hazel loves a tidy ledger.", mood: 'thinking' },
      ],
      lesson: md`
        ## From scattered setters to a reducer

        As components grow, the logic that updates state spreads across many event handlers:

        \`\`\`jsx
        function handleGather() { setAcorns(acorns + 5); }
        function handleEat()    { setAcorns(acorns - 1); }
        function handleReset()  { setAcorns(0); }
        \`\`\`

        A **reducer** moves all of it into **one function**, outside the component. Event
        handlers stop saying *how* to change state; they just report **what happened** by
        **dispatching an action**:

        \`\`\`jsx
        import { useReducer } from 'react';

        function stashReducer(state, action) {
          switch (action.type) {
            case 'gathered':
              return { ...state, acorns: state.acorns + action.amount };
            case 'eaten':
              return { ...state, acorns: state.acorns - 1 };
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        function Stash() {
          const [state, dispatch] = useReducer(stashReducer, { acorns: 0 });

          return (
            <>
              <p>{state.acorns} acorns</p>
              <button onClick={() => dispatch({ type: 'gathered', amount: 5 })}>Gather</button>
              <button onClick={() => dispatch({ type: 'eaten' })}>Eat</button>
            </>
          );
        }
        \`\`\`

        ## The pieces

        - \`useReducer(reducer, initialState)\` returns \`[state, dispatch]\` — just like \`useState\` returns \`[state, setState]\`.
        - An **action** is a plain object describing what happened. By convention it has a \`type\` string (\`'gathered'\`) plus any extra data (\`amount: 5\`).
        - \`dispatch(action)\` hands the action to React. React calls \`reducer(currentState, action)\`, uses the **return value** as the next state, and re-renders.
        - The **reducer** takes \`(state, action)\` and **returns the next state**. A \`switch\` on \`action.type\` with one \`case\` per action is the usual style.

        ## Reducers must be pure

        A reducer follows the same rules as a component: same inputs → same output, no side effects.

        - **Never mutate** \`state\`; return a **new** object or array (\`{ ...state, acorns: ... }\`).
        - **No side effects**: no \`fetch\`, timers, \`Math.random()\` or \`Date.now()\` inside. Do those in the event handler and put the result in the action.
        - **Return from every case.** Throwing an error in the \`default\` case catches typos in action types early.
        - Rules like "never below zero" belong **in the reducer** — then every button gets them for free.

        :::tip
        Name actions after **what happened** (\`'gathered'\`, \`'eaten'\`, \`'reset'\`), not after the
        setter you're replacing (\`'setAcorns'\`). The list of actions then reads like a story.
        :::

        :::mistake
        \`dispatch('eaten')\` instead of \`dispatch({ type: 'eaten' })\`. The reducer reads
        \`action.type\`, and a plain string has no \`type\`, so you land in \`default\`.
        :::

        :::pro
        The name comes from \`Array.prototype.reduce\`: a reducer "folds" a list of actions into the
        current state, one at a time — \`actions.reduce(stashReducer, initialState)\`.
        :::
      `,
      task: md`
        ## 🎯 Balance Hazel's ledger

        Replace the \`useState\` code with a reducer. The state is an object: \`{ acorns: 10 }\`.

        | Action | Next state |
        |---|---|
        | \`{ type: 'gathered', amount }\` | \`amount\` more acorns |
        | \`{ type: 'eaten' }\` | 1 acorn fewer, but **never below 0** |
        | \`{ type: 'reset' }\` | back to **10** acorns |
        | anything else | \`throw new Error('Unknown action: ' + action.type)\` |

        1. Write and **export** \`stashReducer(state, action)\` handling the actions above with a \`switch\`. Always return a **new** object — never change \`state\` itself.
        2. In \`App\`, use \`const [state, dispatch] = useReducer(stashReducer, { acorns: 10 });\`
        3. The buttons dispatch: **🌰 Gather 5** → \`{ type: 'gathered', amount: 5 }\`, **😋 Eat one** → \`{ type: 'eaten' }\`, **↺ Reset** → \`{ type: 'reset' }\`.
        4. \`<p className="count">\` keeps showing **10 acorns**, **15 acorns**, ...
      `,
      starter: code`
        import { useState } from 'react';

        // TODO: export function stashReducer(state, action) { ... }

        export default function App() {
          const [acorns, setAcorns] = useState(10);

          return (
            <div className="ledger">
              <div className="squirrel">🐿️</div>
              <h2>Hazel's Acorn Ledger</h2>
              <p className="count">{acorns} acorns</p>
              <div className="buttons">
                <button onClick={() => setAcorns(acorns + 5)}>🌰 Gather 5</button>
                <button onClick={() => setAcorns(acorns - 1)}>😋 Eat one</button>
                <button onClick={() => setAcorns(10)}>↺ Reset</button>
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useReducer } from 'react';

        export function stashReducer(state, action) {
          switch (action.type) {
            case 'gathered':
              return { ...state, acorns: state.acorns + action.amount };
            case 'eaten':
              return { ...state, acorns: Math.max(0, state.acorns - 1) };
            case 'reset':
              return { ...state, acorns: 10 };
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export default function App() {
          const [state, dispatch] = useReducer(stashReducer, { acorns: 10 });

          return (
            <div className="ledger">
              <div className="squirrel">🐿️</div>
              <h2>Hazel's Acorn Ledger</h2>
              <p className="count">{state.acorns} acorns</p>
              <div className="buttons">
                <button onClick={() => dispatch({ type: 'gathered', amount: 5 })}>🌰 Gather 5</button>
                <button onClick={() => dispatch({ type: 'eaten' })}>😋 Eat one</button>
                <button onClick={() => dispatch({ type: 'reset' })}>↺ Reset</button>
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Start the reducer with \`export function stashReducer(state, action) { switch (action.type) { ... } }\`. The \`'gathered'\` case returns \`{ ...state, acorns: state.acorns + action.amount }\`.`,
        md`"Never below 0": \`Math.max(0, state.acorns - 1)\`. Finish with \`default: throw new Error('Unknown action: ' + action.type);\``,
        md`In \`App\`: \`const [state, dispatch] = useReducer(stashReducer, { acorns: 10 });\`, show \`{state.acorns}\`, and use e.g. \`onClick={() => dispatch({ type: 'eaten' })}\`.`,
      ],
      tests: [
        test('stashReducer is exported and adds acorns on "gathered"', (t) => {
          const reducer = getExport(t, 'stashReducer', 'Write export function stashReducer(state, action) { ... } above App.');
          const next = callReducer(t, reducer, 'stashReducer', { acorns: 10 }, { type: 'gathered', amount: 5 });
          t.expect(next && next.acorns === 15, `stashReducer({ acorns: 10 }, { type: 'gathered', amount: 5 }) returned ${show(next)} — expected { acorns: 15 }.`);
          const more = callReducer(t, reducer, 'stashReducer', { acorns: 2 }, { type: 'gathered', amount: 3 });
          t.expect(more && more.acorns === 5, `Gathering 3 acorns from 2 gave ${show(more)} — expected { acorns: 5 }. Use action.amount, not a fixed 5.`);
        }),
        test('"eaten" removes one acorn (never below 0) and "reset" returns to 10', (t) => {
          const reducer = getExport(t, 'stashReducer', 'Write export function stashReducer(state, action) { ... } above App.');
          const eaten = callReducer(t, reducer, 'stashReducer', { acorns: 4 }, { type: 'eaten' });
          t.expect(eaten && eaten.acorns === 3, `Eating from { acorns: 4 } gave ${show(eaten)} — expected { acorns: 3 }.`);
          const empty = callReducer(t, reducer, 'stashReducer', { acorns: 0 }, { type: 'eaten' });
          t.expect(empty && empty.acorns === 0, `Eating from { acorns: 0 } gave ${show(empty)} — the stash must never go below 0. Try Math.max(0, state.acorns - 1).`);
          const reset = callReducer(t, reducer, 'stashReducer', { acorns: 42 }, { type: 'reset' });
          t.expect(reset && reset.acorns === 10, `Resetting { acorns: 42 } gave ${show(reset)} — expected { acorns: 10 }.`);
        }),
        test('The reducer is pure: new objects, no mutation, unknown actions throw', (t) => {
          const reducer = getExport(t, 'stashReducer', 'Write export function stashReducer(state, action) { ... } above App.');
          for (const [state, action] of [
            [{ acorns: 10 }, { type: 'gathered', amount: 5 }],
            [{ acorns: 10 }, { type: 'eaten' }],
            [{ acorns: 3 }, { type: 'reset' }],
          ]) {
            const frozen = deepFreeze(clone(state));
            const next = callReducer(t, reducer, 'stashReducer', frozen, action);
            t.expect(next !== frozen, `For ${show(action)} the reducer returned the very same state object. Return a new one: { ...state, acorns: ... }.`);
          }
          expectThrowsOnUnknown(t, reducer, 'stashReducer', { acorns: 10 });
        }),
        test('App uses useReducer and its buttons dispatch actions', (t) => {
          t.sourceIncludes(/\buseReducer\s*\(\s*stashReducer\b/, 'In App, call useReducer(stashReducer, { acorns: 10 }) instead of useState.');
          t.render();
          const count = () => norm(t.find('.count').textContent);
          t.expect(count() === '10 acorns', `The ledger starts at "${count()}" — expected "10 acorns".`);
          t.click(t.button('Gather'));
          t.expect(count() === '15 acorns', `After Gather 5 the ledger reads "${count()}" — expected "15 acorns".`);
          t.click(t.button('Eat'));
          t.expect(count() === '14 acorns', `After Eat one the ledger reads "${count()}" — expected "14 acorns".`);
          t.click(t.button('Reset'));
          t.expect(count() === '10 acorns', `After Reset the ledger reads "${count()}" — expected "10 acorns".`);
          for (let i = 0; i < 12; i++) t.click(t.button('Eat'));
          t.expect(count() === '0 acorns', `After eating 12 times from 10, the ledger reads "${count()}" — expected "0 acorns" (never below zero).`);
        }),
      ],
      css: `
        .ledger { text-align: center; padding: 20px; border-radius: 18px; background: linear-gradient(180deg, #fef3c7, #fcd34d); color: #713f12; border: 3px solid #b45309; }
        .ledger .squirrel { font-size: 52px; }
        .ledger h2 { margin: 4px 0; color: inherit; }
        .ledger .count { font-size: 30px; font-weight: 800; margin: 8px 0 12px; }
        .ledger .buttons { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
      `,
      concepts: [
        {
          id: 'canopy-usereducer',
          icon: '🧮',
          title: 'useReducer',
          summary: 'const [state, dispatch] = useReducer(reducer, initialState) — all update logic in one function.',
          snippet: code`
            function reducer(state, action) {
              switch (action.type) {
                case 'gathered':
                  return { ...state, acorns: state.acorns + action.amount };
                default:
                  throw new Error('Unknown action: ' + action.type);
              }
            }
            const [state, dispatch] = useReducer(reducer, { acorns: 0 });
          `,
        },
        {
          id: 'canopy-actions',
          icon: '📨',
          title: 'Actions & dispatch',
          summary: 'Handlers dispatch plain objects that describe what happened: { type, ...data }.',
          snippet: code`
            dispatch({ type: 'gathered', amount: 5 });
          `,
          detail: 'React calls your reducer with the current state and the action, and the return value becomes the next state.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'canopy-lantern-festival',
      type: 'code',
      title: 'The Lantern Festival',
      blurb: 'Hang, light and take down lanterns with a reducer that manages a list.',
      xp: 140,
      story: [
        { text: 'Tonight is the Lantern Festival! Luma the firefly is hanging lanterns along every rope bridge.', mood: 'excited' },
        { text: 'Hanging, lighting and taking down lanterns all change the same list. That is exactly where a reducer shines.', mood: 'happy' },
      ],
      lesson: md`
        ## A reducer for a list

        Reducers shine when **several different events** change the **same piece of state**. A
        list of lanterns can be added to, toggled and removed from:

        \`\`\`jsx
        export function lanternsReducer(lanterns, action) {
          switch (action.type) {
            case 'added':
              return [...lanterns, { id: action.id, name: action.name, lit: false }];
            case 'toggled':
              return lanterns.map((l) =>
                l.id === action.id ? { ...l, lit: !l.lit } : l
              );
            case 'removed':
              return lanterns.filter((l) => l.id !== action.id);
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }
        \`\`\`

        Everything from the Immutable Isles applies: spread to add, \`map\` to change one item,
        \`filter\` to remove. The reducer receives the **current** list and returns a **new** one.
        The state doesn't have to be an object — here it's the array itself.

        ## Where do ids come from?

        Generating an id is not pure: \`nextId++\` gives a different answer every time. So create
        it **in the event handler** and put it **in the action**:

        \`\`\`jsx
        let nextId = 4;

        function handleAdd(e) {
          e.preventDefault();
          dispatch({ type: 'added', id: nextId++, name });
        }
        \`\`\`

        The reducer stays pure: same list + same action → same result.

        ## Passing dispatch down

        Child components can receive \`dispatch\` as a prop. React gives you the **same**
        \`dispatch\` function on every render, so it's safe to pass around:

        \`\`\`jsx
        <LanternItem lantern={l} dispatch={dispatch} />

        function LanternItem({ lantern, dispatch }) {
          return (
            <button onClick={() => dispatch({ type: 'toggled', id: lantern.id })}>
              {lantern.lit ? 'Snuff' : 'Light'}
            </button>
          );
        }
        \`\`\`

        ## useState or useReducer?

        | Prefer \`useState\` when... | Prefer \`useReducer\` when... |
        |---|---|
        | the state is simple (a number, a string, a flag) | many event handlers update the same state |
        | updates are one-liners | the update logic is getting long or repeated |
        | one or two handlers touch it | you want to test the logic on its own |

        Neither is "better" — you can mix both in one component (this level keeps the input's
        text in \`useState\`). A reducer is just \`useState\` with the update logic moved to one place.

        :::tip
        Derived values stay derived: "2 of 3 lanterns lit" is computed from the list during
        render, never stored in the reducer state.
        :::

        :::pro
        Reducers are plain functions, so you can test them without rendering anything:
        \`lanternsReducer([], { type: 'added', id: 1, name: 'Moon Gate' })\`.
        :::
      `,
      task: md`
        ## 🎯 Light up the festival

        The state is an **array** of lanterns shaped \`{ id, name, lit }\`.

        1. Write and **export** \`lanternsReducer(lanterns, action)\` handling three actions:
           - \`{ type: 'added', id, name }\` appends \`{ id, name, lit: false }\` to the end.
           - \`{ type: 'toggled', id }\` flips \`lit\` on the lantern with that id.
           - \`{ type: 'removed', id }\` removes that lantern.
           - Anything else throws \`new Error('Unknown action: ' + action.type)\`.
        2. In \`App\`, replace the lantern \`useState\` with \`useReducer(lanternsReducer, initialLanterns)\` (the input's \`name\` stays in \`useState\`).
        3. \`handleAdd\` dispatches \`{ type: 'added', id: nextId++, name }\` (it already clears the input).
        4. Pass \`dispatch\` to every \`LanternItem\`: its **Light/Snuff** button dispatches \`toggled\` and its **✕** button dispatches \`removed\`.

        Keep \`<p className="lit-count">\` showing **N of M lanterns lit**.
      `,
      starter: code`
        import { useState } from 'react';

        const initialLanterns = [
          { id: 1, name: 'Moon Bridge', lit: true },
          { id: 2, name: 'Owl Post', lit: false },
          { id: 3, name: 'Acorn Hollow', lit: false },
        ];
        let nextId = 4;

        // TODO: export function lanternsReducer(lanterns, action) { ... }

        function LanternItem({ lantern }) {
          // TODO: receive dispatch and use it in both buttons
          return (
            <li className={lantern.lit ? 'lantern lit' : 'lantern'}>
              <span className="name">{lantern.lit ? '🏮' : '⚫'} {lantern.name}</span>
              <button>{lantern.lit ? 'Snuff' : 'Light'}</button>
              <button aria-label={'Remove ' + lantern.name}>✕</button>
            </li>
          );
        }

        export default function App() {
          const [lanterns, setLanterns] = useState(initialLanterns); // TODO: useReducer
          const [name, setName] = useState('');

          function handleAdd(e) {
            e.preventDefault();
            if (!name.trim()) return;
            // TODO: dispatch an 'added' action with id: nextId++ and the name
            setName('');
          }

          const litCount = lanterns.filter((l) => l.lit).length;

          return (
            <div className="festival">
              <h2>🏮 Lantern Festival</h2>
              <p className="lit-count">{litCount} of {lanterns.length} lanterns lit</p>
              <form onSubmit={handleAdd}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lantern name" />
                <button type="submit">Hang lantern</button>
              </form>
              <ul className="lanterns">
                {lanterns.map((l) => (
                  <LanternItem key={l.id} lantern={l} />
                ))}
              </ul>
            </div>
          );
        }
      `,
      solution: code`
        import { useReducer, useState } from 'react';

        const initialLanterns = [
          { id: 1, name: 'Moon Bridge', lit: true },
          { id: 2, name: 'Owl Post', lit: false },
          { id: 3, name: 'Acorn Hollow', lit: false },
        ];
        let nextId = 4;

        export function lanternsReducer(lanterns, action) {
          switch (action.type) {
            case 'added':
              return [...lanterns, { id: action.id, name: action.name, lit: false }];
            case 'toggled':
              return lanterns.map((l) => (l.id === action.id ? { ...l, lit: !l.lit } : l));
            case 'removed':
              return lanterns.filter((l) => l.id !== action.id);
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        function LanternItem({ lantern, dispatch }) {
          return (
            <li className={lantern.lit ? 'lantern lit' : 'lantern'}>
              <span className="name">{lantern.lit ? '🏮' : '⚫'} {lantern.name}</span>
              <button onClick={() => dispatch({ type: 'toggled', id: lantern.id })}>
                {lantern.lit ? 'Snuff' : 'Light'}
              </button>
              <button aria-label={'Remove ' + lantern.name} onClick={() => dispatch({ type: 'removed', id: lantern.id })}>
                ✕
              </button>
            </li>
          );
        }

        export default function App() {
          const [lanterns, dispatch] = useReducer(lanternsReducer, initialLanterns);
          const [name, setName] = useState('');

          function handleAdd(e) {
            e.preventDefault();
            if (!name.trim()) return;
            dispatch({ type: 'added', id: nextId++, name: name.trim() });
            setName('');
          }

          const litCount = lanterns.filter((l) => l.lit).length;

          return (
            <div className="festival">
              <h2>🏮 Lantern Festival</h2>
              <p className="lit-count">{litCount} of {lanterns.length} lanterns lit</p>
              <form onSubmit={handleAdd}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lantern name" />
                <button type="submit">Hang lantern</button>
              </form>
              <ul className="lanterns">
                {lanterns.map((l) => (
                  <LanternItem key={l.id} lantern={l} dispatch={dispatch} />
                ))}
              </ul>
            </div>
          );
        }
      `,
      hints: [
        md`The reducer is a \`switch\`: \`'added'\` returns \`[...lanterns, { id: action.id, name: action.name, lit: false }]\`, \`'removed'\` returns \`lanterns.filter((l) => l.id !== action.id)\`.`,
        md`\`'toggled'\` maps over the list: \`lanterns.map((l) => l.id === action.id ? { ...l, lit: !l.lit } : l)\`. In \`App\`: \`const [lanterns, dispatch] = useReducer(lanternsReducer, initialLanterns);\``,
        md`Render \`<LanternItem key={l.id} lantern={l} dispatch={dispatch} />\`, take \`{ lantern, dispatch }\` in \`LanternItem\`, and add \`onClick={() => dispatch({ type: 'toggled', id: lantern.id })}\` (and \`'removed'\` on ✕).`,
      ],
      tests: [
        test('lanternsReducer is exported and appends unlit lanterns on "added"', (t) => {
          const reducer = getExport(t, 'lanternsReducer', 'Write export function lanternsReducer(lanterns, action) { ... } above App.');
          const before = [{ id: 1, name: 'Moon Bridge', lit: true }];
          const next = callReducer(t, reducer, 'lanternsReducer', before, { type: 'added', id: 7, name: 'Star Gate' });
          t.expect(Array.isArray(next), `"added" returned ${show(next)} — expected a new array of lanterns.`);
          t.expect(next.length === 2, `After "added" the list has ${next.length} lantern(s) — expected 2.`);
          const added = next[1];
          t.expect(
            added && added.id === 7 && added.name === 'Star Gate' && added.lit === false,
            `The new lantern is ${show(added)} — expected { id: 7, name: 'Star Gate', lit: false } at the end. Take id and name from the action.`,
          );
          t.expect(next[0] && next[0].id === 1, 'Keep the existing lanterns in front of the new one: [...lanterns, newLantern].');
        }),
        test('"toggled" flips one lantern and "removed" deletes one — without mutating', (t) => {
          const reducer = getExport(t, 'lanternsReducer', 'Write export function lanternsReducer(lanterns, action) { ... } above App.');
          const list = [
            { id: 1, name: 'Moon Bridge', lit: true },
            { id: 2, name: 'Owl Post', lit: false },
          ];
          const toggled = callReducer(t, reducer, 'lanternsReducer', list, { type: 'toggled', id: 2 });
          t.expect(Array.isArray(toggled) && toggled.length === 2, `"toggled" returned ${show(toggled)} — expected the same 2 lanterns with one flipped.`);
          const owl = toggled.find((l) => l.id === 2);
          const moon = toggled.find((l) => l.id === 1);
          t.expect(owl && owl.lit === true, `After toggling id 2, Owl Post is ${show(owl)} — expected lit: true.`);
          t.expect(moon && moon.lit === true, 'Toggling id 2 also changed Moon Bridge — only flip the lantern whose id matches action.id.');
          const back = callReducer(t, reducer, 'lanternsReducer', toggled, { type: 'toggled', id: 2 });
          t.expect(back.find((l) => l.id === 2)?.lit === false, 'Toggling twice should switch the lantern back off: lit: !l.lit.');
          const removed = callReducer(t, reducer, 'lanternsReducer', list, { type: 'removed', id: 1 });
          t.expect(
            Array.isArray(removed) && removed.length === 1 && removed[0].id === 2,
            `Removing id 1 gave ${show(removed)} — expected only Owl Post (id 2) to remain.`,
          );
          expectThrowsOnUnknown(t, reducer, 'lanternsReducer', list);
        }),
        test('Hanging a lantern adds it to the end, unlit', (t) => {
          t.render();
          const input = t.find('form input');
          t.type(input, 'Star Gate');
          t.submit(input);
          const items = t.$$('li.lantern');
          t.expect(items.length === 4, `There are ${items.length} lanterns after hanging "Star Gate" — expected 4. handleAdd should dispatch({ type: 'added', id: nextId++, name }).`);
          const last = items[items.length - 1];
          t.expect(norm(last.textContent).includes('Star Gate'), 'The new lantern "Star Gate" should appear at the end of the list.');
          t.expect(!last.classList.contains('lit'), 'New lanterns start unlit (lit: false).');
          const count = norm(t.find('.lit-count').textContent);
          t.expect(count === '1 of 4 lanterns lit', `The counter reads "${count}" — expected "1 of 4 lanterns lit".`);
        }),
        test('Light/Snuff and ✕ buttons dispatch to the reducer', (t) => {
          t.sourceIncludes(/\buseReducer\s*\(\s*lanternsReducer\b/, 'In App, use useReducer(lanternsReducer, initialLanterns) instead of useState for the lanterns.');
          t.render();
          const owl = row(t, 'li.lantern', 'Owl Post');
          t.expect(owl, 'Could not find the "Owl Post" lantern.');
          t.click(rowButton(t, 'li.lantern', 'Owl Post', 'Light'));
          const lit = norm(t.find('.lit-count').textContent);
          t.expect(lit === '2 of 3 lanterns lit', `After lighting Owl Post the counter reads "${lit}" — expected "2 of 3 lanterns lit". Its button should dispatch({ type: 'toggled', id: lantern.id }).`);
          t.expect(row(t, 'li.lantern', 'Owl Post').classList.contains('lit'), 'The lit lantern should get the class "lit".');
          t.click(rowButton(t, 'li.lantern', 'Moon Bridge', '✕'));
          t.expect(!row(t, 'li.lantern', 'Moon Bridge'), "Moon Bridge is still there after clicking its ✕. The button should dispatch({ type: 'removed', id: lantern.id }).");
          const after = norm(t.find('.lit-count').textContent);
          t.expect(after === '1 of 2 lanterns lit', `After removing Moon Bridge the counter reads "${after}" — expected "1 of 2 lanterns lit".`);
        }),
      ],
      css: `
        .festival { padding: 18px; border-radius: 18px; background: linear-gradient(180deg, #1e1b4b, #312e81); color: #e0e7ff; }
        .festival h2 { margin: 0 0 4px; color: inherit; }
        .festival input { color: #1e1b4b; }
        .festival .lit-count { color: #fde68a; font-weight: 700; }
        .festival form { display: flex; gap: 8px; margin: 10px 0; }
        .festival .lanterns { list-style: none; padding: 0; display: grid; gap: 6px; }
        .festival .lantern { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: #3730a3; transition: all 0.3s; }
        .festival .lantern.lit { background: #f59e0b; color: #1c1917; box-shadow: 0 0 18px #fbbf24; }
        .festival .lantern .name { flex: 1; }
      `,
      concepts: [
        {
          id: 'canopy-list-reducer',
          icon: '🏮',
          title: 'Reducers for lists',
          summary: "'added' / 'toggled' / 'removed' — spread, map and filter inside a switch.",
          snippet: code`
            case 'added':
              return [...list, { id: action.id, name: action.name }];
            case 'toggled':
              return list.map((x) => (x.id === action.id ? { ...x, on: !x.on } : x));
            case 'removed':
              return list.filter((x) => x.id !== action.id);
          `,
          detail: 'Create ids in the event handler and pass them in the action, so the reducer stays pure.',
        },
        {
          id: 'canopy-reducer-vs-state',
          icon: '⚖️',
          title: 'useState or useReducer?',
          summary: 'Simple values → useState. Many handlers changing the same state → useReducer.',
          detail: 'A reducer is useState with the update logic moved into one testable function. Mixing both in a component is fine.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'canopy-rotten-reducer',
      type: 'bug',
      title: 'The Rotten Reducer',
      blurb: 'Bug hunt! The Mutator nibbled the pantry reducer rotten. Make it pure again.',
      xp: 130,
      story: [
        { text: 'Oh no. The Mutator sneaked into the Treehouse Pantry and nibbled its reducer rotten.', mood: 'worried' },
        { text: 'Using a jar of honey deletes it, new supplies get random ids, and the shelf is being changed in place. A reducer must be pure — find the three rotten spots!', mood: 'thinking' },
      ],
      lesson: md`
        ## Why mutation breaks reducers

        When you dispatch, React calls your reducer and compares the result with the old state
        using \`Object.is\`. If you **mutate** the old array and return **the same array**, React
        sees *no change* and may skip the re-render:

        \`\`\`jsx
        case 'stocked':
          pantry.push(action.item); // ❌ changes the current state in place
          return pantry;            // same array → "nothing changed"
        \`\`\`

        Worse, the old state is gone: anything still holding it (another render, a log, an undo
        history) now sees the changed version. Return a fresh copy instead:

        \`\`\`jsx
        case 'stocked':
          return [...pantry, action.item]; // ✅ new array
        \`\`\`

        ## The switch fallthrough trap

        In a \`switch\`, a \`case\` without \`return\` (or \`break\`) **falls through** into the
        next case and runs it too:

        \`\`\`jsx
        switch (action.type) {
          case 'used':
            pantry.map(...);  // ❌ result thrown away, and no return...
          case 'cleared':      // ...so 'used' ALSO runs this case!
            return pantry.filter((item) => item.id !== action.id);
        }
        \`\`\`

        Return from every case.

        ## Impure reducers

        React may call your reducer **more than once** for the same action — in development,
        Strict Mode deliberately calls it twice to catch impurity. If the reducer invents random
        ids or reads the clock, the two calls disagree:

        \`\`\`jsx
        case 'stocked':
          return [...pantry, { id: Math.random(), name: action.name }]; // ❌ different every call
        \`\`\`

        Do the impure part in the **event handler** and pass the result in the action:

        \`\`\`jsx
        function handleStock() {
          dispatch({ type: 'stocked', id: nextId++, name }); // ✅
        }
        \`\`\`

        :::mistake
        \`state.count++\`, \`state.items.push()\`, \`item.qty -= 1\`, \`delete state.x\`,
        \`list.sort()\` — any of these inside a reducer is the Mutator's work. Copy with spread,
        \`map\`, \`filter\` or \`toSorted\` instead.
        :::

        :::tip
        A quick purity test: call your reducer twice with the same arguments. The two results
        should be identical, and the state you passed in should be untouched.
        :::
      `,
      task: md`
        ## 🐛 Cure the rotten reducer

        \`pantryReducer\` has three rotten spots. Fix them so the reducer is **pure** (keep it exported):

        1. \`'stocked'\` **mutates the pantry** with \`push\` and returns the same array. Return a **new** array with the item added at the end (\`qty: 1\`).
        2. \`'stocked'\` **invents its own id** with \`Math.random()\`. Use \`action.id\` instead — and make \`handleStock\` dispatch \`{ type: 'stocked', id: nextId++, name }\`.
        3. \`'used'\` **falls through** into \`'cleared'\`: its \`map\` result is thrown away and the item gets deleted! Return the mapped array, so \`'used'\` only lowers that item's \`qty\` by 1.
      `,
      starter: code`
        import { useReducer, useState } from 'react';

        const initialPantry = [
          { id: 1, name: 'Acorns', qty: 3 },
          { id: 2, name: 'Honey', qty: 1 },
        ];
        let nextId = 3;

        export function pantryReducer(pantry, action) {
          switch (action.type) {
            case 'stocked': {
              pantry.push({ id: Math.random(), name: action.name, qty: 1 });
              return pantry;
            }
            case 'used': {
              pantry.map((item) =>
                item.id === action.id ? { ...item, qty: item.qty - 1 } : item
              );
            }
            case 'cleared': {
              return pantry.filter((item) => item.id !== action.id);
            }
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export default function App() {
          const [pantry, dispatch] = useReducer(pantryReducer, initialPantry);
          const [name, setName] = useState('');

          function handleStock(e) {
            e.preventDefault();
            if (!name.trim()) return;
            dispatch({ type: 'stocked', name: name.trim() });
            setName('');
          }

          return (
            <div className="pantry">
              <h2>🍯 Treehouse Pantry</h2>
              <form onSubmit={handleStock}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New supply..." />
                <button type="submit">Stock</button>
              </form>
              <ul className="shelf">
                {pantry.map((item) => (
                  <li key={item.id} className="supply">
                    <span className="label">{item.name} ×{item.qty}</span>
                    <button onClick={() => dispatch({ type: 'used', id: item.id })} disabled={item.qty === 0}>
                      Use
                    </button>
                    <button onClick={() => dispatch({ type: 'cleared', id: item.id })}>Clear</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      `,
      solution: code`
        import { useReducer, useState } from 'react';

        const initialPantry = [
          { id: 1, name: 'Acorns', qty: 3 },
          { id: 2, name: 'Honey', qty: 1 },
        ];
        let nextId = 3;

        export function pantryReducer(pantry, action) {
          switch (action.type) {
            case 'stocked': {
              return [...pantry, { id: action.id, name: action.name, qty: 1 }];
            }
            case 'used': {
              return pantry.map((item) =>
                item.id === action.id ? { ...item, qty: item.qty - 1 } : item
              );
            }
            case 'cleared': {
              return pantry.filter((item) => item.id !== action.id);
            }
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export default function App() {
          const [pantry, dispatch] = useReducer(pantryReducer, initialPantry);
          const [name, setName] = useState('');

          function handleStock(e) {
            e.preventDefault();
            if (!name.trim()) return;
            dispatch({ type: 'stocked', id: nextId++, name: name.trim() });
            setName('');
          }

          return (
            <div className="pantry">
              <h2>🍯 Treehouse Pantry</h2>
              <form onSubmit={handleStock}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New supply..." />
                <button type="submit">Stock</button>
              </form>
              <ul className="shelf">
                {pantry.map((item) => (
                  <li key={item.id} className="supply">
                    <span className="label">{item.name} ×{item.qty}</span>
                    <button onClick={() => dispatch({ type: 'used', id: item.id })} disabled={item.qty === 0}>
                      Use
                    </button>
                    <button onClick={() => dispatch({ type: 'cleared', id: item.id })}>Clear</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      `,
      hints: [
        md`Rotten spot 1: replace the \`push\` + \`return pantry\` with \`return [...pantry, { id: action.id, name: action.name, qty: 1 }];\``,
        md`Rotten spot 2: the id now comes from the action, so the handler must send one: \`dispatch({ type: 'stocked', id: nextId++, name: name.trim() });\``,
        md`Rotten spot 3: put \`return\` in front of \`pantry.map(...)\` in the \`'used'\` case — then it no longer falls through into \`'cleared'\`.`,
      ],
      tests: [
        test('"stocked" returns a new array, using the id from the action', (t) => {
          const reducer = getExport(t, 'pantryReducer', 'Keep pantryReducer exported.');
          const before = [{ id: 1, name: 'Acorns', qty: 3 }];
          const next = callReducer(t, reducer, 'pantryReducer', before, { type: 'stocked', id: 9, name: 'Berries' });
          t.expect(Array.isArray(next) && next.length === 2, `"stocked" returned ${show(next)} — expected a new array with 2 supplies.`);
          const item = next[1];
          t.expect(
            item && item.id === 9,
            `The new supply's id is ${show(item && item.id)} — expected 9, the id from the action. Inventing ids inside the reducer (Math.random()) makes it impure: use action.id.`,
          );
          t.expect(item.name === 'Berries' && item.qty === 1, `The new supply is ${show(item)} — expected { id: 9, name: 'Berries', qty: 1 }.`);
        }),
        test('"used" lowers that item\'s qty by 1 — no falling through', (t) => {
          const reducer = getExport(t, 'pantryReducer', 'Keep pantryReducer exported.');
          const before = [
            { id: 1, name: 'Acorns', qty: 3 },
            { id: 2, name: 'Honey', qty: 1 },
          ];
          const next = callReducer(t, reducer, 'pantryReducer', before, { type: 'used', id: 1 });
          t.expect(Array.isArray(next), `"used" returned ${show(next)} — expected an array.`);
          t.expect(
            next.length === 2,
            `"used" left ${next.length} supply(ies) — it deleted Acorns! The case falls through into 'cleared'. Add return in front of pantry.map(...).`,
          );
          const acorns = next.find((i) => i.id === 1);
          const honey = next.find((i) => i.id === 2);
          t.expect(acorns && acorns.qty === 2, `After "used", Acorns is ${show(acorns)} — expected qty: 2.`);
          t.expect(honey && honey.qty === 1, 'Using Acorns also changed Honey — only change the item whose id matches.');
        }),
        test('The reducer is pure: same input, same output', (t) => {
          const reducer = getExport(t, 'pantryReducer', 'Keep pantryReducer exported.');
          const before = [{ id: 1, name: 'Acorns', qty: 3 }];
          const action = { type: 'stocked', id: 5, name: 'Mushrooms' };
          const first = callReducer(t, reducer, 'pantryReducer', before, action);
          const second = callReducer(t, reducer, 'pantryReducer', before, action);
          t.expect(
            JSON.stringify(first) === JSON.stringify(second),
            `Calling pantryReducer twice with the same pantry and action gave different results: ${show(first)} vs ${show(second)}. No Math.random() or Date.now() inside a reducer.`,
          );
        }),
        test('The pantry works on screen: use, stock and clear', (t) => {
          t.render();
          const label = (name) => norm(row(t, 'li.supply', name)?.querySelector('.label')?.textContent);
          t.click(rowButton(t, 'li.supply', 'Acorns', 'Use'));
          t.expect(row(t, 'li.supply', 'Acorns'), 'Using Acorns removed them from the shelf! The "used" case must not fall through into "cleared".');
          t.expect(label('Acorns') === 'Acorns ×2', `After using once, the shelf shows "${label('Acorns')}" — expected "Acorns ×2".`);
          const input = t.find('form input');
          t.type(input, 'Berries');
          t.submit(input);
          t.type(input, 'Mushrooms');
          t.submit(input);
          t.expect(row(t, 'li.supply', 'Berries') && row(t, 'li.supply', 'Mushrooms'), 'Stocking "Berries" and "Mushrooms" should put both on the shelf.');
          t.click(rowButton(t, 'li.supply', 'Berries', 'Clear'));
          t.expect(!row(t, 'li.supply', 'Berries'), 'Berries are still on the shelf after Clear.');
          t.expect(
            row(t, 'li.supply', 'Mushrooms'),
            "Clearing Berries also removed Mushrooms — they shared the same id. Every stocked item needs its own: dispatch({ type: 'stocked', id: nextId++, name }).",
          );
        }),
      ],
      css: `
        .pantry { padding: 18px; border-radius: 18px; background: #fefce8; color: #3f2d1d; border: 3px solid #a16207; }
        .pantry h2 { margin: 0 0 8px; color: inherit; }
        .pantry form { display: flex; gap: 8px; margin-bottom: 10px; }
        .pantry .shelf { list-style: none; padding: 0; display: grid; gap: 6px; }
        .pantry .supply { display: flex; gap: 8px; align-items: center; padding: 6px 10px; background: #fde68a; border-radius: 10px; }
        .pantry .label { flex: 1; font-weight: 600; }
      `,
      concepts: [
        {
          id: 'canopy-pure-reducer',
          icon: '🧼',
          title: 'Pure reducers',
          summary: 'No mutation, no randomness, a return in every case: same input → same output.',
          snippet: code`
            case 'stocked':
              return [...pantry, { id: action.id, name: action.name, qty: 1 }];
            case 'used':
              return pantry.map((i) => (i.id === action.id ? { ...i, qty: i.qty - 1 } : i));
          `,
          detail: 'In development, Strict Mode calls reducers twice to reveal impurity. Do random ids, dates and fetches in event handlers instead.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'canopy-sunlight',
      type: 'code',
      title: 'Sunlight Through the Leaves',
      blurb: 'Stop drilling the theme through every branch — let context carry it down.',
      xp: 130,
      story: [
        { text: 'Day and night sweep over the canopy, and every leaf needs to know which it is.', mood: 'happy' },
        { text: 'Right now the Elder Oak hands the theme to every branch, which hands it to every leaf. That is prop drilling, and the branches are exhausted. Let the light flow down on its own!', mood: 'thinking' },
      ],
      lesson: md`
        ## The prop drilling problem

        Sometimes data is needed **deep** in the tree, far from where it lives. Passing it through
        every layer in between is called **prop drilling**:

        \`\`\`jsx
        function App() {
          const [theme, setTheme] = useState('day');
          return <Canopy theme={theme} />;
        }
        function Canopy({ theme }) { return <Branch theme={theme} />; } // doesn't use it...
        function Branch({ theme }) { return <Leaf theme={theme} />; }   // ...just passes it on
        function Leaf({ theme })   { return <p className={theme}>🍃</p>; }
        \`\`\`

        \`Canopy\` and \`Branch\` don't care about \`theme\`: they're couriers. Every new layer
        means more plumbing, and renaming the prop means touching every file.

        ## Context: broadcast to everything below

        **Context** lets a component make a value available to **every component below it**,
        however deep, without passing props through the middle. Three steps:

        ### 1. Create it

        \`\`\`jsx
        import { createContext } from 'react';

        export const ThemeContext = createContext('day'); // 'day' is the default value
        \`\`\`

        ### 2. Provide it

        Wrap part of the tree and give it a \`value\`. In **React 19** the context itself is the
        provider:

        \`\`\`jsx
        <ThemeContext value={theme}>
          <Canopy />
        </ThemeContext>
        \`\`\`

        In older code (React 18 and before) you'll see the \`.Provider\` form. It does exactly the
        same thing and still works:

        \`\`\`jsx
        <ThemeContext.Provider value={theme}>
          <Canopy />
        </ThemeContext.Provider>
        \`\`\`

        ### 3. Use it

        Any component inside reads the nearest provided value with \`useContext\`:

        \`\`\`jsx
        import { useContext } from 'react';

        function Leaf() {
          const theme = useContext(ThemeContext);
          return <p className={theme}>🍃</p>;
        }
        \`\`\`

        ## Context + state

        Provide **state** as the value and the whole subtree follows it. When \`setTheme('night')\`
        runs, React re-renders every component that reads \`ThemeContext\` with the new value —
        even if the components in between never re-render.

        ## Default values

        The argument to \`createContext\` is used **only when there is no provider above** the
        component. It's a fallback, not an initial value.

        :::mistake
        Reading a context in the same component that provides it. \`useContext\` looks **upwards**
        from the component that calls it, so \`App\` gets the default, not the value it provides
        further down. Only components *inside* the provider see its value.
        :::

        :::tip
        The nearest provider wins: wrap one branch in \`<ThemeContext value="night">\` to flip just
        that part of the tree.
        :::
      `,
      task: md`
        ## 🎯 Let the sunlight flow

        \`theme\` is drilled from \`App\` through \`Canopy\` and \`Branch\` down to \`Leaf\`. Use context instead:

        1. Create and **export** \`ThemeContext\` with \`createContext('day')\`. \`'day'\` is the default.
        2. In \`App\`, wrap \`<Canopy />\` in \`<ThemeContext value={theme}>\` (the React 19 way).
        3. Remove the \`theme\` prop from \`Canopy\`, \`Branch\` and \`Leaf\` completely.
        4. \`Leaf\` (keep it exported) reads the theme with \`useContext(ThemeContext)\` and renders \`<div className={'leaf ' + theme}>\` with **☀️ Day leaf** or **🌙 Night leaf**.
        5. The **🌗 Toggle sky** button still switches between \`'day'\` and \`'night'\` — every leaf follows.
      `,
      starter: code`
        import { useState } from 'react';

        // TODO: export const ThemeContext = createContext('day');

        export function Leaf({ theme }) {
          return (
            <div className={'leaf ' + theme}>
              {theme === 'night' ? '🌙 Night leaf' : '☀️ Day leaf'}
            </div>
          );
        }

        function Branch({ theme }) {
          return (
            <div className="branch">
              <Leaf theme={theme} />
              <Leaf theme={theme} />
            </div>
          );
        }

        function Canopy({ theme }) {
          return (
            <section className="canopy">
              <Branch theme={theme} />
              <Branch theme={theme} />
            </section>
          );
        }

        export default function App() {
          const [theme, setTheme] = useState('day');

          return (
            <div className={'sky ' + theme}>
              <button onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>🌗 Toggle sky</button>
              <Canopy theme={theme} />
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, useContext, useState } from 'react';

        export const ThemeContext = createContext('day');

        export function Leaf() {
          const theme = useContext(ThemeContext);
          return (
            <div className={'leaf ' + theme}>
              {theme === 'night' ? '🌙 Night leaf' : '☀️ Day leaf'}
            </div>
          );
        }

        function Branch() {
          return (
            <div className="branch">
              <Leaf />
              <Leaf />
            </div>
          );
        }

        function Canopy() {
          return (
            <section className="canopy">
              <Branch />
              <Branch />
            </section>
          );
        }

        export default function App() {
          const [theme, setTheme] = useState('day');

          return (
            <div className={'sky ' + theme}>
              <button onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>🌗 Toggle sky</button>
              <ThemeContext value={theme}>
                <Canopy />
              </ThemeContext>
            </div>
          );
        }
      `,
      hints: [
        md`Import \`createContext\` and \`useContext\`, then at the top level: \`export const ThemeContext = createContext('day');\``,
        md`In \`App\`: \`<ThemeContext value={theme}><Canopy /></ThemeContext>\`. Then delete every \`theme={theme}\` and every \`{ theme }\` parameter.`,
        md`\`Leaf\` becomes \`export function Leaf() { const theme = useContext(ThemeContext); return ...; }\` — the JSX stays the same.`,
      ],
      tests: [
        test('ThemeContext is exported, with "day" as its default value', (t) => {
          const Ctx = getExport(t, 'ThemeContext', "Create it at the top level: export const ThemeContext = createContext('day');");
          t.expect(isContext(Ctx), "ThemeContext should be a context object made with createContext('day').");
          const Probe = () => t.h('span', { className: 'probe' }, String(t.React.useContext(Ctx)));
          t.render(t.h(Probe));
          const value = t.find('.probe').textContent;
          t.expect(value === 'day', `With no provider above, useContext(ThemeContext) gives "${value}" — the default should be 'day': createContext('day').`);
        }),
        test('Leaf reads the theme from ThemeContext — not from props', (t) => {
          const Ctx = getExport(t, 'ThemeContext', "Create it at the top level: export const ThemeContext = createContext('day');");
          const Leaf = getExport(t, 'Leaf', 'Keep Leaf exported: export function Leaf() { ... }');
          t.render(t.h(Ctx, { value: 'night' }, t.h(Leaf)));
          const leaf = t.find('.leaf');
          const text = norm(leaf.textContent);
          t.expect(
            text === '🌙 Night leaf',
            `Inside <ThemeContext value="night">, Leaf shows "${text}" — expected "🌙 Night leaf". Read the theme with const theme = useContext(ThemeContext); instead of a prop.`,
          );
          t.expect(leaf.classList.contains('night'), `The leaf's class is "${leaf.className}" — expected "leaf night": className={'leaf ' + theme}.`);
        }),
        test('🌗 Toggle sky turns every leaf to night and back', (t) => {
          t.render();
          const texts = () => t.$$('.leaf').map((l) => norm(l.textContent));
          t.expect(texts().length === 4, `Found ${texts().length} leaves — expected 4 (two branches with two leaves each).`);
          t.expect(texts().every((x) => x === '☀️ Day leaf'), `At the start the leaves read ${texts().map((x) => `"${x}"`).join(', ')} — expected all "☀️ Day leaf".`);
          t.click(t.button('Toggle sky'));
          t.expect(
            texts().every((x) => x === '🌙 Night leaf'),
            `After Toggle sky the leaves read ${texts().map((x) => `"${x}"`).join(', ')} — expected all "🌙 Night leaf". Wrap <Canopy /> in <ThemeContext value={theme}>.`,
          );
          t.click(t.button('Toggle sky'));
          t.expect(texts().every((x) => x === '☀️ Day leaf'), 'Toggling again should bring back the day.');
        }),
        test('No more prop drilling: Canopy, Branch and Leaf get no theme prop', (t) => {
          const src = stripComments(t.source);
          const holes = src.match(/<(Canopy|Branch|Leaf)\b[^>]*\btheme\s*=/g) || [];
          t.expect(
            holes.length === 0,
            `Still drilling: ${holes.map((h) => h.match(/<\w+/)[0] + ' theme=…>').join(', ')}. Remove those theme props — Leaf reads the theme from context now.`,
          );
          t.sourceIncludes(/\buseContext\s*\(\s*ThemeContext\s*\)/, 'Leaf should read the theme with useContext(ThemeContext).');
        }),
      ],
      css: `
        .sky { padding: 16px; border-radius: 18px; transition: background 0.5s, color 0.5s; }
        .sky.day { background: linear-gradient(180deg, #7dd3fc, #bbf7d0); color: #14532d; }
        .sky.night { background: linear-gradient(180deg, #0f172a, #1e3a8a); color: #e0e7ff; }
        .canopy { display: grid; gap: 10px; margin-top: 12px; }
        .branch { display: flex; gap: 10px; padding: 10px; border-radius: 14px; background: rgba(120, 53, 15, 0.3); }
        .leaf { flex: 1; padding: 12px; border-radius: 999px 6px; text-align: center; font-weight: 700; transition: all 0.5s; }
        .leaf.day { background: #86efac; color: #14532d; }
        .leaf.night { background: #1e293b; color: #c7d2fe; }
      `,
      concepts: [
        {
          id: 'canopy-prop-drilling',
          icon: '🕳️',
          title: 'Prop drilling',
          summary: 'Passing props through components that only forward them. Painful when it gets deep.',
          detail: 'For one or two levels, plain props are fine and clearer. When many distant components need the same data, reach for context.',
        },
        {
          id: 'canopy-context',
          icon: '☀️',
          title: 'Context',
          summary: 'createContext(default) → <Ctx value={v}> → useContext(Ctx) anywhere below.',
          snippet: code`
            const ThemeContext = createContext('day');

            <ThemeContext value={theme}>          {/* React 19 */}
              <Page />
            </ThemeContext>
            // older form: <ThemeContext.Provider value={theme}>

            const theme = useContext(ThemeContext);
          `,
          detail: 'The default value is used only when no provider is above the reader.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'canopy-wish-tree',
      type: 'code',
      title: 'The Wish Tree',
      blurb: 'Combine a reducer with two contexts and a provider component.',
      xp: 150,
      story: [
        { text: 'This is the Wish Tree. Villagers tie ribbons with their wishes, and the Elder Oak grants them one by one.', mood: 'happy' },
        { text: "Its reducer is ready, but the wishes can't reach the branches. Put the reducer in a provider and share it through context — the full canopy combo!", mood: 'excited' },
      ],
      lesson: md`
        ## Reducer + context: the canopy combo

        A reducer keeps update logic tidy. Context makes data available deep in the tree.
        Together they make a small app-wide state manager — no library needed:

        1. A **reducer** owns the state and the update rules.
        2. One context carries the **state**, a second one carries **dispatch**.
        3. A **provider component** sets it all up and wraps its \`children\`.
        4. Any component below reads what it needs with \`useContext\`.

        \`\`\`jsx
        export const WishesContext = createContext(null);
        export const WishesDispatchContext = createContext(null);

        export function WishesProvider({ children }) {
          const [wishes, dispatch] = useReducer(wishesReducer, initialWishes);
          return (
            <WishesContext value={wishes}>
              <WishesDispatchContext value={dispatch}>
                {children}
              </WishesDispatchContext>
            </WishesContext>
          );
        }
        \`\`\`

        \`children\` (remember the Component Forge?) is whatever you put between
        \`<WishesProvider>\` and \`</WishesProvider>\`. The provider doesn't need to know what's inside:

        \`\`\`jsx
        export default function App() {
          return (
            <WishesProvider>
              <WishCounter />
              <AddWish />
              <WishList />
            </WishesProvider>
          );
        }

        function AddWish() {
          const dispatch = useContext(WishesDispatchContext);
          // ... dispatch({ type: 'added', id: nextId++, text })
        }
        \`\`\`

        ## Why two contexts?

        \`dispatch\` never changes, but the wishes do. A component re-renders when a context it
        reads gets a new value, so a component that only **sends** actions (like \`AddWish\`)
        reads only the dispatch context — and doesn't re-render every time the list changes. It
        also makes it obvious who reads and who writes.

        ## When NOT to use context

        Context is tempting, but it hides where data comes from, and every reader re-renders
        when the value changes. Before reaching for it:

        - **Just pass props** if it's one or two levels. Explicit data flow is easy to follow.
        - **Pass JSX as children**: \`<Layout><Posts posts={posts} /></Layout>\` — \`Layout\` never touches \`posts\`, so nothing is drilled through it.

        Good fits for context: the theme, the signed-in user, the language, and app-wide state
        managed by a reducer.

        :::mistake
        Rendering a reader **outside** the provider. It gets the default value (\`null\` here),
        and \`wishes.filter(...)\` crashes. Make sure \`<WishesProvider>\` wraps everything that
        reads the context.
        :::

        :::pro
        In the Hook Workshop you'll wrap \`useContext(WishesContext)\` in tiny custom hooks such as
        \`useWishes()\` — the same pattern, even tidier.
        :::
      `,
      task: md`
        ## 🎯 Grow the Wish Tree

        The reducer is ready. Wire it up with context so no component needs props:

        1. Create and **export** two contexts with \`createContext(null)\`: \`WishesContext\` and \`WishesDispatchContext\`.
        2. Write and **export** \`WishesProvider({ children })\`. It calls \`useReducer(wishesReducer, initialWishes)\` and wraps \`children\` in \`<WishesContext value={wishes}>\` and \`<WishesDispatchContext value={dispatch}>\`.
        3. \`WishCounter\` and \`WishList\` read the wishes with \`useContext(WishesContext)\`; \`AddWish\` and \`WishList\` get \`dispatch\` with \`useContext(WishesDispatchContext)\`. Replace the placeholder \`[]\` and \`() => {}\` values.
        4. \`App\` wraps everything in \`<WishesProvider>\`.

        At the start the counter reads **1 of 2 wishes granted**. Tying a wish adds it; **Grant** grants it.
      `,
      starter: code`
        import { createContext, useContext, useReducer, useState } from 'react';

        const initialWishes = [
          { id: 1, text: 'A rope bridge to the moon', granted: false },
          { id: 2, text: 'Endless acorns', granted: true },
        ];
        let nextId = 3;

        function wishesReducer(wishes, action) {
          switch (action.type) {
            case 'added':
              return [...wishes, { id: action.id, text: action.text, granted: false }];
            case 'granted':
              return wishes.map((w) => (w.id === action.id ? { ...w, granted: true } : w));
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        // TODO 1: create and export WishesContext and WishesDispatchContext

        // TODO 2: export function WishesProvider({ children }) { ... }

        export function WishCounter() {
          const wishes = []; // TODO: read the wishes from context
          const granted = wishes.filter((w) => w.granted).length;
          return <p className="wish-count">{granted} of {wishes.length} wishes granted</p>;
        }

        export function AddWish() {
          const dispatch = () => {}; // TODO: read dispatch from context
          const [text, setText] = useState('');

          function handleSubmit(e) {
            e.preventDefault();
            if (!text.trim()) return;
            dispatch({ type: 'added', id: nextId++, text: text.trim() });
            setText('');
          }

          return (
            <form className="add-wish" onSubmit={handleSubmit}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Make a wish..." />
              <button type="submit">🎀 Tie wish</button>
            </form>
          );
        }

        export function WishList() {
          const wishes = []; // TODO: read the wishes from context
          const dispatch = () => {}; // TODO: read dispatch from context

          return (
            <ul className="wishes">
              {wishes.map((w) => (
                <li key={w.id} className={w.granted ? 'wish granted' : 'wish'}>
                  <span>{w.granted ? '✨' : '🎀'} {w.text}</span>
                  {!w.granted && <button onClick={() => dispatch({ type: 'granted', id: w.id })}>Grant</button>}
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          // TODO 3: wrap everything in <WishesProvider>
          return (
            <div className="wish-tree">
              <h2>🌳 The Wish Tree</h2>
              <WishCounter />
              <AddWish />
              <WishList />
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, useContext, useReducer, useState } from 'react';

        const initialWishes = [
          { id: 1, text: 'A rope bridge to the moon', granted: false },
          { id: 2, text: 'Endless acorns', granted: true },
        ];
        let nextId = 3;

        function wishesReducer(wishes, action) {
          switch (action.type) {
            case 'added':
              return [...wishes, { id: action.id, text: action.text, granted: false }];
            case 'granted':
              return wishes.map((w) => (w.id === action.id ? { ...w, granted: true } : w));
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export const WishesContext = createContext(null);
        export const WishesDispatchContext = createContext(null);

        export function WishesProvider({ children }) {
          const [wishes, dispatch] = useReducer(wishesReducer, initialWishes);
          return (
            <WishesContext value={wishes}>
              <WishesDispatchContext value={dispatch}>
                {children}
              </WishesDispatchContext>
            </WishesContext>
          );
        }

        export function WishCounter() {
          const wishes = useContext(WishesContext);
          const granted = wishes.filter((w) => w.granted).length;
          return <p className="wish-count">{granted} of {wishes.length} wishes granted</p>;
        }

        export function AddWish() {
          const dispatch = useContext(WishesDispatchContext);
          const [text, setText] = useState('');

          function handleSubmit(e) {
            e.preventDefault();
            if (!text.trim()) return;
            dispatch({ type: 'added', id: nextId++, text: text.trim() });
            setText('');
          }

          return (
            <form className="add-wish" onSubmit={handleSubmit}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Make a wish..." />
              <button type="submit">🎀 Tie wish</button>
            </form>
          );
        }

        export function WishList() {
          const wishes = useContext(WishesContext);
          const dispatch = useContext(WishesDispatchContext);

          return (
            <ul className="wishes">
              {wishes.map((w) => (
                <li key={w.id} className={w.granted ? 'wish granted' : 'wish'}>
                  <span>{w.granted ? '✨' : '🎀'} {w.text}</span>
                  {!w.granted && <button onClick={() => dispatch({ type: 'granted', id: w.id })}>Grant</button>}
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          return (
            <WishesProvider>
              <div className="wish-tree">
                <h2>🌳 The Wish Tree</h2>
                <WishCounter />
                <AddWish />
                <WishList />
              </div>
            </WishesProvider>
          );
        }
      `,
      hints: [
        md`Two lines at the top level: \`export const WishesContext = createContext(null);\` and \`export const WishesDispatchContext = createContext(null);\``,
        md`The provider: \`export function WishesProvider({ children }) { const [wishes, dispatch] = useReducer(wishesReducer, initialWishes); return <WishesContext value={wishes}><WishesDispatchContext value={dispatch}>{children}</WishesDispatchContext></WishesContext>; }\``,
        md`Replace each placeholder: \`const wishes = useContext(WishesContext);\` and \`const dispatch = useContext(WishesDispatchContext);\`. Then wrap App's \`<div>\` in \`<WishesProvider>...</WishesProvider>\`.`,
      ],
      tests: [
        test('WishesContext and WishesDispatchContext are exported contexts', (t) => {
          const state = getExport(t, 'WishesContext', 'Create it at the top level: export const WishesContext = createContext(null);');
          const dispatch = getExport(t, 'WishesDispatchContext', 'Create it at the top level: export const WishesDispatchContext = createContext(null);');
          t.expect(isContext(state), 'WishesContext should be made with createContext(null).');
          t.expect(isContext(dispatch), 'WishesDispatchContext should be made with createContext(null).');
          t.expect(state !== dispatch, 'Create two separate contexts — one for the wishes, one for dispatch.');
        }),
        test('WishesProvider shares the wishes and dispatch with its children', (t) => {
          const StateCtx = getExport(t, 'WishesContext', 'Export WishesContext first.');
          const DispatchCtx = getExport(t, 'WishesDispatchContext', 'Export WishesDispatchContext first.');
          const Provider = getExport(t, 'WishesProvider', 'Write export function WishesProvider({ children }) { ... }');
          const Probe = () => {
            const wishes = t.React.useContext(StateCtx);
            const dispatch = t.React.useContext(DispatchCtx);
            return t.h(
              'div',
              null,
              t.h('span', { className: 'probe-wishes' }, Array.isArray(wishes) ? `${wishes.length} wishes` : `got ${show(wishes)}`),
              t.h('span', { className: 'probe-dispatch' }, typeof dispatch),
              t.h('button', { onClick: () => dispatch({ type: 'added', id: 99, text: 'Probe wish' }) }, 'probe add'),
            );
          };
          renderOrExplain(t, t.h(Provider, null, t.h(Probe)), 'WishesProvider should call useReducer and render its children inside both contexts.');
          const wishes = findOr(t, '.probe-wishes', 'Nothing rendered inside <WishesProvider>. Return {children} inside both contexts.').textContent;
          t.expect(
            wishes === '2 wishes',
            `Inside <WishesProvider>, useContext(WishesContext) ${wishes.startsWith('got') ? wishes.replace('got', 'gave') : `found ${wishes}`} — expected the 2 starting wishes. Provide the reducer state: <WishesContext value={wishes}>, and render {children} inside.`,
          );
          const kind = t.find('.probe-dispatch').textContent;
          t.expect(kind === 'function', `Inside <WishesProvider>, useContext(WishesDispatchContext) gave ${kind === 'undefined' ? 'undefined' : `something of type ${kind}`} — expected the dispatch function: <WishesDispatchContext value={dispatch}>.`);
          t.click(t.button('probe add'));
          t.expect(t.find('.probe-wishes').textContent === '3 wishes', "Dispatching { type: 'added' } through the dispatch context didn't add a wish. Pass the dispatch from useReducer as the value.");
        }),
        test('WishCounter and WishList read from context — no props needed', (t) => {
          const Provider = getExport(t, 'WishesProvider', 'Write export function WishesProvider({ children }) { ... }');
          const Counter = getExport(t, 'WishCounter', 'Keep WishCounter exported.');
          const List = getExport(t, 'WishList', 'Keep WishList exported.');
          renderOrExplain(t, t.h(Provider, null, t.h(Counter), t.h(List)), 'WishCounter and WishList should read with useContext inside the provider.');
          findOr(t, '.wish-count', 'Nothing rendered inside <WishesProvider>. Return {children} inside both contexts.');
          const count = () => norm(t.find('.wish-count').textContent);
          t.expect(count() === '1 of 2 wishes granted', `Inside the provider, the counter reads "${count()}" — expected "1 of 2 wishes granted". WishCounter should use useContext(WishesContext).`);
          t.expect(t.count('li.wish') === 2, `WishList shows ${t.count('li.wish')} wish(es) — expected 2. Read them with useContext(WishesContext).`);
          t.click(rowButton(t, 'li.wish', 'rope bridge', 'Grant'));
          t.expect(count() === '2 of 2 wishes granted', `After granting the rope bridge the counter reads "${count()}" — expected "2 of 2 wishes granted". WishList should get dispatch with useContext(WishesDispatchContext).`);
        }),
        test('The whole tree works: tie a wish, then grant it', (t) => {
          renderOrExplain(t, undefined, 'Is everything in App wrapped in <WishesProvider>? Outside a provider, useContext returns the default value (null).');
          findOr(t, '.wish-count', 'The counter is missing. Keep <WishCounter /> in App, and make sure WishesProvider returns {children}.');
          const count = () => norm(t.find('.wish-count').textContent);
          t.expect(count() === '1 of 2 wishes granted', `The counter reads "${count()}" — expected "1 of 2 wishes granted". Wrap App's content in <WishesProvider>.`);
          const input = t.find('.add-wish input');
          t.type(input, 'A rope swing');
          t.submit(input);
          t.expect(row(t, 'li.wish', 'A rope swing'), 'Tying "A rope swing" should add it to the list. AddWish needs dispatch from useContext(WishesDispatchContext).');
          t.expect(count() === '1 of 3 wishes granted', `After tying a wish the counter reads "${count()}" — expected "1 of 3 wishes granted".`);
          t.click(rowButton(t, 'li.wish', 'A rope swing', 'Grant'));
          t.expect(count() === '2 of 3 wishes granted', `After granting it the counter reads "${count()}" — expected "2 of 3 wishes granted".`);
        }),
      ],
      css: `
        .wish-tree { padding: 18px; border-radius: 18px; background: radial-gradient(circle at 50% 0%, #166534, #052e16 80%); color: #dcfce7; }
        .wish-tree h2 { margin: 0 0 4px; color: inherit; }
        .wish-tree input { color: #052e16; }
        .wish-count { font-weight: 700; color: #fde68a; }
        .add-wish { display: flex; gap: 8px; margin: 8px 0 12px; }
        .wishes { list-style: none; padding: 0; display: grid; gap: 6px; }
        .wish { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; background: #14532d; }
        .wish.granted { background: #ca8a04; color: #1c1917; box-shadow: 0 0 14px #facc15; }
      `,
      concepts: [
        {
          id: 'canopy-context-reducer',
          icon: '🌳',
          title: 'Context + reducer',
          summary: 'A provider component owns a reducer and shares state and dispatch through two contexts.',
          snippet: code`
            export function WishesProvider({ children }) {
              const [wishes, dispatch] = useReducer(wishesReducer, initial);
              return (
                <WishesContext value={wishes}>
                  <WishesDispatchContext value={dispatch}>
                    {children}
                  </WishesDispatchContext>
                </WishesContext>
              );
            }
          `,
          detail: 'dispatch never changes, so components that only send actions read just the dispatch context.',
        },
        {
          id: 'canopy-when-not-context',
          icon: '🙅',
          title: 'When not to use context',
          summary: 'Try plain props or passing JSX as children first; use context for truly widespread data.',
          detail: 'Context hides where data comes from and re-renders every reader on change. Good fits: theme, current user, language, app-wide reducer state.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'canopy-trial',
      type: 'quiz',
      title: "The Owl's Examination",
      blurb: 'Eight questions on reducers and context, set by the wisest owl in the canopy.',
      xp: 100,
      story: [{ text: "Old Owl runs the Canopy exam. She's strict, but every answer comes with an explanation — hoo-hoo!", mood: 'happy' }],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What is wrong with this reducer?\n\n```jsx\nfunction cartReducer(cart, action) {\n  switch (action.type) {\n    case \'added\':\n      cart.items.push(action.item);\n      return cart;\n  }\n}\n```',
          [
            'Nothing — it works fine',
            'Reducers must be arrow functions',
            'It mutates `cart` and returns the same object, so React may skip the re-render — and unknown actions return `undefined`',
            '`switch` statements are not allowed in reducers',
          ],
          2,
          'React compares the old and new state with `Object.is`. Mutating `cart` and returning it means "nothing changed". Return a new object instead: `{ ...cart, items: [...cart.items, action.item] }`, and add a `default` case that throws.',
        ),
        q(
          'Your reducer needs a unique id for each new item. Where should the id be created?',
          [
            'In the event handler, then passed in the action: `dispatch({ type: \'added\', id: nextId++, text })`',
            'Inside the reducer, with `Math.random()`',
            'Inside the reducer, with `Date.now()`',
            'In the JSX, while rendering the list',
          ],
          0,
          'Reducers must be pure: the same state and action must always give the same result. React may even call them twice in development. Generate ids (and anything random or time-based) in the event handler and put them in the action.',
        ),
        q(
          'When is `useReducer` a better fit than `useState`?',
          [
            'For a single on/off toggle',
            'Whenever the state is a number',
            'Never — `useReducer` is the old way',
            'When many different events update the same state and the update logic is getting complicated',
          ],
          3,
          'Both hooks are fine. `useReducer` pays off when lots of handlers change the same state: the logic moves into one pure, testable function and handlers just describe what happened.',
        ),
        q(
          'What does `<Leaf />` show if no `ThemeContext` provider exists anywhere above it?\n\n```jsx\nconst ThemeContext = createContext(\'day\');\n\nfunction Leaf() {\n  const theme = useContext(ThemeContext);\n  return <p>{theme}</p>;\n}\n```',
          ['Nothing — it crashes', 'day', 'undefined', 'null'],
          1,
          'The argument to `createContext` is the default value, used only when there is no provider above the component. Here that is `\'day\'`.',
        ),
        q(
          'What do the two leaves show?\n\n```jsx\n<ThemeContext value="day">\n  <Leaf />\n  <ThemeContext value="night">\n    <Leaf />\n  </ThemeContext>\n</ThemeContext>\n```',
          ['day, then night', 'day, day', 'night, night', 'An error — providers cannot be nested'],
          0,
          '`useContext` reads the **nearest** provider above the component. The first leaf only has the "day" provider above it; the second one is closer to the "night" provider.',
        ),
        q(
          'Which of these provide a context value in React 19?\n\n```jsx\n// A\n<ThemeContext value="night">...</ThemeContext>\n\n// B\n<ThemeContext.Provider value="night">...</ThemeContext.Provider>\n```',
          ['Only A', 'Only B', 'Both — A is the new shorter form, B the older form that still works', 'Neither — you call `ThemeContext.set(\'night\')`'],
          2,
          'React 19 lets you render the context itself as the provider. `.Provider` is the form you will see in older code — it still works.',
        ),
        q(
          'A page passes `user` to its direct child: `<Avatar user={user} />`. Should you switch to context?',
          [
            'Yes — objects should always travel through context',
            'Yes — props are deprecated in React 19',
            'No — context only works with strings',
            'No — one level of props is clear and explicit. Context is for data many components at different depths need',
          ],
          3,
          'Passing props is the simplest, most traceable data flow. Prefer props (or passing JSX as `children`) until drilling becomes painful — then reach for context.',
        ),
        q(
          'Why does the reducer + context pattern often put `dispatch` in its own context?',
          [
            'React requires every context to hold a single value',
            '`dispatch` never changes, so components that only send actions don\'t re-render whenever the state changes',
            'It makes `dispatch` run faster',
            'A context can only hold functions',
          ],
          1,
          'A component re-renders when a context it reads gets a new value. The state changes often, but `dispatch` is stable, so readers of the dispatch context alone (like an "Add" form) skip those re-renders.',
        ),
      ],
      concepts: [
        {
          id: 'canopy-nearest-provider',
          icon: '🧭',
          title: 'Nearest provider wins',
          summary: 'useContext reads the closest provider above the component — or the default if there is none.',
          snippet: code`
            <ThemeContext value="day">
              <Leaf />                      {/* day */}
              <ThemeContext value="night">
                <Leaf />                    {/* night */}
              </ThemeContext>
            </ThemeContext>
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'canopy-boss',
      type: 'build',
      boss: true,
      bossName: 'The Prop Driller',
      bossIcon: '🐦',
      title: 'Boss: The Prop Driller',
      blurb: 'Plug every hole the Prop Driller bored: refactor the party pack to reducer + context.',
      xp: 300,
      badge: { id: 'badge-canopy', name: 'Canopy Keeper', icon: '🌳', description: 'Plugged every hole the Prop Driller bored through the Context Canopy.' },
      story: [
        { text: 'TOK-TOK-TOK! The Prop Driller is here: a giant woodpecker who bores a hole through every component just to pass props along.', mood: 'worried' },
        { text: 'The party pack works... but look at those holes. Gold, items, onBuy and onSell, drilled through Header, Camp, Market and Backpack.', mood: 'thinking' },
        { text: "Plug every hole! A reducer for the logic, a provider for the state, useContext wherever it's needed. Show him how the canopy really works!", mood: 'excited' },
      ],
      lesson: md`
        ## The drill-to-context recipe

        You've met every ingredient. Here's how to turn a drilled app into a reducer + context
        app, one safe step at a time:

        1. **Write the reducer.** Move the logic out of the event handlers into a pure \`partyReducer(state, action)\`, with actions named after what happened: \`'bought'\`, \`'sold'\`.
        2. **Create two contexts**: one for the state, one for \`dispatch\`.
        3. **Write a provider component** that calls \`useReducer\` and wraps \`children\` in both contexts.
        4. **Read where you need it.** Each component that *uses* the data calls \`useContext\` itself.
        5. **Delete the middlemen's props.** Components that only forwarded data stop taking it.
        6. **Wrap the app** in the provider.

        \`\`\`jsx
        export function PartyProvider({ children }) {
          const [party, dispatch] = useReducer(partyReducer, { gold: 20, items: [] });
          return (
            <PartyContext value={party}>
              <PartyDispatchContext value={dispatch}>{children}</PartyDispatchContext>
            </PartyContext>
          );
        }

        export function Purse() {
          const { gold } = useContext(PartyContext);
          return <p className="purse">💰 {gold} gold</p>;
        }
        \`\`\`

        ## Updating nested state in a reducer

        When the state is an object holding an array of objects, copy every level you change.
        Here a guild reducer gives XP to one hero:

        \`\`\`jsx
        case 'trained': {
          const hero = state.heroes.find((h) => h.id === action.id);
          if (!hero) return state; // nothing to do: same state, no re-render
          return {
            ...state,
            heroes: state.heroes.map((h) => (h.id === action.id ? { ...h, xp: h.xp + 10 } : h)),
          };
        }
        \`\`\`

        Returning the **same** \`state\` object is the official way to say "nothing changed" —
        handy for "not enough gold" — and React skips the re-render.

        :::tip
        Not every prop is a hole! \`<ShopItem item={item} />\` inside a \`.map()\` is normal data
        flow: each row needs its own item. The holes are the *shared* values (\`gold\`, \`items\`,
        \`onBuy\`, \`onSell\`) passed through components that never use them.
        :::

        :::mistake
        Rendering \`<Purse />\` outside \`<PartyProvider>\`: \`useContext(PartyContext)\` returns the
        default \`null\`, and destructuring \`{ gold }\` from \`null\` crashes. Keep everything that
        reads the party inside the provider.
        :::
      `,
      task: md`
        ## 👑 Plug every hole

        The party state is \`{ gold, items }\`; each item in the pack is \`{ id, name, icon, price, qty }\`. Refactor to **reducer + context**:

        1. Write and **export** a pure \`partyReducer(state, action)\`. On \`{ type: 'bought', item }\` (a catalog entry): if \`state.gold < item.price\` return \`state\` unchanged; otherwise pay \`item.price\` and add the item with \`qty: 1\`, or add 1 to its \`qty\` if it's already in the pack.
        2. On \`{ type: 'sold', id }\`: refund that item's \`price\` and lower its \`qty\` by 1, removing it at 0. Unknown actions throw.
        3. **Export** \`PartyContext\`, \`PartyDispatchContext\` and \`PartyProvider({ children })\`, which runs \`useReducer(partyReducer, { gold: 20, items: [] })\` and provides both.
        4. **Export** \`Purse\`, \`Market\` and \`Backpack\` and make them work with **no props**: \`Purse\` and \`Backpack\` read the party from context; \`ShopItem\` and \`PackItem\` dispatch \`bought\` / \`sold\` themselves.
        5. \`App\` wraps everything in \`<PartyProvider>\`. Remove every drilled \`gold\`, \`items\`, \`onBuy\` and \`onSell\` prop (passing \`item={item}\` to a row is fine).

        Keep the texts: the purse reads **💰 20 gold**, pack rows read like **🔥 Torch ×2**.
      `,
      starter: code`
        import { useState } from 'react';

        const catalog = [
          { id: 'potion', name: 'Potion', icon: '🧪', price: 5 },
          { id: 'torch', name: 'Torch', icon: '🔥', price: 2 },
          { id: 'map', name: 'Treasure map', icon: '🗺️', price: 8 },
        ];

        // TOK-TOK-TOK! 🐦 The Prop Driller bored a hole through every component below,
        // just to pass gold, items, onBuy and onSell along.

        function Purse({ gold }) {
          return <p className="purse">💰 {gold} gold</p>;
        }

        function Header({ gold }) {
          return (
            <header className="party-header">
              <h2>🎒 The Party Pack</h2>
              <Purse gold={gold} />
            </header>
          );
        }

        function ShopItem({ item, onBuy }) {
          return (
            <li className="shop-item">
              <span>{item.icon} {item.name} — {item.price} gold</span>
              <button onClick={() => onBuy(item)}>Buy</button>
            </li>
          );
        }

        function Market({ onBuy }) {
          return (
            <section className="market">
              <h3>🏪 Canopy Market</h3>
              <ul>
                {catalog.map((item) => (
                  <ShopItem key={item.id} item={item} onBuy={onBuy} />
                ))}
              </ul>
            </section>
          );
        }

        function PackItem({ item, onSell }) {
          return (
            <li className="pack-item">
              <span className="pack-label">{item.icon} {item.name} ×{item.qty}</span>
              <button onClick={() => onSell(item.id)}>Sell</button>
            </li>
          );
        }

        function Backpack({ items, onSell }) {
          return (
            <section className="backpack">
              <h3>🎒 Backpack</h3>
              {items.length === 0 ? (
                <p className="empty">Empty... for now.</p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <PackItem key={item.id} item={item} onSell={onSell} />
                  ))}
                </ul>
              )}
            </section>
          );
        }

        function Camp({ items, onBuy, onSell }) {
          return (
            <main className="camp">
              <Market onBuy={onBuy} />
              <Backpack items={items} onSell={onSell} />
            </main>
          );
        }

        export default function App() {
          const [gold, setGold] = useState(20);
          const [items, setItems] = useState([]);

          function handleBuy(item) {
            if (gold < item.price) return;
            setGold(gold - item.price);
            if (items.some((i) => i.id === item.id)) {
              setItems(items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i)));
            } else {
              setItems([...items, { ...item, qty: 1 }]);
            }
          }

          function handleSell(id) {
            const owned = items.find((i) => i.id === id);
            setGold(gold + owned.price);
            if (owned.qty > 1) {
              setItems(items.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)));
            } else {
              setItems(items.filter((i) => i.id !== id));
            }
          }

          return (
            <div className="party">
              <Header gold={gold} />
              <Camp items={items} onBuy={handleBuy} onSell={handleSell} />
            </div>
          );
        }
      `,
      solution: code`
        import { createContext, useContext, useReducer } from 'react';

        const catalog = [
          { id: 'potion', name: 'Potion', icon: '🧪', price: 5 },
          { id: 'torch', name: 'Torch', icon: '🔥', price: 2 },
          { id: 'map', name: 'Treasure map', icon: '🗺️', price: 8 },
        ];

        export function partyReducer(state, action) {
          switch (action.type) {
            case 'bought': {
              const { item } = action;
              if (state.gold < item.price) return state;
              const owned = state.items.some((i) => i.id === item.id);
              const items = owned
                ? state.items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i))
                : [...state.items, { ...item, qty: 1 }];
              return { ...state, gold: state.gold - item.price, items };
            }
            case 'sold': {
              const owned = state.items.find((i) => i.id === action.id);
              if (!owned) return state;
              const items =
                owned.qty > 1
                  ? state.items.map((i) => (i.id === action.id ? { ...i, qty: i.qty - 1 } : i))
                  : state.items.filter((i) => i.id !== action.id);
              return { ...state, gold: state.gold + owned.price, items };
            }
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export const PartyContext = createContext(null);
        export const PartyDispatchContext = createContext(null);

        export function PartyProvider({ children }) {
          const [party, dispatch] = useReducer(partyReducer, { gold: 20, items: [] });
          return (
            <PartyContext value={party}>
              <PartyDispatchContext value={dispatch}>{children}</PartyDispatchContext>
            </PartyContext>
          );
        }

        export function Purse() {
          const { gold } = useContext(PartyContext);
          return <p className="purse">💰 {gold} gold</p>;
        }

        function Header() {
          return (
            <header className="party-header">
              <h2>🎒 The Party Pack</h2>
              <Purse />
            </header>
          );
        }

        function ShopItem({ item }) {
          const dispatch = useContext(PartyDispatchContext);
          return (
            <li className="shop-item">
              <span>{item.icon} {item.name} — {item.price} gold</span>
              <button onClick={() => dispatch({ type: 'bought', item })}>Buy</button>
            </li>
          );
        }

        export function Market() {
          return (
            <section className="market">
              <h3>🏪 Canopy Market</h3>
              <ul>
                {catalog.map((item) => (
                  <ShopItem key={item.id} item={item} />
                ))}
              </ul>
            </section>
          );
        }

        function PackItem({ item }) {
          const dispatch = useContext(PartyDispatchContext);
          return (
            <li className="pack-item">
              <span className="pack-label">{item.icon} {item.name} ×{item.qty}</span>
              <button onClick={() => dispatch({ type: 'sold', id: item.id })}>Sell</button>
            </li>
          );
        }

        export function Backpack() {
          const { items } = useContext(PartyContext);
          return (
            <section className="backpack">
              <h3>🎒 Backpack</h3>
              {items.length === 0 ? (
                <p className="empty">Empty... for now.</p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <PackItem key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>
          );
        }

        function Camp() {
          return (
            <main className="camp">
              <Market />
              <Backpack />
            </main>
          );
        }

        export default function App() {
          return (
            <PartyProvider>
              <div className="party">
                <Header />
                <Camp />
              </div>
            </PartyProvider>
          );
        }
      `,
      hints: [
        md`Start with the reducer. \`'bought'\`: \`if (state.gold < item.price) return state;\` then build \`items\` with \`map\` (already owned → \`qty + 1\`) or spread (new → \`{ ...item, qty: 1 }\`), and return \`{ ...state, gold: state.gold - item.price, items }\`.`,
        md`\`'sold'\`: find the owned item, then \`qty > 1\` → \`map\` with \`qty - 1\`, otherwise \`filter\` it out; return \`{ ...state, gold: state.gold + owned.price, items }\`. Then create both contexts and \`PartyProvider\` exactly like the Wish Tree.`,
        md`Leaves read context: \`Purse\` → \`const { gold } = useContext(PartyContext);\`, \`Backpack\` → \`const { items } = useContext(PartyContext);\`, \`ShopItem\` → \`dispatch({ type: 'bought', item })\`, \`PackItem\` → \`dispatch({ type: 'sold', id: item.id })\`. Delete the drilled props and wrap App in \`<PartyProvider>\`.`,
      ],
      tests: [
        test('partyReducer "bought": pays gold, adds or stacks the item, refuses when too poor', (t) => {
          const reducer = getExport(t, 'partyReducer', 'Write export function partyReducer(state, action) { ... }');
          const potion = { id: 'potion', name: 'Potion', icon: '🧪', price: 5 };
          const map = { id: 'map', name: 'Treasure map', icon: '🗺️', price: 8 };
          const once = callReducer(t, reducer, 'partyReducer', { gold: 20, items: [] }, { type: 'bought', item: potion });
          t.expect(once && once.gold === 15, `Buying a Potion (5) with 20 gold left ${show(once && once.gold)} gold — expected 15.`);
          t.expect(
            Array.isArray(once.items) && once.items.length === 1 && once.items[0].id === 'potion' && once.items[0].qty === 1 && once.items[0].price === 5,
            `After buying a Potion the items are ${show(once.items)} — expected [{ ...item, qty: 1 }].`,
          );
          const twice = callReducer(t, reducer, 'partyReducer', once, { type: 'bought', item: potion });
          t.expect(
            twice && twice.gold === 10 && twice.items.length === 1 && twice.items[0].qty === 2,
            `Buying a second Potion gave ${show(twice)} — expected gold 10 and ONE Potion entry with qty: 2 (stack it, don't add a duplicate).`,
          );
          const poor = callReducer(t, reducer, 'partyReducer', { gold: 3, items: [] }, { type: 'bought', item: map });
          t.expect(
            poor && poor.gold === 3 && Array.isArray(poor.items) && poor.items.length === 0,
            `With 3 gold, buying a Treasure map (8) gave ${show(poor)} — expected nothing to change. Return state when state.gold < item.price.`,
          );
        }),
        test('partyReducer "sold": refunds the price, lowers qty, removes at zero', (t) => {
          const reducer = getExport(t, 'partyReducer', 'Write export function partyReducer(state, action) { ... }');
          const start = {
            gold: 0,
            items: [
              { id: 'torch', name: 'Torch', icon: '🔥', price: 2, qty: 2 },
              { id: 'potion', name: 'Potion', icon: '🧪', price: 5, qty: 1 },
            ],
          };
          const once = callReducer(t, reducer, 'partyReducer', start, { type: 'sold', id: 'torch' });
          const torch = once && Array.isArray(once.items) ? once.items.find((i) => i.id === 'torch') : undefined;
          t.expect(once && once.gold === 2, `Selling a Torch (price 2) with 0 gold left ${show(once && once.gold)} gold — expected 2.`);
          t.expect(torch && torch.qty === 1, `After selling one of two Torches, the Torch entry is ${show(torch)} — expected qty: 1.`);
          t.expect(once.items.find((i) => i.id === 'potion')?.qty === 1, 'Selling a Torch changed the Potion — only touch the item whose id matches.');
          const twice = callReducer(t, reducer, 'partyReducer', once, { type: 'sold', id: 'torch' });
          t.expect(
            twice && twice.gold === 4 && twice.items.length === 1 && twice.items[0].id === 'potion',
            `Selling the last Torch gave ${show(twice)} — expected gold 4 and the Torch removed (qty 0 → gone).`,
          );
          expectThrowsOnUnknown(t, reducer, 'partyReducer', start);
        }),
        test('PartyProvider shares the party through context — Purse, Market and Backpack need no props', (t) => {
          const Provider = getExport(t, 'PartyProvider', 'Write export function PartyProvider({ children }) { ... }');
          const missing = ['PartyContext', 'PartyDispatchContext', 'Purse', 'Market', 'Backpack'].filter((n) => !t.exports[n]);
          t.expect(missing.length === 0, `Missing export(s): ${missing.join(', ')}. Add export in front of each so the Driller can't hide them.`);
          const { Purse, Market, Backpack } = t.exports;
          renderOrExplain(
            t,
            t.h(Provider, null, t.h(Purse), t.h(Market), t.h(Backpack)),
            'Rendering <PartyProvider><Purse /><Market /><Backpack /></PartyProvider> with NO props must work: read gold and items with useContext(PartyContext).',
          );
          findOr(t, '.purse', 'Nothing rendered inside <PartyProvider> (or Purse renders nothing). PartyProvider must return {children} inside both contexts.');
          const purse = () => norm(t.find('.purse').textContent);
          t.expect(purse() === '💰 20 gold', `The purse reads "${purse()}" — expected "💰 20 gold" from the provider's state.`);
          t.click(rowButton(t, 'li.shop-item', 'Potion', 'Buy'));
          t.expect(purse() === '💰 15 gold', `After buying a Potion the purse reads "${purse()}" — expected "💰 15 gold". ShopItem should dispatch({ type: 'bought', item }) from useContext(PartyDispatchContext).`);
          const label = norm(t.$('.pack-item .pack-label')?.textContent);
          t.expect(label === '🧪 Potion ×1', `The backpack shows "${label || 'nothing'}" — expected "🧪 Potion ×1". Backpack should read items from useContext(PartyContext).`);
          t.click(buttonIn(t.find('li.pack-item'), 'Sell'));
          t.expect(purse() === '💰 20 gold' && t.count('li.pack-item') === 0, "Selling the Potion should refund 5 gold and empty the pack. PackItem should dispatch({ type: 'sold', id: item.id }).");
        }),
        test('The whole party works from App', (t) => {
          renderOrExplain(t, undefined, 'Is everything in App wrapped in <PartyProvider>? Outside a provider, useContext returns null.');
          findOr(t, '.purse', 'The purse is missing. Keep <Header /> (with its <Purse />) in App, and make sure PartyProvider returns {children}.');
          const purse = () => norm(t.find('.purse').textContent);
          const buy = (name) => t.click(rowButton(t, 'li.shop-item', name, 'Buy'));
          t.expect(purse() === '💰 20 gold', `The purse starts at "${purse()}" — expected "💰 20 gold".`);
          buy('Torch');
          buy('Torch');
          buy('Treasure map');
          buy('Treasure map');
          t.expect(purse() === '💰 0 gold', `After buying 2 Torches and 2 Treasure maps the purse reads "${purse()}" — expected "💰 0 gold".`);
          buy('Potion');
          t.expect(purse() === '💰 0 gold' && !row(t, 'li.pack-item', 'Potion'), 'With 0 gold, buying a Potion must do nothing.');
          t.click(rowButton(t, 'li.pack-item', 'Torch', 'Sell'));
          const labels = t.$$('.pack-item .pack-label').map((el) => norm(el.textContent));
          t.expect(purse() === '💰 2 gold', `After selling a Torch the purse reads "${purse()}" — expected "💰 2 gold".`);
          t.expect(
            labels.join(' | ') === '🔥 Torch ×1 | 🗺️ Treasure map ×2',
            `The backpack shows ${labels.map((l) => `"${l}"`).join(', ') || 'nothing'} — expected "🔥 Torch ×1" and "🗺️ Treasure map ×2".`,
          );
        }),
        test('Every hole is plugged: no gold, items, onBuy or onSell props drilled', (t) => {
          const src = stripComments(t.source);
          const holes = ['gold', 'items', 'onBuy', 'onSell']
            .map((name) => [name, (src.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*\\{`, 'gm')) || []).length])
            .filter(([, n]) => n > 0);
          t.expect(
            holes.length === 0,
            `The Prop Driller's holes are still open: ${holes.map(([name, n]) => `${name}={…}${n > 1 ? ` ×${n}` : ''}`).join(', ')}. Components should read the party with useContext instead of receiving it as props.`,
          );
          t.sourceIncludes(/\buseReducer\s*\(\s*partyReducer\b/, 'PartyProvider should call useReducer(partyReducer, { gold: 20, items: [] }).');
        }),
      ],
      css: `
        .party { padding: 16px; border-radius: 18px; background: linear-gradient(180deg, #365314, #14532d); color: #ecfccb; }
        .party-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .party-header h2 { margin: 0; color: inherit; }
        .purse { font-weight: 800; color: #fde047; font-size: 18px; margin: 0; }
        .camp { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
        .market, .backpack { padding: 10px 12px; border-radius: 14px; background: rgba(0, 0, 0, 0.25); }
        .market h3, .backpack h3 { margin: 0 0 6px; color: inherit; }
        .market ul, .backpack ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
        .shop-item, .pack-item { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .empty { opacity: 0.7; font-style: italic; }
      `,
      concepts: [
        {
          id: 'canopy-drill-recipe',
          icon: '🪵',
          title: 'From drilling to context',
          summary: 'Reducer for the logic, provider for the state, useContext where it is used, delete the forwarding props.',
          detail: 'Keep passing per-row data like item={item} as props — only shared state that travels through uninterested components belongs in context.',
        },
      ],
    },
  ],
};
