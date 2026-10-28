import { code, md, q, test } from '../helpers.js';

/* -------------------------------------------------------------------------- */
/* Check helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Collapse whitespace so checks don't care about JSX line breaks. */
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Advance fake time in small steps. React re-renders (and runs effects)
 * between steps, so timers started by those effects begin at the right time.
 */
async function wait(t, ms, step = 50) {
  for (let done = 0; done < ms; done += step) await t.tick(Math.min(step, ms - done));
}

/** Tick until at least `count` fetch calls were made (or `max` ms passed). */
async function waitForFetch(t, count, max = 1500) {
  for (let waited = 0; t.fetchCalls.length < count && waited < max; waited += 50) await t.tick(50);
}

const urls = (t) => t.fetchCalls.map((c) => c.url).join(', ') || 'none';

/**
 * Tracks `type` listeners added to window/document (and not removed) while
 * active. Only use it in synchronous checks, and always call restore().
 */
function spyOnListeners(type) {
  const active = new Set();
  const restores = [window, document].map((target) => {
    const ownAdd = Object.prototype.hasOwnProperty.call(target, 'addEventListener');
    const ownRemove = Object.prototype.hasOwnProperty.call(target, 'removeEventListener');
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    target.addEventListener = function (kind, fn, options) {
      if (kind === type) active.add(fn);
      return add.call(this, kind, fn, options);
    };
    target.removeEventListener = function (kind, fn, options) {
      if (kind === type) active.delete(fn);
      return remove.call(this, kind, fn, options);
    };
    return () => {
      if (ownAdd) target.addEventListener = add;
      else delete target.addEventListener;
      if (ownRemove) target.removeEventListener = remove;
      else delete target.removeEventListener;
    };
  });
  return { count: () => active.size, restore: () => restores.forEach((r) => r()) };
}

/** Reads a query-string parameter from a fake-fetch URL. */
const param = (url, name) => new URL(url, 'http://reactoria.local').searchParams.get(name) || '';

/* -------------------------------------------------------------------------- */
/* Fake API data                                                              */
/* -------------------------------------------------------------------------- */

const VOLCANOES = {
  ember: { name: 'Ember Peak', temperature: 1150, mood: 'Grumbling' },
  cinder: { name: 'Cinder Cone', temperature: 980, mood: 'Sleepy' },
  obsidian: { name: 'Obsidian Spire', temperature: 1300, mood: 'Furious' },
};

const GEYSERS = {
  north: { site: 'North Vent', temp: 96, pressure: 'rising' },
  south: { site: 'South Vent', temp: 71, pressure: 'steady' },
};

const SPELLS = [
  { id: 1, name: 'Fireball', school: 'fire' },
  { id: 2, name: 'Fire Wall', school: 'fire' },
  { id: 3, name: 'Ice Lance', school: 'frost' },
  { id: 4, name: 'Frost Nova', school: 'frost' },
  { id: 5, name: 'Lava Burst', school: 'fire' },
  { id: 6, name: 'Stone Skin', school: 'earth' },
  { id: 7, name: 'Tremor', school: 'earth' },
  { id: 8, name: 'Ember Shield', school: 'fire' },
];

