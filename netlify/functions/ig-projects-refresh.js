// Secure endpoint to force-refresh Instagram cache on demand
// Requires header: x-admin-token: <NETLIFY_ENV ADMIN_TOKEN>

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { ...cors(), Allow: 'POST' }, body: 'Method Not Allowed' };
  }

  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const provided = event.headers['x-admin-token'] || event.headers['X-Admin-Token'] || '';
    if (!adminToken || provided !== adminToken) {
      return { statusCode: 401, headers: cors(), body: 'Unauthorized' };
    }

    const { runFetch } = require('./ig-projects-fetch.js');
    const result = await runFetch();

    const body = typeof result === 'object' ? JSON.stringify(result) : String(result);
    return { statusCode: 200, headers: corsJSON(), body };
  } catch (e) {
    console.error('Refresh error:', e);
    return { statusCode: 200, headers: corsJSON(), body: JSON.stringify({ ok: false, error: 'Refresh failed' }) };
  }
};

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
}
function corsJSON() {
  return { ...cors(), 'Content-Type': 'application/json' };
}