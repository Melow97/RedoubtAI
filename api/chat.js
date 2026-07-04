// Vercel serverless function: proxies chat requests to the Anthropic API.
// The API key lives only here, as a server-side environment variable —
// it never reaches the browser. Set ANTHROPIC_API_KEY in your Vercel
// project's Settings -> Environment Variables (see README for steps).

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT =
  "You are Redoubt, a security-focused AI copilot for a SOC/dev team. " +
  "Be concise and precise. Use the web_search tool only when the answer " +
  "depends on live or current information (scores, news, prices, today's " +
  "date-sensitive facts) — answer directly from your own knowledge otherwise.";

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

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Request body must include a non-empty "messages" array.' });
    return;
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

    res.status(200).json({ text: text || '(No text content returned.)' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach the model API: ' + err.message });
  }
};
