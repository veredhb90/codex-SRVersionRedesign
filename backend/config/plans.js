// Single source of truth for Pro plan pricing/IDs — used by payments.js and the subscription sweeper.
const IS_LIVE = process.env.PAYPAL_MODE === 'live';
const SUFFIX  = IS_LIVE ? '_LIVE' : '_SANDBOX';

module.exports = {
  monthly: { id: process.env['PAYPAL_PLAN_MONTHLY' + SUFFIX], price: 75,  currency: 'USD', label: 'Monthly' },
  yearly:  { id: process.env['PAYPAL_PLAN_YEARLY' + SUFFIX],  price: 700, currency: 'USD', label: 'Yearly'  },
};
