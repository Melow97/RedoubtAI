// Vercel serverless function: proxies chat requests to the Groq API
// (free-tier, OpenAI-compatible chat completions), and (when the caller
// includes an email) tracks token usage against a monthly plan limit in
// Redis. GROQ_API_KEY is a server-side environment variable only -- set
// it in Vercel's Settings -> Environment Variables. Never in git, never
// in chat.

const { Redis } = require('@upstash/redis');
const { sendAdminEmail } = require('./_lib/email');
const { isProOverride } = require('./_lib/plan');

// Model per selector tier. Foundation is available to everyone; Sentinel
// and Apex are Pro-only -- enforced server-side below, since the client's
// selection can't be trusted (anyone could edit localStorage and claim a
// tier they haven't paid for).
const MODEL_MAP = {
  standard: 'llama-3.1-8b-instant',
  sentinel: 'llama-3.3-70b-versatile',
  apex: 'deepseek-r1-distill-llama-70b',
};
// Apex is advertised for full website builds and complex fixes, which need
// real output budget -- 1024 tokens would truncate mid-file.
const MAX_TOKENS_MAP = { standard: 1024, sentinel: 2048, apex: 4096 };
const PRO_ONLY_MODELS = new Set(['sentinel', 'apex']);
// DeepSeek R1's raw output includes its <think>...</think> chain-of-thought
// ahead of the answer -- hide it so Apex responses look like every other
// model's instead of leaking reasoning traces into the chat.
const REASONING_MODELS = new Set(['apex']);

const SYSTEM_PROMPT =
  "You are Babylon AI, a security-focused AI copilot for a SOC/dev team. " +
  "Be concise and precise. Answer from your own knowledge, and say so " +
  "plainly if a question depends on live or current information (scores, " +
  "news, prices, today's date-sensitive facts) you can't verify.";

// Optional: only used when the client opts in via the "Web search" toggle
// in the + menu. TAVILY_API_KEY is a server-side environment variable --
// leaving it unset just makes web search silently unavailable, same as
// leaving RESEND_API_KEY unset skips admin emails.
async function fetchWebSearchContext(query) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey || !query) return null;
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const results = data.results || [];
    if (!results.length) return null;
    return results
      .map((r, i) => `${i + 1}. ${r.title} (${r.url})\n${r.content}`)
      .join('\n\n');
  } catch {
    return null;
  }
}

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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Server is missing GROQ_API_KEY. Set it in your hosting provider’s environment variables and redeploy.',
    });
    return;
  }

  const { messages, email, model, webSearch } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Request body must include a non-empty "messages" array.' });
    return;
  }

  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = hasRedis ? Redis.fromEnv() : null;
  const trackUsage = Boolean(redis && email);

  let plan = isProOverride(email) ? 'pro' : 'free';
  let usage = { tokens: 0, period: currentPeriod(), alerted: false };
  let limit = PLAN_LIMITS[plan];

  if (trackUsage) {
    if (plan !== 'pro') {
      const key = 'plan:' + email.toLowerCase();
      const planRecord = await redis.get(key);
      plan = planRecord?.plan === 'pro' ? 'pro' : 'free';
      limit = PLAN_LIMITS[plan];
    }
    usage = await loadUsage(redis, email.toLowerCase());

    if (usage.tokens >= limit) {
      res.status(403).json({
        error: `You've used all of your ${plan === 'pro' ? 'Pro' : 'Free'} plan's usage for this month (${limit.toLocaleString()} tokens). ${plan === 'pro' ? 'It resets next month.' : 'Upgrade to Pro for a lot more headroom, or check back next month.'}`,
      });
      return;
    }
  }

  const requestedModelKey = MODEL_MAP[model] ? model : 'standard';
  const modelKey = PRO_ONLY_MODELS.has(requestedModelKey) && plan !== 'pro' ? 'standard' : requestedModelKey;
  const resolvedModel = MODEL_MAP[modelKey];

  const chatMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];

  let webSearchUsed = false;
  if (webSearch) {
    const lastUserMessage = [...messages].reverse().find((msg) => msg.role !== 'assistant');
    const searchContext = await fetchWebSearchContext(lastUserMessage?.content);
    if (searchContext) {
      chatMessages.splice(1, 0, {
        role: 'system',
        content:
          "Live web search results for the user's latest message -- use them if " +
          "relevant, ignore them if not, and cite source URLs when you rely on one:\n\n" +
          searchContext,
      });
      webSearchUsed = true;
    }
  }

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: chatMessages,
        max_tokens: MAX_TOKENS_MAP[modelKey],
        ...(REASONING_MODELS.has(modelKey) ? { reasoning_format: 'hidden' } : {}),
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Upstream API error.' });
      return;
    }

    const text = data.choices?.[0]?.message?.content || '';

    const responsePayload = { text: text || '(No text content returned.)', model: modelKey };
    if (modelKey !== requestedModelKey) {
      responsePayload.downgraded = true;
    }
    if (webSearch) {
      responsePayload.webSearchUsed = webSearchUsed;
    }

    if (trackUsage) {
      const turnTokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
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
