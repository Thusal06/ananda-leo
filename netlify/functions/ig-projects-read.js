// Public function: return cached Instagram projects from Netlify Blobs
// GET /.netlify/functions/ig-projects-read

exports.handler = async () => {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'social-cache' });
    const cached = await store.get('ig_projects.json', { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(cached || { updatedAt: null, items: [] })
    };
  } catch (e) {
    console.error('Read error:', e);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ updatedAt: null, items: [] }) };
  }
};