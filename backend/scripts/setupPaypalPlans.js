// One-time setup: creates the "SwingRush Pro" PayPal product + monthly/yearly
// billing plans, then prints the plan IDs to paste into .env.
// Run with: node backend/scripts/setupPaypalPlans.js
require('dotenv').config();
const { paypalRequest } = require('../services/paypal');

async function main() {
  const product = await paypalRequest('/v1/catalogs/products', {
    method: 'POST',
    body: {
      name: 'SwingRush Pro',
      description: 'SwingRush Pro subscription — unlimited AI Signal Engine, Pro Engine, and AI chat.',
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
  });
  console.log('Product created:', product.id);

  const monthly = await paypalRequest('/v1/billing/plans', {
    method: 'POST',
    body: {
      product_id: product.id,
      name: 'SwingRush Pro — Monthly',
      description: 'SwingRush Pro, billed monthly',
      billing_cycles: [{
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // infinite
        pricing_scheme: { fixed_price: { value: '75.00', currency_code: 'USD' } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 2,
      },
    },
  });
  console.log('Monthly plan created:', monthly.id);

  const yearly = await paypalRequest('/v1/billing/plans', {
    method: 'POST',
    body: {
      product_id: product.id,
      name: 'SwingRush Pro — Yearly',
      description: 'SwingRush Pro, billed annually',
      billing_cycles: [{
        frequency: { interval_unit: 'YEAR', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // infinite
        pricing_scheme: { fixed_price: { value: '700.00', currency_code: 'USD' } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 2,
      },
    },
  });
  console.log('Yearly plan created:', yearly.id);

  console.log('\nAdd these to .env:');
  console.log(`PAYPAL_PRODUCT_ID=${product.id}`);
  console.log(`PAYPAL_PLAN_MONTHLY=${monthly.id}`);
  console.log(`PAYPAL_PLAN_YEARLY=${yearly.id}`);
}

main().catch(err => {
  console.error('Setup failed:', err.details || err.message);
  process.exit(1);
});
