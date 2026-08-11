// Periodic sweep: downgrades expired Pro users back to free, and emails a
// reminder 3 days before a subscription's paid-through date. PayPal renewals
// (the webhook) push subscriptionEnd further out before this ever fires for
// an active, auto-renewing subscription — this mainly catches cancelled or
// payment-failed subscriptions that are actually about to lapse.
const User = require('../models/User');
const PLANS = require('../config/plans');
const { sendRenewalReminder } = require('./emailService');

const REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS  = 6 * 60 * 60 * 1000; // every 6h, mirrors stockScanner.js cadence

async function sweepOnce() {
  const now = new Date();

  const { modifiedCount } = await User.updateMany(
    { plan: 'pro', subscriptionEnd: { $lt: now } },
    { $set: { plan: 'free' } }
  );
  if (modifiedCount) console.log(`⬇️  Downgraded ${modifiedCount} expired Pro user(s) to free`);

  const upcoming = await User.find({
    plan: 'pro',
    subscriptionEnd: { $gte: now, $lte: new Date(now.getTime() + REMINDER_WINDOW_MS) },
  }).select('email fullName billingCycle subscriptionEnd renewalReminderSentFor');

  for (const user of upcoming) {
    const already = user.renewalReminderSentFor &&
      user.renewalReminderSentFor.getTime() === user.subscriptionEnd.getTime();
    if (already) continue;

    const price = PLANS[user.billingCycle]?.price ?? PLANS.monthly.price;
    try {
      await sendRenewalReminder(user.email, user.fullName, user.billingCycle, user.subscriptionEnd, price);
      user.renewalReminderSentFor = user.subscriptionEnd;
      await user.save();
      console.log(`⏳ Renewal reminder sent to ${user.email}`);
    } catch (e) {
      console.error('Renewal reminder send failed for', user.email, e.message);
    }
  }
}

function startSubscriptionSweeper() {
  sweepOnce().catch(e => console.error('Subscription sweep error:', e.message));
  setInterval(() => sweepOnce().catch(e => console.error('Subscription sweep error:', e.message)), SWEEP_INTERVAL_MS);
}

module.exports = { startSubscriptionSweeper, sweepOnce };
