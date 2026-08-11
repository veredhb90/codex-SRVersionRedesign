// Single source of truth for Pro plan pricing/IDs — used by payments.js and the subscription sweeper.
module.exports = {
  monthly: { id: process.env.PAYPAL_PLAN_MONTHLY, price: 75,  currency: 'USD', label: 'Monthly' },
  yearly:  { id: process.env.PAYPAL_PLAN_YEARLY,  price: 700, currency: 'USD', label: 'Yearly'  },
};
