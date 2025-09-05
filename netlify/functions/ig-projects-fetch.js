// Scheduled function: fetch latest Instagram posts for hashtag and cache in Netlify Blobs
// Env required: IG_ACCESS_TOKEN (long-lived), IG_USER_ID (business/creator), IG_HASHTAG (default: LCACProjects)
// Runs on schedule configured in netlify.toml

const fetch = global.fetch;

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}: ${txt}`);
  }
  return res.json();
}

function mapPostToProject(p) {
  // collect images for slider
  const images = [];
  if (p.media_url) images.push(p.media_url);
  if (p.children && Array.isArray(p.children.data)) {
    p.children.data.forEach(c => { if (c.media_url) images.push(c.media_url); });
  }
  const image = images[0];
  const caption = (p.caption || '').trim();
  const title = caption.split('\n')[0].slice(0, 120) || 'Instagram Post';
  const summary = caption.length > 0 ? caption.slice(0, 300) : '';
  return {
    title,
    summary,
    image,
    images,
    permalink: p.permalink,
    timestamp: p.timestamp,
    tags: ['Instagram', '#LCACProjects'],
    source: 'instagram'
  };
}

async function runFetch() {
  try {
    const token = process.env.IG_ACCESS_TOKEN;
    const userId = process.env.IG_USER_ID;
    const hashtag = process.env.IG_HASHTAG || 'LCACProjects';
    const limit = parseInt(process.env.IG_LIMIT || '15', 10);

    if (!token || !userId) {
      console.error('Missing IG_ACCESS_TOKEN or IG_USER_ID');
      return { statusCode: 200, body: 'Missing Instagram credentials; skipping.' };
    }

    // 1) Find hashtag id
    const searchUrl = `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=${encodeURIComponent(userId)}&q=${encodeURIComponent(hashtag)}&access_token=${encodeURIComponent(token)}`;
    const search = await getJSON(searchUrl);
    const hashtagId = Array.isArray(search.data) && search.data[0] ? search.data[0].id : null;
    if (!hashtagId) {
      console.warn('Hashtag not found:', hashtag);
      return { statusCode: 200, body: 'Hashtag not found.' };
    }

    // 2) Get recent media for hashtag
    const fields = 'id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}';
    const recentUrl = `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?user_id=${encodeURIComponent(userId)}&fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${encodeURIComponent(token)}`;
    const recent = await getJSON(recentUrl);
    const items = (recent.data || []).map(mapPostToProject);

    // 3) Store to Netlify Blobs
    let store;
    try {
      const { getStore } = require('@netlify/blobs');
      store = getStore({ name: 'social-cache' });
    } catch (e) {
      console.error('Blobs module not available:', e.message);
      return { statusCode: 200, body: 'Blobs not available; skipping cache.' };
    }

    await store.setJSON('ig_projects.json', { updatedAt: new Date().toISOString(), items });

    return { statusCode: 200, body: `Cached ${items.length} Instagram posts for #${hashtag}.` };
  } catch (e) {
    console.error('Fetch error:', e);
    return { statusCode: 200, body: 'Error during fetch (logged).'};
  }
};

// Export handlers
exports.handler = runFetch;
exports.runFetch = runFetch;