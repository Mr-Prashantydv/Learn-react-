import { code, md, q, test } from '../helpers.js';

// ---------------------------------------------------------------------------
// Shared helpers for the Citadel's checks
// ---------------------------------------------------------------------------

/** Collapses whitespace so text comparisons are forgiving. */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Freezes an object/array and everything inside it, so any mutation throws. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Calls the player's reducer, turning crashes (like mutating frozen state) into friendly messages. */
function runReducer(t, reducer, name, state, action) {
  try {
    return reducer(state, action);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/read.only|not extensible|Cannot add property|Cannot assign|Cannot delete|frozen/i.test(msg)) {
      t.fail(
        `${name} tried to change the existing state while handling ${JSON.stringify(action)} ("${msg}"). ` +
          'The checks freeze the state, so push, splice or obj.x = ... all throw. Return NEW objects and arrays (spread, map, filter) instead.',
      );
    }
    t.fail(`${name} crashed while handling ${JSON.stringify(action)}: "${msg}". Look at that case of your switch.`);
  }
  return undefined;
}

/** Wraps `child` in a provider for `Ctx` (works for both <Ctx> and <Ctx.Provider>). */
function provide(t, Ctx, value, child) {
  return t.h(Ctx.Provider || Ctx, { value }, child);
}

/** The first element matching `selector` whose text contains `text`. */
function findByText(t, selector, text) {
  return t.$$(selector).find((el) => norm(el.textContent).includes(text)) || null;
}

/** How many of the player's console.log lines start with `prefix`. */
function countLogs(t, prefix) {
  return t.logLines().filter((line) => line.trim().startsWith(prefix)).length;
}

/** Forget every console line logged so far (so we can count what one action logs). */
function clearLogs(t) {
  t.logs.length = 0;
}

const list = (items) => (items.length ? items.map((s) => `"${s}"`).join(' and ') : 'nothing');

/** useFetch checks: make sure fetch ran exactly `expected` times so far. */
function expectFetchCount(t, expected, when) {
  const n = t.fetchCalls.length;
  t.expect(
    n === expected,
    `${when}, fetch has been called ${n} time(s) — expected ${expected}. ${
      n > expected
        ? 'The effect runs too often: give it the dependency array [url] so it only runs again when the url changes.'
        : 'Call fetch(url) inside a useEffect in useFetch.'
    }`,
  );
}

// ---------------------------------------------------------------------------
// Fake archives
// ---------------------------------------------------------------------------

const LIBRARY = {
  spells: [
    { id: 1, title: 'Fireball for Beginners', author: 'Ada' },
    { id: 2, title: 'The Frost Lexicon', author: 'Linus' },
    { id: 3, title: 'Lightning in a Bottle', author: 'Grace' },
    { id: 4, title: 'Advanced Fire Wards', author: 'Alan' },
  ],
  potions: [
    { id: 5, title: 'Brewing with Moonwater', author: 'Hedy' },
    { id: 6, title: 'The Bitter Elixir', author: 'Barbara' },
    { id: 7, title: 'Potions of Re-rendering', author: 'Margaret' },
  ],
};

const QUESTS = [
  { id: 1, title: 'Light the lighthouse', done: true },
  { id: 2, title: 'Return the keys to the Keyless Horde', done: false },
  { id: 3, title: 'Clean up after the Infinite Looper', done: false },
  { id: 4, title: "Shatter the Mutator's crown", done: false },
];

// ---------------------------------------------------------------------------

