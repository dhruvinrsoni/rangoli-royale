export function mount(target) {
  target.innerHTML = `
    <header class="brand">
      <h1>How to Play</h1>
    </header>
    <p class="loading">Loading rules…</p>
    <a href="#home" class="settings-back">← Home</a>
  `;
}
