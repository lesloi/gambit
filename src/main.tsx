import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@lichess-org/chessground/assets/chessground.base.css';
import { App } from './app/App';
import { paint, readTheme } from './app/theme';
import './styles/index.css';
import './styles/chessground.css';

// Before the first paint, so a dark device never flashes the light theme.
paint(readTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
