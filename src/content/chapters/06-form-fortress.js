import { code, md, q, test } from '../helpers.js';

/* -------------------------------------------------------------------------- */
/* Check helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Collapse whitespace so checks don't care about JSX line breaks. */
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Submits a form the way a user would and reports whether the player's
 * onSubmit handler called e.preventDefault(). Our listener sits on `document`,
 * so it runs AFTER React's handler (React listens on its root container). It
 * records the result, then always cancels the event, so a forgotten
 * preventDefault can never reload the real page while checks run.
 */
function submitForm(t, target = 'form') {
  let prevented = null;
  const guard = (e) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('submit', guard);
  try {
    t.submit(target);
  } finally {
    document.removeEventListener('submit', guard);
  }
  if (prevented === null)
    t.fail('Submitting the form did nothing. Is everything inside one <form> with an onSubmit handler?');
  return prevented;
}

const NO_RELOAD =
  'Submitting the form tried to reload the page. Keep e.preventDefault() as the first line of handleSubmit.';

/** Any computed key in an object literal: { ...form, [name]: value } */
const COMPUTED_KEY = /\[\s*[\w$.]+\s*\]\s*:/;

export default {
  id: 'form-fortress',
  file: '06-form-fortress.js',
  title: 'Form Fortress',
  short: 'Forms',
  subtitle: 'Controlled inputs, submit handlers, validation and lifting state up: forms the React way.',
  icon: '🏰',
  colors: ['#3b0764', '#a78bfa'],
  scenery: ['🏰', '🛡️', '⚔️', '📜', '🗝️', '🚩', '🪶', '🐉'],
  intro: [
    {
      text: 'Behold, Form Fortress! Every gate, scroll and drawbridge in here is a form: the place where users finally talk BACK to your app.',
      mood: 'excited',
    },
    {
      text: 'But the Uncontrolled Golem has loosened React\'s grip. Fields keep secrets, checkboxes lie and drawbridges freeze solid.',
      mood: 'worried',
    },
    {
      text: 'The fortress motto: React state is the single source of truth. Let\'s take back control, one input at a time!',
      mood: 'happy',
    },
  ],
  levels: [
    // ---------------------------------------------------------------- 1
    {
      id: 'fort-rune-gate',
      type: 'code',
      title: 'The Rune Gate',
      blurb: 'Take control of your first input: state flows in, keystrokes flow out.',
      xp: 110,
      story: [
        {
          text: 'Gatekeeper Grimwald\'s rune slab is broken. It shows whatever it likes, ignores the Clear button and never notices the password.',
          mood: 'worried',
        },
        {
          text: 'The input is keeping its text to itself, so React can\'t see it. Make React the boss of that box, then speak the password!',
          mood: 'happy',
        },
      ],
      lesson: md`
        ## Who owns the text in a box?

        An \`<input>\` has its own little memory. Type into it and the browser keeps the
        text, whether React knows about it or not. That's fine... until React needs the
        text: to show it somewhere else, to check it, or to clear the box.

        React's answer is the **controlled input**: your **state** owns the value, and the
        input just displays it.

        \`\`\`jsx
        import { useState } from 'react';

        function NameField() {
          const [name, setName] = useState('');

          return (
            <input
              value={name}                               // 1. state → input
              onChange={(e) => setName(e.target.value)}  // 2. keystroke → state
            />
          );
        }
        \`\`\`

        Every keystroke runs this loop:

        1. The user presses a key.
        2. React calls \`onChange\`. \`e.target\` is the input, and \`e.target.value\` is the text it *would* now contain.
        3. You call \`setName(...)\`, so React re-renders.
        4. The input shows \`value={name}\`: exactly what the state says.

        The input never decides on its own. **It always shows the state.**

        :::tip
        In React, \`onChange\` fires on **every keystroke** (like the browser's \`input\`
        event), not only when the box loses focus.
        :::

        ## The superpowers of control

        Because state is the source, you can do things an ordinary input can't:

        - **Transform** what is typed: \`setName(e.target.value.toUpperCase())\` makes the box itself show capitals.
        - **Reset** the box from anywhere: \`setName('')\` empties it.
        - **Derive** new values during render, with no extra state.

        \`\`\`jsx
        const [pin, setPin] = useState('');
        const isComplete = pin.length === 4; // derived, recalculated every render

        return (
          <>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // digits only!
            />
            <button onClick={() => setPin('')}>Clear</button>
            <p>{isComplete ? '✅ PIN complete' : 'Enter 4 digits'}</p>
          </>
        );
        \`\`\`

        :::mistake
        \`value\` without \`onChange\` freezes the field. React puts the state value back
        after every keystroke (and warns in the console). A controlled input always needs both.
        :::
      `,
      task: md`
        ## 🎯 Open the Rune Gate

        The \`word\` state already exists. Wire it up:

        1. Make the \`<input className="rune-input">\` **controlled**: give it \`value={word}\` and an \`onChange\` that stores the typed text **in UPPERCASE** (\`e.target.value.toUpperCase()\`). The box itself must show capitals.
        2. The \`<p className="echo">\` already shows \`Runes: {word}\`. It should now update as you type.
        3. The **Clear** button already calls \`setWord('')\`. Once the input is controlled, it empties the box too.
        4. Derive \`isOpen\` during render: it is \`true\` when \`word\` is exactly **STATE**. The \`<p className="gate-status">\` then reads **🔓 The gate swings open!**, otherwise **🔒 The gate is sealed**.

        Bonus (not checked): give the wrapper \`className="gate open"\` while it's open, for a glowing gate.
      `,
      starter: code`
        import { useState } from 'react';

        export default function App() {
          const [word, setWord] = useState('');

          // TODO: derive isOpen from word (no extra state needed!)

          return (
            <div className="gate">
              <h2>🏰 The Rune Gate</h2>
              <p className="gate-status">🔒 The gate is sealed</p>

              {/* TODO: control this input with value + onChange (store UPPERCASE) */}
              <input className="rune-input" placeholder="Speak the password..." />

              <p className="echo">Runes: {word}</p>
              <button onClick={() => setWord('')}>Clear</button>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export default function App() {
          const [word, setWord] = useState('');
          const isOpen = word === 'STATE';

          return (
            <div className={isOpen ? 'gate open' : 'gate'}>
              <h2>🏰 The Rune Gate</h2>
              <p className="gate-status">{isOpen ? '🔓 The gate swings open!' : '🔒 The gate is sealed'}</p>

              <input
                className="rune-input"
                placeholder="Speak the password..."
                value={word}
                onChange={(e) => setWord(e.target.value.toUpperCase())}
              />

              <p className="echo">Runes: {word}</p>
              <button onClick={() => setWord('')}>Clear</button>
            </div>
          );
        }
      `,
      hints: [
        md`A controlled input needs two props: \`value={word}\` and \`onChange={...}\`. Inside \`onChange\`, \`e.target.value\` is the text that was just typed.`,
        md`Store capitals: \`onChange={(e) => setWord(e.target.value.toUpperCase())}\`.`,
        md`Above the \`return\`: \`const isOpen = word === 'STATE';\`. In the status paragraph: \`{isOpen ? '🔓 The gate swings open!' : '🔒 The gate is sealed'}\`.`,
      ],
      tests: [
        test('Typing shows UPPERCASE runes in the box itself', (t) => {
          t.render();
          const input = t.find('input.rune-input');
          t.type(input, 'open sesame');
          t.expect(
            input.value === 'OPEN SESAME',
            `You typed "open sesame" and the box shows "${input.value}" — expected "OPEN SESAME". Give the input value={word} and store e.target.value.toUpperCase() in onChange.`,
          );
        }),
        test('The echo repeats the runes as you type', (t) => {
          t.render();
          t.type('input.rune-input', 'ember');
          const echo = clean(t.find('.echo').textContent);
          t.expect(
            echo === 'Runes: EMBER',
            `After typing "ember" the echo reads "${echo}" — expected "Runes: EMBER". Your onChange must call setWord(...) with the uppercased text.`,
          );
        }),
        test('Clear empties the box (React owns the value)', (t) => {
          t.render();
          const input = t.find('input.rune-input');
          t.type(input, 'oops');
          t.click(t.button('Clear'));
          t.expect(
            input.value === '',
            `After clicking Clear the box still shows "${input.value}". The box only empties when it is controlled: value={word}.`,
          );
          const echo = clean(t.find('.echo').textContent);
          t.expect(echo === 'Runes:', `After Clear the echo reads "${echo}" — expected just "Runes:".`);
        }),
        test('Speaking STATE opens the gate', (t) => {
          t.render();
          const status = () => clean(t.find('.gate-status').textContent);
          t.expect(
            status().includes('The gate is sealed'),
            `Before anything is typed, .gate-status should read "🔒 The gate is sealed" (it reads "${status()}").`,
          );
          t.type('input.rune-input', 'stat');
          t.expect(
            status().includes('The gate is sealed'),
            `"STAT" is not the password, but .gate-status reads "${status()}". Only the exact word STATE opens the gate.`,
          );
          t.type('input.rune-input', 'state');
          t.expect(
            status().includes('The gate swings open!'),
            `After typing "state", .gate-status reads "${status()}" — expected "🔓 The gate swings open!". Derive const isOpen = word === 'STATE' during render.`,
          );
          t.type('input.rune-input', 'states');
          t.expect(
            status().includes('The gate is sealed'),
            `"STATES" is not the password, but .gate-status reads "${status()}". Only the exact word STATE opens the gate: word === 'STATE'.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'fort-controlled-input',
          icon: '🎛️',
          title: 'Controlled input',
          summary: 'State owns the value: value={state} in, onChange writes every keystroke back.',
          snippet: code`
            const [name, setName] = useState('');
            <input value={name} onChange={(e) => setName(e.target.value)} />
          `,
          detail: 'Because the input always shows the state, you can transform, validate, reset or reuse its value anywhere in the component.',
        },
      ],
      css: `
        .gate { max-width: 440px; margin: 8px auto; padding: 20px; text-align: center; border-radius: 22px 22px 6px 6px;
          background: linear-gradient(180deg, #57534e, #292524); color: #f5f5f4; border: 4px solid #78716c;
          box-shadow: inset 0 -10px 0 rgba(0, 0, 0, 0.25); transition: all 0.4s; }
        .gate h2 { color: #fde68a; }
        .gate.open { background: linear-gradient(180deg, #8b5cf6, #3b0764); border-color: #c4b5fd; box-shadow: 0 0 30px rgba(196, 181, 253, 0.8); }
        .gate-status { font-size: 1.15em; font-weight: 700; }
        .rune-input { width: 85%; text-align: center; letter-spacing: 0.3em; font-family: ui-monospace, monospace; font-size: 1.2em; }
        .echo { font-family: ui-monospace, monospace; color: #e9d5ff; min-height: 1.5em; }
      `,
    },

    // ---------------------------------------------------------------- 2
    {
      id: 'fort-armory',
      type: 'code',
      title: 'The Armory Requisition',
      blurb: 'Dropdowns, radios, checkboxes and text areas: control them all.',
      xp: 120,
      story: [
        {
          text: 'Smith Brenna runs the fortress armory. Her requisition form has every kind of field: a dropdown, round radio buttons, a checkbox and a big note box.',
          mood: 'happy',
        },
        {
          text: 'Only the weapon dropdown talks to React. The rest ignore her slip completely. Different inputs, same idea: let\'s control them all!',
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## Same idea, different props

        Every kind of form field can be controlled. Only the prop names change:

        | Field | Controlled with | Read the new value from |
        |---|---|---|
        | \`<input>\` (text, email, number…) | \`value\` | \`e.target.value\` |
        | \`<textarea>\` | \`value\` | \`e.target.value\` |
        | \`<select>\` | \`value\` on the select | \`e.target.value\` |
        | checkbox | \`checked\` | \`e.target.checked\` |
        | radio | \`checked\` (true for the chosen one) | \`e.target.value\` |

        ### textarea

        In HTML, a textarea's text goes between its tags. In React it takes a \`value\`
        prop, exactly like an input:

        \`\`\`jsx
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        \`\`\`

        ### select

        Don't put \`selected\` on an \`<option>\`. Put \`value\` on the \`<select>\` and React
        selects the matching option for you:

        \`\`\`jsx
        <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
          <option value="sword">Sword</option>
          <option value="bow">Bow</option>
        </select>
        \`\`\`

        ### checkbox

        A checkbox is on or off, so its state is a **boolean**, controlled with \`checked\`:

        \`\`\`jsx
        const [shield, setShield] = useState(false);

        <input type="checkbox" checked={shield} onChange={(e) => setShield(e.target.checked)} />
        \`\`\`

        ### radio group

        Radios that share a \`name\` form a group. **One** string in state remembers the
        choice, and each radio is checked when it matches:

        \`\`\`jsx
        const [element, setElement] = useState('fire');

        {['fire', 'ice', 'storm'].map((el) => (
          <label key={el}>
            <input
              type="radio"
              name="element"
              value={el}
              checked={element === el}
              onChange={(e) => setElement(e.target.value)}
            />
            {el}
          </label>
        ))}
        \`\`\`

        :::mistake
        Reading \`e.target.value\` from a checkbox gives you the string \`"on"\`, never
        \`true\` or \`false\`. For checkboxes always use \`checked\` and \`e.target.checked\`.
        :::

        :::tip
        Wrap each field in a \`<label>\` so clicking the text also toggles the box. Nicer
        for everyone, essential for screen-reader users.
        :::

        ## Derived values come free

        A character counter needs no extra state: \`{note.length}/60\` is recalculated on
        every render. And remember that \`e.target.value\` is **always a string**, even for
        \`type="number"\`. Convert it with \`Number(e.target.value)\` when you need maths.
      `,
      task: md`
        ## 🎯 Fill in the requisition

        The weapon \`<select>\` is already controlled. Use it as your model, then:

        1. **Radios:** control the three \`type="radio"\` inputs (values \`fire\`, \`ice\`, \`storm\`) with the \`element\` state: \`checked={element === el}\` plus an \`onChange\` that stores \`e.target.value\`. **fire** is checked at the start.
        2. **Checkbox:** control the shield box with \`checked={shield}\` and store \`e.target.checked\`.
        3. **Textarea:** control the note with \`value={note}\` (it starts as **Make it shiny**), and make \`<small className="count">\` show its length out of 60, e.g. **13/60**.

        The \`<p className="slip">\` is already written. When everything is wired it reads like **Requesting: bow of ice + shield**.
      `,
      starter: code`
        import { useState } from 'react';

        const ELEMENTS = ['fire', 'ice', 'storm'];

        export default function App() {
          const [weapon, setWeapon] = useState('sword');
          const [element, setElement] = useState('fire');
          const [shield, setShield] = useState(false);
          const [note, setNote] = useState('Make it shiny');

          return (
            <div className="armory">
              <h2>⚔️ Armory Requisition</h2>

              {/* ✅ Already controlled: copy this pattern! */}
              <label>
                Weapon{' '}
                <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
                  <option value="sword">Sword</option>
                  <option value="bow">Bow</option>
                  <option value="staff">Staff</option>
                </select>
              </label>

              <fieldset>
                <legend>Enchantment</legend>
                {ELEMENTS.map((el) => (
                  <label key={el}>
                    {/* TODO: control this radio with checked + onChange */}
                    <input type="radio" name="element" value={el} />
                    {el}
                  </label>
                ))}
              </fieldset>

              <label>
                {/* TODO: control this checkbox with checked + e.target.checked */}
                <input type="checkbox" />
                Add a shield
              </label>

              <label className="note">
                Note for the smith
                {/* TODO: control this textarea with value + onChange */}
                <textarea />
              </label>
              <small className="count">0/60</small>

              <p className="slip">
                Requesting: {weapon} of {element}
                {shield ? ' + shield' : ''}
              </p>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const ELEMENTS = ['fire', 'ice', 'storm'];

        export default function App() {
          const [weapon, setWeapon] = useState('sword');
          const [element, setElement] = useState('fire');
          const [shield, setShield] = useState(false);
          const [note, setNote] = useState('Make it shiny');

          return (
            <div className="armory">
              <h2>⚔️ Armory Requisition</h2>

              <label>
                Weapon{' '}
                <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
                  <option value="sword">Sword</option>
                  <option value="bow">Bow</option>
                  <option value="staff">Staff</option>
                </select>
              </label>

              <fieldset>
                <legend>Enchantment</legend>
                {ELEMENTS.map((el) => (
                  <label key={el}>
                    <input
                      type="radio"
                      name="element"
                      value={el}
                      checked={element === el}
                      onChange={(e) => setElement(e.target.value)}
                    />
                    {el}
                  </label>
                ))}
              </fieldset>

              <label>
                <input type="checkbox" checked={shield} onChange={(e) => setShield(e.target.checked)} />
                Add a shield
              </label>

              <label className="note">
                Note for the smith
                <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <small className="count">{note.length}/60</small>

              <p className="slip">
                Requesting: {weapon} of {element}
                {shield ? ' + shield' : ''}
              </p>
            </div>
          );
        }
      `,
      hints: [
        md`Each radio needs two props: \`checked={element === el}\` (is this the chosen one?) and \`onChange={(e) => setElement(e.target.value)}\`.`,
        md`The checkbox is a boolean: \`checked={shield}\` and \`onChange={(e) => setShield(e.target.checked)}\`. Not \`.value\`!`,
        md`The textarea works like a text input: \`<textarea value={note} onChange={(e) => setNote(e.target.value)} />\`. The counter is \`{note.length}/60\`.`,
      ],
      tests: [
        test('The weapon dropdown updates the slip', (t) => {
          t.render();
          t.change('select', 'bow');
          const slip = clean(t.find('.slip').textContent);
          t.expect(
            slip.startsWith('Requesting: bow of'),
            `After choosing Bow the slip reads "${slip}" — it should start with "Requesting: bow of". Keep the select controlled with value={weapon}.`,
          );
        }),
        test('The enchantment radios are controlled (fire starts checked)', (t) => {
          t.sourceExcludes(/\bdefaultChecked\s*=/, 'Control the radios with checked={element === el}, not defaultChecked.');
          t.render();
          const radio = (v) => t.find(`input[type="radio"][value="${v}"]`);
          t.expect(
            radio('fire').checked,
            'At the start the "fire" radio should be checked, because element is "fire". Give each radio checked={element === el}.',
          );
          t.change(radio('ice'), true);
          const slip = clean(t.find('.slip').textContent);
          t.expect(
            slip.includes('of ice'),
            `After picking ice the slip reads "${slip}" — expected "... of ice". Add onChange={(e) => setElement(e.target.value)} to the radios.`,
          );
          t.expect(
            radio('ice').checked && !radio('fire').checked,
            'Only the ice radio should be checked now. Each radio is checked when element === its value.',
          );
        }),
        test('The shield checkbox uses checked and e.target.checked', (t) => {
          t.render();
          const box = t.find('input[type="checkbox"]');
          t.change(box, true);
          let slip = clean(t.find('.slip').textContent);
          t.expect(
            slip.endsWith('+ shield'),
            `With the box ticked the slip reads "${slip}" — it should end with "+ shield". Control the box: checked={shield} and setShield(e.target.checked).`,
          );
          t.change(box, false);
          slip = clean(t.find('.slip').textContent);
          t.expect(
            !slip.includes('shield') && !box.checked,
            `After unticking, the slip still reads "${slip}". Store e.target.checked (true/false), not e.target.value (always the string "on").`,
          );
        }),
        test('The note textarea is controlled and counted', (t) => {
          t.sourceExcludes(/\bdefaultValue\s*=/, 'Control the textarea with value={note}, not defaultValue.');
          t.render();
          const area = t.find('textarea');
          t.expect(
            area.value === 'Make it shiny',
            `The note box shows "${area.value}" at the start — it should show the note state, "Make it shiny". Give the textarea value={note}.`,
          );
          const before = clean(t.find('.count').textContent);
          t.expect(before === '13/60', `The counter reads "${before}" at the start — expected "13/60". Show {note.length}/60.`);
          t.type(area, 'Extra sharp, please');
          const after = clean(t.find('.count').textContent);
          t.expect(
            area.value === 'Extra sharp, please' && after === '19/60',
            `After typing "Extra sharp, please" the counter reads "${after}" — expected "19/60". Is onChange calling setNote(e.target.value)?`,
          );
        }),
      ],
      concepts: [
        {
          id: 'fort-input-types',
          icon: '🎚️',
          title: 'value vs checked',
          summary: 'Text, textarea and select use value; checkboxes and radios use checked.',
          snippet: code`
            <select value={weapon} onChange={(e) => setWeapon(e.target.value)} />
            <input type="checkbox" checked={shield} onChange={(e) => setShield(e.target.checked)} />
            <input type="radio" checked={element === 'ice'} onChange={() => setElement('ice')} />
          `,
          detail: 'A radio group shares one piece of state; each radio is checked when it matches.',
        },
      ],
      css: `
        .armory { max-width: 470px; background: #fff7ed; border: 3px solid #9a3412; border-radius: 14px; padding: 14px 18px; }
        .armory h2 { color: #9a3412; }
        .armory fieldset { border: 2px dashed #fdba74; border-radius: 10px; margin: 10px 0; }
        .armory legend { color: #9a3412; font-weight: 700; padding: 0 6px; }
        .armory .note { display: block; margin-top: 8px; }
        .armory textarea { display: block; width: 100%; min-height: 60px; }
        .count { display: block; text-align: right; color: #9a3412; }
        .slip { margin-top: 10px; padding: 10px 12px; background: #fef3c7; border-left: 6px solid #f59e0b; font-weight: 700; font-family: Georgia, serif; }
      `,
    },

    // ---------------------------------------------------------------- 3
    {
      id: 'fort-scroll',
      type: 'code',
      title: 'The Recruitment Scroll',
      blurb: 'One state object, one change handler, one submit, and a button that knows when to wait.',
      xp: 140,
      story: [
        {
          text: 'Herald Quill is recruiting defenders for the fortress. Her scroll keeps every answer in ONE object... but her change handler is blank, so every field is frozen.',
          mood: 'worried',
        },
        {
          text: 'One handler for every field, an Enlist button that waits until the recruit is ready, and a proper submit. A real form at last!',
          mood: 'excited',
        },
      ],
      lesson: md`
        ## One object for the whole form

        Forms often have many fields. Instead of one \`useState\` per field, you can keep
        them together in one object:

        \`\`\`jsx
        const [form, setForm] = useState({ name: '', guild: 'Mages', oath: false });
        \`\`\`

        ## One handler for every field

        Give each input a \`name\` attribute that matches its key in the object. Then a
        single handler can update whichever field changed:

        \`\`\`jsx
        function handleChange(e) {
          const { name, value, type, checked } = e.target;
          setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
        }

        <input name="name" value={form.name} onChange={handleChange} />
        <select name="guild" value={form.guild} onChange={handleChange}>...</select>
        <input type="checkbox" name="oath" checked={form.oath} onChange={handleChange} />
        \`\`\`

        Two pieces of JavaScript make this work:

        - \`...form\` copies every existing field (you mastered this on the Immutable Isles).
        - \`[name]: value\` is a **computed property name**: the key is whatever the variable \`name\` holds.

        \`\`\`js
        const key = 'guild';
        const update = { [key]: 'Knights' }; // { guild: 'Knights' }
        \`\`\`

        ## Submitting a form

        Put an \`onSubmit\` handler on the \`<form>\` itself, not \`onClick\` on the button.
        It fires when the user clicks a submit button **or** presses Enter in a field.

        \`\`\`jsx
        function handleSubmit(e) {
          e.preventDefault();               // stop the browser's full-page reload
          setRoster([...roster, { ...form, id: nextId++ }]);     // use the data (with a unique id for the key)
          setForm(EMPTY);                   // reset: controlled fields clear themselves
        }

        <form onSubmit={handleSubmit}>
          ...
          <button type="submit">Enlist</button>
        </form>
        \`\`\`

        Left alone, a browser "submits" a form the old-fashioned way: it sends the fields
        to a server and loads a brand-new page. In a React app you handle the data
        yourself, so \`e.preventDefault()\` is always the first line.

        :::tip
        Buttons inside a form are \`type="submit"\` by default. A button that should
        *not* submit (like "Cancel") needs \`type="button"\`.
        :::

        ## Validation is just derived data

        "Is the form valid?" is not new information. It can be calculated from the state
        you already have, so calculate it during render:

        \`\`\`jsx
        const nameOk = form.name.trim().length >= 2;
        const canSubmit = nameOk && form.oath;

        {form.name !== '' && !nameOk && <p className="error">Names need at least 2 letters.</p>}
        <button type="submit" disabled={!canSubmit}>Enlist</button>
        \`\`\`

        Every keystroke re-renders, so error messages and the disabled button are always
        up to date, for free.

        :::mistake
        Keeping \`const [canSubmit, setCanSubmit] = useState(false)\` and updating it in
        every handler. That is redundant state: one forgotten update and it lies. If you
        can calculate it, calculate it.
        :::
      `,
      task: md`
        ## 🎯 Streamline the scroll

        The form state is one object: \`{ name: '', guild: 'Mages', oath: false }\`.

        1. Write **one** \`handleChange(e)\` that updates the field named by \`e.target.name\`, using a computed key: \`setForm({ ...form, [name]: ... })\`. Store \`checked\` for the checkbox and \`value\` for everything else. All three fields already call it.
        2. Derive \`canSubmit\` during render: the **trimmed** name has **at least 2 characters** AND the oath box is ticked. Disable the **Enlist** button whenever \`canSubmit\` is false.
        3. Finish \`handleSubmit\` (it already calls \`e.preventDefault()\`): add the recruit to \`roster\` as \`{ ...form, name: <trimmed name>, id: nextId++ }\` (the list uses \`key={r.id}\`), then reset the form to \`EMPTY\`.

        Each roster entry is an \`<li>\` in \`<ul className="roster">\` reading **{name} of the {guild}**, e.g. **Ada of the Knights** (already written).
      `,
      starter: code`
        import { useState } from 'react';

        const EMPTY = { name: '', guild: 'Mages', oath: false };
        let nextId = 1;

        export default function App() {
          const [form, setForm] = useState(EMPTY);
          const [roster, setRoster] = useState([]);

          function handleChange(e) {
            // TODO: one handler for every field.
            // e.target.name tells you WHICH field changed.
          }

          // TODO: derive canSubmit (trimmed name has 2+ characters AND oath is ticked)

          function handleSubmit(e) {
            e.preventDefault(); // stops the browser from reloading the page
            // TODO: add the recruit (trimmed name) to the roster, then reset the form
          }

          return (
            <form className="scroll" onSubmit={handleSubmit}>
              <h2>📜 Recruitment Scroll</h2>
              <input name="name" placeholder="Recruit's name" value={form.name} onChange={handleChange} />
              <select name="guild" value={form.guild} onChange={handleChange}>
                <option value="Mages">Mages</option>
                <option value="Knights">Knights</option>
                <option value="Rangers">Rangers</option>
              </select>
              <label>
                <input type="checkbox" name="oath" checked={form.oath} onChange={handleChange} />
                I swear the Oath of Immutability
              </label>
              <button type="submit">Enlist</button>

              <ul className="roster">
                {roster.map((r) => (
                  <li key={r.id}>
                    {r.name} of the {r.guild}
                  </li>
                ))}
              </ul>
            </form>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const EMPTY = { name: '', guild: 'Mages', oath: false };
        let nextId = 1;

        export default function App() {
          const [form, setForm] = useState(EMPTY);
          const [roster, setRoster] = useState([]);

          function handleChange(e) {
            const { name, value, type, checked } = e.target;
            setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
          }

          const canSubmit = form.name.trim().length >= 2 && form.oath;

          function handleSubmit(e) {
            e.preventDefault(); // stops the browser from reloading the page
            if (!canSubmit) return;
            setRoster([...roster, { ...form, name: form.name.trim(), id: nextId++ }]);
            setForm(EMPTY);
          }

          return (
            <form className="scroll" onSubmit={handleSubmit}>
              <h2>📜 Recruitment Scroll</h2>
              <input name="name" placeholder="Recruit's name" value={form.name} onChange={handleChange} />
              <select name="guild" value={form.guild} onChange={handleChange}>
                <option value="Mages">Mages</option>
                <option value="Knights">Knights</option>
                <option value="Rangers">Rangers</option>
              </select>
              <label>
                <input type="checkbox" name="oath" checked={form.oath} onChange={handleChange} />
                I swear the Oath of Immutability
              </label>
              <button type="submit" disabled={!canSubmit}>
                Enlist
              </button>

              <ul className="roster">
                {roster.map((r) => (
                  <li key={r.id}>
                    {r.name} of the {r.guild}
                  </li>
                ))}
              </ul>
            </form>
          );
        }
      `,
      hints: [
        md`Start the handler with \`const { name, value, type, checked } = e.target;\`. Those four come straight from the input that changed.`,
        md`\`setForm({ ...form, [name]: type === 'checkbox' ? checked : value });\` then \`const canSubmit = form.name.trim().length >= 2 && form.oath;\` and \`disabled={!canSubmit}\` on the button.`,
        md`In \`handleSubmit\`, after \`e.preventDefault()\`: \`setRoster([...roster, { ...form, name: form.name.trim(), id: nextId++ }]);\` and \`setForm(EMPTY);\`.`,
      ],
      tests: [
        test('One handleChange updates every field', (t) => {
          t.render();
          const name = t.find('input[name="name"]');
          const guild = t.find('select[name="guild"]');
          const oath = t.find('input[name="oath"]');
          t.type(name, 'Ada');
          t.expect(
            name.value === 'Ada',
            `You typed "Ada" but the name box shows "${name.value}". handleChange must call setForm({ ...form, [name]: value }).`,
          );
          t.change(guild, 'Knights');
          t.expect(guild.value === 'Knights', `You picked Knights but the guild shows "${guild.value}". The same handleChange should update form.guild.`);
          t.expect(name.value === 'Ada', 'Changing the guild wiped the name! Copy the other fields with ...form before overriding one.');
          t.change(oath, true);
          t.expect(oath.checked, 'Ticking the oath box did not stick. For checkboxes store e.target.checked.');
          t.change(oath, false);
          t.expect(
            !oath.checked,
            'The oath box cannot be unticked. A checkbox\'s e.target.value is always "on"; store type === \'checkbox\' ? checked : value.',
          );
          t.sourceIncludes(COMPUTED_KEY, 'Use a computed key in handleChange: setForm({ ...form, [name]: ... }).');
          t.sourceIncludes(
            /\.\.\.\s*[\w$.]+\s*,\s*\[/,
            'Changing one field must keep the others: copy them with ...form before the computed key, setForm({ ...form, [name]: ... }).',
          );
        }),
        test('Enlist stays disabled until the recruit is ready', (t) => {
          t.render();
          const enlist = () => t.button('Enlist');
          t.expect(enlist().disabled, 'With an empty scroll, Enlist should be disabled: disabled={!canSubmit}.');
          t.type('input[name="name"]', 'Ada');
          t.expect(enlist().disabled, 'The oath is not sworn yet, so Enlist should still be disabled.');
          t.change('input[name="oath"]', true);
          t.expect(!enlist().disabled, 'Name "Ada" and the oath is ticked: Enlist should be enabled now.');
          t.type('input[name="name"]', '  A  ');
          t.expect(
            enlist().disabled,
            'The name "  A  " is only 1 character once trimmed, so Enlist should be disabled. Use form.name.trim().length >= 2.',
          );
        }),
        test('Enlisting adds "Ada of the Knights" to the roster', (t) => {
          t.sourceExcludes(/\broster\s*\.\s*push\s*\(/, "Don't mutate roster with .push(). Create a new array: setRoster([...roster, recruit]).");
          t.render();
          t.type('input[name="name"]', 'Ada');
          t.change('select[name="guild"]', 'Knights');
          t.change('input[name="oath"]', true);
          t.expect(submitForm(t), NO_RELOAD);
          let rows = t.$$('ul.roster li').map((li) => clean(li.textContent));
          t.expect(
            rows.length === 1 && rows[0] === 'Ada of the Knights',
            `After enlisting, the roster shows ${rows.length ? `"${rows.join('", "')}"` : 'nothing'} — expected one entry: "Ada of the Knights". Add the recruit with setRoster([...roster, ...]).`,
          );
          t.type('input[name="name"]', '  Linus ');
          t.change('select[name="guild"]', 'Rangers');
          t.change('input[name="oath"]', true);
          submitForm(t);
          rows = t.$$('ul.roster li').map((li) => clean(li.textContent));
          t.expect(
            rows.length === 2 && rows[1] === 'Linus of the Rangers',
            `After a second recruit the roster shows "${rows.join('", "')}" — expected "Ada of the Knights", "Linus of the Rangers". Trim the name and keep earlier recruits.`,
          );
        }),
        test('The scroll resets after enlisting', (t) => {
          t.render();
          t.type('input[name="name"]', 'Grace');
          t.change('select[name="guild"]', 'Rangers');
          t.change('input[name="oath"]', true);
          t.expect(
            t.find('input[name="name"]').value === 'Grace' && t.find('input[name="oath"]').checked,
            'The fields don\'t keep what is typed yet, so there is nothing to reset. Finish handleChange first.',
          );
          submitForm(t);
          t.expect(t.count('ul.roster li') === 1, 'Enlisting a valid recruit should add them to the roster before the form resets.');
          const name = t.find('input[name="name"]').value;
          const guild = t.find('select[name="guild"]').value;
          const oath = t.find('input[name="oath"]').checked;
          t.expect(
            name === '' && guild === 'Mages' && oath === false,
            `After enlisting the fields still show name "${name}", guild "${guild}", oath ${oath}. Reset with setForm(EMPTY).`,
          );
          t.expect(t.button('Enlist').disabled, 'After the reset the scroll is empty again, so Enlist should be disabled.');
        }),
      ],
      concepts: [
        {
          id: 'fort-one-handler',
          icon: '🗝️',
          title: 'One handler, many fields',
          summary: 'Match each input\'s name to a key, then update it with a computed key.',
          snippet: code`
            function handleChange(e) {
              const { name, value, type, checked } = e.target;
              setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
            }
          `,
        },
        {
          id: 'fort-form-submit',
          icon: '📨',
          title: 'Form submit',
          summary: 'Handle onSubmit on the <form> and call e.preventDefault() first.',
          snippet: code`
            <form onSubmit={(e) => { e.preventDefault(); save(form); }}>
              <button type="submit">Save</button>
            </form>
          `,
          detail: 'onSubmit catches both the submit button and the Enter key. Without preventDefault the browser reloads the page.',
        },
        {
          id: 'fort-validation',
          icon: '✅',
          title: 'Derived validation',
          summary: 'Calculate validity and error messages during render, never store them.',
          snippet: code`
            const canSubmit = form.name.trim().length >= 2 && form.oath;
            <button disabled={!canSubmit}>Enlist</button>
          `,
        },
      ],
      css: `
        .scroll { max-width: 470px; padding: 18px 22px; background: linear-gradient(#fef9c3, #fde68a); border-radius: 6px;
          border: 2px solid #ca8a04; box-shadow: 0 6px 0 #a16207; font-family: Georgia, serif; }
        .scroll h2 { color: #713f12; }
        .scroll input:not([type]) { width: 60%; }
        .roster { margin-top: 12px; border-top: 2px dashed #ca8a04; padding-top: 8px; }
        .roster li { font-style: italic; }
        .roster li::marker { content: '⚔️ '; }
      `,
    },

    // ---------------------------------------------------------------- 4
    {
      id: 'fort-frozen',
      type: 'bug',
      title: 'The Frozen Drawbridge',
      blurb: 'Bug hunt! Thaw four frozen fields, and meet their uncontrolled cousins.',
      xp: 130,
      story: [
        {
          text: 'The drawbridge request form is frozen solid! The Golem\'s frost imps got into it: a name box that types gibberish, a box you can\'t type in at all, and a checkbox that lies.',
          mood: 'worried',
        },
        {
          text: 'Not every field wants to be controlled, though. One of them would be happier left alone. Read up on uncontrolled inputs, then thaw the bridge!',
          mood: 'thinking',
        },
      ],
      lesson: md`
        ## Two ways to own a field

        |  | Controlled | Uncontrolled |
        |---|---|---|
        | Who stores the value? | React state | the DOM input itself |
        | Props | \`value\` + \`onChange\` (\`checked\` for boxes) | \`defaultValue\` (\`defaultChecked\`) |
        | Reading the value | any time: it's in state | when you need it, e.g. on submit |
        | Great for | live validation, formatting, dependent fields | simple fields you only read once |

        ### Uncontrolled: set the start, then let go

        \`\`\`jsx
        <textarea name="motto" defaultValue="Render boldly" />
        \`\`\`

        \`defaultValue\` only sets the **initial** value. After that the browser owns it and
        React leaves it alone. No state, no \`onChange\`.

        ### Reading uncontrolled fields with FormData

        \`\`\`jsx
        function handleSubmit(e) {
          e.preventDefault();
          const formData = new FormData(e.target);  // e.target is the <form>
          const motto = formData.get('motto');      // looked up by the name attribute
          const all = Object.fromEntries(formData); // { motto: '...', ... }
        }
        \`\`\`

        \`FormData\` is a browser feature that collects every field inside a form that has a
        \`name\`. Checkboxes appear only when ticked (with the value \`"on"\`).

        :::pro
        React 19 can hand you that FormData directly: \`<form action={saveMotto}>\`
        calls \`saveMotto(formData)\` on submit. You'll master form actions in the Arcane Spire.
        :::

        ## The frozen-field family of bugs

        1. **\`value\` without \`onChange\`**: the field is read-only, and React warns "You provided a \`value\` prop to a form field without an \`onChange\` handler". Fix: add \`onChange\`, or switch to \`defaultValue\` if you don't need control.
        2. **\`onChange={setName}\`**: the setter receives the whole event object, so the box shows \`[object Object]\`. Fix: \`onChange={(e) => setName(e.target.value)}\`.
        3. **A checkbox with \`value\`**: \`e.target.value\` is a string like \`"on"\`, and any non-empty string is truthy. Fix: \`checked\` + \`e.target.checked\`.
        4. **\`useState()\` with no initial value**: \`value={undefined}\` starts the field uncontrolled, and typing makes it controlled. React warns about "changing an uncontrolled input to be controlled". Fix: \`useState('')\`.

        :::mistake
        Mixing both styles on one field: \`value\` **and** \`defaultValue\`. Pick one and keep
        it for the field's whole life.
        :::

        :::tip
        When in doubt, control it. Uncontrolled fields are simpler, but React doesn't own
        their value: it can't reformat or reset them, and without an \`onChange\` it never
        even sees the keystrokes.
        :::
      `,
      task: md`
        ## 🐛 Thaw the drawbridge form

        Four bugs froze the form. Fix them all:

        1. The **knight's name** box (\`input.knight\`) shows \`[object Object]\` when you type. Make it store the typed text.
        2. The **horse's name** box (\`input.horse\`) is frozen: you can't type in it at all. Make it a working controlled input.
        3. The **Lower the drawbridge** checkbox lies: unticking it doesn't disable **Cross** again. Control it with \`checked\`.
        4. The **cargo** note can't be edited. It doesn't need state: make it **uncontrolled** with \`defaultValue="3 crates of potions"\`. \`handleSubmit\` already reads it with \`FormData\`.

        When everything works, crossing shows: **Lancelot and Thunder cross the bridge carrying 3 crates of potions.**
      `,
      starter: code`
        import { useState } from 'react';

        export default function App() {
          const [knight, setKnight] = useState('');
          const [horse, setHorse] = useState('');
          const [lowered, setLowered] = useState(false);
          const [message, setMessage] = useState('');

          function handleSubmit(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            setMessage(\`\${knight} and \${horse} cross the bridge carrying \${formData.get('cargo')}.\`);
          }

          return (
            <form className="drawbridge" onSubmit={handleSubmit}>
              <h2>🌉 Drawbridge Request</h2>
              <input className="knight" placeholder="Knight's name" value={knight} onChange={setKnight} />
              <input className="horse" placeholder="Horse's name" value={horse} />
              <label>
                <input
                  type="checkbox"
                  className="lower"
                  value={lowered}
                  onChange={(e) => setLowered(e.target.value)}
                />
                Lower the drawbridge
              </label>
              <textarea className="cargo" name="cargo" value="3 crates of potions" />
              <button type="submit" disabled={!lowered}>
                Cross
              </button>
              {message && <p className="message">{message}</p>}
            </form>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        export default function App() {
          const [knight, setKnight] = useState('');
          const [horse, setHorse] = useState('');
          const [lowered, setLowered] = useState(false);
          const [message, setMessage] = useState('');

          function handleSubmit(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            setMessage(\`\${knight} and \${horse} cross the bridge carrying \${formData.get('cargo')}.\`);
          }

          return (
            <form className="drawbridge" onSubmit={handleSubmit}>
              <h2>🌉 Drawbridge Request</h2>
              <input
                className="knight"
                placeholder="Knight's name"
                value={knight}
                onChange={(e) => setKnight(e.target.value)}
              />
              <input
                className="horse"
                placeholder="Horse's name"
                value={horse}
                onChange={(e) => setHorse(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  className="lower"
                  checked={lowered}
                  onChange={(e) => setLowered(e.target.checked)}
                />
                Lower the drawbridge
              </label>
              <textarea className="cargo" name="cargo" defaultValue="3 crates of potions" />
              <button type="submit" disabled={!lowered}>
                Cross
              </button>
              {message && <p className="message">{message}</p>}
            </form>
          );
        }
      `,
      hints: [
        md`\`onChange={setKnight}\` hands the whole event to the setter. You want \`onChange={(e) => setKnight(e.target.value)}\`. The horse box needs an \`onChange\` too.`,
        md`For the checkbox, swap \`value={lowered}\` for \`checked={lowered}\`, and store \`e.target.checked\` instead of \`e.target.value\`.`,
        md`For the cargo note, replace \`value="3 crates of potions"\` with \`defaultValue="3 crates of potions"\`. No state needed: FormData reads it on submit.`,
      ],
      tests: [
        test('The knight\'s name stores the typed text', (t) => {
          t.render();
          const input = t.find('input.knight');
          t.type(input, 'Lancelot');
          t.expect(
            input.value === 'Lancelot',
            `You typed "Lancelot" but the box shows "${input.value}". onChange={setKnight} stores the whole event object; use onChange={(e) => setKnight(e.target.value)}.`,
          );
        }),
        test('The horse\'s name box is no longer frozen', (t) => {
          t.render();
          const input = t.find('input.horse');
          t.type(input, 'Thunder');
          t.expect(
            input.value === 'Thunder',
            `You typed "Thunder" but the box shows "${input.value}". It has value={horse} and no onChange, so React keeps restoring the old value. Add onChange={(e) => setHorse(e.target.value)}.`,
          );
        }),
        test('Unticking the checkbox disables Cross again', (t) => {
          t.render();
          const box = t.find('input.lower');
          const cross = () => t.button('Cross');
          t.expect(cross().disabled, 'Cross should start disabled: the drawbridge is still up.');
          t.change(box, true);
          t.expect(!cross().disabled, 'After ticking "Lower the drawbridge", Cross should be enabled.');
          t.change(box, false);
          t.expect(
            cross().disabled && !box.checked,
            'After unticking, Cross is still enabled! A checkbox\'s e.target.value is a string, and strings are truthy. Use checked={lowered} and setLowered(e.target.checked).',
          );
        }),
        test('The cargo note is uncontrolled: editable, read with FormData', (t) => {
          t.render();
          const area = t.find('textarea.cargo');
          t.expect(
            area.value === '3 crates of potions',
            `The cargo note should start as "3 crates of potions" (it shows "${area.value}"). Use defaultValue="3 crates of potions".`,
          );
          t.type(area, 'two sleepy dragons');
          t.expect(
            area.value === 'two sleepy dragons',
            `You typed "two sleepy dragons" but the note shows "${area.value}". value="..." without onChange freezes it; switch to defaultValue.`,
          );
          t.sourceIncludes(/defaultValue\s*=/, 'Make the cargo note uncontrolled with defaultValue="3 crates of potions" (no state needed).');
          t.change('input.lower', true);
          t.expect(submitForm(t), NO_RELOAD);
          const msg = clean(t.$('.message')?.textContent);
          t.expect(
            msg.endsWith('carrying two sleepy dragons.'),
            `After crossing, the message reads "${msg || 'nothing'}" — it should end with "carrying two sleepy dragons." (FormData reads what's in the box).`,
          );
        }),
        test('Lancelot and Thunder cross the bridge', (t) => {
          t.render();
          t.type('input.knight', 'Lancelot');
          t.type('input.horse', 'Thunder');
          t.change('input.lower', true);
          t.expect(submitForm(t), NO_RELOAD);
          const msg = clean(t.$('.message')?.textContent);
          t.expect(
            msg === 'Lancelot and Thunder cross the bridge carrying 3 crates of potions.',
            `The message reads "${msg || 'nothing'}" — expected "Lancelot and Thunder cross the bridge carrying 3 crates of potions."`,
          );
        }),
      ],
      concepts: [
        {
          id: 'fort-uncontrolled',
          icon: '🕊️',
          title: 'Uncontrolled inputs',
          summary: 'defaultValue sets the start; the DOM keeps the value; read it with FormData.',
          snippet: code`
            <textarea name="cargo" defaultValue="3 crates" />

            const formData = new FormData(e.target);
            formData.get('cargo');
          `,
          detail: 'Use them for simple fields you only read on submit. If React must react while the user types, control the field instead.',
        },
      ],
      css: `
        .drawbridge { max-width: 470px; padding: 16px; border-radius: 12px; background: #e0f2fe; border: 3px solid #0369a1; }
        .drawbridge h2 { color: #075985; }
        .drawbridge input:not([type]) { width: 46%; }
        .drawbridge label { display: block; margin: 6px 0; }
        .drawbridge textarea { display: block; width: 100%; min-height: 50px; }
        .message { margin-top: 10px; padding: 8px 12px; background: #dcfce7; border-radius: 8px; color: #166534; font-weight: 600; }
      `,
    },

    // ---------------------------------------------------------------- 5
    {
      id: 'fort-lifting',
      type: 'code',
      title: 'The Quartermaster\'s Ledger',
      blurb: 'Two sibling components need the same state. Lift it up to their parent.',
      xp: 150,
      story: [
        {
          text: 'Quartermaster Tally has a search bar and a ledger, two separate components sitting side by side. Type in the search and... the ledger ignores it.',
          mood: 'thinking',
        },
        {
          text: 'The search bar hoards its state, and siblings can\'t pass props sideways. Time for the oldest trick in the React book: lift the state up!',
          mood: 'excited',
        },
      ],
      lesson: md`
        ## When siblings need the same data

        \`\`\`
        App
        ├── FilterBar   ← owns the search text
        └── ItemTable   ← needs the search text!
        \`\`\`

        Props only flow **down**, from parent to child. \`FilterBar\` can't hand its state
        sideways to \`ItemTable\`. The fix is to move the state up to their **closest
        common parent** and pass it down to both.

        ## Lifting state up, in three steps

        1. **Remove** the state from the child.
        2. **Pass the value down** from the parent as a prop (\`query\`).
        3. **Pass a function down** so the child can ask the parent to change it (\`onQueryChange\`).

        \`\`\`jsx
        export default function App() {
          const [query, setQuery] = useState('');          // 1. the state lives here now
          return (
            <>
              <FilterBar query={query} onQueryChange={setQuery} />   {/* 2 + 3 */}
              <ItemTable items={ITEMS} query={query} />
            </>
          );
        }

        function FilterBar({ query, onQueryChange }) {
          return (
            <input
              value={query}                                    // controlled by the PARENT
              onChange={(e) => onQueryChange(e.target.value)}  // ask the parent to update
            />
          );
        }

        function ItemTable({ items, query }) {
          const visible = items.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          );
          return <ul>{visible.map((item) => <li key={item.id}>{item.name}</li>)}</ul>;
        }
        \`\`\`

        \`FilterBar\` is now a **controlled component**: like an \`<input>\` with \`value\`
        and \`onChange\`, its data comes in through props and changes go out through a
        callback. (Callback props named \`onSomething\` are the convention you met in the
        State Springs.)

        Notice \`onQueryChange(e.target.value)\`: the child sends the **new value**, not the
        event. The parent doesn't need to know it came from an input.

        ## A single source of truth

        For every piece of state, choose **one** component to own it. Everyone else
        receives it through props. To find the owner:

        - list every component that uses the state,
        - find their closest common parent,
        - put the state there (or even higher).

        Never keep two copies of the same data in sync: copies drift apart.

        :::tip
        The filtered list is **derived**. Calculate it during render from \`items\` and
        \`query\`; don't store it in state.
        :::

        :::mistake
        Copying a prop into state: \`const [q, setQ] = useState(query)\`. The copy reads the
        prop once, on the first render, and then ignores every update. Just use the prop.
        :::
      `,
      task: md`
        ## 🎯 Lift the filters into App

        \`FilterBar\` hides its own \`query\` and \`inStockOnly\` state, and \`ItemTable\` shows everything.

        1. Move both states into \`App\`: \`query\` (starts \`''\`) and \`inStockOnly\` (starts \`false\`). No \`useState\` left in \`FilterBar\`.
        2. \`FilterBar\` receives the props \`query\`, \`onQueryChange\`, \`inStockOnly\` and \`onInStockOnlyChange\`. The search box uses \`value={query}\` and calls \`onQueryChange(e.target.value)\`; the checkbox uses \`checked={inStockOnly}\` and calls \`onInStockOnlyChange(e.target.checked)\`.
        3. \`ItemTable\` receives \`items\`, \`query\` and \`inStockOnly\`. During render it shows only items whose name contains the query (ignoring upper/lower case) and, when \`inStockOnly\` is true, only items with \`stock > 0\`.
        4. Keep both components exported (\`export function ...\`): the checks test them on their own too.
      `,
      starter: code`
        import { useState } from 'react';

        const ITEMS = [
          { id: 1, name: 'Healing Potion', stock: 12 },
          { id: 2, name: 'Mana Potion', stock: 0 },
          { id: 3, name: 'Iron Shield', stock: 3 },
          { id: 4, name: 'Fire Scroll', stock: 0 },
          { id: 5, name: 'Elven Rope', stock: 7 },
        ];

        export function FilterBar() {
          // 😾 This state is trapped in here. ItemTable can't see it!
          const [query, setQuery] = useState('');
          const [inStockOnly, setInStockOnly] = useState(false);

          return (
            <div className="filter-bar">
              <input
                className="search"
                placeholder="Search the ledger..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  className="in-stock"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                />
                Only show items in stock
              </label>
            </div>
          );
        }

        export function ItemTable({ items }) {
          // TODO: also receive query + inStockOnly, and filter during render
          return (
            <ul className="ledger">
              {items.map((item) => (
                <li key={item.id} className={item.stock > 0 ? 'item' : 'item sold-out'}>
                  {item.name} — {item.stock > 0 ? \`\${item.stock} left\` : 'sold out'}
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          // TODO: lift query and inStockOnly up to here, then pass them down
          return (
            <div className="quartermaster">
              <h2>📦 Quartermaster's Ledger</h2>
              <FilterBar />
              <ItemTable items={ITEMS} />
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const ITEMS = [
          { id: 1, name: 'Healing Potion', stock: 12 },
          { id: 2, name: 'Mana Potion', stock: 0 },
          { id: 3, name: 'Iron Shield', stock: 3 },
          { id: 4, name: 'Fire Scroll', stock: 0 },
          { id: 5, name: 'Elven Rope', stock: 7 },
        ];

        export function FilterBar({ query, onQueryChange, inStockOnly, onInStockOnlyChange }) {
          return (
            <div className="filter-bar">
              <input
                className="search"
                placeholder="Search the ledger..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  className="in-stock"
                  checked={inStockOnly}
                  onChange={(e) => onInStockOnlyChange(e.target.checked)}
                />
                Only show items in stock
              </label>
            </div>
          );
        }

        export function ItemTable({ items, query, inStockOnly }) {
          const visible = items.filter(
            (item) =>
              item.name.toLowerCase().includes(query.toLowerCase()) && (!inStockOnly || item.stock > 0),
          );
          return (
            <ul className="ledger">
              {visible.map((item) => (
                <li key={item.id} className={item.stock > 0 ? 'item' : 'item sold-out'}>
                  {item.name} — {item.stock > 0 ? \`\${item.stock} left\` : 'sold out'}
                </li>
              ))}
            </ul>
          );
        }

        export default function App() {
          const [query, setQuery] = useState('');
          const [inStockOnly, setInStockOnly] = useState(false);

          return (
            <div className="quartermaster">
              <h2>📦 Quartermaster's Ledger</h2>
              <FilterBar
                query={query}
                onQueryChange={setQuery}
                inStockOnly={inStockOnly}
                onInStockOnlyChange={setInStockOnly}
              />
              <ItemTable items={ITEMS} query={query} inStockOnly={inStockOnly} />
            </div>
          );
        }
      `,
      hints: [
        md`Cut the two \`useState\` lines out of \`FilterBar\` and paste them into \`App\`. Then render \`<FilterBar query={query} onQueryChange={setQuery} inStockOnly={inStockOnly} onInStockOnlyChange={setInStockOnly} />\`.`,
        md`Inside \`FilterBar\`, destructure the four props and call the callbacks: \`onChange={(e) => onQueryChange(e.target.value)}\` and \`onChange={(e) => onInStockOnlyChange(e.target.checked)}\`.`,
        md`In \`ItemTable({ items, query, inStockOnly })\`: \`const visible = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()) && (!inStockOnly || item.stock > 0));\` then map over \`visible\`.`,
      ],
      tests: [
        test('Typing in the search box filters the ledger', (t) => {
          t.render();
          t.type('input.search', 'potion');
          const rows = t.$$('ul.ledger li').map((li) => clean(li.textContent));
          t.expect(
            rows.length === 2 && rows.every((r) => /potion/i.test(r)),
            `After typing "potion" the ledger shows ${rows.length} row(s): ${rows.join(' | ') || 'none'}. Expected only the 2 potions. Lift query into App and pass it to both FilterBar and ItemTable.`,
          );
        }),
        test('"Only show items in stock" hides sold-out items', (t) => {
          t.render();
          t.change('input.in-stock', true);
          let rows = t.$$('ul.ledger li').map((li) => clean(li.textContent));
          t.expect(
            rows.length === 3 && !rows.some((r) => r.includes('sold out')),
            `With the box ticked the ledger shows: ${rows.join(' | ') || 'nothing'}. Expected the 3 items in stock. Lift inStockOnly into App and filter with it in ItemTable.`,
          );
          t.type('input.search', 'potion');
          rows = t.$$('ul.ledger li').map((li) => clean(li.textContent));
          t.expect(
            rows.length === 1 && rows[0].startsWith('Healing Potion'),
            `Searching "potion" with in-stock only should leave just Healing Potion, but the ledger shows: ${rows.join(' | ') || 'nothing'}. Both filters must apply together.`,
          );
        }),
        test('FilterBar is controlled by its parent: props in, callbacks out', (t) => {
          const { FilterBar } = t.exports;
          t.expect(typeof FilterBar === 'function', 'Keep exporting FilterBar: export function FilterBar({ ... }).');
          const calls = [];
          t.renderComponent(FilterBar, {
            query: 'iron',
            inStockOnly: true,
            onQueryChange: (v) => calls.push(['query', v]),
            onInStockOnlyChange: (v) => calls.push(['stock', v]),
          });
          const input = t.find('input.search');
          t.expect(
            input.value === 'iron',
            `Rendered with query="iron", the search box shows "${input.value}". Use value={query} from the props and delete FilterBar's own useState.`,
          );
          t.expect(t.find('input.in-stock').checked, 'Rendered with inStockOnly={true}, the box should be ticked: checked={inStockOnly}.');
          t.type(input, 'rope');
          t.expect(
            calls.some(([k, v]) => k === 'query' && v === 'rope'),
            'Typing "rope" should call onQueryChange("rope"). Pass e.target.value, not the event.',
          );
          t.expect(
            input.value === 'iron',
            `The box changed itself to "${input.value}", although its parent still says "iron". FilterBar must not keep its own copy: show value={query} from props.`,
          );
          t.change('input.in-stock', false);
          t.expect(
            calls.some(([k, v]) => k === 'stock' && v === false),
            'Unticking the box should call onInStockOnlyChange(false). Pass e.target.checked.',
          );
        }),
        test('ItemTable filters with the props it receives', (t) => {
          const { ItemTable } = t.exports;
          t.expect(typeof ItemTable === 'function', 'Keep exporting ItemTable: export function ItemTable({ ... }).');
          const items = [
            { id: 1, name: 'Dragon Potion', stock: 2 },
            { id: 2, name: 'Ghost Potion', stock: 0 },
            { id: 3, name: 'Troll Rope', stock: 5 },
          ];
          t.renderComponent(ItemTable, { items, query: 'POTION', inStockOnly: true });
          const rows = t.$$('li').map((li) => clean(li.textContent));
          t.expect(
            rows.length === 1 && rows[0].startsWith('Dragon Potion'),
            `Given query "POTION" and inStockOnly, ItemTable shows: ${rows.join(' | ') || 'nothing'}. Expected only "Dragon Potion — 2 left". Filter the items prop (ignore case) using query and inStockOnly.`,
          );
        }),
      ],
      concepts: [
        {
          id: 'fort-lifting-state',
          icon: '🏗️',
          title: 'Lifting state up',
          summary: 'Move shared state to the closest common parent; pass the value and a setter down.',
          snippet: code`
            const [query, setQuery] = useState('');
            <FilterBar query={query} onQueryChange={setQuery} />
            <ItemTable query={query} items={items} />
          `,
          detail: 'The child becomes a controlled component: data in through props, changes out through callbacks.',
        },
        {
          id: 'fort-single-source',
          icon: '🎯',
          title: 'Single source of truth',
          summary: 'Each piece of state has exactly one owner; everyone else reads it from props.',
          detail: 'Two copies of the same data inevitably drift apart. Derive what you can, and lift the rest to a shared owner.',
        },
      ],
      css: `
        .quartermaster { max-width: 480px; }
        .quartermaster h2 { color: #5b21b6; }
        .filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px; background: #ede9fe; border-radius: 10px; }
        .search { flex: 1; min-width: 160px; }
        .ledger { list-style: none; padding: 0; }
        .ledger .item { padding: 8px 12px; margin: 6px 0; background: white; border: 2px solid #ddd6fe; border-radius: 10px; }
        .ledger .sold-out { opacity: 0.55; text-decoration: line-through; }
      `,
    },

    // ---------------------------------------------------------------- 6
    {
      id: 'fort-trial',
      type: 'quiz',
      title: 'Trial of the Battlements',
      blurb: 'The fortress sentries quiz every visitor. Prove you command your forms.',
      xp: 100,
      story: [
        {
          text: 'The sentries on the battlements let nobody pass without a riddle or eight. Every answer comes with an explanation, so even a wrong guess teaches you something!',
          mood: 'happy',
        },
      ],
      task: md`Answer each question. A perfect run earns **3 stars**.`,
      questions: [
        q(
          'What makes this input **controlled**?\n\n```jsx\n<input value={name} onChange={(e) => setName(e.target.value)} />\n```',
          [
            'The `onChange` prop on its own',
            'It has no `name` attribute',
            'It always displays React state (`value`), and every edit goes back through `onChange`',
            'It uses an arrow function',
          ],
          2,
          'A controlled input shows exactly what the state says (`value={name}`) and reports every edit (`onChange`) so you can update that state. React state is the single source of truth.',
        ),
        q(
          'You type into this field and nothing appears. Why?\n\n```jsx\nconst [city, setCity] = useState(\'\');\nreturn <input value={city} />;\n```',
          [
            'The field has `value` but no `onChange`, so React keeps restoring the empty value',
            '`useState` needs a number to start with',
            'Inputs need a `type` attribute',
            'You must pass both `value` and `defaultValue`',
          ],
          0,
          'With `value` and no `onChange`, the field is read-only: React puts `city` back after every keystroke (and warns in the console). Add `onChange={(e) => setCity(e.target.value)}`, or use `defaultValue` if you don\'t need control.',
        ),
        q(
          'Which pair correctly controls a checkbox?',
          [
            '`value={agree}` and `setAgree(e.target.value)`',
            '`selected={agree}` and `setAgree(e.target.selected)`',
            '`defaultChecked={agree}` and `setAgree(e.target.value)`',
            '`checked={agree}` and `setAgree(e.target.checked)`',
          ],
          3,
          'Checkboxes are booleans: control them with `checked` and read `e.target.checked`. A checkbox\'s `e.target.value` is a string like `"on"`, which is always truthy.',
        ),
        q(
          'The user types into `<input name="email" />`. What does this handler do?\n\n```jsx\nsetForm({ ...form, [e.target.name]: e.target.value });\n```',
          [
            'Adds a key literally called "e.target.name"',
            'Copies the form object and replaces only its `email` key',
            'Replaces the whole form with just the email',
            'Mutates `form.email` directly',
          ],
          1,
          '`...form` copies every field, and `[e.target.name]` is a computed key, so it evaluates to `"email"`. One handler can update any field, as long as each input\'s `name` matches a key.',
        ),
        q(
          'Why does `handleSubmit` start with `e.preventDefault()`?',
          [
            'To stop React from re-rendering',
            'To clear all the inputs',
            'To stop the browser from submitting the form the old-fashioned way and reloading the page',
            'To let the event bubble up to the parent',
          ],
          2,
          'By default a browser submits a form by sending it to a server and loading a new page. In React you handle the data yourself, so you cancel that default first.',
        ),
        q(
          '`<SearchBox>` and `<ResultsList>` are siblings, and both need the search text. Where should that state live?',
          [
            'In `SearchBox`, copied into `ResultsList` with an effect',
            'In both components, kept in sync by hand',
            'In a global variable',
            'In their closest common parent, passed down as props',
          ],
          3,
          'Lift the state up to the closest common parent. Pass the value down to both, and pass a callback (like `onSearchChange`) to the child that edits it. One owner, one source of truth.',
        ),
        q(
          'Which statement about `defaultValue` is true?',
          [
            'It sets the starting value of an uncontrolled input; after that the browser owns the value',
            'It updates the input whenever the variable changes',
            'It must be used together with `value`',
            'It only works on checkboxes',
          ],
          0,
          '`defaultValue` (and `defaultChecked`) only set the initial value. React won\'t touch the field again, so read it later, for example with `new FormData(form)` on submit. Never combine it with `value`.',
        ),
        q(
          'A sign-up form has `const [password, setPassword] = useState(\'\')`. Where should `isStrong` come from?',
          [
            'A second state variable updated in every handler',
            'An effect that watches `password` and sets `isStrong`',
            'Calculated during render: `const isStrong = password.length >= 8;`',
            'Read from the input element with `document.querySelector`',
          ],
          2,
          'Validity is derived data: calculate it from the state you already have, on every render. Extra state (or an effect) adds renders and can drift out of sync.',
        ),
      ],
      concepts: [
        {
          id: 'fort-controlled-vs-uncontrolled',
          icon: '⚖️',
          title: 'Controlled vs uncontrolled',
          summary: 'Control a field when React must react while typing; leave it uncontrolled when you only read it once.',
          detail: 'Controlled: value/checked + onChange, state is the truth. Uncontrolled: defaultValue/defaultChecked, the DOM is the truth, read it with FormData.',
        },
      ],
    },

    // ---------------------------------------------------------------- 7 (boss)
    {
      id: 'fort-boss',
      type: 'build',
      boss: true,
      bossName: 'The Uncontrolled Golem',
      bossIcon: '🗿',
      title: 'Boss: The Uncontrolled Golem',
      blurb: 'A golem built from fields nobody controls. Take control and bind him!',
      xp: 300,
      badge: {
        id: 'badge-fort',
        name: 'Keeper of the Keys',
        icon: '🗝️',
        description: 'Bound the Uncontrolled Golem in Form Fortress.',
      },
      story: [
        {
          text: 'The ground shakes... THE UNCONTROLLED GOLEM stomps out of the keep! He\'s made entirely of form fields that nobody controls.',
          mood: 'worried',
        },
        {
          text: 'His binding form is uncontrolled: React never sees a keystroke, so his rune armour can\'t crack while you type. That\'s why he\'s laughing.',
          mood: 'thinking',
        },
        {
          text: 'Take control of every field, crack all four runes live, then bind him with a perfect submit. For the fortress!',
          mood: 'excited',
        },
      ],
      lesson: md`
        ## Everything from the Fortress

        | Skill | Example |
        |---|---|
        | Controlled field | \`value={form.name}\` + \`onChange={handleChange}\` |
        | Checkbox | \`checked={form.oath}\`, read \`e.target.checked\` |
        | One handler | \`setForm({ ...form, [name]: type === 'checkbox' ? checked : value })\` |
        | Derived validation | \`const nameOk = form.name.trim().length >= 3;\` |
        | Disabled submit | \`<button disabled={!canSubmit}>\` |
        | Submit | \`onSubmit\` on the \`<form>\`, \`e.preventDefault()\` first |

        ## The golem's weakness

        The golem's fields only have \`defaultValue\`, with no \`onChange\`, so React never
        hears a keystroke. Nothing re-renders, so nothing derived from the fields (rune checks,
        HP, a disabled button) can update. Control them and every keystroke flows through
        state, so everything derived stays live.

        Once everything lives in state, the runes are just a calculation:

        \`\`\`jsx
        const checks = [
          { label: 'Rule one', ok: /* a true/false expression using form */ true },
          { label: 'Rule two', ok: false },
        ];
        const passed = checks.filter((c) => c.ok).length;   // derived again!
        \`\`\`

        :::tip
        Build it step by step and press **✓ Check quest** often: the objective list shows
        which parts already work. Start with \`handleChange\`, then the runes, then HP,
        then the button and the victory.
        :::
      `,
      task: md`
        ## 👑 Bind the Uncontrolled Golem

        The binding form is fully **uncontrolled**. Take control:

        1. Replace every \`defaultValue\` / \`defaultChecked\` with ONE \`form\` state object \`{ name: '', element: '', chant: '', oath: false }\` and ONE \`handleChange\` that updates \`[e.target.name]\` (\`checked\` for the checkbox). Control all four fields with \`value\` / \`checked\`.
        2. Derive the four runes during render (rules below). Each \`<li>\` in \`<ul className="runes">\` keeps its text and order, and gets className **rune cracked** when its rule passes, otherwise **rune**.
        3. \`<p className="golem-hp">\` shows **HP: {hp}**, where hp is **100 − 25 × the number of cracked runes**.
        4. Disable the **Bind the golem** button until all four runes are cracked.
        5. In \`handleSubmit\` (it already calls \`e.preventDefault()\`), bind the golem with \`setVictor(...)\` using the trimmed name. The victory screen then reads **The golem is bound! Well fought, Ada.**

        | Rune | Cracks when… |
        |---|---|
        | Name rune | the **trimmed** name has at least **3** characters |
        | Element rune | an element is chosen (not \`''\`) |
        | Chant rune | the **trimmed** chant has at least **10** characters |
        | Oath rune | the oath box is ticked |
      `,
      starter: code`
        import { useState } from 'react';

        const ELEMENTS = ['fire', 'water', 'earth'];

        export default function App() {
          const [victor, setVictor] = useState('');

          // 🗿 The golem is made of UNCONTROLLED fields: React never sees a keystroke,
          // so the runes can never crack while you type. Take control!

          function handleSubmit(e) {
            e.preventDefault(); // keeps the page from reloading
            // TODO: bind the golem: setVictor(the trimmed name)
          }

          if (victor) {
            return <p className="victory">The golem is bound! Well fought, {victor}.</p>;
          }

          return (
            <div className="arena">
              <div className="golem">🗿</div>
              <p className="golem-hp">HP: 100</p>

              <form className="binding" onSubmit={handleSubmit}>
                <input name="name" placeholder="Your name" defaultValue="" />
                <select name="element" defaultValue="">
                  <option value="">Choose an element…</option>
                  {ELEMENTS.map((el) => (
                    <option key={el} value={el}>
                      {el}
                    </option>
                  ))}
                </select>
                <textarea name="chant" placeholder="Your binding chant (10+ characters)" defaultValue="" />
                <label>
                  <input type="checkbox" name="oath" defaultChecked={false} />
                  I swear to bind, not break
                </label>

                <ul className="runes">
                  <li className="rune">Name rune: 3+ letters</li>
                  <li className="rune">Element rune: choose one</li>
                  <li className="rune">Chant rune: 10+ characters</li>
                  <li className="rune">Oath rune: swear it</li>
                </ul>

                <button type="submit">Bind the golem</button>
              </form>
            </div>
          );
        }
      `,
      solution: code`
        import { useState } from 'react';

        const ELEMENTS = ['fire', 'water', 'earth'];
        const EMPTY = { name: '', element: '', chant: '', oath: false };

        export default function App() {
          const [form, setForm] = useState(EMPTY);
          const [victor, setVictor] = useState('');

          function handleChange(e) {
            const { name, value, type, checked } = e.target;
            setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
          }

          const runes = [
            { label: 'Name rune: 3+ letters', ok: form.name.trim().length >= 3 },
            { label: 'Element rune: choose one', ok: form.element !== '' },
            { label: 'Chant rune: 10+ characters', ok: form.chant.trim().length >= 10 },
            { label: 'Oath rune: swear it', ok: form.oath },
          ];
          const cracked = runes.filter((rune) => rune.ok).length;
          const hp = 100 - 25 * cracked;
          const canBind = cracked === runes.length;

          function handleSubmit(e) {
            e.preventDefault(); // keeps the page from reloading
            if (!canBind) return;
            setVictor(form.name.trim());
          }

          if (victor) {
            return <p className="victory">The golem is bound! Well fought, {victor}.</p>;
          }

          return (
            <div className="arena">
              <div className="golem">🗿</div>
              <p className="golem-hp">HP: {hp}</p>

              <form className="binding" onSubmit={handleSubmit}>
                <input name="name" placeholder="Your name" value={form.name} onChange={handleChange} />
                <select name="element" value={form.element} onChange={handleChange}>
                  <option value="">Choose an element…</option>
                  {ELEMENTS.map((el) => (
                    <option key={el} value={el}>
                      {el}
                    </option>
                  ))}
                </select>
                <textarea
                  name="chant"
                  placeholder="Your binding chant (10+ characters)"
                  value={form.chant}
                  onChange={handleChange}
                />
                <label>
                  <input type="checkbox" name="oath" checked={form.oath} onChange={handleChange} />
                  I swear to bind, not break
                </label>

                <ul className="runes">
                  {runes.map((rune) => (
                    <li key={rune.label} className={rune.ok ? 'rune cracked' : 'rune'}>
                      {rune.label}
                    </li>
                  ))}
                </ul>

                <button type="submit" disabled={!canBind}>
                  Bind the golem
                </button>
              </form>
            </div>
          );
        }
      `,
      hints: [
        md`Start with the state and the handler from the Recruitment Scroll: \`const [form, setForm] = useState({ name: '', element: '', chant: '', oath: false });\` and a \`handleChange\` with \`[name]: type === 'checkbox' ? checked : value\`. Then swap each \`defaultValue\` for \`value={form.…}\` + \`onChange={handleChange}\` (and \`checked={form.oath}\` for the box).`,
        md`Make the runes data: \`const runes = [{ label: 'Name rune: 3+ letters', ok: form.name.trim().length >= 3 }, ...]\`. Render them with \`runes.map((rune) => <li key={rune.label} className={rune.ok ? 'rune cracked' : 'rune'}>{rune.label}</li>)\`.`,
        md`\`const cracked = runes.filter((r) => r.ok).length;\`, \`const hp = 100 - 25 * cracked;\`, \`disabled={cracked < 4}\` on the button, and \`setVictor(form.name.trim())\` in \`handleSubmit\`.`,
      ],
      tests: [
        test('One form object controls every field (no defaults left)', (t) => {
          t.sourceExcludes(
            /\bdefault(Value|Checked)\s*=/,
            'The golem still has defaultValue / defaultChecked fields. Replace them with value={form.…} / checked={form.oath} plus onChange={handleChange}.',
          );
          t.sourceIncludes(COMPUTED_KEY, 'Use ONE handleChange with a computed key: setForm({ ...form, [name]: ... }).');
          t.render();
          const name = t.find('input[name="name"]');
          t.type(name, 'Ada');
          t.expect(name.value === 'Ada', `You typed "Ada" but the name box shows "${name.value}". Is handleChange updating form.name?`);
          const oath = t.find('input[name="oath"]');
          t.change(oath, true);
          t.change(oath, false);
          t.expect(!oath.checked, 'The oath box cannot be unticked. For checkboxes store e.target.checked.');
        }),
        test('Each rune cracks exactly when its rule passes', (t) => {
          t.render();
          const states = () => t.$$('ul.runes li').map((li) => li.classList.contains('cracked'));
          t.expect(t.count('ul.runes li') === 4, `Expected 4 runes in <ul className="runes">, found ${t.count('ul.runes li')}.`);
          t.expect(!states().some(Boolean), 'At the start no rune should have the class "cracked".');
          const name = t.find('input[name="name"]');
          t.type(name, '  Al  ');
          t.expect(!states()[0], '"  Al  " is only 2 letters once trimmed, so the name rune must stay uncracked. Use form.name.trim().length >= 3.');
          t.type(name, 'Ada');
          t.expect(states()[0], 'With the name "Ada" the first rune should get className "rune cracked". Is the name field controlled?');
          t.change('select[name="element"]', 'earth');
          t.expect(states()[1], 'Choosing "earth" should crack the element rune (element !== \'\').');
          const chant = t.find('textarea[name="chant"]');
          t.type(chant, '  Be still  ');
          t.expect(!states()[2], '"  Be still  " is only 8 characters once trimmed: the chant rune needs at least 10.');
          t.type(chant, 'Stone, be still!');
          t.expect(states()[2], 'A 16-character chant should crack the chant rune.');
          t.change('input[name="oath"]', true);
          t.expect(states()[3], 'Ticking the oath should crack the last rune.');
        }),
        test('The golem loses 25 HP per cracked rune', (t) => {
          t.render();
          const hp = () => clean(t.find('.golem-hp').textContent);
          const steps = [];
          steps.push(hp());
          t.type('input[name="name"]', 'Ada');
          steps.push(hp());
          t.change('select[name="element"]', 'water');
          steps.push(hp());
          t.type('textarea[name="chant"]', 'Stone, be still!');
          steps.push(hp());
          t.change('input[name="oath"]', true);
          steps.push(hp());
          const expected = ['HP: 100', 'HP: 75', 'HP: 50', 'HP: 25', 'HP: 0'];
          t.expect(
            steps.join(' → ') === expected.join(' → '),
            `While filling the form the golem showed ${steps.join(' → ')} — expected ${expected.join(' → ')}. Compute hp = 100 - 25 * crackedRunes during render.`,
          );
          t.change('input[name="oath"]', false);
          t.expect(hp() === 'HP: 25', `Unticking the oath should heal the golem back to "HP: 25" (it shows "${hp()}"). Derived values follow the state both ways.`);
        }),
        test('"Bind the golem" stays disabled until all four runes crack', (t) => {
          t.render();
          const bind = () => t.button('Bind the golem');
          t.expect(bind().disabled, 'With an empty form the button should be disabled.');
          t.type('input[name="name"]', 'Ada');
          t.change('select[name="element"]', 'fire');
          t.type('textarea[name="chant"]', 'Stone, be still!');
          t.expect(bind().disabled, 'Three runes cracked, but the oath is missing: the button should still be disabled.');
          t.change('input[name="oath"]', true);
          t.expect(!bind().disabled, 'All four runes are cracked: the button should be enabled now.');
          t.type('input[name="name"]', 'Al');
          t.expect(bind().disabled, 'The name dropped to 2 letters, so the button should be disabled again.');
        }),
        test('Binding the golem shows the victory', (t) => {
          t.render();
          t.type('input[name="name"]', '  Ada ');
          t.change('select[name="element"]', 'fire');
          t.type('textarea[name="chant"]', 'Stone, be still!');
          t.change('input[name="oath"]', true);
          t.expect(submitForm(t), NO_RELOAD);
          const victory = clean(t.$('.victory')?.textContent);
          t.expect(
            victory === 'The golem is bound! Well fought, Ada.',
            `After binding, .victory reads "${victory || 'nothing'}" — expected "The golem is bound! Well fought, Ada." Call setVictor(form.name.trim()) in handleSubmit.`,
          );
          t.expect(!t.$('form'), 'Once the golem is bound, the form should be gone (the victory replaces it).');
        }),
      ],
      concepts: [
        {
          id: 'fort-live-validation',
          icon: '🗿',
          title: 'Live validation',
          summary: 'Controlled fields + derived rules = feedback on every keystroke.',
          snippet: code`
            const rules = [form.name.trim().length >= 3, form.oath];
            const passed = rules.filter(Boolean).length;
            <button disabled={passed < rules.length}>Submit</button>
          `,
          detail: 'A field with only defaultValue and no onChange never tells React about keystrokes, so nothing derived from it can update. Control it to get live feedback.',
        },
      ],
      css: `
        .arena { max-width: 480px; margin: 0 auto; text-align: center; }
        .golem { font-size: 72px; line-height: 1.1; filter: drop-shadow(0 6px 0 #57534e); animation: golem-stomp 1.6s ease-in-out infinite; }
        @keyframes golem-stomp { 50% { transform: translateY(-6px) rotate(-3deg); } }
        .golem-hp { font-weight: 800; color: #b91c1c; font-size: 1.25em; }
        .binding { display: grid; gap: 6px; text-align: left; padding: 14px; background: #f5f5f4; border: 3px solid #57534e; border-radius: 14px; }
        .binding textarea { min-height: 56px; }
        .runes { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .rune { padding: 6px 8px; border-radius: 8px; background: #44403c; color: #d6d3d1; font-size: 0.9em; }
        .rune::before { content: '🪨 '; }
        .rune.cracked { background: #7c3aed; color: white; }
        .rune.cracked::before { content: '💥 '; }
        .victory { font-size: 1.3em; font-weight: 800; color: #6d28d9; text-align: center; padding: 30px; }
      `,
    },
  ],
};
