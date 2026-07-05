// Shared helper: sends a notification email to the admin via SendGrid.
// SENDGRID_API_KEY and ADMIN_EMAIL are server-side environment variables --
// set them in Vercel's Settings -> Environment Variables. Never in git,
// never in chat.
//
// This is deliberately best-effort: a failed/unsent notification should
// never break the actual feature (a payment, a chat reply) that triggered
// it, so errors are logged, not thrown.

const sgMail = require('@sendgrid/mail');

async function sendAdminEmail(subject, text, adminEmailOverride) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const adminEmail = adminEmailOverride || process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  try {
    sgMail.setApiKey(apiKey);
    await sgMail.send({
      to: adminEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
      subject,
      text,
    });
  } catch (err) {
    console.error('Admin email failed:', err.response?.body || err.message);
  }
}

module.exports = { sendAdminEmail };
