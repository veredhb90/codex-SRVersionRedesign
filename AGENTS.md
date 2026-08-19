# SwingRush — Project Instructions

SwingRush is a social trading network (live at swing-rush.com) where traders share stock calls (BUY/SELL with TP/SL), follow each other, and get AI-powered analysis. Built and owned by Ward. Communicate in the language Ward uses (he mixes Hebrew and English).

## Stack & Infrastructure

- **Backend**: Node.js / Express / MongoDB (Mongoose) / Socket.io — entry point `backend/server.js`, runs on port 5000
- **Frontend**: Vanilla JS + HTML (no framework) in `frontend/`
- **Local dev**: `npm run dev` (nodemon — auto-restarts on backend changes). Local MongoDB.
- **This repo**: pushes only to private GitHub repo `veredhb90/openai_model_swingrush_app`. Never add or push to the old `swingrush-app` or `codex-SRVersionRedesign` remotes from this working directory.
- **Production**: swing-rush.com currently deploys from `veredhb90/codex-SRVersionRedesign/main`, not from this repository. A push from this working directory must target only `openai_model_swingrush_app` and does not deploy production unless that external Railway configuration is changed later.
- **Secrets**: ALL API keys live in `.env` (gitignored — NEVER commit it, NEVER print its values into committed files). Services used: Finnhub (news), Resend (email), OpenAI API (chat + news analysis), Yahoo Finance (prices/candles, no key needed).
- ⚠️ **CRITICAL**: local and Railway currently share the SAME Finnhub API key → shared 60 req/min quota. Heavy local testing can rate-limit the LIVE site. A separate dev Finnhub account is planned but not done yet. Be conservative with Finnhub calls during testing.

## Key Files Map

- `backend/routes/chat.js` — AI chat (tool-use architecture, system prompt, tools)
- `backend/routes/recommendations.js` — calls/recs CRUD, `checkOutcome` (TP/SL detection + notifications), likes, comments, engine-save
- `backend/routes/users.js` — follow/unfollow + follow notifications
- `backend/routes/proEngine.js` — Pro Engine API endpoint
- `backend/services/proEngine.js` — technical scoring, `getQuote` (pre/after-market dual pricing), `getCandles(symbol, days, interval)`
- `backend/services/openaiResponses.js` — shared raw OpenAI Responses API client and output parser
- `backend/services/openaiNewsAnalysis.js` — OpenAI GPT-5.6 news analysis (freshness-aware cache, 30-minute default)
- `backend/services/proReportService.js` + `backend/models/ProReport.js` — canonical Pro calculation and immutable timestamped report history shared by Pro Engine and chat
- `backend/services/symbolExtraction.js` — ticker/company-name extraction guarded by the scanner universe to prevent ordinary prose from becoming false symbols
- `backend/services/stockScanner.js` — scanner over a 2000-stock pool (`backend/data/usUniverse2000.js`), each run covers 500 (300 fixed core biggest-cap + 200 randomly rotated from the remaining tail), auto-runs every 6h on trading (week)days via setInterval
- `backend/services/emailService.js` — all Resend email templates
- `backend/server.js` — `io.notifyUser(userId, event, data)` — saves notification to DB (including fromUser) AND emits socket. Callers must NOT also call Notification.create (that caused duplicate-notification bugs, already fixed).
- `frontend/js/chat.js` — chat UI, `loadPendingStockIntoChat` (engine→chat handoff)
- `frontend/js/engine.js` — Free Signal Engine (home page)
- `frontend/feed.html` — feed + notification bell/ring UI (inline scripts)

## The Three Data Sources — GET THIS RIGHT

Ward has been repeatedly frustrated by confusion between these. Before making ANY claim about how one works, READ ITS CODE FIRST.

