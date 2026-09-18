const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const paymentHtml = fs.readFileSync(path.join(root, 'frontend/payment.html'), 'utf8');
const paywallJs = fs.readFileSync(path.join(root, 'frontend/js/paywall.js'), 'utf8');
const redesignCss = fs.readFileSync(path.join(root, 'frontend/css/redesign.css'), 'utf8');

test('payment page never leaves an empty checkout area while PayPal loads or fails', () => {
  assert.match(paymentHtml, /checkout-loading/);
  assert.match(paymentHtml, /checkoutUnavailable/);
  assert.match(paymentHtml, /checkoutConfigured/);
  assert.match(paymentHtml, /cfg\.clientId && plans\?\.monthly\?\.id && plans\?\.yearly\?\.id/);
  assert.match(paymentHtml, /showCheckoutFailure\(t\('payment\.checkout_unavailable'/);
});

test('Pro paywall CTA remains visible and scrollable on short viewports', () => {
  assert.match(paywallJs, /home\.continue_payment/);
  assert.match(redesignCss, /\.sr-paywall \{[^}]*overflow-y:auto/);
  assert.match(redesignCss, /\.sr-paywall-panel \{[^}]*max-height:calc\(100dvh - 36px\)[^}]*overflow-y:auto/);
  assert.match(redesignCss, /\.sr-pro-panel \.sr-paywall-main \{[^}]*background:var\(--gold\)/);
});
