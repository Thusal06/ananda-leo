const fs = require('fs');
const path = require('path');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Allow': 'POST' }, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const question = (body.question || '').toString();
    const contextFiles = Array.isArray(body.contextFiles) ? body.contextFiles : [];

    if (!question) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing question' }) };
    }

    // Load local JSON/text context files packaged with the site
    let contextParts = [];
    for (const rel of contextFiles) {
      try {
        const abs = path.resolve(__dirname, '../../', rel);
        if (fs.existsSync(abs)) {
          const content = fs.readFileSync(abs, 'utf8');
          contextParts.push(`FILE: ${rel}\n${content}`);
        }
      } catch (e) {
        // Ignore missing/inaccessible files but continue
        console.warn('Context read error for', rel, e.message);
      }
    }
    const context = contextParts.join('\n\n');

    const systemPrompt = `You are an assistant for the Leo Club of Ananda College. Use the provided context to answer questions about Leo Clubs and this specific club. If the answer isn't in the context, answer from general Leo knowledge briefly; if still unsure, say you don't know and suggest contacting the club. Keep answers concise.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `Context:\n${context}` },
      { role: 'user', content: question }
    ];

    if (!process.env.OPENAI_API_KEY) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'OPENAI_API_KEY not set in environment' }) };
    }

    const resp = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 })
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.error('OpenAI error:', resp.status, txt);
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Upstream model error' }) };
    }

    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not formulate an answer.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    };
  } catch (e) {
    console.error('Server error:', e);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Server error' }) };
  }
};