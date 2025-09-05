// POST /.netlify/functions/data-write?name=board|directors|newsletters|projects|past-presidents
// Secured by ADMIN_TOKEN env. Body: JSON document to upsert into Netlify Blobs.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...CORS, Allow: 'POST' }, body: 'Method Not Allowed' };
  }

  const adminToken = process.env.ADMIN_TOKEN;
  const provided = event.headers['x-admin-token'] || event.headers['X-Admin-Token'] || '';
  if (!adminToken || provided !== adminToken) {
    return { statusCode: 401, headers: CORS, body: 'Unauthorized' };
  }

  const name = (event.queryStringParameters?.name || '').replace(/[^a-z\-]/g, '');
  const allowed = new Set(['board', 'directors', 'newsletters', 'projects', 'past-presidents']);
  if (!allowed.has(name)) {
    return json(400, { ok: false, error: 'Invalid name' });
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { setStore } = require('@netlify/blobs');
    const store = setStore({ name: 'site-data' });
    await store.set(`${name}.json`, JSON.stringify(payload), { contentType: 'application/json' });
    return json(200, { ok: true });
  } catch (e) {
    console.error('data-write error', e);
    return json(200, { ok: false });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}