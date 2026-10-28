import React, { useEffect, useRef, useState } from 'react';
import { play } from '../game/sound.js';
import { useGame } from '../game/store.jsx';

/** Pip, the pixel sprite — your guide through Reactoria. */
export function PipSprite({ size = 56, mood = 'happy' }) {
  return (
    <div className={`pip pip-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
      <div className="pip-glow" />
      <div className="pip-body">
        <div className="pip-eye pip-eye-l" />
        <div className="pip-eye pip-eye-r" />
        <div className="pip-mouth" />
      </div>
      <div className="pip-spark pip-spark-1">✦</div>
      <div className="pip-spark pip-spark-2">✧</div>
    </div>
  );
}

function useTypewriter(text, enabled, speed = 14) {
  const [count, setCount] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return undefined;
    }
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setCount(Math.min(i, text.length));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, enabled, speed]);
  return [text.slice(0, count), () => setCount(text.length)];
}

/**
 * A dialog sequence: `lines` is an array of strings (or `{ text, mood }`).
 * Shows one line at a time with a typewriter effect. Clicking while a line
 * is still typing reveals it; Enter / Space advance.
 */
export function Dialog({ lines, onDone, speaker = 'Pip', compact = false }) {
  const { state } = useGame();
  const [index, setIndex] = useState(0);
  const items = (lines || []).map((l) => (typeof l === 'string' ? { text: l, mood: 'happy' } : l));
  const current = items[index] || { text: '', mood: 'happy' };
  const [shown, reveal] = useTypewriter(current.text, state.settings.motion);
  const finished = shown.length >= current.text.length;

  const advance = () => {
    if (!finished) {
      reveal();
      return;
    }
    play('click');
    if (index + 1 < items.length) setIndex(index + 1);
    else onDone?.();
  };

  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advanceRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!items.length) return null;

  return (
    <div className={`dialog ${compact ? 'dialog-compact' : ''}`} role="dialog" aria-live="polite">
      <div className="dialog-portrait">
        <PipSprite size={compact ? 44 : 64} mood={current.mood} />
        <div className="dialog-speaker">{speaker}</div>
      </div>
      <div className="dialog-bubble" onClick={() => !finished && reveal()}>
        <p>
          {shown}
          {!finished && <span className="dialog-caret">▌</span>}
        </p>
        <div className="dialog-actions">
          <span className="dialog-progress">
            {index + 1} / {items.length}
          </span>
          {items.length > 1 && index + 1 < items.length && (
            <button className="btn btn-ghost btn-small" onClick={() => onDone?.()}>
              Skip
            </button>
          )}
          <button
            className={`btn btn-small ${index + 1 < items.length ? '' : 'btn-primary'}`}
            onClick={(e) => {
              e.stopPropagation();
              advance();
            }}
          >
            {index + 1 < items.length ? 'Next ▸' : items.length > 1 ? "Let's go!" : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
