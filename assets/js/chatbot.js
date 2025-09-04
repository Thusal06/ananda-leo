/* Simple chat UI + API proxy. Replace CHAT_API_URL with your serverless endpoint. */
(function(){
  const CHAT_API_URL = 
    window.CHAT_API_URL || 
    'https://your-serverless-endpoint.example.com/api/leo-chat'; // TODO: replace

  const state = { open: false, sending: false };

  function el(tag, attrs={}, children=[]) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
    });
    children.forEach(c => e.appendChild(c));
    return e;
  }

  function addMessage(role, text) {
    const row = el('div', { class: `msg-row ${role}` }, [
      el('div', { class: `msg ${role}` , html: text.replace(/\n/g,'<br>') })
    ]);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(text) {
    if (!text.trim() || state.sending) return;
    state.sending = true; input.disabled = true; sendBtn.disabled = true;
    addMessage('user', text);

    try {
      const res = await fetch(CHAT_API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          contextFiles: ['data/club-knowledge.json'],
          // Optionally include page URL for context
          page: location.pathname
        })
      });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      addMessage('bot', data.answer || 'I could not find an answer yet.');
    } catch (e) {
      console.error(e);
      addMessage('bot', 'Sorry, I had a problem reaching the assistant.');
    } finally {
      state.sending = false; input.disabled = false; sendBtn.disabled = false; input.value=''; input.focus();
    }
  }

  // Build UI
  const trigger = el('button', { class: 'chatbot-trigger', 'aria-label': 'Open Leo Chat' }, [
    el('img', { src: 'assets/images/chat-icon.svg', alt: '', class: 'chat-icon' })
  ]);
  const panel = el('div', { class: 'chatbot-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Leo Chat' });
  const header = el('div', { class: 'chatbot-header' });
  const title = el('h3', { html: 'Ask Leo' });
  const mini = el('div', { class: 'mini', html: 'Leo knowledge + club info' });
  const closeBtn = el('button', { class: 'button alt', style: 'padding:6px 10px;border-radius:8px;' }, [ document.createTextNode('Close') ]);
  header.appendChild(el('div', {}, [title, mini]));
  header.appendChild(closeBtn);

  const messages = el('div', { class: 'chatbot-messages' });
  const suggestions = el('div', { class: 'suggestions' });
  ;['What is the Leo Club?', 'How to join?', 'Recent projects?', 'Board for 2025/26?'].forEach(q => {
    const s = el('div', { class: 'suggestion', html: q });
    s.addEventListener('click', () => sendMessage(q));
    suggestions.appendChild(s);
  });
  messages.appendChild(el('div', { class: 'msg-row bot' }, [ el('div', { class: 'msg bot', html: 'Hi! I can answer general Leo questions and info about your club.' }) ]));
  messages.appendChild(suggestions);

  const inputBar = el('div', { class: 'chatbot-input' });
  const input = el('input', { type: 'text', placeholder: 'Ask about Leo or this club…' });
  const sendBtn = el('button', {}, [ document.createTextNode('Send') ]);
  inputBar.appendChild(input); inputBar.appendChild(sendBtn);

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(inputBar);

  document.body.appendChild(trigger);
  document.body.appendChild(panel);

  // Events
  function togglePanel(force) {
    state.open = typeof force === 'boolean' ? force : !state.open;
    panel.classList.toggle('open', state.open);
  }
  trigger.addEventListener('click', () => togglePanel());
  closeBtn.addEventListener('click', () => togglePanel(false));
  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(input.value); });
})();