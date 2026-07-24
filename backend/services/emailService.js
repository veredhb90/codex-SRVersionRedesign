const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = 'SwingRush <noreply@swing-rush.com>';

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

const sendWinAlert = async (to, username, symbol, returnPct) => {
  await resend.emails.send({
    from: FROM, to,
    subject: `🏆 Your $${symbol} call hit Take Profit! +${returnPct}%`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid #00e676;border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">🏆</div>
        <div style="font-size:28px;font-weight:900;color:#00e676;margin-bottom:8px;">TAKE PROFIT HIT!</div>
        <div style="font-size:20px;color:#fff;margin-bottom:4px;">$${symbol}</div>
        <div style="font-size:32px;font-weight:900;color:#00e676;">+${returnPct}%</div>
        <div style="color:#555;margin-top:16px;font-size:14px;">Great call, @${username}! Your recommendation closed as a WIN.</div>
      </div>
      <a href="${process.env.CLIENT_URL}/profile.html" style="display:block;margin-top:24px;padding:14px;background:#00e676;color:#000;text-align:center;border-radius:8px;font-weight:900;text-decoration:none;font-size:16px;">View My Profile →</a>
    </div>`,
  }).catch(e => console.error('Win alert error:', e));
};

const sendFollowerWinAlert = async (to, traderName, symbol, returnPct) => {
  await resend.emails.send({
    from: FROM, to,
    subject: `\ud83c\udfc6 ${traderName}'s $${symbol} call hit Take Profit! +${returnPct}%`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid #00e676;border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">\ud83c\udfc6</div>
        <div style="font-size:24px;font-weight:900;color:#00e676;margin-bottom:8px;">TAKE PROFIT HIT!</div>
        <div style="font-size:18px;color:#fff;margin-bottom:4px;">$${symbol}</div>
        <div style="font-size:32px;font-weight:900;color:#00e676;">+${returnPct}%</div>
        <div style="color:#555;margin-top:16px;font-size:14px;">${traderName}, a trader you follow, just closed a winning call!</div>
      </div>
      <a href="${process.env.CLIENT_URL}/feed.html" style="display:block;margin-top:24px;padding:14px;background:#00e676;color:#000;text-align:center;border-radius:8px;font-weight:900;text-decoration:none;font-size:16px;">View in Feed \u2192</a>
    </div>`,
  }).catch(e => console.error('Follower win alert error:', e));
};

const sendLossAlert = async (to, username, symbol, returnPct) => {
  await resend.emails.send({
    from: FROM, to,
    subject: `💸 Your $${symbol} call hit Stop Loss (${returnPct}%)`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid #ff1744;border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">💸</div>
        <div style="font-size:28px;font-weight:900;color:#ff1744;margin-bottom:8px;">STOP LOSS HIT</div>
        <div style="font-size:20px;color:#fff;margin-bottom:4px;">$${symbol}</div>
        <div style="font-size:32px;font-weight:900;color:#ff1744;">${returnPct}%</div>
        <div style="color:#555;margin-top:16px;font-size:14px;">Your $${symbol} call was closed at stop loss. Review your analysis to improve future calls.</div>
      </div>
      <a href="${process.env.CLIENT_URL}/profile.html" style="display:block;margin-top:24px;padding:14px;background:#ff1744;color:#fff;text-align:center;border-radius:8px;font-weight:900;text-decoration:none;font-size:16px;">View My Profile →</a>
    </div>`,
  }).catch(e => console.error('Loss alert error:', e));
};

const sendFollowerLossAlert = async (to, traderName, symbol, returnPct) => {
  await resend.emails.send({
    from: FROM, to,
    subject: `\ud83d\udcb8 ${traderName}'s $${symbol} call hit Stop Loss (${returnPct}%)`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid #ff1744;border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">\ud83d\udcb8</div>
        <div style="font-size:24px;font-weight:900;color:#ff1744;margin-bottom:8px;">STOP LOSS HIT</div>
        <div style="font-size:18px;color:#fff;margin-bottom:4px;">$${symbol}</div>
        <div style="font-size:32px;font-weight:900;color:#ff1744;">${returnPct}%</div>
        <div style="color:#555;margin-top:16px;font-size:14px;">${traderName}, a trader you follow, closed this call at stop loss.</div>
      </div>
      <a href="${process.env.CLIENT_URL}/feed.html" style="display:block;margin-top:24px;padding:14px;background:#ff1744;color:#fff;text-align:center;border-radius:8px;font-weight:900;text-decoration:none;font-size:16px;">View in Feed \u2192</a>
    </div>`,
  }).catch(e => console.error('Follower loss alert error:', e));
};

const sendAdminNewUser = async (user) => {
  const adminEmail = 'swingrush.admin@gmail.com';
  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `🎉 New user registered: @${user.username}`,
    html: `<div style="${baseStyle}">${logo}
      <div style="background:#111;border:2px solid #00e676;border-radius:12px;padding:20px;">
        <div style="font-size:20px;font-weight:900;color:#00e676;margin-bottom:16px;">New User Registered!</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#aaa;padding:6px 0;font-size:14px;">Full Name</td><td style="color:#fff;font-weight:700;font-size:14px;">${user.fullName}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0;font-size:14px;">Username</td><td style="color:#00e676;font-weight:700;font-size:14px;">@${user.username}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0;font-size:14px;">Email</td><td style="color:#fff;font-size:14px;">${user.email}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0;font-size:14px;">Phone</td><td style="color:#fff;font-size:14px;">${user.phone}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0;font-size:14px;">Joined</td><td style="color:#fff;font-size:14px;">${new Date().toLocaleString()}</td></tr>
        </table>
      </div>
    </div>`,
  }).catch(e => console.error('Admin notification error:', e));
};

const sendNewFollowerAlert = async (to, followerName, followerUsername) => {
  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: `👤 ${followerName} started following you on SwingRush!`,
    html: `<div style="${baseStyle}">${logo}
      <p style="font-size:18px;margin-bottom:8px;"><strong>${followerName}</strong> (@${followerUsername}) just started following you!</p>
      <p style="color:#aaa;font-size:14px;margin-bottom:24px;">Check out their profile and follow back to see their trade calls in your feed.</p>
      <a href="${process.env.CLIENT_URL || 'https://swing-rush.com'}/profile.html?username=${followerUsername}" style="display:inline-block;background:#00e676;color:#0a0f1e;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">View Profile</a>
    </div>`,
  });
  if (error) console.error('❌ New follower email error:', error);
};

module.exports = { sendOTP, sendPassword, sendFollowAlert, sendInstrumentAlert, sendWinAlert, sendLossAlert, sendFollowerWinAlert, sendFollowerLossAlert, sendAdminNewUser, sendNewFollowerAlert };
