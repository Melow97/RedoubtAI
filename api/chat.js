// Vercel serverless function: proxies chat requests to the Anthropic API,
// and (when the caller includes an email) tracks token usage against a
// monthly plan limit in Redis. ANTHROPIC_API_KEY is a server-side
// environment variable only -- set it in Vercel's Settings -> Environment
// Variables. Never in git, never in chat.

const { Redis } = require('@upstash/redis');
const { sendAdminEmail } = require('./_lib/email');

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT =
  "You are Redoubt, a security-focused AI copilot for a SOC/dev team. " +
  "Be concise and precise. Use the web_search tool only when the answer " +
  "depends on live or current information (scores, news, prices, today's " +
  "date-sensitive facts) — answer directly from your own knowledge otherwise.";

// Token budgets per plan, per calendar month. Pro is intentionally roomy —
// tune these as real usage patterns show up.
const PLAN_LIMITS = { free: 50000, pro: 2000000 };
const HEAVY_USAGE_THRESHOLD = 0.8;

function currentPeriod() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

async function loadUsage(redis, email) {
  const record = (await redis.get('usage:' + email)) || {};
  if (record.period !== currentPeriod()) {
    return { tokens: 0, period: currentPeriod(), alerted: false };
  }
  return { tokens: record.tokens || 0, period: record.period, alerted: !!record.alerted };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Server is missing ANTHROPIC_API_KEY. Set it in your hosting provider’s environment variables and redeploy.',
    });
    return;
  }

  const { messages, email } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Request body must include a non-empty "messages" array.' });
    return;
  }

  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = hasRedis ? Redis.fromEnv() : null;
  const trackUsage = Boolean(redis && email);

  let plan = 'free';
  let usage = { tokens: 0, period: currentPeriod(), alerted: false };
  let limit = PLAN_LIMITS.free;

  if (trackUsage) {
    const key = 'plan:' + email.toLowerCase();
    const planRecord = await redis.get(key);
    plan = planRecord?.plan === 'pro' ? 'pro' : 'free';
    limit = PLAN_LIMITS[plan];
    usage = await loadUsage(redis, email.toLowerCase());

    if (usage.tokens >= limit) {
      res.status(403).json({
        error: `You've used all of your ${plan === 'pro' ? 'Pro' : 'Free'} plan's usage for this month (${limit.toLocaleString()} tokens). ${plan === 'pro' ? 'It resets next month.' : 'Upgrade to Pro for a lot more headroom, or check back next month.'}`,
      });
      return;
    }
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream API error.' });
      return;
    }

    const text = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    const responsePayload = { text: text || '(No text content returned.)' };

    if (trackUsage) {
      const turnTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      const newTokens = usage.tokens + turnTokens;
      const percent = Math.min(1, newTokens / limit);
      const key = 'usage:' + email.toLowerCase();

      const shouldAlert = !usage.alerted && percent >= HEAVY_USAGE_THRESHOLD;
      await redis.set(key, {
        tokens: newTokens,
        period: usage.period,
        alerted: usage.alerted || shouldAlert,
      });

      if (shouldAlert) {
        await sendAdminEmail(
          'Heavy usage alert',
          `${email} has used ${Math.round(percent * 100)}% of their ${plan} plan (${newTokens.toLocaleString()} / ${limit.toLocaleString()} tokens) this month.`
        );
      }

      responsePayload.usage = { used: newTokens, limit, percent: Math.round(percent * 100) };
    }

    res.status(200).json(responsePayload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach the model API: ' + err.message });
  }
};
