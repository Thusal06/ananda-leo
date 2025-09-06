// Minimal interactivity: slider, marquee clone, and simple JSON loaders

// Mobile nav toggle
(function(){
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

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

  // Touch/swipe functionality for mobile
  let touchStartX = 0;
  let touchEndX = 0;
  let touchStartY = 0;
  let touchEndY = 0;
  
  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
  
  function handleTouchMove(e) {
    // Prevent default scrolling if horizontal swipe is detected
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    
    if (deltaX > deltaY) {
      e.preventDefault();
    }
  }
  
  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    handleSwipe();
  }
  
  function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 50;
    
    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      stop();
      if (deltaX > 0) {
        // Swipe right - go to previous slide
        prev();
      } else {
        // Swipe left - go to next slide
        next();
      }
      start();
    }
  }
  
  // Add touch event listeners
  slider.addEventListener('touchstart', handleTouchStart, { passive: false });
  slider.addEventListener('touchmove', handleTouchMove, { passive: false });
  slider.addEventListener('touchend', handleTouchEnd, { passive: true });

  updateDots();
  start();

  // if hero images fail to load or are heavy, drop animation for perf
  window.addEventListener('load', () => {
    document.querySelectorAll('.slide').forEach(sl => {
      const bg = sl.style.backgroundImage;
      if (!bg || bg.includes('undefined') || bg.includes('hero-')) {
        // no-op; ensure stable painting
      }
    });
  });
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

// Try serverless endpoint first; fall back to local JSON in /data for local preview
async function loadJSONFallback(primary, fallback) {
  try {
    return await loadJSON(primary);
  } catch (_e) {
    return await loadJSON(fallback);
  }
}

async function renderProjects() {
  const featured = document.getElementById('projects-featured');
  const thumbs = document.getElementById('projects-thumbs');
  if (!featured || !thumbs) return;
  try {
    const staticData = await loadJSONFallback('/.netlify/functions/data-read?name=projects', 'data/projects.json');

    // Try Instagram cache
    let igItems = [];
    try {
      const ig = await loadJSON('/.netlify/functions/ig-projects-read');
      igItems = Array.isArray(ig.items) ? ig.items : [];
    } catch (_) {}

    // Merge: Instagram first (newest), then static
    const all = [
      ...igItems.sort((a,b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)),
      ...(Array.isArray(staticData.projects) ? staticData.projects : [])
    ];
    if (!all.length) return;

    function setFeatured(p) {
      const images = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);
      const sliderId = 'proj-slider';
      featured.innerHTML = `
        <div class="eyebrow">Latest Project</div>
        <h2 class="h3" style="margin-top:6px;">${p.title || 'Project'}</h2>
        <div class="embed-responsive" style="margin-top: 14px;">
          <div id="${sliderId}" class="proj-slider">
            ${images.map((src,i)=>`<img src="${src}" alt="${p.title || 'Project'} image ${i+1}" class="proj-slide${i===0?' active':''}">`).join('')}
          </div>
        </div>
        <p style="margin-top:12px;">${p.summary || ''}</p>
        <div class="card-meta">${(p.tags||[]).map(t=>`<span class='tag'>${t}</span>`).join('')}${p.permalink ? ` <a href='${p.permalink}' target='_blank' rel='noopener' class='tag'>View</a>` : ''}</div>
      `;

      // simple timed slider
      const slides = featured.querySelectorAll(`#${sliderId} .proj-slide`);
      if (slides.length > 1) {
        let i = 0;
        setInterval(()=>{
          slides[i].classList.remove('active');
          i = (i + 1) % slides.length;
          slides[i].classList.add('active');
        }, 4000);
      }
    }

    setFeatured(all[0]);

    // Thumbnails list
    thumbs.innerHTML = all.slice(1).map(it => `
      <article class="news-card proj-thumb" data-title="${it.title || ''}" data-summary="${it.summary || ''}" data-permalink="${it.permalink || ''}" data-tags='${JSON.stringify(it.tags||[])}' data-images='${JSON.stringify(it.images|| (it.image?[it.image]:[]))}'>
        ${it.image ? `<img class="news-thumb" src="${it.image}" alt="${it.title || ''}">` : `<div class="news-thumb"></div>`}
        <div class="news-meta">
          <span class="title">${it.title || 'Project'}</span>
          <span class="month">${new Date(it.timestamp||Date.now()).toLocaleDateString()}</span>
        </div>
      </article>
    `).join('');

    thumbs.querySelectorAll('.proj-thumb').forEach(card => {
      card.addEventListener('click', () => {
        const images = JSON.parse(card.getAttribute('data-images')||'[]');
        const title = card.getAttribute('data-title')||'Project';
        const summary = card.getAttribute('data-summary')||'';
        const permalink = card.getAttribute('data-permalink')||'';
        const tags = JSON.parse(card.getAttribute('data-tags')||'[]');
        setFeatured({ images, image: images[0], title, summary, permalink, tags });
        window.scrollTo({ top: featured.offsetTop - 90, behavior: 'smooth' });
      });
    });
  } catch (_) {
    featured.innerHTML = '<p class="lead">Projects will appear here soon.</p>';
  }
}

