import { getHistory } from '../lib/storage.js';

function formatDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function tallyWinners(history) {
  const counts = new Map();
  for (const game of history) {
    const key = game.winner === 'tie' ? 'Tie' : (game.teams?.[game.winner]?.name || `Team ${game.winner}`);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function mount(target) {
  const history = getHistory();

  if (history.length === 0) {
    target.innerHTML = `
      <header class="brand">
        <h1>Stats</h1>
        <p class="tagline">No games played yet</p>
      </header>
      <p class="empty"><a href="#setup">Start your first game →</a></p>
      <a href="#home" class="settings-back">← Home</a>
    `;
    return;
  }

  const tally = tallyWinners(history);
  const longest = history.reduce((m, g) => Math.max(m, g.longestLineA || 0, g.longestLineB || 0), 0);
  const biggestTree = history.reduce((m, g) => Math.max(m, g.treeA || 0, g.treeB || 0), 0);
  const totalMoves = history.reduce((s, g) => s + (g.moves || 0), 0);

  target.innerHTML = `
    <header class="brand">
      <h1>Stats</h1>
      <p class="tagline">${history.length} games · ${totalMoves} moves total</p>
    </header>

    <section class="stats-summary">
      <div class="stat-card">
        <span class="stat-label">Longest line ever</span>
        <span class="stat-value">${longest}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Biggest tree</span>
        <span class="stat-value">${biggestTree}</span>
      </div>
    </section>

    <section class="stats-section">
      <h2>Win counts</h2>
      <ul class="tally">
        ${tally.map(([name, n]) => `
          <li><span>${name}</span><span class="tally-count">${n}</span></li>
        `).join('')}
      </ul>
    </section>

    <section class="stats-section">
      <h2>Recent games</h2>
      <ul class="history">
        ${history.slice(0, 50).map(g => {
          const a = g.teams?.A?.name || 'Team A';
          const b = g.teams?.B?.name || 'Team B';
          const winnerName = g.winner === 'tie' ? 'Tie' : (g.teams?.[g.winner]?.name || g.winner);
          return `
            <li class="history-row">
              <div class="history-main">
                <span class="history-winner">${winnerName}</span>
                <span class="history-meta">${a} ${g.scores.A} · ${b} ${g.scores.B} · ${g.rows}×${g.cols} · ${g.winMode === 'tree' ? 'tree' : 'line'}</span>
              </div>
              <span class="history-date">${formatDate(g.endedAt)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </section>

    <a href="#home" class="settings-back">← Home</a>
  `;
}
