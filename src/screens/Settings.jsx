import React, { useRef } from 'react';
import { sanitizeSave, useGame } from '../game/store.jsx';
import { Button } from '../components/ui.jsx';
import { play } from '../game/sound.js';

export function Settings({ go }) {
  const { state, dispatch } = useGame();
  const fileRef = useRef(null);

  const toggle = (key) => {
    play('click');
    dispatch({ type: 'SET_SETTING', key, value: !state.settings[key] });
  };

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reactoria-save-${state.player.name || 'hero'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importSave = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!sanitizeSave(data)) throw new Error('Not a Reactoria save file');
      dispatch({ type: 'IMPORT', state: data });
      play('unlock');
      alert('Save imported!');
    } catch (err) {
      alert(`Could not import: ${err.message}`);
    }
    e.target.value = '';
  };

  return (
    <div className="settings-screen">
      <header className="level-header">
        <Button size="small" variant="ghost" onClick={() => go('map')}>
          ◂ Map
        </Button>
        <div className="level-title">
          <h1>⚙️ Settings</h1>
        </div>
        <div />
      </header>
      <main className="settings-body">
        <section className="settings-group">
          <h3>Game</h3>
          <label className="switch-row">
            <span>
              <strong>Sound effects</strong>
              <small>Chiptune bleeps for clicks, wins and fails.</small>
            </span>
            <input type="checkbox" checked={state.settings.sound} onChange={() => toggle('sound')} />
          </label>
          <label className="switch-row">
            <span>
              <strong>Animations</strong>
              <small>Confetti, typewriter text and floating scenery.</small>
            </span>
            <input type="checkbox" checked={state.settings.motion} onChange={() => toggle('motion')} />
          </label>
          <label className="switch-row">
            <span>
              <strong>Explorer mode</strong>
              <small>Unlock every quest now. Handy if you already know some React and want to jump ahead.</small>
            </span>
            <input type="checkbox" checked={state.settings.unlockAll} onChange={() => toggle('unlockAll')} />
          </label>
        </section>

        <section className="settings-group">
          <h3>Hero</h3>
          <label className="field">
            <span>Name</span>
            <input
              value={state.player.name}
              maxLength={20}
              onChange={(e) => dispatch({ type: 'SET_PLAYER', player: { name: e.target.value } })}
            />
          </label>
        </section>

        <section className="settings-group">
          <h3>Save data</h3>
          <p className="muted">Your progress is saved automatically in this browser. Export it to move to another device.</p>
          <div className="settings-actions">
            <Button onClick={exportSave}>⬇ Export save</Button>
            <Button onClick={() => fileRef.current?.click()}>⬆ Import save</Button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Erase ALL progress? This cannot be undone.')) {
                  dispatch({ type: 'RESET' });
                  go('title');
                }
              }}
            >
              🗑 Reset progress
            </Button>
          </div>
        </section>

        <section className="settings-group">
          <h3>Controls</h3>
          <ul className="muted">
            <li>
              <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> — check your quest
            </li>
            <li>
              <kbd>Esc</kbd> — close dialogs
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