async function renderBoard() {
  const el = document.getElementById('board-grid');
  if (!el) return;
  try {
    const data = await loadJSONFallback('/.netlify/functions/data-read?name=board', 'data/board.json');
    el.innerHTML = (data.members || []).map(m => `
      <div class="board-card">
        <img class="board-avatar" src="${m.avatar || 'assets/images/avatar-placeholder.svg'}" alt="${m.name}">
        <div class="board-meta">
          <div class="board-role">${m.role}</div>
          <div class="board-name">${m.name}</div>
          ${m.email ? `<a href="mailto:${m.email}">Contact</a>` : ''}
        </div>
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
    const data = await loadJSONFallback('/.netlify/functions/data-read?name=directors', 'data/directors.json');
    el.innerHTML = (data.members || []).map(m => `
      <div class="board-card">
        <img class="board-avatar" src="${m.avatar || 'assets/images/avatar-placeholder.svg'}" alt="${m.name}">
        <div class="board-meta">
          <div class="board-role">${m.role}</div>
          <div class="board-name">${m.name}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="lead">Directors will be announced soon.</p>`;
  }
}

async function renderPastPresidents() {
  const marquee = document.getElementById('past-marquee');
  if (!marquee) return;
  const track = marquee.querySelector('.people-track');
  try {
    const data = await loadJSONFallback('/.netlify/functions/data-read?name=past-presidents', 'data/past-presidents.json');
    const people = (data.members || []);
    if (!people.length) return;
    const html = people.map(m => `
      <div class="people-item">
        <img class="board-avatar" loading="lazy" decoding="async" src="${m.avatar || 'assets/images/avatar-placeholder.svg'}" alt="${m.name}" onerror="this.onerror=null;this.src='assets/images/avatar-placeholder.svg';console.log('Image failed to load:', this.src);">
        <div class="meta"><span class="board-role">${m.year}</span><span class="board-name">${m.name}</span></div>
      </div>
    `).join('');
    // duplicate for seamless loop; use requestAnimationFrame to avoid jank on heavy DOM
    track.innerHTML = html + html;
    requestAnimationFrame(()=>{ track.style.transform = 'translateZ(0)'; });
  } catch (e) {
    marquee.outerHTML = '<p class="lead">Past presidents list coming soon.</p>';
  }
}

async function renderNewsletters() {
  const featured = document.getElementById('news-featured');
  const list = document.getElementById('news-thumbs');
  if (!featured || !list) return;
  try {
    const data = await loadJSONFallback('/.netlify/functions/data-read?name=newsletters', 'data/newsletters.json');
    // Sort descending by date
    const issues = (data.issues || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!issues.length) return;

    function setFeatured(item) {
      featured.innerHTML = `
        <div class="eyebrow">Latest Issue</div>
        <h1 class="h2" style="margin-top:6px;">${item.title || item.month}</h1>
        <div class="embed-responsive" style="margin-top: 14px; position: relative;">
          <iframe src="${item.embedUrl}" allowfullscreen loading="lazy" title="${item.title || 'Newsletter'}"></iframe>
        </div>
      `;
    }

    setFeatured(issues[0]);

    function localPreviewFor(month) {
      // Map month names to local preview filenames
      const map = {
        'January 2025': 'LCAC Newsletter Jan.png',
        'February 2025': 'LCAC Newsletter Feb.png',
        'March 2025': 'LCAC Newsletter Mar.png',
        'April 2025': 'LCAC Newsletter Apr.png',
        'July 2025': 'LCAC Newsletter July.png',
        'December 2024': 'LCAC Newsletter Dec.png'
      };
      const file = map[month] || '';
      return file ? `assets/images/newsletterpreviews/${file}` : '';
    }

    list.innerHTML = issues.slice(1).map(it => {
      const local = localPreviewFor(it.month || '');
      const thumb = it.thumbnail || local;
      return `
      <article class="news-card" data-embed="${it.embedUrl}" data-title="${it.title || ''}" data-month="${it.month || ''}">
        ${thumb ? `<img class="news-thumb" src="${thumb}" alt="${it.title || it.month}">` : `<div class="news-thumb"></div>`}
        <div class="news-meta">
          <span class="title">${it.title || it.month}</span>
          <span class="month">${it.month || ''}</span>
        </div>
      </article>`;
    }).join('');

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

function addAdminRefreshButton() {
  const container = document.getElementById('projects-featured')?.parentElement || document.querySelector('.section .container');
  if (!container) return;

  // Read token from URL once; persist for the session
  const url = new URL(window.location.href);
  const urlToken = url.searchParams.get('token');
  const urlAdmin = url.searchParams.get('admin');
  if (urlToken) sessionStorage.setItem('admin_token', urlToken);
  if (urlAdmin) sessionStorage.setItem('is_admin', '1');

  const token = sessionStorage.getItem('admin_token');
  const isAdmin = sessionStorage.getItem('is_admin') === '1';
  if (!isAdmin || !token) return;

  const bar = document.createElement('div');
  bar.style.display = 'flex';
  bar.style.justifyContent = 'flex-end';
  bar.style.margin = '8px 0 16px';
  bar.innerHTML = `<button class="button" id="btn-refresh-ig">Refresh Instagram Projects</button>`;
  container.insertBefore(bar, container.firstChild);

  const btn = bar.querySelector('#btn-refresh-ig');
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Refreshing...';
    try {
      const res = await fetch('/.netlify/functions/ig-projects-refresh', {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });
      const data = await res.json().catch(()=>({}));
      alert(data.ok ? `Refreshed ${data.count || 0} items` : 'Refresh done (check logs)');
      await renderProjects();
    } catch (_) { alert('Refresh failed'); }
    finally { btn.disabled = false; btn.textContent = 'Refresh Instagram Projects'; }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  renderProjects();
  renderBoard();
  renderDirectors();
  renderPastPresidents();
  renderNewsletters();
  addAdminRefreshButton();
});