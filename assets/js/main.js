// Minimal interactivity: slider, marquee clone, and simple JSON loaders

// Slider logic
(function() {
  const slider = document.querySelector('.slider');
  if (!slider) return;
  const slides = slider.querySelector('.slides');
  const dotsContainer = slider.querySelector('.dots');
  const slideEls = Array.from(slides.children);
  let index = 0;
  let timer = null;

  function go(i) {
    index = (i + slideEls.length) % slideEls.length;
    slides.style.transform = `translateX(-${index * 100}%)`;
    updateDots();
  }

  function updateDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    slideEls.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'dot' + (i === index ? ' active' : '');
      d.addEventListener('click', () => { stop(); go(i); start(); });
      dotsContainer.appendChild(d);
    });
  }

  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  function start() { timer = setInterval(next, 5000); }
  function stop() { if (timer) clearInterval(timer); }

  slider.querySelector('.btn-next')?.addEventListener('click', () => { stop(); next(); start(); });
  slider.querySelector('.btn-prev')?.addEventListener('click', () => { stop(); prev(); start(); });

  updateDots();
  start();
})();

// Duplicate marquee track to create seamless loop
(function() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;
  track.innerHTML = track.innerHTML + track.innerHTML; // duplicate logos
})();

// Dynamic content loaders for projects and board pages
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to load ' + path);
  return res.json();
}

async function renderProjects() {
  const el = document.getElementById('projects-grid');
  if (!el) return;
  try {
    const data = await loadJSON('data/projects.json');
    el.innerHTML = data.projects.map(p => `
      <article class="card">
        ${p.image ? `<img class="card-media" src="${p.image}" alt="${p.title}">` : `<div class="card-media"></div>`}
        <div class="card-body">
          <div class="card-meta">${p.tags?.map(t=>`<span class='tag'>${t}</span>`).join('') || ''}</div>
          <h3 class="card-title">${p.title}</h3>
          <p>${p.summary || ''}</p>
        </div>
      </article>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="lead">No projects found yet.</p>`;
  }
}

async function renderBoard() {
  const el = document.getElementById('board-grid');
  if (!el) return;
  try {
    const data = await loadJSON('data/board.json');
    el.innerHTML = (data.members || []).map(m => `
      <div class="board-card">
        <img class="board-avatar" src="${m.avatar || 'assets/images/avatar-placeholder.svg'}" alt="${m.name}">
        <div class="board-role">${m.role}</div>
        <div class="board-name">${m.name}</div>
        ${m.email ? `<a href="mailto:${m.email}">Contact</a>` : ''}
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="lead">Board will be announced soon.</p>`;
  }
}

async function renderDirectors() {
  const el = document.getElementById('directors-grid');
  if (!el) return;
  try {
    const data = await loadJSON('data/directors.json');
    el.innerHTML = (data.members || []).map(m => `
      <div class="board-card">
        <img class="board-avatar" src="${m.avatar || 'assets/images/avatar-placeholder.svg'}" alt="${m.name}">
        <div class="board-role">${m.role}</div>
        <div class="board-name">${m.name}</div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="lead">Directors will be announced soon.</p>`;
  }
}

async function renderPastPresidents() {
  const el = document.getElementById('past-presidents-grid');
  if (!el) return;
  try {
    const data = await loadJSON('data/past-presidents.json');
    el.innerHTML = (data.members || []).map(m => `
      <div class="board-card">
        <img class="board-avatar" src="${m.avatar || 'assets/images/avatar-placeholder.svg'}" alt="${m.name}">
        <div class="board-role">${m.year}</div>
        <div class="board-name">${m.name}</div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="lead">Past presidents list coming soon.</p>`;
  }
}

async function renderNewsletters() {
  const featured = document.getElementById('news-featured');
  const list = document.getElementById('news-thumbs');
  if (!featured || !list) return;
  try {
    const data = await loadJSON('data/newsletters.json');
    // Sort descending by date
    const issues = (data.issues || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!issues.length) return;

    function setFeatured(item) {
      featured.innerHTML = `
        <div class="eyebrow">Latest Issue</div>
        <h1 class="h2" style="margin-top:6px;">${item.title || item.month}</h1>
        <div class="embed-responsive" style="margin-top: 14px;">
          <iframe src="${item.embedUrl}" allowfullscreen loading="lazy" title="${item.title || 'Newsletter'}"></iframe>
        </div>
      `;
    }

    setFeatured(issues[0]);

    list.innerHTML = issues.slice(1).map(it => `
      <article class="news-card" data-embed="${it.embedUrl}" data-title="${it.title || ''}" data-month="${it.month || ''}">
        ${it.thumbnail ? `<img class="news-thumb" src="${it.thumbnail}" alt="${it.title || it.month}">` : `<div class="news-thumb"></div>`}
        <div class="news-meta">
          <span class="title">${it.title || it.month}</span>
          <span class="month">${it.month || ''}</span>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('.news-card').forEach(card => {
      card.addEventListener('click', () => {
        const embed = card.getAttribute('data-embed');
        const title = card.getAttribute('data-title');
        const month = card.getAttribute('data-month');
        setFeatured({ embedUrl: embed, title, month });
        window.scrollTo({ top: featured.offsetTop - 90, behavior: 'smooth' });
      });
    });
  } catch (_) {
    featured.innerHTML = '<p class="lead">Newsletters will appear here soon.</p>';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  renderProjects();
  renderBoard();
  renderDirectors();
  renderPastPresidents();
  renderNewsletters();
});