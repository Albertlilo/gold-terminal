function createBillingService({ stripe, accessCollection, eventCollection, now = Date.now }) {
  async function recordEvent(event, status, error) {
    await eventCollection.updateOne({ _id: event.id }, { $set: {
      type: event.type, status, receivedAt: new Date(now()),
      ...(status === 'failed' ? { error: String(error || 'Processing failed').slice(0, 180) } : {}),
    } }, { upsert: true });
  }

  async function saveSubscription(subscription, fallbackUid) {
    const uid = subscription.metadata?.firebaseUid || subscription.metadata?.firebase_uid || fallbackUid;
    if (!uid) throw new Error('Subscription is missing its account reference');
    const paidThrough = Number(subscription.current_period_end);
    const accessUntil = Number.isFinite(paidThrough) ? new Date(paidThrough * 1000) : null;
    const active = subscription.status === 'active' && accessUntil && accessUntil.getTime() > now();
    await accessCollection.updateOne({ _id: uid }, { $set: {
      status: active ? 'active' : 'inactive',
      paidThrough: accessUntil,
      billingStatus: subscription.status || 'unknown',
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      stripeSubscriptionId: subscription.id,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      billingUpdatedAt: new Date(now()),
    } }, { upsert: true });
  }

  async function handleEvent(event) {
    const saved = await eventCollection.findOne({ _id: event.id });
    if (saved?.status === 'processed') return { duplicate: true };

    try {
      const object = event.data?.object || {};
      let subscriptionId;
      let fallbackUid;
      if (event.type === 'checkout.session.completed') {
        subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription?.id;
        fallbackUid = object.client_reference_id || object.metadata?.firebaseUid;
      } else if (event.type.startsWith('customer.subscription.')) {
        subscriptionId = object.id;
      } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
        subscriptionId = object.subscription || object.parent?.subscription_details?.subscription;
      }

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await saveSubscription(subscription, fallbackUid);
      }
      await recordEvent(event, 'processed');
      return { duplicate: false };
    } catch (error) {
      try { await recordEvent(event, 'failed', error.message); } catch { /* Stripe will retry the event. */ }
      throw error;
    }
  }

  return { handleEvent };
}

module.exports = { createBillingService };
