function createAccountAccess({ verify, readGrant, owners = () => [], now = Date.now }) {
  async function entitlement(uid) {
    if (owners().includes(uid)) return { premium: true, role: 'owner', hasBillingCustomer: false };
    const grant = await readGrant(uid);
    const paidThrough = grant?.paidThrough instanceof Date ? grant.paidThrough.getTime() : Date.parse(grant?.paidThrough);
    const premium = grant?.status === 'active' && Number.isFinite(paidThrough) && paidThrough > now();
    return { premium, role: 'member', paidThrough: Number.isFinite(paidThrough) ? new Date(paidThrough).toISOString() : null,
      billingStatus: grant?.billingStatus || null, cancelAtPeriodEnd: Boolean(grant?.cancelAtPeriodEnd),
      hasBillingCustomer: Boolean(grant?.stripeCustomerId) };
  }
  async function authenticate(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const header = req.get('Authorization') || '';
    if (!/^Bearer [^\s]+$/.test(header)) return res.status(401).json({ message: 'Sign in to continue.' });
    try {
      const identity = await verify(header.slice(7));
      if (!identity?.uid || identity.email_verified !== true) return res.status(403).json({ message: 'Verify your email before accessing your account.' });
      req.account = { uid: identity.uid, email: identity.email }; next();
    } catch (error) {
      const invalidIdentity = ['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
        'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(error.code);
      if (!invalidIdentity) console.warn('Account verification service unavailable.');
      res.status(invalidIdentity ? 401 : 503).json({ message: invalidIdentity
        ? 'Your sign-in could not be verified. Please sign in again.'
        : error.code === 'auth/configuration-unavailable' ? 'Account sign-in is not configured yet.'
        : 'Account verification is temporarily unavailable. Please try Refresh access shortly.' });
    }
  }
  function gate(ownerOnly = false) {
    return (req,res,next) => authenticate(req,res,async () => {
      try {
        const access = await entitlement(req.account.uid);
        if (!access.premium || (ownerOnly && access.role !== 'owner')) return res.status(403).json({ message: 'Active Trendline Insight Pro access is required.' });
        req.access = access; next();
      } catch { res.status(503).json({ message: 'Access could not be verified. Please retry.' }); }
    });
  }
  return { authenticate, entitlement, requirePremium: gate(), requireOwner: gate(true) };
}
module.exports = { createAccountAccess };
