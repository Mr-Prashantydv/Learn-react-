# Reactoria content guide

Everything the player learns lives in `src/content/chapters/*.js`. Each file
exports one **chapter** (a region on the world map) containing **levels**
(quests). The reference chapter is `01-jsx-shore.js` — read it before writing.

Run the verifier after every change:

```bash
npm run verify -- <chapter-id>      # e.g. npm run verify -- component-forge
npm run verify -- <chapter-id> --verbose
```

It runs every level's **solution** (must pass all checks) and **starter**
(must fail at least one check) through the real in-game engine (under jsdom).

---

## The world & tone

- **Reactoria** is a world rendered from state. The villain, **the Mutator**,
  mutates state directly, so the world stopped re-rendering and froze.
  The player is a would-be **Render Mage** restoring declarative order.
- **Pip** is the player's guide: a small glowing pixel sprite. Pip's voice is
  warm, playful, a little dramatic, short sentences, light puns. Never
  condescending. Pip talks in `story` lines (`{ text, mood }`, moods:
  `happy`, `worried`, `thinking`, `excited`).
- Every chapter is a themed region with its own little cast and a **boss**
  (a minion of the Mutator) whose gimmick matches the concept, e.g.
  "The Stale Closure", "The Prop Driller", "The Infinite Looper".
- Keep it fun, but the **teaching is the point**: lessons must be accurate,
  modern React 19 (function components + hooks, no class components except
  error boundaries), and build on only what earlier chapters taught.

## Chapter shape

```js
import { code, md, q, test } from '../helpers.js';

export default {
  id: 'component-forge',            // unique, kebab-case
  file: '02-component-forge.js',
  title: 'Component Forge',         // region name
  short: 'Components',              // 1 word, used in filters
  subtitle: 'One sentence about what this region teaches.',
  icon: '⚒️',
  colors: ['#7c2d12', '#f97316'],   // gradient for the region background (dark → bright)
  scenery: ['🔥', '⚙️', '🪨', ...],  // 5–8 emojis floating in the background
  intro: [ { text, mood }, ... ],   // Pip's lines when the region is first entered (2–4)
  levels: [ ... ],                  // 5–7 levels, exactly ONE with boss: true (the last)
};
```

## Level shape

Common fields:

| field | notes |
|---|---|
| `id` | globally unique, **prefixed with your chapter's short key**, e.g. `forge-props` |
| `type` | `'code'` (normal quest), `'bug'` (fix broken code), `'build'` (bigger, open-ended), `'quiz'` |
| `title` | short & evocative, e.g. "The Prop Courier" |
| `blurb` | one line shown on the map card |
| `xp` | code 100–160, quiz 100, boss 250–300 |
| `story` | 1–3 Pip lines shown when the quest opens |
| `concepts` | 1–3 codex entries unlocked on completion (see below) |
| `boss`, `badge` | only on the boss level: `boss: true, badge: { id: 'badge-forge', name, icon, description }` |
| `bossName`, `bossIcon` | boss level only, optional: name + emoji shown on the boss HP bar (defaults: the title without "Boss: ", and 👾) |
| `final` | only on the very last level of the game (marks the adventure as finished) |

### Code levels (`code` / `bug` / `build`)

| field | notes |
|---|---|
| `lesson` | markdown (the 📖 Lesson tab). Teach the concept properly: 250–700 words, examples, a `:::tip`/`:::mistake` callout. |
| `task` | markdown (the 🎯 Quest tab). Starts with `## 🎯 ...`. Numbered, precise requirements: element types, classNames, exact texts the checks look for. |
| `starter` | the code the player starts with. Must compile (unless `starterHasSyntaxError: true` on a bug hunt) and **fail** ≥1 check. Usually includes `TODO` comments. |
| `solution` | idiomatic reference solution. Must pass every check. |
| `hints` | 2–3 markdown hints, increasingly specific; the last nearly gives it away. |
| `tests` | 3–5 checks (`test(name, run)`). **The test names are the objectives the player sees.** |
| `css` | optional CSS string injected into the preview (scoped to the preview). |
| `routes`, `fetchDelay` | optional fake API for `fetch` (see below). |
| `previewProps` | optional props passed to `App` in the live preview. |

