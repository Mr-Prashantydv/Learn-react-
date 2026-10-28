import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------- check helpers

/** Collapse whitespace so text comparisons are tolerant. */
const squish = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Portal content lands in document.body, outside the test container. The live
 * preview may have portaled things there too, so a check snapshots the body
 * first and then only looks at elements that appeared after that.
 */
function bodyScope() {
  const before = new Set(document.body.querySelectorAll('*'));
  const all = (sel) => Array.from(document.body.querySelectorAll(sel)).filter((el) => !before.has(el));
  return { all, one: (sel) => all(sel)[0] || null };
}

/**
 * Wraps a check that submits forms. React keeps one global "async action"
 * scope: an Action still pending when a check ends (its fake timer is thrown
 * away) would keep every later Action waiting forever. So, pass or fail, run
 * the remaining timers until every Action has finished.
 */
function settled(run) {
  return async (t) => {
    try {
      await run(t);
    } finally {
      try {
        for (let i = 0; i < 20 && t.timers.pendingTimeouts() > 0; i++) await t.tick(2000);
        await t.flush();
      } catch {
        /* only cleanup: the check's own result already stands */
      }
    }
  };
}

/** Suspense hides content it replaced with a fallback using display: none. */
function isShown(el) {
  for (let node = el; node; node = node.parentElement) {
    if (node.style && node.style.display === 'none') return false;
  }
  return true;
}

/**
 * Counts the keydown listeners the player's code attaches to document/window
 * (to prove an effect cleans up after itself). Call restore() in a finally.
 */
function trackKeydownListeners() {
  const active = new Map();
  const targets = [document, window];
  const restores = targets.map((target) => {
    const own = (key) => Object.prototype.hasOwnProperty.call(target, key);
    const had = { add: own('addEventListener'), remove: own('removeEventListener') };
    const origAdd = target.addEventListener;
    const origRemove = target.removeEventListener;
    const set = new Set();
    active.set(target, set);
    target.addEventListener = function (type, fn, opts) {
      if (type === 'keydown') set.add(fn);
      return origAdd.call(this, type, fn, opts);
    };
    target.removeEventListener = function (type, fn, opts) {
      if (type === 'keydown') set.delete(fn);
      return origRemove.call(this, type, fn, opts);
    };
    return () => {
      if (had.add) target.addEventListener = origAdd;
      else delete target.addEventListener;
      if (had.remove) target.removeEventListener = origRemove;
      else delete target.removeEventListener;
    };
  });
  return {
    count: () => Array.from(active.values()).reduce((n, set) => n + set.size, 0),
    restore: () => restores.forEach((r) => r()),
  };
}

// --- Warding Circle helpers
function chargeFire(t, times) {
  try {
    for (let i = 0; i < times; i++) t.click(t.button('Charge Fire'));
  } catch (err) {
    if (/crashed/i.test(err.message))
      t.fail(
        'Charging the Fire rune 3 times crashed the whole app ("The Fire rune cracked!"). Turn Ward into an error boundary: give it state = { hasError: false } and add static getDerivedStateFromError() { return { hasError: true }; }.',
      );
    throw err;
  }
}

