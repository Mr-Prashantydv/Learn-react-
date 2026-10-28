# ⚛️ Reactoria — learn React by saving a world

**Reactoria is a playable React.js course.** You enter a world that is rendered
from state. A villain — *the Mutator* — has been mutating that state directly,
so nothing re-renders anymore and the world is frozen. You are the new
*Render Mage*: by writing real React, region by region, you bring it back.

By the time the credits roll you will have written (not just read about):
JSX, components & props, conditional rendering & lists, events & `useState`,
immutable updates, forms, `useEffect` & data fetching, refs, `useReducer` &
context, custom hooks, memoisation & transitions, error boundaries, portals,
Suspense, `use`, Actions, `useActionState`, `useOptimistic` … and a full
capstone app that combines all of it.

## Play it

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). Progress is saved in
your browser automatically — you can also export/import it from ⚙️ Settings.

To build a static version (deploy the `dist/` folder anywhere — GitHub Pages,
Netlify, Vercel, an S3 bucket …):

```bash
npm run build
npm run preview   # serves dist/ locally
```

## How the game works

- 🗺️ **13 regions, ~80 quests.** Each region on the world map is a chapter;
  each glowing node is a quest. Regions unlock in order; a **boss** guards the
  end of each one.
- 🎯 **Code quests** — a lesson (📖), a precise task (🎯), an editor with a live
  preview and console, and a list of objectives that are checked by running
  *your actual component* in a sandbox. Failed objectives tell you what they
  expected.
- 🐛 **Bug hunts** — fix code the Mutator broke.
- 📜 **Trials** — quizzes with an explanation for every answer.
- 👑 **Bosses** — bigger builds. Every objective you pass is a hit on the
  boss's HP bar.
- ⭐ **Stars, XP, ranks, badges, combos, streaks.** 3 stars for a clean solve;
  hints are free to *read* but using them costs a star; peeking at the
  solution costs two. Replay any quest to improve.
- 📖 **Codex** — every concept you learn becomes an entry you can revisit.
- 🧪 **Playground** — a free sandbox with a fake API to experiment in.
- 🏆 **Certificate** — finish the final boss to unlock the ending and a
  printable certificate.

Keyboard: `Ctrl/⌘ + Enter` checks your quest; `Enter`/`Space` advance dialog.

Already know some React? Turn on **Explorer mode** in Settings to unlock
every quest.

## Under the hood

Everything runs in the browser — no server, no accounts.

| Piece | Where |
|---|---|
| Game UI (title, map, quests, quizzes, codex, settings, finale, certificate) | `src/screens/`, `src/components/` |
| Progress store (reducer + `localStorage`), ranks, unlock rules, sounds, confetti | `src/game/` |
| The sandbox: compiles your JSX with [sucrase](https://github.com/alangpierce/sucrase), evaluates it with React, renders it in a Shadow DOM and runs each quest's checks with React's `act()` | `src/engine/` |
| Fake timers, fake `fetch`, fake `localStorage` and `Date` for deterministic checks | `src/engine/timers.js`, `src/engine/runner.js` |
| The course itself — one file per region | `src/content/chapters/` |

The app deliberately ships the **development build of React** so that `act()`
works and React's own warnings (missing keys, hook rules, …) show up in the
in-game console while you play.

## Writing or changing content

Every quest is data: a lesson, a task, starter code, a reference solution,
hints and a list of checks. See **[`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md)**
for the schema and the check API, and **[`docs/CURRICULUM.md`](docs/CURRICULUM.md)**
for what each region covers.

The whole course is verified by running every reference solution *and* every
starter through the real engine under jsdom:

```bash
npm run verify              # all regions
npm run verify -- ref-ruins # one region
```

A quest passes verification only if its solution passes every check and its
starter fails at least one.

## Tech

React 19 · Vite · sucrase · CodeMirror 6 · WebAudio (no audio files) · jsdom
(for verification only).
