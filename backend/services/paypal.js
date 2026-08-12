// PayPal REST API helper — OAuth2 client-credentials + generic request wrapper.
// Base URL switches on PAYPAL_MODE ('sandbox' | 'live').

const IS_LIVE  = process.env.PAYPAL_MODE === 'live';
const BASE_URL = IS_LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const CLIENT_ID     = IS_LIVE ? process.env.PAYPAL_CLIENT_ID_LIVE     : process.env.PAYPAL_CLIENT_ID_SANDBOX;
const CLIENT_SECRET = IS_LIVE ? process.env.PAYPAL_CLIENT_SECRET_LIVE : process.env.PAYPAL_CLIENT_SECRET_SANDBOX;

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);

  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
  return cachedToken;
}

async function paypalRequest(path, { method = 'GET', body, extraHeaders = {} } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data.message || `PayPal API error: ${res.status}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

module.exports = { BASE_URL, IS_LIVE, CLIENT_ID, getAccessToken, paypalRequest };
