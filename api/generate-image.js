// api/generate-image.js — TeacherAI image generation
// Flux Schnell at 8 steps + strong negative prompt for text suppression

const FAL_KEY = process.env.FAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function getCached(key) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/image_cache?cache_key=eq.${encodeURIComponent(key)}&select=image_url`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = await r.json();
    return rows?.[0]?.image_url || null;
  } catch { return null; }
}

async function setCache(key, url) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/image_cache`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ cache_key: key, image_url: url }),
    });
  } catch {}
}

async function generateAIImage(topic, subject, grade, theme) {
  if (!FAL_KEY) throw new Error('FAL_API_KEY not set');

  const subjectLower = (subject || '').toLowerCase();
  const themeStr = theme ? `, ${theme} theme` : '';
  const gradeNum = (grade || '').replace(/Grade\s*/i, '').replace(/Gr\.\s*/i, '');

  const style = subjectLower.includes('science')
    ? 'soft watercolour nature painting, botanical illustration'
    : subjectLower.includes('math')
    ? 'clean flat vector illustration, geometric shapes, bright colours'
    : 'warm children\'s book painting, cosy illustration';

  const prompt = [
    style,
    `${topic}${themeStr}`,
    `Grade ${gradeNum || 'K-8'} classroom`,
    'beautiful artwork',
    'soft warm colours',
    'high quality',
    'no text anywhere in image',
  ].join(', ');

  const negativePrompt = [
    'text', 'letters', 'words', 'numbers', 'labels', 'captions',
    'titles', 'headings', 'watermark', 'writing', 'typography',
    'diagram', 'chart', 'infographic', 'ugly', 'blurry',
    'distorted', 'low quality', 'bad art',
  ].join(', ');

  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      image_size: 'portrait_4_3',
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fal.ai ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`No URL in response`);
  return url;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { type = 'ai', topic, subject, grade, theme } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'topic required' });

  // v3 cache key — forces regeneration of old cached images
  const cacheKey = `v3:${(subject||'').slice(0,20)}:${(grade||'').slice(0,10)}:${topic.slice(0,60)}`;

  try {
    const cached = await getCached(cacheKey);
    if (cached) return res.status(200).json({ url: cached, cached: true });

    const imageUrl = await generateAIImage(topic, subject, grade, theme);
    await setCache(cacheKey, imageUrl);
    return res.status(200).json({ url: imageUrl, cached: false });

  } catch (err) {
    console.error('[generate-image]', topic, err.message);
    return res.status(200).json({ url: null, error: err.message });
  }
}
