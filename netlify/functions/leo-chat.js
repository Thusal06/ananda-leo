const fs = require('fs');
const path = require('path');
const https = require('https');

// Enhanced chatbot with Gemini AI integration and local JSON context
// Supports CORS and JSON POST requests from the site.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Gemini API configuration
const GEMINI_API_KEY = 'AIzaSyBiPdL02mNUIV_X_pKtkINmKqiGTapLikA';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

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

    // Load the local knowledge base
    const knowledge = loadKnowledge(contextFiles);

    // Try local knowledge first for club-specific questions
    const localAnswer = answerFromKnowledge(questionRaw, knowledge);
    
    // Check if local knowledge provides a specific, detailed answer
    const isSpecificLocalAnswer = localAnswer && 
      !localAnswer.includes("I don't have that answer yet") &&
      !localAnswer.includes("Try asking:") &&
      !localAnswer.includes("check the") &&
      localAnswer.length > 50; // Ensure it's a substantial answer
    
    // Improved logic for club-specific questions
    const q = questionRaw.toLowerCase();
    
    // High priority club-specific terms (always prefer local knowledge)
    const isHighPriorityClubSpecific = q.includes('ananda') || 
                                      q.includes('leo club of ananda') ||
                                      q.includes('this club') ||
                                      q.includes('your club') ||
                                      q.includes('our club');
    
    // Medium priority club-specific terms
    const isMediumPriorityClubSpecific = q.includes('join') || q.includes('board') || 
                                        q.includes('contact') || q.includes('motto') || 
                                        q.includes('application') || q.includes('projects') ||
                                        q.includes('members') || q.includes('activities');
    
    // Generic Leo questions that should NOT prioritize local knowledge
    const isGenericLeoQuestion = (q.includes('what is leo') && !q.includes('ananda')) ||
                                (q.includes('leo club') && !q.includes('ananda') && !q.includes('this') && !q.includes('your') && !q.includes('our')) ||
                                (q.includes('leo') && (q.includes('general') || q.includes('about leo') || q.includes('leo program')));
    
    // Prioritize local knowledge for club-specific questions
    if (isSpecificLocalAnswer && (isHighPriorityClubSpecific || (isMediumPriorityClubSpecific && !isGenericLeoQuestion))) {
      return respJSON(200, { answer: localAnswer, source: 'local' });
    }

    // For general questions or when local knowledge is insufficient, use Gemini AI
    try {
      const geminiAnswer = await getGeminiAnswer(questionRaw, knowledge);
      return respJSON(200, { answer: geminiAnswer, source: 'gemini' });
    } catch (geminiError) {
      console.error('Gemini API error:', geminiError);
      // Fallback to local answer if Gemini fails
      return respJSON(200, { answer: localAnswer || "I'm having trouble answering that right now. Please try again later.", source: 'fallback' });
    }
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

// Function to get answer from Gemini API
async function getGeminiAnswer(question, knowledge) {
  const clubContext = JSON.stringify(knowledge, null, 2);
  
  const prompt = `You are a helpful assistant for the Leo Club of Ananda College. 

Context about the club:
${clubContext}

Instructions:
- PRIORITIZE club-specific information when the question mentions "Ananda", "Leo Club of Ananda College", "this club", "your club", or "our club"
- For questions specifically about Leo Club of Ananda College, use the provided context first
- For general Leo Club questions (without specific club references), provide general Leo program information
- Keep answers concise and helpful (2-3 sentences max for simple questions)
- If asked about club-specific details not in the context, mention checking the website or contacting the club
- Be friendly and encouraging about Leo Club activities and membership
- When someone asks "What is Leo Club of Ananda College" or similar, focus on the specific club, not general Leo information

Question: ${question}

Answer:`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };

  let response, data;
  
  // Try using fetch first (Node.js 18+)
  if (typeof fetch !== 'undefined') {
    response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    data = await response.json();
  } else {
    // Fallback to https module
    data = await makeHttpsRequest(GEMINI_API_URL, requestBody);
  }
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  
  throw new Error('Invalid response format from Gemini API');
}

// Fallback function for environments without fetch
function makeHttpsRequest(url, requestBody) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(requestBody);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Gemini API error: ${res.statusCode} ${res.statusMessage}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse Gemini API response'));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
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

  // 0) Direct club question
  if (q.includes('leo club of ananda college') || (q.includes('ananda') && (q.includes('about') || q.includes('tell me')))) {
    const parts = [];
    if (club.name) parts.push(`${club.name} is a student-led service organization at Ananda College.`);
    if (club.about) parts.push(club.about);
    if (club.motto) parts.push(`Our motto: "${club.motto}".`);
    return parts.join(' ') || 'Leo Club of Ananda College is a youth service organization focused on leadership development and community service.';
  }

  // 1) Leo basics - but prioritize club-specific questions
  if (has('what', 'leo') || q.includes('leo club')) {
    // If asking specifically about Leo Club of Ananda College
    if (q.includes('ananda') || q.includes('this club') || q.includes('your club') || q.includes('our club')) {
      const parts = [];
      if (club.name) parts.push(`${club.name} is a student-led service organization.`);
      if (club.about) parts.push(club.about);
      if (club.motto) parts.push(`Our motto: "${club.motto}".`);
      if (lg.what_is_leo) parts.push(`LEO stands for Leadership, Experience, Opportunity.`);
      return parts.join(' ') || `${club.name || 'Our club'} is part of the Leo program - youth service clubs under Lions Clubs International.`;
    }
    // Generic Leo question
    else if (!q.includes('ananda')) {
      return lg.what_is_leo || 'LEO stands for Leadership, Experience, Opportunity — youth service clubs under Lions Clubs International.';
    }
    // Fallback for mixed questions
    else {
      const parts = [];
      if (lg.what_is_leo) parts.push(lg.what_is_leo);
      if (club.name && club.motto) parts.push(`${club.name} — Motto: ${club.motto}.`);
      return parts.join(' ')
        || 'LEO stands for Leadership, Experience, Opportunity — youth service clubs under Lions Clubs International.';
    }
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