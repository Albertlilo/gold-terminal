const express = require('express');
const Stripe = require('stripe');
const account = require('../services/accountRuntime');
const store = require('../services/candleStore');
const { createBillingService } = require('../services/billingService');

let stripeClient;
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Billing is not configured');
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}
function appOrigin() {
  const value = process.env.BILLING_APP_ORIGIN;
  if (!value) throw new Error('Billing return address is not configured');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('Billing return address must use HTTPS');
  }
  return url.origin;
}

const router = express.Router();

// Stripe must receive the original bytes to validate its signature. Mount before
// the app's general JSON parser.
router.post('/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.get('stripe-signature');
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Webhook is not configured.');
  let event;
  try { event = stripe().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).send('Invalid webhook signature.'); }
  try {
    const service = createBillingService({ stripe: stripe(), proPriceId: process.env.STRIPE_PRO_PRICE_ID,
      accessCollection: await store.getAccessCollection(), eventCollection: await store.getBillingEventsCollection() });
    await service.handleEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error.message);
    res.status(500).send('Webhook processing failed.');
  }
});

router.post('/checkout', account.authenticate, async (req, res) => {
  try {
    const origin = appOrigin();
    if (!process.env.STRIPE_PRO_PRICE_ID) throw new Error('Pro price is not configured');
    const [client, access, collection] = await Promise.all([
      Promise.resolve(stripe()), account.entitlement(req.account.uid), store.getAccessCollection(),
    ]);
    if (access.premium) return res.status(409).json({ message: 'Pro access is already active. Use Manage billing instead.' });
    const grant = await collection.findOne({ _id: req.account.uid });
    if (['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(grant?.billingStatus)) {
      return res.status(409).json({ message: 'A subscription already exists for this account. Use Manage billing or refresh access.' });
    }
    const price = await client.prices.retrieve(process.env.STRIPE_PRO_PRICE_ID);
    if (!price.active || price.currency !== 'gbp' || price.unit_amount !== 2500 || price.recurring?.interval !== 'month') {
      return res.status(503).json({ message: 'The configured Pro price must be an active £25/month GBP subscription.' });
    }
    const metadata = { firebaseUid: req.account.uid };
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      managed_payments: { enabled: true },
      line_items: [{ price: price.id, quantity: 1 }],
      ...(grant?.stripeCustomerId ? { customer: grant.stripeCustomerId } : { customer_email: req.account.email }),
      client_reference_id: req.account.uid,
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout could not be created:', error.message);
    res.status(503).json({ message: 'Checkout is not ready yet. Please try again later.' });
  }
});

router.post('/portal', account.authenticate, async (req, res) => {
  try {
    const origin = appOrigin();
    const grant = await (await store.getAccessCollection()).findOne({ _id: req.account.uid });
    if (!grant?.stripeCustomerId) return res.status(404).json({ message: 'No billing account is linked yet.' });
    const session = await stripe().billingPortal.sessions.create({ customer: grant.stripeCustomerId, return_url: origin });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe billing portal could not be created:', error.message);
    res.status(503).json({ message: 'Billing management is not ready yet. Please try again later.' });
  }
});

module.exports = router;
