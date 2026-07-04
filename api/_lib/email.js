// Shared helper: sends a notification email to the admin via Resend.
// RESEND_API_KEY and ADMIN_EMAIL are server-side environment variables --
// set them in Vercel's Settings -> Environment Variables. Never in git,
// never in chat.
//
// This is deliberately best-effort: a failed/unsent notification should
// never break the actual feature (a payment, a chat reply) that triggered
// it, so errors are logged, not thrown.

async function sendAdminEmail(subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Redoubt <onboarding@resend.dev>',
        to: adminEmail,
        subject,
        text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('Admin email failed:', resp.status, body);
    }
  } catch (err) {
    console.error('Admin email failed:', err.message);
  }
}

module.exports = { sendAdminEmail };
