import React, { useEffect } from 'react';
import { useGame } from '../game/store.jsx';
import { Dialog, PipSprite } from '../components/Companion.jsx';
import { burstConfetti } from '../game/confetti.js';
import { play } from '../game/sound.js';
import { chapters } from '../content/index.js';

const ENDING = (name) => [
  { text: 'Listen... do you hear that? Click. Click. Click. Every frozen frame in Reactoria is re-rendering!', mood: 'excited' },
  { text: `The Mutator is gone, ${name}. Not defeated by force — replaced. You gave every region new state instead of changing the old one.`, mood: 'happy' },
  { text: 'The crabs on the Shore of JSX are dancing. The Effect Volcano finally cleaned up after itself. Even the Re-render Wyrm is... memoised.', mood: 'happy' },
  { text: 'You started out barely knowing what a component was. Now you can build anything: from a single <h1> to a full app with reducers, context, effects and actions.', mood: 'thinking' },
  { text: 'Here is my last lesson, and the most important one: the best way to master React is to build things you care about. Lots of them.', mood: 'happy' },
  { text: 'The Council of Reactoria has prepared something for you. Go on — you earned it, Render Mage.', mood: 'excited' },
];

export function Finale({ go }) {
  const { state } = useGame();
  useEffect(() => {
    play('victory');
    if (state.settings.motion) {
      burstConfetti({ count: 200 });
      const id = setTimeout(() => burstConfetti({ count: 200 }), 1400);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state.settings.motion]);

  return (
    <div className="finale-screen">
      <div className="finale-sky" aria-hidden="true">
        {chapters.map((c, i) => (
          <span key={c.id} style={{ left: `${(i * 71 + 9) % 94}%`, animationDelay: `${i * 0.35}s` }}>
            {c.icon}
          </span>
        ))}
      </div>
      <div className="finale-stage">
        <div className="finale-heroes">
          <div className="scene-player">{state.player.avatar}</div>
          <PipSprite size={110} mood="excited" />
        </div>
        <h1 className="finale-title">REACTORIA RESTORED</h1>
      </div>
      <div className="finale-dialog">
        <Dialog lines={ENDING(state.player.name || 'hero')} onDone={() => go('certificate')} />
      </div>
    </div>
  );
}
