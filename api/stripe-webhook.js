// api/stripe-webhook.js — TeacherAI v6
// Receives Stripe webhook events and updates Supabase profiles
//
// Stripe Dashboard → Developers → Webhooks → Add endpoint:
//   URL: https://teacherai.ca/api/stripe-webhook
//   Events to listen for:
//     - checkout.session.completed
//     - customer.subscription.deleted
//     - customer.subscription.updated  (handles pauses/failures)

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// IMPORTANT: Vercel parses body by default — we need raw body for Stripe signature verification
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Read raw body for signature verification
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature: ' + err.message });
  }

  console.log('Stripe webhook received:', event.type);

  try {
    switch (event.type) {

      // ── Payment successful → upgrade to Pro ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error('No supabase_user_id in checkout session metadata');
          break;
        }

        await supabase
          .from('profiles')
          .update({
            plan: 'pro',
            stripe_subscription_id: subscriptionId,
            lessons_this_month: 0,  // reset counter on upgrade
          })
          .eq('id', userId);

        console.log(`✅ Upgraded user ${userId} to Pro (sub: ${subscriptionId})`);
        break;
      }

      // ── Subscription cancelled → downgrade to Free ───────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        // Look up user by subscription ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!profile) {
          console.warn('No profile found for subscription', subscriptionId);
          break;
        }

        await supabase
          .from('profiles')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
          })
          .eq('id', profile.id);

        console.log(`⬇️ Downgraded user ${profile.id} to Free (sub cancelled)`);
        break;
      }

      // ── Subscription updated (e.g. payment failed) ───────
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const status = subscription.status; // active, past_due, unpaid, canceled

        if (status === 'active') break; // already handled by checkout.session.completed

        if (['past_due', 'unpaid', 'canceled'].includes(status)) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ plan: 'free' })
              .eq('id', profile.id);
            console.log(`⚠️ Downgraded user ${profile.id} due to subscription status: ${status}`);
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Read raw body from Vercel request (needed for Stripe signature)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
