// api/generate.js — TeacherAI v8 (open beta + optional streaming)
//
// STREAMING: opt-in via { stream: true } in request body.
//   - When stream is true, proxy streams Anthropic SSE back to client.
//     Client should buffer and JSON.parse at end (see index.html callGenerateStreaming).
//   - When stream is false/absent, behaves IDENTICALLY to non-streaming v8.
//
// TO REVERT: delete the `if (req.body && req.body.stream)` block below.
//            Client calls that don't send `stream:true` are unaffected.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ──────────────────────────────────────────────────────────────────
  // STREAMING: opt-in branch. Entire block is self-contained and can be
  // removed to revert to non-streaming only. Non-streaming path below is
  // unchanged from v8.
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

      // Pipe the SSE stream to the client. We keep it as SSE so the client
      // can parse Anthropic's event format directly. Vercel's 25s idle timer
      // resets on every chunk, so as long as Anthropic streams tokens we
      // never hit a 504.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if present

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
      // If headers already sent, just end the stream. Otherwise send JSON error.
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

  // Original non-streaming path — unchanged from v8
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
