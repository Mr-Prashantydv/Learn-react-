import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/store.jsx';
import { chapters, allLevels } from '../content/index.js';
import { chapterStatus, levelStatus, nextLevelId, rankFor, totalStars } from '../game/progression.js';
import { Button, Modal, Stars, XpBar, Tag } from '../components/ui.jsx';
import { Dialog } from '../components/Companion.jsx';
import { play } from '../game/sound.js';

const TYPE_ICON = { code: '⚔️', quiz: '📜', bug: '🐛', build: '🏗️' };
const NODE_GAP = 112;

export function WorldMap({ go, focusLevelId }) {
  const { state, dispatch } = useGame();
  const [selected, setSelected] = useState(null);
  const nextId = useMemo(() => nextLevelId(state, allLevels), [state]);
  const rank = rankFor(state.xp);
  const stars = totalStars(state);
  const nodeRefs = useRef({});

  const chapterToIntro = useMemo(() => {
    const nextLevel = allLevels.find((l) => l.id === nextId);
    if (!nextLevel) return null;
    const chapter = chapters[nextLevel.chapterIndex];
    if (nextLevel.levelIndex === 0 && !state.chapterIntrosSeen.includes(chapter.id)) return chapter;
    return null;
  }, [nextId, state.chapterIntrosSeen]);

  useEffect(() => {
    const target = focusLevelId || nextId;
    const el = nodeRefs.current[target];
    if (el) {
      const t = setTimeout(() => el.scrollIntoView({ block: 'center', behavior: state.settings.motion ? 'smooth' : 'auto' }), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [focusLevelId, nextId, state.settings.motion]);

  const completedCount = Object.keys(state.completed).length;

  return (
    <div className="map-screen">
      <header className="hud">
        <div className="hud-player">
          <span className="hud-avatar">{state.player.avatar}</span>
          <div>
            <div className="hud-name">{state.player.name}</div>
            <XpBar rank={rank} xp={state.xp} />
          </div>
        </div>
        <div className="hud-stats">
          <span title="Stars earned">⭐ {stars}</span>
          <span title="Quests completed">
            ✅ {completedCount}/{allLevels.length}
          </span>
          <span title="Day streak">🔥 {state.streak.days}</span>
          <span title="Badges">
            🏅 {state.badges.length}/{chapters.length}
          </span>
        </div>
        <nav className="hud-nav">
          <Button size="small" onClick={() => go('codex')}>
            📖 Codex
          </Button>
          <Button size="small" onClick={() => go('playground')}>
            🧪 Playground
          </Button>
          {state.finishedAt && (
            <Button size="small" variant="gold" onClick={() => go('certificate')}>
              🏆 Certificate
            </Button>
          )}
          <Button size="small" onClick={() => go('settings')}>
            ⚙️
          </Button>
        </nav>
      </header>

      <main className="map-scroll">
        <div className="map-column">
          {chapters.map((chapter, ci) => {
            const status = chapterStatus(state, allLevels, chapter);
            const height = chapter.levels.length * NODE_GAP + 90;
            const points = chapter.levels.map((level, i) => ({
              x: 50 + Math.sin(i * 1.1 + ci) * 30,
              y: 80 + i * NODE_GAP,
            }));
            const path = points
              .map((p, i) => {
                if (i === 0) return `M ${p.x} ${p.y}`;
                const prev = points[i - 1];
                const cy = (prev.y + p.y) / 2;
                return `C ${prev.x} ${cy}, ${p.x} ${cy}, ${p.x} ${p.y}`;
              })
              .join(' ');
            const done = chapter.levels.filter((l) => state.completed[l.id]).length;
            return (
              <section
                key={chapter.id}
                className={`region region-${status}`}
                style={{ '--region-a': chapter.colors[0], '--region-b': chapter.colors[1] }}
              >
                <div className="region-scenery" aria-hidden="true">
                  {chapter.scenery.map((s, i) => (
                    <span key={i} style={{ left: `${(i * 37 + 7) % 92}%`, top: `${(i * 53 + 11) % 85}%`, animationDelay: `${i * 0.7}s` }}>
                      {s}
                    </span>
                  ))}
                </div>
                <header className="region-header">
                  <div className="region-index">Region {ci + 1}</div>
                  <h2>
                    {chapter.icon} {chapter.title}
                  </h2>
                  <p>{chapter.subtitle}</p>
                  <div className="region-progress">
                    <div className="region-progress-fill" style={{ width: `${(done / chapter.levels.length) * 100}%` }} />
                  </div>
                  <span className="region-count">
                    {status === 'locked'
                      ? '🔒 Locked — finish the previous region'
                      : status === 'completed'
                        ? '✨ Restored! The world re-renders here again.'
                        : `${done}/${chapter.levels.length} quests`}
                  </span>
                </header>
                <div className="region-nodes" style={{ height }}>
                  <svg className="region-path" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
                    <path d={path} className="region-path-line" />
                  </svg>
                  {chapter.levels.map((level, i) => {
                    const st = levelStatus(state, allLevels, level.id);
                    const isNext = level.id === nextId;
                    const p = points[i];
                    return (
                      <div
                        key={level.id}
                        className={`node-wrap ${st} ${isNext ? 'next' : ''} ${level.boss ? 'boss' : ''}`}
                        style={{ left: `${p.x}%`, top: p.y }}
                        ref={(el) => (nodeRefs.current[level.id] = el)}
                      >
                        {isNext && <div className="node-player">{state.player.avatar}</div>}
                        <button
                          className="node"
                          disabled={st === 'locked'}
                          onClick={() => {
                            play('pop');
                            setSelected(level);
                          }}
                          aria-label={`${level.title} (${st})`}
                        >
                          <span className="node-icon">{st === 'locked' ? '🔒' : level.boss ? '👑' : TYPE_ICON[level.type] || '⚔️'}</span>
                        </button>
                        <div className="node-label">
                          <span>{level.title}</span>
                          {st === 'completed' && <Stars count={state.completed[level.id].stars} size="sm" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <section className="region region-end">
            <h2>🌅 The Edge of the World</h2>
            <p>{state.finishedAt ? 'You restored Reactoria. Thank you, Render Mage.' : 'Beyond here lies mastery. Keep going!'}</p>
          </section>
        </div>
      </main>

      {chapterToIntro && !selected && (
        <div className="map-dialog">
          <Dialog
            lines={chapterToIntro.intro}
            onDone={() => dispatch({ type: 'MARK_CHAPTER_INTRO', chapterId: chapterToIntro.id })}
          />
        </div>
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <LevelCard
            level={selected}
            status={levelStatus(state, allLevels, selected.id)}
            completed={state.completed[selected.id]}
            onStart={() => go('level', { levelId: selected.id })}
            onClose={() => setSelected(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function LevelCard({ level, status, completed, onStart, onClose }) {
  const chapter = chapters[level.chapterIndex];
  return (
    <div className="level-card">
      <div className="level-card-head">
        <span className="level-card-icon">{level.boss ? '👑' : TYPE_ICON[level.type]}</span>
        <div>
          <div className="muted">
            {chapter.title} · Quest {level.levelIndex + 1}
          </div>
          <h3>{level.title}</h3>
        </div>
      </div>
      <div className="level-card-tags">
        {level.boss && <Tag color="#b5179e">BOSS</Tag>}
        <Tag>{level.type === 'quiz' ? 'Trial (quiz)' : level.type === 'bug' ? 'Bug hunt' : level.type === 'build' ? 'Build' : 'Code quest'}</Tag>
        <Tag>+{level.xp} XP</Tag>
        {completed && <Stars count={completed.stars} />}
      </div>
      <p>{level.blurb}</p>
      <div className="level-card-actions">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onStart} disabled={status === 'locked'}>
          {completed ? 'Replay quest' : level.boss ? 'Face the boss' : 'Start quest'} ▸
        </Button>
      </div>
    </div>
  );
}
