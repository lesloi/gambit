import { useEffect, useState } from 'react';
import { CreditsPage } from '../features/credits/CreditsPage';
import { EndgameScreen } from '../features/endgames/EndgameScreen';
import { HomePage } from '../features/home/HomePage';
import { OpeningScreen } from '../features/openings/OpeningScreen';
import { MistakesScreen } from '../features/progress/MistakesScreen';
import { PuzzleScreen } from '../features/puzzles/PuzzleScreen';
import { UpdatePrompt } from './UpdatePrompt';

type View = 'home' | 'puzzle' | 'mistakes' | 'endgame' | 'opening' | 'credits';

export function App() {
  const [view, setView] = useState<View>('home');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <>
      {view === 'puzzle' ? (
        <PuzzleScreen onExit={() => setView('home')} onReviewMistakes={() => setView('mistakes')} />
      ) : view === 'mistakes' ? (
        <MistakesScreen onExit={() => setView('puzzle')} />
      ) : view === 'endgame' ? (
        <EndgameScreen onExit={() => setView('home')} />
      ) : view === 'opening' ? (
        <OpeningScreen onExit={() => setView('home')} />
      ) : view === 'credits' ? (
        <CreditsPage onExit={() => setView('home')} />
      ) : (
        <HomePage
          onStartPuzzle={() => setView('puzzle')}
          onStartEndgame={() => setView('endgame')}
          onStartOpening={() => setView('opening')}
          onShowCredits={() => setView('credits')}
        />
      )}
      <UpdatePrompt />
    </>
  );
}
