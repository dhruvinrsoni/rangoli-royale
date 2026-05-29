import { getCurrentGame, clearCurrentGame, saveSetup, appendHistory, getHistory } from '../lib/storage.js';
import { determineWinner, longestLine, largestTree, dotsCovered } from '../lib/scoring.js';
import { deriveGrid } from '../lib/turn-engine.js';
import { buildFinalGridSvg, buildResultCardPng } from './result-card.js';
import { isActive as onlineActive, getSession, leaveRoom as leaveOnlineRoom } from '../lib/online-session.js';

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
    shape: state.setup.shape || 'rectangle',
    winMode: state.setup.winMode,
    playerCount: state.setup.playerCount,
    moves: state.moveLog.length,
    winner: result.winner,
    scores: result.scores,
    longestLineA: longestLine(state, 'A'),
    longestLineB: longestLine(state, 'B'),
    treeA: largestTree(state, 'A'),
    treeB: largestTree(state, 'B'),
    dotsA: dotsCovered(state, 'A'),
    dotsB: dotsCovered(state, 'B'),
  });
}

export function mount(target) {
  recorded = false;
  let state = getCurrentGame();
  let endReason = null;

  if (onlineActive()) {
    const session = getSession();
    if (session?.state) {
      state = {
        setup: session.state.setup,
        moveLog: session.state.moveLog,
        status: session.state.status,
      };
      endReason = session.state.endReason || null;
    }
  }

  if (!state) {
    target.innerHTML = `
      <header class="brand"><h1>Nothing to show</h1></header>
      <p><a href="#home">Back home</a></p>
    `;
    return;
  }
  const result = determineWinner(state);
  recordHistory(state, result);
  const grid = deriveGrid(state);

  const a = state.setup.teams.A;
  const b = state.setup.teams.B;
  const winnerLabel = result.winner === 'tie'
    ? 'Tie game'
    : `${state.setup.teams[result.winner].name} wins`;
  const winnerColor = result.winner === 'tie'
    ? 'var(--rr-accent)'
    : state.setup.teams[result.winner].color;
  const modeLabel = state.setup.winMode === 'tree' ? 'Largest tree' : 'Longest line';
  const isOnline = onlineActive();

  target.innerHTML = `
    <header class="brand">
      <h1 class="endgame-headline" style="color:${winnerColor}">${winnerLabel}</h1>
      <p class="tagline">${modeLabel} · ${state.moveLog.length} moves</p>
      ${endReason ? `<p class="end-reason">${endReason}</p>` : ''}
    </header>

    <section class="endgame-board" aria-label="Final board">
      ${buildFinalGridSvg(state, grid)}
    </section>

    <section class="endgame-card">
      <div class="endgame-team" style="--team-color:${a.color}">
        <span class="endgame-team-name">${a.name}</span>
        <span class="endgame-team-score">${result.scores.A}</span>
        <span class="endgame-team-sub">${dotsCovered(state, 'A')} dots · ${longestLine(state, 'A')} longest · ${largestTree(state, 'A')} in tree</span>
      </div>
      <div class="endgame-team" style="--team-color:${b.color}">
        <span class="endgame-team-name">${b.name}</span>
        <span class="endgame-team-score">${result.scores.B}</span>
        <span class="endgame-team-sub">${dotsCovered(state, 'B')} dots · ${longestLine(state, 'B')} longest · ${largestTree(state, 'B')} in tree</span>
      </div>
    </section>

    <div class="endgame-actions">
      ${!isOnline ? `<button type="button" id="replay" class="primary">Play again</button>` : ''}
      <button type="button" id="save-image" class="${isOnline ? 'primary' : ''}">Save image</button>
      <button type="button" id="share">Share text</button>
      ${isOnline ? `<button type="button" id="leave-online" class="ghost">Leave room</button>` : ''}
      <a href="#home" class="ghost-link">Home</a>
    </div>
  `;

  target.querySelector('#leave-online')?.addEventListener('click', async () => {
    await leaveOnlineRoom();
    clearCurrentGame();
    location.hash = '#home';
  });

  target.querySelector('#replay')?.addEventListener('click', () => {
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

  target.querySelector('#save-image').addEventListener('click', async () => {
    const btn = target.querySelector('#save-image');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const png = await buildResultCardPng(state, grid, result);
      const filename = `rangoli-royale-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([png], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Rangoli Royale',
          text: `${winnerLabel} · ${a.name} ${result.scores.A} vs ${b.name} ${result.scores.B}`,
        });
      } else {
        const url = URL.createObjectURL(png);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      console.error('save image failed', err);
      alert(`Could not save image: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
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
