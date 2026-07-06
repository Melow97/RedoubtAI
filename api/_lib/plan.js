// Lets you grant yourself (or anyone) Pro without a real Stripe payment --
// for testing, not exposed anywhere in the UI. Comma-separated emails in
// PRO_OVERRIDE_EMAILS always resolve to the Pro plan, bypassing Redis.
function isProOverride(email) {
  if (!email) return false;
  const overrides = (process.env.PRO_OVERRIDE_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return overrides.includes(email.toLowerCase());
}

module.exports = { isProOverride };
