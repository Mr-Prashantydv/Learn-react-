import React, { useEffect } from 'react';
import { useGame } from '../game/store.jsx';
import { chapters, allLevels } from '../content/index.js';
import { rankFor, totalStars } from '../game/progression.js';
import { Button } from '../components/ui.jsx';
import { burstConfetti } from '../game/confetti.js';
import { play } from '../game/sound.js';

export function Certificate({ go }) {
  const { state } = useGame();
  const rank = rankFor(state.xp);
  const stars = totalStars(state);
  const maxStars = allLevels.length * 3;
  const date = new Date(state.finishedAt || Date.now()).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    play('victory');
    if (state.settings.motion) burstConfetti({ count: 260 });
  }, [state.settings.motion]);

  return (
    <div className="certificate-screen">
      <div className="certificate">
        <div className="certificate-border">
          <p className="certificate-kicker">The Council of Reactoria hereby recognises</p>
          <h1 className="certificate-name">
            {state.player.avatar} {state.player.name}
          </h1>
          <p className="certificate-title">as a {rank.title}</p>
          <p className="certificate-body">
            for restoring declarative order to all {chapters.length} regions of Reactoria — mastering JSX, components,
            props, state, events, effects, refs, context, reducers, custom hooks, performance and the arcane arts of
            modern React.
          </p>
          <div className="certificate-stats">
            <div>
              <strong>{state.xp}</strong>
              <span>XP</span>
            </div>
            <div>
              <strong>
                {stars}/{maxStars}
              </strong>
              <span>Stars</span>
            </div>
            <div>
              <strong>{state.badges.length}</strong>
              <span>Badges</span>
            </div>
            <div>
              <strong>{state.codex.length}</strong>
              <span>Codex entries</span>
            </div>
          </div>
          <div className="certificate-footer">
            <span>{date}</span>
            <span className="certificate-seal">⚛</span>
            <span>Pip, Keeper of the Render Loop</span>
          </div>
        </div>
      </div>
      <div className="certificate-actions no-print">
        <Button onClick={() => go('map')}>◂ Back to the map</Button>
        <Button variant="primary" onClick={() => window.print()}>
          🖨 Print / save as PDF
        </Button>
      </div>
      <p className="certificate-next no-print muted">
        Where next? Build something real: a portfolio, a game, a tool you need. Then explore a framework like Next.js or
        React Router, add TypeScript, and test with React Testing Library.
      </p>
    </div>
  );
}
