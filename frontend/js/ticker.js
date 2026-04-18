// ── Live Ticker Tape ───────────────────────────────────────────────
// Finnhub symbols for stocks + commodities
const TICKER_SYMBOLS = [
  // Stocks
  'AAPL','MSFT','NVDA','TSLA','AMZN','GOOGL','META','NFLX','AMD','JPM','GS','INTC','BABA','COIN',
  // ETFs
  'SPY','QQQ','DIA','IWM',
  // Commodities via Finnhub (use these exact symbols)
  'OANDA:XAU_USD',  // Gold
  'OANDA:XAG_USD',  // Silver
  'OANDA:BCO_USD',  // Brent Oil
  'OANDA:NATGAS_USD', // Natural Gas
  'OANDA:XPT_USD',  // Platinum
];

// Display names for commodity symbols
const DISPLAY_NAMES = {
  'OANDA:XAU_USD':    'GOLD',
  'OANDA:XAG_USD':    'SILVER',
  'OANDA:BCO_USD':    'OIL',
  'OANDA:NATGAS_USD': 'NAT.GAS',
  'OANDA:XPT_USD':    'PLATINUM',
};

async function loadTicker() {
  const inner = document.getElementById('ticker-inner');
  if (!inner) return;

  const results = await Promise.allSettled(TICKER_SYMBOLS.map(s => API.quote(s)));
  const items   = results
    .map((r, i) => ({ result: r, sym: TICKER_SYMBOLS[i] }))
    .filter(x => x.result.status === 'fulfilled' && x.result.value.price)
    .map(x => ({ ...x.result.value, displayName: DISPLAY_NAMES[x.sym] || x.result.value.symbol }));

  if (!items.length) return;

  // Triplicate for seamless infinite scroll
  const html = [...items, ...items, ...items].map(q => {
    const up  = (q.changePct || 0) >= 0;
    const arr = up ? '▲' : '▼';
    const cls = up ? 'up' : 'down';
    const pct = Math.abs(q.changePct || 0).toFixed(2);
    const px  = q.price >= 100
      ? q.price.toFixed(2)
      : q.price.toFixed(4);
    return `<span class="ticker-item">
      <span class="sym">${q.displayName}</span>
      <span>$${px}</span>
      <span class="${cls}">${arr}${pct}%</span>
    </span>`;
  }).join('');

  inner.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', loadTicker);
setInterval(loadTicker, 60000);
