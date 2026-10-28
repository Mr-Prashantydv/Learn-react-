import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/store.jsx';
import { allLevels, chapters } from '../content/index.js';
import { rankFor } from '../game/progression.js';
import { createSandbox, evaluateSource, mountPreview, runQuestTests } from '../engine/runner.js';
import { Editor } from '../components/Editor.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { CodeBlock } from '../components/CodeBlock.jsx';
import { Button, Stars, Tag } from '../components/ui.jsx';
import { Dialog } from '../components/Companion.jsx';
import { VictoryModal } from '../components/Victory.jsx';
import { play } from '../game/sound.js';
import { PREVIEW_BASE_CSS } from '../engine/previewStyles.js';
import { guardNavigation } from '../engine/navigationGuard.js';

const originalTitle = typeof document !== 'undefined' ? document.title : 'Reactoria';

function formatArg(a) {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.message;
  try {
    return JSON.stringify(a, null, 0);
  } catch {
    return String(a);
  }
}

function formatLog(args) {
  if (typeof args[0] === 'string' && args[0].includes('%s')) {
    let i = 1;
    const head = args[0].replace(/%[sdifoO]/g, () => formatArg(args[i++]));
    return [head, ...args.slice(i).filter((a) => typeof a !== 'string' || !a.trim().startsWith('\n    at'))]
      .map(formatArg)
      .join(' ');
  }
  return args.map(formatArg).join(' ');
}

