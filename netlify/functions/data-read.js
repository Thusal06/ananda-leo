// GET /.netlify/functions/data-read?name=board|directors|newsletters|projects|past-presidents
// Returns JSON from Netlify Blobs if available, else falls back to local /data/*.json

const fs = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { ...CORS, Allow: 'GET' }, body: 'Method Not Allowed' };
  }

  const name = (event.queryStringParameters?.name || '').replace(/[^a-z\-]/g, '');
  const allowed = new Set(['board', 'directors', 'newsletters', 'projects', 'past-presidents']);
  if (!allowed.has(name)) {
    return json(400, { error: 'Invalid name' });
  }

  try {
    let data = null;
    try {
      const { getStore } = require('@netlify/blobs');
      const store = getStore({ name: 'site-data' });
      data = await store.get(`${name}.json`, { type: 'json' });
    } catch (_) {}

    if (!data) {
      // fallback to local file (works locally and with included_files on Netlify)
      const local = path.resolve(__dirname, '../../data', `${name}.json`);
      if (fs.existsSync(local)) {
        data = JSON.parse(fs.readFileSync(local, 'utf8'));
      }
    }

    if (!data) {
      // Signal missing so client can fall back to static JSON via loadJSONFallback
      return json(404, { error: 'Not found' });
    }

    return json(200, data);
  } catch (e) {
    console.error('data-read error', e);
    return json(200, {});
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}