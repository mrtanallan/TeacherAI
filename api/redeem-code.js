// api/redeem-code.js — TeacherAI beta code redemption
// POST { code } → looks up access_codes, decrements uses_left, sets profiles.plan='beta'

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function verifyAuth(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false };
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { ok: false };
    const u = await r.json();
    return u?.id ? { ok: true, userId: u.id } : { ok: false };
  } catch { return { ok: false }; }
}

const sbHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Please sign in first.' });

  const code = (req.body && req.body.code || '').trim();
  if (!code) return res.status(400).json({ error: 'No code provided.' });

  try {
    // Look up the code
    const lookupRes = await fetch(`${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code)}&select=code,uses_left`, { headers: sbHeaders });
    const rows = await lookupRes.json();
    if (!rows.length) return res.status(404).json({ error: 'Code not found.' });
    const row = rows[0];
    if ((row.uses_left || 0) <= 0) {
      return res.status(410).json({ error: 'This code has no uses left.' });
    }

    // Decrement uses_left
    const decRes = await fetch(`${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ uses_left: row.uses_left - 1 }),
    });
    if (!decRes.ok) throw new Error('Failed to update code uses');

    // Promote user to beta
    const updRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${auth.userId}`, {
      method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ plan: 'beta' }),
    });
    if (!updRes.ok) throw new Error('Failed to update profile');

    return res.status(200).json({ ok: true, plan: 'beta', uses_remaining: row.uses_left - 1 });
  } catch (err) {
    console.error('redeem-code error:', err);
    return res.status(500).json({ error: 'Could not redeem code. Please try again.' });
  }
};
