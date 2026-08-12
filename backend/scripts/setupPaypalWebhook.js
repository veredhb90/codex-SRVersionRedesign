// One-time setup: registers the SwingRush production webhook with PayPal,
// then prints the Webhook ID to paste into .env.
// Run with: PAYPAL_MODE=live node backend/scripts/setupPaypalWebhook.js
require('dotenv').config();
const { paypalRequest, IS_LIVE } = require('../services/paypal');

const SUFFIX = IS_LIVE ? '_LIVE' : '_SANDBOX';
// Always the real production domain — local CLIENT_URL (localhost) can't receive PayPal webhooks anyway.
const WEBHOOK_URL = 'https://swing-rush.com/api/payments/webhook';

async function main() {
  console.log(`Running against PAYPAL_MODE=${IS_LIVE ? 'live' : 'sandbox'}`);
  console.log('Webhook URL:', WEBHOOK_URL, '\n');

  const webhook = await paypalRequest('/v1/notifications/webhooks', {
    method: 'POST',
    body: {
      url: WEBHOOK_URL,
      event_types: [
        { name: 'PAYMENT.SALE.COMPLETED' },
        { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
        { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
        { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
        { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
      ],
    },
  });
  console.log('Webhook created:', webhook.id);
  console.log('\nAdd this to .env:');
  console.log(`PAYPAL_WEBHOOK_ID${SUFFIX}=${webhook.id}`);
}

main().catch(err => {
  console.error('Webhook setup failed:', err.details || err.message);
  process.exit(1);
});
