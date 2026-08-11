# SwingRush — Project Instructions for Claude Code

SwingRush is a social trading network (live at swing-rush.com) where traders share stock calls (BUY/SELL with TP/SL), follow each other, and get AI-powered analysis. Built and owned by Ward. Communicate in the language Ward uses (he mixes Hebrew and English).

## Stack & Infrastructure

- **Backend**: Node.js / Express / MongoDB (Mongoose) / Socket.io — entry point `backend/server.js`, runs on port 5000
- **Frontend**: Vanilla JS + HTML (no framework) in `frontend/`
- **Local dev**: `npm run dev` (nodemon — auto-restarts on backend changes). Local MongoDB.
- **This repo**: pushes to GitHub `veredhb90/codex-SRVersionRedesign` (Private) — this is where `git push` should always go for this working directory.
- **Production**: swing-rush.com runs on Railway, deployed from **`veredhb90/codex-SRVersionRedesign`/`main`** (this repo's `origin`, ~2-3 min auto-deploy on push). Confirmed by Ward 2026-08-06 — the redesign cutover already happened; this is no longer "not yet connected." So `git push origin main` = live deploy, and it MUST have Ward's explicit approval first, every single time, no exceptions (see Working Conventions below). `veredhb90/swingrush-app` is the older, now-legacy repo — Railway is NOT connected to it, so pushing there does not affect production, but confirm with Ward before pushing there too since it's a shared remote.
- **Secrets**: ALL API keys live in `.env` (gitignored — NEVER commit it, NEVER print its values into committed files). Services used: Finnhub (news), Resend (email), Anthropic API (chat + news analysis), Yahoo Finance (prices/candles, no key needed).
- ⚠️ **CRITICAL**: local and Railway currently share the SAME Finnhub API key → shared 60 req/min quota. Heavy local testing can rate-limit the LIVE site. A separate dev Finnhub account is planned but not done yet. Be conservative with Finnhub calls during testing.

## Key Files Map

- `backend/routes/chat.js` — AI chat (tool-use architecture, system prompt, tools)
- `backend/routes/recommendations.js` — calls/recs CRUD, `checkOutcome` (TP/SL detection + notifications), likes, comments, engine-save
- `backend/routes/users.js` — follow/unfollow + follow notifications
- `backend/routes/proEngine.js` — Pro Engine API endpoint
- `backend/services/proEngine.js` — technical scoring, `getQuote` (pre/after-market dual pricing), `getCandles(symbol, days, interval)`
- `backend/services/claudeNewsAnalysis.js` — Claude AI news analysis (has 3h cache)
- `backend/services/stockScanner.js` — scanner over a 2000-stock pool (`backend/data/usUniverse2000.js`), each run covers 500 (300 fixed core biggest-cap + 200 randomly rotated from the remaining tail), auto-runs every 6h on trading (week)days via setInterval
- `backend/services/emailService.js` — all Resend email templates
- `backend/server.js` — `io.notifyUser(userId, event, data)` — saves notification to DB (including fromUser) AND emits socket. Callers must NOT also call Notification.create (that caused duplicate-notification bugs, already fixed).
- `frontend/js/chat.js` — chat UI, `loadPendingStockIntoChat` (engine→chat handoff)
- `frontend/js/engine.js` — Free Signal Engine (home page)
- `frontend/feed.html` — feed + notification bell/ring UI (inline scripts)

## The Three Data Sources — GET THIS RIGHT

Ward has been repeatedly frustrated by confusion between these. Before making ANY claim about how one works, READ ITS CODE FIRST.

1. **Free Signal Engine** (`frontend/js/engine.js` + backend) — home page. Technical analysis + keyword-based news scoring. Free users get exactly 1 analysis (users.canUseEngine).
2. **Pro Engine** (`backend/services/proEngine.js` + `claudeNewsAnalysis.js`) — Pro-only. 8 technical indicators (up to 14 pts) + REAL Claude AI news analysis (up to 10 pts) = combined score ±24. Includes live pre/after-market pricing, catalysts, risks, earnings dates. This is the HIGHEST-QUALITY source.
3. **Scanner** (`backend/services/stockScanner.js`) — pool of 2000 US stocks by market cap (`backend/data/usUniverse2000.js`, biggest-first). Each run scans 500: a fixed 300-stock core (always the biggest caps, pool index 0..299) + 200 randomly rotated from the remaining ~1700-stock tail, so mega-caps are never missing while the long tail still gets discovered over time. Auto-runs every 6h on weekdays (trading days), caches results in `ScanResult` (key:'latest'). CONFIRMED by reading the code (not guessed): it uses `getEngineRecommendation`/`getNewsSentiment` from `yahooFinance.js` — i.e. the SAME technical-indicator logic as the Free Signal Engine (Yahoo-only), plus Finnhub keyword-based news scoring (POSITIVE/NEGATIVE word lists + analyst recommendation split) — NOT Pro Engine, NOT Claude AI news analysis. Two-phase: Phase 1 scans the 500-stock run technically (Yahoo only); Phase 2 enriches only the top technical candidates with Finnhub news/analyst data (throttled — batches of 2 symbols / 16s, well under Finnhub's 60/min shared-with-production quota), then re-sorts by combined score.

## THE CORE PRINCIPLE (Ward has repeated this many times — non-negotiable)

Chat priority order: **(1) Claude's own knowledge and reasoning FIRST → (2) Pro Engine → (3) Scanner.**
The chat AI must understand how each engine works and use its own judgment about which tool to use for the best answer. When Pro Engine data and Scanner data conflict for the SAME symbol, Pro Engine ALWAYS wins. Never present scanner data as if it's Pro Engine analysis. Never use the phrase "Signal Engine" in chat responses (prompt rule 0.5).

## Current Chat Architecture (rebuilt recently)

`backend/routes/chat.js` uses a real tool-use loop:
- `callClaudeRaw(messages, systemPrompt, tools)` — single API call
- `CLAUDE_TOOLS`: `web_search`, `get_stock_analysis` (runs `runProEngineFor` → `formatProEngineText`), `get_market_scan` (runs `getMarketScanText`, breadth questions only), `show_chart` (accepts optional `timeframe`: '1d' default / '1h'; fetches candles via `getCandles` directly + `getProTechnicalScore` for real score/direction — deliberately NO Finnhub dependency so charts never fail on rate limits)
- `callClaude` — loop, MAX_ROUNDS=5, returns `{text, charts}`; `stockDataList = claudeResult.charts`
- Claude decides HIMSELF when to call tools, including the scanner (via `get_market_scan`) — nothing is always-injected into the system prompt anymore except community sentiment and trader profile context.
- `${nameContext}` (user's first name) is injected at the top of the system prompt.

## Immediate Task List — ✅ ALL DONE (completed 2026-07-25, not yet pushed)

1. ~~Read `stockScanner.js` fully~~ → done, accurate description now in "The Three Data Sources" section above.
2. ~~Fix show_chart placeholder bug~~ → `show_chart` in `chat.js` now also calls `getProTechnicalScore` (Yahoo-only) in parallel with `getCandles` to fill real score/direction instead of hardcoded `0`/`NEUTRAL`.
3. ~~Convert scanner to a third tool `get_market_scan`~~ → done. Scanner data is no longer always-injected into the system prompt; `CLAUDE_TOOLS` now has `get_market_scan`, and `getMarketScanText()` in `chat.js` builds the text on demand.
4. ~~Write explicit hierarchy into the system prompt~~ → done. System prompt rule 0 now spells out the 3-level hierarchy (own knowledge → get_stock_analysis/Pro Engine → get_market_scan/Scanner) with accurate engine descriptions and the "Pro Engine always wins per-symbol" rule.
5. ~~Fix scanner rate-limiting~~ → root cause was `getEngineRecommendation(symbol)` silently ignoring a `{skipNews:true}` second arg it never accepted, so Phase 1 hit Finnhub for all 682 stocks. Fixed: `getEngineRecommendation` now takes real `opts.skipNews`; Phase 1 is genuine Yahoo-only; Phase 2 (previously dead code) re-enabled to enrich only the top 120 technical candidates with Finnhub news, throttled to ~30 req/min (batches of 2 / 8s delay), leaving headroom under the 60/min quota shared with production. Full scan now takes ~8-12 min (was advertised as ~5-8 min but never actually completed).

⚠️ NOT YET VERIFIED LIVE: these changes were verified by `node --check` + careful code reading only — a real scan was deliberately NOT triggered locally to avoid burning the shared Finnhub quota. Next session: watch the first live scan (local or Railway logs) to confirm it completes all 682 stocks without rate-limit errors, and confirm `get_market_scan`/`get_stock_analysis`/`show_chart` all work correctly in a real chat session before considering this fully done.

## Version 2.2 List (work on these when Ward says "let's work on version 2.2 updates")

1. **Welcome-message persistence**: greeting ("Hi Ward! I am SwingRush AI...") and "New chat started!" currently vanish on chat reopen because they're display-only. Design: TWO CHANNELS — persist them for DISPLAY on reopen, but they must NOT enter the conversation history Claude receives (wastes tokens, pollutes context). Currently saved to DB: real user↔Claude exchanges (backend chat.js session.messages.push) + Pro Engine summary (frontend chat.js API.saveChatMessage call). Not saved: greeting, "New chat started", paywall messages.
2. **Pro Engine share-to-profile**: Pro user shares a Pro Engine result to their own profile — PRIVATE (profileOnly:true), marked distinctly as `source:'pro_engine'` (needs adding to Recommendation schema enum — was built once then fully reverted by git checkout, so re-add), shows the shared date, and sends EMAIL when it closes TP/SL. Existing infra to reuse: Recommendation schema already has `source:'engine'` + `profileOnly`, `/engine-save` endpoint exists, profile.html has ENGINE SIGNALS box (`engine-box`, `profile-engine-recs`, `count-engine`), profile.js filters `r.source === 'engine'`. New route must be Pro-gated (`req.user.plan !== 'pro'` → 403). Needs a Share button in the Pro Engine popup.
3. **CRITICAL DEPENDENCY for #2 — checkOutcome gap**: `checkOutcome` is called from exactly ONE place (public feed GET in recommendations.js) whose query EXCLUDES `profileOnly:true`. So private/profile-only signals (including existing free-engine saves) NEVER get TP/SL checked or emailed. Fix: a periodic background job (pattern reference: setInterval in stockScanner.js ~line 306) that sweeps all open recs including profileOnly and calls the existing `checkOutcome` (do NOT rebuild the mechanism — just add the missing trigger). Should run more frequently than 2h.

## Other Known Issues / Pending

- `claudeNewsAnalysis.js` 3h cache stores FAILURES too (a rate-limited "no news" response gets cached for 3h). Root cause of the INTC "no news" incident. Fix: only cache successful results.
- Invalid symbol in Pro Engine search (e.g. typing "Intel" instead of "INTC") crashes with "Cannot read properties of null" — needs graceful "symbol not found" handling.
- Verify Claude actually uses the user's first name in replies (a `[NAME DEBUG]` console.log exists in chat.js but was never checked).
- Debug console.logs still in code, clean when stable: `[TOOL LOOP]`, `[STOCKDATA]`, `[SHOW_CHART DEBUG]`, `[NAME DEBUG]`.
- Mobile: reply-to-message in chat doesn't work.
- Free-user engine→chat welcome says "Loaded full Pro Engine analysis" (wrong — should say Free Signal Engine; free-engine data has no `technicalScore` field which also produces "undefined pts"). Ward said leave for now; detection idea: `stockData.technicalScore === undefined` → free engine.
- Clickable suggested questions INSIDE Claude's chat messages (e.g. "Analyze AAPL" rendered as tappable, sends as user message — same mechanism as `sr-sug` buttons).
- 4h chart timeframe (Yahoo doesn't support natively — aggregate 1h candles).
- `.env` has RESEND_API_KEY duplicated twice (harmless; clean up sometime).

## Working Conventions (Ward's rules)

- **Verify before you claim.** Read the actual code before describing behavior. Ward strongly dislikes guessing presented as fact.
- **Verify after you change.** After ANY backend edit: `node --check <file>`. After frontend JS edits: `node -e "new Function(require('fs').readFileSync('<file>','utf8'))"`. After HTML edits: check tag balance.
- **Test from the terminal** when possible (Ward's preference): curl with a real token, MongoDB count/inspect queries via `node -e`, checking server logs — real evidence over assumptions.
- **Cache-bust after frontend JS changes**: `V=$(date +%s); sed -i '' "s|chat.js?v=[0-9]*|chat.js?v=$V|g" frontend/feed.html frontend/index.html frontend/profile.html frontend/scanner.html` (same pattern for feed_v2.js in feed.html).
- **Git flow**: commit locally with descriptive messages as checkpoints. **NEVER `git push` without Ward's explicit approval** — he tests locally first, then decides when to deploy. Push to `main` = live deploy on Railway — it MUST have Ward's approval first, every single time, no exceptions.
- **Never touch `.env`** beyond reading variable NAMES. Never commit secrets anywhere.
- Test users: wardhbisharat (Ward's main), evia90, wardtq, daved1990.
- When something goes wrong, give Ward an honest status report: what changed, what didn't, what's verified vs. assumed.
