// ── Live Ticker Tape ───────────────────────────────────────────────
// Finnhub symbols for stocks + commodities
const TICKER_SYMBOLS = [
  // Stocks
  'AAPL','MSFT','NVDA','TSLA','AMZN','GOOGL','META','NFLX','AMD','JPM','GS','INTC','BABA','COIN',
  // ETFs
  'SPY','QQQ','DIA','IWM',
  // Commodities — routed through the backend's Yahoo Finance path (Finnhub
  // doesn't support these OANDA forex/commodity symbols on our plan, which
  // silently dropped all 5 from the ticker forever)
  'GOLD',
  'SILVER',
  'OIL',
  'NATGAS',
  'PLATINUM',
];

// Display names for commodity symbols
const DISPLAY_NAMES = {
  'GOLD':     'GOLD',
  'SILVER':   'SILVER',
  'OIL':      'OIL',
  'NATGAS':   'NAT.GAS',
  'PLATINUM': 'PLATINUM',
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
