const fs = require('fs');
const path = require('path');

// Simple, free FAQ-style responder using local JSON context only (no external APIs)
// Supports CORS and JSON POST requests from the site.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...CORS_HEADERS, Allow: 'POST' }, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const questionRaw = (body.question || '').toString();
    const contextFiles = Array.isArray(body.contextFiles) && body.contextFiles.length
      ? body.contextFiles
      : ['data/club-knowledge.json'];

    if (!questionRaw.trim()) {
      return respJSON(400, { error: 'Missing question' });
    }

    // Load the first available JSON context file
    const knowledge = loadKnowledge(contextFiles);

    // Generate answer
    const answer = answerFromKnowledge(questionRaw, knowledge);
    return respJSON(200, { answer });
  } catch (e) {
    console.error('Server error:', e);
    return respJSON(500, { error: 'Server error' });
  }
};

function respJSON(statusCode, obj) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

function loadKnowledge(relPaths) {
  let merged = {};
  for (const rel of relPaths) {
    try {
      const abs = path.resolve(__dirname, '../../', rel);
      if (fs.existsSync(abs)) {
        const raw = fs.readFileSync(abs, 'utf8');
        const data = JSON.parse(raw);
        merged = deepMerge(merged, data);
      }
    } catch (e) {
      console.warn('Context read error for', rel, e.message);
    }
  }
  return merged;
}

function deepMerge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  if (isObj(a) && isObj(b)) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return b === undefined ? a : b;
}
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

// Build a concise answer from local knowledge
function answerFromKnowledge(question, k) {
  const q = normalize(question);
  const club = k.club || {};
  const lg = k.leo_general || {};

  // Helpers
  const has = (...terms) => terms.every(t => q.includes(t));
  const any = (...terms) => terms.some(t => q.includes(t));

  // 1) Leo basics
  if (has('what', 'leo') || q.includes('leo club')) {
    const parts = [];
    if (lg.what_is_leo) parts.push(lg.what_is_leo);
    if (club.name && club.motto) parts.push(`${club.name} — Motto: ${club.motto}.`);
    return parts.join(' ')
      || 'LEO stands for Leadership, Experience, Opportunity — youth service clubs under Lions Clubs International.';
  }

  if (any('age', 'age range', 'ages')) {
    return lg.age_range || 'Leo Clubs typically serve youth and young adults; exact range varies by club and district.';
  }
  if (q.includes('benefit') || q.includes('why join')) {
    return lg.benefits || 'Benefits include leadership development, teamwork, networking, and community impact.';
  }
  if (q.includes('activit') || q.includes('events')) {
    return lg.activities || 'Typical activities: community service, leadership training, and fundraising projects.';
  }

  // 2) Club specifics
  if (any('join', 'apply', 'membership', 'become member')) {
    const how = club.join?.how || 'Complete the application and attend an orientation (if applicable).';
    const url = club.join?.formUrl ? ` Apply here: ${club.join.formUrl}` : '';
    return how + url;
  }
  if (q.includes('contact') || q.includes('email')) {
    const email = club.contact?.email ? `Email: ${club.contact.email}` : '';
    const socials = club.contact?.social || {};
    const sList = Object.entries(socials).map(([k, v]) => `${capitalize(k)}: ${v}`).join(' · ');
    const tail = sList ? (email ? ` · ${sList}` : sList) : '';
    return email || tail ? `${email}${tail}` : 'Please reach out via our social channels.';
  }
  if (q.includes('board') || q.includes('committee') || q.includes('exco') || q.includes('office')) {
    const year = club.board?.year ? ` (${club.board.year})` : '';
    const note = club.board?.note || 'Board details will be published on the Board page once finalized.';
    return `Board${year}: ${note}`;
  }
  if (q.includes('project') || q.includes('recent') || q.includes('initiative')) {
    const projects = Array.isArray(club.projects) ? club.projects.slice(0, 3) : [];
    if (projects.length) {
      const list = projects.map(p => `• ${p.title}${p.description ? ` — ${p.description}` : ''}`).join('\n');
      return `Recent projects:\n${list}`;
    }
    return 'We regularly run service and leadership projects; check the Projects page for updates.';
  }
  if (q.includes('motto')) {
    return club.motto || 'Born to Serve';
  }
  if (q.includes('app') || q.includes('mobile')) {
    return 'Our mobile app is coming soon. Watch the Mobile App page for updates.';
  }

  // 3) Fallback
  const hints = [
    'Try asking: "How to join?", "Recent projects?", "Board for this year?", "Contact?"',
  ];
  // If the question mentions Leo, include a short definition
  if (q.includes('leo')) {
    const base = lg.what_is_leo || 'LEO = Leadership, Experience, Opportunity — youth service program of Lions Clubs.';
    return `${base}\n${hints[0]}`;
  }
  // Otherwise reference the club
  const clubName = club.name || 'our club';
  return `I don’t have that answer yet for ${clubName}. ${hints[0]}`;
}

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }