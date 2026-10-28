import { code, md, q, test } from '../helpers.js';

// Small helpers shared by the checks in this chapter.
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const textOf = (t, sel) => norm(t.find(sel).textContent);

// --- Captain's Record helpers -------------------------------------------
const ORIGINAL_RECORD = {
  captain: 'Captain Rhea',
  ship: 'The Pure Function',
  crew: 'Crew: 12',
  flag: 'Flag: 🏴',
  gold: 'Gold: 40',
  maps: 'Maps: 2',
};
const readRecord = (t) => ({
  captain: textOf(t, '.captain'),
  ship: textOf(t, '.ship-name').replace(/^[^A-Za-z]+/, ''),
  crew: textOf(t, '.crew'),
  flag: textOf(t, '.flag'),
  gold: textOf(t, '.gold'),
  maps: textOf(t, '.maps'),
});
const describeFields = (record, keys) => keys.map((k) => `"${record[k] || '(empty)'}"`).join(', ');

function expectResetRestores(t, action) {
  t.click(t.button('Reset'));
  const after = readRecord(t);
  const broken = Object.keys(ORIGINAL_RECORD).filter((k) => after[k] !== ORIGINAL_RECORD[k]);
  t.expect(
    broken.length === 0,
    `After ${action} and ↺ Reset, the record shows ${describeFields(after, broken)} instead of ${describeFields(ORIGINAL_RECORD, broken)}. initialCaptain itself was mutated! { ...captain } copies only the top level: the ship inside is still the same shared object. Copy every level on the way down instead of assigning to it.`,
  );
}

function checkRecordAction(t, label, field, expected, how) {
  t.render();
  t.click(t.button(label));
  const record = readRecord(t);
  t.expect(record[field] === expected, `After clicking "${label}", the record shows "${record[field] || '(empty)'}" — expected "${expected}". ${how}`);
  const lost = Object.keys(ORIGINAL_RECORD).filter((k) => k !== field && record[k] !== ORIGINAL_RECORD[k]);
  t.expect(
    lost.length === 0,
    `Clicking "${label}" also changed ${lost.map((k) => `"${ORIGINAL_RECORD[k]}" → "${record[k] || '(empty)'}"`).join(', ')}. Spread every level so the other fields survive: { ...captain, ship: { ...captain.ship, ... } }.`,
  );
  expectResetRestores(t, `"${label}"`);
}

// --- Tide Charts helpers --------------------------------------------------
const ORIGINAL_ORDER = 'Shell Beach > Palm Bay > Driftwood Point';
const beachOrder = (t) => t.$$('li.beach .name').map((el) => norm(el.textContent)).join(' > ');

// --- Cartographer helpers --------------------------------------------------
const detailsText = (t) => {
  const parts = t.$$('.details h3, .details p').map((el) => norm(el.textContent)).filter(Boolean);
  return parts.length ? parts.join(' · ') : textOf(t, '.details');
};

// --- Fleet (boss) helpers ---------------------------------------------------
const START_FLEET = 'The Pure Function > Spread Operator > Old Splice';
const fleetNames = (t) => t.$$('li.ship .name').map((el) => norm(el.textContent));

