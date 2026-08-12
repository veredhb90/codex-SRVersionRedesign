const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { paypalRequest, CLIENT_ID, IS_LIVE } = require('../services/paypal');
const WEBHOOK_ID = process.env['PAYPAL_WEBHOOK_ID' + (IS_LIVE ? '_LIVE' : '_SANDBOX')];
const User = require('../models/User');
const PaymentHistory = require('../models/PaymentHistory');
const PLANS = require('../config/plans');

function cycleFromPlanId(planId) {
  if (planId === PLANS.monthly.id) return 'monthly';
  if (planId === PLANS.yearly.id)  return 'yearly';
  return null;
}

function fallbackEnd(cycle) {
  const d = new Date();
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// Fetches the subscription from PayPal and, if active on a known plan,
// upgrades whichever user owns paypalSubscriptionId (or matches custom_id).
async function syncSubscription(subscriptionId) {
  const sub = await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}`);
  const cycle = cycleFromPlanId(sub.plan_id);
  if (!cycle) throw Object.assign(new Error('Unknown PayPal plan_id'), { status: 400 });

  const user = sub.custom_id
    ? await User.findById(sub.custom_id)
    : await User.findOne({ paypalSubscriptionId: subscriptionId });
  if (!user) throw Object.assign(new Error('No matching SwingRush user for this subscription'), { status: 404 });

  if (sub.status === 'ACTIVE') {
    const end = sub.billing_info?.next_billing_time
      ? new Date(sub.billing_info.next_billing_time)
      : fallbackEnd(cycle);
    user.plan = 'pro';
    user.subscriptionEnd = end;
    user.paypalSubscriptionId = subscriptionId;
    user.billingCycle = cycle;
    await user.save();
  }
  // CANCELLED / SUSPENDED / EXPIRED: no immediate downgrade — access lapses
  // naturally once subscriptionEnd passes (isPro() already checks the date).

  return { user, status: sub.status };
}

// Reconciles a PAYMENT.SALE.COMPLETED webhook event into PaymentHistory.
// The first charge for a subscription already has a pending 'activation' row
// (created at /confirm, no transaction id yet) — this enriches that same row
// with the real transaction id/amount instead of inserting a duplicate.
// Any charge after that is a genuine renewal and gets its own row.
async function recordCharge(event) {
  const resource = event.resource || {};
  const subId = resource.billing_agreement_id;
  const transactionId = resource.id;
  if (!subId || !transactionId) return;

  const dup = await PaymentHistory.findOne({ paypalTransactionId: transactionId });
  if (dup) return; // webhook redelivery — already recorded

  const amount = Number(resource.amount?.total);
  const currency = resource.amount?.currency || 'USD';
  const occurredAt = resource.create_time ? new Date(resource.create_time) : new Date();

  const pending = await PaymentHistory.findOne({
    paypalSubscriptionId: subId, type: 'activation', paypalTransactionId: null,
  });
  if (pending) {
    pending.paypalTransactionId = transactionId;
    if (Number.isFinite(amount)) pending.amount = amount;
    pending.currency = currency;
    pending.occurredAt = occurredAt;
    await pending.save();
    return;
  }

  const user = await User.findOne({ paypalSubscriptionId: subId });
  if (!user) return;
  const cycle = user.billingCycle || 'monthly';
  await PaymentHistory.create({
    user: user._id, paypalSubscriptionId: subId, paypalTransactionId: transactionId,
    type: 'renewal', billingCycle: cycle,
    amount: Number.isFinite(amount) ? amount : PLANS[cycle].price,
    currency, occurredAt,
  });
}

// ── GET /api/payments/config — public plan/pricing info for the payment page
router.get('/config', (req, res) => {
  res.json({ clientId: CLIENT_ID, plans: PLANS });
});

// ── POST /api/payments/confirm  { subscriptionID } — called right after
// PayPal's onApprove fires client-side, to activate Pro immediately instead
// of waiting on the webhook.
router.post('/confirm', protect, async (req, res) => {
  try {
    const { subscriptionID } = req.body;
    if (!subscriptionID) return res.status(400).json({ message: 'subscriptionID required' });

    const sub = await paypalRequest(`/v1/billing/subscriptions/${subscriptionID}`);
    if (sub.custom_id && sub.custom_id !== String(req.user._id)) {
      return res.status(403).json({ message: 'This subscription does not belong to your account' });
    }
    const existing = await User.findOne({ paypalSubscriptionId: subscriptionID });
    if (existing && String(existing._id) !== String(req.user._id)) {
      return res.status(409).json({ message: 'This subscription is already linked to another account' });
    }
    if (sub.status !== 'ACTIVE') {
      return res.status(202).json({ message: `Subscription status is ${sub.status}, not yet active`, status: sub.status });
    }

    const cycle = cycleFromPlanId(sub.plan_id);
    if (!cycle) return res.status(400).json({ message: 'Unrecognized plan' });

    const end = sub.billing_info?.next_billing_time
      ? new Date(sub.billing_info.next_billing_time)
      : fallbackEnd(cycle);

    req.user.plan = 'pro';
    req.user.subscriptionEnd = end;
    req.user.paypalSubscriptionId = subscriptionID;
    req.user.billingCycle = cycle;
    await req.user.save();

    // One 'activation' row per subscription, guarded so repeat /confirm calls
    // (page refresh, retry) don't create duplicates. The webhook enriches this
    // same row with the real transaction id once PAYMENT.SALE.COMPLETED arrives.
    const alreadyRecorded = await PaymentHistory.findOne({ paypalSubscriptionId: subscriptionID });
    if (!alreadyRecorded) {
      await PaymentHistory.create({
        user: req.user._id, paypalSubscriptionId: subscriptionID,
        type: 'activation', billingCycle: cycle,
        amount: PLANS[cycle].price, currency: PLANS[cycle].currency,
        occurredAt: new Date(),
      }).catch(e => console.error('PaymentHistory activation record error:', e.message));
    }

    res.json({ message: 'Pro activated', plan: 'pro', subscriptionEnd: end, billingCycle: cycle });
  } catch (err) {
    console.error('payments/confirm error:', err.details || err.message);
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ── POST /api/payments/webhook — PayPal event delivery (renewals, cancellations)
router.post('/webhook', async (req, res) => {
  try {
    if (!WEBHOOK_ID) {
      console.warn('PayPal webhook received but PAYPAL_WEBHOOK_ID is not configured for this mode — skipping');
      return res.status(200).end(); // ack so PayPal doesn't retry-storm us
    }

    const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo:         req.headers['paypal-auth-algo'],
        cert_url:          req.headers['paypal-cert-url'],
        transmission_id:   req.headers['paypal-transmission-id'],
        transmission_sig:  req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id:        WEBHOOK_ID,
        webhook_event:     req.body,
      },
    });
    if (verification.verification_status !== 'SUCCESS') {
      console.warn('PayPal webhook signature verification failed');
      return res.status(400).end();
    }

    const event = req.body;
    const subId = event.resource?.billing_agreement_id || event.resource?.id;
    const relevant = [
      'PAYMENT.SALE.COMPLETED',
      'BILLING.SUBSCRIPTION.ACTIVATED',
      'BILLING.SUBSCRIPTION.CANCELLED',
      'BILLING.SUBSCRIPTION.SUSPENDED',
      'BILLING.SUBSCRIPTION.EXPIRED',
    ];
    if (subId && relevant.includes(event.event_type)) {
      await syncSubscription(subId).catch(e => console.error('webhook syncSubscription error:', e.message));
    }
    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      await recordCharge(event).catch(e => console.error('webhook recordCharge error:', e.message));
    }

    res.status(200).end();
  } catch (err) {
    console.error('payments/webhook error:', err.details || err.message);
    res.status(500).end();
  }
});

module.exports = router;
module.exports.recordCharge = recordCharge; // exported for direct testing (sandbox webhooks can't reach localhost)
