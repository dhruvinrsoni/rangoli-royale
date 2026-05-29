import { joinRoom } from '../lib/online-session.js';

export function mount(target) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const prefillCode = (params.get('code') || '').toUpperCase();

  target.innerHTML = `
    <header class="brand">
      <h1>Join room</h1>
      <p class="tagline">Enter the code you were shared</p>
    </header>

    <form id="join-form" class="join-form" novalidate>
      <label class="join-field">
        <span>Room code</span>
        <input type="text" name="code" placeholder="e.g. K7Q2HFXN" maxlength="8"
               autocomplete="off" autocapitalize="characters" spellcheck="false"
               value="${prefillCode}" required>
      </label>
      <label class="join-field">
        <span>Your name</span>
        <input type="text" name="name" placeholder="Your nickname" maxlength="20" required>
      </label>
      <div class="setup-actions">
        <a href="#home" class="cancel">Cancel</a>
        <button type="submit" class="primary">Join</button>
      </div>
      <p class="form-error" id="form-error" hidden></p>
    </form>
  `;

  const form = target.querySelector('#join-form');
  const errEl = target.querySelector('#form-error');

  form.elements.code.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const code = form.elements.code.value.trim();
    const name = form.elements.name.value.trim() || 'Player';
    if (!code || code.length < 6) {
      errEl.textContent = 'Enter the full room code';
      errEl.hidden = false;
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining…';
    try {
      await joinRoom(code, name);
      location.hash = '#lobby';
    } catch (err) {
      errEl.textContent = err.message || 'Could not join';
      errEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join';
    }
  });
}