// --- Mirror Gate helpers
function ripples(t) {
  const match = t.find('.ripples').textContent.match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function summonVision(t, body) {
  t.click(t.button('Summon vision'));
  const vision = body.one('.vision');
  if (!vision) t.fail('Clicking 🔮 Summon vision should show the <div className="vision">.');
  return vision;
}

// --- Library helpers
const PROPHECY = 'When state is mutated, the world stands still.';

function requireLibrary(t) {
  if (!t.$('h1'))
    t.fail(
      'Nothing is on screen while the library loads: with no <Suspense> boundary, the suspension travels all the way up and the whole page disappears. Wrap <Prophecy /> and <Grimoire /> in <Suspense fallback={…}> boundaries.',
    );
}

function prophecyFetchMessage(t) {
  return `/api/prophecy was fetched ${t.fetchCalls.length} times. Calling fetchProphecy() during render makes a brand-new promise on every render, so use() keeps waiting forever. Create the promise once, at the top level of the file (const prophecyPromise = fetchProphecy();), and pass it to <Prophecy promise={prophecyPromise} />.`;
}

// --- Owl Post helpers
async function postLetter(t, message) {
  if (message !== undefined) t.type('textarea[name="message"]', message);
  t.submit('form');
  try {
    await t.flush();
  } catch (err) {
    t.fail(
      `Your action crashed: "${err.message.replace(/^Your component crashed: /, '')}". With useActionState the action is called as sendLetter(prevState, formData), so formData is the SECOND parameter, and the <form> must use the formAction that useActionState returns (not sendLetter itself).`,
    );
  }
}

// --- Oracle helpers
async function whisper(t, text) {
  t.type('input[name="whisper"]', text);
  t.submit('form');
  await t.flush();
}

// --- Boss helpers
const TAUNT = 'Mwahaha! Every spell you cast will hang in the air... forever!';

async function openDuel(t, body) {
  await t.renderAsync();
  await t.tick(1000);
  await t.flush();
  t.click(t.button('Challenge'));
  const duel = body.one('.duel');
  if (!duel)
    t.fail(
      'Clicking ⚔️ Challenge should open the .duel. When dueling is true, render <Arena …><Ward><Duel /></Ward></Arena> with createPortal(…, document.body).',
    );
  return duel;
}

async function castSpell(t, body, spell) {
  const input = body.one('.duel input[name="spell"]');
  if (!input) t.fail('The duel needs its <form> with the <input name="spell" />.');
  t.type(input, spell);
  t.submit(input);
  await t.flush();
}

async function landSpell(t, body, spell) {
  await castSpell(t, body, spell);
  await t.tick(1000);
  await t.flush();
}

export default {
  id: 'arcane-spire',
  file: '12-arcane-spire.js',
  title: 'Arcane Spire',
  short: 'Advanced',
  subtitle: 'The advanced arts: error boundaries, portals, Suspense, Actions and the newest React 19 hooks.',
  icon: '🔮',
  colors: ['#2e1065', '#a855f7'],
  scenery: ['🔮', '📜', '🕯️', '✨', '🌙', '🦉', '⚗️', '🪄'],
  intro: [
    { text: "Behold, the Arcane Spire! React's most powerful spells are kept up here: wards, portals, Suspense and Actions.", mood: 'excited' },
    { text: "The Mutator's right hand, the Sorcerer of Suspense, has cursed the tower. Runes crack, scrolls load forever and every letter hangs in the air.", mood: 'worried' },
    { text: 'Each floor has a wizard with a spell to teach you. Climb all the way up and break the curse!', mood: 'happy' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'spire-wards',
      type: 'code',
      title: 'The Warding Circle',
      blurb: 'Raise error boundaries so one cracked rune cannot darken the whole tower.',
      xp: 130,
      story: [
        { text: "Floor one: Archmage Wardwick's rune circle. Charge a rune too much and it cracks. Right now, one crack plunges the WHOLE tower into darkness!", mood: 'worried' },
        { text: 'You need wards: error boundaries. A ward catches a crash below it and shows a fallback, so everything else keeps glowing.', mood: 'thinking' },
        { text: "Wards are written as class components, an older style of React. Don't panic, the lesson covers every bit you need!", mood: 'happy' },
      ],
      lesson: md`
        ## When a component crashes

        If a component throws an error while rendering, React can't trust that part of the
        screen any more. With nothing to catch the error, React **removes the whole tree**:
        the entire app goes blank.

        \`\`\`jsx
        function Rune({ charge }) {
          if (charge > 2) {
            throw new Error('The rune cracked!'); // 💥 the whole page disappears
          }
          return <p>Charge: {charge}</p>;
        }
        \`\`\`

        An **error boundary** is a component that catches errors thrown by the components
        *inside* it and shows a **fallback** instead. Everything outside it keeps working.

        \`\`\`jsx
        <Ward>
          <Rune />   {/* if this throws… */}
        </Ward>      {/* …only this part shows the fallback */}
        \`\`\`

        ## Error boundaries are class components

        There is no hook for catching render errors, so a boundary is written as a
        **class component**, React's older way of writing components. You only need a few pieces:

        \`\`\`jsx
        import { Component } from 'react';

        class Ward extends Component {
          // 1. The initial state: an object stored in a class field
          state = { hasError: false };

          // 2. React calls this when a child throws. Return the new state.
          static getDerivedStateFromError(error) {
            return { hasError: true };
          }

          // 3. Optional: report the error (side effects go here)
          componentDidCatch(error, info) {
            console.log('Ward caught:', error.message);
          }

          // 4. render() returns JSX, like a function component's return
          render() {
            if (this.state.hasError) {
              return <p>Something went wrong.</p>;
            }
            return this.props.children;
          }
        }
        \`\`\`

        | Function component | Class component |
        |---|---|
        | \`function Ward(props)\` | \`class Ward extends Component\` |
        | \`props.children\` | \`this.props.children\` |
        | \`useState(...)\` | \`state = { ... }\`, read with \`this.state\` |
        | \`setX(next)\` | \`this.setState({ ... })\` (merges into the state object) |
        | \`return <jsx />\` | \`render() { return <jsx />; }\` |

        ## Trying again

        Once a boundary shows its fallback, it stays there. To recover, set the state back:

        \`\`\`jsx
        <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        \`\`\`

        The children render again **from scratch**: the crashed component is mounted anew,
        with fresh state.

        ## Where to put boundaries

        You decide how much UI a crash takes down. One boundary around the whole app shows one
        big "Oops" page; a boundary around each widget keeps the rest of the page alive.
        Real apps usually do both: a top-level safety net plus smaller wards around independent parts.

        :::mistake
        Boundaries catch errors thrown **while React renders** (including effects). They do
        **not** catch errors inside event handlers or a \`setTimeout\` callback: those run
        outside rendering, so use a normal \`try { … } catch { … }\` there. A boundary also
        can't catch an error thrown by itself, only by its children.
        :::

        :::tip
        In development React still prints caught errors in the console. That's expected: the
        ward stops the crash from spreading, it doesn't hide it from you.
        :::

        :::pro
        Many projects use the tiny \`react-error-boundary\` package:
        \`<ErrorBoundary fallback={<p>Oops</p>}>\`. Under the hood, it's the class you're about to write.
        :::
      `,
      task: md`
        ## 🎯 Raise the wards

        \`Rune\` throws an error once it has been charged **3 times**. Click **Charge Fire**
        three times in the preview and watch everything go dark.

        1. Finish the \`Ward\` class:
           - its initial \`state\` is \`{ hasError: false }\`
           - add \`static getDerivedStateFromError()\` returning \`{ hasError: true }\`
        2. When \`this.state.hasError\` is true, \`render()\` returns a \`<div className="ward-fallback">\` containing:
           - a \`<p>\` with the text **🛡️ The ward held!**
           - a \`<button>\` labelled **Restore** that sets \`hasError\` back to \`false\`

           Otherwise it renders \`this.props.children\`.
        3. In \`App\`, give **each** rune its **own** \`<Ward>\`, so a cracked Fire rune
           doesn't take the Frost rune down with it.

        *Optional:* add \`componentDidCatch(error)\` and \`console.log\` the error message.
      `,
      starter: code`
        import { Component, useState } from 'react';

        // A rune cracks (throws while rendering) once it's charged 3 times.
        function Rune({ name }) {
          const [charge, setCharge] = useState(0);
          if (charge >= 3) {
            throw new Error(\`The \${name} rune cracked!\`);
          }
          return (
            <div className="rune">
              <span>{name} rune · charge {charge}</span>
              <button onClick={() => setCharge(charge + 1)}>Charge {name}</button>
            </div>
          );
        }

        // TODO 1: start with state = { hasError: false }
        // TODO 2: add static getDerivedStateFromError() returning { hasError: true }
        // TODO 3: when hasError, render the .ward-fallback with a Restore button
        class Ward extends Component {
          render() {
            return this.props.children;
          }
        }

        export default function App() {
          return (
            <div className="circle">
              <h1>The Warding Circle</h1>
              {/* TODO 4: one ward for both runes means one crack darkens both.
                  Give each rune its own <Ward>. */}
              <Ward>
                <Rune name="Fire" />
                <Rune name="Frost" />
              </Ward>
            </div>
          );
        }
      `,
      solution: code`
        import { Component, useState } from 'react';

        // A rune cracks (throws while rendering) once it's charged 3 times.
        function Rune({ name }) {
          const [charge, setCharge] = useState(0);
          if (charge >= 3) {
            throw new Error(\`The \${name} rune cracked!\`);
          }
          return (
            <div className="rune">
              <span>{name} rune · charge {charge}</span>
              <button onClick={() => setCharge(charge + 1)}>Charge {name}</button>
            </div>
          );
        }

        class Ward extends Component {
          state = { hasError: false };

          static getDerivedStateFromError() {
            return { hasError: true };
          }

          componentDidCatch(error) {
            console.log('Ward caught:', error.message);
          }

          render() {
            if (this.state.hasError) {
              return (
                <div className="ward-fallback">
                  <p>🛡️ The ward held!</p>
                  <button onClick={() => this.setState({ hasError: false })}>Restore</button>
                </div>
              );
            }
            return this.props.children;
          }
        }

        export default function App() {
          return (
            <div className="circle">
              <h1>The Warding Circle</h1>
              <Ward>
                <Rune name="Fire" />
              </Ward>
              <Ward>
                <Rune name="Frost" />
              </Ward>
            </div>
          );
        }
      `,
      hints: [
        md`A boundary needs two things: state that remembers the crash (\`state = { hasError: false };\` inside the class) and \`static getDerivedStateFromError() { return { hasError: true }; }\`.`,
        md`In \`render()\`, check \`this.state.hasError\` first and return the \`<div className="ward-fallback">\`; otherwise \`return this.props.children;\`. The Restore button is \`<button onClick={() => this.setState({ hasError: false })}>Restore</button>\`.`,
        md`In \`App\`, use two wards side by side: \`<Ward><Rune name="Fire" /></Ward>\` and \`<Ward><Rune name="Frost" /></Ward>\`.`,
      ],
      tests: [
        test('Both runes glow and can be charged', (t) => {
          t.render();
          t.expect(t.count('.rune') === 2, `Expected 2 runes (.rune) on screen, found ${t.count('.rune')}. Keep both <Rune name="Fire" /> and <Rune name="Frost" />.`);
          t.click(t.button('Charge Frost'));
          t.expectText('Frost rune · charge 1', 'Clicking "Charge Frost" should raise its charge to 1. Keep the Rune component as it is.');
          t.expect(!t.$('.ward-fallback'), 'The ward fallback is showing before anything cracked. Only render it when this.state.hasError is true.');
        }),
        test('An overcharged rune shows the ward instead of crashing the tower', (t) => {
          t.render();
          chargeFire(t, 3);
          const fallback = t.$('.ward-fallback');
          t.expect(fallback, 'The crash was caught, but no <div className="ward-fallback"> is shown. Return it from render() when this.state.hasError is true.');
          t.expect(
            fallback.textContent.includes('The ward held!'),
            `The fallback reads "${squish(fallback.textContent)}". It should contain a <p> with "🛡️ The ward held!".`,
          );
        }),
        test('Only the cracked rune falls: the Frost rune keeps working', (t) => {
          t.render();
          chargeFire(t, 3);
          t.expectElement('h1', 'The heading disappeared. Only the cracked rune should be replaced by the fallback.');
          const runes = t.$$('.rune');
          t.expect(
            runes.length === 1 && runes[0].textContent.includes('Frost'),
            'The Frost rune vanished together with the Fire rune because they share one ward. In App, wrap each rune in its own <Ward>.',
          );
          t.expect(t.count('.ward-fallback') === 1, `Expected exactly one .ward-fallback (for the Fire rune), found ${t.count('.ward-fallback')}.`);
          t.click(t.button('Charge Frost'));
          t.expectText('Frost rune · charge 1', 'The Frost rune should still charge normally while the Fire ward shows its fallback.');
        }),
        test('Restore brings the rune back, freshly reset', (t) => {
          t.render();
          chargeFire(t, 3);
          const restore = t.$$('.ward-fallback button').find((b) => /restore/i.test(b.textContent));
          t.expect(restore, 'Add a <button>Restore</button> inside the .ward-fallback.');
          t.click(restore);
          t.expect(!t.$('.ward-fallback'), 'After clicking Restore the fallback is still showing. The button should call this.setState({ hasError: false }).');
          t.expect(t.count('.rune') === 2, 'After Restore, both runes should be back on screen.');
          t.expectText('Fire rune · charge 0', 'The restored Fire rune should start again from "charge 0" (it is mounted from scratch).');
        }),
      ],
      css: code`
        .circle { padding: 16px; border-radius: 16px; text-align: center; color: #ede9fe; background: radial-gradient(circle at 50% 20%, #5b21b6, #1e1b4b 75%); }
        .circle h1 { margin-top: 0; }
        .rune { display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 360px; margin: 10px auto; padding: 10px 14px; border-radius: 12px; background: rgba(168, 85, 247, 0.18); border: 1px solid #a855f7; }
        .ward-fallback { max-width: 360px; margin: 10px auto; padding: 10px 14px; border-radius: 12px; border: 2px dashed #facc15; background: rgba(250, 204, 21, 0.12); color: #fef9c3; }
        .ward-fallback p { margin: 0 0 8px; font-weight: 700; }
      `,
      concepts: [
        {
          id: 'spire-error-boundary',
          icon: '🛡️',
          title: 'Error boundary',
          summary: 'Catches errors thrown while rendering its children and shows a fallback instead.',
          snippet: code`
            class Ward extends Component {
              state = { hasError: false };
              static getDerivedStateFromError() {
                return { hasError: true };
              }
              render() {
                return this.state.hasError ? <p>Oops!</p> : this.props.children;
              }
            }
          `,
          detail: "Wrap independent widgets so one crash doesn't blank the whole app. Errors in event handlers are not caught: use try/catch there.",
        },
        {
          id: 'spire-class-component',
          icon: '🏛️',
          title: 'Class components',
          summary: "React's older component style: extends Component, this.props, this.state, render().",
          snippet: code`
            class Greeting extends Component {
              state = { waves: 0 };
              render() {
                return (
                  <button onClick={() => this.setState({ waves: this.state.waves + 1 })}>
                    Hi {this.props.name}! ({this.state.waves})
                  </button>
                );
              }
            }
          `,
          detail: 'Modern React uses function components and hooks. You will mostly meet classes in older code and in error boundaries.',
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'spire-mirror',
      type: 'code',
      title: 'The Mirror Gate',
      blurb: 'Teleport a vision out of a clipping pool with createPortal.',
      xp: 130,
      story: [
        { text: "Floor two belongs to Seer Glimmerglass. Her scrying pool shows visions... but the pool is tiny, and its walls clip everything inside.", mood: 'thinking' },
        { text: 'A portal renders the vision somewhere else in the page, straight onto document.body, while in React it still belongs to the pool. Spooky? Very. Useful? Extremely!', mood: 'excited' },
      ],
      lesson: md`
        ## Trapped in a box

        Some UI must float above everything else: modals, tooltips, toasts, dropdown menus.
        But a component's markup normally lands **inside** its parent's DOM element. If an
        ancestor has \`overflow: hidden\`, a \`transform\` or a low \`z-index\`, your modal gets
        **clipped** or **buried**, however high its own \`z-index\` is.

        ## createPortal

        A **portal** renders some JSX into a **different DOM node**:

        \`\`\`jsx
        import { createPortal } from 'react-dom';

        function Modal({ children }) {
          return createPortal(
            <div className="modal">{children}</div>,
            document.body, // where the markup actually goes
          );
        }
        \`\`\`

        - The first argument is any JSX.
        - The second is a **DOM node** that already exists: \`document.body\`, or something like
          \`document.getElementById('modal-root')\`.
        - It comes from \`react-dom\`, not \`react\`: it's about the browser's DOM.

        ## Moved in the DOM, not in React

        A portal only moves the **DOM nodes**. In the **React tree** the modal is still a child
        of the component that rendered it, so:

        - it gets props, state and context from its React parents as usual;
        - **events bubble through the React tree**: a click inside the modal triggers \`onClick\`
          handlers on its React ancestors, even though its DOM lives somewhere else entirely;
        - when its parent unmounts, the portal content is removed too.

        \`\`\`jsx
        <div className="pool" onClick={() => console.log('ripple!')}>
          <Modal>
            <button>Click me</button> {/* logs "ripple!": bubbles to .pool in React */}
          </Modal>
        </div>
        \`\`\`

        ## Building a proper modal

        A good modal also:

        - has \`role="dialog"\` and \`aria-modal="true"\`, so screen readers announce it;
        - closes with a button **and** with the **Escape** key. Escape isn't tied to any one
          element, so listen on \`document\` in an effect and remove the listener in the cleanup
          (just like the listeners in the Effect Volcano):

        \`\`\`jsx
        useEffect(() => {
          function onKeyDown(e) {
            if (e.key === 'Escape') onClose();
          }
          document.addEventListener('keydown', onKeyDown);
          return () => document.removeEventListener('keydown', onKeyDown);
        }, [onClose]);
        \`\`\`

        :::mistake
        \`createPortal(jsx, '#modal-root')\` won't work: the second argument must be a real
        DOM node, not a selector string. Also, CSS that depends on the old parent (like
        \`.pool .vision { … }\`) stops matching once the element moves. Give portal content its
        own classes or inline styles.
        :::

        :::tip
        Browsers also have a native \`<dialog>\` element: its \`showModal()\` method lifts it into
        a special "top layer" above everything. Portals remain the general tool for any element
        that must escape its container.
        :::
      `,
      task: md`
        ## 🎯 Free the vision

        Click **🔮 Summon vision**: the vision appears *inside* the pool, and the pool's walls
        (\`overflow: hidden\`) clip it.

        1. Import \`createPortal\` from \`'react-dom'\`.
        2. Make \`Vision\` return its \`<div className="vision">\` through
           \`createPortal(…, document.body)\`. Keep the \`<h2>A vision appears!</h2>\` and the
           **Close** button inside it.
        3. Leave \`<Vision />\` where it is, *inside* the \`.pool\` div. In React it is still the
           pool's child, so clicks inside the vision must still add **Ripples**.
        4. In \`Vision\`, add an effect that listens for \`keydown\` on \`document\` and calls
           \`onClose()\` when \`e.key === 'Escape'\`. Return a cleanup that removes the listener,
           so it's gone as soon as the vision closes.
      `,
      starter: code`
        import { useEffect, useState } from 'react';
        // TODO 1: import createPortal from 'react-dom'

        // Once it's portaled, the vision lives outside the preview box,
        // so it brings its own inline styles.
        const visionStyle = {
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
          maxWidth: 300,
          padding: 20,
          borderRadius: 16,
          background: '#1e1b4b',
          color: '#ede9fe',
          border: '2px solid #a855f7',
          boxShadow: '0 0 32px rgba(168, 85, 247, 0.6)',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        };

        function Vision({ onClose }) {
          // TODO 4: close on Escape (an effect with a cleanup)

          // TODO 2: teleport this markup to document.body with createPortal
          return (
            <div className="vision" role="dialog" aria-modal="true" style={visionStyle}>
              <h2>A vision appears!</h2>
              <p>The Mutator hides at the top of his citadel.</p>
              <button onClick={onClose}>Close</button>
            </div>
          );
        }

        export default function App() {
          const [open, setOpen] = useState(false);
          const [ripples, setRipples] = useState(0);

          return (
            <div className="mirror-room">
              <h1>The Mirror Gate</h1>
              <p className="ripples">Ripples: {ripples}</p>
              <div className="pool" onClick={() => setRipples((r) => r + 1)}>
                <button onClick={() => setOpen(true)}>🔮 Summon vision</button>
                {open && <Vision onClose={() => setOpen(false)} />}
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useEffect, useState } from 'react';
        import { createPortal } from 'react-dom';

        // Once it's portaled, the vision lives outside the preview box,
        // so it brings its own inline styles.
        const visionStyle = {
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
          maxWidth: 300,
          padding: 20,
          borderRadius: 16,
          background: '#1e1b4b',
          color: '#ede9fe',
          border: '2px solid #a855f7',
          boxShadow: '0 0 32px rgba(168, 85, 247, 0.6)',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        };

        function Vision({ onClose }) {
          useEffect(() => {
            function onKeyDown(e) {
              if (e.key === 'Escape') onClose();
            }
            document.addEventListener('keydown', onKeyDown);
            return () => document.removeEventListener('keydown', onKeyDown);
          }, [onClose]);

          return createPortal(
            <div className="vision" role="dialog" aria-modal="true" style={visionStyle}>
              <h2>A vision appears!</h2>
              <p>The Mutator hides at the top of his citadel.</p>
              <button onClick={onClose}>Close</button>
            </div>,
            document.body,
          );
        }

        export default function App() {
          const [open, setOpen] = useState(false);
          const [ripples, setRipples] = useState(0);

          return (
            <div className="mirror-room">
              <h1>The Mirror Gate</h1>
              <p className="ripples">Ripples: {ripples}</p>
              <div className="pool" onClick={() => setRipples((r) => r + 1)}>
                <button onClick={() => setOpen(true)}>🔮 Summon vision</button>
                {open && <Vision onClose={() => setOpen(false)} />}
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Add \`import { createPortal } from 'react-dom';\`, then in \`Vision\` write \`return createPortal(<div className="vision" …>…</div>, document.body);\`. Note the comma between the JSX and \`document.body\`.`,
        md`For Escape, add \`useEffect(() => { … }, [onClose])\` in \`Vision\`. Inside it, define \`function onKeyDown(e) { if (e.key === 'Escape') onClose(); }\` and register it with \`document.addEventListener('keydown', onKeyDown);\`.`,
        md`Finish the effect with its cleanup: \`return () => document.removeEventListener('keydown', onKeyDown);\`. It must remove the **same** function you added.`,
      ],
      tests: [
        test('🔮 Summon vision shows the vision', (t) => {
          const body = bodyScope();
          t.render();
          t.expect(!body.one('.vision'), 'The vision should only appear after clicking 🔮 Summon vision.');
          const vision = summonVision(t, body);
          const h2 = vision.querySelector('h2');
          t.expect(h2 && squish(h2.textContent) === 'A vision appears!', 'Keep the <h2>A vision appears!</h2> inside the vision.');
        }),
        test('The vision is portaled to document.body, yet its clicks still ripple the pool', (t) => {
          const body = bodyScope();
          t.render();
          const vision = summonVision(t, body);
          t.expect(
            !t.container.contains(vision),
            "The .vision is still rendered inside .pool, where the pool's walls clip it. Make Vision return createPortal(<div className=\"vision\">…</div>, document.body).",
          );
          t.expect(
            vision.parentElement === document.body,
            `The vision was portaled into a <${vision.parentElement.tagName.toLowerCase()}>, but it should go straight into document.body.`,
          );
          const before = ripples(t);
          t.click(vision.querySelector('h2') || vision);
          t.expect(
            ripples(t) === before + 1,
            'Clicking inside the vision should add a ripple: React events bubble through the React tree, even out of a portal. Keep <Vision /> inside the .pool div in App.',
          );
        }),
        test('Close and Escape both dismiss the vision', (t) => {
          const body = bodyScope();
          t.render();
          let vision = summonVision(t, body);
          const close = Array.from(vision.querySelectorAll('button')).find((b) => /close/i.test(b.textContent));
          t.expect(close, 'Keep the Close button inside the vision.');
          t.click(close);
          t.expect(!body.one('.vision'), 'Clicking Close should remove the vision.');
          vision = summonVision(t, body);
          t.keyDown(document, 'Escape');
          t.expect(
            !body.one('.vision'),
            "Pressing Escape didn't close the vision. In Vision, add an effect that calls document.addEventListener('keydown', onKeyDown), where onKeyDown calls onClose() when e.key === 'Escape'.",
          );
        }),
        test('Closing the vision removes its keydown listener (effect cleanup)', (t) => {
          const body = bodyScope();
          t.render();
          const tracker = trackKeydownListeners();
          try {
            const vision = summonVision(t, body);
            t.expect(
              tracker.count() > 0,
              "Opening the vision should add a keydown listener on document (from an effect inside Vision), so Escape can close it.",
            );
            const close = Array.from(vision.querySelectorAll('button')).find((b) => /close/i.test(b.textContent)) || vision.querySelector('button');
            t.click(close);
            t.expect(
              tracker.count() === 0,
              "After the vision closed, its keydown listener is still attached. Put the effect inside Vision and return a cleanup: () => document.removeEventListener('keydown', onKeyDown), using the same function you added.",
            );
          } finally {
            tracker.restore();
          }
        }),
      ],
      css: code`
        .mirror-room { padding: 16px; border-radius: 16px; text-align: center; color: #ede9fe; background: linear-gradient(180deg, #1e1b4b, #312e81); }
        .mirror-room h1 { margin-top: 0; }
        .ripples { color: #c4b5fd; font-weight: 700; }
        .pool { position: relative; display: flex; align-items: center; justify-content: center; height: 130px; max-width: 320px; margin: 12px auto 0; border-radius: 50%; border: 3px solid #a855f7; background: radial-gradient(circle, #4338ca 0%, #1e1b4b 70%); overflow: hidden; transform: translateZ(0); }
      `,
      concepts: [
        {
          id: 'spire-portal',
          icon: '🌀',
          title: 'Portals',
          summary: 'createPortal renders JSX into another DOM node while it keeps its place in the React tree.',
          snippet: code`
            import { createPortal } from 'react-dom';

            function Modal({ children }) {
              return createPortal(<div className="modal">{children}</div>, document.body);
            }
          `,
          detail: 'Made for modals, tooltips and toasts. Context still flows in, and events still bubble to React ancestors.',
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'spire-library',
      type: 'bug',
      title: 'The Endless Scroll',
      blurb: 'Bug hunt! Fix the library where Suspense, lazy and use() are cast in the wrong places.',
      xp: 150,
      routes: {
        '/api/prophecy': { text: PROPHECY },
      },
      fetchDelay: 800,
      story: [
        { text: "Floor three: the Grand Library. Its scrolls and spellbooks live in a vault far below, and they take a moment to come up.", mood: 'thinking' },
        { text: 'Someone tampered with the loading spells! The library goes blank, the prophecy unrolls forever, and the grimoire forgets its page whenever a candle is lit.', mood: 'worried' },
        { text: 'Suspense, lazy and use() are the right spells, just cast in the wrong places. Read the lesson, then fix all three bugs.', mood: 'happy' },
      ],
      lesson: md`
        ## Waiting, the React way

        Sometimes part of the page can't render yet: its **code** hasn't downloaded, or its
        **data** hasn't arrived. In React such a component **suspends**: it tells React "I'm not
        ready". The nearest \`<Suspense>\` boundary above it then shows a **fallback** until
        everything inside is ready:

        \`\`\`jsx
        import { Suspense } from 'react';

        <Suspense fallback={<p className="loading">Loading…</p>}>
          <SlowThing />
        </Suspense>
        \`\`\`

        Everything *outside* the boundary stays on screen. With **no** boundary, the suspension
        travels all the way up and the whole app shows nothing.

        You choose what appears together: one boundary around two components reveals them
        together; two boundaries let each one appear as soon as it's ready.

        ## lazy: load a component's code on demand

        Big components don't need to be in the first download. \`lazy\` takes a function that
        returns a **promise of a module** (in real projects, a dynamic \`import()\`) and gives you
        a component:

        \`\`\`jsx
        import { lazy, Suspense } from 'react';

        const Grimoire = lazy(() => import('./Grimoire.jsx'));

        function Library() {
          return (
            <Suspense fallback={<p>Summoning the grimoire…</p>}>
              <Grimoire />
            </Suspense>
          );
        }
        \`\`\`

        The first time \`<Grimoire />\` renders, React starts the download and suspends. When
        the module arrives, React renders its **default export**.

        ## use: read a promise while rendering

        \`use\` (new in React 19) reads the value of a **promise**. If the promise isn't settled
        yet, the component suspends. When it resolves, React renders again and \`use\` returns
        the value:

        \`\`\`jsx
        import { use } from 'react';

        function Prophecy({ promise }) {
          const prophecy = use(promise); // suspends until the promise resolves
          return <blockquote>{prophecy.text}</blockquote>;
        }
        \`\`\`

        No effect, no \`isLoading\` state: the Suspense fallback *is* the loading state. If the
        promise rejects, the nearest error boundary shows its fallback. And unlike hooks, \`use\`
        may even be called inside an \`if\` or a loop (still only inside a component or a hook).

        :::mistake
        **Never create the promise during render.** \`use(fetchSomething())\` inside a component
        makes a *brand-new* promise on every render: React suspends, the data arrives, React
        renders again… and starts a new request. Forever. Create the promise **once, outside
        render**: at the top level of the file, in an event handler, or in a parent that stays
        on screen, and pass it down. (Frameworks and data libraries hand you cached promises.)
        :::

        :::mistake
        **Never create a lazy component during render.** Calling \`lazy\` inside a component
        creates a *new* component type on every render, so React throws away the old one, with
        all its state, and loads it again. Declare lazy components at the **top level** of the file.
        :::

        :::tip
        Suspense doesn't care **what** you're waiting for: code (\`lazy\`), data (\`use\`) or
        both. One mechanism, one kind of fallback.
        :::
      `,
      task: md`
        ## 🐛 Wake the library

        In this quest, \`importGrimoire()\` stands in for \`import('./Grimoire.jsx')\`: the
        grimoire's code arrives **1.5 s** after it is first needed. The prophecy comes from
        \`/api/prophecy\` and takes **0.8 s**. Fix the **three** bugs:

        1. **No Suspense boundary.** While anything loads, the whole library is blank, even the
           title. Wrap \`<Prophecy />\` and \`<Grimoire />\` in **separate** \`<Suspense>\` boundaries:
           - prophecy fallback: \`<p className="loading">Unrolling the scroll…</p>\`
           - grimoire fallback: \`<p className="loading">Summoning the grimoire…</p>\`
        2. **A new promise every render.** \`Prophecy\` calls \`use(fetchProphecy())\`, so every
           render starts a new fetch and the scroll never finishes unrolling. Create the promise
           **once**, at the top level of the file: \`const prophecyPromise = fetchProphecy();\`.
           Then render \`<Prophecy promise={prophecyPromise} />\` and read it with \`use(promise)\`.
        3. **A new grimoire every render.** \`lazy\` is called inside \`App\`, so every time
           \`App\` re-renders (light a candle!), a brand-new \`Grimoire\` is created and reloads
           from page 1. Move \`const Grimoire = lazy(importGrimoire);\` to the top level of the file.
      `,
      starter: code`
        import { Suspense, lazy, use, useState } from 'react';

        // Pretend this is import('./Grimoire.jsx'): a big component whose code
        // arrives over the network 1.5 seconds after it's first needed.
        function importGrimoire() {
          return new Promise((resolve) => {
            setTimeout(() => resolve({ default: GrimoirePages }), 1500);
          });
        }

        function GrimoirePages() {
          const [page, setPage] = useState(1);
          return (
            <div className="grimoire">
              <p className="page">📖 Page {page}</p>
              <button onClick={() => setPage(page + 1)}>Turn page</button>
            </div>
          );
        }

        // Asks the vault for the prophecy (it takes 0.8 seconds to come up).
        function fetchProphecy() {
          return fetch('/api/prophecy').then((res) => res.json());
        }

        function Prophecy() {
          const prophecy = use(fetchProphecy());
          return <blockquote className="prophecy">{prophecy.text}</blockquote>;
        }

        export default function App() {
          const [candles, setCandles] = useState(0);
          const Grimoire = lazy(importGrimoire);

          return (
            <div className="library">
              <h1>The Grand Library</h1>
              <button onClick={() => setCandles(candles + 1)}>🕯️ Light a candle</button>
              <p className="candles">Candles lit: {candles}</p>
              <Prophecy />
              <Grimoire />
            </div>
          );
        }
      `,
      solution: code`
        import { Suspense, lazy, use, useState } from 'react';

        // Pretend this is import('./Grimoire.jsx'): a big component whose code
        // arrives over the network 1.5 seconds after it's first needed.
        function importGrimoire() {
          return new Promise((resolve) => {
            setTimeout(() => resolve({ default: GrimoirePages }), 1500);
          });
        }

        function GrimoirePages() {
          const [page, setPage] = useState(1);
          return (
            <div className="grimoire">
              <p className="page">📖 Page {page}</p>
              <button onClick={() => setPage(page + 1)}>Turn page</button>
            </div>
          );
        }

        // Asks the vault for the prophecy (it takes 0.8 seconds to come up).
        function fetchProphecy() {
          return fetch('/api/prophecy').then((res) => res.json());
        }

        // Both are created once, when the file loads, never during render.
        const Grimoire = lazy(importGrimoire);
        const prophecyPromise = fetchProphecy();

        function Prophecy({ promise }) {
          const prophecy = use(promise);
          return <blockquote className="prophecy">{prophecy.text}</blockquote>;
        }

        export default function App() {
          const [candles, setCandles] = useState(0);

          return (
            <div className="library">
              <h1>The Grand Library</h1>
              <button onClick={() => setCandles(candles + 1)}>🕯️ Light a candle</button>
              <p className="candles">Candles lit: {candles}</p>
              <Suspense fallback={<p className="loading">Unrolling the scroll…</p>}>
                <Prophecy promise={prophecyPromise} />
              </Suspense>
              <Suspense fallback={<p className="loading">Summoning the grimoire…</p>}>
                <Grimoire />
              </Suspense>
            </div>
          );
        }
      `,
      hints: [
        md`Start with the boundaries: \`<Suspense fallback={<p className="loading">Unrolling the scroll…</p>}>\` around \`<Prophecy />\`, and a second \`<Suspense>\` with its own fallback around \`<Grimoire />\`.`,
        md`Move \`const Grimoire = lazy(importGrimoire);\` out of \`App\`, up to the top level of the file (outside every component).`,
        md`Add \`const prophecyPromise = fetchProphecy();\` at the top level too. Change \`Prophecy\` to \`function Prophecy({ promise }) { const prophecy = use(promise); … }\` and render \`<Prophecy promise={prophecyPromise} />\`.`,
      ],
      tests: [
        test('The library stays on screen while its scrolls load', async (t) => {
          await t.renderAsync();
          requireLibrary(t);
          t.expect(isShown(t.find('h1')), 'The heading should stay visible while the scrolls load.');
          const fallbacks = t.$$('.loading').filter(isShown);
          t.expect(
            fallbacks.length > 0,
            'While the scrolls load, show a fallback: <Suspense fallback={<p className="loading">Unrolling the scroll…</p>}> around <Prophecy />, and another around <Grimoire />.',
          );
        }),
        test('The prophecy appears as soon as it arrives, fetched only once', async (t) => {
          await t.renderAsync();
          requireLibrary(t);
          await t.tick(800);
          await t.flush();
          const prophecy = t.$('.prophecy');
          if (!prophecy || !isShown(prophecy)) {
            if (t.fetchCalls.length > 1) t.fail(`The prophecy never appeared, and ${prophecyFetchMessage(t)}`);
            t.fail(
              'The prophecy arrived after 0.8 s but is still hidden behind a fallback. If <Prophecy /> and <Grimoire /> share one <Suspense>, the prophecy waits for the slow grimoire too: give each its own boundary.',
            );
          }
          t.expect(squish(prophecy.textContent) === PROPHECY, `The prophecy reads "${squish(prophecy.textContent)}" — expected "${PROPHECY}". Render {prophecy.text}.`);
          t.expect(t.fetchCalls.length === 1, `The prophecy showed up, but ${prophecyFetchMessage(t)}`);
        }),
        test("The grimoire's code arrives lazily, open at page 1", async (t) => {
          await t.renderAsync();
          requireLibrary(t);
          await t.tick(1500);
          await t.flush();
          const page = t.$('.grimoire .page');
          t.expect(
            page && isShown(page),
            'After 1.5 s the grimoire should be on screen. Wrap <Grimoire /> in its own <Suspense> boundary (and make sure the prophecy above is fixed too).',
          );
          t.expect(/Page 1\b/.test(page.textContent), `The grimoire shows "${squish(page.textContent)}" — it should open at "Page 1".`);
        }),
        test('Lighting a candle re-renders App without reloading anything', async (t) => {
          await t.renderAsync();
          requireLibrary(t);
          await t.tick(1500);
          await t.flush();
          const page = t.$('.grimoire .page');
          t.expect(page && isShown(page), 'The grimoire must load first (see the objective above).');
          const loaded = t.$('.prophecy');
          t.expect(loaded && isShown(loaded), 'The prophecy must load first (see the objectives above).');
          t.click(t.button('Turn page'));
          t.expect(/Page 2\b/.test(t.find('.grimoire .page').textContent), 'Clicking "Turn page" should show "Page 2". Keep GrimoirePages as it is.');
          t.click(t.button('Light a candle'));
          await t.flush();
          t.expect(/Candles lit:\s*1/.test(t.find('.candles').textContent), 'Lighting a candle should show "Candles lit: 1".');
          const grimoirePage = t.$('.grimoire .page');
          const reloaded = !grimoirePage || !isShown(grimoirePage) || !/Page 2\b/.test(grimoirePage.textContent);
          t.expect(
            !reloaded,
            'Lighting a candle re-rendered App, and the grimoire reloaded from scratch (it forgot it was on page 2). lazy() inside App creates a new component on every render: move const Grimoire = lazy(importGrimoire); to the top level of the file.',
          );
          const prophecy = t.$('.prophecy');
          t.expect(
            prophecy && isShown(prophecy) && t.fetchCalls.length === 1,
            `Lighting a candle re-rendered App and the prophecy loaded all over again (/api/prophecy was fetched ${t.fetchCalls.length} times). A promise created while App renders is a new one on every render. Create it once, at the top level of the file: const prophecyPromise = fetchProphecy();`,
          );
        }),
      ],
      css: code`
        .library { padding: 16px; border-radius: 16px; text-align: center; color: #f5f3ff; background: linear-gradient(180deg, #2e1065, #4c1d95); }
        .library h1 { margin-top: 0; }
        .candles { color: #fde68a; font-weight: 700; }
        .loading { color: #c4b5fd; font-style: italic; }
        .prophecy { max-width: 380px; margin: 12px auto; padding: 12px 16px; border-left: 4px solid #facc15; background: rgba(250, 204, 21, 0.1); font-style: italic; text-align: left; }
        .grimoire { max-width: 260px; margin: 12px auto; padding: 12px; border-radius: 12px; background: #fef3c7; color: #451a03; }
      `,
      concepts: [
        {
          id: 'spire-suspense',
          icon: '⏳',
          title: 'Suspense',
          summary: 'Shows a fallback while components inside it wait for code or data.',
          snippet: code`
            <Suspense fallback={<p>Loading…</p>}>
              <Prophecy promise={prophecyPromise} />
            </Suspense>
          `,
          detail: 'Everything outside the boundary stays visible. Separate boundaries let each part appear as soon as it is ready.',
        },
        {
          id: 'spire-lazy',
          icon: '💤',
          title: 'lazy',
          summary: "Loads a component's code the first time it renders.",
          snippet: code`
            const Grimoire = lazy(() => import('./Grimoire.jsx'));
          `,
          detail: 'Always declare lazy components at the top level of a file, never inside another component.',
        },
        {
          id: 'spire-use',
          icon: '🪄',
          title: 'use(promise)',
          summary: "Reads a promise's value during render, suspending until it resolves.",
          snippet: code`
            function Prophecy({ promise }) {
              const prophecy = use(promise);
              return <p>{prophecy.text}</p>;
            }
          `,
          detail: 'Create the promise outside render (top level, an event handler or a parent), never inside the component that reads it.',
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'spire-owl-post',
      type: 'code',
      title: 'The Owl Post',
      blurb: 'Send letters with form Actions, useActionState and useId.',
      xp: 140,
      story: [
        { text: 'Floor four: the Owlery! Wizards send letters all over Reactoria by owl. Well, they did, until the Sorcerer cursed the post office.', mood: 'worried' },
        { text: "Now every owl needs a whole second to fly, and nobody can tell whether a letter left or failed. Time for React 19's Actions!", mood: 'excited' },
      ],
      lesson: md`
        ## Forms, the old way

        In the Form Fortress you handled forms with \`onSubmit\`, \`event.preventDefault()\` and a
        pile of state: is it sending? Did it fail? What came back? For async requests that's a lot
        of bookkeeping. React 19 gives forms a better tool.

        ## Actions: a function as the form's action

        A \`<form>\` can take a **function** as its \`action\`. When the form is submitted, React
        calls it with the form's \`FormData\`, with no \`preventDefault()\` needed:

        \`\`\`jsx
        async function sendLetter(formData) {
          const to = formData.get('to'); // fields are read by their name
          await sendByOwl(to);
        }

        <form action={sendLetter}>
          <input name="to" />
          <button type="submit">Send</button>
        </form>
        \`\`\`

        - Fields are read from \`formData\` by their \`name\` attribute, so the inputs can stay
          uncontrolled: no \`useState\` per field.
        - Functions used like this are called **Actions**. React runs them inside a
          **transition**, so it always knows when one is pending.
        - When the Action finishes, React **resets the form** (uncontrolled fields are cleared).

        ## useActionState: state that comes from an action

        Usually you want to show what happened: a counter, an error message, a result.
        \`useActionState\` wraps your action and keeps its **return value** as state:

        \`\`\`jsx
        import { useActionState } from 'react';

        async function sendLetter(prevState, formData) {
          const message = formData.get('message');
          if (!message.trim()) {
            return { ...prevState, error: 'Write something first!' };
          }
          await sendByOwl(message);
          return { sent: prevState.sent + 1, error: null };
        }

        function OwlPost() {
          const [state, formAction, isPending] = useActionState(sendLetter, { sent: 0, error: null });
          return (
            <form action={formAction}>
              <textarea name="message" />
              <button disabled={isPending}>{isPending ? 'Sending…' : 'Send'}</button>
              {state.error && <p className="owl-error">{state.error}</p>}
              <p>Sent: {state.sent}</p>
            </form>
          );
        }
        \`\`\`

        | You get | What it is |
        |---|---|
        | \`state\` | whatever your action **returned** last (the initial state at first) |
        | \`formAction\` | the wrapped action: pass it to \`<form action={formAction}>\` |
        | \`isPending\` | \`true\` while the action is running |

        The action's **signature changes**: it now receives \`(previousState, formData)\`. Quick repeated
        submissions run **one after another**, each receiving what the previous one returned.

        :::mistake
        With \`useActionState\`, \`formData\` is the **second** argument. If you keep
        \`async function sendLetter(formData)\`, your "formData" is really the previous state,
        and \`formData.get\` is not a function!
        :::

        ## useId: ids that never clash

        \`<label htmlFor="x">\` must match \`<input id="x">\`, but a component can appear many
        times on a page, and hardcoded ids would clash. \`useId()\` returns an id that is unique
        to each component instance:

        \`\`\`jsx
        import { useId } from 'react';

        function LetterFields() {
          const id = useId();
          return (
            <>
              <label htmlFor={id + '-to'}>To</label>
              <input id={id + '-to'} name="to" />
              <label htmlFor={id + '-message'}>Message</label>
              <textarea id={id + '-message'} name="message" />
            </>
          );
        }
        \`\`\`

        One \`useId()\` call is enough for several fields: add a suffix to each. The ids look odd
        on purpose (something like \`_r_1_\`), and they match between server and browser rendering.
        Don't use \`useId\` for list **keys**: keys come from your data.

        :::tip
        React resets the form after *every* finished action, even one that returned an error,
        so the user's text disappears. To keep it, return the submitted values in your state
        and use them as each field's \`defaultValue\`.
        :::
      `,
      task: md`
        ## 🎯 Get the owls flying

        \`sendLetter\` is already a plain Action: the owls fly, but nobody can tell what happened.

        1. **Ids**: call \`useId()\` once in \`App\`. Link the **To** label to the \`to\` input with
           \`id + '-to'\`, and the **Message** label to the \`message\` textarea with \`id + '-message'\`
           (as \`htmlFor\` on the label, \`id\` on the field).
        2. **The action**: change it to \`async function sendLetter(prevState, formData)\`:
           - read \`message\` from \`formData\`;
           - if it's empty after \`.trim()\`, return \`{ ...prevState, error: 'An owl cannot carry an empty letter!' }\`
             **without** sending;
           - otherwise \`await sendByOwl(formData.get('to'), message)\` and return
             \`{ sent: prevState.sent + 1, error: null }\`.
        3. **The hook**: call \`useActionState(sendLetter, { sent: 0, error: null })\` and give the
           \`<form>\` the returned \`formAction\` as its \`action\`.
        4. **Show the state**: \`<p className="status">\` reads **Letters sent: {state.sent}**, and when
           there is an error, show it in a \`<p className="owl-error">\`.
        5. **Pending**: while the owl flies, the submit button is \`disabled\` and reads
           **Owl in flight…**; otherwise it reads **Send owl 🦉**.
      `,
      starter: code`
        import { useActionState, useId } from 'react';

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // The cursed owls need a full second per letter. (Don't change this.)
        async function sendByOwl(to, message) {
          await wait(1000);
          console.log(\`🦉 Letter delivered to \${to || 'nobody'}: "\${message}"\`);
        }

        // A plain Action: React calls it with the form's FormData.
        // It works... but nobody can tell whether the letter was sent!
        // TODO 2: make it sendLetter(prevState, formData) and return the new state
        async function sendLetter(formData) {
          await sendByOwl(formData.get('to'), formData.get('message'));
        }

        export default function App() {
          // TODO 1: const id = useId();
          // TODO 3: const [state, formAction, isPending] = useActionState(...);

          return (
            <div className="owlery">
              <h1>🦉 The Owl Post</h1>
              <form action={sendLetter}>
                <label>To</label>
                <input name="to" placeholder="Pip" />
                <label>Message</label>
                <textarea name="message" placeholder="Dear Pip…" />
                {/* TODO 5: disabled + "Owl in flight…" while pending */}
                <button type="submit">Send owl 🦉</button>
              </form>
              {/* TODO 4: show the error, if there is one */}
              <p className="status">Letters sent: 0</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useActionState, useId } from 'react';

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // The cursed owls need a full second per letter. (Don't change this.)
        async function sendByOwl(to, message) {
          await wait(1000);
          console.log(\`🦉 Letter delivered to \${to || 'nobody'}: "\${message}"\`);
        }

        async function sendLetter(prevState, formData) {
          const message = formData.get('message');
          if (!message.trim()) {
            return { ...prevState, error: 'An owl cannot carry an empty letter!' };
          }
          await sendByOwl(formData.get('to'), message);
          return { sent: prevState.sent + 1, error: null };
        }

        export default function App() {
          const id = useId();
          const [state, formAction, isPending] = useActionState(sendLetter, { sent: 0, error: null });

          return (
            <div className="owlery">
              <h1>🦉 The Owl Post</h1>
              <form action={formAction}>
                <label htmlFor={id + '-to'}>To</label>
                <input id={id + '-to'} name="to" placeholder="Pip" />
                <label htmlFor={id + '-message'}>Message</label>
                <textarea id={id + '-message'} name="message" placeholder="Dear Pip…" />
                <button type="submit" disabled={isPending}>
                  {isPending ? 'Owl in flight…' : 'Send owl 🦉'}
                </button>
              </form>
              {state.error && <p className="owl-error">{state.error}</p>}
              <p className="status">Letters sent: {state.sent}</p>
            </div>
          );
        }
      `,
      hints: [
        md`\`const id = useId();\` then \`<label htmlFor={id + '-to'}>To</label>\` with \`<input id={id + '-to'} name="to" />\`. Do the same for the message with \`'-message'\`.`,
        md`The action becomes \`async function sendLetter(prevState, formData)\`. Return early with \`{ ...prevState, error: 'An owl cannot carry an empty letter!' }\` when \`!message.trim()\`; after the \`await\`, return \`{ sent: prevState.sent + 1, error: null }\`.`,
        md`\`const [state, formAction, isPending] = useActionState(sendLetter, { sent: 0, error: null });\`, then \`<form action={formAction}>\`, \`disabled={isPending}\` and \`{isPending ? 'Owl in flight…' : 'Send owl 🦉'}\` on the button, \`{state.error && <p className="owl-error">{state.error}</p>}\` and \`Letters sent: {state.sent}\`.`,
      ],
      tests: [
        test('Labels are linked to their fields with useId, unique per form', (t) => {
          t.render(t.h(t.React.Fragment, null, t.h(t.App), t.h(t.App)));
          const forms = t.$$('form');
          t.expect(forms.length === 2, 'Keep a single <form> in App.');
          const ids = [];
          forms.forEach((form) => {
            const labels = Array.from(form.querySelectorAll('label'));
            const toLabel = labels.find((l) => /^to\b/i.test(squish(l.textContent)));
            const messageLabel = labels.find((l) => /message/i.test(l.textContent));
            const to = form.querySelector('input[name="to"]');
            const message = form.querySelector('textarea[name="message"]');
            t.expect(toLabel && messageLabel && to && message, 'Keep the "To" and "Message" labels, the to <input> and the message <textarea> inside the form.');
            t.expect(
              to.id && toLabel.htmlFor === to.id,
              `The "To" label has htmlFor="${toLabel.htmlFor}" but the input has id="${to.id}". Give both the same value: htmlFor={id + '-to'} and id={id + '-to'}.`,
            );
            t.expect(
              message.id && messageLabel.htmlFor === message.id,
              `The "Message" label has htmlFor="${messageLabel.htmlFor}" but the textarea has id="${message.id}". Use id + '-message' for both.`,
            );
            ids.push(to.id, message.id);
          });
          t.expect(
            new Set(ids).size === ids.length,
            `With two Owl Posts on one page the ids clash (${ids.join(', ')}). Hardcoded ids aren't unique per component: build them from useId().`,
          );
          t.sourceIncludes(/useId\s*\(\s*\)/, 'Generate the ids with const id = useId();');
        }),
        test('An empty letter shows the error your action returns', settled(async (t) => {
          t.render();
          t.type('input[name="to"]', 'Pip');
          await postLetter(t);
          const error = t.$('.owl-error');
          t.expect(
            error,
            "Submitting an empty message should show <p className=\"owl-error\">. Return { ...prevState, error: 'An owl cannot carry an empty letter!' } from sendLetter, and render state.error.",
          );
          t.expect(
            squish(error.textContent) === 'An owl cannot carry an empty letter!',
            `The error reads "${squish(error.textContent)}" — expected "An owl cannot carry an empty letter!".`,
          );
          await t.tick(1000);
          await t.flush();
          t.expect(!t.logLines().some((line) => line.includes('🦉')), 'An owl still flew off with the empty letter. Return the error state *before* calling sendByOwl.');
          t.expect(/Letters sent:\s*0\b/.test(t.find('.status').textContent), 'An empty letter must not count as sent: the status should still read "Letters sent: 0".');
        })),
        test('While the owl flies, the button is disabled and reads "Owl in flight…"', settled(async (t) => {
          t.render();
          t.type('input[name="to"]', 'Pip');
          await postLetter(t, 'The tower still stands!');
          const button = t.find('form button');
          t.expect(
            button.disabled && /owl in flight/i.test(button.textContent),
            `While the letter is on its way, the button reads "${squish(button.textContent)}"${button.disabled ? '' : ' and can still be clicked'}. Use isPending from useActionState: disabled={isPending} and the text "Owl in flight…".`,
          );
          await t.tick(1000);
          await t.flush();
          const after = t.find('form button');
          t.expect(
            !after.disabled && /send owl/i.test(after.textContent),
            `Once the owl has landed, the button should be enabled again and read "Send owl 🦉" (it reads "${squish(after.textContent)}").`,
          );
        })),
        test('Delivered letters count up and clear an old error', settled(async (t) => {
          t.render();
          await postLetter(t);
          await postLetter(t, 'First letter');
          await t.tick(1000);
          await t.flush();
          let status = squish(t.find('.status').textContent);
          t.expect(
            status === 'Letters sent: 1',
            `After one delivered letter the status reads "${status}" — expected "Letters sent: 1". After the await, return { sent: prevState.sent + 1, error: null } and render state.sent.`,
          );
          t.expect(!t.$('.owl-error'), 'The old error is still showing after a successful letter. Return error: null when the owl delivers.');
          await postLetter(t, 'Second letter');
          await t.tick(1000);
          await t.flush();
          status = squish(t.find('.status').textContent);
          t.expect(status === 'Letters sent: 2', `After two letters the status reads "${status}" — expected "Letters sent: 2". Build on prevState.sent.`);
          t.sourceIncludes(/useActionState\s*\(/, 'Keep the result in state with useActionState(sendLetter, { sent: 0, error: null }).');
        })),
      ],
      css: code`
        .owlery { padding: 16px; border-radius: 16px; color: #e0e7ff; background: linear-gradient(180deg, #1e293b, #312e81); }
        .owlery h1 { margin-top: 0; }
        .owlery form { display: grid; gap: 6px; max-width: 360px; }
        .owlery textarea { min-height: 60px; }
        .owl-error { color: #fca5a5; font-weight: 700; }
        .status { color: #a5b4fc; font-weight: 700; }
      `,
      concepts: [
        {
          id: 'spire-actions',
          icon: '📮',
          title: 'Form Actions',
          summary: 'Pass a function to <form action>: React calls it with the FormData inside a transition.',
          snippet: code`
            async function send(formData) {
              await save(formData.get('message'));
            }

            <form action={send}>
              <input name="message" />
            </form>
          `,
          detail: 'No preventDefault needed. When the action finishes, React resets the uncontrolled fields.',
        },
        {
          id: 'spire-use-action-state',
          icon: '📜',
          title: 'useActionState',
          summary: "Keeps an action's return value as state, plus a pending flag.",
          snippet: code`
            const [state, formAction, isPending] = useActionState(
              async (prevState, formData) => ({ count: prevState.count + 1 }),
              { count: 0 },
            );
          `,
          detail: 'The action receives (previousState, formData). Submissions are queued and run one after another.',
        },
        {
          id: 'spire-use-id',
          icon: '🆔',
          title: 'useId',
          summary: 'A unique, stable id per component instance, for labels and aria attributes.',
          snippet: code`
            const id = useId();
            <label htmlFor={id + '-name'}>Name</label>
            <input id={id + '-name'} />
          `,
          detail: 'Never hardcode ids in reusable components, and never use useId for list keys.',
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'spire-oracle',
      type: 'code',
      title: "The Oracle's Foresight",
      blurb: 'Show whispers instantly with useOptimistic and a useFormStatus button.',
      xp: 150,
      story: [
        { text: "Floor five: the Oracle's chamber. Wizards whisper questions to her... and wait. And wait. The curse makes every whisper take a second and a half.", mood: 'worried' },
        { text: 'But the Oracle sees the future! If she knows a whisper will arrive, why not show it right away? That is optimistic UI, and React 19 has a hook for it.', mood: 'excited' },
      ],
      lesson: md`
        ## Don't make people wait for good news

        Most requests succeed. So instead of making people stare at a spinner, many apps show
        the result **immediately** and confirm it quietly in the background. Chat apps show your
        message the moment you press Send; a like counter goes up the instant you tap. That's
        **optimistic UI**.

        ## useOptimistic

        \`\`\`jsx
        import { useOptimistic } from 'react';

        const [optimisticWhispers, addOptimisticWhisper] = useOptimistic(
          whispers, // the real state
          (current, text) => [...current, { text, sending: true }], // how to apply an update
        );
        \`\`\`

        - \`optimisticWhispers\` is what you render. Normally it is simply \`whispers\`.
        - Calling \`addOptimisticWhisper(text)\` **inside an Action** runs your update function
          and shows the result right away.
        - When the Action finishes, the optimistic value is thrown away and React shows the
          **real** state again. If the real state now contains the whisper, it seamlessly stays.
          If the action ended without saving it (say it caught an error), the optimistic entry
          simply disappears: rollback for free.

        \`\`\`jsx
        async function whisperAction(formData) {
          const text = formData.get('whisper');
          addOptimisticWhisper(text); // 1. show it instantly
          const saved = await deliverWhisper(text); // 2. the slow part
          startTransition(() => {
            setWhispers((current) => [...current, saved]); // 3. the real state
          });
        }
        \`\`\`

        Like every state update, the update function must be **pure**: return a new array,
        never \`push\` into \`current\`.

        :::warn
        Inside an async Action, a state update that happens after an \`await\` is **no longer
        part of the Action's transition** (a current JavaScript limitation). Wrap it in
        \`startTransition\`, as above, so the switch from optimistic to real happens in one
        smooth step. With \`useActionState\` you don't need this: the returned value *is* the new state.
        :::

        ## useFormStatus: is my form busy?

        A submit button often lives in its own reusable component. To know whether *its* form
        is submitting, it can call \`useFormStatus\`, which comes from \`react-dom\` (not \`react\`):

        \`\`\`jsx
        import { useFormStatus } from 'react-dom';

        function SendButton() {
          const { pending } = useFormStatus();
          return (
            <button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send'}
            </button>
          );
        }

        <form action={whisperAction}>
          <input name="whisper" />
          <SendButton /> {/* reads the status of THIS form */}
        </form>
        \`\`\`

        No props needed: the button finds its parent form by itself, a bit like context. Besides
        \`pending\`, it also gives you \`data\` (the \`FormData\` being sent), \`method\` and \`action\`.

        :::mistake
        \`useFormStatus\` only reports on a \`<form>\` that is **above** it. Called in the component
        that *renders* the form, it has no form above it: \`pending\` stays \`false\` forever.
        :::
      `,
      task: md`
        ## 🎯 Grant the Oracle her foresight

        \`whisperAction\` already delivers whispers (slowly!) and saves them in \`whispers\`.

        1. In \`App\`, call \`useOptimistic(whispers, updateFn)\`, where \`updateFn(current, text)\`
           returns a **new** array with \`{ text, sending: true }\` added at the end. Name the
           results \`optimisticWhispers\` and \`addOptimisticWhisper\`.
        2. In \`whisperAction\`, call \`addOptimisticWhisper(text)\` **before** the \`await\`.
        3. Render \`optimisticWhispers\` instead of \`whispers\`. A whisper that is still
           \`sending\` gets \`className="sending"\` on its \`<li>\` and shows
           \`<small> (sending…)</small>\` after its text.
        4. In \`SendButton\`, read \`pending\` from \`useFormStatus()\`. While the form is pending
           the button is \`disabled\` and reads **Whispering…**; otherwise it reads **Whisper**.
      `,
      starter: code`
        import { startTransition, useOptimistic, useState } from 'react';
        import { useFormStatus } from 'react-dom';

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // The curse: every whisper needs 1.5 seconds to reach the Oracle. (Don't change this.)
        async function deliverWhisper(text) {
          await wait(1500);
          return { text };
        }

        function SendButton() {
          // TODO 4: const { pending } = useFormStatus();
          return <button type="submit">Whisper</button>;
        }

        export default function App() {
          const [whispers, setWhispers] = useState([]);
          // TODO 1: const [optimisticWhispers, addOptimisticWhisper] = useOptimistic(...);

          async function whisperAction(formData) {
            const text = formData.get('whisper');
            // TODO 2: show the whisper right away
            const saved = await deliverWhisper(text);
            startTransition(() => {
              setWhispers((current) => [...current, saved]);
            });
          }

          return (
            <div className="oracle">
              <h1>🔮 The Oracle's Chamber</h1>
              <ul className="whispers">
                {/* TODO 3: render optimisticWhispers, marking the ones still sending.
                    (Whispers are only ever added at the end, so the index is a stable key.) */}
                {whispers.map((whisper, i) => (
                  <li key={i}>{whisper.text}</li>
                ))}
              </ul>
              <form action={whisperAction}>
                <input name="whisper" placeholder="Whisper to the Oracle…" />
                <SendButton />
              </form>
            </div>
          );
        }
      `,
      solution: code`
        import { startTransition, useOptimistic, useState } from 'react';
        import { useFormStatus } from 'react-dom';

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // The curse: every whisper needs 1.5 seconds to reach the Oracle. (Don't change this.)
        async function deliverWhisper(text) {
          await wait(1500);
          return { text };
        }

        function SendButton() {
          const { pending } = useFormStatus();
          return (
            <button type="submit" disabled={pending}>
              {pending ? 'Whispering…' : 'Whisper'}
            </button>
          );
        }

        export default function App() {
          const [whispers, setWhispers] = useState([]);
          const [optimisticWhispers, addOptimisticWhisper] = useOptimistic(
            whispers,
            (current, text) => [...current, { text, sending: true }],
          );

          async function whisperAction(formData) {
            const text = formData.get('whisper');
            addOptimisticWhisper(text);
            const saved = await deliverWhisper(text);
            startTransition(() => {
              setWhispers((current) => [...current, saved]);
            });
          }

          return (
            <div className="oracle">
              <h1>🔮 The Oracle's Chamber</h1>
              <ul className="whispers">
                {/* Whispers are only ever added at the end, so the index is a stable key. */}
                {optimisticWhispers.map((whisper, i) => (
                  <li key={i} className={whisper.sending ? 'sending' : ''}>
                    {whisper.text}
                    {whisper.sending && <small> (sending…)</small>}
                  </li>
                ))}
              </ul>
              <form action={whisperAction}>
                <input name="whisper" placeholder="Whisper to the Oracle…" />
                <SendButton />
              </form>
            </div>
          );
        }
      `,
      hints: [
        md`\`const [optimisticWhispers, addOptimisticWhisper] = useOptimistic(whispers, (current, text) => [...current, { text, sending: true }]);\``,
        md`Call \`addOptimisticWhisper(text);\` right after reading \`text\` in \`whisperAction\`. Then map over \`optimisticWhispers\`: \`<li key={i} className={whisper.sending ? 'sending' : ''}>{whisper.text}{whisper.sending && <small> (sending…)</small>}</li>\`.`,
        md`In \`SendButton\`: \`const { pending } = useFormStatus();\` and \`<button type="submit" disabled={pending}>{pending ? 'Whispering…' : 'Whisper'}</button>\`.`,
      ],
      tests: [
        test('A whisper appears instantly, marked as sending', settled(async (t) => {
          t.render();
          await whisper(t, 'Will the tower stand?');
          const items = t.$$('.whispers li');
          t.expect(
            items.length === 1,
            `Right after submitting, the list shows ${items.length} whispers, but the new whisper should already be there, 1.5 s before it arrives. Call addOptimisticWhisper(text) before the await, render optimisticWhispers, and make your update function return a NEW array: [...current, { text, sending: true }] (React ignores an array changed in place with push).`,
          );
          const li = items[0];
          t.expect(li.textContent.includes('Will the tower stand?'), 'The optimistic <li> should show the whisper text.');
          t.expect(li.classList.contains('sending'), 'A whisper that is still on its way needs className="sending" on its <li>.');
          t.expect(/\(sending…\)|\(sending\.\.\.\)/.test(li.textContent), 'Show <small> (sending…)</small> after the text of a whisper that is still sending.');
        })),
        test('When the Oracle receives it, the sending mark disappears', settled(async (t) => {
          t.render();
          await whisper(t, 'Will the tower stand?');
          await t.tick(1500);
          await t.flush();
          const items = t.$$('.whispers li');
          t.expect(
            items.length === 1,
            `After delivery the list has ${items.length} whispers — expected exactly 1. If it shows twice, your update function changed the real array: return [...current, { text, sending: true }] instead of using push.`,
          );
          t.expect(squish(items[0].textContent) === 'Will the tower stand?', `The delivered whisper reads "${squish(items[0].textContent)}" — expected just "Will the tower stand?" without the sending mark.`);
          t.expect(!items[0].classList.contains('sending'), 'Once delivered, the whisper should lose its "sending" class.');
        })),
        test('SendButton shows "Whispering…" while its form is pending (useFormStatus)', settled(async (t) => {
          t.render();
          await whisper(t, 'Hello, Oracle');
          const button = t.find('form button');
          t.expect(
            button.disabled && /whispering/i.test(button.textContent),
            `While the whisper travels, the button reads "${squish(button.textContent)}"${button.disabled ? '' : ' and is clickable'}. In SendButton, call const { pending } = useFormStatus(); and use it for disabled and the "Whispering…" text. (It only works inside a component rendered within the <form>.)`,
          );
          await t.tick(1500);
          await t.flush();
          const after = t.find('form button');
          t.expect(!after.disabled && /^whisper$/i.test(squish(after.textContent)), `When the whisper has arrived, the button should read "Whisper" and be enabled again (it reads "${squish(after.textContent)}").`);
          t.sourceIncludes(/useFormStatus\s*\(\s*\)/, 'Read the pending flag with useFormStatus() inside SendButton.');
        })),
        test('Two quick whispers both appear at once', settled(async (t) => {
          t.render();
          await whisper(t, 'First');
          await whisper(t, 'Second');
          const sending = t.$$('.whispers li.sending');
          t.expect(
            sending.length === 2,
            `Two whispers sent back to back should both show as sending right away; found ${sending.length}. The update function must keep the current ones: return [...current, { text, sending: true }]. (And keep the plain <form action={whisperAction}>: useActionState would queue the second whisper until the first one lands.)`,
          );
          await t.tick(1500);
          await t.flush();
          const items = t.$$('.whispers li');
          const texts = items.map((li) => squish(li.textContent)).join(' | ');
          t.expect(
            items.length === 2 && texts === 'First | Second' && !t.$('.whispers li.sending'),
            `After delivery the list reads "${texts}" — expected "First | Second" with no sending marks.`,
          );
        })),
      ],
      css: code`
        .oracle { padding: 16px; border-radius: 16px; color: #f5f3ff; background: radial-gradient(circle at 50% 0%, #6d28d9, #1e1b4b 70%); }
        .oracle h1 { margin-top: 0; text-align: center; }
        .whispers { list-style: none; padding: 0; min-height: 40px; }
        .whispers li { margin: 6px 0; padding: 8px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.12); }
        .whispers li.sending { opacity: 0.6; font-style: italic; }
        .oracle form { display: flex; gap: 8px; }
        .oracle input { flex: 1; }
      `,
      concepts: [
        {
          id: 'spire-use-optimistic',
          icon: '🔭',
          title: 'useOptimistic',
          summary: 'Shows a temporary, hopeful value while an Action is still running.',
          snippet: code`
            const [optimisticItems, addOptimistic] = useOptimistic(
              items,
              (current, item) => [...current, { ...item, pending: true }],
            );
            // inside an Action: addOptimistic(newItem);
          `,
          detail: 'When the Action finishes, the optimistic value is dropped and the real state shows again.',
        },
        {
          id: 'spire-use-form-status',
          icon: '⏱️',
          title: 'useFormStatus',
          summary: 'Tells a component inside a <form> whether that form is submitting.',
          snippet: code`
            import { useFormStatus } from 'react-dom';

            function SubmitButton() {
              const { pending } = useFormStatus();
              return <button disabled={pending}>Save</button>;
            }
          `,
          detail: 'It must be called from a component rendered inside the form, never in the component that renders the form.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'spire-beyond',
      type: 'quiz',
      title: 'Beyond the Spire',
      blurb: 'Server Components, directives, frameworks, TypeScript and testing: the wider world.',
      xp: 100,
      story: [
        { text: 'From the top balcony you can see far beyond Reactoria: servers humming, frameworks raising cities, type-checkers and testers keeping watch.', mood: 'thinking' },
        { text: "The Archmage's exam is about that wider world. No code this time, just wisdom. Every explanation teaches something new, so read them all!", mood: 'happy' },
      ],
      task: md`Eight questions about the world beyond the browser tab: **Server Components**, \`'use client'\` / \`'use server'\`, frameworks, TypeScript and testing.`,
      questions: [
        q(
          'In frameworks like Next.js, components are **Server Components** by default. What makes a Server Component special?',
          [
            'It renders in the browser, but only after the server allows it',
            'It runs only on the server (or at build time), so its code is never sent to the browser',
            'It is a class component that extends `ServerComponent`',
            'It can only return plain text, not JSX',
          ],
          1,
          "Server Components render ahead of time on the server. The browser receives their *result*, not their code, so they can read files or databases directly and add nothing to the JavaScript bundle. They need a framework (or bundler setup) that supports them, which is why you haven't written one in this game.",
        ),
        q(
          'Which of these can a Server Component **not** do?',
          [
            'Be an `async` function that `await`s its data: `const posts = await db.posts.all()`',
            'Read a file or query a database',
            'Render Client Components and pass them props',
            'Use `useState` or attach an `onClick` handler',
          ],
          3,
          "A Server Component runs on the server and never in the browser: nothing re-renders it there and nobody can click it, so there's no state, no effects and no event handlers. Interactive parts go in Client Components. In exchange, Server Components may be `async` and simply `await` their data, no effects required!",
        ),
        q(
          "What does the `'use client'` directive at the very top of a file do?",
          [
            'It marks a boundary: this module and everything it imports become client code, shipped to the browser, so they can use state, effects and events',
            'It makes the component render only in the browser, never on the server',
            'It must be added to every file that contains a component',
            "It turns the file's functions into Server Functions",
          ],
          0,
          "`'use client'` marks where the server-to-client boundary starts: that module and its imports are bundled for the browser. Client Components are still pre-rendered to HTML on the server for a fast first paint; the directive is about what gets shipped and made interactive. You only need it at the entry of an interactive subtree, not in every file.",
        ),
        q(
          "And what does `'use server'` mark?",
          [
            'Server Components',
            'Files that only run during the build',
            'Server Functions: async functions that run on the server but can be called from the client, for example as a `<form action>`',
            'The root component of the app',
          ],
          2,
          "A classic mix-up! Server Components need **no** directive. `'use server'` marks **Server Functions**: when the browser calls one, the framework turns the call into a network request. Pass one to `<form action={…}>` and everything from this tower still works with it: `useActionState`, `useFormStatus`, `useOptimistic`.",
        ),
        q(
          "Here's a page in a framework that supports Server Components:\n\n```jsx\n// Page.jsx (a Server Component)\nimport LikeButton from './LikeButton.jsx'; // starts with 'use client'\n\nexport default async function Page() {\n  const post = await db.posts.find(1);\n  return (\n    <article>\n      <h1>{post.title}</h1>\n      <LikeButton postId={post.id} />\n    </article>\n  );\n}\n```\n\nWhich component code does the browser download?",
          [
            'All of it: `Page`, the database code and `LikeButton`',
            "Only `LikeButton`'s code; `Page` arrives as its already-rendered result",
            'None: Server Components cannot render Client Components',
            "Only `Page`'s code; `LikeButton` becomes static HTML",
          ],
          1,
          'The server runs `Page` (database call and all) and sends its output. The only component code the browser needs is `LikeButton`, the interactive island. Props crossing from server to client, like `postId`, must be serializable: strings, numbers, plain objects and arrays, JSX, even promises (read them with `use`), but not ordinary functions.',
        ),
        q(
          'react.dev recommends starting a brand-new app with a **framework** such as Next.js or React Router. Why?',
          [
            'React cannot render anything without a framework',
            'Frameworks replace JSX with a simpler syntax',
            'Build tools like Vite can no longer build React apps',
            'They bring routing, data loading, code splitting and server rendering (plus Server Components) already wired together',
          ],
          3,
          'React itself is a library for building components. A real app also needs routing, data fetching, bundling and a rendering strategy, and frameworks solve those together. You can still start from a build tool like Vite (great for learning or a simple single-page app) and add a router yourself. For mobile apps, Expo plays the same role.',
        ),
        q(
          "In TypeScript, which is the right way to type a component's props?",
          [
            '`function Badge({ label, level }: { label: string; level: number }) { … }`',
            '`function Badge({ label: string, level: number }) { … }`',
            '`function Badge<label: string>(level: number) { … }`',
            '`function Badge({ label, level }) as Props { … }`',
          ],
          0,
          'Props arrive as one object, so you type that object: inline, or with a named type like `type BadgeProps = { label: string; level: number }`. Option B is a famous trap: inside destructuring, `label: string` means "rename `label` to a variable called `string`". Hooks can be typed too: `useState<string | null>(null)`.',
        ),
        q(
          'You are testing a counter with **React Testing Library**. Which test follows its philosophy best?',
          [
            "Read the component's internal state and check that it equals 1",
            'Take a snapshot and approve whatever it contains',
            'Render it, find the button by its role or text, click it like a user would, and check that "Count: 1" appears on screen',
            'Call `Counter()` directly and inspect the object it returns',
          ],
          2,
          '"The more your tests resemble the way your software is used, the more confidence they can give you." Test behaviour, not implementation details, exactly like the quest checks you have been passing all along! Typical tools: Vitest or Jest to run tests, React Testing Library to render and query components, Playwright for full browser tests.',
        ),
      ],
      concepts: [
        {
          id: 'spire-server-components',
          icon: '🖥️',
          title: 'Server Components',
          summary: 'Components that run only on the server; the browser gets their output, not their code.',
          snippet: code`
            // A Server Component (the default in frameworks like Next.js)
            export default async function Page() {
              const posts = await db.posts.findMany();
              return <PostList posts={posts} />;
            }
          `,
          detail: 'They can be async and read data directly, but have no state, effects or event handlers.',
        },
        {
          id: 'spire-directives',
          icon: '🧭',
          title: "'use client' & 'use server'",
          summary: "'use client' marks where client code begins; 'use server' marks Server Functions.",
          snippet: code`
            'use client'; // top of LikeButton.jsx: shipped to the browser

            async function savePost(formData) {
              'use server'; // runs on the server, callable from the client
              await db.posts.create({ title: formData.get('title') });
            }
          `,
          detail: 'Server Components need no directive at all; they are the default in frameworks that support them.',
        },
        {
          id: 'spire-ecosystem',
          icon: '🗺️',
          title: 'The React ecosystem',
          summary: 'Frameworks (Next.js, React Router), TypeScript, and testing with Vitest + React Testing Library.',
          detail: 'Start real apps with a framework or a build tool like Vite, type your props with TypeScript, and test behaviour the way a user would.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'spire-boss',
      type: 'build',
      boss: true,
      title: 'Boss: The Sorcerer of Suspense',
      bossName: 'The Sorcerer of Suspense',
      bossIcon: '🧙',
      blurb: 'Duel the master of waiting with every art of the Spire at once.',
      xp: 300,
      routes: {
        '/api/taunt': { text: TAUNT },
      },
      fetchDelay: 1000,
      badge: {
        id: 'badge-spire',
        name: 'Archmage of the Spire',
        icon: '🔮',
        description: 'Defeated the Sorcerer of Suspense at the top of the Arcane Spire.',
      },
      story: [
        { text: "The top of the Spire. There he floats: the Sorcerer of Suspense! He feeds on waiting. Every spell you cast hangs in the air for a full second while he cackles.", mood: 'worried' },
        { text: "Steal his power: read his taunt through Suspense, duel him in a portal, make every hit land instantly with optimistic UI... and keep a ward up. He'll trick you into casting the forbidden spell \"Mutate\"!", mood: 'excited' },
        { text: 'Every art of this tower, all at once. Take it one step at a time and check the quest often. You can do this!', mood: 'happy' },
      ],
      lesson: md`
        ## Every art of the Spire

        | Art | Spell |
        |---|---|
        | Wards | a class with \`static getDerivedStateFromError\` |
        | Portals | \`createPortal(jsx, document.body)\` |
        | Suspense | \`<Suspense fallback={…}>\` + \`use(promise)\` |
        | Actions | \`useActionState(action, initialState)\` → \`[state, formAction, isPending]\` |
        | Foresight | \`useOptimistic(state, updateFn)\` |

        ## Errors inside Actions

        What if an Action **throws**? React treats it like a rendering error: the nearest
        **error boundary** shows its fallback (and \`useActionState\` drops any queued
        submissions). That's the big exception to "boundaries don't catch async errors": React
        is tracking the Action, so even an error thrown a full second after the click, after an
        \`await\`, reaches your ward. The same goes for a rejected promise read with \`use\`.

        \`\`\`jsx
        async function castSpell(prevState, formData) {
          const damage = await spellLands(formData.get('spell')); // may throw!
          return { ...prevState, hp: prevState.hp - damage };
        }
        \`\`\`

        ## Optimism works on any value

        \`useOptimistic\` isn't just for lists. It can hold a **number**:

        \`\`\`jsx
        const [optimisticHp, strike] = useOptimistic(state.hp, (hp, damage) => hp - damage);
        \`\`\`

        Call \`strike(25)\` inside the action and the health bar drops instantly; when the action
        finishes, the real \`state.hp\` takes over.

        ## Boundaries see the React tree

        A ward is an ancestor in the **React** tree, so it catches errors from the duel even
        though the duel's DOM is portaled into \`document.body\`, just like events bubble
        out of portals.

        :::tip
        Build in order and check often: Suspense first, then the ward, the portal, the action,
        the pending button and finally the optimistic HP. The objectives show which parts already work.
        :::
      `,
      task: md`
        ## 👑 Defeat the Sorcerer of Suspense

        Given: \`tauntPromise\`, \`spellLands(spell)\` (waits **1 s**, returns **25** damage, and
        **throws** for the spell **Mutate**), the \`Arena\` box and the duel's markup.

        1. **Suspense**: in \`Taunt\`, read \`tauntPromise\` with \`use()\` and render
           \`<p className="taunt">{taunt.text}</p>\`. In \`App\`, wrap \`<Taunt />\` in \`<Suspense>\`
           with the fallback \`<p className="loading">The Sorcerer keeps you in suspense…</p>\`.
        2. **Ward**: finish the \`Ward\` error boundary. After a child throws, it renders
           \`<p className="ward-fallback">🛡️ The ward held!</p>\`.
        3. **Portal**: when \`dueling\` is true, render
           \`<Arena onRetreat={() => setDueling(false)}><Ward><Duel /></Ward></Arena>\`
           into \`document.body\` with \`createPortal\`.
        4. **Action**: \`Duel\` already calls \`useActionState(castSpell, { hp: 100, log: [] })\`.
           Implement \`castSpell(prevState, formData)\`: read the \`spell\` field, \`await spellLands(spell)\`
           to get the damage, and return \`{ hp: prevState.hp - damage, log: [...prevState.log, spell] }\`.
        5. **Pending**: while a spell is in the air, the submit button is \`disabled\` and reads
           **Casting…** (otherwise **Cast**).
        6. **Foresight**: \`.sorcerer-hp\` shows the HP from \`useOptimistic(state.hp, …)\`. Inside
           \`castSpell\`, strike for **25** *before* the \`await\`, so the HP reads
           **Sorcerer HP: 75** the instant you cast.
        7. **The log and the finale**: render each spell in \`state.log\` as an \`<li>\` inside
           \`.spell-log\`. When \`state.hp\` reaches **0**, show
           \`<p className="triumph">The Sorcerer of Suspense is defeated!</p>\` instead of the form.
      `,
      starter: code`
        import { Component, Suspense, use, useActionState, useOptimistic, useState } from 'react';
        import { createPortal } from 'react-dom';

        // ---------- The Sorcerer's tricks (don't change these) ----------
        const tauntPromise = fetch('/api/taunt').then((res) => res.json());

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // Every spell hangs in the air for 1 second, then deals 25 damage.
        // "Mutate" is the Mutator's forbidden spell: it blows up with an error.
        async function spellLands(spell) {
          await wait(1000);
          if (spell.trim().toLowerCase() === 'mutate') {
            throw new Error('Forbidden spell! Mutation backfires!');
          }
          return 25;
        }

        // Once it's portaled, the arena floats over the whole page,
        // so it brings its own inline styles.
        const arenaStyle = {
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
          width: 300,
          padding: 16,
          borderRadius: 16,
          background: '#1e1b4b',
          color: '#f5f3ff',
          border: '2px solid #a855f7',
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.55)',
          fontFamily: 'system-ui, sans-serif',
        };

        function Arena({ onRetreat, children }) {
          return (
            <div className="arena" style={arenaStyle}>
              <button onClick={onRetreat}>✖ Retreat</button>
              {children}
            </div>
          );
        }
        // -----------------------------------------------------------------

        function Taunt() {
          // TODO 1: const taunt = use(tauntPromise); and show taunt.text
          return <p className="taunt">…</p>;
        }

        // TODO 2: make Ward an error boundary that shows
        // <p className="ward-fallback">🛡️ The ward held!</p> after a crash
        class Ward extends Component {
          render() {
            return this.props.children;
          }
        }

        function Duel() {
          const [state, formAction, isPending] = useActionState(castSpell, { hp: 100, log: [] });
          // TODO 6: const [optimisticHp, strike] = useOptimistic(state.hp, ...);

          async function castSpell(prevState, formData) {
            // TODO 4: read the spell, (TODO 6: strike for 25), await spellLands(spell),
            //         then return the new state
            return prevState;
          }

          return (
            <div className="duel">
              <h2>⚔️ The Duel</h2>
              <p className="sorcerer-hp">Sorcerer HP: {state.hp}</p>
              <ul className="spell-log">{/* TODO 7: one <li> per spell in state.log */}</ul>
              {/* TODO 7: when state.hp is 0, show the .triumph paragraph instead of the form */}
              <form action={formAction}>
                <input name="spell" placeholder="Fireball, Frostbolt…" />
                {/* TODO 5: disabled + "Casting…" while isPending */}
                <button type="submit">Cast</button>
              </form>
            </div>
          );
        }

        export default function App() {
          const [dueling, setDueling] = useState(false);

          return (
            <div className="spire">
              <h1>The Sorcerer of Suspense</h1>
              {/* TODO 1: wrap <Taunt /> in <Suspense> with the .loading fallback */}
              <Taunt />
              <button onClick={() => setDueling(true)}>⚔️ Challenge</button>
              {/* TODO 3: when dueling, portal this into document.body:
                  <Arena onRetreat={() => setDueling(false)}>
                    <Ward><Duel /></Ward>
                  </Arena> */}
            </div>
          );
        }
      `,
      solution: code`
        import { Component, Suspense, use, useActionState, useOptimistic, useState } from 'react';
        import { createPortal } from 'react-dom';

        // ---------- The Sorcerer's tricks (don't change these) ----------
        const tauntPromise = fetch('/api/taunt').then((res) => res.json());

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // Every spell hangs in the air for 1 second, then deals 25 damage.
        // "Mutate" is the Mutator's forbidden spell: it blows up with an error.
        async function spellLands(spell) {
          await wait(1000);
          if (spell.trim().toLowerCase() === 'mutate') {
            throw new Error('Forbidden spell! Mutation backfires!');
          }
          return 25;
        }

        // Once it's portaled, the arena floats over the whole page,
        // so it brings its own inline styles.
        const arenaStyle = {
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
          width: 300,
          padding: 16,
          borderRadius: 16,
          background: '#1e1b4b',
          color: '#f5f3ff',
          border: '2px solid #a855f7',
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.55)',
          fontFamily: 'system-ui, sans-serif',
        };

        function Arena({ onRetreat, children }) {
          return (
            <div className="arena" style={arenaStyle}>
              <button onClick={onRetreat}>✖ Retreat</button>
              {children}
            </div>
          );
        }
        // -----------------------------------------------------------------

        function Taunt() {
          const taunt = use(tauntPromise);
          return <p className="taunt">{taunt.text}</p>;
        }

        class Ward extends Component {
          state = { hasError: false };

          static getDerivedStateFromError() {
            return { hasError: true };
          }

          render() {
            if (this.state.hasError) {
              return <p className="ward-fallback">🛡️ The ward held!</p>;
            }
            return this.props.children;
          }
        }

        function Duel() {
          const [state, formAction, isPending] = useActionState(castSpell, { hp: 100, log: [] });
          const [optimisticHp, strike] = useOptimistic(state.hp, (hp, damage) => hp - damage);

          async function castSpell(prevState, formData) {
            const spell = formData.get('spell');
            strike(25); // the HP drops right now...
            const damage = await spellLands(spell); // ...the real hit lands a second later
            return { hp: prevState.hp - damage, log: [...prevState.log, spell] };
          }

          return (
            <div className="duel">
              <h2>⚔️ The Duel</h2>
              <p className="sorcerer-hp">Sorcerer HP: {optimisticHp}</p>
              <ul className="spell-log">
                {state.log.map((spell, i) => (
                  <li key={i}>{spell}</li>
                ))}
              </ul>
              {state.hp === 0 ? (
                <p className="triumph">The Sorcerer of Suspense is defeated!</p>
              ) : (
                <form action={formAction}>
                  <input name="spell" placeholder="Fireball, Frostbolt…" />
                  <button type="submit" disabled={isPending}>
                    {isPending ? 'Casting…' : 'Cast'}
                  </button>
                </form>
              )}
            </div>
          );
        }

        export default function App() {
          const [dueling, setDueling] = useState(false);

          return (
            <div className="spire">
              <h1>The Sorcerer of Suspense</h1>
              <Suspense fallback={<p className="loading">The Sorcerer keeps you in suspense…</p>}>
                <Taunt />
              </Suspense>
              <button onClick={() => setDueling(true)}>⚔️ Challenge</button>
              {dueling &&
                createPortal(
                  <Arena onRetreat={() => setDueling(false)}>
                    <Ward>
                      <Duel />
                    </Ward>
                  </Arena>,
                  document.body,
                )}
            </div>
          );
        }
      `,
      hints: [
        md`Suspense first: \`const taunt = use(tauntPromise);\` in \`Taunt\`, and \`<Suspense fallback={<p className="loading">The Sorcerer keeps you in suspense…</p>}><Taunt /></Suspense>\` in \`App\`. The \`Ward\` is the same class you built on the first floor.`,
        md`The portal: \`{dueling && createPortal(<Arena onRetreat={() => setDueling(false)}><Ward><Duel /></Ward></Arena>, document.body)}\`. On the button: \`disabled={isPending}\` and \`{isPending ? 'Casting…' : 'Cast'}\`.`,
        md`In \`Duel\`: \`const [optimisticHp, strike] = useOptimistic(state.hp, (hp, damage) => hp - damage);\`. In \`castSpell\`: \`const spell = formData.get('spell'); strike(25); const damage = await spellLands(spell); return { hp: prevState.hp - damage, log: [...prevState.log, spell] };\`. Show \`{optimisticHp}\` in \`.sorcerer-hp\`.`,
      ],
      tests: [
        test("The Sorcerer's taunt arrives through Suspense", async (t) => {
          await t.renderAsync();
          t.expect(
            t.$('h1'),
            'Nothing is on screen while the taunt loads: the whole tower suspended. Wrap <Taunt /> in <Suspense fallback={…}> so the rest of the page stays visible.',
          );
          const loading = t.$('.loading');
          t.expect(
            loading && isShown(loading) && /keeps you in suspense/i.test(loading.textContent),
            'While the taunt is on its way, show <p className="loading">The Sorcerer keeps you in suspense…</p>: read the taunt with use(tauntPromise) in Taunt, and wrap <Taunt /> in <Suspense> with that fallback.',
          );
          await t.tick(1000);
          await t.flush();
          const taunt = t.$('.taunt');
          t.expect(
            taunt && isShown(taunt) && squish(taunt.textContent) === TAUNT,
            `Once it arrives, <p className="taunt"> should show the taunt ("${TAUNT}"). In Taunt: const taunt = use(tauntPromise); then render {taunt.text}.`,
          );
          t.expect(!t.$$('.loading').some(isShown), 'The fallback should disappear once the taunt has arrived.');
        }),
        test('⚔️ Challenge opens the duel in a portal on document.body', async (t) => {
          const body = bodyScope();
          const duel = await openDuel(t, body);
          t.expect(
            !t.container.contains(duel),
            "The duel is still inside the tower's own DOM. Render it with createPortal(<Arena …>…</Arena>, document.body).",
          );
          const hp = duel.querySelector('.sorcerer-hp');
          t.expect(hp && squish(hp.textContent) === 'Sorcerer HP: 100', `The duel should start with "Sorcerer HP: 100" (found "${squish(hp?.textContent) || 'nothing'}").`);
          t.expect(duel.querySelector('form input[name="spell"]') && duel.querySelector('form button'), 'Keep the <form> with the "spell" input and the Cast button inside the duel.');
        }),
        test('Casting drops his HP to 75 instantly, and the button reads "Casting…"', settled(async (t) => {
          const body = bodyScope();
          await openDuel(t, body);
          await castSpell(t, body, 'Fireball');
          const hp = squish(body.one('.sorcerer-hp')?.textContent);
          t.expect(
            hp === 'Sorcerer HP: 75',
            `Right after casting, the HP reads "${hp}" — expected "Sorcerer HP: 75" before the spell even lands. Show the HP from useOptimistic(state.hp, (hp, damage) => hp - damage) and call it with 25 inside castSpell, before the await.`,
          );
          const button = body.one('.duel form button');
          t.expect(
            button && button.disabled && /casting/i.test(button.textContent),
            `While the spell is in the air the button reads "${squish(button?.textContent)}"${button?.disabled ? '' : ' and can still be clicked'} — expected a disabled "Casting…" button. Use isPending from useActionState.`,
          );
        })),
        test('Spells land after a second: the log grows and four hits defeat him', settled(async (t) => {
          const body = bodyScope();
          await openDuel(t, body);
          await landSpell(t, body, 'Fireball');
          const hp = squish(body.one('.sorcerer-hp')?.textContent);
          t.expect(
            hp === 'Sorcerer HP: 75',
            `After the first spell lands, the HP reads "${hp}" — expected "Sorcerer HP: 75". castSpell should return { hp: prevState.hp - damage, log: [...prevState.log, spell] }.`,
          );
          const log = body.all('.spell-log li').map((li) => squish(li.textContent));
          t.expect(log.join(',') === 'Fireball', `The .spell-log shows [${log.join(', ')}] — expected one <li> per landed spell: [Fireball].`);
          const button = body.one('.duel form button');
          t.expect(button && !button.disabled && /^cast$/i.test(squish(button.textContent)), 'After the spell lands, the button should read "Cast" and be enabled again.');
          for (const spell of ['Frostbolt', 'Lightning', 'Starfall']) await landSpell(t, body, spell);
          const triumph = body.one('.triumph');
          t.expect(
            triumph && squish(triumph.textContent) === 'The Sorcerer of Suspense is defeated!',
            `After four spells his HP reads "${squish(body.one('.sorcerer-hp')?.textContent)}". When state.hp reaches 0, show <p className="triumph">The Sorcerer of Suspense is defeated!</p>.`,
          );
          t.expect(!body.one('.duel form'), 'Once he is defeated, show the .triumph paragraph instead of the form.');
        })),
        test('A ward contains the forbidden spell "Mutate"', settled(async (t) => {
          const body = bodyScope();
          await openDuel(t, body);
          await castSpell(t, body, 'Mutate');
          try {
            await t.tick(1000);
            await t.flush();
          } catch (err) {
            t.fail(
              `Casting Mutate crashed the whole tower (${err.message.replace(/^Your component crashed: /, '')}). Wrap <Duel /> in your <Ward> inside the portal, and make Ward an error boundary with static getDerivedStateFromError.`,
            );
          }
          const fallback = body.one('.ward-fallback');
          t.expect(
            fallback && fallback.textContent.includes('The ward held!'),
            "No ward fallback appeared after casting Mutate. Let spellLands' error escape castSpell (don't catch it), and have Ward render <p className=\"ward-fallback\">🛡️ The ward held!</p> once hasError is true.",
          );
          t.expect(t.$('h1'), 'The tower itself should still stand: only the duel is replaced by the ward.');
        })),
      ],
      css: code`
        .spire { padding: 16px; border-radius: 16px; text-align: center; color: #faf5ff; background: radial-gradient(circle at 50% 15%, #7e22ce, #2e1065 60%, #0f0a1f); }
        .spire h1 { margin-top: 0; }
        .taunt { color: #f0abfc; font-style: italic; }
        .loading { color: #c4b5fd; font-style: italic; }
      `,
      concepts: [
        {
          id: 'spire-action-errors',
          icon: '⚡',
          title: 'Errors in Actions',
          summary: 'When an Action throws, even after an await, the nearest error boundary shows its fallback.',
          snippet: code`
            <Ward>
              <form action={async () => {
                await save(); // if this throws, <Ward> shows its fallback
              }} />
            </Ward>
          `,
          detail: 'React tracks Actions (and promises read with use), so their errors reach boundaries, unlike errors in plain event handlers or timers.',
        },
      ],
    },
  ],
};
