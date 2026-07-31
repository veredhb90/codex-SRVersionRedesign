// ═══════════════════════════════════════════════════════════════════
// Shared Finnhub call queue — every Finnhub request in the app (Free
// Engine, Pro Engine, general news) routes through here so the combined
// rate never exceeds a safe ceiling, no matter how many users trigger
// calls at once. Finnhub's quota is shared with production (see
// CLAUDE.md).
//
// Token bucket, not strict serial spacing: up to BURST calls can fire
// concurrently right away (so a single Pro Engine request's parallel
// Finnhub calls aren't artificially delayed), then tokens refill at
// RATE_PER_MIN.
//
// Two lanes, same shared budget: the scanner's background enrichment can
// have hundreds of calls queued at once, which would otherwise make an
// interactive user request (Pro Engine) wait behind all of them. Calls
// passed `{ priority: true }` (Pro Engine) are drained before normal-lane
// calls (scanner, ticker, live market widget), so a live user is never
// stuck behind background work.
//
// RATE_PER_MIN was originally 30 (half of Finnhub's real 60/min limit,
// leaving headroom for local dev sharing the same key). In production,
// the ticker + live market widget alone touch ~30 unique symbols that
// need refreshing every 30-60s from real concurrent users - at 30/min
// that refresh cycle takes a full 60s to drain, longer than the quote
// cache's own TTL, so the queue could never catch up and stayed
// permanently backlogged, starving interactive requests behind it even
// with priority. Raised to 50/min (still 10/min under the real ceiling)
// so background polling can actually finish a cycle before it goes
// stale again, instead of backlogging forever.
// ═══════════════════════════════════════════════════════════════════

const RATE_PER_MIN = 50;
const BURST = 8;
const REFILL_MS = 60000 / RATE_PER_MIN; // ~2000ms per token

let tokens = BURST;
let lastRefill = Date.now();
let priorityQueue = [];
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
  while (tokens > 0 && (priorityQueue.length || queue.length)) {
    tokens--;
    const { fn, resolve, reject } = priorityQueue.length ? priorityQueue.shift() : queue.shift();
    fn().then(resolve, reject);
  }
  if ((priorityQueue.length || queue.length) && !timer) {
    timer = setTimeout(() => { timer = null; pump(); }, REFILL_MS);
  }
};

// Queue a Finnhub call. `fn` must return a Promise. Resolves/rejects with
// fn's own result — callers don't need to change their error handling.
// Pass `{ priority: true }` for interactive, user-waiting calls (Pro Engine)
// so they skip ahead of background bulk work (scanner) in the same lane cap.
const enqueueFinnhubCall = (fn, opts = {}) => new Promise((resolve, reject) => {
  (opts.priority ? priorityQueue : queue).push({ fn, resolve, reject });
  pump();
});

module.exports = { enqueueFinnhubCall };