export default {
  id: 'immutable-isles',
  file: '05-immutable-isles.js',
  title: 'Immutable Isles',
  short: 'Immutability',
  subtitle: 'Never mutate, always replace: update objects and arrays in state, and shape state so it cannot lie.',
  icon: '🗿',
  colors: ['#134e4a', '#5eead4'],
  scenery: ['🗿', '🐚', '🦜', '🐢', '🌺', '🧭', '🪸', '⛵'],
  intro: [
    { text: 'Ahoy! Welcome to the Immutable Isles. The islanders live by one sacred rule: you never change a thing. You carve a new one.', mood: 'happy' },
    { text: "The Mutator's lieutenant, Push, has been sneaking around changing things in place. React can't see those changes, so half the isles froze solid.", mood: 'worried' },
    { text: "Learn to update objects and arrays the island way — with fresh copies — and the isles will thaw. Oh, and don't touch the stone heads. They hate being edited.", mood: 'excited' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'isles-frozen-parrot',
      type: 'bug',
      title: 'The Frozen Parrot',
      blurb: 'Bug hunt! The handlers change the parrot, but the screen never notices.',
      xp: 130,
      story: [
        { text: 'Meet Captain Polly, the harbour parrot. Feed her a cracker and she learns a new word... but look, she is frozen solid!', mood: 'worried' },
        { text: "Here's the weird part: open the console and feed her. The data DOES change! Something is being mutated behind React's back. Read the lesson, then thaw her out.", mood: 'thinking' },
      ],
      lesson: md`
        ## Objects in state

        State can hold any JavaScript value, including objects:

        \`\`\`jsx
        const [parrot, setParrot] = useState({ name: 'Polly', words: 3, hat: 'none' });
        \`\`\`

        JavaScript *lets* you change an object's properties. But objects in React state must
        be treated as **read-only**. This looks reasonable, and does nothing:

        \`\`\`jsx
        function handleFeed() {
          parrot.words = parrot.words + 1; // ❌ mutation: changes the existing object
          setParrot(parrot);               // ...and hands React the SAME object
        }
        \`\`\`

        ## Why mutation doesn't re-render

        When you call a setter, React compares the new value with the current one using
        \`Object.is\`. If they are "the same", it skips the re-render. For objects and arrays,
        "the same" means **the very same object in memory**, not "has the same contents":

        \`\`\`js
        Object.is(3, 3);                  // true
        Object.is(parrot, parrot);        // true  → "nothing changed", no render
        Object.is(parrot, { ...parrot }); // false → a new object, React re-renders
        \`\`\`

        You changed a property *inside* the object React already has, then passed that same
        object back. From React's point of view, nothing happened. Worse: the snapshot of the
        previous render was quietly changed as well — old state is no longer what it was.

        ## Replace, don't mutate: the spread syntax

        Create a **new** object that contains the change. The spread syntax \`...\` copies
        all the properties of an existing object into a new one:

        \`\`\`jsx
        function handleFeed() {
          setParrot({
            ...parrot,               // copy every field (name, words, hat...)
            words: parrot.words + 1, // then overwrite the one that changes
          });
        }
        \`\`\`

        Order matters: properties written **after** the spread win. In
        \`{ words: 99, ...parrot }\` the copied \`words\` would overwrite your 99!

        Toggling a boolean works the same way: \`setParrot({ ...parrot, asleep: !parrot.asleep })\`.

        ## Mutating a brand-new object is fine

        The rule is about objects that are **already in state**. An object you just created in
        your handler isn't part of any render yet, so changing it is harmless:

        \`\`\`jsx
        const next = { ...parrot };
        next.hat = '🎩'; // fine: 'next' is brand new
        setParrot(next);
        \`\`\`

        :::mistake
        \`parrot.words++\` and \`parrot.hat = '🎩'\` are mutations too: any assignment to a
        property of a state object counts. If the screen ignores your change, look for a \`=\`
        or \`++\` on something that came from state.
        :::

        :::tip
        The updater form works with objects too: \`setParrot((p) => ({ ...p, words: p.words + 1 }))\`.
        Note the **parentheses** around the object literal: without them, \`{\` would start a
        function body instead.
        :::
      `,
      task: md`
        ## 🐛 Thaw the parrot

        All three handlers **mutate** \`parrot\` and then pass the same object to \`setParrot\`, so React never re-renders. Fix each one so it calls \`setParrot\` with a **new object** built with the spread syntax:

        1. **🍪 Feed a cracker**: \`words\` goes up by 1, so \`<p className="words">\` shows **Words: 4**.
        2. **🎩 Fancy hat**: \`hat\` becomes \`'🎩'\`, so \`<p className="hat">\` shows **Hat: 🎩**.
        3. **😴 Nap**: toggles \`asleep\`. \`<p className="status">\` shows **Zzz...** while she sleeps and **Squawk!** while she's awake.
        4. Every other field must survive each update (Polly keeps her name!), and no line may assign to a property of \`parrot\` anymore.
      `,
      starter: code`
        import { useState } from 'react';

        export default function App() {
          const [parrot, setParrot] = useState({
            name: 'Polly',
            words: 3,
            hat: 'none',
            asleep: false,
          });

          function handleFeed() {
            parrot.words = parrot.words + 1;
            console.log('Polly now knows', parrot.words, 'words... right?');
            setParrot(parrot);
          }

          function handleHat() {
            parrot.hat = '🎩';
            setParrot(parrot);
          }

          function handleNap() {
            parrot.asleep = !parrot.asleep;
            setParrot(parrot);
          }

          return (
            <div className="perch">
              <div className="parrot">🦜</div>
              <h2>Captain {parrot.name}</h2>
              <p className="words">Words: {parrot.words}</p>
              <p className="hat">Hat: {parrot.hat}</p>
              <p className="status">{parrot.asleep ? 'Zzz...' : 'Squawk!'}</p>
              <button onClick={handleFeed}>🍪 Feed a cracker</button>
              <button onClick={handleHat}>🎩 Fancy hat</button>
              <button onClick={handleNap}>😴 Nap</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export default function App() {
          const [parrot, setParrot] = useState({
            name: 'Polly',
            words: 3,
            hat: 'none',
            asleep: false,
          });

          function handleFeed() {
            setParrot({ ...parrot, words: parrot.words + 1 });
          }

          function handleHat() {
            setParrot({ ...parrot, hat: '🎩' });
          }

          function handleNap() {
            setParrot({ ...parrot, asleep: !parrot.asleep });
          }

          return (
            <div className="perch">
              <div className="parrot">🦜</div>
              <h2>Captain {parrot.name}</h2>
              <p className="words">Words: {parrot.words}</p>
              <p className="hat">Hat: {parrot.hat}</p>
              <p className="status">{parrot.asleep ? 'Zzz...' : 'Squawk!'}</p>
              <button onClick={handleFeed}>🍪 Feed a cracker</button>
              <button onClick={handleHat}>🎩 Fancy hat</button>
              <button onClick={handleNap}>😴 Nap</button>
            </div>
          );
        }
      `,
      hints: [
        md`React compares the old and new state with \`Object.is\`. \`setParrot(parrot)\` passes the very same object, so React decides nothing changed. You need to pass a **new** object.`,
        md`Spread copies every field into a new object: \`{ ...parrot, words: parrot.words + 1 }\`. Delete the \`parrot.words = ...\` line.`,
        md`The three handlers become \`setParrot({ ...parrot, words: parrot.words + 1 })\`, \`setParrot({ ...parrot, hat: '🎩' })\` and \`setParrot({ ...parrot, asleep: !parrot.asleep })\`.`,
      ],
      tests: [
        test('🍪 Feeding a cracker shows "Words: 4"', (t) => {
          t.render();
          t.click(t.button('Feed'));
          let words = textOf(t, '.words');
          t.expect(
            words === 'Words: 4',
            `After one cracker the screen shows "${words}" — expected "Words: 4". parrot.words = ... changes the object React already has, and setParrot(parrot) hands back the SAME object, so React skips the render. Use setParrot({ ...parrot, words: parrot.words + 1 }).`,
          );
          t.click(t.button('Feed'));
          words = textOf(t, '.words');
          t.expect(words === 'Words: 5', `After two crackers the screen shows "${words}" — expected "Words: 5".`);
        }),
        test('🎩 The fancy hat shows "Hat: 🎩"', (t) => {
          t.render();
          t.click(t.button('Fancy hat'));
          const hat = textOf(t, '.hat');
          t.expect(hat === 'Hat: 🎩', `After the hat button the screen shows "${hat}" — expected "Hat: 🎩". Create a new object: setParrot({ ...parrot, hat: '🎩' }).`);
        }),
        test('😴 Nap toggles between "Zzz..." and "Squawk!"', (t) => {
          t.render();
          t.expect(textOf(t, '.status') === 'Squawk!', 'Polly starts awake, so the status should read "Squawk!".');
          t.click(t.button('Nap'));
          let status = textOf(t, '.status');
          t.expect(status === 'Zzz...', `After Nap the status shows "${status}" — expected "Zzz...". Toggle with a new object: setParrot({ ...parrot, asleep: !parrot.asleep }).`);
          t.click(t.button('Nap'));
          status = textOf(t, '.status');
          t.expect(status === 'Squawk!', `After a second Nap the status shows "${status}" — expected "Squawk!" again.`);
        }),
        test('Every update keeps the other fields, and nothing is mutated', (t) => {
          t.render();
          t.click(t.button('Feed'));
          t.click(t.button('Fancy hat'));
          t.click(t.button('Nap'));
          const name = textOf(t, 'h2');
          t.expect(name === 'Captain Polly', `The heading now reads "${name}" — expected "Captain Polly". A new object must copy the old fields first: { ...parrot, ... }.`);
          const shown = [textOf(t, '.words'), textOf(t, '.hat'), textOf(t, '.status')];
          t.expect(
            shown.join(' / ') === 'Words: 4 / Hat: 🎩 / Zzz...',
            `After Feed, Fancy hat and Nap the parrot shows ${shown.map((s) => `"${s}"`).join(', ')} — expected "Words: 4", "Hat: 🎩", "Zzz...". Each update should spread the current parrot, so earlier changes are kept.`,
          );
          t.sourceExcludes(
            /\bparrot\.\w+\s*(=(?!=)|\+\+|--|\+=|-=)/,
            'Your code still assigns to a property of parrot (like parrot.words = ...). Treat state as read-only: build a new object with { ...parrot, ... } instead.',
          );
        }),
      ],
      concepts: [
        {
          id: 'isles-read-only',
          icon: '🔒',
          title: 'State is read-only',
          summary: 'Never change objects or arrays that are in state; replace them with new ones.',
          snippet: code`
            // ❌ parrot.words++; setParrot(parrot);
            setParrot({ ...parrot, words: parrot.words + 1 }); // ✅
          `,
        },
        {
          id: 'isles-object-is',
          icon: '⚖️',
          title: "Why mutation doesn't re-render",
          summary: 'React compares old and new state with Object.is: the same object means "no change".',
          snippet: code`
            Object.is(parrot, parrot);        // true  → skipped
            Object.is(parrot, { ...parrot }); // false → re-render
          `,
          detail: 'For objects and arrays, Object.is checks identity (the same object in memory), not contents.',
        },
        {
          id: 'isles-object-spread',
          icon: '🧬',
          title: 'Object spread',
          summary: '{ ...obj, key: value } copies an object and overrides some fields.',
          snippet: code`
            const next = { ...parrot, hat: '🎩' };
          `,
          detail: 'Fields written after the spread win. The copy is shallow: nested objects are shared.',
        },
      ],
      css: `
        .perch { text-align: center; background: linear-gradient(#ccfbf1, #fefce8); border: 2px solid #5eead4; border-radius: 18px; padding: 14px; }
        .parrot { font-size: 3.4em; line-height: 1.1; }
        .words, .hat { font-weight: 700; color: #0f766e; margin: 2px 0; }
        .status { font-size: 1.3em; font-style: italic; }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'isles-captains-record',
      type: 'code',
      title: "The Captain's Record",
      blurb: 'Nested objects: copy every level on the way down to the change.',
      xp: 140,
      story: [
        { text: 'Captain Rhea keeps her whole record in one nested object: the captain, her ship, the gold in its hold...', mood: 'happy' },
        { text: "Careful: spread only copies ONE level. Her clerk made a 'copy' and changed the ship — and now even the original record has changed. Let's do it properly.", mood: 'thinking' },
      ],
      lesson: md`
        ## Nested objects

        State objects often contain other objects:

        \`\`\`jsx
        const [captain, setCaptain] = useState({
          name: 'Rhea',
          rank: 'Captain',
          ship: {
            name: 'The Pure Function',
            crew: 12,
          },
        });
        \`\`\`

        To change \`ship.crew\`, you need a **new ship** (with the new crew) *and* a
        **new captain** (pointing at the new ship):

        \`\`\`jsx
        setCaptain({
          ...captain,                    // copy the captain's fields
          ship: {
            ...captain.ship,             // copy the ship's fields
            crew: captain.ship.crew + 1, // change one
          },
        });
        \`\`\`

        ## Spread is shallow

        \`{ ...captain }\` copies only the **top level**. The \`ship\` property holds a
        *reference* to the ship object, so the copy points at the **same** ship:

        \`\`\`
        captain ─► { name, rank, ship ─┐ }
                                       ├─► { name, crew }   ← ONE shared ship
        copy    ─► { name, rank, ship ─┘ }
        \`\`\`

        That's why this is still a mutation, even though it makes a "copy":

        \`\`\`jsx
        const copy = { ...captain };
        copy.ship.crew = 13; // ❌ changes the ship the old captain uses too
        setCaptain(copy);
        \`\`\`

        The screen even updates (\`copy\` is a new object), so the bug hides. But the
        previous state was corrupted — and so was the **initial value** you passed to
        \`useState\`. Anything that relies on old values, like a Reset button or an undo
        history, is now broken.

        ## Copy every object on the path

        Picture the path from the top object down to the field that changes. Every object
        **on that path** gets a new copy; everything else is shared as it is (which is safe,
        because nobody mutates it):

        \`\`\`jsx
        // captain → ship → hold → gold: three objects on the path, three spreads
        setCaptain({
          ...captain,
          ship: {
            ...captain.ship,
            hold: {
              ...captain.ship.hold,
              gold: captain.ship.hold.gold + 10,
            },
          },
        });
        \`\`\`

        :::mistake
        Forgetting the outer spread: \`setCaptain({ ship: { ...captain.ship, crew: 13 } })\`
        creates a captain with **only** a ship. The name and rank are gone!
        :::

        :::tip
        Three levels of spreads are a hint that the state might be nested too deeply. You can
        often flatten it — the Cartographer will show you why. Some teams use the **Immer**
        library, which lets you write mutating-looking code that makes the copies for you.
        :::
      `,
      task: md`
        ## 🎯 Update the captain's record

        \`initialCaptain\` is the starting state. Always create **new objects**: copy every level on the way to the field you change.

        1. **⚓ Hire a sailor**: \`ship.crew\` goes up by 1, so \`<p className="crew">\` shows **Crew: 13**. The starter's version *looks* right, but it mutates through a shallow copy. Fix it!
        2. **🚩 Red flag**: \`ship.flag\` becomes \`'🚩'\`, so \`<p className="flag">\` shows **Flag: 🚩**.
        3. **🎖️ Promote**: \`rank\` becomes \`'Admiral'\`, so \`<h2 className="captain">\` shows **Admiral Rhea**.
        4. **💰 Stash gold**: \`ship.hold.gold\` goes up by 10, so \`<p className="gold">\` shows **Gold: 50**. Three levels deep!
        5. **↺ Reset** puts \`initialCaptain\` back. It must show the original record again (Captain Rhea, Crew: 12, Flag: 🏴, Gold: 40), which only works if nothing ever mutated \`initialCaptain\`.
      `,
      starter: code`
        import { useState } from 'react';

        const initialCaptain = {
          name: 'Rhea',
          rank: 'Captain',
          ship: {
            name: 'The Pure Function',
            crew: 12,
            flag: '🏴',
            hold: { gold: 40, maps: 2 },
          },
        };

        export default function App() {
          const [captain, setCaptain] = useState(initialCaptain);

          function handleHire() {
            // 🐛 Looks fine on screen... but copy.ship is the SAME object as captain.ship!
            const copy = { ...captain };
            copy.ship.crew = copy.ship.crew + 1;
            setCaptain(copy);
          }

          function handleFlag() {
            // TODO: ship.flag becomes '🚩'
          }

          function handlePromote() {
            // TODO: rank becomes 'Admiral'
          }

          function handleStash() {
            // TODO: ship.hold.gold goes up by 10 (three levels!)
          }

          return (
            <div className="logbook">
              <h2 className="captain">
                {captain.rank} {captain.name}
              </h2>
              <div className="ship card">
                <h3 className="ship-name">⛵ {captain.ship.name}</h3>
                <p className="crew">Crew: {captain.ship.crew}</p>
                <p className="flag">Flag: {captain.ship.flag}</p>
                <p className="gold">Gold: {captain.ship.hold.gold}</p>
                <p className="maps">Maps: {captain.ship.hold.maps}</p>
              </div>
              <button onClick={handleHire}>⚓ Hire a sailor</button>
              <button onClick={handleFlag}>🚩 Red flag</button>
              <button onClick={handlePromote}>🎖️ Promote</button>
              <button onClick={handleStash}>💰 Stash gold</button>
              <button onClick={() => setCaptain(initialCaptain)}>↺ Reset</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const initialCaptain = {
          name: 'Rhea',
          rank: 'Captain',
          ship: {
            name: 'The Pure Function',
            crew: 12,
            flag: '🏴',
            hold: { gold: 40, maps: 2 },
          },
        };

        export default function App() {
          const [captain, setCaptain] = useState(initialCaptain);

          function handleHire() {
            setCaptain({
              ...captain,
              ship: { ...captain.ship, crew: captain.ship.crew + 1 },
            });
          }

          function handleFlag() {
            setCaptain({
              ...captain,
              ship: { ...captain.ship, flag: '🚩' },
            });
          }

          function handlePromote() {
            setCaptain({ ...captain, rank: 'Admiral' });
          }

          function handleStash() {
            setCaptain({
              ...captain,
              ship: {
                ...captain.ship,
                hold: { ...captain.ship.hold, gold: captain.ship.hold.gold + 10 },
              },
            });
          }

          return (
            <div className="logbook">
              <h2 className="captain">
                {captain.rank} {captain.name}
              </h2>
              <div className="ship card">
                <h3 className="ship-name">⛵ {captain.ship.name}</h3>
                <p className="crew">Crew: {captain.ship.crew}</p>
                <p className="flag">Flag: {captain.ship.flag}</p>
                <p className="gold">Gold: {captain.ship.hold.gold}</p>
                <p className="maps">Maps: {captain.ship.hold.maps}</p>
              </div>
              <button onClick={handleHire}>⚓ Hire a sailor</button>
              <button onClick={handleFlag}>🚩 Red flag</button>
              <button onClick={handlePromote}>🎖️ Promote</button>
              <button onClick={handleStash}>💰 Stash gold</button>
              <button onClick={() => setCaptain(initialCaptain)}>↺ Reset</button>
            </div>
          );
        }
      `,
      hints: [
        md`Promote only touches the top level: \`setCaptain({ ...captain, rank: 'Admiral' })\`.`,
        md`For anything inside \`ship\`, make a new ship too: \`setCaptain({ ...captain, ship: { ...captain.ship, flag: '🚩' } })\`. Rewrite \`handleHire\` the same way, without \`copy.ship.crew = ...\`.`,
        md`Gold is three levels deep: \`setCaptain({ ...captain, ship: { ...captain.ship, hold: { ...captain.ship.hold, gold: captain.ship.hold.gold + 10 } } })\`.`,
      ],
      tests: [
        test('⚓ Hire a sailor: "Crew: 13", and initialCaptain stays untouched', (t) => {
          checkRecordAction(t, 'Hire a sailor', 'crew', 'Crew: 13', 'Copy the captain AND the ship: setCaptain({ ...captain, ship: { ...captain.ship, crew: captain.ship.crew + 1 } }).');
        }),
        test('🚩 Red flag: "Flag: 🚩"', (t) => {
          checkRecordAction(t, 'Red flag', 'flag', 'Flag: 🚩', "Fill in handleFlag: setCaptain({ ...captain, ship: { ...captain.ship, flag: '🚩' } }).");
        }),
        test('🎖️ Promote: "Admiral Rhea"', (t) => {
          checkRecordAction(t, 'Promote', 'captain', 'Admiral Rhea', "Fill in handlePromote: setCaptain({ ...captain, rank: 'Admiral' }).");
        }),
        test('💰 Stash gold, three levels deep: "Gold: 50"', (t) => {
          checkRecordAction(t, 'Stash gold', 'gold', 'Gold: 50', 'Fill in handleStash with three spreads: captain → ship → hold.');
        }),
        test('All the changes stack up, and ↺ Reset restores the original', (t) => {
          t.render();
          for (const label of ['Hire a sailor', 'Red flag', 'Promote', 'Stash gold', 'Hire a sailor']) t.click(t.button(label));
          const expected = { ...ORIGINAL_RECORD, captain: 'Admiral Rhea', crew: 'Crew: 14', flag: 'Flag: 🚩', gold: 'Gold: 50' };
          const record = readRecord(t);
          const wrong = Object.keys(expected).filter((k) => record[k] !== expected[k]);
          t.expect(
            wrong.length === 0,
            `After Hire, Red flag, Promote, Stash gold and Hire again, the record shows ${describeFields(record, wrong)} instead of ${describeFields(expected, wrong)}. Make every button work first (see the objectives above), and have each update spread the CURRENT captain (not initialCaptain), so earlier changes are kept.`,
          );
          expectResetRestores(t, 'all those changes');
        }),
      ],
      concepts: [
        {
          id: 'isles-nested-spread',
          icon: '🪆',
          title: 'Nested updates',
          summary: 'Copy every object on the path from the top down to the changed field.',
          snippet: code`
            setCaptain({
              ...captain,
              ship: { ...captain.ship, crew: 13 },
            });
          `,
        },
        {
          id: 'isles-shallow-copy',
          icon: '🔗',
          title: 'Spread is shallow',
          summary: '{ ...obj } copies one level; nested objects are still shared by reference.',
          detail: 'const copy = { ...captain }; copy.ship.crew = 13 still mutates captain.ship. Mutation bugs like this often look fine on screen but corrupt earlier state.',
        },
      ],
      css: `
        .logbook { background: linear-gradient(#fef9c3, #ecfccb); border: 2px solid #d9f99d; border-radius: 18px; padding: 14px; }
        .captain { color: #365314; }
        .ship-name { margin: 0 0 6px; }
        .crew, .flag, .gold, .maps { margin: 2px 0; font-weight: 600; }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'isles-bottle-post',
      type: 'code',
      title: 'The Bottle Post',
      blurb: 'Arrays in state: add with spread, remove with filter, update with map.',
      xp: 140,
      story: [
        { text: 'Messages in bottles wash up on this beach all day long. The islanders keep them in a list — an array in state.', mood: 'happy' },
        { text: "Arrays are objects too, so the same rule applies: no push, no splice. Catch, open and toss bottles with brand-new arrays!", mood: 'excited' },
      ],
      lesson: md`
        ## Arrays are objects too

        Arrays in state are **read-only** as well. Methods like \`push\` change the existing
        array, so React gets the same array back and skips the render (\`Object.is\` again):

        \`\`\`jsx
        bottles.push(newBottle); // ❌ mutates the array in state
        setBottles(bottles);     // same array → no re-render
        \`\`\`

        Instead, make a **new array**. JavaScript has methods in both styles:

        | | ❌ mutates | ✅ returns a new array |
        |---|---|---|
        | adding | \`push\`, \`unshift\` | \`[...arr, item]\`, \`[item, ...arr]\` |
        | removing | \`pop\`, \`shift\`, \`splice\` | \`filter\`, \`slice\` |
        | replacing | \`arr[i] = x\`, \`splice\` | \`map\` |
        | sorting | \`sort\`, \`reverse\` | \`toSorted\`, \`toReversed\` |

        ## Adding: spread into a new array

        \`\`\`jsx
        let nextId = 4;

        function handleCatch() {
          setBottles([
            ...bottles, // all the old bottles
            { id: nextId++, from: 'Unknown sailor', text: 'Hi!', read: false }, // + one more
          ]);
        }
        \`\`\`

        Put the new item first (\`[newItem, ...bottles]\`) to add it at the start instead.
        \`nextId\` lives *outside* the component and counts up, so every new bottle gets a
        unique id for its \`key\`. (\`nextId++\` uses the current value, then increases it.)

        ## Removing: filter

        \`filter\` builds a new array with only the items for which your function returns \`true\`:

        \`\`\`jsx
        function handleToss(id) {
          setBottles(bottles.filter((b) => b.id !== id)); // keep all except this one
        }
        \`\`\`

        ## Updating one item: map

        \`map\` builds a new array of the same length. Return a **new object** for the item
        that changes, and the **same object** for all the others:

        \`\`\`jsx
        function handleOpen(id) {
          setBottles(bottles.map((b) => (b.id === id ? { ...b, read: true } : b)));
        }
        \`\`\`

        Writing \`b.read = true\` inside \`map\` would be a sneaky mutation: \`map\` makes a
        new *array*, but the objects inside are still the old ones. Spread the item, too.

        :::mistake
        \`setBottles(bottles.push(newBottle))\` is doubly wrong: \`push\` mutates, *and* it
        returns the new **length**, so your state becomes a number!
        :::

        :::tip
        Handlers can take arguments through an arrow function, just like the bells in the
        State Springs: \`onClick={() => handleToss(b.id)}\`.
        :::
      `,
      task: md`
        ## 🎯 Sort the bottle post

        1. **🎣 Catch a bottle** (\`className="catch"\`) adds \`{ id: nextId++, from: 'Unknown sailor', text: 'Is anyone out there?', read: false }\` at the **end** of the list. The starter uses \`push\`: replace it with a new array.
        2. **📜 Open** (\`className="open"\`) sets \`read: true\` on that bottle only. That reveals its message and gives its \`<li>\` the class \`read\`. Use \`map\` and a new object.
        3. **🌊 Toss back** (\`className="toss"\`) removes that bottle from the list. Use \`filter\`.
        4. Don't use \`push\`, \`unshift\`, \`splice\`, \`pop\` or \`shift\`, and don't assign to \`.read\`.
      `,
      starter: code`
        import { useState } from 'react';

        let nextId = 4;

        const initialBottles = [
          { id: 1, from: 'Nym the Bubbler', text: 'The springs say hi!', read: false },
          { id: 2, from: 'Captain Rhea', text: 'Never mutate the cargo.', read: false },
          { id: 3, from: 'A lonely crab', text: 'Does anyone else walk sideways?', read: false },
        ];

        export default function App() {
          const [bottles, setBottles] = useState(initialBottles);

          function handleCatch() {
            // 🐛 push changes the existing array: React sees the same array and skips the render
            bottles.push({ id: nextId++, from: 'Unknown sailor', text: 'Is anyone out there?', read: false });
            setBottles(bottles);
          }

          function handleOpen(id) {
            // TODO: set read: true on the bottle with this id (map + spread)
          }

          function handleToss(id) {
            // TODO: remove the bottle with this id (filter)
          }

          return (
            <div className="beach">
              <h2>🍾 Bottle post ({bottles.length})</h2>
              <button className="catch" onClick={handleCatch}>
                🎣 Catch a bottle
              </button>
              <ul className="bottles">
                {bottles.map((b) => (
                  <li key={b.id} className={b.read ? 'bottle read' : 'bottle'}>
                    <strong className="from">{b.from}</strong>
                    <span className="message">{b.read ? b.text : '(sealed)'}</span>
                    {!b.read && (
                      <button className="open" onClick={() => handleOpen(b.id)}>
                        📜 Open
                      </button>
                    )}
                    <button className="toss" onClick={() => handleToss(b.id)}>
                      🌊 Toss back
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        let nextId = 4;

        const initialBottles = [
          { id: 1, from: 'Nym the Bubbler', text: 'The springs say hi!', read: false },
          { id: 2, from: 'Captain Rhea', text: 'Never mutate the cargo.', read: false },
          { id: 3, from: 'A lonely crab', text: 'Does anyone else walk sideways?', read: false },
        ];

        export default function App() {
          const [bottles, setBottles] = useState(initialBottles);

          function handleCatch() {
            setBottles([
              ...bottles,
              { id: nextId++, from: 'Unknown sailor', text: 'Is anyone out there?', read: false },
            ]);
          }

          function handleOpen(id) {
            setBottles(bottles.map((b) => (b.id === id ? { ...b, read: true } : b)));
          }

          function handleToss(id) {
            setBottles(bottles.filter((b) => b.id !== id));
          }

          return (
            <div className="beach">
              <h2>🍾 Bottle post ({bottles.length})</h2>
              <button className="catch" onClick={handleCatch}>
                🎣 Catch a bottle
              </button>
              <ul className="bottles">
                {bottles.map((b) => (
                  <li key={b.id} className={b.read ? 'bottle read' : 'bottle'}>
                    <strong className="from">{b.from}</strong>
                    <span className="message">{b.read ? b.text : '(sealed)'}</span>
                    {!b.read && (
                      <button className="open" onClick={() => handleOpen(b.id)}>
                        📜 Open
                      </button>
                    )}
                    <button className="toss" onClick={() => handleToss(b.id)}>
                      🌊 Toss back
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
      `,
      hints: [
        md`Catching: \`setBottles([...bottles, { id: nextId++, from: 'Unknown sailor', text: 'Is anyone out there?', read: false }])\`. Delete the \`push\` line.`,
        md`Tossing keeps every bottle except one: \`setBottles(bottles.filter((b) => b.id !== id))\`.`,
        md`Opening replaces one bottle with an updated copy: \`setBottles(bottles.map((b) => (b.id === id ? { ...b, read: true } : b)))\`.`,
      ],
      tests: [
        test('🎣 Catching a bottle adds it to the end of the list', (t) => {
          t.render();
          t.expect(t.count('li.bottle') === 3, `Found ${t.count('li.bottle')} bottles at the start — expected 3.`);
          t.click('.catch');
          let items = t.$$('li.bottle');
          t.expect(
            items.length === 4,
            `After catching a bottle the list has ${items.length} bottles — expected 4. push() changes the existing array, so React sees the same array and skips the render. Create a new one: setBottles([...bottles, newBottle]).`,
          );
          t.expect(
            norm(items[3].querySelector('.from')?.textContent) === 'Unknown sailor',
            'The new bottle (from "Unknown sailor") should be added at the END of the list: [...bottles, newBottle].',
          );
          t.click('.catch');
          items = t.$$('li.bottle');
          t.expect(items.length === 5, `After catching two bottles the list has ${items.length} bottles — expected 5.`);
        }),
        test('📜 Opening a bottle reveals only its message', (t) => {
          t.render();
          t.click(t.$$('li.bottle')[1].querySelector('.open'));
          const items = t.$$('li.bottle');
          const message = norm(items[1].querySelector('.message')?.textContent);
          t.expect(
            message === 'Never mutate the cargo.',
            `After opening Captain Rhea's bottle its message reads "${message}" — expected "Never mutate the cargo.". In handleOpen, use map and return { ...b, read: true } for the bottle with that id.`,
          );
          t.expect(
            items[1].classList.contains('read'),
            'The opened bottle\'s <li> should have the class "read" (the starter adds it whenever b.read is true, so set read: true in the new object).',
          );
          const others = [items[0], items[2]].map((li) => norm(li.querySelector('.message')?.textContent));
          t.expect(
            others.every((m) => m === '(sealed)'),
            `Only the clicked bottle should open, but the others show ${others.map((m) => `"${m}"`).join(' and ')}. Return the unchanged bottle (b) for every other id.`,
          );
        }),
        test('🌊 Tossing a bottle removes exactly that one', (t) => {
          t.render();
          t.click(t.$$('li.bottle')[1].querySelector('.toss'));
          const names = t.$$('li.bottle .from').map((el) => norm(el.textContent));
          t.expect(
            names.join(' | ') === 'Nym the Bubbler | A lonely crab',
            `After tossing Captain Rhea's bottle the list shows: ${names.join(', ') || 'nothing'}. Use filter to keep every bottle except that id: bottles.filter((b) => b.id !== id).`,
          );
        }),
        test('Every change makes a new array (no push, splice or assignments)', (t) => {
          t.render();
          t.click('.catch');
          let items = t.$$('li.bottle');
          t.click(items[items.length - 1].querySelector('.open'));
          t.click(t.$$('li.bottle')[0].querySelector('.toss'));
          items = t.$$('li.bottle');
          const names = items.map((li) => norm(li.querySelector('.from')?.textContent));
          t.expect(
            names.join(' | ') === 'Captain Rhea | A lonely crab | Unknown sailor',
            `Catch, open the new bottle, toss the first: expected Captain Rhea, A lonely crab, Unknown sailor — got ${names.join(', ')}.`,
          );
          t.expect(
            norm(items[2].querySelector('.message')?.textContent) === 'Is anyone out there?',
            "The caught bottle should stay open after another bottle is tossed.",
          );
          t.sourceExcludes(
            /\.(push|unshift|splice|pop|shift)\s*\(/,
            'Your code still uses a mutating array method (push, unshift, splice, pop or shift). Use spread, filter and map to make new arrays instead.',
          );
          t.sourceExcludes(/\b\w+\.read\s*=(?!=)/, "Don't assign to .read — return a new object from map instead: { ...b, read: true }.");
        }),
      ],
      concepts: [
        {
          id: 'isles-array-updates',
          icon: '🧺',
          title: 'Updating arrays in state',
          summary: 'Add with [...arr, x], remove with filter, update with map: always a new array.',
          snippet: code`
            setItems([...items, newItem]);
            setItems(items.filter((it) => it.id !== id));
            setItems(items.map((it) => (it.id === id ? { ...it, done: true } : it)));
          `,
          detail: 'push, unshift, splice, pop, shift, sort and reverse mutate the original array. Avoid them on state.',
        },
      ],
      css: `
        .beach { background: linear-gradient(#e0f2fe, #fef9c3); border-radius: 18px; padding: 14px; border: 2px solid #bae6fd; }
        .bottles { list-style: none; padding: 0; }
        .bottle { background: white; border: 2px solid #bae6fd; border-radius: 12px; padding: 8px 10px; margin: 6px 0; }
        .bottle.read { border-color: #86efac; background: #f0fdf4; }
        .from { display: block; }
        .message { font-style: italic; color: #475569; margin-right: 6px; }
        .catch { background: #0891b2; box-shadow: 0 3px 0 #155e75; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'isles-tide-charts',
      type: 'code',
      title: 'The Tide Charts',
      blurb: 'Insert in the middle, sort and reverse — without scrambling the original.',
      xp: 150,
      story: [
        { text: "The tide-keeper ranks her beaches by how many turtles nest there. But Push keeps sorting her chart IN PLACE, and the original order is lost forever.", mood: 'worried' },
        { text: 'Insert, sort and reverse — all without touching the original array. The islanders call it "carving a new stone".', mood: 'happy' },
      ],
      lesson: md`
        ## Inserting in the middle

        \`[...arr, item]\` adds at the end and \`[item, ...arr]\` at the start. For any other
        position, combine **\`slice\`** with spread. \`slice(start, end)\` returns a *copy* of a
        part of the array, and never mutates it (unlike its cousin \`splice\`!):

        \`\`\`jsx
        const index = 1; // insert in second place
        setBeaches([
          ...beaches.slice(0, index), // the items before the index
          newBeach,                   // the new item
          ...beaches.slice(index),    // the items from the index on
        ]);
        \`\`\`

        \`slice(0, 1)\` means "from item 0 up to (not including) item 1", and \`slice(1)\` means
        "from item 1 to the end".

        ## Replacing an item

        To swap one item for another, use \`map\`: return the replacement for the matching
        item, and the original everywhere else:

        \`\`\`jsx
        setBeaches(beaches.map((b) => (b.id === 'drift' ? stormBeach : b)));
        \`\`\`

        ## Sorting and reversing

        \`sort()\` and \`reverse()\` rearrange an array **in place**, and return that same
        array. Two safe alternatives:

        \`\`\`jsx
        // 1. The copying methods of modern JavaScript
        setBeaches(beaches.toSorted((a, b) => b.turtles - a.turtles));
        setBeaches(beaches.toReversed());

        // 2. Copy first, then sort the copy
        const copy = [...beaches];
        copy.sort((a, b) => b.turtles - a.turtles);
        setBeaches(copy);
        \`\`\`

        The compare function decides the order: return a **negative** number to put \`a\`
        first, a **positive** one to put \`b\` first. So \`b.turtles - a.turtles\` means "most
        turtles first", \`a.turtles - b.turtles\` means "fewest first", and
        \`a.name.localeCompare(b.name)\` sorts alphabetically.

        ## Copies are shallow

        \`[...beaches]\` is a new array, but the beach **objects** inside are shared with
        the old one. Rearranging the copy's slots is safe. Changing \`copy[0].turtles = 99\`
        is not: that object also lives in the previous state. Update items with \`map\` and spread.

        :::mistake
        \`setBeaches(beaches.sort(...))\` hands React the array it already has (\`sort\`
        returns it), so nothing re-renders... while your original data got scrambled.
        :::

        :::tip
        Keeping an untouched original pays off: a "Reset" is just \`setBeaches(initialBeaches)\`
        — as long as nobody ever sorted \`initialBeaches\` itself.
        :::
      `,
      task: md`
        ## 🎯 Redraw the tide chart

        The chart lists each \`<li className="beach">\` in order. Keep the button labels as they are.

        1. **🐢 Most turtles first** sorts by \`turtles\`, highest first: Palm Bay (9), Shell Beach (4), Driftwood Point (2). The starter sorts *in place*; fix it with \`toSorted\` (or sort a copy).
        2. **🔃 Reverse** reverses the **current** order without mutating (\`toReversed\` or a copy).
        3. **➕ Add Coral Cove** inserts \`coralCove\` at index **1** (second place) of the current chart, using \`slice\` and spread. The button already disables itself once the cove is on the chart.
        4. **↺ Original order** puts \`initialBeaches\` back. It must show Shell Beach, Palm Bay, Driftwood Point again, which only works if nothing ever rearranged \`initialBeaches\` itself.
      `,
      starter: code`
        import { useState } from 'react';

        const initialBeaches = [
          { id: 'shell', name: 'Shell Beach', turtles: 4 },
          { id: 'palm', name: 'Palm Bay', turtles: 9 },
          { id: 'drift', name: 'Driftwood Point', turtles: 2 },
        ];

        const coralCove = { id: 'coral', name: 'Coral Cove', turtles: 7 };

        export default function App() {
          const [beaches, setBeaches] = useState(initialBeaches);
          const hasCoral = beaches.some((b) => b.id === 'coral'); // true if any beach is Coral Cove

          function handleSort() {
            // 🐛 sort() rearranges the array IN PLACE and returns that same array
            setBeaches(beaches.sort((a, b) => b.turtles - a.turtles));
          }

          function handleReverse() {
            // TODO: reverse a copy
          }

          function handleAddCoral() {
            // TODO: insert coralCove at index 1 with slice + spread
          }

          return (
            <div className="chart">
              <h2>🌊 Tide chart</h2>
              <ol className="beaches">
                {beaches.map((b) => (
                  <li key={b.id} className="beach">
                    <span className="name">{b.name}</span> <span className="turtles">{b.turtles} 🐢</span>
                  </li>
                ))}
              </ol>
              <button onClick={handleSort}>🐢 Most turtles first</button>
              <button onClick={handleReverse}>🔃 Reverse</button>
              <button onClick={handleAddCoral} disabled={hasCoral}>
                ➕ Add Coral Cove
              </button>
              <button onClick={() => setBeaches(initialBeaches)}>↺ Original order</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const initialBeaches = [
          { id: 'shell', name: 'Shell Beach', turtles: 4 },
          { id: 'palm', name: 'Palm Bay', turtles: 9 },
          { id: 'drift', name: 'Driftwood Point', turtles: 2 },
        ];

        const coralCove = { id: 'coral', name: 'Coral Cove', turtles: 7 };

        export default function App() {
          const [beaches, setBeaches] = useState(initialBeaches);
          const hasCoral = beaches.some((b) => b.id === 'coral'); // true if any beach is Coral Cove

          function handleSort() {
            setBeaches(beaches.toSorted((a, b) => b.turtles - a.turtles));
          }

          function handleReverse() {
            setBeaches(beaches.toReversed());
          }

          function handleAddCoral() {
            setBeaches([...beaches.slice(0, 1), coralCove, ...beaches.slice(1)]);
          }

          return (
            <div className="chart">
              <h2>🌊 Tide chart</h2>
              <ol className="beaches">
                {beaches.map((b) => (
                  <li key={b.id} className="beach">
                    <span className="name">{b.name}</span> <span className="turtles">{b.turtles} 🐢</span>
                  </li>
                ))}
              </ol>
              <button onClick={handleSort}>🐢 Most turtles first</button>
              <button onClick={handleReverse}>🔃 Reverse</button>
              <button onClick={handleAddCoral} disabled={hasCoral}>
                ➕ Add Coral Cove
              </button>
              <button onClick={() => setBeaches(initialBeaches)}>↺ Original order</button>
            </div>
          );
        }
      `,
      hints: [
        md`\`toSorted\` takes the same compare function as \`sort\`, but returns a new array: \`setBeaches(beaches.toSorted((a, b) => b.turtles - a.turtles))\`.`,
        md`Reversing: \`setBeaches(beaches.toReversed())\` (or \`[...beaches].reverse()\` — reversing a fresh copy is fine).`,
        md`Inserting at index 1: \`setBeaches([...beaches.slice(0, 1), coralCove, ...beaches.slice(1)])\`.`,
      ],
      tests: [
        test('🐢 Most turtles first: Palm Bay, Shell Beach, Driftwood Point', (t) => {
          t.render();
          t.click(t.button('Most turtles'));
          const order = beachOrder(t);
          t.expect(
            order === 'Palm Bay > Shell Beach > Driftwood Point',
            order === ORIGINAL_ORDER
              ? 'Nothing moved: sort() sorts the array in place and returns the SAME array, so React skips the render. Use beaches.toSorted((a, b) => b.turtles - a.turtles).'
              : `After sorting, the chart reads ${order} — expected Palm Bay > Shell Beach > Driftwood Point (9, 4, 2 turtles). Compare with (a, b) => b.turtles - a.turtles.`,
          );
        }),
        test('🔃 Reverse flips the current order', (t) => {
          t.render();
          t.click(t.button('Reverse'));
          let order = beachOrder(t);
          t.expect(
            order === 'Driftwood Point > Palm Bay > Shell Beach',
            order === ORIGINAL_ORDER
              ? 'Nothing moved. Fill in handleReverse with a reversed copy: setBeaches(beaches.toReversed()).'
              : `After reversing, the chart reads ${order} — expected Driftwood Point > Palm Bay > Shell Beach.`,
          );
          t.click(t.button('Reverse'));
          order = beachOrder(t);
          t.expect(order === ORIGINAL_ORDER, `Reversing twice should give the starting order back, but the chart reads ${order}. Reverse the CURRENT beaches, not initialBeaches.`);
        }),
        test('➕ Coral Cove lands in second place', (t) => {
          t.render();
          t.click(t.button('Coral'));
          const order = beachOrder(t);
          t.expect(
            order === 'Shell Beach > Coral Cove > Palm Bay > Driftwood Point',
            `After adding Coral Cove the chart reads ${order} — expected Shell Beach > Coral Cove > Palm Bay > Driftwood Point. Use [...beaches.slice(0, 1), coralCove, ...beaches.slice(1)].`,
          );
          t.expect(t.button('Coral').disabled, 'Once Coral Cove is on the chart, its button should be disabled (keep disabled={hasCoral}).');
        }),
        test('↺ Original order restores the starting chart (nothing was mutated)', (t) => {
          t.render();
          t.click(t.button('Most turtles'));
          let order = beachOrder(t);
          t.expect(order !== ORIGINAL_ORDER, 'First make 🐢 Most turtles first work: this check needs a changed chart to restore.');
          t.click(t.button('Original'));
          order = beachOrder(t);
          t.expect(
            order === ORIGINAL_ORDER,
            `After sorting, ↺ Original order shows ${order}. The starting chart got scrambled: sort() rearranged initialBeaches itself! Sort a copy: beaches.toSorted(...) or [...beaches].sort(...).`,
          );
          t.click(t.button('Reverse'));
          t.click(t.button('Original'));
          order = beachOrder(t);
          t.expect(
            order === ORIGINAL_ORDER,
            `After reversing, ↺ Original order shows ${order}: reverse() flipped initialBeaches itself. Use beaches.toReversed() or [...beaches].reverse().`,
          );
          t.click(t.button('Most turtles'));
          t.click(t.button('Coral'));
          order = beachOrder(t);
          t.expect(
            order === 'Palm Bay > Coral Cove > Shell Beach > Driftwood Point',
            `Sorted, then Coral Cove added: expected Palm Bay > Coral Cove > Shell Beach > Driftwood Point, got ${order}. Insert into the CURRENT beaches, not initialBeaches.`,
          );
          t.click(t.button('Original'));
          order = beachOrder(t);
          t.expect(order === ORIGINAL_ORDER, `After inserting, ↺ Original order shows ${order}. Use slice and spread; splice() would change the array in place.`);
        }),
      ],
      concepts: [
        {
          id: 'isles-insert-slice',
          icon: '✂️',
          title: 'Insert with slice',
          summary: 'Spread the slices around the new item to insert it anywhere without mutating.',
          snippet: code`
            [...arr.slice(0, i), item, ...arr.slice(i)]
          `,
          detail: 'slice copies a part of an array; splice (with a p) changes the array in place.',
        },
        {
          id: 'isles-sorted-copy',
          icon: '🔀',
          title: 'Sort and reverse copies',
          summary: 'toSorted / toReversed (or [...arr].sort()) leave the original array untouched.',
          snippet: code`
            const fastest = ships.toSorted((a, b) => b.speed - a.speed);
            const flipped = ships.toReversed();
          `,
        },
      ],
      css: `
        .chart { background: linear-gradient(#ecfeff, #f0fdfa); border: 2px solid #99f6e4; border-radius: 18px; padding: 14px; }
        .beaches { padding-left: 1.8em; }
        .beach { background: white; border-radius: 10px; padding: 6px 10px; margin: 5px 0; }
        .turtles { float: right; color: #0f766e; font-weight: 700; }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'isles-cartographer',
      type: 'bug',
      title: "The Cartographer's Dilemma",
      blurb: 'Bug hunt! Duplicated and redundant state make the map lie. Derive, don\'t store.',
      xp: 150,
      story: [
        { text: "The cartographer's map is lying! The list says Skull Key holds 6 treasures, the details panel says 5, and the total is just... wrong.", mood: 'worried' },
        { text: 'When the same fact lives in two places, the copies drift apart. The cure: keep each fact in ONE place, and calculate everything else while rendering.', mood: 'thinking' },
      ],
      lesson: md`
        ## Choosing the state structure

        Two components can show exactly the same screen, yet one is easy to change and the
        other is full of bugs. The difference is often **what you put in state**. A few principles:

        1. **Don't store what you can calculate** (no *redundant* state).
        2. **Don't store the same data twice** (no *duplicated* state: store ids, not copies).
        3. **Group values that always change together**, e.g. \`x\` and \`y\` in one \`position\` object.
        4. **Avoid contradictions**: instead of \`isSending\` and \`isSent\` (both \`true\`?!), use one \`status\`.
        5. **Avoid deep nesting** when a flatter shape works.

        The cartographer's map breaks rules 1 and 2.

        ## Redundant state: calculate it during render

        \`\`\`jsx
        // ❌ total must be kept in sync by hand, in every handler
        const [islands, setIslands] = useState(initialIslands);
        const [total, setTotal] = useState(7);
        \`\`\`

        Every handler that changes \`islands\` must remember to fix \`total\`. Forget it once,
        and the screen lies. Instead, **derive** it: compute it in the component body.

        \`\`\`jsx
        const total = islands.reduce((sum, island) => sum + island.treasure, 0);
        \`\`\`

        \`reduce\` walks through the array, carrying a running \`sum\` that starts at \`0\`.
        A plain loop works just as well:

        \`\`\`jsx
        let total = 0;
        for (const island of islands) {
          total += island.treasure;
        }
        \`\`\`

        (Changing \`total\` here is fine: it's a fresh local variable created during this
        render, not state.) Because it's recalculated on every render, it can **never** be stale.

        ## Duplicated state: store the id

        \`\`\`jsx
        // ❌ a COPY of an island: it won't see later changes to the array
        const [selected, setSelected] = useState(initialIslands[0]);
        \`\`\`

        When you dig on that island, \`islands\` gets a new, updated object, but \`selected\`
        still holds the old one. Remember **which** island is selected instead:

        \`\`\`jsx
        const [selectedId, setSelectedId] = useState('turtle');
        const selected = islands.find((island) => island.id === selectedId);
        \`\`\`

        Now \`selected\` is looked up in the latest \`islands\` on every render. And if that
        island is removed, \`find\` returns \`undefined\`, so a fallback appears by itself:

        \`\`\`jsx
        {selected ? <h3>{selected.name}</h3> : <p>No island selected</p>}
        \`\`\`

        :::tip
        Before adding a state variable, ask: *"Could I calculate this from props or the state
        I already have?"* If the answer is yes, it isn't state.
        :::

        :::mistake
        Copying a prop into state: \`const [color, setColor] = useState(props.color)\`. The state
        ignores every later change of the prop. Use the prop directly instead.
        :::
      `,
      task: md`
        ## 🐛 Fix the lying map

        Keep the buttons and classNames as they are. Two structural bugs to fix:

        1. \`selected\` stores a **copy** of an island, so the \`.details\` panel goes stale after digging. Replace it with \`selectedId\` state (starting at \`'turtle'\`) and find the selected island during render. **🔍 Inspect** sets the id.
        2. \`total\` is **redundant** state, and abandoning an island forgets to update it. Delete that state and calculate \`total\` from \`islands\` during render, so \`<p className="total">\` always shows the real sum, e.g. **Total treasure: 7**.
        3. When the selected island is abandoned, the \`.details\` panel must show **No island selected** (the fallback is already in the starter).
        4. In the end, the component has exactly **two** state variables: \`islands\` and \`selectedId\`.
      `,
      starter: code`
        import { useState } from 'react';

        const initialIslands = [
          { id: 'turtle', name: 'Turtle Rock', treasure: 2 },
          { id: 'mango', name: 'Mango Atoll', treasure: 0 },
          { id: 'skull', name: 'Skull Key', treasure: 5 },
        ];

        export default function App() {
          const [islands, setIslands] = useState(initialIslands);
          // 🐛 a COPY of an island: it won't follow changes made to the array
          const [selected, setSelected] = useState(initialIslands[0]);
          // 🐛 redundant: this can be calculated from islands
          const [total, setTotal] = useState(7);

          function handleDig(id) {
            setIslands(
              islands.map((island) =>
                island.id === id ? { ...island, treasure: island.treasure + 1 } : island,
              ),
            );
            setTotal(total + 1);
          }

          function handleAbandon(id) {
            setIslands(islands.filter((island) => island.id !== id));
          }

          return (
            <div className="atlas">
              <h2>🗺️ The Cartographer's Map</h2>
              <p className="total">Total treasure: {total}</p>
              <ul className="islands">
                {islands.map((island) => (
                  <li key={island.id} className="island">
                    <strong>{island.name}</strong> · 💰 {island.treasure}
                    <div>
                      <button className="inspect" onClick={() => setSelected(island)}>
                        🔍 Inspect
                      </button>
                      <button className="dig" onClick={() => handleDig(island.id)}>
                        ⛏️ Dig
                      </button>
                      <button className="abandon" onClick={() => handleAbandon(island.id)}>
                        🗑️ Abandon
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="details card">
                {selected ? (
                  <>
                    <h3>{selected.name}</h3>
                    <p>Treasure: {selected.treasure}</p>
                  </>
                ) : (
                  <p>No island selected</p>
                )}
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const initialIslands = [
          { id: 'turtle', name: 'Turtle Rock', treasure: 2 },
          { id: 'mango', name: 'Mango Atoll', treasure: 0 },
          { id: 'skull', name: 'Skull Key', treasure: 5 },
        ];

        export default function App() {
          const [islands, setIslands] = useState(initialIslands);
          const [selectedId, setSelectedId] = useState('turtle');

          const selected = islands.find((island) => island.id === selectedId);
          const total = islands.reduce((sum, island) => sum + island.treasure, 0);

          function handleDig(id) {
            setIslands(
              islands.map((island) =>
                island.id === id ? { ...island, treasure: island.treasure + 1 } : island,
              ),
            );
          }

          function handleAbandon(id) {
            setIslands(islands.filter((island) => island.id !== id));
          }

          return (
            <div className="atlas">
              <h2>🗺️ The Cartographer's Map</h2>
              <p className="total">Total treasure: {total}</p>
              <ul className="islands">
                {islands.map((island) => (
                  <li key={island.id} className="island">
                    <strong>{island.name}</strong> · 💰 {island.treasure}
                    <div>
                      <button className="inspect" onClick={() => setSelectedId(island.id)}>
                        🔍 Inspect
                      </button>
                      <button className="dig" onClick={() => handleDig(island.id)}>
                        ⛏️ Dig
                      </button>
                      <button className="abandon" onClick={() => handleAbandon(island.id)}>
                        🗑️ Abandon
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="details card">
                {selected ? (
                  <>
                    <h3>{selected.name}</h3>
                    <p>Treasure: {selected.treasure}</p>
                  </>
                ) : (
                  <p>No island selected</p>
                )}
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`Replace the copy with an id: \`const [selectedId, setSelectedId] = useState('turtle');\`, and make Inspect call \`setSelectedId(island.id)\`.`,
        md`Right below your state, look the island up: \`const selected = islands.find((island) => island.id === selectedId);\`. The JSX that uses \`selected\` can stay the same.`,
        md`Delete the \`total\` state and the \`setTotal\` call, and calculate it instead: \`const total = islands.reduce((sum, island) => sum + island.treasure, 0);\`.`,
      ],
      tests: [
        test("⛏️ Digging updates the inspected island's details", (t) => {
          t.render();
          t.click(t.$$('li.island')[2].querySelector('.inspect'));
          let details = detailsText(t);
          t.expect(
            details.includes('Skull Key') && details.includes('Treasure: 5'),
            `After inspecting Skull Key the details panel shows "${details}" — expected Skull Key with "Treasure: 5".`,
          );
          t.click(t.$$('li.island')[2].querySelector('.dig'));
          details = detailsText(t);
          t.expect(
            details.includes('Treasure: 6'),
            `After digging on Skull Key the list says 6, but the details panel still shows "${details}". The panel shows a stale COPY of the island. Store selectedId and look the island up during render: islands.find((island) => island.id === selectedId).`,
          );
        }),
        test('The total always matches the islands', (t) => {
          t.render();
          let total = textOf(t, '.total');
          t.expect(total === 'Total treasure: 7', `At the start .total reads "${total}" — expected "Total treasure: 7".`);
          t.click(t.$$('li.island')[1].querySelector('.dig'));
          total = textOf(t, '.total');
          t.expect(total === 'Total treasure: 8', `After digging on Mango Atoll .total reads "${total}" — expected "Total treasure: 8".`);
          t.click(t.$$('li.island')[2].querySelector('.abandon'));
          total = textOf(t, '.total');
          t.expect(
            total === 'Total treasure: 3',
            `After abandoning Skull Key the islands hold 3 treasure, but .total reads "${total}". Don't keep the total in state: calculate it from islands during render, e.g. islands.reduce((sum, island) => sum + island.treasure, 0).`,
          );
        }),
        test('Abandoning the selected island clears the details', (t) => {
          t.render();
          const details = detailsText(t);
          t.expect(details.includes('Turtle Rock'), `At the start the details panel should show Turtle Rock, but it shows "${details}". Start selectedId at 'turtle'.`);
          t.click(t.$$('li.island')[0].querySelector('.abandon'));
          const after = detailsText(t);
          t.expect(
            after === 'No island selected',
            `Turtle Rock was abandoned, but the details panel still shows "${after}". With selectedId, islands.find(...) returns undefined for a removed island, and the "No island selected" fallback appears by itself.`,
          );
        }),
        test('Only two pieces of state: islands and selectedId', (t) => {
          const calls = (t.source.match(/useState\s*\(/g) || []).length;
          t.expect(
            calls === 2,
            `Found ${calls} useState(...) calls — the map needs exactly two: islands and selectedId. The selected island and the total are calculated during render.`,
          );
          t.sourceExcludes(/useState\(\s*initialIslands\s*\[\s*\d+\s*\]\s*\)/, "Don't put a copy of an island into state. Store its id instead: useState('turtle').");
          t.sourceIncludes(/\bselectedId\b/, 'Name the new state variable selectedId, as the task asks.');
        }),
      ],
      concepts: [
        {
          id: 'isles-derived-state',
          icon: '🧮',
          title: "Derive, don't store",
          summary: 'If you can calculate it from props or state, compute it during render instead of storing it.',
          snippet: code`
            const total = islands.reduce((sum, i) => sum + i.treasure, 0);
            const visited = islands.filter((i) => i.visited).length;
          `,
        },
        {
          id: 'isles-store-ids',
          icon: '🆔',
          title: 'Store ids, not copies',
          summary: 'Keep selectedId in state and look the item up; a copied object goes stale.',
          snippet: code`
            const [selectedId, setSelectedId] = useState('turtle');
            const selected = islands.find((i) => i.id === selectedId);
          `,
        },
        {
          id: 'isles-state-structure',
          icon: '🏗️',
          title: 'Choosing state structure',
          summary: 'Group related state; avoid contradictions, redundancy, duplication and deep nesting.',
          detail: 'Make your state as simple as it can be, but no simpler. Fewer moving parts means fewer ways for the screen to lie.',
        },
      ],
      css: `
        .atlas { background: linear-gradient(#fef3c7, #fde68a); border: 3px double #b45309; border-radius: 16px; padding: 14px; color: #451a03; }
        .atlas h2, .atlas h3 { color: #451a03; }
        .total { font-weight: 800; }
        .islands { list-style: none; padding: 0; }
        .island { background: rgba(255, 255, 255, 0.7); border-radius: 10px; padding: 6px 10px; margin: 6px 0; }
        .island button { font-size: 0.85em; padding: 4px 9px; background: #b45309; box-shadow: 0 2px 0 #78350f; }
        .details { background: #fffbeb; }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'isles-trial',
      type: 'quiz',
      title: 'Trial of the Stone Heads',
      blurb: 'The stone heads have watched every mutation for a thousand years. Eight questions.',
      xp: 100,
      story: [
        { text: 'The giant stone heads guard the path to Push. They never change — and they expect you to respect that. Eight questions, and every answer explains itself.', mood: 'thinking' },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**. Remember the island rule: *never change it, carve a new one.*`,
      questions: [
        q(
          "Why doesn't the screen update?\n\n```jsx\nfunction handleHeal() {\n  hero.hp = 100;\n  setHero(hero);\n}\n```",
          [
            '`hp` must be a string',
            'Setters only accept numbers',
            '`setHero` receives the same object, so `Object.is` says nothing changed and React skips the render',
            'You cannot call a setter inside an event handler',
          ],
          2,
          'React compares the old and new state with `Object.is`. For objects that means "is it the very same object?" You mutated it and passed it back, so React sees no change. Create a new object: `setHero({ ...hero, hp: 100 })`.',
        ),
        q(
          "`hero` is `{ name: 'Ada', hp: 40, mp: 12 }`. Which update sets `hp` to `100` and keeps everything else?",
          ['`setHero({ hp: 100 })`', '`setHero({ ...hero, hp: 100 })`', '`setHero({ hp: 100, ...hero })`', '`setHero(hero.hp = 100)`'],
          1,
          'Spread copies every field first, then `hp: 100` overrides one. In `{ hp: 100, ...hero }` the spread comes last and overwrites your `hp` with the old `40`. `{ hp: 100 }` alone loses `name` and `mp`. And the last option mutates.',
        ),
        q(
          "`user` is `{ name: 'Kai', home: { island: 'Mango', hut: 3 } }`. Which update moves Kai to hut 4 correctly?",
          [
            '`setUser({ ...user, hut: 4 })`',
            '`setUser({ ...user.home, hut: 4 })`',
            '`user.home.hut = 4; setUser({ ...user })`',
            '`setUser({ ...user, home: { ...user.home, hut: 4 } })`',
          ],
          3,
          'Copy every object on the path to the change: a new `home` (spread from `user.home`) inside a new user (spread from `user`). The third option *looks* like it works, because `{ ...user }` is a new object, but it mutated the shared `home` object and corrupted the previous state.',
        ),
        q(
          'Which call removes the island with `id === 3` from the `islands` state?',
          [
            '`setIslands(islands.filter((i) => i.id !== 3))`',
            '`setIslands(islands.splice(2, 1))`',
            '`islands.pop(); setIslands(islands)`',
            '`setIslands(islands.filter((i) => i.id === 3))`',
          ],
          0,
          '`filter` returns a **new** array with the items for which the callback returns `true`, so keep everything whose id is *not* 3. `splice` and `pop` mutate (and `splice` returns the *removed* items!). The last option keeps only island 3.',
        ),
        q(
          'Which of these does NOT mutate the array it is called on?',
          ['`arr.sort()`', '`arr.reverse()`', '`arr.toSorted()`', '`arr.splice(1, 1)`'],
          2,
          '`toSorted()` (like `toReversed()`) returns a sorted **copy**. `sort`, `reverse` and `splice` change the original array in place. Another option: copy first, then sort the copy: `[...arr].sort()`.',
        ),
        q(
          'How do you insert `x` at index 2 without mutating `arr`?',
          ['`arr.splice(2, 0, x)`', '`[...arr.slice(0, 2), x, ...arr.slice(2)]`', '`[x, ...arr]`', '`arr[2] = x`'],
          1,
          '`slice` returns copies of parts of the array and never mutates (unlike `splice`). Spread the items before index 2, then `x`, then the rest. `[x, ...arr]` would insert at the very start.',
        ),
        q(
          'A shopping cart keeps both of these in state. What is the problem?\n\n```jsx\nconst [items, setItems] = useState(initialItems);\nconst [total, setTotal] = useState(0);\n```',
          [
            'Nothing — more state is always safer',
            'A component can only call `useState` once',
            '`total` should be stored in a global variable instead',
            '`total` is redundant: calculate it from `items` during render, so it can never get out of sync',
          ],
          3,
          'If a value can be calculated from props or other state, don\'t store it. Every handler would have to remember to update `total`, and one forgotten `setTotal` makes the screen lie. Computing it during render keeps it correct for free.',
        ),
        q(
          'A list lets you pick a ship to show its details. Which state is best?',
          [
            '`const [selectedId, setSelectedId] = useState(ships[0].id)`, then find the ship during render',
            '`const [selectedShip, setSelectedShip] = useState(ships[0])`',
            'Both `selectedId` and `selectedShip`, just to be safe',
            'A `selected: true` field on every ship, plus `selectedShip`',
          ],
          0,
          "A copy of the ship duplicates data that already lives in `ships`. When the ship changes in the array, the copy goes stale. Store the id and look it up: `ships.find((s) => s.id === selectedId)`.",
        ),
      ],
      concepts: [
        {
          id: 'isles-immutable-mindset',
          icon: '🗿',
          title: 'The immutable mindset',
          summary: 'Never change state in place: make a new version with the change, and let React compare.',
          detail: 'Objects: spread. Arrays: spread, filter, map, slice, toSorted. Nested: copy every level on the path. Everything else: derive during render.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'isles-boss',
      type: 'build',
      boss: true,
      title: "Boss: Push, the Mutator's Lieutenant",
      bossName: 'Push',
      bossIcon: '😈',
      blurb: 'Push rewrites the past with every mutation. Build a fleet with a working Undo.',
      xp: 300,
      badge: {
        id: 'badge-isles',
        name: 'Keeper of the Past',
        icon: '🗿',
        description: "Defeated Push, the Mutator's lieutenant, on the Immutable Isles.",
      },
      story: [
        { text: "Here he comes: Push, the Mutator's lieutenant! He shoves things into arrays, sorts them in place, scribbles over objects...", mood: 'worried' },
        { text: "His nastiest trick: his mutations LOOK like they work. The screen updates! But every change secretly rewrites the past. Try the Undo button and you'll see.", mood: 'thinking' },
        { text: "Rewrite the fleet's actions so each one carves a brand-new array. Then the past stays safe, Undo works... and Push is powerless!", mood: 'excited' },
      ],
      lesson: md`
        ## Why immutability makes Undo easy

        If you never mutate, every old state stays exactly as it was. Keeping a history is
        then as simple as keeping an **array of versions**, and the current fleet is just
        the last one:

        \`\`\`jsx
        const [history, setHistory] = useState([initialFleet]);
        const fleet = history[history.length - 1]; // derived, not separate state!

        function commit(nextFleet) {
          setHistory([...history, nextFleet]); // add a new version
        }

        function handleUndo() {
          setHistory(history.slice(0, -1)); // drop the latest version
        }
        \`\`\`

        \`slice(0, -1)\` means "everything except the last item". The time-travel feature in
        React's official tic-tac-toe tutorial is built on this very idea.

        ## Push's trap

        Now look at what a mutation does to that history:

        \`\`\`jsx
        fleet.push(newShip); // changes the array that is ALSO the latest version in history
        commit(fleet);       // history = [A, A]: the "old" version IS the new one
        \`\`\`

        The screen even updates, because \`commit\` creates a new *history* array. Everything
        *looks* fine... until you press Undo and discover the past was rewritten. Mutation
        bugs love to hide like this.

        ## The toolkit

        | Change | Immutable way |
        |---|---|
        | add at the end | \`[...fleet, ship]\` |
        | remove one | \`fleet.filter((s) => s.id !== id)\` |
        | update one | \`fleet.map((s) => (s.id === id ? { ...s, damaged: false } : s))\` |
        | sort | \`fleet.toSorted((a, b) => b.speed - a.speed)\` |
        | count | \`fleet.filter((s) => s.damaged).length\` (derived during render) |

        Unchanged ships are **shared** between versions. That is safe, and cheap, precisely
        because nobody mutates them.

        :::warn
        Hunt down every mutation: \`push\`, \`splice\` and \`sort\` on the fleet, and any
        assignment like \`ship.damaged = false\`. Each one rewrites the past.
        :::

        :::tip
        After each fix, try the action and then **↶ Undo** in the preview. If Undo brings
        back the old fleet, that action is Push-proof.
        :::
      `,
      task: md`
        ## 👑 Defeat Push

        \`history\`, \`commit\` and **↶ Undo** already work. Push wrote the four fleet actions, and every one of them **mutates** — so Undo can never bring anything back. Rewrite each action so it passes a **new array** to \`commit\`:

        1. **⛵ Launch** adds \`{ id: nextId, name: 'Rowboat ' + nextId, speed: 2, damaged: false }\` at the **end** of the fleet (then \`nextId\` goes up by one). The first launch adds **Rowboat 4**.
        2. **🔧 Repair** sets \`damaged: false\` on that ship only (\`map\` and a new object).
        3. **🗑️ Scuttle** removes that ship (\`filter\`).
        4. **🏁 Fastest first** sorts by \`speed\`, highest first (\`toSorted\`).
        5. Replace \`const damagedCount = 0\` with a value **calculated during render**, so \`<p className="summary">\` reads e.g. **3 ships · 2 damaged**.

        After every action, **↶ Undo** must bring back the fleet exactly as it was.
      `,
      starter: code`
        import { useState } from 'react';

        let nextId = 4;

        const initialFleet = [
          { id: 1, name: 'The Pure Function', speed: 6, damaged: true },
          { id: 2, name: 'Spread Operator', speed: 9, damaged: false },
          { id: 3, name: 'Old Splice', speed: 3, damaged: true },
        ];

        export default function App() {
          const [history, setHistory] = useState([initialFleet]);
          const fleet = history[history.length - 1];

          function commit(nextFleet) {
            setHistory([...history, nextFleet]);
          }

          function handleUndo() {
            setHistory(history.slice(0, -1));
          }

          // 😈 Push wrote these four. Every single one mutates!
          function handleLaunch() {
            fleet.push({ id: nextId, name: 'Rowboat ' + nextId, speed: 2, damaged: false });
            nextId++;
            commit(fleet);
          }

          function handleRepair(id) {
            const ship = fleet.find((s) => s.id === id);
            ship.damaged = false;
            commit(fleet);
          }

          function handleScuttle(id) {
            const index = fleet.findIndex((s) => s.id === id);
            fleet.splice(index, 1);
            commit(fleet);
          }

          function handleSort() {
            fleet.sort((a, b) => b.speed - a.speed);
            commit(fleet);
          }

          // TODO: calculate the number of damaged ships during render
          const damagedCount = 0;

          return (
            <div className="harbor">
              <h2>⚓ The Fleet of Order</h2>
              <p className="taunt">😈 Push: "Mutations are faster! Who needs the past?"</p>
              <p className="summary">
                {fleet.length} ships · {damagedCount} damaged
              </p>
              <ul className="fleet">
                {fleet.map((ship) => (
                  <li key={ship.id} className={ship.damaged ? 'ship damaged' : 'ship'}>
                    <span className="name">{ship.name}</span>
                    <span className="speed">💨 {ship.speed}</span>
                    {ship.damaged && (
                      <button className="repair" onClick={() => handleRepair(ship.id)}>
                        🔧 Repair
                      </button>
                    )}
                    <button className="scuttle" onClick={() => handleScuttle(ship.id)}>
                      🗑️ Scuttle
                    </button>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button className="launch" onClick={handleLaunch}>
                  ⛵ Launch
                </button>
                <button className="sort" onClick={handleSort}>
                  🏁 Fastest first
                </button>
                <button className="undo" onClick={handleUndo} disabled={history.length === 1}>
                  ↶ Undo
                </button>
              </div>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        let nextId = 4;

        const initialFleet = [
          { id: 1, name: 'The Pure Function', speed: 6, damaged: true },
          { id: 2, name: 'Spread Operator', speed: 9, damaged: false },
          { id: 3, name: 'Old Splice', speed: 3, damaged: true },
        ];

        export default function App() {
          const [history, setHistory] = useState([initialFleet]);
          const fleet = history[history.length - 1];

          function commit(nextFleet) {
            setHistory([...history, nextFleet]);
          }

          function handleUndo() {
            setHistory(history.slice(0, -1));
          }

          function handleLaunch() {
            const ship = { id: nextId, name: 'Rowboat ' + nextId, speed: 2, damaged: false };
            nextId++;
            commit([...fleet, ship]);
          }

          function handleRepair(id) {
            commit(fleet.map((s) => (s.id === id ? { ...s, damaged: false } : s)));
          }

          function handleScuttle(id) {
            commit(fleet.filter((s) => s.id !== id));
          }

          function handleSort() {
            commit(fleet.toSorted((a, b) => b.speed - a.speed));
          }

          const damagedCount = fleet.filter((s) => s.damaged).length;

          return (
            <div className="harbor">
              <h2>⚓ The Fleet of Order</h2>
              <p className="taunt">😈 Push: "Mutations are faster! Who needs the past?"</p>
              <p className="summary">
                {fleet.length} ships · {damagedCount} damaged
              </p>
              <ul className="fleet">
                {fleet.map((ship) => (
                  <li key={ship.id} className={ship.damaged ? 'ship damaged' : 'ship'}>
                    <span className="name">{ship.name}</span>
                    <span className="speed">💨 {ship.speed}</span>
                    {ship.damaged && (
                      <button className="repair" onClick={() => handleRepair(ship.id)}>
                        🔧 Repair
                      </button>
                    )}
                    <button className="scuttle" onClick={() => handleScuttle(ship.id)}>
                      🗑️ Scuttle
                    </button>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <button className="launch" onClick={handleLaunch}>
                  ⛵ Launch
                </button>
                <button className="sort" onClick={handleSort}>
                  🏁 Fastest first
                </button>
                <button className="undo" onClick={handleUndo} disabled={history.length === 1}>
                  ↶ Undo
                </button>
              </div>
            </div>
          );
        }
      `,
      hints: [
        md`The count is derived: \`const damagedCount = fleet.filter((s) => s.damaged).length;\`. Then start with Launch: build the ship object, increase \`nextId\`, and \`commit([...fleet, ship])\`.`,
        md`Scuttle: \`commit(fleet.filter((s) => s.id !== id))\`. Fastest first: \`commit(fleet.toSorted((a, b) => b.speed - a.speed))\`.`,
        md`Repair needs a new array AND a new ship object: \`commit(fleet.map((s) => (s.id === id ? { ...s, damaged: false } : s)))\`.`,
      ],
      tests: [
        test('The fleet starts with 3 ships and a derived summary', (t) => {
          t.render();
          t.expect(t.count('li.ship') === 3, `Found ${t.count('li.ship')} ships at the start — expected 3.`);
          const summary = textOf(t, '.summary');
          t.expect(
            summary === '3 ships · 2 damaged',
            `The summary reads "${summary}" — expected "3 ships · 2 damaged". Count the damaged ships during render: fleet.filter((s) => s.damaged).length.`,
          );
          t.expect(t.find('.undo').disabled, 'Nothing has happened yet, so ↶ Undo should be disabled.');
        }),
        test('⛵ Launch adds "Rowboat 4" at the end, and ↶ Undo takes it back', (t) => {
          t.render();
          t.click('.launch');
          let names = fleetNames(t);
          t.expect(
            names.length === 4 && names[3] === 'Rowboat 4',
            names.length === 4 && /^Rowboat \d+$/.test(names[3])
              ? `The new ship is called "${names[3]}" — expected "Rowboat 4". Use nextId for both the id and the name ({ id: nextId, name: 'Rowboat ' + nextId, ... }), and only then increase it with nextId++.`
              : `After launching, the fleet is: ${names.join(', ')}. Expected 4 ships ending with "Rowboat 4": commit([...fleet, ship]).`,
          );
          t.click('.undo');
          names = fleetNames(t);
          t.expect(
            names.join(' > ') === START_FLEET,
            `After ↶ Undo the fleet is still ${names.join(', ')}. Push's push() changed the older version of the fleet too, so there is nothing to go back to. Create a new array: commit([...fleet, ship]).`,
          );
        }),
        test('🔧 Repair fixes one ship, and ↶ Undo brings the damage back', (t) => {
          t.render();
          t.click(t.$$('li.ship')[0].querySelector('.repair'));
          t.expect(!t.$$('li.ship')[0].classList.contains('damaged'), 'After repairing The Pure Function, its <li> should lose the "damaged" class.');
          t.expect(t.$$('li.ship')[2].classList.contains('damaged'), 'Repair should only fix the clicked ship: Old Splice is still damaged.');
          t.click('.undo');
          t.expect(
            t.$$('li.ship')[0].classList.contains('damaged'),
            "After ↶ Undo, The Pure Function should be damaged again, but it isn't. ship.damaged = false changed the ship object that the older version shares. Return a new object from map: { ...s, damaged: false }.",
          );
          const summary = textOf(t, '.summary');
          t.expect(summary === '3 ships · 2 damaged', `After ↶ Undo the summary reads "${summary}" — expected "3 ships · 2 damaged".`);
        }),
        test('🗑️ Scuttle removes one ship, and ↶ Undo restores it', (t) => {
          t.render();
          t.click(t.$$('li.ship')[1].querySelector('.scuttle'));
          let names = fleetNames(t);
          t.expect(
            names.join(' > ') === 'The Pure Function > Old Splice',
            `After scuttling Spread Operator the fleet is: ${names.join(', ')}. Expected The Pure Function, Old Splice: commit(fleet.filter((s) => s.id !== id)).`,
          );
          t.click('.undo');
          names = fleetNames(t);
          t.expect(
            names.join(' > ') === START_FLEET,
            `After ↶ Undo the fleet is ${names.join(', ')} — Spread Operator should be back in second place. splice() removed it from the older version too. Use filter instead.`,
          );
        }),
        test('🏁 Fastest first sorts by speed, and ↶ Undo restores the old order', (t) => {
          t.render();
          t.click('.sort');
          let names = fleetNames(t);
          t.expect(
            names.join(' > ') === 'Spread Operator > The Pure Function > Old Splice',
            `After sorting, the fleet is: ${names.join(', ')}. Expected Spread Operator (9), The Pure Function (6), Old Splice (3): fleet.toSorted((a, b) => b.speed - a.speed).`,
          );
          t.click('.undo');
          names = fleetNames(t);
          t.expect(
            names.join(' > ') === START_FLEET,
            `After ↶ Undo the order is still ${names.join(', ')}. sort() rearranged the older version in place! Use fleet.toSorted(...) instead.`,
          );
          t.expect(t.find('.undo').disabled, 'Back at the very first version, ↶ Undo should be disabled again.');
          t.sourceExcludes(
            /\bfleet\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/,
            'Some of Push\'s mutating calls are still in your code (fleet.push / splice / sort...). Replace every one of them with a new array.',
          );
        }),
      ],
      concepts: [
        {
          id: 'isles-undo-history',
          icon: '⏳',
          title: 'Immutability enables Undo',
          summary: 'Untouched old states can be kept in a history; undo is just showing an earlier version.',
          snippet: code`
            const [history, setHistory] = useState([initial]);
            const current = history[history.length - 1];
            const undo = () => setHistory(history.slice(0, -1));
          `,
          detail: 'Mutations make all versions point at the same changed data, which silently rewrites the past.',
        },
      ],
      css: `
        .harbor { background: linear-gradient(#cffafe, #e0f2fe); border: 2px solid #67e8f9; border-radius: 18px; padding: 14px; }
        .taunt { font-style: italic; color: #9f1239; }
        .summary { font-weight: 800; color: #155e75; }
        .fleet { list-style: none; padding: 0; }
        .ship { background: white; border: 2px solid #a5f3fc; border-radius: 12px; padding: 6px 10px; margin: 6px 0; }
        .ship.damaged { border-color: #fca5a5; background: #fef2f2; }
        .ship .name { font-weight: 700; margin-right: 8px; }
        .speed { color: #0e7490; margin-right: 8px; }
        .scuttle { background: #e11d48; box-shadow: 0 3px 0 #9f1239; }
        .actions { margin-top: 8px; }
      `,
    },
  ],
};
