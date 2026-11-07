import { useEffect, useState } from 'react';
import { CreditsPage } from '../features/credits/CreditsPage';
import { EndgameScreen } from '../features/endgames/EndgameScreen';
import { HomePage } from '../features/home/HomePage';
import { OpeningScreen } from '../features/openings/OpeningScreen';
import { PlayScreen, type PlayStart } from '../features/play/PlayScreen';
import { MistakesScreen } from '../features/progress/MistakesScreen';
import { PuzzleScreen } from '../features/puzzles/PuzzleScreen';
import { SessionScreen } from '../features/session/SessionScreen';
import { UpdatePrompt } from './UpdatePrompt';
import { watchSystemTheme } from './theme';

type View = 'home' | 'session' | 'puzzle' | 'mistakes' | 'endgame' | 'opening' | 'play' | 'credits';

/** Where the play screen returns when it was opened from a puzzle instead of the home screen. */
type PlayReturn = 'home' | 'puzzle' | 'session' | 'mistakes';

export function App() {
  const [view, setView] = useState<View>('home');
  const [mistakesBack, setMistakesBack] = useState<'home' | 'puzzle'>('home');
  const [playStart, setPlayStart] = useState<PlayStart | null>(null);
  const [playReturn, setPlayReturn] = useState<PlayReturn>('home');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => watchSystemTheme(), []);

  const openPlay = (start: PlayStart | null, back: PlayReturn) => {
    setPlayStart(start);
    setPlayReturn(back);
    setView('play');
  };

  const exitPlay = () => {
    const back = playReturn;
    setPlayStart(null);
    setView(back);
  };

  return (
    <>
      {view === 'session' ? (
        <SessionScreen
          onExit={() => setView('home')}
          onPlayPosition={(position) => openPlay(position, 'session')}
        />
      ) : view === 'puzzle' ? (
        <PuzzleScreen
          onExit={() => setView('home')}
          onReviewMistakes={() => {
            setMistakesBack('puzzle');
            setView('mistakes');
          }}
          onPlayPosition={(position) => openPlay(position, 'puzzle')}
        />
      ) : view === 'mistakes' ? (
        <MistakesScreen
          onExit={() => setView(mistakesBack)}
          onPlayPosition={(position) => openPlay(position, 'mistakes')}
        />
      ) : view === 'endgame' ? (
        <EndgameScreen onExit={() => setView('home')} />
      ) : view === 'opening' ? (
        <OpeningScreen onExit={() => setView('home')} />
      ) : view === 'play' ? (
        <PlayScreen start={playStart} onExit={exitPlay} />
      ) : view === 'credits' ? (
        <CreditsPage onExit={() => setView('home')} />
      ) : (
        <HomePage
          onStartSession={() => setView('session')}
          onStartPuzzle={() => setView('puzzle')}
          onStartEndgame={() => setView('endgame')}
          onStartOpening={() => setView('opening')}
          onStartPlay={() => openPlay(null, 'home')}
          onShowMistakes={() => {
            setMistakesBack('home');
            setView('mistakes');
          }}
          onShowCredits={() => setView('credits')}
        />
      )}
      <UpdatePrompt />
    </>
  );
}
