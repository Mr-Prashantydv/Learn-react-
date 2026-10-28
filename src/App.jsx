import React, { useCallback, useEffect, useState } from 'react';
import { clearSave, GameProvider, useGame } from './game/store.jsx';
import { setSoundEnabled } from './game/sound.js';
import { Title } from './screens/Title.jsx';
import { WorldMap } from './screens/WorldMap.jsx';
import { Level } from './screens/Level.jsx';
import { Quiz } from './screens/Quiz.jsx';
import { Codex } from './screens/Codex.jsx';
import { Settings } from './screens/Settings.jsx';
import { Certificate } from './screens/Certificate.jsx';
import { Finale } from './screens/Finale.jsx';
import { levelById, PLAYGROUND } from './content/index.js';

export default function App() {
  return (
    <GameProvider>
      <CrashGuard>
        <Shell />
      </CrashGuard>
    </GameProvider>
  );
}

/** Last line of defence: a broken save must not leave the game blank forever. */
class CrashGuard extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <div className="crash-screen" role="alert">
          <h1>Something broke in Reactoria</h1>
          <p className="muted">{String(this.state.error?.message || this.state.error)}</p>
          <p>If this keeps happening, your save may be damaged. Resetting it starts a fresh game.</p>
          <div className="crash-actions">
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!window.confirm('Delete your save and start over?')) return;
                clearSave();
                window.location.reload();
              }}
            >
              Reset save
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function Shell() {
  const { state } = useGame();
  const [screen, setScreen] = useState(() =>
    state.player.name && state.introSeen ? { name: 'map' } : { name: 'title' },
  );

  useEffect(() => {
    setSoundEnabled(state.settings.sound);
  }, [state.settings.sound]);

  useEffect(() => {
    document.body.classList.toggle('reduced-motion', !state.settings.motion);
  }, [state.settings.motion]);

  const go = useCallback((name, params = {}) => {
    setScreen({ name, ...params });
    window.scrollTo(0, 0);
  }, []);

  let content;
  switch (screen.name) {
    case 'title':
      content = <Title go={go} />;
      break;
    case 'map':
      content = <WorldMap go={go} focusLevelId={screen.focusLevelId} />;
      break;
    case 'level': {
      const level = levelById[screen.levelId];
      if (!level) content = <WorldMap go={go} />;
      else if (level.type === 'quiz') content = <Quiz key={level.id} level={level} go={go} />;
      else content = <Level key={level.id} level={level} go={go} />;
      break;
    }
    case 'playground':
      content = <Level key="playground" level={PLAYGROUND} go={go} playground />;
      break;
    case 'codex':
      content = <Codex go={go} />;
      break;
    case 'settings':
      content = <Settings go={go} />;
      break;
    case 'finale':
      content = <Finale go={go} />;
      break;
    case 'certificate':
      content = <Certificate go={go} />;
      break;
    default:
      content = <Title go={go} />;
  }

  return (
    <div className="app">
      <div className="starfield" aria-hidden="true" />
      {content}
    </div>
  );
}
