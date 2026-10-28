import React, { useMemo, useState } from 'react';
import { useGame } from '../game/store.jsx';
import { chapters, allLevels } from '../content/index.js';
import { Button, BadgeChip } from '../components/ui.jsx';
import { CodeBlock } from '../components/CodeBlock.jsx';

export function Codex({ go }) {
  const { state } = useGame();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  const entries = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const level of allLevels) {
      for (const c of level.concepts || []) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        list.push({ ...c, chapterId: level.chapterId, chapterIndex: level.chapterIndex, levelTitle: level.title, levelId: level.id });
      }
    }
    return list;
  }, []);

  const unlocked = entries.filter((e) => state.codex.includes(e.id));
  const shown = (filter === 'all' ? entries : entries.filter((e) => e.chapterId === filter));

  return (
    <div className="codex-screen">
      <header className="level-header">
        <Button size="small" variant="ghost" onClick={() => go('map')}>
          ◂ Map
        </Button>
        <div className="level-title">
          <span className="muted">Your grimoire of React knowledge</span>
          <h1>📖 The Codex</h1>
        </div>
        <div className="level-meta muted">
          {unlocked.length} / {entries.length} entries
        </div>
      </header>

      <main className="codex-body">
        <section className="codex-badges">
          <h3>Badges</h3>
          <div className="badge-row">
            {chapters.map((ch) => {
              const boss = ch.levels.find((l) => l.badge);
              if (!boss) return null;
              return <BadgeChip key={boss.badge.id} badge={boss.badge} locked={!state.badges.includes(boss.badge.id)} />;
            })}
          </div>
        </section>

        <nav className="codex-filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          {chapters.map((ch) => (
            <button key={ch.id} className={filter === ch.id ? 'active' : ''} onClick={() => setFilter(ch.id)}>
              {ch.icon} {ch.short}
            </button>
          ))}
        </nav>

        <div className="codex-grid">
          {shown.map((e) => {
            const isUnlocked = state.codex.includes(e.id);
            const isOpen = open === e.id;
            return (
              <article key={e.id} className={`codex-card ${isUnlocked ? '' : 'locked'} ${isOpen ? 'open' : ''}`}>
                <button className="codex-card-head" onClick={() => isUnlocked && setOpen(isOpen ? null : e.id)} disabled={!isUnlocked}>
                  <span className="codex-icon">{isUnlocked ? e.icon || '✦' : '🔒'}</span>
                  <div>
                    <div className="codex-title">{isUnlocked ? e.title : '???'}</div>
                    <div className="muted small">{isUnlocked ? e.summary : `Unlocked by: ${e.levelTitle}`}</div>
                  </div>
                </button>
                {isOpen && (
                  <div className="codex-card-body">
                    {e.snippet && <CodeBlock code={e.snippet} />}
                    {e.detail && <p>{e.detail}</p>}
                    <Button size="small" variant="ghost" onClick={() => go('level', { levelId: e.levelId })}>
                      Revisit quest ▸
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
