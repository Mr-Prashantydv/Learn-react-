import React, { useState } from 'react';
import { useGame } from '../game/store.jsx';
import { allLevels, chapters } from '../content/index.js';
import { rankFor, xpForStars } from '../game/progression.js';
import { Button, Tag } from '../components/ui.jsx';
import { Markdown, renderInline } from '../components/Markdown.jsx';
import { Dialog } from '../components/Companion.jsx';
import { VictoryModal } from '../components/Victory.jsx';
import { play } from '../game/sound.js';

export function Quiz({ level, go }) {
  const { state, dispatch } = useGame();
  const chapter = chapters[level.chapterIndex];
  const completed = state.completed[level.id];
  const index = allLevels.findIndex((l) => l.id === level.id);
  const next = allLevels[index + 1] || null;
  const questions = level.questions;

  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState(0);
  const [combo, setCombo] = useState(0);
  const [showStory, setShowStory] = useState(Boolean(level.story?.length) && !completed);
  const [victory, setVictory] = useState(null);
  const [attemptKey, setAttemptKey] = useState(0);

  const current = questions[i];
  const answered = picked !== null;
  const correct = answered && picked === current.answer;

  const pick = (optionIndex) => {
    if (answered) return;
    setPicked(optionIndex);
    if (optionIndex === current.answer) {
      play(combo >= 2 ? 'star' : 'success');
      setCombo((c) => c + 1);
    } else {
      play('fail');
      setCombo(0);
      setWrong((w) => w + 1);
    }
  };

  const advance = () => {
    if (victory) return;
    play('click');
    if (i + 1 < questions.length) {
      setI(i + 1);
      setPicked(null);
      return;
    }
    const stars = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
    const earned = xpForStars(level.xp || 100, stars);
    const xp = Math.max(0, earned - (completed?.xp || 0));
    dispatch({ type: 'RECORD_ATTEMPT', levelId: level.id });
    dispatch({ type: 'COMPLETE_LEVEL', level, stars });
    const freshConcepts = (level.concepts || []).filter((c) => !state.codex.includes(c.id));
    const freshBadge = level.badge && !state.badges.includes(level.badge.id) ? level.badge : null;
    const before = rankFor(state.xp);
    const after = rankFor(state.xp + xp);
    setVictory({ stars, xp, badge: freshBadge, concepts: freshConcepts, rankUp: after.level > before.level ? after : null });
  };

  const retry = () => {
    play('click');
    setI(0);
    setPicked(null);
    setWrong(0);
    setCombo(0);
    setAttemptKey((k) => k + 1);
  };

  return (
    <div className="quiz-screen" key={attemptKey}>
      <header className="level-header">
        <Button size="small" variant="ghost" onClick={() => go('map', { focusLevelId: level.id })}>
          ◂ Map
        </Button>
        <div className="level-title">
          <span className="muted">
            {chapter.icon} {chapter.title}
          </span>
          <h1>
            <Tag>TRIAL</Tag> {level.title}
          </h1>
        </div>
        <div className="level-meta">
          {combo >= 2 && (
            <span className="combo" key={combo}>
              🔥 x{combo} combo
            </span>
          )}
          <span className="muted">
            {i + 1} / {questions.length} · {wrong === 0 ? 'Perfect so far ✨' : `${wrong} wrong`}
          </span>
        </div>
      </header>

      <main className="quiz-body">
        {level.task && (
          <div className="quiz-intro">
            <Markdown text={level.task} />
          </div>
        )}
        <div className="quiz-progress">
          {questions.map((_, qi) => (
            <span key={qi} className={`quiz-dot ${qi < i ? 'done' : qi === i ? 'current' : ''}`} />
          ))}
        </div>
        <div className={`quiz-card ${answered ? (correct ? 'correct' : 'wrong') : ''}`}>
          <div className="quiz-question">
            <Markdown text={current.question} />
          </div>
          <div className="quiz-options">
            {current.options.map((opt, oi) => {
              let cls = 'quiz-option';
              if (answered && oi === current.answer) cls += ' is-answer';
              else if (answered && oi === picked) cls += ' is-wrong';
              return (
                <button key={oi} className={cls} onClick={() => pick(oi)} disabled={answered}>
                  <span className="quiz-letter">{String.fromCharCode(65 + oi)}</span>
                  <span className="quiz-option-text">{renderInline(opt)}</span>
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="quiz-explain">
              <strong>{correct ? '✓ Correct!' : '✗ Not quite.'}</strong>
              <Markdown text={current.explain} />
              <div className="quiz-actions">
                {wrong > 0 && i + 1 === questions.length && (
                  <Button variant="ghost" onClick={retry}>
                    Retry for 3★
                  </Button>
                )}
                <Button variant="primary" onClick={advance}>
                  {i + 1 < questions.length ? 'Next question ▸' : 'Finish trial ✓'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {showStory && (
        <div className="level-dialog">
          <Dialog lines={level.story} onDone={() => setShowStory(false)} />
        </div>
      )}

      {victory && (
        <VictoryModal
          reward={victory}
          level={level}
          motion={state.settings.motion}
          hasNext={Boolean(next)}
          onMap={() => go('map', { focusLevelId: next ? next.id : level.id })}
          onNext={() => go('level', { levelId: next.id })}
          onFinale={level.final ? () => go('finale') : undefined}
        />
      )}
    </div>
  );
}