export default {
  id: 'effect-volcano',
  file: '07-effect-volcano.js',
  title: 'Effect Volcano',
  short: 'Effects',
  subtitle: 'Side effects, useEffect, cleanup, data fetching, and knowing when NOT to use an effect.',
  icon: '🌋',
  colors: ['#450a0a', '#f97316'],
  scenery: ['🌋', '🔥', '🪨', '💨', '☄️', '🌡️', '⏳', '🐍'],
  intro: [
    {
      text: 'Feel that heat? Welcome to Effect Volcano, the edge of React\'s world. Out here calm renders meet the wild outside: timers, the network, the browser itself.',
      mood: 'excited',
    },
    {
      text: 'Rendering must stay pure... but apps still need to DO things. Effects are how a component keeps something outside React in sync with its state.',
      mood: 'thinking',
    },
    {
      text: 'Careful, though. The Infinite Looper lurks in the crater, turning careless effects into endless eruptions. Always clean up after yourself!',
      mood: 'worried',
    },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'volcano-signal-flare',
      type: 'code',
      title: 'The Signal Flare',
      blurb: 'Move a side effect out of render and into your first useEffect.',
      xp: 110,
      story: [
        {
          text: 'Lookout Ash shows the day\'s eruption count in the browser tab, so the villages can see it from afar. That tab title is outside React: a perfect job for an effect!',
          mood: 'happy',
        },
        {
          text: 'But the Mutator lit the flare DURING RENDER. Now every render re-lights it, even when you just type a name. Watch the console go wild.',
          mood: 'worried',
        },
      ],
      lesson: md`
        ## Rendering must stay pure

        In the Component Forge you learned the golden rule: rendering is a **pure
        calculation**. Same props and state in, same JSX out, and nothing outside the
        component gets touched.

        But real apps must also *do* things: change the browser tab's title, start a timer,
        talk to a server. These are **side effects**, because they reach outside React.
        They have two proper homes:

        1. **Event handlers**, when a specific user action causes them: "when Erupt is clicked, add one".
        2. **Effects**, when *being on screen* causes them: "while this component is displayed, the tab title must match the count".

        ## useEffect

        \`\`\`jsx
        import { useState, useEffect } from 'react';

        function Clicker() {
          const [count, setCount] = useState(0);

          useEffect(() => {
            document.title = \`Clicked \${count} times\`;
          }, [count]);

          return <button onClick={() => setCount(count + 1)}>Click me</button>;
        }
        \`\`\`

        \`useEffect(setup, dependencies)\` takes two arguments:

        - **setup**: a function holding your side-effect code. React runs it **after** the render has been committed to the screen.
        - **dependencies**: an array of every value from the component that setup reads. React compares them with their values from the previous render (using \`Object.is\`) and skips the effect when none of them changed.

        ## Think "synchronise", not "do something"

        Don't read an effect as "when X happens, do Y". Read it as a promise: **"keep this
        outside thing in sync with my state"**. The tab title lives outside React, and the
        effect keeps it matching \`count\`. When \`count\` changes, React re-syncs. When
        nothing relevant changed, there is nothing to do.

        | You write | setup runs |
        |---|---|
        | \`useEffect(fn)\` | after **every** render |
        | \`useEffect(fn, [])\` | once, after the **first** render |
        | \`useEffect(fn, [a, b])\` | after the first render, then whenever \`a\` or \`b\` changed |

        :::mistake
        Writing \`document.title = ...\` straight in the component body. That code runs
        *during* render: on every render, related or not, and even for renders React decides
        to throw away. Side effects never belong in the render body.
        :::

        :::tip
        List **every** prop, state variable, or value calculated from them that your effect
        reads. In real projects the React linter (\`eslint-plugin-react-hooks\`) checks this
        for you.
        :::
      `,
      task: md`
        ## 🎯 Light the flare properly

        The Mutator lit the flare *during render*. Move it into an effect:

        1. Import \`useEffect\` from \`'react'\`.
        2. Move both flare lines (\`console.log('🔥 flare synced')\` and the \`document.title = ...\` line) into a \`useEffect\`.
        3. Give the effect a dependency array so it re-syncs **only when \`eruptions\` changes**. Typing a watcher's name must not re-light the flare.

        The tab title reads **Eruptions: 0** at first and **Eruptions: 2** after two clicks.
        Keep the \`console.log\` line exactly as it is: the checks count how often the flare syncs.
      `,
      starter: code`
        import { useState } from 'react';

        export default function App() {
          const [eruptions, setEruptions] = useState(0);
          const [watcher, setWatcher] = useState('');

          // 😈 The Mutator lit the flare DURING RENDER. Every render re-lights it!
          console.log('🔥 flare synced');
          document.title = \`Eruptions: \${eruptions}\`;

          return (
            <div className="observatory">
              <h2>🌋 Ember Peak Observatory</h2>
              <p className="count">Eruptions today: {eruptions}</p>
              <button onClick={() => setEruptions(eruptions + 1)}>Erupt!</button>
              <label>
                Watcher on duty{' '}
                <input value={watcher} onChange={(e) => setWatcher(e.target.value)} />
              </label>
              <p className="watcher">{watcher ? \`\${watcher} is watching the crater.\` : 'Nobody is on duty.'}</p>
              <p className="hint">👀 Peek at your browser tab's title!</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [eruptions, setEruptions] = useState(0);
          const [watcher, setWatcher] = useState('');

          useEffect(() => {
            console.log('🔥 flare synced');
            document.title = \`Eruptions: \${eruptions}\`;
          }, [eruptions]);

          return (
            <div className="observatory">
              <h2>🌋 Ember Peak Observatory</h2>
              <p className="count">Eruptions today: {eruptions}</p>
              <button onClick={() => setEruptions(eruptions + 1)}>Erupt!</button>
              <label>
                Watcher on duty{' '}
                <input value={watcher} onChange={(e) => setWatcher(e.target.value)} />
              </label>
              <p className="watcher">{watcher ? \`\${watcher} is watching the crater.\` : 'Nobody is on duty.'}</p>
              <p className="hint">👀 Peek at your browser tab's title!</p>
            </div>
          );
        }
      `,
      hints: [
        md`Change the import to \`import { useState, useEffect } from 'react';\`, then wrap the two flare lines in \`useEffect(() => { ... });\`.`,
        md`The effect reads \`eruptions\`, so that's its dependency. Without an array it would still run after every render.`,
        md`
          The whole effect:

          \`\`\`jsx
          useEffect(() => {
            console.log('🔥 flare synced');
            document.title = \`Eruptions: \${eruptions}\`;
          }, [eruptions]);
          \`\`\`
        `,
      ],
      tests: [
        test('The tab title reads "Eruptions: N"', (t) => {
          t.render();
          t.expect(
            document.title === 'Eruptions: 0',
            `After the first render the tab title is "${document.title}" — expected "Eruptions: 0".`,
          );
          t.click(t.button('Erupt'));
          t.click(t.button('Erupt'));
          t.expect(
            document.title === 'Eruptions: 2',
            `After two eruptions the tab title is "${document.title}" — expected "Eruptions: 2". Does the effect list eruptions as a dependency?`,
          );
        }),
        test('The flare is lit inside useEffect', (t) => {
          t.sourceIncludes(/useEffect\s*\(/, 'Call useEffect(() => { ... }, [...]) and move the two flare lines inside it.');
          t.render();
          const synced = t.logLines().filter((l) => l.includes('flare synced')).length;
          t.expect(
            synced === 1,
            `The flare synced ${synced} time(s) on mount — expected exactly 1. Keep console.log('🔥 flare synced') inside the effect (and only there).`,
          );
        }),
        test('The flare only re-syncs when the eruption count changes', (t) => {
          t.render();
          const synced = () => t.logLines().filter((l) => l.includes('flare synced')).length;
          const input = t.find('input');
          t.type(input, 'A');
          t.type(input, 'As');
          t.type(input, 'Ash');
          t.expect(
            synced() === 1,
            `Typing a watcher's name re-lit the flare: it synced ${synced()} times instead of once. Give the effect the dependency array [eruptions].`,
          );
          t.click(t.button('Erupt'));
          t.expect(
            synced() === 2,
            `After one eruption the flare synced ${synced()} time(s) in total — expected 2 (mount + one change).`,
          );
        }),
      ],
      concepts: [
        {
          id: 'volcano-side-effects',
          icon: '🧪',
          title: 'Side effects',
          summary: 'Anything that reaches outside the render calculation: the DOM, timers, network, storage.',
          detail: 'Render must stay pure. Side effects caused by a user action go in event handlers; side effects caused by being on screen go in effects.',
        },
        {
          id: 'volcano-use-effect',
          icon: '🌋',
          title: 'useEffect',
          summary: 'Runs code after commit to sync a component with something outside React.',
          snippet: code`
            useEffect(() => {
              document.title = \`Count: \${count}\`;
            }, [count]);
          `,
        },
        {
          id: 'volcano-deps',
          icon: '📋',
          title: 'Dependency array',
          summary: 'No array: every render. []: first render only. [a, b]: when a or b changed.',
          detail: 'Dependencies are compared with Object.is. List every reactive value the effect reads.',
        },
      ],
      css: `
        .observatory { max-width: 460px; padding: 16px 18px; border-radius: 14px; background: linear-gradient(#1f2937, #111827); color: #f9fafb; }
        .observatory h2 { color: #fdba74; }
        .observatory label { display: block; margin: 8px 0; }
        .count { font-size: 1.4em; font-weight: 800; color: #f97316; }
        .watcher { color: #d1d5db; }
        .hint { font-size: 0.85em; color: #fca5a5; }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'volcano-lava-clock',
      type: 'code',
      title: 'The Lava Clock',
      blurb: 'Intervals and window listeners need cleanup. Learn why StrictMode runs effects twice.',
      xp: 140,
      story: [
        {
          text: 'Old Magma the clockkeeper is in a panic. Her lava clock can\'t pause, and when she put it away it kept ticking somewhere in the dark!',
          mood: 'worried',
        },
        {
          text: 'Every effect that STARTS something must also STOP it. That\'s what cleanup functions are for. Let\'s fix the clock, then teach it a keyboard shortcut.',
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## Effects that start things must stop them

        Some effects *start* something that keeps going: an interval, an event listener, a
        connection. If the component disappears (or the effect runs again) and nobody stops
        it, it keeps running in the background. That's a **leak**.

        So an effect can **return a cleanup function**:

        \`\`\`jsx
        useEffect(() => {
          const id = setInterval(() => {
            setSeconds((s) => s + 1);
          }, 1000);

          return () => clearInterval(id); // cleanup
        }, []);
        \`\`\`

        React calls the cleanup:

        1. **before running the effect again** (because a dependency changed), with the old values,
        2. **when the component is removed** from the screen (unmount).

        Think in pairs: **setup ↔ cleanup**. \`setInterval\` ↔ \`clearInterval\`.
        \`addEventListener\` ↔ \`removeEventListener\`. Connect ↔ disconnect.

        ## Listening to the whole window

        \`onClick\` and friends only work on elements you render. To hear events from the
        whole page, subscribe in an effect:

        \`\`\`jsx
        useEffect(() => {
          function handleKeyDown(e) {
            if (e.key === 'Escape') setOpen(false);
          }
          window.addEventListener('keydown', handleKeyDown);
          return () => window.removeEventListener('keydown', handleKeyDown);
        }, []);
        \`\`\`

        You must remove the **same function** you added, which is why the handler is a named
        function inside the effect.

        ## Dependencies that switch an effect on and off

        \`\`\`jsx
        useEffect(() => {
          if (!running) return;            // paused: nothing to set up
          const id = setInterval(tick, 1000);
          return () => clearInterval(id);
        }, [running]);
        \`\`\`

        When \`running\` flips, React cleans up the old interval, then runs setup again with
        the new value.

        ## Why does my effect run twice?

        In development, apps are usually wrapped in \`<StrictMode>\`. When a component mounts,
        React deliberately runs your effects **setup → cleanup → setup**. With a correct
        cleanup you can't tell the difference. With a missing one you suddenly get two
        intervals or two listeners, and you spot the bug now instead of in production. This
        only happens in development.

        :::mistake
        \`setSeconds(seconds + 1)\` inside an interval that was created once. The callback
        captured \`seconds\` from the render that created it (0), so it sets 1 forever. Use
        the updater form \`setSeconds((s) => s + 1)\` from the State Springs.
        :::
      `,
      task: md`
        ## 🎯 Tame the lava clock

        1. **Cleanup:** keep the interval's id and return a cleanup that calls \`clearInterval\`.
        2. **Pause / Resume:** the interval only runs while \`running\` is \`true\`. Skip the setup when paused and add \`running\` to the dependency array.
        3. **Shortcut:** add a second effect that listens for \`keydown\` on \`window\`. Pressing **Escape** toggles the clock with \`setRunning((r) => !r)\`. Remove the listener in the cleanup.
        4. **StrictMode-proof:** with setup → cleanup → setup there must still be **one** interval and **one** listener.

        The \`<p className="clock">\` shows \`{seconds}s\`, and the button reads **Pause** while running and **Resume** while paused (already written).
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [seconds, setSeconds] = useState(0);
          const [running, setRunning] = useState(true);

          useEffect(() => {
            // 🐍 This interval never stops: not on pause, not on unmount!
            setInterval(() => {
              setSeconds((s) => s + 1);
            }, 1000);
          }, []);

          // TODO: a second effect: Escape (on window) toggles running

          return (
            <div className="lava-clock">
              <h2>⏳ The Lava Clock</h2>
              <p className="clock">{seconds}s</p>
              <button onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Resume'}</button>
              <p className="tip">Tip: press Escape anywhere to pause or resume.</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [seconds, setSeconds] = useState(0);
          const [running, setRunning] = useState(true);

          useEffect(() => {
            if (!running) return;
            const id = setInterval(() => {
              setSeconds((s) => s + 1);
            }, 1000);
            return () => clearInterval(id);
          }, [running]);

          useEffect(() => {
            function handleKeyDown(e) {
              if (e.key === 'Escape') setRunning((r) => !r);
            }
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
          }, []);

          return (
            <div className="lava-clock">
              <h2>⏳ The Lava Clock</h2>
              <p className="clock">{seconds}s</p>
              <button onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Resume'}</button>
              <p className="tip">Tip: press Escape anywhere to pause or resume.</p>
            </div>
          );
        }
      `,
      hints: [
        md`Keep the id: \`const id = setInterval(...)\`, and end the effect with \`return () => clearInterval(id);\`.`,
        md`Start the interval effect with \`if (!running) return;\` and change its array to \`[running]\`. When \`running\` flips, React runs the old cleanup and then the setup again.`,
        md`Second effect: \`function handleKeyDown(e) { if (e.key === 'Escape') setRunning((r) => !r); }\`, then \`window.addEventListener('keydown', handleKeyDown);\` and \`return () => window.removeEventListener('keydown', handleKeyDown);\` with \`[]\`.`,
      ],
      tests: [
        test('The clock counts up once per second', async (t) => {
          t.render();
          await wait(t, 3000);
          const clock = clean(t.find('.clock').textContent);
          t.expect(
            clock === '3s',
            `After 3 seconds the clock shows "${clock}" — expected "3s". Tick with setInterval(..., 1000) and the updater form setSeconds((s) => s + 1).`,
          );
        }),
        test('Pause stops the clock and Resume restarts it', async (t) => {
          t.render();
          await wait(t, 2000);
          t.click(t.button('Pause'));
          await wait(t, 3000);
          let clock = clean(t.find('.clock').textContent);
          t.expect(
            clock === '2s',
            `The clock kept running while paused: it shows "${clock}" instead of "2s". Skip the setup when running is false (if (!running) return;) and use [running] as the dependency array.`,
          );
          t.click(t.button('Resume'));
          await wait(t, 2000);
          clock = clean(t.find('.clock').textContent);
          t.expect(
            clock === '4s',
            `After resuming for 2 seconds the clock shows "${clock}" — expected "4s". If it runs too fast, an old interval was never cleared: return () => clearInterval(id).`,
          );
        }),
        test('Escape anywhere on the page pauses and resumes', async (t) => {
          t.render();
          await t.tick(1000);
          t.keyDown(document.body, 'Escape', { code: 'Escape', keyCode: 27 });
          await t.tick(2000);
          let clock = clean(t.find('.clock').textContent);
          t.expect(
            clock === '1s',
            `Pressing Escape should pause the clock, but it shows "${clock}" (expected "1s"). Add an effect with window.addEventListener('keydown', ...) that calls setRunning((r) => !r) when e.key === 'Escape'.`,
          );
          const label = clean(t.find('button').textContent);
          t.expect(label.includes('Resume'), `While paused the button should read "Resume" (it reads "${label}").`);
          t.keyDown(document.body, 'Escape', { code: 'Escape', keyCode: 27 });
          await t.tick(1000);
          clock = clean(t.find('.clock').textContent);
          t.expect(clock === '2s', `A second Escape should resume the clock: expected "2s" one second later, but it shows "${clock}".`);
        }),
        test('Unmounting cleans up the interval and the key listener', (t) => {
          const spy = spyOnListeners('keydown');
          try {
            t.render();
            t.unmount();
            const intervals = t.timers.pendingIntervals();
            t.expect(
              intervals === 0,
              `${intervals} interval(s) kept running after the clock was removed. Return a cleanup from the effect: return () => clearInterval(id);`,
            );
            const listeners = spy.count();
            t.expect(
              listeners === 0,
              `${listeners} keydown listener(s) were left on the window after the clock was removed. Return () => window.removeEventListener('keydown', handleKeyDown), with the SAME function you added.`,
            );
          } finally {
            spy.restore();
          }
        }),
        test('Survives StrictMode: one interval, one listener', async (t) => {
          t.render(t.h(t.React.StrictMode, null, t.h(t.App)));
          await t.tick(1000);
          let clock = clean(t.find('.clock').textContent);
          t.expect(
            clock === '1s',
            `Under StrictMode (setup → cleanup → setup) the clock shows "${clock}" after 1 second — expected "1s". Two intervals are running because the first one was never cleared.`,
          );
          t.keyDown(document.body, 'Escape', { code: 'Escape', keyCode: 27 });
          await t.tick(2000);
          clock = clean(t.find('.clock').textContent);
          t.expect(
            clock === '1s',
            `Under StrictMode one Escape press didn't pause the clock (it shows "${clock}"). Two listeners each toggled running, cancelling each other out. Remove the listener in the cleanup.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'volcano-cleanup',
          icon: '🧹',
          title: 'Effect cleanup',
          summary: 'Return a function that undoes the setup; React calls it before re-running and on unmount.',
          snippet: code`
            useEffect(() => {
              const id = setInterval(tick, 1000);
              return () => clearInterval(id);
            }, []);
          `,
          detail: 'Pairs: setInterval/clearInterval, addEventListener/removeEventListener, connect/disconnect.',
        },
        {
          id: 'volcano-strict-mode',
          icon: '🔁',
          title: 'StrictMode double-run',
          summary: 'In development React runs setup → cleanup → setup on mount to expose missing cleanups.',
          detail: 'It never happens in production. If the double run causes a visible bug, the fix is a correct cleanup, not avoiding StrictMode.',
        },
      ],
      css: `
        .lava-clock { max-width: 360px; margin: 0 auto; text-align: center; padding: 18px; border-radius: 18px;
          background: radial-gradient(circle at 50% 30%, #fb923c, #7f1d1d); color: white; }
        .lava-clock h2 { color: #fff7ed; }
        .clock { font-size: 3em; font-weight: 900; font-family: ui-monospace, monospace; text-shadow: 0 3px 0 #7f1d1d; margin: 8px 0; }
        .tip { font-size: 0.85em; opacity: 0.85; }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'volcano-oracle',
      type: 'code',
      title: 'The Oracle of Embers',
      blurb: 'Fetch data in an effect: loading, errors, and no stale answers.',
      xp: 150,
      routes: {
        '/api/volcano': (url) => {
          const name = param(url, 'name');
          if (name === 'mutator') return { status: 500, body: { error: 'The Mutator jammed the oracle' } };
          return VOLCANOES[name] || { status: 404, body: { error: `No volcano called "${name}"` } };
        },
      },
      story: [
        {
          text: 'Seer Cinder reads the mood of every volcano through her oracle, a server far beyond React\'s borders. Asking it is a side effect: we fetch!',
          mood: 'happy',
        },
        {
          text: 'But her oracle code answers once and never again. No loading message, no error handling, and slow answers can arrive for the wrong volcano. Let\'s fix all of it.',
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## Fetching is synchronising, too

        "This component shows the report for the selected volcano." The server is an
        external system, so fetching while the component is displayed is a job for an effect:

        \`\`\`jsx
        useEffect(() => {
          fetch(\`/api/volcano?name=\${volcano}\`)
            .then((res) => res.json())
            .then((data) => setReport(data));
        }, [volcano]); // fetch again whenever volcano changes
        \`\`\`

        ## Three states of a request

        A request is **loading**, **failed** or **done**. Keep state for each and render
        all three:

        \`\`\`jsx
        const [report, setReport] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        \`\`\`

        ## Promises and await in 60 seconds

        \`fetch(url)\` doesn't hand you the answer right away: it returns a **promise**, a
        value that arrives *later*. \`.then(fn)\` runs \`fn\` once that value arrives, as in
        the effect above. Inside an \`async function\` you can write the same thing more
        plainly: \`await\` pauses that function until the promise settles, then gives you its
        value. \`res.json()\` is a promise too (the body is still downloading), so it needs
        \`await\` as well. To handle failure, wrap the work in \`try\`: \`throw new Error('...')\`
        (or a failed promise you awaited) jumps straight to the nearest \`catch\`, and
        \`finally\` runs at the end whether it succeeded or failed:

        \`\`\`js
        async function load() {
          try {
            const res = await fetch(url); // wait for the response
            const data = await res.json(); // wait for the body
            setData(data);
          } catch (err) {
            setError(err.message); // something went wrong
          } finally {
            setLoading(false); // runs either way
          }
        }
        \`\`\`

        ## fetch doesn't fail on 404 or 500

        \`fetch\` only rejects when the network itself fails. A **500** from the server is
        still a "successful" response, so check \`res.ok\` yourself:

        \`\`\`js
        const res = await fetch(url);
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`); // e.g. "HTTP 500"
        const data = await res.json();
        \`\`\`

        ## async inside an effect

        The effect function itself can't be \`async\`: an async function always returns a
        promise (see above), but React expects either nothing or a cleanup function. Declare
        an async function **inside** the effect and call it.

        ## Race conditions and the ignore flag

        Pick Ember Peak, then quickly Obsidian Spire. Two requests are now in flight. If
        Ember's answer lands *after* you switched, it overwrites the screen with the wrong
        volcano! The fix: each run of the effect gets its own \`ignore\` flag, and the cleanup
        (which runs as soon as \`volcano\` changes) raises it:

        \`\`\`jsx
        useEffect(() => {
          let ignore = false;

          async function consult() {
            setLoading(true);
            setError(null);
            setReport(null);
            try {
              const res = await fetch(\`/api/volcano?name=\${volcano}\`);
              if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
              const data = await res.json();
              if (!ignore) setReport(data);
            } catch (err) {
              if (!ignore) setError(err.message);
            } finally {
              if (!ignore) setLoading(false);
            }
          }

          consult();
          return () => {
            ignore = true; // this run's answer is no longer wanted
          };
        }, [volcano]);
        \`\`\`

        Stale answers still arrive, but they're simply ignored.

        :::pro
        Real apps usually let a framework or a library (like TanStack Query) fetch and cache
        data. Those tools add caching and avoid request waterfalls, and they can hand React 19's
        \`use()\` a cached promise to read with Suspense (see you in the Arcane Spire). The ideas
        are the same. You can also cancel requests
        with an \`AbortController\`; in Reactoria, use the \`ignore\` flag.
        :::
      `,
      task: md`
        ## 🎯 Consult the oracle properly

        Upgrade the effect that talks to \`/api/volcano?name=<volcano>\`:

        1. **Dependencies:** fetch again whenever \`volcano\` changes.
        2. **Loading:** while a request is in flight, show \`<p className="loading">Consulting the oracle…</p>\` and no report.
        3. **Errors:** if \`res.ok\` is false, show \`<p className="error">\` reading **The oracle is silent: HTTP 500** (with the real status) and no report. Pick **The Mutator's Maw** to test it.
        4. **Success:** show the \`<article className="report">\` (already written).
        5. **No stale answers:** use an \`ignore\` flag raised in the cleanup, so an answer for a volcano you've already left never shows up, and doesn't switch off the loading message either.

        The JSX for all three states is already there: you only need to drive \`loading\`, \`error\` and \`report\` correctly.
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [volcano, setVolcano] = useState('ember');
          const [report, setReport] = useState(null);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState(null);

          useEffect(() => {
            // 🔮 Asks once... and never again. No loading, no errors, no ignore flag.
            fetch(\`/api/volcano?name=\${volcano}\`)
              .then((res) => res.json())
              .then((data) => setReport(data));
          }, []);

          return (
            <div className="oracle">
              <h2>🔮 The Oracle of Embers</h2>
              <select value={volcano} onChange={(e) => setVolcano(e.target.value)}>
                <option value="ember">Ember Peak</option>
                <option value="cinder">Cinder Cone</option>
                <option value="obsidian">Obsidian Spire</option>
                <option value="mutator">The Mutator's Maw</option>
              </select>

              {loading && <p className="loading">Consulting the oracle…</p>}
              {error && <p className="error">The oracle is silent: {error}</p>}
              {report && (
                <article className="report">
                  <h3>{report.name}</h3>
                  <p className="temp">🌡️ {report.temperature}°C</p>
                  <p className="mood">Mood: {report.mood}</p>
                </article>
              )}
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [volcano, setVolcano] = useState('ember');
          const [report, setReport] = useState(null);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState(null);

          useEffect(() => {
            let ignore = false;

            async function consult() {
              setLoading(true);
              setError(null);
              setReport(null);
              try {
                const res = await fetch(\`/api/volcano?name=\${volcano}\`);
                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                const data = await res.json();
                if (!ignore) setReport(data);
              } catch (err) {
                if (!ignore) setError(err.message);
              } finally {
                if (!ignore) setLoading(false);
              }
            }

            consult();
            return () => {
              ignore = true;
            };
          }, [volcano]);

          return (
            <div className="oracle">
              <h2>🔮 The Oracle of Embers</h2>
              <select value={volcano} onChange={(e) => setVolcano(e.target.value)}>
                <option value="ember">Ember Peak</option>
                <option value="cinder">Cinder Cone</option>
                <option value="obsidian">Obsidian Spire</option>
                <option value="mutator">The Mutator's Maw</option>
              </select>

              {loading && <p className="loading">Consulting the oracle…</p>}
              {error && <p className="error">The oracle is silent: {error}</p>}
              {report && (
                <article className="report">
                  <h3>{report.name}</h3>
                  <p className="temp">🌡️ {report.temperature}°C</p>
                  <p className="mood">Mood: {report.mood}</p>
                </article>
              )}
            </div>
          );
        }
      `,
      hints: [
        md`Change the dependency array to \`[volcano]\`. Then, at the start of each run, call \`setLoading(true)\`, \`setError(null)\` and \`setReport(null)\`.`,
        md`
          Use an async function inside the effect:

          \`\`\`jsx
          async function consult() {
            try {
              const res = await fetch(\`/api/volcano?name=\${volcano}\`);
              if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
              setReport(await res.json());
            } catch (err) {
              setError(err.message);
            } finally {
              setLoading(false);
            }
          }
          consult();
          \`\`\`
        `,
        md`Race protection: \`let ignore = false;\` at the top of the effect, \`return () => { ignore = true; };\` at the bottom, and wrap every state update after the \`await\` in \`if (!ignore)\`.`,
      ],
      tests: [
        test('Shows the loading message, then the report', async (t) => {
          t.render();
          t.expect(
            t.$('.loading'),
            'Right after the first render, show <p className="loading">Consulting the oracle…</p>: call setLoading(true) when the request starts.',
          );
          t.expect(!t.$('.report'), 'While loading, no report should be shown yet.');
          await wait(t, 350);
          const name = clean(t.$('.report h3')?.textContent);
          t.expect(name === 'Ember Peak', `After the answer arrived the report shows "${name || 'nothing'}" — expected "Ember Peak".`);
          t.expect(
            !t.$('.loading'),
            'The report arrived, but "Consulting the oracle…" is still showing. Set loading back to false when the request finishes.',
          );
        }),
        test('Changing the volcano fetches its report', async (t) => {
          t.render();
          await wait(t, 350);
          t.change('select', 'cinder');
          t.expect(
            t.fetchCalls.some((c) => param(c.url, 'name') === 'cinder'),
            `Choosing Cinder Cone didn't send a new request (requests so far: ${urls(t)}). The effect reads volcano, so volcano belongs in the dependency array.`,
          );
          t.expect(t.$('.loading'), 'While Cinder Cone loads, show the loading message: call setLoading(true) at the start of every request, not only the first one.');
          t.expect(!t.$('.report'), 'While the new report loads, hide the old one: setReport(null) when a request starts.');
          await wait(t, 350);
          const name = clean(t.$('.report h3')?.textContent);
          t.expect(name === 'Cinder Cone', `The report shows "${name || 'nothing'}" — expected "Cinder Cone".`);
        }),
        test('A failed request shows the error (check res.ok)', async (t) => {
          t.render();
          await wait(t, 350);
          t.change('select', 'mutator');
          await wait(t, 350);
          const error = clean(t.$('.error')?.textContent);
          t.expect(
            error === 'The oracle is silent: HTTP 500',
            `For The Mutator's Maw the error reads "${error || 'nothing'}" — expected "The oracle is silent: HTTP 500". fetch doesn't throw on a 500: check if (!res.ok) throw new Error(\`HTTP \${res.status}\`).`,
          );
          t.expect(!t.$('.report'), 'When the request fails, no report should be shown.');
          t.expect(!t.$('.loading'), 'The request failed, so the loading message should be gone (set loading to false in finally).');
        }),
        test('A slow answer for an old volcano never shows up', async (t) => {
          t.render(); // Ember Peak's request starts at 0 ms and lands at 300 ms
          await wait(t, 100);
          t.change('select', 'obsidian'); // Obsidian Spire's request lands at 400 ms
          await wait(t, 200); // now Ember Peak's stale answer lands
          const shown = clean(t.$('.report h3')?.textContent);
          t.expect(
            shown !== 'Ember Peak',
            'Ember Peak\'s slow answer arrived after you switched to Obsidian Spire, and it was displayed! Add let ignore = false; to the effect, return () => { ignore = true; }, and only update state if (!ignore).',
          );
          t.expect(
            t.$('.loading'),
            'Obsidian Spire is still loading at this moment, but the loading message vanished: the stale answer switched it off. Guard setLoading(false) with if (!ignore) too.',
          );
          await wait(t, 100);
          const name = clean(t.$('.report h3')?.textContent);
          t.expect(name === 'Obsidian Spire', `Once its answer arrived the report shows "${name || 'nothing'}" — expected "Obsidian Spire".`);
        }),
      ],
      concepts: [
        {
          id: 'volcano-fetching',
          icon: '📡',
          title: 'Fetching in an effect',
          summary: 'Track loading, error and data; check res.ok; refetch when the inputs change.',
          snippet: code`
            const res = await fetch(\`/api/items?id=\${id}\`);
            if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
            setData(await res.json());
          `,
          detail: 'fetch only rejects on network failures. A 404 or 500 resolves normally with res.ok === false.',
        },
        {
          id: 'volcano-race',
          icon: '🏁',
          title: 'Race conditions',
          summary: 'An ignore flag raised in the cleanup stops stale answers from overwriting fresh ones.',
          snippet: code`
            useEffect(() => {
              let ignore = false;
              load(id).then((d) => { if (!ignore) setData(d); });
              return () => { ignore = true; };
            }, [id]);
          `,
        },
      ],
      css: `
        .oracle { max-width: 460px; padding: 16px 18px; border-radius: 14px; background: #faf5ff; border: 3px solid #7e22ce; }
        .oracle h2 { color: #6b21a8; }
        .loading { color: #7e22ce; font-style: italic; }
        .report { background: white; border: 2px solid #e9d5ff; border-radius: 12px; padding: 10px 14px; }
        .temp { font-size: 1.3em; font-weight: 800; color: #c2410c; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'volcano-geyser',
      type: 'bug',
      title: 'The Runaway Geyser',
      blurb: 'Bug hunt! An endless fetch loop, ghost readings and a stuck, leaking timer.',
      xp: 140,
      routes: {
        '/api/geyser': (url) => GEYSERS[param(url, 'site')] || { status: 404, body: { error: 'No such vent' } },
      },
      story: [
        {
          text: 'The Infinite Looper sent his imps to the geyser monitor. Open the console: it pings the geyser again, and again, and AGAIN. Forever.',
          mood: 'worried',
        },
        {
          text: 'And that\'s not all. Ghost readings, an uptime counter stuck at one second, and a timer that never stops. Four bugs, all classic effect mistakes. Hunt them down!',
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## Dependencies are not a choice

        React re-runs an effect when one of its dependencies changes. So the rule is simple:
        **every reactive value the effect reads must be in the array**: props, state, and
        anything calculated from them. You don't *pick* dependencies; your code determines
        them.

        ## The classic effect bugs

        ### 1. No array at all: it runs after every render

        \`\`\`jsx
        useEffect(() => {
          fetch(url).then((r) => r.json()).then(setData); // setData → render → effect → fetch...
        });
        \`\`\`

        Every answer sets state, the new render runs the effect again, which fetches again...
        forever: the Infinite Looper's favourite trick. (The synchronous version,
        \`useEffect(() => setCount(count + 1))\`, loops even faster. In development React fills
        the console with "Maximum update depth exceeded" warnings, but it does not stop the loop:
        the app keeps re-rendering and burning CPU.)

        ### 2. A missing dependency: the effect goes stale

        \`\`\`jsx
        useEffect(() => {
          fetch(\`/api/geyser?site=\${site}\`).then(...);
        }, []); // 🐛 reads site, but never re-runs when site changes
        \`\`\`

        The fix is \`[site]\`: now the effect re-syncs whenever the site changes.

        ### 3. A stale closure in an interval

        \`\`\`jsx
        useEffect(() => {
          const id = setInterval(() => setUptime(uptime + 1), 1000); // uptime is 0 in here, forever
          return () => clearInterval(id);
        }, []);
        \`\`\`

        The callback was created during the first render, so it sees \`uptime\` from that
        render. Use the updater form, \`setUptime((u) => u + 1)\`: the effect no longer reads
        \`uptime\` at all, so \`[]\` is honest.

        ### 4. A missing cleanup

        Anything you start (an interval, a listener, a subscription) must be stopped in the
        cleanup, or it outlives the component.

        ### 5. A race

        Two requests in flight and the old one lands last? Use the \`ignore\` flag from the
        Oracle of Embers.

        :::tip
        An object or function created during render is a **new value on every render**. As a
        dependency it re-runs the effect every time. Create it inside the effect instead, or
        depend on the plain values it's made from.
        :::

        :::pro
        Sometimes an effect needs to *read* the latest value of something without re-running
        when it changes. React 19.2 added \`useEffectEvent\` for exactly that. Master the basics
        first; it's an advanced tool.
        :::
      `,
      task: md`
        ## 🐛 Fix the geyser monitor

        The Looper's imps planted **four** bugs. Fix them all:

        1. **Endless pinging:** the reading effect runs after every render, so it fetches forever (watch the console). Fetch once per site: on mount, and again whenever you switch the site.
        2. **Ghost readings:** switch sites quickly and the *old* site's late answer can still appear. Protect the effect with an \`ignore\` flag.
        3. **Stuck uptime:** "Monitor uptime" never gets past **1s**. Make it count 1s, 2s, 3s…
        4. **Leaking timer:** the uptime interval keeps ticking after the monitor is removed. Clean it up.
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [site, setSite] = useState('north');
          const [reading, setReading] = useState(null);
          const [uptime, setUptime] = useState(0);

          useEffect(() => {
            console.log('📡 pinging the', site, 'vent');
            fetch(\`/api/geyser?site=\${site}\`)
              .then((res) => res.json())
              .then((data) => setReading(data));
          });

          useEffect(() => {
            setInterval(() => {
              setUptime(uptime + 1);
            }, 1000);
          }, []);

          return (
            <div className="geyser">
              <h2>♨️ Geyser Monitor</h2>
              <select value={site} onChange={(e) => setSite(e.target.value)}>
                <option value="north">North vent</option>
                <option value="south">South vent</option>
              </select>
              <p className="reading">
                {reading
                  ? \`\${reading.site}: \${reading.temp}°C, pressure \${reading.pressure}\`
                  : 'Waiting for a reading…'}
              </p>
              <p className="uptime">Monitor uptime: {uptime}s</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [site, setSite] = useState('north');
          const [reading, setReading] = useState(null);
          const [uptime, setUptime] = useState(0);

          useEffect(() => {
            let ignore = false;
            console.log('📡 pinging the', site, 'vent');
            fetch(\`/api/geyser?site=\${site}\`)
              .then((res) => res.json())
              .then((data) => {
                if (!ignore) setReading(data);
              });
            return () => {
              ignore = true;
            };
          }, [site]);

          useEffect(() => {
            const id = setInterval(() => {
              setUptime((u) => u + 1);
            }, 1000);
            return () => clearInterval(id);
          }, []);

          return (
            <div className="geyser">
              <h2>♨️ Geyser Monitor</h2>
              <select value={site} onChange={(e) => setSite(e.target.value)}>
                <option value="north">North vent</option>
                <option value="south">South vent</option>
              </select>
              <p className="reading">
                {reading
                  ? \`\${reading.site}: \${reading.temp}°C, pressure \${reading.pressure}\`
                  : 'Waiting for a reading…'}
              </p>
              <p className="uptime">Monitor uptime: {uptime}s</p>
            </div>
          );
        }
      `,
      hints: [
        md`The reading effect has no dependency array at all. It reads \`site\`, so give it \`[site]\`: it then runs on mount and whenever the site changes.`,
        md`Ghosts: \`let ignore = false;\` at the top of the reading effect, \`return () => { ignore = true; };\` at the end, and \`if (!ignore) setReading(data);\`.`,
        md`Uptime: \`const id = setInterval(() => setUptime((u) => u + 1), 1000);\` and \`return () => clearInterval(id);\`.`,
      ],
      tests: [
        test('Fetches once per site: no endless pinging', async (t) => {
          t.render();
          await wait(t, 1500);
          const n = t.fetchCalls.length;
          t.expect(
            n === 1,
            `fetch was called ${n} times in 1.5 seconds — expected exactly 1. An effect without a dependency array runs after every render, and every reading causes a render. Add a dependency array.`,
          );
          const reading = clean(t.find('.reading').textContent);
          t.expect(reading.includes('North Vent'), `The reading shows "${reading}" — expected the North Vent reading.`);
        }),
        test('Switching the site fetches that site\'s reading', async (t) => {
          t.render();
          await wait(t, 400);
          t.change('select', 'south');
          await wait(t, 400);
          t.expect(
            t.fetchCalls.some((c) => param(c.url, 'site') === 'south'),
            `Switching to the south vent didn't fetch it (requests: ${urls(t)}). The effect reads site, so site belongs in the dependency array: [site].`,
          );
          const reading = clean(t.find('.reading').textContent);
          t.expect(reading.includes('South Vent'), `After switching, the reading shows "${reading}" — expected the South Vent reading.`);
        }),
        test('No ghost readings when switching quickly', async (t) => {
          t.render(); // the north request lands at 300 ms
          await wait(t, 100);
          t.change('select', 'south'); // the south request lands at 400 ms
          await wait(t, 200);
          const reading = clean(t.find('.reading').textContent);
          t.expect(
            !reading.includes('North Vent'),
            `The north vent's late answer was displayed after you switched to south ("${reading}"). Use let ignore = false; ... return () => { ignore = true; }; and only setReading if (!ignore).`,
          );
          await wait(t, 100);
          const after = clean(t.find('.reading').textContent);
          t.expect(after.includes('South Vent'), `When its answer arrived the reading shows "${after}" — expected the South Vent reading.`);
        }),
        test('Uptime counts 1s, 2s, 3s…', async (t) => {
          t.render();
          await wait(t, 3000);
          const uptime = clean(t.find('.uptime').textContent);
          t.expect(
            uptime === 'Monitor uptime: 3s',
            `After 3 seconds it shows "${uptime}" — expected "Monitor uptime: 3s". The interval callback captured uptime = 0 from the first render. Use the updater form: setUptime((u) => u + 1).`,
          );
        }),
        test('The uptime interval is cleaned up on unmount', async (t) => {
          t.render();
          await t.tick(1000);
          t.unmount();
          const left = t.timers.pendingIntervals();
          t.expect(
            left === 0,
            `${left} interval(s) kept ticking after the monitor was removed. Keep the id and return a cleanup: return () => clearInterval(id);`,
          );
        }),
      ],
      concepts: [
        {
          id: 'volcano-effect-bugs',
          icon: '🐞',
          title: 'Effect bug checklist',
          summary: 'Missing array (loops), missing dependency (stale), stale closure, missing cleanup, races.',
          detail: 'Every value the effect reads goes in the array; every setup gets a cleanup; use updater functions inside long-lived callbacks.',
        },
        {
          id: 'volcano-stale-closure',
          icon: '🧊',
          title: 'Stale closures',
          summary: 'A callback sees the values from the render that created it.',
          snippet: code`
            // 🐛 always sets 1
            setInterval(() => setCount(count + 1), 1000);
            // ✅ always reads the latest value
            setInterval(() => setCount((c) => c + 1), 1000);
          `,
        },
      ],
      css: `
        .geyser { max-width: 440px; padding: 16px 18px; border-radius: 14px; background: #ecfeff; border: 3px solid #0e7490; }
        .geyser h2 { color: #155e75; }
        .reading { font-size: 1.1em; font-weight: 700; padding: 8px 12px; background: white; border-radius: 10px; }
        .uptime { font-family: ui-monospace, monospace; color: #0e7490; }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'volcano-no-effect',
      type: 'code',
      title: 'The Overheated Forge',
      blurb: 'You might not need an effect: calculate during render, react in event handlers.',
      xp: 140,
      story: [
        {
          text: 'Smith Fenna\'s lava forge sells gear for the crater. Its counter works... sort of. It announces purchases you never made, and every click renders twice.',
          mood: 'thinking',
        },
        {
          text: 'The culprits: two effects that should never have existed. Not everything is a side effect. Let\'s cool this forge down!',
          mood: 'excited',
        },
      ],
      lesson: md`
        ## Effects are an escape hatch

        Effects exist to **synchronise with something outside React**. If no external system
        is involved, you probably don't need one. Unnecessary effects make components slower
        (extra renders), harder to follow, and buggy.

        ## 1. Data you can calculate: calculate it during render

        \`\`\`jsx
        // 🔴 Redundant state + effect
        const [fullName, setFullName] = useState('');
        useEffect(() => {
          setFullName(first + ' ' + last);
        }, [first, last]);

        // ✅ Just calculate it
        const fullName = first + ' ' + last;
        \`\`\`

        The effect version renders twice for every change: once with a stale \`fullName\`, then
        again after the effect sets it. The calculated version is right on the first try.

        ## 2. Logic caused by an event: put it in the event handler

        \`\`\`jsx
        // 🔴 Watching state to guess what the user did
        useEffect(() => {
          if (cart.length > 0) setToast(\`Added \${cart[cart.length - 1].name}!\`);
        }, [cart]);

        // ✅ The user clicked "Add", so respond in the click handler
        function handleAdd(item) {
          setCart([...cart, item]);
          setToast(\`Added \${item.name}!\`);
        }
        \`\`\`

        The effect fires whenever \`cart\` changes **for any reason**: on the first render if the
        cart starts non-empty, when an item is removed, when the cart is restored from
        storage... An effect can't know *why* the state changed. The event handler knows
        exactly what happened.

        ## Ask: why does this code run?

        | Because... | Put it... |
        |---|---|
        | it can be calculated from props/state | in the render body (plain JavaScript) |
        | the user did something | in that event handler |
        | the component is on screen and must sync with an outside system | in an effect |

        ## Coming up later

        - An expensive calculation? Cache it with \`useMemo\` (Performance Peaks).
        - Need to reset all state when a prop changes? Give the component a \`key\` (Performance Peaks).
        - Sending a form to a server? Do it in the submit handler, not in an effect watching a "submitted" flag.

        :::mistake
        **Chains** of effects, where one effect sets state that triggers another effect, that
        sets more state... Each link costs a render, and the order of events becomes a
        mystery. Calculate what you can during render, and do the rest in one handler.
        :::
      `,
      task: md`
        ## 🎯 Cool the forge

        Remove **both** effects:

        1. Delete the \`total\` state and its effect. Calculate \`total\` during render from \`pack\`.
        2. Delete the toast effect. Set the toast **in the event handlers**: \`add(item)\` shows **Added {name} to your pack!** and \`remove(item)\` shows **Removed {name} from your pack.**
        3. Nothing is announced when the page first loads: you start with Ember Boots, and that's not news.

        Keep the \`console.log\` line: the very first render must already log the right total (**total = 15**), and every click must cause **exactly one** render.
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        const WARES = [
          { id: 1, name: 'Obsidian Blade', price: 40 },
          { id: 2, name: 'Magma Shield', price: 25 },
          { id: 3, name: 'Ember Boots', price: 15 },
        ];

        export default function App() {
          const [pack, setPack] = useState([WARES[2]]); // you already own Ember Boots
          const [total, setTotal] = useState(0);
          const [toast, setToast] = useState('');

          console.log('🔨 forge rendered, total =', total);

          // 🌋 Needless effect #1: keeps total "in sync" with pack
          useEffect(() => {
            setTotal(pack.reduce((sum, item) => sum + item.price, 0));
          }, [pack]);

          // 🌋 Needless effect #2: announces the newest item
          useEffect(() => {
            if (pack.length > 0) {
              setToast(\`Added \${pack[pack.length - 1].name} to your pack!\`);
            }
          }, [pack]);

          function add(item) {
            setPack([...pack, item]);
          }

          function remove(item) {
            setPack(pack.filter((p) => p.id !== item.id));
          }

          return (
            <div className="forge">
              <h2>⚒️ The Lava Forge</h2>
              {toast && <p className="toast">{toast}</p>}
              <ul className="wares">
                {WARES.map((item) => {
                  const owned = pack.some((p) => p.id === item.id);
                  return (
                    <li key={item.id}>
                      <span>
                        {item.name} — {item.price} gold
                      </span>
                      {owned ? (
                        <button onClick={() => remove(item)}>Remove</button>
                      ) : (
                        <button onClick={() => add(item)}>Add</button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="total">Total: {total} gold</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const WARES = [
          { id: 1, name: 'Obsidian Blade', price: 40 },
          { id: 2, name: 'Magma Shield', price: 25 },
          { id: 3, name: 'Ember Boots', price: 15 },
        ];

        export default function App() {
          const [pack, setPack] = useState([WARES[2]]); // you already own Ember Boots
          const [toast, setToast] = useState('');

          const total = pack.reduce((sum, item) => sum + item.price, 0);

          console.log('🔨 forge rendered, total =', total);

          function add(item) {
            setPack([...pack, item]);
            setToast(\`Added \${item.name} to your pack!\`);
          }

          function remove(item) {
            setPack(pack.filter((p) => p.id !== item.id));
            setToast(\`Removed \${item.name} from your pack.\`);
          }

          return (
            <div className="forge">
              <h2>⚒️ The Lava Forge</h2>
              {toast && <p className="toast">{toast}</p>}
              <ul className="wares">
                {WARES.map((item) => {
                  const owned = pack.some((p) => p.id === item.id);
                  return (
                    <li key={item.id}>
                      <span>
                        {item.name} — {item.price} gold
                      </span>
                      {owned ? (
                        <button onClick={() => remove(item)}>Remove</button>
                      ) : (
                        <button onClick={() => add(item)}>Add</button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="total">Total: {total} gold</p>
            </div>
          );
        }
      `,
      hints: [
        md`Replace the \`total\` state and its effect with one line in the component body: \`const total = pack.reduce((sum, item) => sum + item.price, 0);\`. Put it above the \`console.log\`.`,
        md`
          The toast belongs to the clicks:

          \`\`\`jsx
          function add(item) {
            setPack([...pack, item]);
            setToast(\`Added \${item.name} to your pack!\`);
          }
          \`\`\`

          Do the same in \`remove(item)\` with **Removed {name} from your pack.**
        `,
        md`When both effects are gone, remove \`useEffect\` from the import too. Each click now sets \`pack\` and \`toast\` together, and React batches them into one render.`,
      ],
      tests: [
        test('The total is right from the very first render', (t) => {
          t.render();
          const first = t.logLines().find((l) => l.includes('forge rendered')) || '';
          t.expect(
            /total = 15\b/.test(first),
            `The first render logged "${first || 'nothing'}" — expected "...total = 15". With state + an effect, the first render shows a stale total and a second render fixes it. Calculate it instead: const total = pack.reduce(...).`,
          );
          const button = t.$$('ul.wares li').find((li) => li.textContent.includes('Obsidian Blade'))?.querySelector('button');
          t.expect(button, 'Could not find the button next to Obsidian Blade.');
          t.click(button);
          const total = clean(t.find('.total').textContent);
          t.expect(total === 'Total: 55 gold', `After adding the Obsidian Blade the total reads "${total}" — expected "Total: 55 gold".`);
        }),
        test('Nothing is announced on first load', (t) => {
          t.render();
          const toast = clean(t.$('.toast')?.textContent);
          t.expect(
            toast === '',
            `On first load the toast already says "${toast}", but nobody clicked anything! An effect can't tell WHY pack changed. Set the toast inside add() instead.`,
          );
        }),
        test('Adding announces the item', (t) => {
          t.render();
          const button = t.$$('ul.wares li').find((li) => li.textContent.includes('Magma Shield'))?.querySelector('button');
          t.expect(button, 'Could not find the button next to Magma Shield.');
          t.click(button);
          const toast = clean(t.$('.toast')?.textContent);
          t.expect(
            toast === 'Added Magma Shield to your pack!',
            `After adding the Magma Shield the toast says "${toast || 'nothing'}" — expected "Added Magma Shield to your pack!". Call setToast(...) inside add(item).`,
          );
        }),
        test('Removing says "Removed …", not "Added …"', (t) => {
          t.render();
          const button = () => t.$$('ul.wares li').find((li) => li.textContent.includes('Ember Boots'))?.querySelector('button');
          t.expect(button(), 'Could not find the button next to Ember Boots.');
          t.click(button());
          const toast = clean(t.$('.toast')?.textContent);
          t.expect(
            toast === 'Removed Ember Boots from your pack.',
            `After removing the Ember Boots the toast says "${toast || 'nothing'}" — expected "Removed Ember Boots from your pack.". Call setToast(...) inside remove(item).`,
          );
        }),
        test('Each click causes exactly one render', (t) => {
          t.render();
          const renders = () => t.logLines().filter((l) => l.includes('forge rendered')).length;
          const before = renders();
          const button = t.$$('ul.wares li').find((li) => li.textContent.includes('Obsidian Blade'))?.querySelector('button');
          t.expect(button, 'Could not find the button next to Obsidian Blade.');
          t.click(button);
          const extra = renders() - before;
          t.expect(
            extra === 1,
            `One click caused ${extra} renders. Every effect that sets state adds a render pass: calculate total during render and set the toast in the handler. (Keep the console.log line!)`,
          );
        }),
      ],
      concepts: [
        {
          id: 'volcano-no-effect',
          icon: '🧊',
          title: 'You might not need an effect',
          summary: 'Calculate derived data during render; handle user actions in event handlers.',
          snippet: code`
            const total = pack.reduce((s, i) => s + i.price, 0); // not state + effect

            function add(item) {
              setPack([...pack, item]);
              setToast(\`Added \${item.name}!\`); // not an effect watching pack
            }
          `,
          detail: 'Effects are only for synchronising with systems outside React. Ask "why does this code run?" before reaching for one.',
        },
      ],
      css: `
        .forge { max-width: 470px; padding: 16px 18px; border-radius: 14px; background: #1c1917; color: #fafaf9; }
        .forge h2 { color: #fb923c; }
        .wares { list-style: none; padding: 0; }
        .wares li { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; margin: 6px 0; background: #292524; border-radius: 10px; }
        .toast { padding: 8px 12px; background: #f97316; color: #1c1917; font-weight: 700; border-radius: 10px; }
        .total { font-size: 1.2em; font-weight: 800; color: #fdba74; }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'volcano-trial',
      type: 'quiz',
      title: 'Trial of the Caldera',
      blurb: 'The caldera sages test your effect wisdom. Eight questions, no lava.',
      xp: 100,
      story: [
        {
          text: 'Before the crater path opens, the caldera sages want proof that you understand effects. Each answer comes with an explanation, so read them even when you\'re right!',
          mood: 'happy',
        },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'When does this effect run?\n\n```jsx\nuseEffect(() => {\n  console.log(\'synced\');\n});\n```',
          [
            'Only once, after the first render',
            'After every render',
            'Only when the component unmounts',
            'Never: an effect needs a dependency array',
          ],
          1,
          'With **no** dependency array, the effect runs after every render. `[]` means "only after the first render", and `[a, b]` means "after the first render and whenever `a` or `b` changed".',
        ),
        q(
          'What happens here?\n\n```jsx\nconst [count, setCount] = useState(0);\nuseEffect(() => {\n  setCount(count + 1);\n});\n```',
          [
            '`count` becomes 1 and stays there',
            'Nothing: effects cannot set state',
            '`count` goes up once per second',
            'An infinite loop: each update re-renders, and every render runs the effect again',
          ],
          3,
          'The effect sets state, the state change re-renders, and with no dependency array every render runs the effect again. In development React warns "Maximum update depth exceeded" in the console, but the loop keeps going. Ask whether this needs an effect at all!',
        ),
        q(
          '`roomId` changes from `"lava"` to `"ash"`. In which order does React run things?\n\n```jsx\nuseEffect(() => {\n  const conn = connect(roomId);\n  return () => conn.disconnect();\n}, [roomId]);\n```',
          [
            'It disconnects the "lava" connection, then connects to "ash"',
            'It connects to "ash", then disconnects "lava"',
            'It only connects to "ash"; cleanup only runs on unmount',
            'It disconnects "lava" and stops',
          ],
          0,
          'Before re-running an effect, React runs the **previous** cleanup (with the old `roomId`), then the new setup. Cleanup also runs once more on unmount.',
        ),
        q(
          'In development, with `<StrictMode>`, your effect runs setup → cleanup → setup when the component mounts. Why?',
          [
            'It is a bug in React that will be fixed',
            'To make the first render faster',
            'To stress-test your cleanup, so missing cleanups show up right away. It doesn\'t happen in production',
            'Because the dependency array is missing',
          ],
          2,
          'StrictMode deliberately mounts, unmounts and re-mounts in development. If that causes two intervals or two listeners, the cleanup is missing. The fix is a correct cleanup, never removing StrictMode.',
        ),
        q(
          'What does the `ignore` flag protect against?\n\n```jsx\nuseEffect(() => {\n  let ignore = false;\n  fetchBio(person).then((bio) => {\n    if (!ignore) setBio(bio);\n  });\n  return () => { ignore = true; };\n}, [person]);\n```',
          [
            'It makes the request faster',
            'A slow answer for a previous `person` overwriting the newer one',
            'It cancels the network request',
            'It stops the effect from running twice in StrictMode',
          ],
          1,
          'When `person` changes, the cleanup sets `ignore = true` for the old run. Its answer still arrives, but it is ignored, so only the latest request can update the screen. (The request itself is not cancelled; `AbortController` can do that.)',
        ),
        q(
          'Which of these does **not** need an effect?',
          [
            'Keeping `document.title` in sync with a counter',
            'Listening to the window\'s `resize` events',
            'Connecting to a chat server while a chat room is shown',
            'Calculating `fullName` from `firstName` and `lastName`',
          ],
          3,
          '`fullName` can be calculated during render: `const fullName = firstName + \' \' + lastName;`. The other three synchronise with systems outside React (the tab title, the window, a server), which is exactly what effects are for.',
        ),
        q(
          'The server answers this request with status **500**. What happens?\n\n```js\nconst res = await fetch(\'/api/lava\');\nconst data = await res.json();\nsetData(data);\n```',
          [
            '`fetch` throws, so the code stops',
            'The error body is stored as if it were real data: `fetch` only rejects on network failures, so check `res.ok`',
            'React shows an error boundary',
            'The request is retried automatically',
          ],
          1,
          'A 404 or 500 is still a response, so `fetch` resolves normally. Check `if (!res.ok) throw new Error(...)` before using the data, and show an error state.',
        ),
        q(
          'Why does this effect reconnect after **every** render?\n\n```jsx\nconst options = { serverUrl, roomId };\nuseEffect(() => {\n  const conn = connect(options);\n  return () => conn.disconnect();\n}, [options]);\n```',
          [
            '`options` is a new object on every render, so `Object.is` says it changed',
            '`serverUrl` changes on every render',
            'Effects always re-run when they contain objects',
            'Because `connect` is asynchronous',
          ],
          0,
          'Objects and functions created during render are new every time. Create `options` inside the effect and depend on `[serverUrl, roomId]` instead: plain values that only change when they really change.',
        ),
      ],
      concepts: [
        {
          id: 'volcano-sync-mindset',
          icon: '🔄',
          title: 'Synchronise, don\'t schedule',
          summary: 'An effect describes how to start and stop syncing with something outside React.',
          detail: 'Write setup and cleanup so they can run any number of times. Then dependencies, StrictMode and re-renders stop being scary.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'volcano-boss',
      type: 'build',
      boss: true,
      bossName: 'The Infinite Looper',
      bossIcon: '🐍',
      title: 'Boss: The Infinite Looper',
      blurb: 'A serpent of endless requests guards the spellbook. Debounce, guard and clean up to win.',
      xp: 300,
      fetchDelay: 800,
      routes: {
        '/api/spells': (url) => {
          const query = param(url, 'q').trim().toLowerCase();
          if (query === 'mutator') return { status: 500, body: { error: 'The Looper scrambled the archive' } };
          return SPELLS.filter((spell) => spell.name.toLowerCase().includes(query));
        },
      },
      badge: {
        id: 'badge-volcano',
        name: 'Loop Breaker',
        icon: '🐍',
        description: 'Defeated the Infinite Looper in Effect Volcano.',
      },
      story: [
        {
          text: 'From the crater rises THE INFINITE LOOPER, a serpent biting its own tail! He guards the Endless Spellbook and its search box.',
          mood: 'worried',
        },
        {
          text: 'His search fires a request on EVERY keystroke, answers in any order and never cleans up. The spellbook floods with requests while he laughs.',
          mood: 'thinking',
        },
        {
          text: 'Break the loop: wait for a pause before searching, show loading and errors, ignore stale answers and clean up everything. You know every move. Go!',
          mood: 'excited',
        },
      ],
      lesson: md`
        ## Debouncing: a timeout plus a cleanup

        Typing "fire" renders four times: f, fi, fir, fire. Fetching on every render floods the
        server and sets four answers racing each other. **Debouncing** waits until the user
        pauses:

        \`\`\`jsx
        useEffect(() => {
          const id = setTimeout(() => {
            console.log(\`"\${query}" stayed put for 300 ms: time to search!\`);
          }, 300);
          return () => clearTimeout(id); // a newer keystroke cancels this timeout
        }, [query]);
        \`\`\`

        Each keystroke changes \`query\`, so React first runs the **cleanup** (cancelling the
        pending timeout), then sets a new one. Only the timeout from the last keystroke lives
        long enough to fire. Cleanup gives you debouncing for free!

        ## Your toolbox

        | You need | Use (and where you learned it) |
        |---|---|
        | Wait for a pause | \`setTimeout\` + \`clearTimeout\` in the cleanup (above) |
        | Loading, error, data | three states and a \`res.ok\` check (The Oracle of Embers) |
        | No stale answers | \`let ignore = false\`, set to \`true\` in the cleanup (The Oracle of Embers) |
        | Nothing to search | derive it during render from \`query.trim()\` (The Overheated Forge) |
        | No leaks | every timer stops in the cleanup (The Lava Clock) |

        :::tip
        One effect can do it all: inside the timeout, run the async fetch. The cleanup then
        sets \`ignore = true\` **and** clears the timeout.
        :::

        :::pro
        Build URLs with \`encodeURIComponent\` so spaces and symbols in user input are safe:

        \`\`\`js
        fetch(\`/api/spells?q=\${encodeURIComponent(query)}\`);
        \`\`\`
        :::
      `,
      task: md`
        ## 👑 Break the Infinite Looper

        Build a proper live search (the input is already controlled):

        1. **Empty box:** while \`query.trim()\` is empty, send no request and show \`<p className="hint">Start typing to search the spellbook.</p>\` (no results).
        2. **Debounce:** fetch \`/api/spells?q=<query>\` only once the user has stopped typing for **300 ms**. Each keystroke cancels the pending timeout.
        3. **Loading:** while the request is in flight, show \`<p className="loading">Searching…</p>\`.
        4. **Results:** list each spell's name in an \`<li>\` inside \`<ul className="results">\`. If the answer is an empty list, show \`<p className="empty">No spells found.</p>\` instead.
        5. **Errors:** if \`res.ok\` is false, show \`<p className="error">\` containing **HTTP 500** (search **mutator** to test it).
        6. **No stale answers:** an answer for an older query must never be shown (\`ignore\` flag).
        7. **Cleanup:** when the spellbook unmounts, no timeout may be left pending.
      `,
      starter: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [query, setQuery] = useState('');
          const [spells, setSpells] = useState([]);

          // 🐍 The Looper's search: one request per keystroke (even for an empty box),
          // answers in any order, no loading, no errors, no cleanup.
          useEffect(() => {
            fetch(\`/api/spells?q=\${query}\`)
              .then((res) => res.json())
              .then((data) => setSpells(data));
          }, [query]);

          return (
            <div className="spellbook">
              <h2>📖 The Endless Spellbook</h2>
              <input
                className="search"
                placeholder="Search spells..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="results">
                {spells.map((spell) => (
                  <li key={spell.id}>{spell.name}</li>
                ))}
              </ul>
            </div>
          );
        }
      `,
      solution: code`
        import { useState, useEffect } from 'react';

        export default function App() {
          const [query, setQuery] = useState('');
          const [spells, setSpells] = useState([]);
          const [loading, setLoading] = useState(false);
          const [error, setError] = useState(null);

          const search = query.trim();

          useEffect(() => {
            if (search === '') return; // nothing to search: no request at all

            let ignore = false;
            setLoading(true);
            setError(null);

            const id = setTimeout(async () => {
              try {
                const res = await fetch(\`/api/spells?q=\${encodeURIComponent(search)}\`);
                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                const data = await res.json();
                if (!ignore) setSpells(data);
              } catch (err) {
                if (!ignore) setError(err.message);
              } finally {
                if (!ignore) setLoading(false);
              }
            }, 300);

            return () => {
              ignore = true; // answers for this query are no longer wanted
              clearTimeout(id); // and if we were still waiting, don't search at all
            };
          }, [search]);

          let content;
          if (search === '') {
            content = <p className="hint">Start typing to search the spellbook.</p>;
          } else if (loading) {
            content = <p className="loading">Searching…</p>;
          } else if (error) {
            content = <p className="error">The Looper scrambled the archive: {error}</p>;
          } else if (spells.length === 0) {
            content = <p className="empty">No spells found.</p>;
          } else {
            content = (
              <ul className="results">
                {spells.map((spell) => (
                  <li key={spell.id}>{spell.name}</li>
                ))}
              </ul>
            );
          }

          return (
            <div className="spellbook">
              <h2>📖 The Endless Spellbook</h2>
              <input
                className="search"
                placeholder="Search spells..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {content}
            </div>
          );
        }
      `,
      hints: [
        md`Add \`loading\` and \`error\` state. In the effect, return early when \`query.trim()\` is empty, and in the JSX show the hint in that case. Choose what to render with an \`if / else if\` chain: hint, loading, error, empty, results.`,
        md`Debounce: wrap the fetch in \`const id = setTimeout(async () => { ... }, 300);\` and return a cleanup that calls \`clearTimeout(id)\`. Inside, \`await fetch(...)\`, check \`res.ok\` and \`await res.json()\` in a \`try / catch / finally\`.`,
        md`Race protection: \`let ignore = false;\` at the top of the effect, guard every state update after an \`await\` with \`if (!ignore)\`, and make the cleanup \`() => { ignore = true; clearTimeout(id); }\`.`,
      ],
      tests: [
        test('Waits for a 300 ms pause, and never searches an empty box', async (t) => {
          t.render();
          await wait(t, 1000);
          t.expect(
            t.fetchCalls.length === 0,
            `The box is empty, but ${t.fetchCalls.length} request(s) were sent (${urls(t)}). Skip the fetch while query.trim() is empty.`,
          );
          const hint = clean(t.$('.hint')?.textContent);
          t.expect(
            hint === 'Start typing to search the spellbook.',
            `While the box is empty, show <p className="hint">Start typing to search the spellbook.</p> (found: "${hint || 'nothing'}").`,
          );
          const input = t.find('input.search');
          for (const text of ['f', 'fi', 'fir', 'fire']) {
            t.type(input, text);
            await wait(t, 100);
          }
          t.expect(
            t.fetchCalls.length === 0,
            `${t.fetchCalls.length} request(s) were sent while you were still typing (${urls(t)}). Start a 300 ms setTimeout in the effect and clear it in the cleanup.`,
          );
          await wait(t, 250);
          t.expect(
            t.fetchCalls.length === 1,
            `300 ms after the last keystroke there should be exactly 1 request, but there were ${t.fetchCalls.length} (${urls(t)}).`,
          );
          t.expect(
            t.fetchCalls[0].url.split('?')[0] === '/api/spells' && param(t.fetchCalls[0].url, 'q') === 'fire',
            `The request went to "${t.fetchCalls[0].url}" — expected /api/spells?q=fire.`,
          );
        }),
        test('Shows "Searching…", then the matching spells (or "No spells found.")', async (t) => {
          t.render();
          t.type('input.search', 'fire');
          await waitForFetch(t, 1);
          t.expect(t.$('.loading'), 'While the request is in flight, show <p className="loading">Searching…</p>.');
          await wait(t, 850);
          t.expect(!t.$('.loading'), 'The answer arrived but "Searching…" is still showing. Set loading back to false.');
          const names = t.$$('.results li').map((li) => clean(li.textContent));
          t.expect(
            names.length === 2 && names.some((n) => n.startsWith('Fireball')) && names.some((n) => n.startsWith('Fire Wall')),
            `For "fire" the results show: ${names.join(', ') || 'nothing'}. Expected Fireball and Fire Wall as <li> items in <ul className="results">.`,
          );
          t.type('input.search', 'zzz');
          await waitForFetch(t, 2);
          await wait(t, 850);
          const empty = clean(t.$('.empty')?.textContent);
          t.expect(
            empty === 'No spells found.' && t.count('.results li') === 0,
            `When nothing matches, show <p className="empty">No spells found.</p> and no list items (found: "${empty || 'nothing'}").`,
          );
        }),
        test('Shows an error when the archive fails (search "mutator")', async (t) => {
          t.render();
          t.type('input.search', 'mutator');
          await waitForFetch(t, 1);
          await wait(t, 850);
          const error = clean(t.$('.error')?.textContent);
          t.expect(
            error.includes('HTTP 500'),
            `The search for "mutator" failed with status 500, but .error reads "${error || 'nothing'}". Check if (!res.ok) throw new Error(\`HTTP \${res.status}\`) and show the message in <p className="error">.`,
          );
          t.expect(!t.$('.loading'), 'The request failed, so "Searching…" should be gone.');
          t.expect(t.count('.results li') === 0, 'A failed search should not list any spells.');
        }),
        test('Never shows the answer for an older query', async (t) => {
          t.render();
          t.type('input.search', 'fire');
          await waitForFetch(t, 1); // the "fire" request is flying (800 ms)
          await wait(t, 100);
          t.type('input.search', 'ice');
          await waitForFetch(t, 2); // the "ice" request starts 300 ms later
          await wait(t, 450); // ...and now the stale "fire" answer lands
          const stale = t.$$('.results li').map((li) => clean(li.textContent));
          t.expect(
            !stale.some((n) => /fire/i.test(n)),
            `The box says "ice", but the old answer for "fire" was displayed (${stale.join(', ')}). Use an ignore flag: set it to true in the cleanup and skip state updates when it is true.`,
          );
          await wait(t, 400);
          const names = t.$$('.results li').map((li) => clean(li.textContent));
          t.expect(
            names.length === 1 && names[0].startsWith('Ice Lance'),
            `Once the "ice" answer arrived the results show: ${names.join(', ') || 'nothing'}. Expected only Ice Lance.`,
          );
        }),
        test('Unmounting cancels the pending search', async (t) => {
          t.render();
          t.type('input.search', 'lava');
          await wait(t, 100);
          t.unmount();
          const pending = t.timers.pendingTimeouts();
          t.expect(
            pending === 0,
            `${pending} timeout(s) were still pending after the spellbook closed. Return a cleanup from the effect that calls clearTimeout(id).`,
          );
          await t.tick(1000);
          t.expect(t.fetchCalls.length === 0, `A request was still sent after the spellbook closed (${urls(t)}). Clear the debounce timeout in the cleanup.`);
        }),
      ],
      concepts: [
        {
          id: 'volcano-debounce',
          icon: '⏱️',
          title: 'Debounce with cleanup',
          summary: 'Start a timeout in the effect and clear it in the cleanup: only the last change fires.',
          snippet: code`
            useEffect(() => {
              const id = setTimeout(() => search(query), 300);
              return () => clearTimeout(id);
            }, [query]);
          `,
          detail: 'Combine it with an ignore flag so answers for older queries are dropped.',
        },
      ],
      css: `
        .spellbook { max-width: 470px; padding: 16px 18px; border-radius: 14px; background: linear-gradient(#312e81, #1e1b4b); color: #e0e7ff; }
        .spellbook h2 { color: #fbbf24; }
        .search { width: 100%; margin: 4px 0 10px; }
        .results { list-style: none; padding: 0; }
        .results li { padding: 6px 10px; margin: 5px 0; background: rgba(255, 255, 255, 0.1); border-radius: 8px; }
        .results li::before { content: '✨ '; }
        .loading, .hint, .empty { color: #c7d2fe; font-style: italic; }
        .error { color: #fca5a5; font-weight: 700; }
      `,
    },
  ],
};
