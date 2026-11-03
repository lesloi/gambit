import { fr } from '../../i18n/fr';

export type CreditId = 'pieces' | 'puzzles' | 'engine' | 'maia' | 'onnxruntime';

export interface Credit {
  id: CreditId;
  /** The name the project publishes under; a proper noun, so it is never translated. */
  name: string;
  /** The licence as the upstream states it, in SPDX form where possible. */
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  /** Where the shipped files live, relative to the repository root; the test checks it exists. */
  path: string;
  /** The attribution line the licence requires, shown under the description. */
  notice?: string;
}

/**
 * The third-party works the app shows. Libraries are left out on purpose: their licences travel
 * with their packages, and the screen names what a user recognises — the pieces, the puzzles and,
 * once the games mode lands, the engine.
 */
export const CREDITS: readonly Credit[] = [
  {
    id: 'pieces',
    name: 'Chessnut',
    licence: 'Apache-2.0',
    licenceUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    sourceUrl: 'https://github.com/LexLuengas/chessnut-pieces',
    path: 'public/pieces/chessnut',
    notice: 'Copyright 2019 Alexis Luengas.',
  },
  {
    id: 'puzzles',
    name: 'Lichess puzzle database',
    licence: 'CC0-1.0',
    licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl: 'https://database.lichess.org/#puzzles',
    path: 'content/puzzles.jsonl.gz',
  },
  {
    id: 'engine',
    name: 'Stockfish.js',
    licence: 'GPL-3.0-only',
    licenceUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
    sourceUrl: 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1',
    path: 'public/stockfish/stockfish-19-lite-single.js',
    notice: 'Version 19, build lite single-threaded, copied unmodified.',
  },
  {
    id: 'maia',
    name: 'Maia-3',
    licence: 'AGPL-3.0-only',
    licenceUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
    sourceUrl: 'https://huggingface.co/UofTCSSLab/Maia3-5M',
    path: 'public/maia/maia3-5m.onnx',
    notice:
      'Checkpoint maia3-5m.pt at revision b6559de, sha256 ba14208b2992d85502f5fb501934abf6aaaeb355e9f3fdf90e326911f562524f, exported to ONNX by scripts/export-maia.py.',
  },
  {
    id: 'onnxruntime',
    name: 'ONNX Runtime Web',
    licence: 'MIT',
    licenceUrl: 'https://github.com/microsoft/onnxruntime/blob/main/LICENSE',
    sourceUrl: 'https://github.com/microsoft/onnxruntime/tree/v1.31.1',
    path: 'public/ort/ort-wasm-simd-threaded.wasm',
    notice: 'Version 1.31.1, SIMD build, copied unmodified from the npm package.',
  },
];

/** The French description of a credit, from the interface strings. */
export function creditText(id: CreditId): string {
  return fr.credits.items[id];
}