export function Level({ level, go, playground = false }) {
  const { state, dispatch } = useGame();
  const chapter = chapters[level.chapterIndex] || null;
  const ls = state.levelState[level.id] || { attempts: 0, hintsUsed: 0, solutionShown: false };
  const completed = state.completed[level.id];
  const index = allLevels.findIndex((l) => l.id === level.id);
  const next = index >= 0 ? allLevels[index + 1] : null;

  const [source, setSource] = useState(() => state.drafts[level.id] ?? level.starter);
  const [tab, setTab] = useState('quest');
  const [results, setResults] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showStory, setShowStory] = useState(Boolean(level.story?.length) && !completed && !playground);
  const [victory, setVictory] = useState(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(true);

  const [bossHit, setBossHit] = useState(0);
  const bestPassRef = useRef(0);
  const previewRef = useRef(null);
  const handleRef = useRef(null);
  const sandboxRef = useRef(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const lastRewardRef = useRef(state.lastReward);
  lastRewardRef.current = state.lastReward;
  // Set while a COMPLETE_LEVEL we dispatched is waiting for the reducer's reward.
  const awaitingRewardRef = useRef(null);

  useEffect(() => {
    if (level.boss && !completed) play('boss');
  }, [level.boss, completed]);

  // Persist drafts (debounced).
  useEffect(() => {
    const id = setTimeout(() => {
      if (!playground) dispatch({ type: 'SAVE_DRAFT', levelId: level.id, source });
    }, 500);
    return () => clearTimeout(id);
  }, [source, level.id, dispatch, playground]);

  // Flush the latest draft when leaving the level or the page, so edits made
  // in the last moments before navigating away are not lost.
  useEffect(() => {
    if (playground) return undefined;
    const flush = () => dispatch({ type: 'SAVE_DRAFT', levelId: level.id, source: sourceRef.current });
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [level.id, dispatch, playground]);

  // Live preview (debounced). Also forwards React's dev warnings to the console panel.
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const forward = (kind) => (...args) => {
      const text = formatLog(args);
      setLogs((prev) => [...prev.slice(-199), { kind, text, react: true, time: Date.now() }]);
    };
    console.error = (...args) => {
      forward('error')(...args);
    };
    console.warn = (...args) => {
      forward('warn')(...args);
    };
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      teardownPreview();
      setLogs([]);
      setPreviewError(null);
      const sandbox = createSandbox({
        level,
        mode: 'preview',
        onLog: (entry) => setLogs((prev) => [...prev.slice(-199), { kind: entry.kind, text: formatLog(entry.args), time: entry.time }]),
      });
      sandboxRef.current = sandbox;
      const evaluated = evaluateSource(source, sandbox);
      if (evaluated.error) {
        setPreviewError(evaluated.error);
        return;
      }
      if (!evaluated.App) {
        setPreviewError({
          kind: 'runtime',
          message: 'No component exported.',
          hint: 'Finish your file with `export default function App() { ... }` so Reactoria knows what to render.',
        });
        return;
      }
      if (previewRef.current) {
        // The preview lives in a Shadow DOM so the player's CSS (and the
        // level's) can't leak into the game, and the game's can't leak in.
        const host = previewRef.current;
        let shadow = host.shadowRoot;
        if (!shadow) {
          shadow = host.attachShadow({ mode: 'open' });
          // A real page would reload on an un-prevented form submit (or follow
          // a link away). Keep the game alive, but tell the player.
          guardNavigation(shadow, {
            mode: 'block',
            onBlocked: (info) =>
              setLogs((prev) => [
                ...prev.slice(-199),
                {
                  kind: 'warn',
                  time: Date.now(),
                  text:
                    info.kind === 'form'
                      ? '⚠ A <form> was submitted without e.preventDefault(). In a real app the browser would reload the page and all your state would be lost. (Reactoria caught it this time!)'
                      : `⚠ A link to "${info.href}" tried to navigate away. The preview blocked it.`,
                },
              ]),
          });
        }
        shadow.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = PREVIEW_BASE_CSS + (level.css || '');
        shadow.appendChild(style);
        const mount = document.createElement('div');
        mount.className = 'preview-root';
        shadow.appendChild(mount);
        handleRef.current = mountPreview({
          container: mount,
          App: evaluated.App,
          props: level.previewProps || {},
          resetKey: previewNonce,
          onError: (err) => setPreviewError(err),
        });
      }
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, level, previewNonce]);

  useEffect(() => () => teardownPreview(), []);

  // Errors thrown in event handlers or async code never reach an error
  // boundary — surface them in the in-game console instead.
  useEffect(() => {
    const onError = (event) => {
      const message = event.error?.message || event.message || 'Unknown error';
      setLogs((prev) => [...prev.slice(-199), { kind: 'error', text: `Uncaught: ${message}`, time: Date.now() }]);
    };
    const onRejection = (event) => {
      const message = event.reason?.message || String(event.reason);
      setLogs((prev) => [...prev.slice(-199), { kind: 'error', text: `Unhandled promise rejection: ${message}`, time: Date.now() }]);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  function teardownPreview() {
    if (handleRef.current) {
      handleRef.current.unmount();
      handleRef.current = null;
    }
    if (sandboxRef.current) {
      sandboxRef.current.timers.reset();
      sandboxRef.current = null;
    }
    if (document.title !== originalTitle) document.title = originalTitle;
  }

  const check = useCallback(async () => {
    if (checking || playground) return;
    setChecking(true);
    setCheckError(null);
    play('click');
    dispatch({ type: 'RECORD_ATTEMPT', levelId: level.id });
    const outcome = await runQuestTests(level, source, { onProgress: (r) => setResults(r) });
    setResults(outcome.results);
    setCheckError(outcome.error);
    setChecking(false);
    const allPass = !outcome.error && outcome.results.length > 0 && outcome.results.every((r) => r.pass);
    if (allPass) {
      // The reward shown is the one the reducer saves (see the effect below),
      // so a hint revealed mid-check cannot make the modal disagree with it.
      awaitingRewardRef.current = { prev: lastRewardRef.current };
      dispatch({ type: 'COMPLETE_LEVEL', level });
    } else {
      const passedNow = outcome.results.filter((r) => r.pass).length;
      if (level.boss && passedNow > bestPassRef.current) {
        play('hit');
        setBossHit((n) => n + 1);
      } else play('fail');
      bestPassRef.current = Math.max(bestPassRef.current, passedNow);
      setTab('quest');
    }
  }, [checking, playground, dispatch, level, source]);

  useEffect(() => {
    const reward = state.lastReward;
    const waiting = awaitingRewardRef.current;
    if (!waiting || !reward || reward === waiting.prev || reward.levelId !== level.id) return;
    awaitingRewardRef.current = null;
    const before = rankFor(reward.xpBefore);
    const after = rankFor(reward.xpAfter);
    setVictory({
      stars: reward.stars,
      xp: reward.xp,
      badge: reward.badge,
      concepts: reward.concepts,
      solutionShown: reward.solutionShown,
      rankUp: after.level > before.level ? after : null,
    });
  }, [state.lastReward, level.id]);

  useEffect(() => {
    const onKey = (e) => {
      // The editor handles its own Ctrl/⌘ + Enter (and prevents the default).
      if (e.defaultPrevented || victory || showStory) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        check();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [check, victory, showStory]);

  const resetCode = () => {
    if (window.confirm('Reset the editor to the starting code?')) {
      play('click');
      setSource(level.starter);
      setResults(null);
      dispatch({ type: 'RESET_DRAFT', levelId: level.id });
    }
  };

  const revealHint = (i) => {
    play('pop');
    dispatch({ type: 'USE_HINT', levelId: level.id, index: i });
  };

  const revealSolution = () => {
    if (window.confirm('Reveal the solution? You can still complete the quest, but for 1 star.')) {
      play('click');
      dispatch({ type: 'SHOW_SOLUTION', levelId: level.id });
    }
  };

  const objectives = useMemo(() => {
    const names = (level.tests || []).map((t) => t.name);
    return names.map((name, i) => ({ name, result: results?.[i] }));
  }, [level.tests, results]);

  const passCount = results ? results.filter((r) => r.pass).length : 0;
  const rank = rankFor(state.xp);

  return (
    <div className={`level-screen ${level.boss ? 'level-boss' : ''}`}>
      <header className="level-header">
        <Button size="small" variant="ghost" onClick={() => go('map', { focusLevelId: level.id })}>
          ◂ Map
        </Button>
        <div className="level-title">
          <span className="muted">{chapter ? `${chapter.icon} ${chapter.title}` : '🧪 Free play'}</span>
          <h1>
            {level.boss && <Tag color="#b5179e">BOSS</Tag>} {level.title}
          </h1>
        </div>
        <div className="level-meta">
          {completed && <Stars count={completed.stars} />}
          <span className="level-rank">
            {rank.icon} {rank.title} · {state.xp} XP
          </span>
        </div>
      </header>

      <div className="level-body">
        <aside className="panel panel-left">
          <nav className="tabs">
            <button className={tab === 'quest' ? 'active' : ''} onClick={() => setTab('quest')}>
              🎯 Quest
            </button>
            <button className={tab === 'lesson' ? 'active' : ''} onClick={() => setTab('lesson')}>
              📖 Lesson
            </button>
            {!playground && (
              <button className={tab === 'hints' ? 'active' : ''} onClick={() => setTab('hints')}>
                💡 Hints {ls.hintsUsed > 0 && <small>({ls.hintsUsed}/{level.hints?.length || 0})</small>}
              </button>
            )}
          </nav>
          <div className="panel-scroll">
            {level.boss && !playground && (
              <BossBar
                key={bossHit}
                name={level.bossName || level.title.replace(/^Boss:\s*/i, '')}
                icon={level.bossIcon || '👾'}
                total={objectives.length}
                passed={victory ? objectives.length : passCount}
                hit={bossHit > 0}
              />
            )}
            {tab === 'quest' && (
              <div className="quest-tab">
                <Markdown text={level.task} />
                {!playground && (
                  <div className="objectives">
                    <div className="objectives-title">
                      Objectives {results && <span className="muted">({passCount}/{objectives.length})</span>}
                    </div>
                    {checkError && (
                      <div className="error-box">
                        <strong>{checkError.kind === 'syntax' ? 'Syntax error' : 'Runtime error'}:</strong> {checkError.message}
                        {checkError.line && <span className="muted"> (line {checkError.line})</span>}
                        {checkError.hint && <div className="error-hint">💡 {checkError.hint}</div>}
                      </div>
                    )}
                    <ul>
                      {objectives.map((o, i) => (
                        <li key={i} className={o.result ? (o.result.pass ? 'pass' : 'fail') : 'pending'}>
                          <span className="objective-mark">{o.result ? (o.result.pass ? '✓' : '✗') : '○'}</span>
                          <div>
                            <div>{o.name}</div>
                            {o.result && !o.result.pass && o.result.message && <div className="objective-msg">{o.result.message}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {results && !results.every((r) => r.pass) && (
                      <p className="muted small">Stuck? Re-read the lesson or peek at the Hints tab. Every failed check tells you what it expected.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {tab === 'lesson' && <Markdown text={level.lesson} />}
            {tab === 'hints' && (
              <div className="hints-tab">
                <p className="muted">Hints are free to read, but using them (or the solution) lowers your star rating for this quest.</p>
                {(level.hints || []).map((h, i) => (
                  <div key={i} className={`hint ${i < ls.hintsUsed ? 'revealed' : ''}`}>
                    <div className="hint-title">Hint {i + 1}</div>
                    {i < ls.hintsUsed ? (
                      <Markdown text={h} />
                    ) : (
                      <Button size="small" disabled={i > ls.hintsUsed} onClick={() => revealHint(i)}>
                        Reveal hint {i + 1}
                      </Button>
                    )}
                  </div>
                ))}
                <div className="hint hint-solution">
                  <div className="hint-title">Solution</div>
                  {ls.solutionShown ? (
                    <>
                      <CodeBlock code={level.solution} />
                      <Button
                        size="small"
                        onClick={() => {
                          play('click');
                          setSource(level.solution);
                        }}
                      >
                        Copy into editor
                      </Button>
                    </>
                  ) : (
                    <Button size="small" variant="ghost" disabled={ls.hintsUsed < (level.hints?.length || 0)} onClick={revealSolution}>
                      {ls.hintsUsed < (level.hints?.length || 0) ? 'Reveal all hints first' : 'Reveal solution (1★)'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="panel panel-right">
          <div className="editor-wrap">
            <div className="editor-bar">
              <span className="file-name">App.jsx</span>
              <div className="editor-actions">
                <Button size="small" variant="ghost" onClick={resetCode}>
                  ↺ Reset
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() => {
                    play('click');
                    setPreviewNonce((n) => n + 1);
                  }}
                >
                  ▶ Re-run
                </Button>
                {!playground && (
                  <Button variant="primary" size="small" onClick={check} disabled={checking} title="Ctrl/⌘ + Enter">
                    {checking ? 'Checking…' : '✓ Check quest'}
                  </Button>
                )}
              </div>
            </div>
            <div className="editor-host">
              <Editor value={source} onChange={setSource} onSubmit={playground ? undefined : () => !victory && !showStory && check()} />
            </div>
          </div>
          <div className="preview-wrap">
            <div className="preview-bar">
              <span>Live preview</span>
              <button className="link" onClick={() => setConsoleOpen((v) => !v)}>
                {consoleOpen ? 'Hide console' : `Console (${logs.length})`}
              </button>
            </div>
            <div className="preview-area">
              {previewError && (
                <div className="preview-error">
                  <strong>{previewError.kind === 'syntax' ? 'Syntax error' : 'Runtime error'}:</strong> {previewError.message}
                  {previewError.line && <span className="muted"> (line {previewError.line})</span>}
                  {previewError.hint && <div className="error-hint">💡 {previewError.hint}</div>}
                </div>
              )}
              <div className="preview" ref={previewRef} />
            </div>
            {consoleOpen && (
              <div className="console">
                {logs.length === 0 && <div className="console-empty">console.log() output and React warnings appear here.</div>}
                {logs.map((l, i) => (
                  <div key={i} className={`console-line console-${l.kind}`}>
                    <span className="console-prefix">{l.react ? '⚛' : '›'}</span>
                    {l.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

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

function BossBar({ name, icon, total, passed, hit }) {
  const hp = total ? Math.max(0, 1 - passed / total) : 1;
  return (
    <div className={`boss-bar ${hit ? 'boss-hit' : ''} ${hp === 0 ? 'boss-defeated' : ''}`}>
      <div className="boss-icon">{hp === 0 ? '💥' : icon}</div>
      <div className="boss-info">
        <div className="boss-name">
          {name}
          <span>{Math.round(hp * 100)} HP</span>
        </div>
        <div className="boss-hp">
          <div className="boss-hp-fill" style={{ width: `${hp * 100}%` }} />
        </div>
        <div className="boss-tip">Every objective you pass is a hit. Pass them all to win!</div>
      </div>
    </div>
  );
}
