// Vercel serverless function: looks up whether an email has been marked
// Pro by the Stripe webhook. Called from welcome-screen.html on sign-in.
// UPSTASH_REDIS_REST_URL/TOKEN are added automatically when you attach a
// Redis store via Vercel's Storage tab (Marketplace -> Redis).

const { Redis } = require('@upstash/redis');
const { isProOverride } = require('./_lib/plan');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Request body must include an "email" string.' });
    return;
  }

  if (isProOverride(email)) {
    res.status(200).json({ plan: 'pro' });
    return;
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    res.status(500).json({
      error: 'Server is missing a Redis store. Attach one from Vercel’s Storage tab (Marketplace -> Redis) so its env vars get added automatically.',
    });
    return;
  }

  try {
    const redis = Redis.fromEnv();
    const record = await redis.get('plan:' + email.toLowerCase());
    res.status(200).json({ plan: record?.plan === 'pro' ? 'pro' : 'free' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check plan: ' + err.message });
  }
};
