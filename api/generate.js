// api/generate.js — TeacherAI v5.2
// Handles all AI generation calls + enforces free-tier lesson limit

import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const FREE_TIER_LIMIT = 5; // lessons per month

// Supabase service-role client (server-side only — never exposed to browser)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth: verify JWT from frontend ────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  // ── Parse body ────────────────────────────────────────────
  const body = req.body;
  const isLessonCall = body?.call_type === 'lesson';
  const isSvgCall = body?.call_type === 'svg'; // SVG-only, skip lesson gate

  // ── Lesson gate: only enforce on lesson generation ────────
  if (isLessonCall && !isSvgCall) {
    const gateResult = await checkAndIncrementLimit(user.id);
    if (gateResult.blocked) {
      return res.status(429).json({
        error: 'monthly_limit_reached',
        message: gateResult.message,
        used: gateResult.used,
        limit: gateResult.limit,
        plan: gateResult.plan,
      });
    }
  }

  // ── Forward to Anthropic ──────────────────────────────────
  try {
    const { model, max_tokens, messages, system } = body;

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

    // Handle Anthropic overload
    if (anthropicRes.status === 529 || anthropicRes.status === 529) {
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
}

// ============================================================
// checkAndIncrementLimit
// Reads profile, resets counter if new month, blocks if over limit
// Uses service role so it can update profiles freely
// ============================================================
async function checkAndIncrementLimit(userId) {
  // Fetch current profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, lessons_this_month, period_reset_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    // If profile doesn't exist yet, allow and create baseline
    console.warn('Profile not found for user', userId, '— allowing generation');
    return { blocked: false };
  }

  const { plan, lessons_this_month, period_reset_at } = profile;

  // Beta and Pro: always allow
  if (plan === 'beta' || plan === 'pro') {
    // Still increment counter so account page shows accurate usage
    await supabase
      .from('profiles')
      .update({ lessons_this_month: lessons_this_month + 1 })
      .eq('id', userId);
    return { blocked: false };
  }

  // Free tier: check if period needs reset
  const now = new Date();
  const resetAt = new Date(period_reset_at);
  let currentCount = lessons_this_month;

  if (now >= resetAt) {
    // New month — reset counter
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await supabase
      .from('profiles')
      .update({ lessons_this_month: 0, period_reset_at: nextReset.toISOString() })
      .eq('id', userId);
    currentCount = 0;
  }

  // Check limit
  if (currentCount >= FREE_TIER_LIMIT) {
    return {
      blocked: true,
      used: currentCount,
      limit: FREE_TIER_LIMIT,
      plan: 'free',
      message: `You've used all ${FREE_TIER_LIMIT} free lessons this month. Upgrade to Pro for unlimited lessons.`,
    };
  }

  // Under limit — increment and allow
  await supabase
    .from('profiles')
    .update({ lessons_this_month: currentCount + 1 })
    .eq('id', userId);

  return { blocked: false, used: currentCount + 1, limit: FREE_TIER_LIMIT, plan: 'free' };
}
