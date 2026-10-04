const test = require('node:test');
const assert = require('node:assert/strict');
const { createBillingService } = require('../src/services/billingService');

function harness(subscription) {
  const grants = new Map(), events = new Map();
  const accessCollection = { async updateOne(filter, update) { grants.set(filter._id, { _id: filter._id, ...update.$set }); } };
  const eventCollection = {
    async findOne(filter) { return events.get(filter._id) || null; },
    async updateOne(filter, update) { events.set(filter._id, { _id: filter._id, ...update.$set }); },
  };
  const stripe = { subscriptions: { async retrieve() { return subscription; } } };
  const service = createBillingService({ stripe, accessCollection, eventCollection, now: () => 1_800_000_000_000 });
  return { service, grants, events };
}

test('only active, paid-through subscriptions unlock Pro', async () => {
  const { service, grants } = harness({ id: 'sub_1', status: 'active', current_period_end: 1_900_000_000,
    customer: 'cus_1', metadata: { firebaseUid: 'uid_1' }, cancel_at_period_end: true });
  await service.handleEvent({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } });
  assert.equal(grants.get('uid_1').status, 'active');
  assert.equal(grants.get('uid_1').cancelAtPeriodEnd, true);
  assert.equal(grants.get('uid_1').stripeCustomerId, 'cus_1');
});

test('past due and expired subscriptions do not grant Pro', async () => {
  const { service, grants } = harness({ id: 'sub_2', status: 'past_due', current_period_end: 1_900_000_000,
    customer: 'cus_2', metadata: { firebaseUid: 'uid_2' } });
  await service.handleEvent({ id: 'evt_2', type: 'customer.subscription.updated', data: { object: { id: 'sub_2' } } });
  assert.equal(grants.get('uid_2').status, 'inactive');
});

test('checkout completion maps the Firebase account and repeated webhook delivery is safe', async () => {
  const { service, grants, events } = harness({ id: 'sub_3', status: 'active', current_period_end: 1_900_000_000,
    customer: 'cus_3', metadata: {}, cancel_at_period_end: false });
  const event = { id: 'evt_3', type: 'checkout.session.completed', data: { object: {
    subscription: 'sub_3', client_reference_id: 'uid_3',
  } } };
  await service.handleEvent(event);
  await service.handleEvent(event);
  assert.equal(grants.get('uid_3').status, 'active');
  assert.equal(events.get('evt_3').status, 'processed');
});

test('a subscription without an account mapping fails closed for Stripe retry', async () => {
  const { service, events } = harness({ id: 'sub_4', status: 'active', current_period_end: 1_900_000_000,
    customer: 'cus_4', metadata: {} });
  await assert.rejects(service.handleEvent({ id: 'evt_4', type: 'customer.subscription.created',
    data: { object: { id: 'sub_4' } } }), /account reference/);
  assert.equal(events.get('evt_4').status, 'failed');
});