export default {
  id: 'mutator-citadel',
  file: '13-mutator-citadel.js',
  title: "The Mutator's Citadel",
  short: 'Capstone',
  subtitle: 'The final ascent: build real apps that combine everything you have learned, then face the Mutator himself.',
  icon: '🏰',
  colors: ['#1a1033', '#a21caf'],
  scenery: ['🏰', '⚡', '🦇', '🕯️', '🔮', '⛓️', '🌩️', '👑'],
  intro: [
    { text: "This is it: the Mutator's Citadel. Every frozen frame in Reactoria leads back to this tower.", mood: 'worried' },
    { text: 'No more single tricks up here. Each floor is sealed by a whole broken app — reducers, context, effects, hooks and forms, all at once. Only a real build opens the next door.', mood: 'thinking' },
    { text: "At the very top, the Mutator waits on a throne of mutated state. You've learned everything you need, Render Mage. Let's climb!", mood: 'excited' },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'citadel-gate',
      type: 'build',
      title: 'The Citadel Gate',
      blurb: 'Rebuild the party screen with one reducer shared through context.',
      xp: 150,
      story: [
        { text: "The Citadel Gate only opens for a party at full strength. Ada and Linus are hurt — and we've got exactly one potion.", mood: 'worried' },
        { text: "Worse, the party's state is scattered everywhere. Gather every rule into one reducer, share it through context, and let the Gate check the party for itself!", mood: 'happy' },
      ],
      lesson: md`
        ## Field guide: reducer + context

        Everything in the Citadel is something you have already learned — up here you **combine** it.
        This floor uses the pattern from the Context Canopy: *a reducer owns the state, context delivers it.*

        ### 1. One pure reducer

        A reducer gathers every way the state can change into one function, \`(state, action) => nextState\`:

        \`\`\`js
        export function shopReducer(shop, action) {
          switch (action.type) {
            case 'restocked':
              return { ...shop, stock: shop.stock + action.amount };
            case 'sold': {
              if (shop.stock === 0) return shop; // nothing to sell: same state, no re-render
              return {
                ...shop,
                stock: shop.stock - 1,
                customers: shop.customers.map((c) =>
                  c.id === action.customerId ? { ...c, bags: c.bags + 1 } : c,
                ),
              };
            }
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }
        \`\`\`

        - **Pure:** same state + same action → same result. No mutation, no fetching, no randomness.
        - **One action, many changes:** \`sold\` updates the stock *and* a customer together, so they can never disagree.
        - **Guard clauses:** returning the *same* object means "nothing changed".
        - **Testable:** it's just a function. \`shopReducer(state, { type: 'sold', customerId: 2 })\` — the Gatekeeper's checks will call your reducer exactly like that.

        ### 2. Two contexts: state and dispatch

        \`\`\`jsx
        export const ShopContext = createContext(null);
        export const ShopDispatchContext = createContext(null);

        function ShopProvider({ children }) {
          const [shop, dispatch] = useReducer(shopReducer, initialShop);
          return (
            <ShopContext value={shop}>
              <ShopDispatchContext value={dispatch}>{children}</ShopDispatchContext>
            </ShopContext>
          );
        }
        \`\`\`

        React 19 lets you render the context itself as the provider. Older code writes \`<ShopContext.Provider value={shop}>\` — same thing.

        ### 3. Read it anywhere below

        \`\`\`jsx
        function StockBadge() {
          const shop = useContext(ShopContext);
          const soldOut = shop.stock === 0; // derived, not stored
          return <p>{soldOut ? 'Sold out!' : 'In stock: ' + shop.stock}</p>;
        }

        function RestockButton() {
          const dispatch = useContext(ShopDispatchContext);
          return <button onClick={() => dispatch({ type: 'restocked', amount: 5 })}>Restock</button>;
        }
        \`\`\`

        No props travel through the components in between — that's the whole point.

        :::tip
        Why split state and dispatch? \`dispatch\` never changes, so components that only *send* actions
        don't re-render when the state changes.
        :::

        :::mistake
        Don't store what you can compute. If the gate is open exactly when every hero is at full HP, a
        \`gateOpen\` flag doesn't belong in the reducer — calculate it during render with \`.every()\`.
        :::
      `,
      task: md`
        ## 🎯 Open the Citadel Gate

        The starter draws the party from a fixed \`initialParty\`, and none of the buttons work.
        Rebuild it around **one reducer** shared through **context**.

        ### The reducer

        - Finish the exported \`partyReducer(party, action)\`. Never mutate — the checks freeze the state.
        - \`{ type: 'potion_found' }\` → one more potion.
        - \`{ type: 'potion_used', heroId }\` → one potion fewer **and** that hero heals **25 HP**, never going above their \`maxHp\`.
        - If there are no potions left, or that hero is already at full HP, return the party unchanged.

        ### The contexts

        - Create and **export** \`PartyContext\` (holds the party object) and \`PartyDispatchContext\` (holds \`dispatch\`).
        - \`PartyProvider\` calls \`useReducer(partyReducer, initialParty)\` and provides both around its \`children\`.

        ### The components — no party or dispatch props!

        - \`PartyPanel\` reads the heroes from \`PartyContext\`.
        - Each \`HeroCard\`'s **Use potion** button dispatches \`{ type: 'potion_used', heroId: hero.id }\`.
        - The exported \`Pack\` shows **Potions: N** in \`<p className="potions">\`, and its **Search for potions** button dispatches \`{ type: 'potion_found' }\`.
        - The exported \`Gate\` shows **🔓 The gate is open!** when every hero's \`hp\` equals their \`maxHp\`, otherwise **🔒 The gate is sealed.** Derive it, don't store it.
      `,
      css: `
        .gate { display: inline-block; padding: 8px 14px; border-radius: 12px; font-weight: 700; background: #2b2140; color: #f3e8ff; }
        .party { display: flex; gap: 10px; flex-wrap: wrap; }
        .hero { background: white; border: 2px solid #e9e1f7; border-radius: 14px; padding: 10px 14px; min-width: 160px; margin: 0; }
        .hero h3 { margin: 0 0 6px; }
        .hp-bar { height: 10px; border-radius: 6px; background: #f1e7e7; overflow: hidden; }
        .hp-bar > div { height: 100%; background: linear-gradient(90deg, #e03131, #f59f00); transition: width 0.3s; }
        .hp { font-family: ui-monospace, monospace; font-size: 0.9em; }
        .pack { margin-top: 12px; padding: 10px 14px; border: 2px dashed #c4b5fd; border-radius: 14px; }
        .potions { font-weight: 700; }
      `,
      starter: code`
        import { createContext, useContext, useReducer } from 'react';

        const initialParty = {
          potions: 1,
          heroes: [
            { id: 'ada', name: 'Ada', hp: 50, maxHp: 100 },
            { id: 'linus', name: 'Linus', hp: 75, maxHp: 100 },
          ],
        };

        // ① The reducer: every rule of the party in one pure function.
        export function partyReducer(party, action) {
          switch (action.type) {
            case 'potion_found':
              // TODO: one more potion
              return party;
            case 'potion_used':
              // TODO: no potions, or the hero is already at full HP? → return party unchanged
              // TODO: otherwise one potion fewer AND that hero heals 25 HP (never above maxHp)
              return party;
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        // ② TODO: create and export PartyContext and PartyDispatchContext

        // ③ TODO: useReducer here, then provide the party AND dispatch to the children
        function PartyProvider({ children }) {
          return children;
        }

        function HeroCard({ hero }) {
          // TODO: get dispatch from PartyDispatchContext
          return (
            <article className="hero">
              <h3>{hero.name}</h3>
              <div className="hp-bar">
                <div style={{ width: (hero.hp / hero.maxHp) * 100 + '%' }} />
              </div>
              <p className="hp">HP {hero.hp}/{hero.maxHp}</p>
              <button>Use potion</button>
            </article>
          );
        }

        function PartyPanel() {
          const party = initialParty; // TODO: read the party from PartyContext
          return (
            <section className="party">
              {party.heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} />
              ))}
            </section>
          );
        }

        export function Pack() {
          const party = initialParty; // TODO: read the party from PartyContext
          // TODO: the button dispatches { type: 'potion_found' }
          return (
            <section className="pack">
              <p className="potions">Potions: {party.potions}</p>
              <button>Search for potions</button>
            </section>
          );
        }

        export function Gate() {
          // TODO: read the party from context and DERIVE whether every hero is at full HP
          return <p className="gate">🔒 The gate is sealed.</p>;
        }

        export default function App() {
          return (
            <PartyProvider>
              <h1>🏰 The Citadel Gate</h1>
              <Gate />
              <PartyPanel />
              <Pack />
            </PartyProvider>
          );
        }
      `,
      solution: code`
        import { createContext, useContext, useReducer } from 'react';

        const initialParty = {
          potions: 1,
          heroes: [
            { id: 'ada', name: 'Ada', hp: 50, maxHp: 100 },
            { id: 'linus', name: 'Linus', hp: 75, maxHp: 100 },
          ],
        };

        export function partyReducer(party, action) {
          switch (action.type) {
            case 'potion_found':
              return { ...party, potions: party.potions + 1 };
            case 'potion_used': {
              const hero = party.heroes.find((h) => h.id === action.heroId);
              if (!hero || party.potions === 0 || hero.hp >= hero.maxHp) return party;
              return {
                ...party,
                potions: party.potions - 1,
                heroes: party.heroes.map((h) =>
                  h.id === action.heroId ? { ...h, hp: Math.min(h.maxHp, h.hp + 25) } : h,
                ),
              };
            }
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export const PartyContext = createContext(null);
        export const PartyDispatchContext = createContext(null);

        function PartyProvider({ children }) {
          const [party, dispatch] = useReducer(partyReducer, initialParty);
          return (
            <PartyContext value={party}>
              <PartyDispatchContext value={dispatch}>{children}</PartyDispatchContext>
            </PartyContext>
          );
        }

        function HeroCard({ hero }) {
          const dispatch = useContext(PartyDispatchContext);
          return (
            <article className="hero">
              <h3>{hero.name}</h3>
              <div className="hp-bar">
                <div style={{ width: (hero.hp / hero.maxHp) * 100 + '%' }} />
              </div>
              <p className="hp">HP {hero.hp}/{hero.maxHp}</p>
              <button onClick={() => dispatch({ type: 'potion_used', heroId: hero.id })}>Use potion</button>
            </article>
          );
        }

        function PartyPanel() {
          const party = useContext(PartyContext);
          return (
            <section className="party">
              {party.heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} />
              ))}
            </section>
          );
        }

        export function Pack() {
          const party = useContext(PartyContext);
          const dispatch = useContext(PartyDispatchContext);
          return (
            <section className="pack">
              <p className="potions">Potions: {party.potions}</p>
              <button onClick={() => dispatch({ type: 'potion_found' })}>Search for potions</button>
            </section>
          );
        }

        export function Gate() {
          const party = useContext(PartyContext);
          const isOpen = party.heroes.every((hero) => hero.hp === hero.maxHp);
          return <p className="gate">{isOpen ? '🔓 The gate is open!' : '🔒 The gate is sealed.'}</p>;
        }

        export default function App() {
          return (
            <PartyProvider>
              <h1>🏰 The Citadel Gate</h1>
              <Gate />
              <PartyPanel />
              <Pack />
            </PartyProvider>
          );
        }
      `,
      hints: [
        md`Start with the reducer — it's plain JavaScript you can get right on its own. \`potion_found\` is one line: \`return { ...party, potions: party.potions + 1 };\``,
        md`For \`potion_used\`, find the hero first: \`const hero = party.heroes.find((h) => h.id === action.heroId);\` Guard with \`if (party.potions === 0 || hero.hp >= hero.maxHp) return party;\` — otherwise return \`{ ...party, potions: party.potions - 1, heroes: party.heroes.map(...) }\`, healing the matching hero to \`Math.min(h.maxHp, h.hp + 25)\`.`,
        md`
          The contexts, the provider and one consumer:

          \`\`\`jsx
          export const PartyContext = createContext(null);
          export const PartyDispatchContext = createContext(null);

          function PartyProvider({ children }) {
            const [party, dispatch] = useReducer(partyReducer, initialParty);
            return (
              <PartyContext value={party}>
                <PartyDispatchContext value={dispatch}>{children}</PartyDispatchContext>
              </PartyContext>
            );
          }

          export function Gate() {
            const party = useContext(PartyContext);
            const isOpen = party.heroes.every((h) => h.hp === h.maxHp);
            // ...
          }
          \`\`\`

          The other components use \`useContext(PartyContext)\` / \`useContext(PartyDispatchContext)\` the same way.
        `,
      ],
      tests: [
        test('The party, the pack and the sealed gate are on screen', (t) => {
          t.render();
          const cards = t.$$('.hero');
          t.expect(cards.length === 2, `Found ${cards.length} .hero card(s) — expected 2 (Ada and Linus). Keep the HeroCard markup from the starter.`);
          const ada = findByText(t, '.hero', 'Ada');
          const linus = findByText(t, '.hero', 'Linus');
          t.expect(ada && norm(ada.querySelector('.hp')?.textContent) === 'HP 50/100', 'Ada\'s card should show "HP 50/100" in its <p className="hp">.');
          t.expect(linus && norm(linus.querySelector('.hp')?.textContent) === 'HP 75/100', 'Linus\'s card should show "HP 75/100" in its <p className="hp">.');
          const potions = norm(t.$('.potions')?.textContent);
          t.expect(potions === 'Potions: 1', `The pack reads "${potions || 'nothing'}" — expected "Potions: 1" in <p className="potions">.`);
          const gate = norm(t.$('.gate')?.textContent);
          t.expect(gate.includes('sealed'), `The gate reads "${gate || 'nothing'}" — with a hurt party it should say "🔒 The gate is sealed."`);
        }),
        test('partyReducer is pure: potion_found and potion_used return new state', (t) => {
          const reducer = t.exports.partyReducer;
          t.expect(typeof reducer === 'function', 'Export the reducer: export function partyReducer(party, action) { ... }');
          const make = (potions, adaHp = 50, linusHp = 90) =>
            deepFreeze({
              potions,
              heroes: [
                { id: 'ada', name: 'Ada', hp: adaHp, maxHp: 100 },
                { id: 'linus', name: 'Linus', hp: linusHp, maxHp: 100 },
              ],
            });
          const hp = (party, id) => party?.heroes?.find((h) => h.id === id)?.hp;

          const start = make(1);
          let next = runReducer(t, reducer, 'partyReducer', start, { type: 'potion_found' });
          t.expect(next && next !== start, 'potion_found should return a NEW party object (spread the old one: { ...party, potions: ... }).');
          t.expect(next.potions === 2, `After potion_found the party has ${next.potions} potions — expected 2.`);

          next = runReducer(t, reducer, 'partyReducer', start, { type: 'potion_used', heroId: 'ada' });
          t.expect(next && next !== start, 'potion_used should return a NEW party object.');
          t.expect(next.potions === 0, `After using the only potion the party has ${next.potions} potions — expected 0.`);
          t.expect(hp(next, 'ada') === 75, `Ada (50 HP) was healed to ${hp(next, 'ada')} HP — a potion heals 25, so expected 75.`);
          t.expect(hp(next, 'linus') === 90, 'Only the hero named by action.heroId should be healed — Linus changed too.');

          next = runReducer(t, reducer, 'partyReducer', start, { type: 'potion_used', heroId: 'linus' });
          t.expect(hp(next, 'linus') === 100, `Linus (90/100 HP) was healed to ${hp(next, 'linus')} HP — healing must stop at maxHp: Math.min(h.maxHp, h.hp + 25).`);

          const empty = make(0);
          next = runReducer(t, reducer, 'partyReducer', empty, { type: 'potion_used', heroId: 'ada' });
          t.expect(next && next.potions === 0 && hp(next, 'ada') === 50, 'With 0 potions, potion_used must change nothing — return the party unchanged.');

          const healthy = make(2, 100, 100);
          next = runReducer(t, reducer, 'partyReducer', healthy, { type: 'potion_used', heroId: 'ada' });
          t.expect(next && next.potions === 2, 'Ada is already at full HP: potion_used must not waste a potion on her — return the party unchanged.');
        }),
        test('Searching and using potions updates the screen', (t) => {
          t.render();
          t.click(t.button('Search for potions'));
          let potions = norm(t.$('.potions')?.textContent);
          t.expect(
            potions === 'Potions: 2',
            `After clicking "Search for potions" the pack reads "${potions}" — expected "Potions: 2". The button should dispatch { type: 'potion_found' } (from PartyDispatchContext), PartyProvider should hold useReducer(partyReducer, initialParty), and Pack should read the party from PartyContext.`,
          );
          const ada = findByText(t, '.hero', 'Ada');
          t.click(ada.querySelector('button'));
          const adaHp = norm(findByText(t, '.hero', 'Ada').querySelector('.hp')?.textContent);
          t.expect(adaHp === 'HP 75/100', `After "Use potion" on Ada her card reads "${adaHp}" — expected "HP 75/100". HeroCard's button should dispatch { type: 'potion_used', heroId: hero.id }, and PartyPanel should read the heroes from PartyContext.`);
          potions = norm(t.$('.potions')?.textContent);
          t.expect(potions === 'Potions: 1', `Healing Ada should use up a potion — the pack reads "${potions}", expected "Potions: 1".`);
        }),
        test('The gate opens only when the whole party is at full HP', (t) => {
          t.render();
          const gate = () => norm(t.$('.gate')?.textContent);
          const use = (name) => t.click(findByText(t, '.hero', name).querySelector('button'));
          t.click(t.button('Search for potions'));
          t.click(t.button('Search for potions'));
          use('Linus');
          use('Ada');
          t.expect(gate().includes('sealed'), `Ada is still at 75/100 HP, but the gate reads "${gate()}". It should stay sealed until EVERY hero is at full HP.`);
          use('Ada');
          t.expect(
            gate() === '🔓 The gate is open!',
            `Everyone is at full HP now, but the gate reads "${gate()}" — expected "🔓 The gate is open!". In Gate, read the party from PartyContext and derive party.heroes.every((h) => h.hp === h.maxHp).`,
          );
        }),
        test('Gate and Pack read from PartyContext and PartyDispatchContext', (t) => {
          const { PartyContext, PartyDispatchContext, Gate, Pack } = t.exports;
          t.expect(
            PartyContext && PartyDispatchContext,
            'Export both contexts: export const PartyContext = createContext(null); and export const PartyDispatchContext = createContext(null);',
          );
          t.expect(typeof Gate === 'function' && typeof Pack === 'function', 'Keep Gate and Pack as exported components (export function Gate() ...).');
          const party = (graceHp) => ({
            potions: 4,
            heroes: [
              { id: 'ada', name: 'Ada', hp: 100, maxHp: 100 },
              { id: 'grace', name: 'Grace', hp: graceHp, maxHp: 60 },
            ],
          });
          const renderIn = (element, what) => {
            try {
              t.render(element);
            } catch (err) {
              t.fail(
                `${what} crashed (${err.message.replace(/^Your component crashed: /, '')}). PartyContext must hold the party object itself (<PartyContext value={party}>) and PartyDispatchContext must hold dispatch (<PartyDispatchContext value={dispatch}>) — read them with useContext(PartyContext) and useContext(PartyDispatchContext).`,
              );
            }
          };
          renderIn(provide(t, PartyContext, party(60), t.h(Gate)), '<Gate /> inside <PartyContext value={party}>');
          let text = norm(t.$('.gate')?.textContent);
          t.expect(
            text.includes('open'),
            `<Gate /> inside <PartyContext value={party}> with every hero at full HP (Grace is 60/60) shows "${text || 'nothing'}" — expected the open gate. Gate must read the party with useContext(PartyContext) and compare each hero's hp with their own maxHp.`,
          );
          renderIn(provide(t, PartyContext, party(30), t.h(Gate)), '<Gate /> inside <PartyContext value={party}>');
          text = norm(t.$('.gate')?.textContent);
          t.expect(text.includes('sealed'), `With Grace at 30/60 HP, <Gate /> shows "${text}" — expected the sealed gate.`);
          const actions = [];
          renderIn(
            provide(t, PartyContext, party(60), provide(t, PartyDispatchContext, (a) => actions.push(a), t.h(Pack))),
            '<Pack /> inside both contexts',
          );
          text = norm(t.$('.potions')?.textContent);
          t.expect(text === 'Potions: 4', `<Pack /> inside a PartyContext holding 4 potions shows "${text || 'nothing'}" — expected "Potions: 4". Pack should read the party from PartyContext.`);
          t.click(t.button('Search for potions'));
          t.expect(
            actions.length === 1 && actions[0]?.type === 'potion_found',
            `Clicking "Search for potions" should call the dispatch from PartyDispatchContext once with { type: 'potion_found' } — it received ${actions.length ? JSON.stringify(actions) : 'no actions'}.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'citadel-reducer-context',
          icon: '🏰',
          title: 'Reducer + context',
          summary: 'One reducer owns the state; two contexts deliver the state and dispatch to any depth.',
          snippet: code`
            const [party, dispatch] = useReducer(partyReducer, initialParty);
            return (
              <PartyContext value={party}>
                <PartyDispatchContext value={dispatch}>{children}</PartyDispatchContext>
              </PartyContext>
            );
          `,
          detail: 'Any component below can read the state or send actions with useContext — no prop drilling.',
        },
        {
          id: 'citadel-testable-reducer',
          icon: '🧪',
          title: 'Reducers are testable',
          summary: 'A pure reducer is just a function: feed it a state and an action, check what comes out.',
          snippet: code`
            const next = partyReducer(state, { type: 'potion_found' });
            next.potions === state.potions + 1; // true
            next !== state;                     // a new object
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'citadel-library',
      type: 'build',
      title: 'The Library of Fetches',
      blurb: 'One custom useFetch hook to load, filter and survive every shelf.',
      xp: 160,
      story: [
        { text: 'The Library of Fetches! Every book here lives in a far-away archive and has to be fetched before you can read it.', mood: 'happy' },
        { text: "The Mutator's librarians fetch on every render and mix old answers up with new ones. One good useFetch hook will fix the whole library.", mood: 'thinking' },
      ],
      lesson: md`
        ## Field guide: fetching with a custom hook

        ### Three states of a request

        Every request is **loading** first, then ends with either **data** or an **error**. Model all three:

        \`\`\`jsx
        const [data, setData] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        \`\`\`

        ### fetch doesn't fail on 404 or 500

        \`fetch\` only rejects when the network itself fails. An error *status* still resolves, so check \`res.ok\`:

        \`\`\`js
        fetch(url).then((res) => {
          if (!res.ok) throw new Error('Request failed: ' + res.status);
          return res.json();
        });
        \`\`\`

        Throwing inside a \`.then\` sends you straight to the next \`.catch\` — a handy place to store the error.

        ### Ignore stale answers

        When the input changes quickly, an *old* response can arrive after a newer request started — and
        overwrite it with the wrong data. The fix from the Effect Volcano is an \`ignore\` flag that the cleanup flips:

        \`\`\`jsx
        useEffect(() => {
          let ignore = false;
          setLoading(true);
          fetch('/api/weather?city=' + city)
            .then((res) => res.json())
            .then((json) => {
              if (!ignore) {
                setWeather(json);
                setLoading(false);
              }
            });
          return () => {
            ignore = true; // this effect is outdated: drop its answer
          };
        }, [city]);
        \`\`\`

        React runs the cleanup **before** running the effect again for a new \`city\`, so every older request is ignored.

        ### Wrap it in a hook

        A custom hook is a function whose name starts with \`use\` and that calls other hooks. Move the state and the
        effect inside, take the \`url\` as a parameter, and return what a screen needs:

        \`\`\`js
        export function useFetch(url) {
          // the state and the effect from above, using url
          return { data, loading, error };
        }
        \`\`\`

        Every component that calls \`useFetch\` gets its **own** state — hooks share logic, not state.

        ### Filtering is derived

        The search box narrows what you *already have*, so compute it during render. No second fetch, no
        \`filtered\` state, no effect:

        \`\`\`js
        const visible = books.filter((b) => b.title.toLowerCase().includes(query.toLowerCase()));
        \`\`\`

        :::tip
        Key each \`<li>\` with a stable id from the data (\`key={book.id}\`). When the list is filtered, React then
        keeps each book's DOM node instead of shuffling text between the nodes that remain.
        :::

        :::warn
        Reactoria's pretend \`fetch\` can't be cancelled with an \`AbortController\`. Use the \`ignore\` flag.
        :::
      `,
      task: md`
        ## 🎯 Restore the Library of Fetches

        ### The hook: \`useFetch(url)\` (exported)

        - Returns \`{ data, loading, error }\`, starting as \`{ data: null, loading: true, error: null }\`.
        - Fetches \`url\` in an effect that runs again **only when \`url\` changes**. Each run sets \`loading\` back to \`true\` and \`error\` back to \`null\`.
        - If the response isn't \`ok\`, throw \`new Error('Request failed: ' + res.status)\` and store that error.
        - On success, store the JSON in \`data\`. Either way, \`loading\` ends up \`false\`.
        - **Ignore stale answers:** if \`url\` changed before a response arrived, that response must not touch the state. Use an \`ignore\` flag in the cleanup.

        ### The library: \`App\`

        - Call \`useFetch('/api/books?shelf=' + shelf)\`, with \`shelf\` coming from the \`<select className="shelf">\`.
        - While loading, show \`<p className="loading">Loading books…</p>\`.
        - Otherwise, on error, show \`<p className="error">⚠️ {error.message}</p>\`.
        - Otherwise show \`<p className="count">Showing X of Y books</p>\` and a \`<ul>\` with one \`<li className="book">\` per visible book (title and author), keyed by \`book.id\`.
        - The \`<input className="search">\` filters the loaded books by title, **ignoring upper/lower case**, during render — no new fetch, no extra state.

        Shelves: **spells** (4 books), **potions** (3 books) and **forbidden** — the Mutator sealed that one, so the archive answers \`403\`.
      `,
      css: `
        .library { max-width: 540px; }
        .controls { display: flex; gap: 6px; flex-wrap: wrap; }
        .controls .search { flex: 1; min-width: 160px; }
        .loading { color: #7048e8; font-style: italic; }
        .error { color: #c92a2a; font-weight: 600; }
        .count { color: #868e96; font-size: 0.9em; }
        .library ul { padding-left: 0; }
        .book { list-style: none; background: white; border: 2px solid #ece6da; border-radius: 10px; padding: 6px 10px; margin: 6px 0; }
        .book::before { content: '📖 '; }
      `,
      routes: {
        '/api/books': (url) => {
          const shelf = new URL(url, 'http://library.reactoria').searchParams.get('shelf');
          if (shelf === 'forbidden') return { status: 403, body: { error: 'Sealed by the Mutator' } };
          return LIBRARY[shelf] || [];
        },
      },
      starter: code`
        import { useEffect, useState } from 'react';

        // ① A custom hook: any url in, { data, loading, error } out.
        export function useFetch(url) {
          // TODO: three pieces of state: data (null), loading (true), error (null)

          // TODO: an effect that runs again only when url changes:
          //   1. set loading back to true and error back to null
          //   2. fetch(url) — if !res.ok, throw new Error('Request failed: ' + res.status)
          //   3. success → data = the JSON; failure → error = the Error; loading → false
          //   4. let ignore = false; ... return () => { ignore = true; };  (stale answers!)

          return { data: null, loading: true, error: null };
        }

        export default function App() {
          const [shelf, setShelf] = useState('spells');
          const [query, setQuery] = useState('');

          // ② TODO: const { data, loading, error } = useFetch('/api/books?shelf=' + shelf);

          // ③ TODO: derive the visible books (title includes the query, ignoring case)

          return (
            <div className="library">
              <h1>📚 The Library of Fetches</h1>
              <div className="controls">
                <select className="shelf" value={shelf} onChange={(e) => setShelf(e.target.value)}>
                  <option value="spells">Spells</option>
                  <option value="potions">Potions</option>
                  <option value="forbidden">Forbidden</option>
                </select>
                <input
                  className="search"
                  placeholder="Search titles…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* ④ TODO:
                  loading → <p className="loading">Loading books…</p>
                  error   → <p className="error">⚠️ {error.message}</p>
                  else    → <p className="count">Showing X of Y books</p>
                            and a <ul> with one <li className="book" key={book.id}> per visible book */}
            </div>
          );
        }
      `,
      solution: code`
        import { useEffect, useState } from 'react';

        export function useFetch(url) {
          const [data, setData] = useState(null);
          const [loading, setLoading] = useState(true);
          const [error, setError] = useState(null);

          useEffect(() => {
            let ignore = false;
            setLoading(true);
            setError(null);
            fetch(url)
              .then((res) => {
                if (!res.ok) throw new Error('Request failed: ' + res.status);
                return res.json();
              })
              .then((json) => {
                if (!ignore) {
                  setData(json);
                  setLoading(false);
                }
              })
              .catch((err) => {
                if (!ignore) {
                  setError(err);
                  setLoading(false);
                }
              });
            return () => {
              ignore = true;
            };
          }, [url]);

          return { data, loading, error };
        }

        export default function App() {
          const [shelf, setShelf] = useState('spells');
          const [query, setQuery] = useState('');
          const { data, loading, error } = useFetch('/api/books?shelf=' + shelf);

          const books = data ?? [];
          const needle = query.trim().toLowerCase();
          const visible = books.filter((book) => book.title.toLowerCase().includes(needle));

          let content;
          if (loading) {
            content = <p className="loading">Loading books…</p>;
          } else if (error) {
            content = <p className="error">⚠️ {error.message}</p>;
          } else {
            content = (
              <>
                <p className="count">
                  Showing {visible.length} of {books.length} books
                </p>
                <ul>
                  {visible.map((book) => (
                    <li key={book.id} className="book">
                      <strong>{book.title}</strong> by {book.author}
                    </li>
                  ))}
                </ul>
              </>
            );
          }

          return (
            <div className="library">
              <h1>📚 The Library of Fetches</h1>
              <div className="controls">
                <select className="shelf" value={shelf} onChange={(e) => setShelf(e.target.value)}>
                  <option value="spells">Spells</option>
                  <option value="potions">Potions</option>
                  <option value="forbidden">Forbidden</option>
                </select>
                <input
                  className="search"
                  placeholder="Search titles…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {content}
            </div>
          );
        }
      `,
      hints: [
        md`Inside \`useFetch\`: three \`useState\` calls, then \`useEffect(() => { let ignore = false; ... return () => { ignore = true; }; }, [url]);\`. Every \`setX\` that runs *after* the response arrives must sit behind \`if (!ignore)\`.`,
        md`
          The request itself:

          \`\`\`js
          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error('Request failed: ' + res.status);
              return res.json();
            })
            .then((json) => {
              if (!ignore) { setData(json); setLoading(false); }
            })
            .catch((err) => {
              if (!ignore) { setError(err); setLoading(false); }
            });
          \`\`\`

          Don't forget \`setLoading(true)\` and \`setError(null)\` at the start of the effect.
        `,
        md`In \`App\`: \`const { data, loading, error } = useFetch('/api/books?shelf=' + shelf);\` and \`const visible = (data ?? []).filter((book) => book.title.toLowerCase().includes(query.toLowerCase()));\` Then pick what to show with \`if (loading) ... else if (error) ... else ...\` and map \`visible\` to \`<li key={book.id} className="book">\`.`,
      ],
      tests: [
        test('useFetch(url) starts loading, then returns the data', async (t) => {
          const { useFetch } = t.exports;
          t.expect(typeof useFetch === 'function', 'Export the hook: export function useFetch(url) { ... }');
          const box = { current: null };
          function Probe({ url }) {
            box.current = useFetch(url);
            return null;
          }
          const url = '/api/books?shelf=spells';
          t.render(t.h(Probe, { url }));
          const r0 = box.current;
          t.expect(r0 && typeof r0 === 'object' && 'data' in r0 && 'loading' in r0 && 'error' in r0, 'useFetch should return an object with three keys: { data, loading, error }.');
          t.expect(r0.loading === true && r0.data == null && r0.error == null, `Before the answer arrives useFetch returned ${JSON.stringify(r0)} — expected { data: null, loading: true, error: null }.`);
          expectFetchCount(t, 1, 'Right after mounting');
          t.expect(t.fetchCalls[0].url === url, `fetch was called with "${t.fetchCalls[0].url}" — expected the url passed to the hook, "${url}".`);
          await t.tick(300);
          expectFetchCount(t, 1, 'After the response arrived');
          const r1 = box.current;
          t.expect(
            r1.loading === false && Array.isArray(r1.data) && r1.data.length === 4 && r1.error == null,
            `After the response arrived useFetch returned loading: ${r1.loading}, data: ${JSON.stringify(r1.data)}. Expected loading: false and data: the 4 spell books (the JSON from res.json()).`,
          );
          t.render(t.h(Probe, { url }));
          await t.tick(300);
          t.expect(t.fetchCalls.length === 1, 'useFetch fetched again although the url did not change. Give the effect the dependency array [url].');
        }),
        test('useFetch turns a failed response into an error', async (t) => {
          const { useFetch } = t.exports;
          t.expect(typeof useFetch === 'function', 'Export the hook: export function useFetch(url) { ... }');
          const box = { current: null };
          function Probe({ url }) {
            box.current = useFetch(url);
            return null;
          }
          t.render(t.h(Probe, { url: '/api/books?shelf=forbidden' }));
          await t.tick(300);
          expectFetchCount(t, 1, 'After the 403 response arrived');
          const r = box.current || {};
          const message = typeof r.error === 'string' ? r.error : r.error?.message;
          t.expect(
            r.error && String(message).includes('403'),
            `The forbidden shelf answers with status 403, but useFetch returned error: ${JSON.stringify(r.error ?? null)}, data: ${JSON.stringify(r.data ?? null)}. fetch doesn't reject on HTTP errors — check res.ok and throw new Error('Request failed: ' + res.status), then store it with setError in .catch.`,
          );
          t.expect(r.loading === false, 'After a failed request, loading must be false too.');
          t.expect(r.data == null, `After a failed request data should still be null — got ${JSON.stringify(r.data)}.`);
        }),
        test('useFetch ignores a stale response after the url changes', async (t) => {
          const { useFetch } = t.exports;
          t.expect(typeof useFetch === 'function', 'Export the hook: export function useFetch(url) { ... }');
          const box = { current: null };
          function Probe({ url }) {
            box.current = useFetch(url);
            return null;
          }
          t.render(t.h(Probe, { url: '/api/books?shelf=spells' }));
          await t.tick(100);
          // The url changes while the spells request is still on its way.
          t.render(t.h(Probe, { url: '/api/books?shelf=potions' }));
          await t.tick(250); // the OLD spells answer arrives now
          const mid = box.current || {};
          const showsSpells = Array.isArray(mid.data) && mid.data.some((b) => b.title === 'Fireball for Beginners');
          t.expect(
            !showsSpells && mid.loading === true,
            `The url changed to the potions shelf, then the OLD spells response arrived — and useFetch now returns loading: ${mid.loading}, data: ${showsSpells ? 'the spell books' : JSON.stringify(mid.data ?? null)}. A stale answer must not touch the state: start the effect with let ignore = false, return () => { ignore = true; }, and only call the setters when !ignore.`,
          );
          await t.tick(100); // the potions answer arrives
          expectFetchCount(t, 2, 'After one request per url');
          const end = box.current || {};
          t.expect(
            end.loading === false && Array.isArray(end.data) && end.data.length === 3,
            `When the potions response arrived, useFetch returned loading: ${end.loading}, data: ${JSON.stringify(end.data ?? null)} — expected loading: false and the 3 potion books.`,
          );
        }),
        test('The library shows loading, books and errors for each shelf', async (t) => {
          t.render();
          t.expect(t.$('.loading'), 'While the books load, show <p className="loading">Loading books…</p>.');
          await t.tick(300);
          let books = t.$$('li.book');
          t.expect(books.length === 4, `After loading the spells shelf there are ${books.length} li.book element(s) — expected 4. Call useFetch('/api/books?shelf=' + shelf) and map the data to <li className="book">.`);
          t.expect(!t.$('.loading'), 'Hide the loading message once the books have arrived.');
          const count = norm(t.$('.count')?.textContent);
          t.expect(count === 'Showing 4 of 4 books', `The count reads "${count || 'nothing'}" — expected "Showing 4 of 4 books" in <p className="count">.`);
          t.change('select.shelf', 'potions');
          t.expect(t.$('.loading'), 'Switching to the potions shelf should show "Loading books…" again — set loading back to true at the start of the effect.');
          await t.tick(300);
          books = t.$$('li.book');
          t.expect(
            books.length === 3 && t.hasText('Brewing with Moonwater'),
            `After switching to the potions shelf there are ${books.length} book(s) on screen — expected the 3 potion books. Does the url change with the shelf?`,
          );
          t.change('select.shelf', 'forbidden');
          await t.tick(300);
          const err = t.$('.error');
          t.expect(err && norm(err.textContent).includes('403'), `The forbidden shelf should show <p className="error">⚠️ Request failed: 403</p> — found ${err ? `"${norm(err.textContent)}"` : 'no .error element'}.`);
          t.expect(t.count('li.book') === 0, 'While showing the error, don\'t show any books.');
        }),
        test('Searching filters the loaded books instantly (with stable keys)', async (t) => {
          t.render();
          await t.tick(300);
          const before = t.$$('li.book');
          t.expect(before.length === 4, 'The spells shelf should show 4 li.book elements once loaded (see the previous objective).');
          const wards = before.find((li) => norm(li.textContent).includes('Advanced Fire Wards'));
          t.expect(t.$('input.search'), 'Keep the <input className="search"> from the starter.');
          t.type('input.search', 'fire');
          let titles = t.$$('li.book').map((li) => norm(li.textContent));
          t.expect(
            titles.length === 2 && titles.every((x) => /fire/i.test(x)),
            `Searching "fire" shows ${titles.length} book(s) — expected 2 (Fireball for Beginners, Advanced Fire Wards). Compare lowercased titles: book.title.toLowerCase().includes(query.toLowerCase()).`,
          );
          const count = norm(t.$('.count')?.textContent);
          t.expect(count === 'Showing 2 of 4 books', `While searching, the count reads "${count}" — expected "Showing 2 of 4 books".`);
          t.expect(t.fetchCalls.length === 1, `Searching triggered ${t.fetchCalls.length - 1} extra fetch(es). Filter the books you already have during render — the query shouldn't be part of the url.`);
          const wardsAfter = t.$$('li.book').find((li) => norm(li.textContent).includes('Advanced Fire Wards'));
          t.expect(
            wards && wardsAfter === wards,
            'After filtering, "Advanced Fire Wards" is shown by a different <li> than before — React reused nodes by position. Key each item with its id: <li key={book.id} className="book"> (not the index).',
          );
          t.type('input.search', 'FROST');
          titles = t.$$('li.book').map((li) => norm(li.textContent));
          t.expect(titles.length === 1 && titles[0].includes('The Frost Lexicon'), `Searching "FROST" shows ${titles.length} book(s) — the search must ignore upper/lower case.`);
          t.type('input.search', '');
          t.expect(t.count('li.book') === 4, 'Clearing the search should show all 4 books again.');
        }),
      ],
      concepts: [
        {
          id: 'citadel-use-fetch',
          icon: '📚',
          title: 'useFetch',
          summary: 'A custom hook that turns any URL into { data, loading, error }.',
          snippet: code`
            const { data, loading, error } = useFetch('/api/books?shelf=' + shelf);
            if (loading) return <p>Loading…</p>;
            if (error) return <p>⚠️ {error.message}</p>;
          `,
          detail: 'Every component calling it gets its own state — the hook shares the logic, not the data.',
        },
        {
          id: 'citadel-stale-responses',
          icon: '⏳',
          title: 'Stale responses',
          summary: 'Drop answers to outdated requests with an ignore flag set in the effect cleanup.',
          snippet: code`
            useEffect(() => {
              let ignore = false;
              fetch(url).then((r) => r.json()).then((d) => { if (!ignore) setData(d); });
              return () => { ignore = true; };
            }, [url]);
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'citadel-forms',
      type: 'build',
      title: 'The Hall of Forms',
      blurb: 'Validate recruits as they type, lift the roster up and derive its stats.',
      xp: 160,
      story: [
        { text: 'The Recruitment Hall! Allies want to join us — but the Mutator enchanted the forms to accept anything. Empty names. Duplicate names. Power 9000.', mood: 'worried' },
        { text: 'Build a form that validates as you type and reports each new recruit up to the hall. The roster and its stats live in exactly one place: the parent.', mood: 'happy' },
      ],
      lesson: md`
        ## Field guide: forms that report upward

        ### Controlled fields

        \`\`\`jsx
        const [title, setTitle] = useState('');
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        \`\`\`

        Input values are always **strings** — even \`type="number"\`. Convert them when you use them: \`Number(price)\`.

        ### Validation is derived state

        An error isn't something that *happens*; it's a fact about the current values. So compute it during render:

        \`\`\`jsx
        const trimmed = title.trim();
        let titleError = '';
        if (trimmed.length < 3) titleError = 'Title must be at least 3 characters.';
        else if (usedTitles.includes(trimmed)) titleError = 'That title is taken.';

        const price = Number(priceText);
        const priceError = price >= 1 ? '' : 'Price must be at least 1.';
        const isValid = !titleError && !priceError;
        \`\`\`

        No \`errors\` state and no effect to keep it in sync — so it can never be out of date. Hiding a message until the
        user has typed something is derived too: \`{title !== '' && titleError && <p className="error">{titleError}</p>}\`.

        ### Submit: prevent, guard, report, reset

        \`\`\`jsx
        function handleSubmit(e) {
          e.preventDefault();   // no page reload
          if (!isValid) return; // the disabled button helps users; this guard covers every other way to submit
          onAdd({ title: trimmed, price });
          setTitle('');
          setPriceText('');
        }
        \`\`\`

        ### Keep the draft, lift the list

        The form owns only its *draft*. Finished items live in the **parent**, which can derive things from them:

        \`\`\`jsx
        function Shop() {
          const [items, setItems] = useState([]);
          const total = items.reduce((sum, item) => sum + item.price, 0); // derived
          return (
            <ItemForm
              usedTitles={items.map((item) => item.title)} // data flows down
              onAdd={(item) => setItems([...items, item])} // events flow up
            />
          );
        }
        \`\`\`

        Removing is just as immutable: \`setItems(items.filter((i) => i.title !== title))\`.

        :::mistake
        The average of an empty list is \`0 / 0\`, which is \`NaN\`. Guard it: \`items.length ? Math.round(total / items.length) : 0\`.
        :::
      `,
      task: md`
        ## 🎯 Guard the Hall of Forms

        ### \`RecruitForm({ takenNames, onRecruit })\` (exported)

        It owns only its three controlled fields: \`name\`, \`role\` (starts as **Mage**) and \`power\`.
        Derive these errors during render — no error state, no effect:

        | when | error text |
        |---|---|
        | the trimmed name is shorter than 2 characters | **Name must be at least 2 characters.** |
        | the name is already in \`takenNames\` (ignore upper/lower case) | **That name is already taken.** |
        | the power is below 1 or above 100 | **Power must be between 1 and 100.** |

        - Show each error in a \`<p className="error">\`, but only while its field isn't empty.
        - Disable the **Recruit** button unless both name and power are valid (an empty field is invalid).
        - On submit, call \`preventDefault()\`. If the form is valid, call \`onRecruit({ name, role, power })\` with the **trimmed** name and the power as a **number**, then reset the fields to \`''\`, \`'Mage'\` and \`''\`. If it's invalid, do nothing.

        ### \`App\` (owns the roster)

        - Pass \`RecruitForm\` the \`takenNames\` (derived from the roster) and an \`onRecruit\` that adds the hero **immutably**.
        - Each \`<li className="hero">\` gets a **Dismiss** button that removes that hero.
        - \`<p className="stats">\` shows **Party size: N · Total power: T · Average power: A**, where \`A\` is \`Math.round(T / N)\` — or **0** for an empty party.
      `,
      css: `
        .hall { max-width: 540px; }
        .recruit { display: grid; gap: 4px; background: white; border: 2px solid #ece6da; border-radius: 14px; padding: 10px 14px; }
        .recruit label { display: flex; align-items: center; gap: 8px; }
        .recruit input { flex: 1; }
        .error { color: #c92a2a; font-size: 0.9em; margin: 0 0 4px; }
        .roster { padding-left: 0; }
        .hero { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px dashed #ddd6c3; padding: 4px 0; }
        .stats { font-weight: 700; color: #5f3dc4; }
      `,
      starter: code`
        import { useState } from 'react';

        const ROLES = ['Mage', 'Knight', 'Ranger', 'Healer'];

        const startingParty = [
          { name: 'Ada', role: 'Mage', power: 80 },
          { name: 'Linus', role: 'Knight', power: 70 },
        ];

        // The form owns ONLY its draft. Finished heroes are reported up through onRecruit.
        export function RecruitForm({ takenNames, onRecruit }) {
          const [name, setName] = useState('');
          const [role, setRole] = useState('Mage');
          const [power, setPower] = useState('');

          // TODO: derive nameError and powerError from the fields (no extra state!)
          // TODO: derive isValid

          function handleSubmit(e) {
            e.preventDefault();
            // TODO: if valid → onRecruit({ name: trimmed name, role, power: as a number })
            // TODO: ...then reset the three fields
          }

          return (
            <form className="recruit" onSubmit={handleSubmit}>
              <label>
                Name
                <input name="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              {/* TODO: the name error (only when name isn't empty) */}
              <label>
                Role
                <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Power
                <input name="power" type="number" value={power} onChange={(e) => setPower(e.target.value)} />
              </label>
              {/* TODO: the power error (only when power isn't empty) */}
              <button type="submit">Recruit</button>
            </form>
          );
        }

        export default function App() {
          const [heroes, setHeroes] = useState(startingParty);

          // TODO: derive the total and average power

          return (
            <div className="hall">
              <h1>⚔️ The Hall of Forms</h1>
              {/* TODO: pass the real takenNames and an onRecruit that adds the hero */}
              <RecruitForm takenNames={[]} onRecruit={() => {}} />
              <ul className="roster">
                {heroes.map((hero) => (
                  <li key={hero.name} className="hero">
                    <span>
                      <strong>{hero.name}</strong> the {hero.role} · power {hero.power}
                    </span>
                    <button>Dismiss</button>
                  </li>
                ))}
              </ul>
              <p className="stats">Party size: ? · Total power: ? · Average power: ?</p>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const ROLES = ['Mage', 'Knight', 'Ranger', 'Healer'];

        const startingParty = [
          { name: 'Ada', role: 'Mage', power: 80 },
          { name: 'Linus', role: 'Knight', power: 70 },
        ];

        export function RecruitForm({ takenNames, onRecruit }) {
          const [name, setName] = useState('');
          const [role, setRole] = useState('Mage');
          const [power, setPower] = useState('');

          const trimmed = name.trim();
          let nameError = '';
          if (trimmed.length < 2) nameError = 'Name must be at least 2 characters.';
          else if (takenNames.some((taken) => taken.toLowerCase() === trimmed.toLowerCase()))
            nameError = 'That name is already taken.';

          const powerValue = Number(power);
          const powerError = powerValue >= 1 && powerValue <= 100 ? '' : 'Power must be between 1 and 100.';
          const isValid = !nameError && !powerError;

          function handleSubmit(e) {
            e.preventDefault();
            if (!isValid) return;
            onRecruit({ name: trimmed, role, power: powerValue });
            setName('');
            setRole('Mage');
            setPower('');
          }

          return (
            <form className="recruit" onSubmit={handleSubmit}>
              <label>
                Name
                <input name="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              {name !== '' && nameError && <p className="error">{nameError}</p>}
              <label>
                Role
                <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Power
                <input name="power" type="number" value={power} onChange={(e) => setPower(e.target.value)} />
              </label>
              {power !== '' && powerError && <p className="error">{powerError}</p>}
              <button type="submit" disabled={!isValid}>
                Recruit
              </button>
            </form>
          );
        }

        export default function App() {
          const [heroes, setHeroes] = useState(startingParty);

          const total = heroes.reduce((sum, hero) => sum + hero.power, 0);
          const average = heroes.length > 0 ? Math.round(total / heroes.length) : 0;

          function recruit(hero) {
            setHeroes([...heroes, hero]);
          }

          function dismiss(name) {
            setHeroes(heroes.filter((hero) => hero.name !== name));
          }

          return (
            <div className="hall">
              <h1>⚔️ The Hall of Forms</h1>
              <RecruitForm takenNames={heroes.map((hero) => hero.name)} onRecruit={recruit} />
              <ul className="roster">
                {heroes.map((hero) => (
                  <li key={hero.name} className="hero">
                    <span>
                      <strong>{hero.name}</strong> the {hero.role} · power {hero.power}
                    </span>
                    <button onClick={() => dismiss(hero.name)}>Dismiss</button>
                  </li>
                ))}
              </ul>
              <p className="stats">
                Party size: {heroes.length} · Total power: {total} · Average power: {average}
              </p>
            </div>
          );
        }
      `,
      hints: [
        md`Errors are just variables computed from the fields: \`const trimmed = name.trim(); let nameError = ''; if (trimmed.length < 2) nameError = '...'; else if (takenNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) nameError = '...';\` Same idea for power with \`Number(power)\` — an empty power becomes \`0\`, so it is automatically invalid.`,
        md`Show only filled-in fields' errors: \`{name !== '' && nameError && <p className="error">{nameError}</p>}\`. The button: \`<button type="submit" disabled={Boolean(nameError || powerError)}>\`. In \`handleSubmit\`: \`if (nameError || powerError) return; onRecruit({ name: trimmed, role, power: Number(power) });\` — then reset all three fields.`,
        md`In \`App\`: \`takenNames={heroes.map((h) => h.name)}\`, \`onRecruit={(hero) => setHeroes([...heroes, hero])}\`, and Dismiss with \`setHeroes(heroes.filter((h) => h.name !== hero.name))\`. Stats: \`const total = heroes.reduce((sum, h) => sum + h.power, 0); const average = heroes.length ? Math.round(total / heroes.length) : 0;\``,
      ],
      tests: [
        test('The recruit form and the starting roster are on screen', (t) => {
          t.render();
          t.expectElement('form', 'Keep the <form> from the starter (RecruitForm).');
          t.expectElement('input[name="name"]', 'The form needs an <input name="name">.');
          t.expectElement('select[name="role"]', 'The form needs a <select name="role">.');
          t.expectElement('input[name="power"]', 'The form needs an <input name="power" type="number">.');
          t.button('Recruit');
          const heroes = t.$$('li.hero').map((li) => norm(li.textContent));
          t.expect(heroes.length === 2, `The roster shows ${heroes.length} li.hero element(s) — expected the 2 starting heroes.`);
          t.expect(
            heroes[0].includes('Ada') && heroes[0].includes('Mage') && heroes[0].includes('80'),
            `The first hero reads "${heroes[0]}" — expected Ada, her role (Mage) and power (80).`,
          );
        }),
        test('RecruitForm validates as you type and disables Recruit', (t) => {
          const { RecruitForm } = t.exports;
          t.expect(typeof RecruitForm === 'function', 'Export the form: export function RecruitForm({ takenNames, onRecruit }) { ... }');
          t.renderComponent(RecruitForm, { takenNames: ['Ada', 'Linus'], onRecruit: () => {} });
          const button = () => t.button('Recruit');
          const expectErrors = (expected, when, tip = '') => {
            const got = t.$$('.error').map((el) => norm(el.textContent));
            const same = got.length === expected.length && [...got].sort().every((g, i) => g === [...expected].sort()[i]);
            t.expect(
              same,
              `${when}, the form shows ${got.length ? list(got) : 'no errors'} — expected ${
                expected.length ? `${list(expected)} in a <p className="error">` : 'no errors'
              }.${tip ? ' ' + tip : ''}`,
            );
          };
          expectErrors([], 'Before typing anything', "Only show a field's error while that field isn't empty: {name !== '' && nameError && <p className=\"error\">...</p>}.");
          t.expect(button().disabled, 'With empty fields the Recruit button should be disabled: disabled={!isValid}.');
          t.type('input[name="name"]', 'G');
          expectErrors(['Name must be at least 2 characters.'], 'With the name "G"');
          t.type('input[name="name"]', 'ada');
          expectErrors(['That name is already taken.'], 'With the name "ada" (Ada is in takenNames — ignore upper/lower case)');
          t.type('input[name="name"]', 'Grace');
          expectErrors([], 'With the name "Grace" and an empty power', 'An empty power is invalid, but its error stays hidden until something is typed.');
          t.expect(button().disabled, 'The power is still empty, so Recruit must stay disabled — an empty field is invalid.');
          t.type('input[name="power"]', '150');
          expectErrors(['Power must be between 1 and 100.'], 'With the power 150');
          t.expect(button().disabled, 'With an invalid power, Recruit must be disabled.');
          t.type('input[name="power"]', '0');
          expectErrors(['Power must be between 1 and 100.'], 'With the power 0');
          t.type('input[name="power"]', '90');
          expectErrors([], 'With "Grace" and power 90');
          t.expect(!button().disabled, 'With a valid name and power, the Recruit button should be enabled.');
        }),
        test('RecruitForm reports the hero up with onRecruit, then resets', (t) => {
          const { RecruitForm } = t.exports;
          t.expect(typeof RecruitForm === 'function', 'Export the form: export function RecruitForm({ takenNames, onRecruit }) { ... }');
          const recruits = [];
          t.renderComponent(RecruitForm, { takenNames: ['Ada'], onRecruit: (hero) => recruits.push(hero) });
          t.type('input[name="name"]', 'A');
          t.submit('form');
          t.expect(recruits.length === 0, 'Submitting while the form is invalid must not call onRecruit — return early from handleSubmit.');
          t.type('input[name="name"]', '  Grace  ');
          t.change('select[name="role"]', 'Ranger');
          t.type('input[name="power"]', '90');
          t.submit('form');
          t.expect(recruits.length === 1, `onRecruit was called ${recruits.length} time(s) after a valid submit — expected once. Call onRecruit({ name, role, power }) in handleSubmit.`);
          t.expect(
            t.blockedNavigations.length === 0,
            'Submitting the form tried to reload the page. Call e.preventDefault() first thing in handleSubmit.',
          );
          const hero = recruits[0] || {};
          t.expect(
            hero.name === 'Grace' && hero.role === 'Ranger' && hero.power === 90,
            `onRecruit received ${JSON.stringify(hero)} — expected {"name":"Grace","role":"Ranger","power":90}: the trimmed name, and the power as a number (Number(power)).`,
          );
          const name = t.find('input[name="name"]').value;
          const power = t.find('input[name="power"]').value;
          const role = t.find('select[name="role"]').value;
          t.expect(
            name === '' && power === '' && role === 'Mage',
            `After recruiting, the fields are name "${name}", role "${role}", power "${power}" — reset them to "", "Mage" and "".`,
          );
        }),
        test('Recruiting adds the hero to the roster, and the stats are derived', (t) => {
          t.render();
          const stats = () => norm(t.$('.stats')?.textContent);
          const statsRe = (n, total, avg) => new RegExp(`Party size:\\s*${n}\\b.*Total power:\\s*${total}\\b.*Average power:\\s*${avg}\\b`);
          t.expect(statsRe(2, 150, 75).test(stats()), `The stats read "${stats() || 'nothing'}" — expected "Party size: 2 · Total power: 150 · Average power: 75", computed from the roster.`);
          t.type('input[name="name"]', 'Grace');
          t.change('select[name="role"]', 'Ranger');
          t.type('input[name="power"]', '90');
          t.submit('form');
          const heroes = t.$$('li.hero').map((li) => norm(li.textContent));
          t.expect(heroes.length === 3, `After recruiting Grace the roster has ${heroes.length} hero(es) — expected 3. Pass onRecruit={(hero) => setHeroes([...heroes, hero])}.`);
          const grace = heroes[2] || '';
          t.expect(grace.includes('Grace') && grace.includes('Ranger') && grace.includes('90'), `The new hero reads "${grace}" — expected Grace the Ranger with power 90, at the end of the roster.`);
          t.expect(statsRe(3, 240, 80).test(stats()), `The stats read "${stats()}" — expected "Party size: 3 · Total power: 240 · Average power: 80".`);
        }),
        test('Dismissing heroes updates the roster, the stats and the taken names', (t) => {
          t.render();
          const stats = () => norm(t.$('.stats')?.textContent);
          const statsRe = (n, total, avg) => new RegExp(`Party size:\\s*${n}\\b.*Total power:\\s*${total}\\b.*Average power:\\s*${avg}\\b`);
          const dismiss = (name) => {
            const li = findByText(t, 'li.hero', name);
            t.expect(li, `Could not find ${name} in the roster.`);
            const btn = Array.from(li.querySelectorAll('button')).find((b) => /dismiss/i.test(b.textContent));
            t.expect(btn, `${name}'s <li className="hero"> needs a Dismiss button.`);
            t.click(btn);
          };
          dismiss('Ada');
          t.expect(t.count('li.hero') === 1 && !findByText(t, 'li.hero', 'Ada'), 'Clicking Dismiss on Ada should remove her: setHeroes(heroes.filter((h) => h.name !== hero.name)).');
          t.expect(statsRe(1, 70, 70).test(stats()), `With only Linus left the stats read "${stats()}" — expected "Party size: 1 · Total power: 70 · Average power: 70".`);
          dismiss('Linus');
          t.expect(
            statsRe(0, 0, 0).test(stats()),
            `With an empty party the stats read "${stats()}" — expected "Party size: 0 · Total power: 0 · Average power: 0". Guard the average against 0 / 0 (NaN).`,
          );
          t.type('input[name="name"]', 'Ada');
          t.expect(!t.hasText('That name is already taken.'), 'Ada was dismissed, so her name is free again. Derive takenNames from the roster: heroes.map((h) => h.name).');
          t.type('input[name="power"]', '80');
          t.submit('form');
          t.expect(t.count('li.hero') === 1 && findByText(t, 'li.hero', 'Ada'), 'Recruiting Ada again should add her back to the roster.');
        }),
      ],
      concepts: [
        {
          id: 'citadel-derived-validation',
          icon: '✅',
          title: 'Validation is derived',
          summary: 'Compute errors from the current field values during render — no error state, no effect.',
          snippet: code`
            const nameError = name.trim().length < 2 ? 'Too short.' : '';
            const isValid = !nameError;
            <button disabled={!isValid}>Save</button>
          `,
        },
        {
          id: 'citadel-data-down-events-up',
          icon: '📨',
          title: 'Data down, events up',
          summary: 'A child form owns its draft and reports finished values to the parent through a callback prop.',
          snippet: code`
            <RecruitForm
              takenNames={heroes.map((h) => h.name)}
              onRecruit={(hero) => setHeroes([...heroes, hero])}
            />
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'citadel-observatory',
      type: 'build',
      title: 'The Fogged Observatory',
      blurb: 'Stop wasted renders with memo, useCallback and useMemo — and reset state with a key.',
      xp: 160,
      story: [
        { text: "The Observatory! From up here you can see every star in Reactoria… if the telescope weren't so foggy.", mood: 'thinking' },
        { text: 'Every tiny pulse re-renders every star, and notes about one star leak into the next. Polish the lens with memo, useCallback and useMemo — and one well-placed key.', mood: 'happy' },
      ],
      lesson: md`
        ## Field guide: renders on a budget

        ### Why did it render?

        A component re-renders when **its state changes**, when **its parent re-renders**, or when **a context it
        reads changes**. The second rule is why one click in \`App\` re-runs every row below it.

        ### memo: skip when the props are equal

        \`\`\`jsx
        const Row = memo(function Row({ item, onPick }) {
          return <li onClick={() => onPick(item.id)}>{item.name}</li>;
        });
        \`\`\`

        \`memo\` compares each prop with \`Object.is\`. Numbers, strings and booleans compare by value, but objects,
        arrays and functions compare by **identity**. A function created during render is a *new* function every
        time — and silently defeats \`memo\`.

        ### useCallback: the same function across renders

        \`\`\`jsx
        // ❌ a new function whenever picked changes → every Row re-renders
        const pick = useCallback((id) => setPicked([...picked, id]), [picked]);

        // ✅ updater form: no dependencies, created once
        const pick = useCallback((id) => setPicked((prev) => [...prev, id]), []);
        \`\`\`

        State setters never change, so you can also pass \`setSelectedId\` straight down.

        ### useMemo: don't redo expensive work

        \`\`\`jsx
        const visible = useMemo(() => expensiveFilter(items, query), [items, query]);
        \`\`\`

        The function only runs again when a dependency changes. As a bonus, \`visible\` stays the *same array* between
        renders, so memoized children that receive it stay happy too.

        ### Measure, don't guess

        A \`console.log\` inside a component is a quick render counter (the React DevTools Profiler is the grown-up
        version). Optimise what the numbers show, and only that.

        ### key: a fresh start

        React keeps state by **position** in the tree: same component in the same place → same state, even when its props
        change. To start over, change its \`key\`:

        \`\`\`jsx
        <ChatBox key={friend.id} friend={friend} />
        \`\`\`

        A new key means a brand-new instance with fresh state.

        :::pro
        For really huge lists, \`useDeferredValue(query)\` lets the input update instantly while the list catches up in
        the background. And the React Compiler can add most of this memoisation for you — but knowing *why* it works is
        what lets you debug it.
        :::
      `,
      task: md`
        ## 🎯 Polish the lens

        The Observatory works — it just wastes renders. \`StarRow\` and \`filterStars\` each \`console.log\` when they run.
        **Keep both lines:** the checks count them.

        - Pressing **✨ Pulse the lens** must re-render **no** \`StarRow\`. Wrap \`StarRow\` in \`memo\` and make every prop you pass it stable.
        - Pulsing must not call \`filterStars\` either: compute \`visible\` with \`useMemo\`, depending only on \`query\`.
        - Toggling a favorite (☆/★) must re-render **only that one row**. A callback that depends on \`favorites\` changes on every toggle — use the updater form \`setFavorites((favs) => ...)\` so \`useCallback\` needs no dependencies.
        - Selecting a star must open a **fresh** logbook: notes typed for one star must not show up for the next. Reset \`Logbook\`'s state with a \`key\`.

        Search, the favorites counter (\`.favorites\`), the pulse counter (\`.pulses\`) and selection must keep working.
      `,
      css: `
        .observatory { background: #0b1026; color: #e9ecff; border-radius: 14px; padding: 12px 14px; }
        .observatory h1, .observatory h2 { color: #ffffff; }
        .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .toolbar span { color: #a5b4fc; font-weight: 600; }
        .search { width: 100%; }
        .catalogue { max-height: 240px; overflow: auto; padding-left: 0; }
        .star { list-style: none; display: flex; align-items: center; gap: 8px; padding: 1px 0; }
        .star .name { background: #364fc7; box-shadow: 0 3px 0 #1c2d8a; padding: 3px 10px; }
        .star.selected .name { background: #f59f00; box-shadow: 0 3px 0 #b36b00; }
        .mag { font-size: 0.85em; color: #a5b4fc; }
        .fav { background: transparent; box-shadow: none; color: #fcc419; font-size: 1.2em; padding: 2px 6px; }
        .fav:hover { background: rgba(255, 255, 255, 0.1); }
        .logbook { background: #151c3f; border-radius: 12px; padding: 8px 12px; margin-top: 10px; }
        .logbook textarea { width: 100%; min-height: 60px; }
        .chars { color: #a5b4fc; font-size: 0.85em; }
      `,
      starter: code`
        import { memo, useCallback, useMemo, useState } from 'react';

        const NAMES = ['Vega', 'Rigel', 'Altair', 'Deneb', 'Sirius', 'Polaris', 'Antares', 'Capella'];
        const STARS = Array.from({ length: 40 }, (_, i) => ({
          id: i + 1,
          name: NAMES[i % NAMES.length] + ' ' + (Math.floor(i / NAMES.length) + 1),
          magnitude: ((i * 37) % 60) / 10,
        }));

        // Imagine this is slow: the real sky has millions of stars.
        function filterStars(stars, query) {
          console.log('filtering stars'); // keep me: the checks count these
          const needle = query.trim().toLowerCase();
          return stars.filter((star) => star.name.toLowerCase().includes(needle));
        }

        function StarRow({ star, isFavorite, isSelected, onToggleFavorite, onSelect }) {
          console.log('render StarRow'); // keep me: the checks count these
          return (
            <li className={isSelected ? 'star selected' : 'star'}>
              <button className="name" onClick={() => onSelect(star.id)}>
                {star.name}
              </button>
              <span className="mag">mag {star.magnitude.toFixed(1)}</span>
              <button className="fav" onClick={() => onToggleFavorite(star.id)}>
                {isFavorite ? '★' : '☆'}
              </button>
            </li>
          );
        }

        function Logbook({ star }) {
          const [entry, setEntry] = useState('');
          return (
            <section className="logbook">
              <h2>Logbook: {star.name}</h2>
              <textarea value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="What do you see?" />
              <p className="chars">{entry.length} characters</p>
            </section>
          );
        }

        export default function App() {
          const [query, setQuery] = useState('');
          const [favorites, setFavorites] = useState([]);
          const [selectedId, setSelectedId] = useState(1);
          const [pulses, setPulses] = useState(0);

          const visible = filterStars(STARS, query);
          const selected = STARS.find((star) => star.id === selectedId);

          return (
            <div className="observatory">
              <h1>🔭 The Observatory</h1>
              <div className="toolbar">
                <button className="pulse" onClick={() => setPulses((p) => p + 1)}>
                  ✨ Pulse the lens
                </button>
                <span className="pulses">Pulses: {pulses}</span>
                <span className="favorites">Favorites: {favorites.length}</span>
              </div>
              <input
                className="search"
                placeholder="Search the stars…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="catalogue">
                {visible.map((star) => (
                  <StarRow
                    key={star.id}
                    star={star}
                    isFavorite={favorites.includes(star.id)}
                    isSelected={star.id === selectedId}
                    onToggleFavorite={(id) =>
                      setFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id])
                    }
                    onSelect={(id) => setSelectedId(id)}
                  />
                ))}
              </ul>
              <Logbook star={selected} />
            </div>
          );
        }
      `,
      solution: code`
        import { memo, useCallback, useMemo, useState } from 'react';

        const NAMES = ['Vega', 'Rigel', 'Altair', 'Deneb', 'Sirius', 'Polaris', 'Antares', 'Capella'];
        const STARS = Array.from({ length: 40 }, (_, i) => ({
          id: i + 1,
          name: NAMES[i % NAMES.length] + ' ' + (Math.floor(i / NAMES.length) + 1),
          magnitude: ((i * 37) % 60) / 10,
        }));

        function filterStars(stars, query) {
          console.log('filtering stars');
          const needle = query.trim().toLowerCase();
          return stars.filter((star) => star.name.toLowerCase().includes(needle));
        }

        const StarRow = memo(function StarRow({ star, isFavorite, isSelected, onToggleFavorite, onSelect }) {
          console.log('render StarRow');
          return (
            <li className={isSelected ? 'star selected' : 'star'}>
              <button className="name" onClick={() => onSelect(star.id)}>
                {star.name}
              </button>
              <span className="mag">mag {star.magnitude.toFixed(1)}</span>
              <button className="fav" onClick={() => onToggleFavorite(star.id)}>
                {isFavorite ? '★' : '☆'}
              </button>
            </li>
          );
        });

        function Logbook({ star }) {
          const [entry, setEntry] = useState('');
          return (
            <section className="logbook">
              <h2>Logbook: {star.name}</h2>
              <textarea value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="What do you see?" />
              <p className="chars">{entry.length} characters</p>
            </section>
          );
        }

        export default function App() {
          const [query, setQuery] = useState('');
          const [favorites, setFavorites] = useState([]);
          const [selectedId, setSelectedId] = useState(1);
          const [pulses, setPulses] = useState(0);

          const visible = useMemo(() => filterStars(STARS, query), [query]);
          const selected = STARS.find((star) => star.id === selectedId);

          const toggleFavorite = useCallback((id) => {
            setFavorites((favs) => (favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]));
          }, []);

          return (
            <div className="observatory">
              <h1>🔭 The Observatory</h1>
              <div className="toolbar">
                <button className="pulse" onClick={() => setPulses((p) => p + 1)}>
                  ✨ Pulse the lens
                </button>
                <span className="pulses">Pulses: {pulses}</span>
                <span className="favorites">Favorites: {favorites.length}</span>
              </div>
              <input
                className="search"
                placeholder="Search the stars…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="catalogue">
                {visible.map((star) => (
                  <StarRow
                    key={star.id}
                    star={star}
                    isFavorite={favorites.includes(star.id)}
                    isSelected={star.id === selectedId}
                    onToggleFavorite={toggleFavorite}
                    onSelect={setSelectedId}
                  />
                ))}
              </ul>
              <Logbook key={selectedId} star={selected} />
            </div>
          );
        }
      `,
      hints: [
        md`Wrap the row: \`const StarRow = memo(function StarRow({ star, isFavorite, isSelected, onToggleFavorite, onSelect }) { ... });\` — keep the \`console.log\` inside. On its own that's not enough: the inline arrow functions passed as \`onToggleFavorite\` and \`onSelect\` are brand new on every render.`,
        md`\`const visible = useMemo(() => filterStars(STARS, query), [query]);\` and \`const toggleFavorite = useCallback((id) => { setFavorites((favs) => favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]); }, []);\` For selecting, pass the setter itself: \`onSelect={setSelectedId}\`.`,
        md`For the logbook, render \`<Logbook key={selectedId} star={selected} />\`. A new key means a brand-new \`Logbook\` with an empty \`entry\`.`,
      ],
      tests: [
        test('The catalogue renders and the search filters it', (t) => {
          t.render();
          const rows = t.count('li.star');
          t.expect(rows === 40, `The catalogue shows ${rows} li.star row(s) — expected all 40 stars.`);
          t.expect(countLogs(t, 'render StarRow') >= 40, "Keep the console.log('render StarRow') line at the top of StarRow — the checks count renders with it.");
          t.expect(countLogs(t, 'filtering stars') >= 1, "Keep the console.log('filtering stars') line inside filterStars — the checks count calls with it.");
          t.type('input.search', 'VEGA');
          const names = t.$$('li.star').map((li) => norm(li.querySelector('.name')?.textContent));
          t.expect(
            names.length === 5 && names.every((n) => n.startsWith('Vega')),
            `Searching "VEGA" shows ${names.length} star(s) — expected the 5 Vega stars. Keep filtering with filterStars(STARS, query).`,
          );
        }),
        test('Pulsing the lens re-renders no StarRow (memo + stable props)', (t) => {
          t.render();
          clearLogs(t);
          t.click('button.pulse');
          const pulses = norm(t.$('.pulses')?.textContent);
          t.expect(pulses === 'Pulses: 1', `After one pulse the counter reads "${pulses}" — expected "Pulses: 1".`);
          const renders = countLogs(t, 'render StarRow');
          t.expect(
            renders === 0,
            `Pulsing re-rendered ${renders} StarRow(s) — expected 0. A pulse changes nothing about the rows, so: (1) define StarRow with memo(...) outside App, and (2) pass only stable props — useCallback for onToggleFavorite, and setSelectedId itself for onSelect (inline arrow functions are new on every render).`,
          );
        }),
        test('Pulsing the lens skips filterStars (useMemo)', (t) => {
          t.render();
          clearLogs(t);
          t.click('button.pulse');
          const filters = countLogs(t, 'filtering stars');
          t.expect(
            filters === 0,
            `Pulsing called filterStars ${filters} time(s) — expected 0. The query didn't change, so reuse the last result: const visible = useMemo(() => filterStars(STARS, query), [query]);`,
          );
          t.type('input.search', 'rigel');
          t.expect(countLogs(t, 'filtering stars') >= 1, 'Typing a new query must still call filterStars — make query a dependency of the useMemo.');
          t.expect(t.count('li.star') === 5, `Searching "rigel" shows ${t.count('li.star')} star(s) — expected 5.`);
        }),
        test('Favoriting a star re-renders only that one row', (t) => {
          t.render();
          const firstFav = () => t.$('li.star button.fav');
          clearLogs(t);
          t.click(firstFav());
          const favs = norm(t.$('.favorites')?.textContent);
          t.expect(favs === 'Favorites: 1', `After favoriting a star the counter reads "${favs}" — expected "Favorites: 1".`);
          t.expect(norm(firstFav().textContent) === '★', 'The favorited row should show ★.');
          let renders = countLogs(t, 'render StarRow');
          t.expect(
            renders === 1,
            `Favoriting one star re-rendered ${renders} StarRow(s) — expected exactly 1. ${
              renders > 1
                ? 'Every other row must receive exactly the same props as before: StarRow wrapped in memo, onSelect stable (pass setSelectedId), and a toggle callback that is created once — a useCallback that depends on favorites changes on every toggle, so use the updater form: useCallback((id) => setFavorites((favs) => ...), []).'
                : 'The favorited row itself must re-render to show ★ — keep the console.log in StarRow.'
            }`,
          );
          clearLogs(t);
          t.click(firstFav());
          t.expect(norm(t.$('.favorites')?.textContent) === 'Favorites: 0', 'Clicking ★ again should remove the favorite ("Favorites: 0").');
          renders = countLogs(t, 'render StarRow');
          t.expect(renders === 1, `Un-favoriting re-rendered ${renders} StarRow(s) — expected exactly 1.`);
        }),
        test('Each star gets a fresh logbook (reset state with a key)', (t) => {
          t.render();
          const heading = () => norm(t.$('.logbook h2')?.textContent);
          t.expect(heading() === 'Logbook: Vega 1', `The logbook heading reads "${heading() || 'nothing'}" — expected "Logbook: Vega 1" for the first selected star.`);
          t.type('.logbook textarea', 'A blue giant, very bright');
          const rigel = findByText(t, 'li.star', 'Rigel 1');
          t.click(rigel.querySelector('button.name'));
          t.expect(heading() === 'Logbook: Rigel 1', `After selecting Rigel 1 the logbook heading reads "${heading()}" — selection must keep working (onSelect → setSelectedId).`);
          t.expect(findByText(t, 'li.star.selected', 'Rigel 1'), 'The selected row should get className "star selected".');
          const notes = t.find('.logbook textarea').value;
          t.expect(
            notes === '',
            `The logbook for Rigel 1 still contains "${notes}" — the notes leaked from Vega 1. React kept Logbook's state because it sits in the same place. Give it a key: <Logbook key={selectedId} star={selected} />.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'citadel-memo-trio',
          icon: '🔭',
          title: 'The memo trio',
          summary: 'memo skips a child when its props are equal; useCallback and useMemo keep those props equal.',
          snippet: code`
            const Row = memo(function Row({ item, onPick }) { ... });
            const pick = useCallback((id) => setPicked((p) => [...p, id]), []);
            const visible = useMemo(() => filter(items, query), [items, query]);
          `,
          detail: 'They only work as a team: one unstable prop and memo compares in vain.',
        },
        {
          id: 'citadel-key-reset',
          icon: '🗝️',
          title: 'Reset with a key',
          summary: "Changing a component's key gives it a brand-new instance with fresh state.",
          snippet: code`
            <Logbook key={selectedId} star={selected} />
          `,
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'citadel-mirror-maze',
      type: 'quiz',
      title: 'The Mirror Maze',
      blurb: 'Eight mirrors, eight tricky reflections. Only the truth gets you through.',
      xp: 100,
      story: [
        { text: 'The Mirror Maze! Each mirror shows a piece of React code and four reflections of what it does. Only one reflection is true.', mood: 'thinking' },
        { text: "The Mutator built this maze out of the mistakes he hopes you'll make. Trust what you've learned, not what merely looks right!", mood: 'excited' },
      ],
      task: md`
        Eight mirrors, one from every corner of Reactoria. Each answer comes with an explanation, so even a wrong turn
        teaches you something. A perfect run earns **3 stars**.
      `,
      questions: [
        q(
          md`
            The button is clicked **once**. What does it show afterwards?

            \`\`\`jsx
            function ManaCrystal() {
              const [mana, setMana] = useState(0);
              function charge() {
                setMana(mana + 1);
                setMana(mana + 1);
                setMana((m) => m + 1);
              }
              return <button onClick={charge}>Mana: {mana}</button>;
            }
            \`\`\`
          `,
          ['`Mana: 1`', '`Mana: 2`', '`Mana: 3`', '`Mana: 0`'],
          1,
          md`During this click \`mana\` is a **snapshot**: it is \`0\` the whole time. The first two calls both queue "replace with \`0 + 1\`". The updater then receives the *queued* value, \`1\`, and returns \`2\`. Whenever the next state depends on the previous one, reach for the updater form.`,
        ),
        q(
          md`
            What appears on screen when \`recruit\` runs?

            \`\`\`jsx
            const [party, setParty] = useState(['Ada']);

            function recruit() {
              party.push('Linus');
              setParty(party);
            }
            \`\`\`
          `,
          [
            'Linus joins the list on screen',
            'An error: "Cannot mutate state"',
            'Nothing changes: React received the same array, so it skips the re-render',
            'Linus appears twice',
          ],
          2,
          md`React compares the old and new state with \`Object.is\`. \`push\` changed the array *in place*, so \`setParty\` receives the very same array and React concludes nothing changed. Linus is in the array, but invisible until something else re-renders — the Mutator's favourite trick. Replace instead of mutating: \`setParty([...party, 'Linus'])\`.`,
        ),
        q(
          md`
            What does this component do?

            \`\`\`jsx
            function QuestLog() {
              const [quests, setQuests] = useState([]);

              useEffect(() => {
                fetch('/api/quests')
                  .then((res) => res.json())
                  .then((data) => setQuests(data));
              });

              return <p>{quests.length} quests</p>;
            }
            \`\`\`
          `,
          [
            'It fetches once, when the component first appears',
            'It never fetches: an effect needs a dependency array to run',
            'React refuses to run an effect that sets state',
            'It fetches, stores, re-renders, fetches again… forever',
          ],
          3,
          md`Without a dependency array, an effect runs after **every** render. Each response is a brand-new array, so \`setQuests\` triggers a render, which runs the effect, which fetches again — an infinite loop. Add \`[]\` to fetch once on mount, plus an \`ignore\` flag in the cleanup to drop stale answers.`,
        ),
        q(
          md`
            Every \`QuestRow\` keeps its own \`note\` in state (a text input). You type a note into the **first** row,
            then delete the first quest. What happens?

            \`\`\`jsx
            {quests.map((quest, index) => (
              <QuestRow key={index} quest={quest} onDelete={remove} />
            ))}
            \`\`\`
          `,
          [
            'Your note now sits next to the quest that used to be second',
            'Your note disappears together with the deleted quest',
            'React throws a duplicate-key error',
            'Every note in the list is cleared',
          ],
          0,
          md`React matches components to items by **key**. After the delete, the old second quest renders at index \`0\` — with key \`0\` — so it inherits key 0's state: your note. The last key disappears and takes the last row's state with it. Stable ids (\`key={quest.id}\`) keep state attached to the right item.`,
        ),
        q(
          md`
            The button is clicked **three** times. What does it say?

            \`\`\`jsx
            function Clicker() {
              const clicks = useRef(0);
              return (
                <button onClick={() => { clicks.current += 1; }}>
                  Clicked {clicks.current} times
                </button>
              );
            }
            \`\`\`
          `,
          ['`Clicked 3 times`', '`Clicked 0 times`', '`Clicked 1 times`', 'It crashes: refs are read-only'],
          1,
          md`Changing \`ref.current\` never triggers a re-render. The ref *does* hold \`3\`, but the screen still shows the output of the only render that ever happened. Use state for anything the screen displays; keep refs for values that don't affect the output, like timer ids and DOM nodes.`,
        ),
        q(
          md`
            \`ThemeToggle\` and \`Sidebar\` each call
            \`const [theme, setTheme] = useLocalStorage('theme', 'dark')\` — the same custom hook with the same key.
            \`ThemeToggle\` calls \`setTheme('light')\`. What happens to \`Sidebar\`?
          `,
          [
            'It switches to light too: both use the same hook',
            'React throws because two components share a storage key',
            'Both components reset to "dark"',
            'It stays dark: each call to the hook has its own state',
          ],
          3,
          md`Custom hooks share **logic**, not state. Each call runs its own \`useState\` inside, so \`Sidebar\` never hears about the change (it would only read "light" from storage after re-mounting). To share live state, lift it up to a common parent or put it in context.`,
        ),
        q(
          md`
            \`ThemeContext\`'s value changes from \`'dark'\` to \`'light'\`, while \`Badge\`'s props stay exactly the same.
            What happens?

            \`\`\`jsx
            const Badge = memo(function Badge({ name }) {
              const theme = useContext(ThemeContext);
              return <span className={theme}>{name}</span>;
            });
            \`\`\`
          `,
          [
            '`Badge` re-renders with the new theme: context changes go straight through `memo`',
            '`Badge` keeps the old theme: `memo` blocks it because its props are equal',
            '`Badge` only updates if its parent re-renders too',
            'It crashes: `memo` components cannot read context',
          ],
          0,
          md`\`memo\` only skips re-renders caused by a parent passing equal props. A component that reads a context **always** re-renders when that context's value changes. (That's also why splitting state and dispatch into two contexts helps: components that only dispatch aren't disturbed by state changes.)`,
        ),
        q(
          md`
            The user clicks the heart once, and \`sendLike()\` fails. What does the button show?

            \`\`\`jsx
            const [likes, setLikes] = useState(10);
            const [shownLikes, addLike] = useOptimistic(likes, (current, n) => current + n);

            async function likeAction() {
              addLike(1);
              try {
                await sendLike(); // ❌ the server says no
                startTransition(() => setLikes((l) => l + 1));
              } catch {
                // ignore the failure
              }
            }

            // <form action={likeAction}><button>❤️ {shownLikes}</button></form>
            \`\`\`
          `,
          [
            '`❤️ 11` forever: optimistic updates are permanent',
            '`❤️ 10` the whole time: optimistic values only appear after success',
            '`❤️ 11` while the action runs, then back to `❤️ 10`',
            'An error screen, because the request failed',
          ],
          2,
          md`\`useOptimistic\` shows a temporary value only **while the action is pending**. When the action finishes, React drops the optimistic layer and shows the real state again — and \`likes\` is still \`10\`, because \`setLikes\` never ran. Instant feedback with automatic rollback, no cleanup code needed.`,
        ),
      ],
      concepts: [
        {
          id: 'citadel-snapshots',
          icon: '🪞',
          title: 'Think in snapshots',
          summary: 'Each render sees fixed props and state; setters schedule the next render instead of changing this one.',
          snippet: code`
            // during this click, count is 0 the whole time
            setCount(count + 1);    // "make it 0 + 1"
            setCount((c) => c + 1); // "take the latest value and add 1"
          `,
          detail: 'Almost every "what happens?" puzzle in React dissolves once you remember: a render is a snapshot, and changes only show up in the next one.',
        },
      ],
    },

    // ---------------------------------------------------------------- 6 (final boss)
    {
      id: 'citadel-mutator',
      type: 'build',
      boss: true,
      final: true,
      title: 'Final Boss: The Mutator',
      bossName: 'The Mutator',
      bossIcon: '🦹',
      blurb: 'The Mutator himself. Build the Quest Board he cannot corrupt — and end this.',
      xp: 500,
      badge: {
        id: 'badge-citadel',
        name: 'Render Mage',
        icon: '👑',
        description: 'Defeated the Mutator and set all of Reactoria re-rendering again. Same input, same output — forever.',
      },
      story: [
        { text: "There he is. THE MUTATOR. He's clutching the Quest Board and pushing chaos straight into it — board.push(), board.splice() — no new state, no re-render. The whole world can't see a thing.", mood: 'worried' },
        { text: "He's laughing: 'Your precious React can't even tell I changed it!' Then let's build a board he can't touch: summoned from the archive, ruled by a pure reducer, remembered across reloads.", mood: 'thinking' },
        { text: "Every check you pass cracks his crown. This is everything you've learned, Render Mage. Let's end this!", mood: 'excited' },
      ],
      lesson: md`
        ## The blueprint

        \`\`\`
        fetch('/api/quests') ──┐
        user events ───────────┤
                               ▼
                   dispatch(action)
                               ▼
              questReducer(quests, action)
                               ▼
          quests ── saved by usePersistentReducer
                               ▼
         derived: visible, doneCount, victory
                               ▼
                              UI
        \`\`\`

        One reducer owns the quests. Everything else is an **event** that dispatches, an **effect** that syncs with the
        outside world (the archive, \`localStorage\`), or a **value derived** during render.

        ### Array updates cheat sheet

        | change | immutable code |
        |---|---|
        | add | \`[...items, newItem]\` |
        | update one | \`items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))\` |
        | remove | \`items.filter((i) => i.id !== id)\` |
        | next id | \`items.reduce((max, i) => Math.max(max, i.id), 0) + 1\` |

        The next-id trick is pure — computed from the state, no \`Date.now()\` or randomness — and gives **1** for an empty
        list. (\`Math.max(...[]) + 1\` would be \`-Infinity\`!)

        ### Lazy initial state

        \`useReducer\` takes an optional third argument: an **init** function that React calls *once*, on the first render,
        with the second argument:

        \`\`\`js
        const [clicks, dispatch] = useReducer(clickReducer, 0, (fallback) => {
          try {
            const saved = localStorage.getItem('clicks');
            return saved !== null ? JSON.parse(saved) : fallback;
          } catch {
            return fallback; // a corrupted save shouldn't crash the app
          }
        });
        \`\`\`

        Saving is a side effect, so it lives in an effect:

        \`\`\`js
        useEffect(() => {
          localStorage.setItem('clicks', JSON.stringify(clicks));
        }, [clicks]);
        \`\`\`

        Put both in a function called \`use...\` that takes the reducer, the key and the initial state, and you have a
        hook that works just like \`useReducer\` — but remembers.

        ### Fetch only when needed

        \`\`\`js
        const loading = items === null;
        useEffect(() => {
          if (!loading) return; // saved data? nothing to fetch
          let ignore = false;
          // fetch ... then: if (!ignore) dispatch({ type: 'loaded', ... })
          return () => { ignore = true; };
        }, [loading]);
        \`\`\`

        Depending on \`loading\` means the effect runs again whenever the state goes back to \`null\` — which is how a
        **Reset** button can summon fresh data.

        ### Derive, don't store

        \`\`\`js
        const visible = filter === 'done' ? items.filter((i) => i.done) : items; // ...and so on
        const doneCount = items.filter((i) => i.done).length;
        \`\`\`

        :::mistake
        Hooks before returns! Every hook — your own included — must run on every render, in the same order. Put the
        fetch \`useEffect\` **above** \`if (loading) return ...\`, never below it.
        :::

        :::story
        They say the Mutator was once a Render Mage, until he grew impatient with copies. "Why make a new array," he
        sneered, "when I can just *push*?" React never noticed his changes, the world stopped re-rendering, and Reactoria
        froze. His weakness is the oldest rule in the land: **never mutate — replace.**
        :::
      `,
      task: md`
        ## 👑 Build the Quest Board

        The starter has the layout. Bring it to life — every part of it is something you've mastered on the way up.

        ### 1. \`questReducer(quests, action)\` (exported)

        The state is \`null\` while loading, then an array of \`{ id, title, done }\`. Never mutate: the checks freeze it.

        | action | returns |
        |---|---|
        | \`{ type: 'loaded', quests }\` | the \`quests\` from the action |
        | \`{ type: 'added', title }\` | a new array ending with \`{ id, title, done: false }\`, where \`id\` is the highest id + 1 (or **1** on an empty board) |
        | \`{ type: 'toggled', id }\` | that quest with \`done\` flipped |
        | \`{ type: 'deleted', id }\` | the quests without that one |
        | \`{ type: 'reset' }\` | \`null\` |

        ### 2. \`usePersistentReducer(reducer, key, initialState)\` (exported)

        - Works like \`useReducer\` and returns \`[state, dispatch]\`.
        - Starts from \`JSON.parse(localStorage.getItem(key))\` when something is saved, otherwise from \`initialState\`.
        - Saves \`JSON.stringify(state)\` under \`key\` whenever the state changes.
        - The board calls it as \`usePersistentReducer(questReducer, 'citadel-quests', null)\`.

        ### 3. Summon the quests

        - While the state is \`null\`, show \`<p className="loading">Summoning quests…</p>\`, \`fetch('/api/quests')\` and dispatch \`loaded\` with the JSON.
        - If quests were saved, **don't fetch** — and fetch again whenever the state goes back to \`null\`.

        ### 4. The board

        - The \`<form>\` with \`<input className="new-quest">\` adds a quest with the **trimmed** title, ignores blank titles and clears the input.
        - One \`<li className="quest">\` per visible quest (\`className="quest done"\` when done), with a checkbox that toggles it and a \`<button className="delete">\` that deletes it.
        - \`<nav className="tabs">\` has the buttons **All**, **Active** and **Done**; the selected one has \`className="active"\`.
        - \`<p className="summary">\` reads **X of Y quests done**, counting *all* quests whatever the tab.
        - When there is at least one quest and every quest is done, show \`<p className="victory">💥 The Mutator is defeated!</p>\`.
        - \`<button className="reset">\` dispatches \`reset\`.
      `,
      css: `
        .board { max-width: 560px; background: #fff9eb; border: 3px solid #e0c48c; border-radius: 16px; padding: 14px 18px; }
        .add { display: flex; gap: 6px; }
        .add input { flex: 1; }
        .tabs { margin: 6px 0; }
        .tabs button { background: #e9ecef; color: #495057; box-shadow: 0 3px 0 #ced4da; }
        .tabs button.active { background: #7048e8; color: white; box-shadow: 0 3px 0 #5435b8; }
        .quests { padding-left: 0; }
        .quest { list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #e0c48c; }
        .quest.done label { text-decoration: line-through; color: #868e96; }
        .delete { background: #e03131; box-shadow: 0 3px 0 #a51111; padding: 4px 10px; }
        .summary { font-weight: 700; }
        .victory { font-size: 1.3em; font-weight: 800; color: #d6336c; text-align: center; animation: mutator-fall 0.8s ease-in-out infinite alternate; }
        @keyframes mutator-fall { from { transform: scale(1); } to { transform: scale(1.06); } }
        .loading { font-style: italic; color: #7048e8; }
        .reset { background: #868e96; box-shadow: 0 3px 0 #495057; }
      `,
      routes: {
        '/api/quests': QUESTS,
      },
      starter: code`
        import { useEffect, useReducer, useState } from 'react';

        // ① THE REDUCER ─────────────────────────────────────────────
        // State: null while loading, then an array of { id, title, done }.
        // Every case returns NEW data. The Mutator mutates. You don't.
        export function questReducer(quests, action) {
          switch (action.type) {
            case 'loaded':
              // TODO: the quests from the action
              return quests;
            case 'added':
              // TODO: append { id: highest id + 1 (1 if empty), title: action.title, done: false }
              return quests;
            case 'toggled':
              // TODO: flip done on the quest whose id is action.id
              return quests;
            case 'deleted':
              // TODO: remove the quest whose id is action.id
              return quests;
            case 'reset':
              // TODO: back to null, so the board summons the quests again
              return quests;
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        // ② THE MEMORY ──────────────────────────────────────────────
        // Works like useReducer, but the state survives a reload.
        export function usePersistentReducer(reducer, key, initialState) {
          // TODO: start from the JSON saved under key (if any): useReducer's lazy init
          // TODO: save JSON.stringify(state) under key whenever the state changes
          return useReducer(reducer, initialState);
        }

        const FILTERS = [
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'done', label: 'Done' },
        ];

        function QuestItem({ quest, dispatch }) {
          return (
            <li className={quest.done ? 'quest done' : 'quest'}>
              <label>
                <input type="checkbox" checked={quest.done} onChange={() => { /* TODO: toggled */ }} />
                {quest.title}
              </label>
              <button className="delete" onClick={() => { /* TODO: deleted */ }}>
                Delete
              </button>
            </li>
          );
        }

        export default function App() {
          const [quests, dispatch] = usePersistentReducer(questReducer, 'citadel-quests', null);
          const [filter, setFilter] = useState('all');
          const [title, setTitle] = useState('');
          const loading = quests === null;

          // ③ THE SUMMONING ───────────────────────────────────────────
          // TODO: while loading, fetch('/api/quests') and dispatch { type: 'loaded', quests: data }.
          //       Use an ignore flag. Keep EVERY hook above the early return below!

          if (loading) {
            return (
              <div className="board">
                <h1>👑 The Quest Board</h1>
                <p className="loading">Summoning quests…</p>
              </div>
            );
          }

          // ④ DERIVED VALUES: computed during render, never stored ────
          const visible = quests; // TODO: apply the filter ('all' | 'active' | 'done')
          const doneCount = 0; // TODO
          const defeated = false; // TODO: at least one quest, and every quest done

          function handleAdd(e) {
            e.preventDefault();
            // TODO: ignore blank titles, dispatch 'added' with the trimmed title, clear the input
          }

          return (
            <div className="board">
              <h1>👑 The Quest Board</h1>
              <form className="add" onSubmit={handleAdd}>
                <input
                  className="new-quest"
                  placeholder="A new quest…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button type="submit">Add quest</button>
              </form>
              <nav className="tabs">
                {FILTERS.map((f) => (
                  // TODO: className "active" on the selected tab; clicking selects it
                  <button key={f.id}>{f.label}</button>
                ))}
              </nav>
              <ul className="quests">
                {visible.map((quest) => (
                  <QuestItem key={quest.id} quest={quest} dispatch={dispatch} />
                ))}
              </ul>
              <p className="summary">
                {doneCount} of {quests.length} quests done
              </p>
              {defeated && <p className="victory">💥 The Mutator is defeated!</p>}
              <button className="reset" onClick={() => { /* TODO: reset */ }}>
                ↺ Reset board
              </button>
            </div>
          );
        }
      `,
      solution: code`
        import { useEffect, useReducer, useState } from 'react';

        export function questReducer(quests, action) {
          switch (action.type) {
            case 'loaded':
              return action.quests;
            case 'added': {
              const nextId = quests.reduce((max, quest) => Math.max(max, quest.id), 0) + 1;
              return [...quests, { id: nextId, title: action.title, done: false }];
            }
            case 'toggled':
              return quests.map((quest) => (quest.id === action.id ? { ...quest, done: !quest.done } : quest));
            case 'deleted':
              return quests.filter((quest) => quest.id !== action.id);
            case 'reset':
              return null;
            default:
              throw new Error('Unknown action: ' + action.type);
          }
        }

        export function usePersistentReducer(reducer, key, initialState) {
          const [state, dispatch] = useReducer(reducer, initialState, (fallback) => {
            try {
              const saved = localStorage.getItem(key);
              return saved !== null ? JSON.parse(saved) : fallback;
            } catch {
              return fallback;
            }
          });

          useEffect(() => {
            localStorage.setItem(key, JSON.stringify(state));
          }, [key, state]);

          return [state, dispatch];
        }

        const FILTERS = [
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'done', label: 'Done' },
        ];

        function QuestItem({ quest, dispatch }) {
          return (
            <li className={quest.done ? 'quest done' : 'quest'}>
              <label>
                <input
                  type="checkbox"
                  checked={quest.done}
                  onChange={() => dispatch({ type: 'toggled', id: quest.id })}
                />
                {quest.title}
              </label>
              <button className="delete" onClick={() => dispatch({ type: 'deleted', id: quest.id })}>
                Delete
              </button>
            </li>
          );
        }

        export default function App() {
          const [quests, dispatch] = usePersistentReducer(questReducer, 'citadel-quests', null);
          const [filter, setFilter] = useState('all');
          const [title, setTitle] = useState('');
          const loading = quests === null;

          useEffect(() => {
            if (!loading) return;
            let ignore = false;
            fetch('/api/quests')
              .then((res) => res.json())
              .then((data) => {
                if (!ignore) dispatch({ type: 'loaded', quests: data });
              });
            return () => {
              ignore = true;
            };
          }, [loading, dispatch]);

          if (loading) {
            return (
              <div className="board">
                <h1>👑 The Quest Board</h1>
                <p className="loading">Summoning quests…</p>
              </div>
            );
          }

          const visible =
            filter === 'active'
              ? quests.filter((quest) => !quest.done)
              : filter === 'done'
                ? quests.filter((quest) => quest.done)
                : quests;
          const doneCount = quests.filter((quest) => quest.done).length;
          const defeated = quests.length > 0 && doneCount === quests.length;

          function handleAdd(e) {
            e.preventDefault();
            const trimmed = title.trim();
            if (!trimmed) return;
            dispatch({ type: 'added', title: trimmed });
            setTitle('');
          }

          return (
            <div className="board">
              <h1>👑 The Quest Board</h1>
              <form className="add" onSubmit={handleAdd}>
                <input
                  className="new-quest"
                  placeholder="A new quest…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button type="submit">Add quest</button>
              </form>
              <nav className="tabs">
                {FILTERS.map((f) => (
                  <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </nav>
              <ul className="quests">
                {visible.map((quest) => (
                  <QuestItem key={quest.id} quest={quest} dispatch={dispatch} />
                ))}
              </ul>
              <p className="summary">
                {doneCount} of {quests.length} quests done
              </p>
              {defeated && <p className="victory">💥 The Mutator is defeated!</p>}
              <button className="reset" onClick={() => dispatch({ type: 'reset' })}>
                ↺ Reset board
              </button>
            </div>
          );
        }
      `,
      hints: [
        md`Climb one step at a time: the reducer first (the second objective) — it's pure, so you can get it right on its own. Then the summoning effect, then the board, and the memory hook last. Check the quest often; every failed objective says what it expected.`,
        md`
          The summoning goes **above** the early return:

          \`\`\`js
          useEffect(() => {
            if (!loading) return;
            let ignore = false;
            fetch('/api/quests')
              .then((res) => res.json())
              .then((data) => {
                if (!ignore) dispatch({ type: 'loaded', quests: data });
              });
            return () => { ignore = true; };
          }, [loading]);
          \`\`\`

          Derived values: \`const doneCount = quests.filter((q) => q.done).length;\` and \`visible\` picks \`quests.filter((q) => !q.done)\` for \`'active'\`, \`quests.filter((q) => q.done)\` for \`'done'\`, or all of \`quests\`. Tabs: \`className={filter === f.id ? 'active' : ''}\` and \`onClick={() => setFilter(f.id)}\`.
        `,
        md`
          The memory hook:

          \`\`\`js
          export function usePersistentReducer(reducer, key, initialState) {
            const [state, dispatch] = useReducer(reducer, initialState, (fallback) => {
              try {
                const saved = localStorage.getItem(key);
                return saved !== null ? JSON.parse(saved) : fallback;
              } catch {
                return fallback;
              }
            });
            useEffect(() => {
              localStorage.setItem(key, JSON.stringify(state));
            }, [key, state]);
            return [state, dispatch];
          }
          \`\`\`

          And \`added\`: \`const nextId = quests.reduce((max, q) => Math.max(max, q.id), 0) + 1; return [...quests, { id: nextId, title: action.title, done: false }];\`
        `,
      ],
      tests: [
        test('Summons the quests: loading first, then one li.quest each', async (t) => {
          t.render();
          const loading = t.$('.loading');
          t.expect(loading && norm(loading.textContent).includes('Summoning quests'), 'While the quests load, show <p className="loading">Summoning quests…</p>.');
          await t.tick(300);
          const items = t.$$('li.quest');
          const fetched = t.fetchCalls.some((c) => c.url.startsWith('/api/quests'));
          t.expect(
            items.length === 4,
            fetched
              ? `/api/quests answered, but the board shows ${items.length} li.quest element(s) — expected 4. After the response, dispatch({ type: 'loaded', quests: data }) and make the reducer return action.quests.`
              : "Nothing fetched /api/quests. While the state is null, call fetch('/api/quests') in a useEffect — and put that useEffect ABOVE the early return if (loading) return ..., because hooks below it never run while loading.",
          );
          t.expect(!t.$('.loading'), 'Hide the loading message once the quests have arrived.');
          t.expect(t.hasText('Light the lighthouse') && t.hasText('Keyless Horde'), 'Each li.quest should show its quest title.');
          const calls = t.fetchCalls.filter((c) => c.url.startsWith('/api/quests')).length;
          t.expect(calls === 1, `/api/quests was fetched ${calls} time(s) — expected exactly once. Give the effect a dependency array (e.g. [loading]) so it doesn't run after every render.`);
        }),
        test('questReducer handles every action without mutating', (t) => {
          const reducer = t.exports.questReducer;
          t.expect(typeof reducer === 'function', 'Export the reducer: export function questReducer(quests, action) { ... }');
          const run = (state, action) => runReducer(t, reducer, 'questReducer', state, action);
          const make = () =>
            deepFreeze([
              { id: 1, title: 'Light the lighthouse', done: true },
              { id: 3, title: 'Tame the Looper', done: false },
            ]);

          const fresh = [{ id: 9, title: 'Fresh quest', done: false }];
          let next = run(null, { type: 'loaded', quests: fresh });
          t.expect(Array.isArray(next) && next.length === 1 && next[0].id === 9, `{ type: 'loaded', quests } should return the quests from the action — got ${JSON.stringify(next)}.`);

          const base = make();
          next = run(base, { type: 'added', title: 'Slay the Mutator' });
          t.expect(Array.isArray(next) && next !== base && next.length === 3, `'added' should return a NEW array with one more quest — got ${JSON.stringify(next)}.`);
          const added = next[2] || {};
          t.expect(
            added.id === 4 && added.title === 'Slay the Mutator' && added.done === false,
            `The added quest is ${JSON.stringify(added)} — expected {"id":4,"title":"Slay the Mutator","done":false} at the end. The ids are 1 and 3, so the next id is the highest + 1 = 4 (not the length + 1, which would clash with id 3).`,
          );
          next = run(deepFreeze([]), { type: 'added', title: 'First quest' });
          t.expect(
            Array.isArray(next) && next.length === 1 && next[0].id === 1,
            `Adding to an empty board gave ${JSON.stringify(next)} — the first quest should get id 1. Careful: Math.max(...[]) is -Infinity; quests.reduce((max, q) => Math.max(max, q.id), 0) + 1 handles it.`,
          );

          next = run(make(), { type: 'toggled', id: 3 });
          t.expect(Array.isArray(next) && next.length === 2, `'toggled' should return a new array with the same 2 quests — got ${JSON.stringify(next)}.`);
          t.expect(next.find((x) => x.id === 3)?.done === true && next.find((x) => x.id === 1)?.done === true, `Toggling id 3 should flip only its done flag (false → true) — got ${JSON.stringify(next)}.`);
          next = run(make(), { type: 'toggled', id: 1 });
          t.expect(next.find((x) => x.id === 1)?.done === false, 'Toggling a done quest should set done back to false.');

          next = run(make(), { type: 'deleted', id: 1 });
          t.expect(Array.isArray(next) && next.length === 1 && next[0].id === 3, `Deleting id 1 should leave only quest 3 — got ${JSON.stringify(next)}.`);

          next = run(make(), { type: 'reset' });
          t.expect(next === null, `{ type: 'reset' } should return null (so the board summons the quests again) — got ${JSON.stringify(next)}.`);
        }),
        test('Add, complete and delete quests on the board', async (t) => {
          t.render();
          await t.tick(300);
          t.expect(t.count('li.quest') === 4, 'The board must load its 4 quests first (see the first objective).');
          const input = t.$('input.new-quest');
          t.expect(input, 'Keep the <input className="new-quest"> inside the <form>.');
          t.type(input, '   ');
          t.submit(input);
          t.expect(t.count('li.quest') === 4, 'Submitting a blank title added a quest anyway — ignore titles that are empty after trim().');
          t.type(input, '  Defeat the Mutator  ');
          t.submit(input);
          const items = t.$$('li.quest');
          t.expect(
            items.length === 5 && norm(items[4].textContent).includes('Defeat the Mutator'),
            `After adding "Defeat the Mutator" the board shows ${items.length} quest(s) — expected 5, with the new one last. In handleAdd, dispatch({ type: 'added', title: title.trim() }).`,
          );
          t.expect(t.find('input.new-quest').value === '', 'Clear the input after adding a quest: setTitle("").');
          t.expect(
            t.blockedNavigations.length === 0,
            'Adding a quest tried to reload the page. Call e.preventDefault() first thing in the form\'s submit handler.',
          );

          const looper = () => findByText(t, 'li.quest', 'Infinite Looper');
          const box = looper().querySelector('input[type="checkbox"]');
          t.expect(box, 'Each li.quest needs an <input type="checkbox">.');
          t.click(box);
          t.expect(
            looper().classList.contains('done') && looper().querySelector('input[type="checkbox"]').checked,
            'Clicking a quest\'s checkbox should dispatch { type: \'toggled\', id: quest.id }, making it "quest done" with a checked box.',
          );
          t.click(looper().querySelector('input[type="checkbox"]'));
          t.expect(!looper().classList.contains('done'), 'Clicking the checkbox again should mark the quest as not done.');

          const del = looper().querySelector('button.delete');
          t.expect(del, 'Each li.quest needs a <button className="delete">.');
          t.click(del);
          t.expect(
            t.count('li.quest') === 4 && !looper(),
            'Clicking Delete should dispatch { type: \'deleted\', id: quest.id } and remove that quest from the board.',
          );
        }),
        test("Filter tabs, the derived summary and the Mutator's defeat", async (t) => {
          t.render();
          await t.tick(300);
          t.expect(t.count('li.quest') === 4, 'The board must load its 4 quests first (see the first objective).');
          const summary = () => norm(t.$('.summary')?.textContent);
          t.expect(summary() === '1 of 4 quests done', `The summary reads "${summary() || 'nothing'}" — expected "1 of 4 quests done" (one summoned quest starts done).`);
          const tab = (label) => {
            const btn = t.$$('.tabs button').find((b) => norm(b.textContent) === label);
            if (!btn) t.fail(`Could not find a "${label}" button inside <nav className="tabs">.`);
            return btn;
          };
          const titles = () => t.$$('li.quest').map((li) => norm(li.textContent));

          t.click(tab('Active'));
          let shown = titles();
          t.expect(
            shown.length === 3 && !shown.some((x) => x.includes('Light the lighthouse')),
            `On the Active tab the board shows ${shown.length} quest(s) — expected the 3 unfinished ones. Derive visible from quests and the filter.`,
          );
          t.expect(tab('Active').classList.contains('active') && !tab('All').classList.contains('active'), 'Only the selected tab should have className="active".');

          t.click(tab('Done'));
          shown = titles();
          t.expect(shown.length === 1 && shown[0].includes('Light the lighthouse'), `On the Done tab the board shows ${shown.length} quest(s) — expected only "Light the lighthouse".`);
          t.expect(summary() === '1 of 4 quests done', `On the Done tab the summary reads "${summary()}" — it must count ALL quests, whatever the tab: "1 of 4 quests done".`);

          t.click(tab('All'));
          t.expect(titles().length === 4, 'Back on the All tab, all 4 quests should be visible.');
          t.expect(!t.$('.victory'), 'The victory message must only appear once every quest is done.');

          for (const name of ['Keyless Horde', 'Infinite Looper', 'crown']) {
            const li = findByText(t, 'li.quest', name);
            t.click(li.querySelector('input[type="checkbox"]'));
          }
          t.expect(summary() === '4 of 4 quests done', `With every quest done the summary reads "${summary()}" — expected "4 of 4 quests done".`);
          const victory = t.$('.victory');
          t.expect(
            victory && norm(victory.textContent).includes('The Mutator is defeated'),
            'Every quest is done! Show <p className="victory">💥 The Mutator is defeated!</p> when there is at least one quest and all of them are done.',
          );
        }),
        test('usePersistentReducer keeps the board across reloads', async (t) => {
          const { usePersistentReducer } = t.exports;
          t.expect(typeof usePersistentReducer === 'function', 'Export the hook: export function usePersistentReducer(reducer, key, initialState) { ... }');
          const counter = (n, action) => (action.type === 'inc' ? n + 1 : n);
          let api = null;
          function Probe({ storageKey }) {
            api = usePersistentReducer(counter, storageKey, 0);
            const n = Array.isArray(api) ? api[0] : undefined;
            return t.h('button', { onClick: () => api[1]({ type: 'inc' }) }, 'n=' + n);
          }
          const shown = () => norm(t.$('button')?.textContent);

          t.render(t.h(Probe, { storageKey: 'probe-a' }));
          t.expect(Array.isArray(api) && typeof api[1] === 'function', 'usePersistentReducer should return [state, dispatch], just like useReducer.');
          t.expect(shown() === 'n=0', `With nothing saved, usePersistentReducer(reducer, key, 0) should start at 0 — the probe shows "${shown()}".`);
          t.click('button');
          t.click('button');
          t.expect(shown() === 'n=2', `dispatch should run the reducer like useReducer does — after two dispatches the probe shows "${shown()}", expected "n=2".`);
          const saved = t.storage.getItem('probe-a');
          t.expect(
            saved === '2',
            `The probe called usePersistentReducer(reducer, 'probe-a', 0) and dispatched twice, but localStorage.getItem('probe-a') is ${JSON.stringify(saved)} — expected '2'. In an effect that runs when the state changes, save it under the key parameter: localStorage.setItem(key, JSON.stringify(state)).`,
          );
          t.unmount();
          t.render(t.h(Probe, { storageKey: 'probe-a' }));
          t.expect(shown() === 'n=2', `After a reload the probe shows "${shown()}" — expected "n=2". Start from the saved value: useReducer's third argument (lazy init) can read JSON.parse(localStorage.getItem(key)).`);
          t.unmount();
          t.storage.setItem('probe-b', '41');
          t.render(t.h(Probe, { storageKey: 'probe-b' }));
          t.expect(shown() === 'n=41', `With '41' saved under 'probe-b', the hook should start at 41 — the probe shows "${shown()}". Use the key parameter, not a fixed key.`);
          t.unmount();

          t.render();
          await t.tick(300);
          const horde = () => findByText(t, 'li.quest', 'Keyless Horde');
          t.expect(horde(), 'The board must load its quests first (see the first objective).');
          t.click(horde().querySelector('input[type="checkbox"]'));
          let board = null;
          try {
            board = JSON.parse(t.storage.getItem('citadel-quests'));
          } catch {
            board = null;
          }
          t.expect(
            Array.isArray(board) && board.length === 4 && board.find((x) => x.id === 2)?.done === true,
            `localStorage 'citadel-quests' holds ${t.storage.getItem('citadel-quests')} — expected the JSON array of all 4 quests, with quest 2 now done. App should call usePersistentReducer(questReducer, 'citadel-quests', null).`,
          );
          t.unmount();
          t.render();
          t.expect(!t.$('.loading') && t.count('li.quest') === 4, 'After a reload the board should show the saved quests immediately — no "Summoning quests…".');
          t.expect(horde()?.classList.contains('done'), 'After a reload, "Return the keys to the Keyless Horde" should still be done.');
          await t.tick(300);
          let calls = t.fetchCalls.filter((c) => c.url.startsWith('/api/quests')).length;
          t.expect(calls === 1, `/api/quests was fetched ${calls} times — expected once. When quests were saved, the state isn't null, so skip the fetch.`);

          const reset = t.$('button.reset');
          t.expect(reset, 'Keep the <button className="reset">↺ Reset board</button>.');
          t.click(reset);
          t.expect(t.$('.loading'), 'After Reset board the state should be null again, so the board shows "Summoning quests…".');
          await t.tick(300);
          calls = t.fetchCalls.filter((c) => c.url.startsWith('/api/quests')).length;
          t.expect(
            calls === 2 && t.count('li.quest') === 4 && !horde()?.classList.contains('done'),
            'After Reset board the quests must be summoned again from /api/quests. Let the fetch effect depend on the loading flag ([loading]) so it runs again when the state becomes null.',
          );
        }),
      ],
      concepts: [
        {
          id: 'citadel-persistent-reducer',
          icon: '💾',
          title: 'usePersistentReducer',
          summary: 'useReducer + a lazy initializer + a saving effect = state that survives reloads.',
          snippet: code`
            function usePersistentReducer(reducer, key, initialState) {
              const [state, dispatch] = useReducer(reducer, initialState, (fallback) => {
                const saved = localStorage.getItem(key);
                return saved !== null ? JSON.parse(saved) : fallback;
              });
              useEffect(() => {
                localStorage.setItem(key, JSON.stringify(state));
              }, [key, state]);
              return [state, dispatch];
            }
          `,
        },
        {
          id: 'citadel-render-mage-creed',
          icon: '👑',
          title: "The Render Mage's creed",
          summary: 'UI = f(state). Keep state minimal, replace it instead of mutating it, derive the rest, and sync with the outside world in effects.',
          detail: "Every quest in Reactoria was this one idea in a different costume. Go build something of your own — you're ready.",
        },
      ],
    },
  ],
};
