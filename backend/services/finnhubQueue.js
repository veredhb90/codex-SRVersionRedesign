// ═══════════════════════════════════════════════════════════════════
// Shared Finnhub call queue — every Finnhub request in the app (Free
// Engine, Pro Engine, general news) routes through here so the combined
// rate never exceeds a safe ceiling, no matter how many users trigger
// calls at once. Finnhub's quota is shared with production (see
// CLAUDE.md).
//
// Token bucket, not strict serial spacing: up to BURST calls can fire
// concurrently right away (so a single Pro Engine request's 4 parallel
// Finnhub calls aren't artificially delayed), then tokens refill at
// 30/min — the same average ceiling already proven safe in
// stockScanner.js's Phase 2 throttle (4 calls per 8s batch).
// ═══════════════════════════════════════════════════════════════════

const RATE_PER_MIN = 30;
const BURST = 4;
const REFILL_MS = 60000 / RATE_PER_MIN; // ~2000ms per token

let tokens = BURST;
let lastRefill = Date.now();
let queue = [];
let timer = null;

const refill = () => {
  const now = Date.now();
  const gained = Math.floor((now - lastRefill) / REFILL_MS);
  if (gained > 0) {
    tokens = Math.min(BURST, tokens + gained);
    lastRefill += gained * REFILL_MS;
  }
};

const pump = () => {
  refill();
  while (tokens > 0 && queue.length) {
    tokens--;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject);
  }
  if (queue.length && !timer) {
    timer = setTimeout(() => { timer = null; pump(); }, REFILL_MS);
  }
};

// Queue a Finnhub call. `fn` must return a Promise. Resolves/rejects with
// fn's own result — callers don't need to change their error handling.
const enqueueFinnhubCall = (fn) => new Promise((resolve, reject) => {
  queue.push({ fn, resolve, reject });
  pump();
});

module.exports = { enqueueFinnhubCall };
