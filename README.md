# SWINGRUSH

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white)
![Claude API](https://img.shields.io/badge/AI-Claude%20API-D97757)
![Railway](https://img.shields.io/badge/Deployed%20on-Railway-0B0D0E?logo=railway&logoColor=white)

A social trading network built around a live feed of real trade calls — traders post their BUY/SELL positions, follow each other, like and comment on calls, and build a public track record as their picks hit take-profit or stop-loss. Every call is backed by a three-tier AI-powered analysis engine and a Claude-based agentic assistant, giving the community real data behind every post.

**Live site:** [swing-rush.com](https://swing-rush.com)

---

## Overview

At its core, SwingRush is a social platform: users post trade calls to a public feed, follow other traders, like and comment on calls, and build a visible track record as their picks close as wins or losses — all with real-time notifications keeping the community connected.

Behind every call sits a three-tier AI-powered analysis engine (a free technical engine, a Pro engine powered by real Claude AI news analysis, and a background market scanner covering 682 stocks), plus an AI chat assistant ("SwingRush AI") built on Claude's **Tool Use** architecture: instead of forcing live data into every response, Claude decides for itself — based on the question — whether to pull a live stock analysis, show a chart, or scan the broader market, always starting from its own financial knowledge first. The community's own open calls also feed back into the assistant as live sentiment context, so Claude can factor in what traders on the platform are actually positioned on for a given stock.

---

## Features

- 📢 **Social feed** — post trade calls, like, comment, repost, follow other traders
- 🏆 **Win/loss tracking** — automatic outcome detection (TP/SL hit) with public performance stats
- 🔔 **Real-time notifications** — feed-ring + email alerts for follows, likes, comments, and TP/SL outcomes
- 📊 **Free Signal Engine** — one free technical + news-based stock analysis per user
- 🧠 **Pro Engine** — technical indicators + real Claude AI news analysis, live pre/after-market pricing, earnings dates
- 🔍 **Market Scanner** — background scan of 682 stocks, refreshed automatically
- 💬 **AI Chat (SwingRush AI)** — Claude-powered assistant with tool-use access to live analysis, charts, and market scans
- 📈 **Community sentiment** — the AI factors in the platform's own open trade calls as live market-view context, on top of live data and its own knowledge
- 🔐 **JWT authentication** with OTP email verification

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.io |
| Frontend | Vanilla JavaScript + HTML/CSS (no framework) |
| AI | Claude API (Anthropic) — Tool Use architecture |
| Auth | JWT |
| Email | Resend API |
| Market data | Yahoo Finance (unofficial endpoint) |
| News & analyst data | Finnhub API |
| Hosting | Railway (auto-deploy from `main`) |

A full technical architecture document (data flow, AI integration details, database schema, file dependency map) is available separately.

---

## Project Structure

```
backend/
├── server.js                    # Entry point — Express + Socket.io setup
├── routes/
│   ├── chat.js                  # AI chat — Claude tool-use loop
│   ├── recommendations.js       # Trade calls — CRUD, likes, comments, outcome checking
│   ├── users.js                 # Follow/unfollow, auth-related user actions
│   ├── scanner.js               # Market scanner API
│   ├── proEngine.js             # Pro Engine API
│   └── auth.js                  # Login, registration, OTP
├── services/
│   ├── proEngine.js             # Technical scoring + live pricing (Yahoo Finance)
│   ├── claudeNewsAnalysis.js    # AI-powered news analysis (Finnhub + Claude)
│   ├── yahooFinance.js          # Free-tier technical + keyword-based news engine
│   ├── stockScanner.js          # Background 682-stock scan
│   └── emailService.js          # Transactional emails (Resend)
└── models/
    ├── User.js
    ├── Recommendation.js
    ├── Notification.js
    ├── ChatSession.js
    └── ScanResult.js

frontend/
├── index.html                   # Home page — free engine, registration
├── feed.html                    # Social feed, notifications, chat
├── profile.html                 # User profile, trade history
├── scanner.html                 # Market scanner results
└── js/
    ├── api.js                   # Central API client (used by every page)
    ├── auth.js                  # JWT/session management (used by every page)
    ├── chat.js                  # AI chat UI
    ├── engine.js                # Free Signal Engine UI
    ├── feed_v2.js                # Feed rendering, likes/comments
    ├── profile.js                # Profile page rendering
    └── paywall.js                # Upgrade/registration modals
```

---

## How the AI Chat Works

The chat assistant is given three tools and decides on its own when (if ever) to use them:

| Tool | Purpose |
|---|---|
| `get_stock_analysis` | Runs the Pro Engine on one symbol — technical score + real AI news analysis |
| `show_chart` | Displays a candlestick chart (daily or hourly) inline in the chat |
| `get_market_scan` | Returns the latest cached results from the 682-stock background scan |

**Priority order, enforced in the system prompt:** Claude's own financial knowledge always comes first → the Pro Engine (highest-quality live data, real AI news analysis) → the market scanner (broad, technical-only, used for market-wide questions). When the same symbol appears in both a Pro Engine result and a scan result, the Pro Engine number always wins.

Separately from the three tools, the assistant also receives lightweight **community sentiment context**: open trade calls posted by users for a mentioned symbol, so it can reflect what the SwingRush community is actually positioned on, alongside live data and its own analysis.

---

## Getting Started (Local Development)

### Prerequisites
- Node.js
- MongoDB running locally
- API keys: Anthropic, Finnhub, Resend

### Setup

```bash
git clone https://github.com/veredhb90/swingrush-app.git
cd swingrush-app
npm install
```

Create a `.env` file in the project root:

```
MONGO_URI=mongodb://localhost:27017/swingrush
ANTHROPIC_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
RESEND_API_KEY=your_key_here
JWT_SECRET=your_secret_here
CLIENT_URL=http://localhost:5000
```

Start MongoDB locally, then run:

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

---

## Deployment

The `main` branch is connected to [Railway](https://railway.app) for automatic deployment. Every push to `main` triggers a rebuild and redeploy of the live site (~2-3 minutes), with a separate MongoDB Atlas instance used in production.

---

## License

Private project — all rights reserved.
