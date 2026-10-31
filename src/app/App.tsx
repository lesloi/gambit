import { useEffect, useState } from 'react';
import { CreditsPage } from '../features/credits/CreditsPage';
import { EndgameScreen } from '../features/endgames/EndgameScreen';
import { HomePage } from '../features/home/HomePage';
import { PuzzleScreen } from '../features/puzzles/PuzzleScreen';
import { UpdatePrompt } from './UpdatePrompt';

type View = 'home' | 'puzzle' | 'endgame' | 'credits';

export function App() {
  const [view, setView] = useState<View>('home');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <>
      {view === 'puzzle' ? (
        <PuzzleScreen onExit={() => setView('home')} />
      ) : view === 'endgame' ? (
        <EndgameScreen onExit={() => setView('home')} />
      ) : view === 'credits' ? (
        <CreditsPage onExit={() => setView('home')} />
      ) : (
        <HomePage
          onStartPuzzle={() => setView('puzzle')}
          onStartEndgame={() => setView('endgame')}
          onShowCredits={() => setView('credits')}
        />
      )}
      <UpdatePrompt />
    </>
  );
}
