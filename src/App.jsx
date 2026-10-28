import React, { useCallback, useEffect, useState } from 'react';
import { GameProvider, useGame } from './game/store.jsx';
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
      <Shell />
    </GameProvider>
  );
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
