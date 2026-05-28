import { getCurrentGame, clearCurrentGame, saveSetup, appendHistory, getHistory } from '../lib/storage.js';
import { determineWinner, longestLine, largestTree } from '../lib/scoring.js';

let recorded = false;

function recordHistory(state, result) {
  if (recorded) return;
  recorded = true;
  const lastInHistory = getHistory()[0];
  if (lastInHistory && lastInHistory.createdAt === state.setup.createdAt) return;
  appendHistory({
    createdAt: state.setup.createdAt,
    endedAt: Date.now(),
    teams: state.setup.teams,
    rows: state.setup.rows,
    cols: state.setup.cols,
    winMode: state.setup.winMode,
    playerCount: state.setup.playerCount,
    moves: state.moveLog.length,
    winner: result.winner,
    scores: result.scores,
    longestLineA: longestLine(state, 'A'),
    longestLineB: longestLine(state, 'B'),
    treeA: largestTree(state, 'A'),
    treeB: largestTree(state, 'B'),
  });
}

export function mount(target) {
  recorded = false;
  const state = getCurrentGame();
  if (!state) {
    target.innerHTML = `
      <header class="brand"><h1>Nothing to show</h1></header>
      <p><a href="#home">Back home</a></p>
    `;
    return;
  }
  const result = determineWinner(state);
  recordHistory(state, result);

  const a = state.setup.teams.A;
  const b = state.setup.teams.B;
  const winnerLabel = result.winner === 'tie'
    ? 'Tie game'
    : `${state.setup.teams[result.winner].name} wins`;
  const winnerColor = result.winner === 'tie'
    ? 'var(--rr-accent)'
    : state.setup.teams[result.winner].color;
  const modeLabel = state.setup.winMode === 'tree' ? 'Largest tree' : 'Longest line';

  target.innerHTML = `
    <header class="brand">
      <h1 class="endgame-headline" style="color:${winnerColor}">${winnerLabel}</h1>
      <p class="tagline">${modeLabel} · ${state.moveLog.length} moves</p>
    </header>

    <section class="endgame-card">
      <div class="endgame-team" style="--team-color:${a.color}">
        <span class="endgame-team-name">${a.name}</span>
        <span class="endgame-team-score">${result.scores.A}</span>
        <span class="endgame-team-sub">${longestLine(state, 'A')} longest · ${largestTree(state, 'A')} in tree</span>
      </div>
      <div class="endgame-team" style="--team-color:${b.color}">
        <span class="endgame-team-name">${b.name}</span>
        <span class="endgame-team-score">${result.scores.B}</span>
        <span class="endgame-team-sub">${longestLine(state, 'B')} longest · ${largestTree(state, 'B')} in tree</span>
      </div>
    </section>

    <div class="endgame-actions">
      <button type="button" id="replay" class="primary">Play again</button>
      <button type="button" id="share">Share result</button>
      <a href="#home" class="ghost-link">Home</a>
    </div>
  `;

  target.querySelector('#replay').addEventListener('click', () => {
    saveSetup({
      playerCount: state.setup.playerCount,
      teamAName: a.name,
      teamAColor: a.color,
      teamBName: b.name,
      teamBColor: b.color,
      rows: state.setup.rows,
      cols: state.setup.cols,
      winMode: state.setup.winMode,
    });
    clearCurrentGame();
    location.hash = '#setup';
  });

  target.querySelector('#share').addEventListener('click', async () => {
    const text = `Rangoli Royale — ${winnerLabel}\n${a.name}: ${result.scores.A}\n${b.name}: ${result.scores.B}\n${state.moveLog.length} moves on a ${state.setup.rows}×${state.setup.cols} board (${modeLabel}).\nhttps://dhruvinrsoni.github.io/rangoli-royale/`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rangoli Royale', text });
      } else {
        await navigator.clipboard.writeText(text);
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = 'Result copied to clipboard';
        target.appendChild(t);
        setTimeout(() => t.remove(), 1600);
      }
    } catch {}
  });
}

export function unmount() {
  recorded = false;
}
