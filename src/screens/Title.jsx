import React, { useState } from 'react';
import { useGame } from '../game/store.jsx';
import { Button } from '../components/ui.jsx';
import { Dialog, PipSprite } from '../components/Companion.jsx';
import { play } from '../game/sound.js';
import { chapters, allLevels } from '../content/index.js';

const AVATARS = ['🧙', '🧝', '🦊', '🐉', '🤖', '🦉', '🐱', '👩‍🚀', '🧑‍💻', '🦄', '🐸', '👾'];

const INTRO = [
  { text: 'Psst! Over here! You can see me? Oh, thank the Virtual DOM — a real human!', mood: 'happy' },
  {
    text: "I'm Pip. Welcome to Reactoria: a world rendered from state. When the state changes, the world re-renders. At least... it used to.",
    mood: 'happy',
  },
  {
    text: 'The Mutator has been changing state directly — mutating it! — so nothing re-renders anymore. Villages are frozen mid-frame. It is a mess.',
    mood: 'worried',
  },
  {
    text: "Legend says a Render Mage will restore declarative order. That's you. Probably! Let's start at the Shore of JSX — I'll teach you everything as we go.",
    mood: 'happy',
  },
];

export function Title({ go }) {
  const { state, dispatch } = useGame();
  const hasSave = Boolean(state.player.name);
  const [phase, setPhase] = useState('splash');
  const [name, setName] = useState(state.player.name || '');
  const [avatar, setAvatar] = useState(state.player.avatar || '🧙');

  const startNew = () => {
    play('click');
    setPhase('name');
  };

  const confirmName = (e) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 20) || 'Hero';
    dispatch({ type: 'SET_PLAYER', player: { name: clean, avatar } });
    play('unlock');
    setPhase('intro');
  };

  return (
    <div className="title-screen">
      <div className="title-atom" aria-hidden="true">
        <div className="orbit orbit-1" />
        <div className="orbit orbit-2" />
        <div className="orbit orbit-3" />
        <div className="nucleus" />
      </div>

      {phase === 'splash' && (
        <div className="title-card">
          <p className="title-kicker">A playable course in</p>
          <h1 className="title-logo">
            REACT<span>ORIA</span>
          </h1>
          <p className="title-tagline">Enter a world rendered from state. Learn React by saving it.</p>
          <div className="title-actions">
            {hasSave && state.introSeen ? (
              <>
                <Button variant="primary" size="big" onClick={() => go('map')}>
                  ▶ Continue as {state.player.avatar} {state.player.name}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm('Start a brand new adventure? Your progress will be erased.')) {
                      dispatch({ type: 'RESET' });
                      setName('');
                      startNew();
                    }
                  }}
                >
                  New adventure
                </Button>
              </>
            ) : (
              <Button variant="primary" size="big" className="pulse" onClick={startNew}>
                ▶ Press Start
              </Button>
            )}
          </div>
          <ul className="title-features">
            <li>
              🗺️ {chapters.length} regions · {allLevels.length} quests
            </li>
            <li>⚔️ Write real React in-game</li>
            <li>⭐ XP, stars, badges & a final boss</li>
          </ul>
        </div>
      )}

      {phase === 'name' && (
        <form className="title-card" onSubmit={confirmName}>
          <h2>Who dares enter Reactoria?</h2>
          <label className="field">
            <span>Your hero name</span>
            <input
              autoFocus
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ada"
            />
          </label>
          <div className="field">
            <span>Choose your avatar</span>
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button
                  type="button"
                  key={a}
                  className={`avatar-pick ${a === avatar ? 'selected' : ''}`}
                  onClick={() => {
                    play('pop');
                    setAvatar(a);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="title-actions">
            <Button type="submit" variant="primary" size="big">
              Enter the world →
            </Button>
          </div>
        </form>
      )}

      {phase === 'intro' && (
        <div className="title-intro">
          <div className="title-intro-scene">
            <div className="scene-player">{avatar}</div>
            <PipSprite size={90} />
          </div>
          <Dialog
            lines={INTRO}
            onDone={() => {
              dispatch({ type: 'MARK_INTRO' });
              go('map');
            }}
          />
        </div>
      )}
    </div>
  );
}
