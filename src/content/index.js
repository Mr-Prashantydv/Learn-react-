import jsxShore from './chapters/01-jsx-shore.js';
import componentForge from './chapters/02-component-forge.js';
import branchingWoods from './chapters/03-branching-woods.js';
import stateSprings from './chapters/04-state-springs.js';
import immutableIsles from './chapters/05-immutable-isles.js';
import formFortress from './chapters/06-form-fortress.js';
import effectVolcano from './chapters/07-effect-volcano.js';
import refRuins from './chapters/08-ref-ruins.js';
import contextCanopy from './chapters/09-context-canopy.js';
import hookWorkshop from './chapters/10-hook-workshop.js';
import performancePeaks from './chapters/11-performance-peaks.js';
import arcaneSpire from './chapters/12-arcane-spire.js';
import mutatorCitadel from './chapters/13-mutator-citadel.js';
import patternPavilion from './chapters/14-pattern-pavilion.js';
import clockworkDeep from './chapters/15-clockwork-deep.js';
import tradeRoutes from './chapters/16-trade-routes.js';
import guildhall from './chapters/17-guildhall.js';
import { code } from './helpers.js';

const ALL = [
  jsxShore,
  componentForge,
  branchingWoods,
  stateSprings,
  immutableIsles,
  formFortress,
  effectVolcano,
  refRuins,
  contextCanopy,
  hookWorkshop,
  patternPavilion,
  performancePeaks,
  clockworkDeep,
  arcaneSpire,
  tradeRoutes,
  guildhall,
  mutatorCitadel,
];

/** Chapters that actually contain levels, in world order. */
export const chapters = ALL.filter((c) => c && Array.isArray(c.levels) && c.levels.length > 0);

/** Every level, flattened, with chapter info attached. */
export const allLevels = [];
chapters.forEach((chapter, chapterIndex) => {
  chapter.levels.forEach((level, levelIndex) => {
    allLevels.push(Object.assign(level, { chapterId: chapter.id, chapterIndex, levelIndex }));
  });
});

export const levelById = Object.fromEntries(allLevels.map((l) => [l.id, l]));

export const PLAYGROUND = {
  id: '__playground',
  type: 'code',
  title: 'The Sandbox',
  chapterIndex: -1,
  xp: 0,
  task: code`
    ## 🧪 Free play

    This is your personal workshop. Nothing here is graded — experiment with
    anything you have learned. Your code runs live on the right.

    - Import hooks from \`'react'\` as usual.
    - \`console.log\` output appears in the console panel.
    - \`fetch('/api/heroes')\` returns some demo data after a short delay.
  `,
  lesson: code`
    ## Ideas to try

    - Build a counter, then turn it into a custom hook.
    - Fetch \`/api/heroes\` and render the list.
    - Make a tiny game: a clicker, a quiz, a dice roller.
  `,
  routes: {
    '/api/heroes': [
      { id: 1, name: 'Ada', role: 'Mage', power: 92 },
      { id: 2, name: 'Linus', role: 'Knight', power: 87 },
      { id: 3, name: 'Grace', role: 'Ranger', power: 95 },
    ],
  },
  starter: code`
    import { useState } from 'react';

    export default function App() {
      const [clicks, setClicks] = useState(0);
      return (
        <div style={{ padding: 16 }}>
          <h1>My sandbox ✨</h1>
          <button onClick={() => setClicks(clicks + 1)}>Clicked {clicks} times</button>
        </div>
      );
    }
  `,
  solution: '',
  hints: [],
  tests: [],
};
