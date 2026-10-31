import { useEffect, useState } from 'react';
import { HomePage } from '../features/home/HomePage';
import { PuzzleScreen } from '../features/puzzles/PuzzleScreen';

type View = 'home' | 'puzzle';

export function App() {
  const [view, setView] = useState<View>('home');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return view === 'puzzle' ? (
    <PuzzleScreen onExit={() => setView('home')} />
  ) : (
    <HomePage onStartPuzzle={() => setView('puzzle')} />
  );
}
