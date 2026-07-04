// Vercel serverless function: verifies and handles Stripe webhook events.
// STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are server-side environment
// variables only -- set them in Vercel's Settings -> Environment Variables.
// Never in git, never in chat. UPSTASH_REDIS_REST_URL/TOKEN are added
// automatically when you attach a Redis store via Vercel's Storage tab.

const Stripe = require('stripe');
const { Redis } = require('@upstash/redis');
const { sendAdminEmail } = require('./_lib/email');

// Stripe requires the raw, unparsed request body to verify the signature,
// so the platform's automatic JSON body-parsing must be turned off here.
module.exports.config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function markPlan(redis, email, plan) {
  if (!email) return;
  const key = 'plan:' + email.toLowerCase();
  if (plan === 'pro') {
    await redis.set(key, { plan: 'pro', updatedAt: Date.now() });
  } else {
    await redis.del(key);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    res.status(500).json({
      error: 'Server is missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET. Set both in your hosting provider’s environment variables.',
    });
    return;
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    res.status(500).json({
      error: 'Server is missing a Redis store. Attach one from Vercel’s Storage tab (Marketplace -> Redis) so its env vars get added automatically.',
    });
    return;
  }

  const stripe = new Stripe(secretKey);
  const redis = Redis.fromEnv();
  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    res.status(400).json({ error: 'Invalid webhook signature: ' + err.message });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        await markPlan(redis, email, 'pro');
        await sendAdminEmail('New Pro signup', email + ' just upgraded to Pro.');
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        await markPlan(redis, customer?.email, 'free');
        break;
      }
      default:
        break; // ignore event types we don't act on
    }
    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Webhook handler failed: ' + err.message });
  }
};
