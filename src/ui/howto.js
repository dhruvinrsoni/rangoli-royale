function md(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  const lines = html.split('\n');
  const out = [];
  let inList = false;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      const joined = para.join(' ').trim();
      if (joined) out.push(`<p>${joined}</p>`);
      para = [];
    }
  };
  for (const line of lines) {
    if (/^<h[1-3]>/.test(line)) { flushPara(); if (inList) { out.push('</ul>'); inList = false; } out.push(line); continue; }
    const itemMatch = line.match(/^- (.+)$/);
    if (itemMatch) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${itemMatch[1]}</li>`);
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }
    para.push(line);
  }
  flushPara();
  if (inList) out.push('</ul>');
  return out.join('\n');
}

export async function mount(target) {
  target.innerHTML = `
    <header class="brand">
      <h1>How to Play</h1>
    </header>
    <article class="howto-body"><p class="loading">Loading rules…</p></article>
    <a href="#home" class="settings-back">← Home</a>
  `;
  try {
    const res = await fetch('docs/rules.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const body = text.replace(/^# Rangoli Royale — Rules\s*/m, '');
    target.querySelector('.howto-body').innerHTML = md(body);
  } catch (err) {
    target.querySelector('.howto-body').innerHTML = `<p>Could not load rules. <a href="https://github.com/dhruvinrsoni/rangoli-royale/blob/main/docs/rules.md" target="_blank" rel="noopener">Read on GitHub</a>.</p>`;
  }
}
