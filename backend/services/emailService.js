const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = 'SwingRush <onboarding@resend.dev>';

const baseStyle = `font-family:'Segoe UI',Arial,sans-serif;background:#0a0f1e;color:#fff;padding:40px;border-radius:16px;max-width:520px;margin:auto;`;
const logo      = `<h1 style="color:#00e676;margin:0 0 4px;font-size:28px;letter-spacing:2px;">SWING<span style="color:#ff1744;">RUSH</span></h1><p style="color:#555;margin:0 0 32px;font-size:13px;">Financial Recommendation Network</p>`;

const sendOTP = async (to, code) => {
  console.log('📧 Sending OTP to:', to);
  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: '🔑 Your SwingRush Verification Code',
    html: `<div style="${baseStyle}">${logo}
      <p style="font-size:16px;margin-bottom:16px;">Your verification code:</p>
      <div style="font-size:52px;font-weight:900;letter-spacing:14px;color:#00e676;background:#111;padding:24px;border-radius:10px;text-align:center;font-family:monospace;">${code}</div>
      <p style="color:#555;margin-top:24px;font-size:13px;">Expires in 10 minutes. Do not share this code.</p>
    </div>`,
  });
  if (error) { console.error('❌ OTP error:', error); throw new Error(error.message); }
  console.log('✅ OTP sent to:', to);
};

const sendPassword = async (to, password) => {
  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: '✅ Welcome to SwingRush — Your Login Password',
    html: `<div style="${baseStyle}">${logo}
      <p style="font-size:16px;margin-bottom:16px;">Your account is verified! Here is your auto-generated password:</p>
      <div style="font-size:30px;font-weight:900;letter-spacing:6px;color:#00e676;background:#111;padding:20px;border-radius:10px;text-align:center;font-family:monospace;">${password}</div>
      <p style="color:#555;margin-top:24px;font-size:13px;">Login at <a href="${process.env.CLIENT_URL}/login.html" style="color:#00e676;">SwingRush</a></p>
    </div>`,
  });
  if (error) console.error('❌ Password email error:', error);
};

const sendFollowAlert = async (to, followerName, recSymbol, direction, takeProfit) => {
  const isBuy = direction === 'BUY';
  const color = isBuy ? '#00e676' : '#ff1744';
  const arrow = isBuy ? '▲' : '▼';
  await resend.emails.send({
    from: FROM, to,
    subject: `📡 ${followerName} just posted a ${direction} on $${recSymbol}`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid ${color};border-radius:12px;padding:20px;">
        <div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:8px;">$${recSymbol}</div>
        <div style="font-size:20px;font-weight:700;color:${color};">${arrow} ${direction}</div>
        <div style="color:#aaa;margin-top:8px;font-size:14px;">Take Profit: <strong style="color:${color};">$${takeProfit}</strong></div>
        <div style="color:#aaa;font-size:13px;margin-top:4px;">By <strong style="color:#fff;">${followerName}</strong></div>
      </div>
      <a href="${process.env.CLIENT_URL}/feed.html" style="display:block;margin-top:24px;padding:14px;background:${color};color:#000;text-align:center;border-radius:8px;font-weight:900;text-decoration:none;font-size:16px;">View in Feed →</a>
    </div>`,
  }).catch(e => console.error('Follow alert error:', e));
};

const sendInstrumentAlert = async (to, symbol, direction, username, tp) => {
  const isBuy = direction === 'BUY';
  const color = isBuy ? '#00e676' : '#ff1744';
  const arrow = isBuy ? '▲' : '▼';
  await resend.emails.send({
    from: FROM, to,
    subject: `🔔 New ${direction} signal on $${symbol}`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid ${color};border-radius:12px;padding:20px;">
        <div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:8px;">$${symbol}</div>
        <div style="font-size:20px;font-weight:700;color:${color};">${arrow} ${direction}</div>
        <div style="color:#aaa;margin-top:8px;font-size:14px;">TP: <strong style="color:${color};">$${tp}</strong></div>
        <div style="color:#aaa;font-size:13px;margin-top:4px;">By <strong style="color:#fff;">@${username}</strong></div>
      </div>
      <a href="${process.env.CLIENT_URL}/feed.html" style="display:block;margin-top:24px;padding:14px;background:${color};color:#000;text-align:center;border-radius:8px;font-weight:900;text-decoration:none;font-size:16px;">View in Feed →</a>
    </div>`,
  }).catch(e => console.error('Instrument alert error:', e));
};

module.exports = { sendOTP, sendPassword, sendFollowAlert, sendInstrumentAlert };