The player's file must `export default` a component (named `App` by convention).
Single file: put helper components in the same file above `App`.
Available imports: `'react'`, `'react-dom'` (e.g. `createPortal`), `'react-dom/client'`.

### Quiz levels (`quiz`)

```js
{
  id: 'forge-trial', type: 'quiz', title: '...', blurb: '...', xp: 100, story: [...],
  task: md`Optional intro shown above the questions.`,
  questions: [
    q('Question (markdown; may contain ```jsx fences with \\n newlines)', ['opt A', 'opt B', 'opt C', 'opt D'], 2, 'Explanation (markdown) shown after answering — teach, don\'t just confirm.'),
  ],
}
```

6–8 questions. Mix "what does this render?", "what's wrong here?", "which is
idiomatic?", concept checks. Options may contain inline `code`. Spread the
correct answer index around (not always the same letter).

### Concepts (codex entries)

```js
{ id: 'forge-props', icon: '📦', title: 'Props', summary: 'One line.', snippet: code`...`, detail: 'Optional 1–2 sentences.' }
```
Concept ids are global: prefix with your chapter key. Existing ids:
`component`, `jsx`, `jsx-expressions`, `jsx-rules`, `fragment`, `style-object`,
`classname`, `declarative`, `react-element-tree`.

## Writing markdown & code (escaping!)

Use the `md` / `code` template tags. They take the **raw** string (so `\n`
and `\d` inside code samples survive) and strip common indentation.
Inside them you must escape:

- backticks as `` \` `` (so inline code is `` \`useState\` ``, fences are `` \`\`\`jsx ``)
- `${` as `\${` (template literals inside code samples)

Markdown supported: `##`/`###` headings, paragraphs, `**bold**`, `*italic*`,
inline code, fenced code blocks, `-` / `1.` lists (items may wrap onto
indented continuation lines; nested lists and code blocks inside items work;
numbering continues from the first item's number), tables, `>` quotes and
callouts:

```
:::tip      (also :::warn, :::mistake, :::pro, :::story, :::try)
Text, lists and code blocks allowed inside.
:::
```

## Writing checks (`test(name, run)`)

`run(t)` throws to fail. Use the helpers below; **every failure message must
tell the player what was expected and how to fix it** (e.g. `The counter shows
"3" — expected "4". Did you use the updater form setCount(c => c + 1)?`).

Each check gets a fresh copy of the player's module (no leaking state between
checks). Interactions are **synchronous** (wrapped in React's `act`). Only
time/promise helpers are async.

### Rendering
- `t.render(props?)` — render `<App {...props} />` (or pass any React element: `t.render(t.h(Comp, props))`)
- `await t.renderAsync(props?)` — use when the component **suspends** on the first render (`use(promise)`)
- `t.renderComponent(Comp, props)` — render a named export, e.g. `t.renderComponent(t.exports.HeroCard, { name: 'Ada' })`
- `t.unmount()`
- `t.exports` — the module's exports (test named exports such as custom hooks: build a tiny component with `t.h` / `t.React`)
- `t.React`, `t.h` (= `React.createElement`)

### Querying (all scoped to the rendered container)
- `t.$(sel)`, `t.$$(sel)` → element / array (may be empty)
- `t.find(sel)` → element or throws "Could not find an element matching …"
- `t.count(sel)`
- `t.text()` → all text, whitespace-collapsed; `t.hasText(str)`
- `t.findText(text, { exact = true })` → innermost element with that text, or `null`
- `t.button(label)` → `<button>` whose text contains `label` (case-insensitive), throws a helpful message listing buttons
- `t.container`, `t.html()`

### Interacting (sync)
- `t.click(elOrSelector)`
- `t.type(elOrSelector, 'full new value')` — sets the input/textarea value and fires `onChange`
- `t.change(elOrSelector, value)` — `<select>` value, or checkbox/radio checked state (`true/false`)
- `t.submit(formOrChild)` — submits the form (fires `onSubmit` / form `action`)
- `t.keyDown(el, 'Enter')`, `t.fire(el, 'eventName')`, `t.focus(el)`, `t.blur(el)`

### Time, promises, fetch (async)
- Player code's `setTimeout`/`setInterval`/`Date`/`performance.now` are **fake** in checks.
  `await t.tick(ms)` advances fake time (running due timers) and settles promises.
- `await t.flush()` settles promises without moving time.
- `t.timers.pendingIntervals()`, `t.timers.pendingTimeouts()` — e.g. after `t.unmount()` assert cleanup happened.
- `fetch` is fake and only knows the level's `routes`:
  ```js
  routes: {
    '/api/monsters': [{ id: 1, name: 'Slime' }],                      // static JSON
    '/api/search': (url) => ({ results: [...] }),                       // computed from url (query string included)
    '/api/broken': () => ({ status: 500, body: { error: 'Boom' } }),    // custom status
  },
  fetchDelay: 300,   // ms in checks (default 300; the preview uses 700)
  ```
  Responses have `ok`, `status`, `json()`, `text()`. Unknown routes return 404.
  `t.fetchCalls` lists `{ url, options }` of every call.
- Player code's `localStorage` is an in-memory fake; `t.storage` is the same object.

### Forms & links
- A form submitted (or a link followed) **without** `preventDefault()` never navigates the game:
  during checks it is redirected into a hidden iframe and recorded in `t.blockedNavigations`
  (`[{ kind: 'form' | 'link', element, href }]`) — so a check like
  `t.expect(t.blockedNavigations.length === 0, 'Call e.preventDefault() ...')` works, and
  `event.defaultPrevented` on events you dispatch yourself is left untouched.
  In the live preview the navigation is blocked and the player sees a console warning.

### Assertions
- `t.expect(cond, message)`, `t.fail(message)`
- `t.expectText(text, msg?)`, `t.expectNoText(text, msg?)`, `t.expectElement(sel, msg?)`
- `t.sourceIncludes(regexOrString, msg)`, `t.sourceExcludes(regexOrString, msg)` — check the
  player's code. Use **sparingly**, only when behaviour cannot prove the
  concept (e.g. "uses `useReducer`", "doesn't mutate with `.push(`"). Make regexes tolerant of
  whitespace and naming.
- `t.logLines()` — the player's `console.log` output as strings (handy for counting renders:
  give the starter a `console.log('render List')` line the player must keep).
- `t.warnings` — React warnings captured during the check (e.g. missing `key`).

### Good checks
- Test **behaviour**, like a user would: render, click, type, read text.
- Use **classNames and exact texts that the task spells out**. The task is the contract.
- Don't depend on layout/CSS (jsdom has none) or on a specific variable name unless the task requires it.
- Be tolerant: trim/collapse whitespace, accept equivalent valid solutions.
- 3–5 checks per level; the first is usually "renders the basic structure".

## Preview

The live preview renders inside a Shadow DOM with a neutral base stylesheet
(nice buttons, inputs, lists, cards). Use a level `css` for themed visuals
(e.g. `.hp-bar`, `.card`) and reference those classes in the starter. Prefer
emoji characters over image URLs.

## Checklist before you finish a chapter

- [ ] 5–7 levels, ids prefixed, exactly one `boss: true` level (last) with a `badge`
- [ ] at least one `quiz` level, and at least one `bug` level when it fits the topic
- [ ] lessons teach everything the task needs; tasks name exact elements/classes/texts
- [ ] hints escalate; failure messages are specific and kind
- [ ] only concepts from earlier chapters (+ this one) are required
- [ ] `npm run verify -- <chapter-id>` is green
