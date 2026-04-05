// api/generate.js — TeacherAI v7
// Plan gating with STRIPE_KILL_SWITCH:
//   - STRIPE_KILL_SWITCH=true  → everyone gets Pro access (beta mode)
//   - STRIPE_KILL_SWITCH=false → plan check enforced, free users hit monthly limit
//
// Plan behaviour:
//   beta → unlimited (always)
//   pro  → unlimited
//   free → FREE_MONTHLY_LIMIT lessons/month, then blocked

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const FREE_MONTHLY_LIMIT = 5; // lessons per month for free users

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // service key — bypasses RLS
  );
}

// Returns { allowed: bool, reason?: string, plan?: string }
async function checkPlanAccess(userId) {
  const killSwitch = process.env.STRIPE_KILL_SWITCH !== 'false'; // default ON (safe)

  if (killSwitch) return { allowed: true, plan: 'kill_switch' };

  const supabase = getSupabase();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, lessons_this_month, period_reset_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    // No profile yet — treat as free, allow (don't block new users)
    console.warn('No profile for user', userId, error?.message);
    return { allowed: true, plan: 'free' };
  }

  const plan = profile.plan || 'free';

  // Beta and Pro = always allowed
  if (plan === 'beta' || plan === 'pro') {
    return { allowed: true, plan };
  }

  // Free plan — check monthly limit
  // Reset counter if period has expired
  const now = new Date();
  const resetAt = profile.period_reset_at ? new Date(profile.period_reset_at) : null;
  let lessonsUsed = profile.lessons_this_month || 0;

  if (!resetAt || now >= resetAt) {
    // Reset the counter for the new month
    const nextReset = new Date(now);
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await supabase
      .from('profiles')
      .update({ lessons_this_month: 0, period_reset_at: nextReset.toISOString() })
      .eq('id', userId);

    lessonsUsed = 0;
  }

  if (lessonsUsed >= FREE_MONTHLY_LIMIT) {
    return {
      allowed: false,
      plan,
      reason: `Free plan limit reached (${FREE_MONTHLY_LIMIT} lessons/month). Upgrade to Pro for unlimited lessons.`,
      lessonsUsed,
      limit: FREE_MONTHLY_LIMIT,
    };
  }

  return { allowed: true, plan, lessonsUsed, limit: FREE_MONTHLY_LIMIT };
}

// Increment lesson count — only called after successful generation, only for free users
async function incrementLessonCount(userId) {
  const supabase = getSupabase();
  await supabase.rpc('increment_lessons', { user_id: userId });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const { model, max_tokens, messages, system } = body;

    // ── Plan check ──────────────────────────────────────────
    // Only gate full lesson generations (not SVG re-renders or short calls)
    // We detect a "lesson generation" by the presence of a system prompt
    // (SVG-only calls don't pass a system prompt in the current architecture)
    const isLessonGeneration = !!system;
    const token = req.headers.authorization?.split(' ')[1];

    let userId = null;
    let planResult = { allowed: true, plan: 'unknown' };

    if (isLessonGeneration && token) {
      // Verify token to get user ID
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (!authError && user) {
        userId = user.id;
        planResult = await checkPlanAccess(userId);
      }
      // If token invalid, still allow — don't block teachers on auth edge cases during beta
    }

    if (!planResult.allowed) {
      return res.status(402).json({
        error: planResult.reason,
        code: 'PLAN_LIMIT_REACHED',
        lessonsUsed: planResult.lessonsUsed,
        limit: planResult.limit,
      });
    }

    // ── Forward to Anthropic ─────────────────────────────────
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

    // ── Increment lesson count for free users (post-success) ─
    if (isLessonGeneration && userId && planResult.plan === 'free') {
      incrementLessonCount(userId).catch(err =>
        console.warn('Failed to increment lesson count:', err.message)
      );
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('generate.js error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
