// api/generate.js — TeacherAI v9 (auth gate + opt-in streaming)
//
// STREAMING: opt-in via { stream: true } in request body.
//   - When stream is true, proxy streams Anthropic SSE back to client.
//     Client should use callGenerateStreaming() in index.html which
//     accumulates text and returns a shape matching non-streaming responses.
//   - When stream is false/absent, behaves IDENTICALLY to non-streaming v8.
//
// AUTH GATE (Chat 9):
//   - Verifies Supabase JWT via HS256 using SUPABASE_JWT_SECRET.
//   - Mode controlled by AUTH_ENFORCE env var:
//       unset / "false" / "soft"  → SOFT FAIL: logs rejections, allows request through
//       "true" / "hard"           → HARD FAIL: returns 401 on invalid/missing JWT
//   - To go live: set AUTH_ENFORCE=true in Vercel env vars and redeploy.
//   - No new npm deps — uses Node stdlib crypto only.

const crypto = require('crypto');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Base64url decode (JWT uses base64url, not standard base64)
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// Verify a Supabase JWT (HS256). Returns payload on success, throws on failure.
function verifySupabaseJWT(token, secret) {
  if (!token || typeof token !== 'string') throw new Error('no token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
  if (header.alg !== 'HS256') throw new Error('unexpected alg: ' + header.alg);

  // Verify signature
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(headerB64 + '.' + payloadB64)
    .digest();
  const providedSig = b64urlDecode(sigB64);
  if (expectedSig.length !== providedSig.length ||
      !crypto.timingSafeEqual(expectedSig, providedSig)) {
    throw new Error('bad signature');
  }

  const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('token expired');

  return payload;
}

// Run the auth check. Returns { userId, mode, ok, reason }.
// Never throws — caller decides whether to enforce.
function checkAuth(req) {
  const enforce = String(process.env.AUTH_ENFORCE || '').toLowerCase();
  const mode = (enforce === 'true' || enforce === 'hard') ? 'hard' : 'soft';

  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return { userId: null, mode, ok: false, reason: 'no bearer header' };

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return { userId: null, mode, ok: false, reason: 'server missing SUPABASE_JWT_SECRET' };

  try {
    const payload = verifySupabaseJWT(match[1], secret);
    return { userId: payload.sub || null, mode, ok: true, reason: null };
  } catch (err) {
    return { userId: null, mode, ok: false, reason: err.message };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ──────────────────────────────────────────────────────────────────
  // AUTH GATE (Chat 9)
  // ──────────────────────────────────────────────────────────────────
  const auth = checkAuth(req);
  if (!auth.ok) {
    if (auth.mode === 'hard') {
      console.warn('[auth] HARD BLOCK:', auth.reason);
      return res.status(401).json({ error: 'Unauthorized. Please sign in again.' });
    } else {
      console.warn('[auth] SOFT FAIL (would have blocked):', auth.reason);
    }
  } else {
    console.log('[auth] OK user=' + auth.userId);
  }
  // Expose for later logging / rate-limit use
  req.userId = auth.userId;
  // ──────────────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────────────
  // STREAMING: opt-in branch (self-contained, fully revertible)
  // ──────────────────────────────────────────────────────────────────
  if (req.body && req.body.stream === true) {
    try {
      const { model, max_tokens, messages, system } = req.body;
      const anthropicPayload = { model, max_tokens, messages, stream: true };
      if (system) anthropicPayload.system = system;

      const anthropicRes = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(anthropicPayload),
      });

      // Handle non-200 BEFORE starting the stream (status is known up front)
      if (anthropicRes.status === 529) {
        return res.status(529).json({ error: 'AI service at capacity. Please try again in a moment.' });
      }
      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text().catch(() => '');
        console.error('Anthropic error (stream):', anthropicRes.status, errText);
        let errJson = {};
        try { errJson = JSON.parse(errText); } catch(_) {}
        return res.status(anthropicRes.status).json({ error: errJson.error || 'AI generation failed' });
      }

      // Pipe the SSE stream to the client. Vercel's 25s idle timer
      // resets on every chunk, so as long as Anthropic streams tokens we
      // never hit a 504.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
      return;
    } catch (err) {
      console.error('generate.js stream error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Server error: ' + err.message });
      }
      try { res.end(); } catch(_) {}
      return;
    }
  }
  // ──────────────────────────────────────────────────────────────────
  // END STREAMING BRANCH
  // ──────────────────────────────────────────────────────────────────

  // Original non-streaming path — byte-identical to pre-streaming v8
  try {
    const { model, max_tokens, messages, system } = req.body;
    const anthropicPayload = { model, max_tokens, messages };
    if (system) anthropicPayload.system = system;

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicPayload),
    });

    if (anthropicRes.status === 529) {
      return res.status(529).json({ error: 'AI service at capacity. Please try again in a moment.' });
    }

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error('Anthropic error:', data);
      return res.status(anthropicRes.status).json({ error: data.error || 'AI generation failed' });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