1. **Free Signal Engine** (`frontend/js/engine.js` + backend) — home page. Technical analysis + keyword-based news scoring. Free users get exactly 1 analysis (users.canUseEngine).
2. **Pro Engine** (`backend/services/proEngine.js` + `openaiNewsAnalysis.js`) — Pro-only. 8 technical indicators (up to 14 pts) + REAL OpenAI GPT-5.6 news analysis (up to 10 pts) = combined score ±24. Includes live pre/after-market pricing, catalysts, risks, earnings dates. This is the HIGHEST-QUALITY source.
3. **Scanner** (`backend/services/stockScanner.js`) — pool of 2000 US stocks by market cap (`backend/data/usUniverse2000.js`, biggest-first). Each run scans 500: a fixed 300-stock core (always the biggest caps, pool index 0..299) + 200 randomly rotated from the remaining ~1700-stock tail, so mega-caps are never missing while the long tail still gets discovered over time. Auto-runs every 6h on weekdays (trading days), caches results in `ScanResult` (key:'latest'). CONFIRMED by reading the code (not guessed): it uses `getEngineRecommendation`/`getNewsSentiment` from `yahooFinance.js` — i.e. the SAME technical-indicator logic as the Free Signal Engine (Yahoo-only), plus Finnhub keyword-based news scoring (POSITIVE/NEGATIVE word lists + analyst recommendation split) — NOT Pro Engine, NOT OpenAI GPT-5.6 news analysis. Two-phase: Phase 1 scans the 500-stock run technically (Yahoo only); Phase 2 enriches only the top technical candidates with Finnhub news/analyst data (throttled — batches of 2 symbols / 16s, well under Finnhub's 60/min shared-with-production quota), then re-sorts by combined score.

## THE CORE PRINCIPLE (Ward has repeated this many times — non-negotiable)

Chat uses the model's own knowledge for stable concepts and reasoning, the Pro Engine for one-stock analysis, and the Scanner for breadth. Live prices, fresh news, SwingRush state, and private user facts must come from tools rather than model memory. When Pro Engine data and Scanner data conflict for the same symbol, Pro Engine wins. Never present scanner data as Pro Engine analysis.

## Current Chat Architecture

`backend/routes/chat.js` uses a real tool-use loop:
- `createOpenAIResponse(...)` in `openaiResponses.js` calls `gpt-5.6-terra` through `/v1/responses` for main chat, defaults to medium reasoning, uses `store:false`, and preserves encrypted reasoning items for manual tool-loop replay. Pro Engine news analysis explicitly uses `gpt-5.6-sol` with high effort.
- `OPENAI_TOOLS` includes OpenAI web search plus SwingRush functions for quotes, Pro Engine, charts, Scanner/filtering, market movers, user portfolio/aggregates/profile, open-position progress, community sentiment, and verified platform knowledge.
- `callOpenAI` replays every `response.output` item, executes function calls server-side, returns `{text, charts, reports}`, and allows at most five tool rounds plus three truncation continuations.
- Tool choice is automatic. The prompt requires tools for current/private facts but does not force them for stable knowledge questions.
- `${nameContext}` (user's first name) is injected at the top of the system prompt.
- For detected tickers, the latest saved Pro report is supplied as timestamped ambient context and rendered as a separate UI card. It never replaces a requested live Pro run and does not change the existing AI-news cache.

## OpenAI Configuration

- `OPENAI_API_KEY` is required for AI chat and Pro Engine news reasoning.
- `OPENAI_CHAT_MODEL` defaults to `gpt-5.6-terra`; `OPENAI_CHAT_REASONING_EFFORT` defaults to `medium`.
- `OPENAI_PRO_MODEL` defaults to `gpt-5.6-sol`; `OPENAI_PRO_REASONING_EFFORT` defaults to `high`.
- Legacy `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, and `OPENAI_NEWS_REASONING_EFFORT` remain fallback overrides.
- `OPENAI_NEWS_CACHE_MS` defaults to 30 minutes so Pro Engine news does not stay stale for hours.
- Do not add an OpenAI SDK dependency unless it creates a concrete benefit; the current integration deliberately uses Node's HTTPS client.

## Version 2.2 List (work on these when Ward says "let's work on version 2.2 updates")

1. **Welcome-message persistence**: greeting ("Hi Ward! I am SwingRush AI...") and "New chat started!" currently vanish on chat reopen because they're display-only. Design: TWO CHANNELS — persist them for DISPLAY on reopen, but they must NOT enter the conversation history OpenAI receives (wastes tokens, pollutes context). Currently saved to DB: real user↔OpenAI exchanges (backend chat.js session.messages.push) + Pro Engine summary (frontend chat.js API.saveChatMessage call). Not saved: greeting, "New chat started", paywall messages.
2. **Pro Engine share-to-profile**: Pro user shares a Pro Engine result to their own profile — PRIVATE (profileOnly:true), marked distinctly as `source:'pro_engine'` (needs adding to Recommendation schema enum — was built once then fully reverted by git checkout, so re-add), shows the shared date, and sends EMAIL when it closes TP/SL. Existing infra to reuse: Recommendation schema already has `source:'engine'` + `profileOnly`, `/engine-save` endpoint exists, profile.html has ENGINE SIGNALS box (`engine-box`, `profile-engine-recs`, `count-engine`), profile.js filters `r.source === 'engine'`. New route must be Pro-gated (`req.user.plan !== 'pro'` → 403). Needs a Share button in the Pro Engine popup.
3. **CRITICAL DEPENDENCY for #2 — checkOutcome gap**: `checkOutcome` is called from exactly ONE place (public feed GET in recommendations.js) whose query EXCLUDES `profileOnly:true`. So private/profile-only signals (including existing free-engine saves) NEVER get TP/SL checked or emailed. Fix: a periodic background job (pattern reference: setInterval in stockScanner.js ~line 306) that sweeps all open recs including profileOnly and calls the existing `checkOutcome` (do NOT rebuild the mechanism — just add the missing trigger). Should run more frequently than 2h.

## Other Known Issues / Pending

- Invalid symbol in Pro Engine search (e.g. typing "Intel" instead of "INTC") crashes with "Cannot read properties of null" — needs graceful "symbol not found" handling.
- Verify OpenAI actually uses the user's first name in replies (a `[NAME DEBUG]` console.log exists in chat.js but was never checked).
- Debug console.logs still in code, clean when stable: `[TOOL LOOP]`, `[STOCKDATA]`, `[SHOW_CHART DEBUG]`, `[NAME DEBUG]`.
- Mobile: reply-to-message in chat doesn't work.
- Free-user engine→chat welcome says "Loaded full Pro Engine analysis" (wrong — should say Free Signal Engine; free-engine data has no `technicalScore` field which also produces "undefined pts"). Ward said leave for now; detection idea: `stockData.technicalScore === undefined` → free engine.
- Clickable suggested questions INSIDE OpenAI's chat messages (e.g. "Analyze AAPL" rendered as tappable, sends as user message — same mechanism as `sr-sug` buttons).
- 4h chart timeframe (Yahoo doesn't support natively — aggregate 1h candles).
- `.env` has RESEND_API_KEY duplicated twice (harmless; clean up sometime).

## Working Conventions (Ward's rules)

- **Verify before you claim.** Read the actual code before describing behavior. Ward strongly dislikes guessing presented as fact.
- **Verify after you change.** After ANY backend edit: `node --check <file>`. After frontend JS edits: `node -e "new Function(require('fs').readFileSync('<file>','utf8'))"`. After HTML edits: check tag balance.
- **Test from the terminal** when possible (Ward's preference): curl with a real token, MongoDB count/inspect queries via `node -e`, checking server logs — real evidence over assumptions.
- **Cache-bust after frontend JS changes**: `V=$(date +%s); sed -i '' "s|chat.js?v=[0-9]*|chat.js?v=$V|g" frontend/feed.html frontend/index.html frontend/profile.html frontend/scanner.html` (same pattern for feed_v2.js in feed.html).
- **Git flow**: commit locally with descriptive messages. Push only to this repository's `origin` (`openai_model_swingrush_app`) when Ward approves; never push either old repository.
- **Never touch `.env`** beyond reading variable NAMES. Never commit secrets anywhere.
- Test users: wardhbisharat (Ward's main), evia90, wardtq, daved1990.
- When something goes wrong, give Ward an honest status report: what changed, what didn't, what's verified vs. assumed.

## Current Checkpoint — 2026-08-19

- Two-model chat upgrade implemented: Terra/medium for main chat; Sol/high for Pro Engine news reasoning.
- Completed Pro reports are stored in local MongoDB as immutable timestamped snapshots and attached to chat history/UI cards. A message that explicitly names a ticker/company briefly acknowledges the latest saved report when one exists, without forcing a trade recommendation. Never revive the previous ticker automatically for a new no-ticker message; that caused unrelated answers to include an old Pro report.
- Existing `OPENAI_NEWS_CACHE_MS` behavior is unchanged; saved reports are context/history, not a replacement cache for new Pro runs.
- Automated status: backend/frontend syntax clean, `npm test` passes 12/12, local Mongo synthetic round-trip passed.
- Live status: one NVDA Pro report completed on localhost and persisted with matching direction/score. The next session should finish human-style chat validation in English, Arabic, and Hebrew, visually inspect the report card, then decide whether to prepare production deployment.
- Local preview uses port `5001`, MongoDB `127.0.0.1:27018/swingrush`, dummy Resend, and disabled scanner/background jobs. Production has not been changed.
