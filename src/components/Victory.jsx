import React, { useEffect, useState } from 'react';
import { Modal, Button, Stars } from './ui.jsx';
import { burstConfetti } from '../game/confetti.js';
import { play } from '../game/sound.js';
import { PipSprite } from './Companion.jsx';

/**
 * The reward screen after a quest: stars pop in, XP counts up, badges and
 * codex entries are revealed.
 */
export function VictoryModal({ reward, level, onNext, onMap, hasNext, onFinale, motion = true }) {
  const [xpShown, setXpShown] = useState(0);

  useEffect(() => {
    play('victory');
    if (motion) burstConfetti({ count: reward.stars >= 3 ? 220 : 140 });
    const total = reward.xp;
    if (!motion) {
      setXpShown(total);
      return undefined;
    }
    const start = performance.now();
    const dur = 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      setXpShown(Math.round(total * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reward, motion]);

  const praise =
    reward.stars >= 3
      ? ['Flawless!', 'Declarative perfection.', 'The Virtual DOM approves.', 'Not a single mutation. Beautiful.']
      : reward.stars === 2
        ? ['Quest complete!', 'Nicely done.', 'Solid work, Render Mage.']
        : ['Quest complete.', 'You made it through!'];
  const line = praise[(level.id.length + reward.stars) % praise.length];

  return (
    <Modal className="victory" onClose={() => {}}>
      <div className="victory-header">
        <PipSprite size={64} mood="happy" />
        <div>
          <p className="victory-kicker">{level.boss ? 'BOSS DEFEATED' : level.type === 'quiz' ? 'TRIAL PASSED' : 'QUEST COMPLETE'}</p>
          <h2>{line}</h2>
        </div>
      </div>
      <div className="victory-stars">
        <Stars count={reward.stars} size="xl" animate={motion} />
      </div>
      <div className="victory-xp">
        +{xpShown} XP
        {reward.xp === 0 && <span className="muted"> (already earned)</span>}
      </div>
      {reward.stars < 3 && level.type !== 'quiz' && (
        <p className="victory-note muted">
          {reward.solutionShown
            ? 'Replay without peeking at the solution for more stars.'
            : 'Replay without hints and in fewer attempts to earn 3 stars.'}
        </p>
      )}
      {reward.rankUp && (
        <div className="victory-rankup">
          <span className="victory-rankup-icon">{reward.rankUp.icon}</span>
          <div>
            <div className="victory-rankup-title">RANK UP!</div>
            <div>
              You are now a <strong>{reward.rankUp.title}</strong>.
            </div>
          </div>
        </div>
      )}
      {reward.badge && (
        <div className="victory-badge">
          <div className="victory-badge-icon">{reward.badge.icon}</div>
          <div>
            <div className="victory-badge-title">New badge: {reward.badge.name}</div>
            <div className="muted">{reward.badge.description}</div>
          </div>
        </div>
      )}
      {reward.concepts?.length > 0 && (
        <div className="victory-codex">
          <div className="victory-codex-title">📖 Added to your Codex</div>
          <ul>
            {reward.concepts.map((c) => (
              <li key={c.id}>
                <strong>{c.title}</strong> — {c.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="victory-actions">
        <Button onClick={onMap}>🗺️ World map</Button>
        {onFinale && (
          <Button variant="gold" onClick={onFinale}>
            🏆 The end...?
          </Button>
        )}
        {hasNext && !onFinale && (
          <Button variant="primary" onClick={onNext}>
            Next quest ▸
          </Button>
        )}
      </div>
    </Modal>
  );
}
