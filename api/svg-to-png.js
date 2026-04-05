// api/svg-to-png.js — image URL fetching only

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageUrl } = req.body;

    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });

    const fetch = require('node-fetch');
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return res.status(200).json({ png: null, error: 'image fetch failed' });
    const buf = await imgRes.buffer();
    const base64 = buf.toString('base64');
    const mime = imgRes.headers.get('content-type') || 'image/jpeg';
    return res.status(200).json({ png: base64, mime });

  } catch(err) {
    console.error('svg-to-png error:', err.message);
    return res.status(200).json({ png: null, error: err.message });
  }
};
