# SwingRush

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/license-Private-lightgrey)

SwingRush is a bilingual trading intelligence network. It combines a community feed, transparent trade tracking, a market scanner, technical analysis, and an AI research desk in one responsive web application.

At the center of the product is an **always-on AI chat analyst**. It runs on Anthropic's Claude and works around the clock: pulling fresh news, earnings, and analyst reports in real time, and turning them into well-studied, plain-language guidance on a single stock, on a user's open positions, or on the market in general. The assistant is designed to reason first from its own knowledge, then reach for the platform's engines when live data adds value — and, for Pro users, to personalize its answers using the user's own trader profile and posted trades (see [AI Research Desk](#ai-research-desk)).

The product supports English and Arabic, including right-to-left layouts and Arabic AI chat responses. It is built as a single Node.js service that serves both the API and the frontend.

> Market data and AI output are informational only. They are not investment advice, a recommendation to buy or sell securities, or a guarantee of future performance.

## Product Purpose

SwingRush is designed to help users make more disciplined trading decisions, not to encourage oversized risk. Its tools bring price action, technical signals, market news, analyst context, and the broader market trend into one view so users can assess an opportunity with clearer context.

When the Pro Engine or Market Scanner identifies an actionable trade, the result includes a proposed entry, take-profit level, and stop-loss level based on the underlying analysis. The stop-loss is a risk-management reference intended to help users define downside before entering a trade; it cannot eliminate risk, and users remain responsible for their own position sizing and decisions.

## Product Capabilities

- **Trading network:** Publish trades, follow traders, like, comment, repost, and track activity in a live feed.
- **Trade lifecycle:** Open and close trades with entry, target, stop-loss, realized return, and profile-level performance statistics.
- **Profiles and leaderboard:** Review open and closed trades, overall return, win rate, and community performance rankings.
- **Signal Engine:** Run technical and market-context analysis for individual symbols.
- **Pro Engine and AI Desk:** Combine technical scoring, market news, Claude-powered research, and proposed entry, target, and stop-loss levels for subscribed users.
- **Market Scanner:** Review the latest cached, combined technical-and-news ranking, trade-plan levels, and market context across the configured stock universe.
- **Real-time experience:** Socket.IO notifications for social activity and trade events.
- **Bilingual interface:** English and Arabic UI, with RTL support and language-aware AI responses.

## AI Research Desk

The AI chat is the centerpiece of the Pro experience. It is not a thin wrapper around a single data source — it is a reasoning agent that decides, per question, which tool best answers it. Every answer follows a deliberate priority order:

1. **The assistant's own knowledge and judgment first.** For fundamentals, macro context, longer-term or general questions, it answers as a knowledgeable analyst would, without forcing engine data where it does not fit.
2. **The Pro Engine, for a specific symbol.** When a question is about a concrete short-to-medium-term trade, it pulls the Pro Engine's objective read — technical indicators plus real Claude-powered news analysis, live pre/after-market pricing, catalysts, risks, and earnings dates.
3. **The Market Scanner, for breadth.** For "what's moving" or market-wide questions, it draws on the latest ranked scan.

When the Pro Engine and Scanner disagree on the same symbol, the Pro Engine always wins. The Pro Engine's score, direction, and trade-plan levels are **objective and identical for every user** — they are computed from technicals and news, with no awareness of any individual's position.

**How it analyzes your profile and your trades.** Personalization is layered on top of that objective analysis, never baked into it:

- **Trader profile.** If a user has completed their profile — age, capital, trading style, experience, risk tolerance, and goals — the assistant uses it to tailor every recommendation: position sizing, risk levels, and trade ideas that fit that specific user. If the profile is empty, it gives its best general answer and gently notes that filling it in unlocks more personalized advice. This is why accurate, real inputs matter — vague or empty inputs only get generic guidance.
- **Your posted trades.** The assistant can look up the user's own open and closed positions — entry, take-profit, stop-loss, and WIN/LOSS/OPEN outcome — when it helps. Ask "how am I doing?" or "should I hold this?" and it reasons over what the user actually holds, with news, technicals, and risk specific to those positions.
- **Community positioning.** For symbols in the conversation, it can factor in live community sentiment — the share of SwingRush traders currently BUY vs SELL on that ticker.

Every response ends with the assistant's own combined recommendation: engine technicals plus its own knowledge, framed as guidance rather than a guarantee.

## Plans and Pricing

SwingRush is free to join, with a Pro subscription that unlocks the full AI research desk.

| | **Free** — $0, forever | **Pro** — $75 / month |
| --- | --- | --- |
| Social feed — share trades & track stats | ✅ | ✅ |
| Follow top traders + instant email alerts | ✅ | ✅ |
| Market Scanner — 500 stocks ranked per scan (300 fixed core + 200 rotating from a 2,000-stock universe) | Top signals view | Full access |
| Free Signal Engine analyses | 1 analysis | Unlimited |
| Win rate & performance tracking | ✅ | ✅ |
| **AI Pro Engine** (technical + real Claude AI news, live pre/after-market pricing, catalysts, risks) | ❌ | ✅ Unlimited, any stock |
| **AI Chat analyst** (24/7, web search, live pricing, community sentiment, earnings calendar) | ❌ | ✅ Unlimited |
| Personalized advice from your trader profile & trades | ❌ | ✅ |
| Upcoming earnings dates & suggested holding periods | ❌ | ✅ |
| Priority support | ❌ | ✅ |

Free users get a genuinely useful product — the full social network, performance tracking, the ranked scanner view, and a single Signal Engine analysis to sample the intelligence layer. Pro removes the caps and turns on the AI Pro Engine and the always-on AI chat analyst, including the profile- and trade-aware personalization described above. Pro checkout is currently arranged directly with the SwingRush team.

## Business Model

SwingRush is being developed as a commercial trading-intelligence product. Its revenue model combines Pro subscriptions for premium research tools with broker affiliate partnerships that introduce users to relevant broker services.

Affiliate relationships must be clearly disclosed wherever they appear. Broker partnerships do not change the platform's market analysis, scoring, or trade-plan levels, and users retain complete control over whether to use any promoted service.

## Scanner Lifecycle

The scanner is intentionally server-managed. Visitors never start a full-universe scan from the browser.

1. The server calculates technical signals for the configured universe.
2. It enriches those candidates with news and analyst context.
3. It ranks only the final combined score and stores the completed result in MongoDB.
4. The Scanner page reads that cached result immediately. During a background refresh, the last completed result remains available.

On weekdays, the server schedules an automatic refresh every six hours. Progress, the last successful refresh, and the next scheduled refresh are exposed in the Scanner UI. News enrichment checkpoints are persisted, allowing the scanner to resume after a server restart instead of redoing the complete technical phase.

## Technology

| Area | Implementation |
| --- | --- |
| Application server | Node.js, Express 4 |
| Database | MongoDB with Mongoose |
| Frontend | Vanilla HTML, CSS, and JavaScript |
| Realtime | Socket.IO |
| Authentication | JWT, bcrypt |
| AI research | Anthropic Claude API |
| Market and news data | Yahoo Finance endpoints, Finnhub |
| Transactional email | Resend |

## Repository Layout

```text
backend/
  config/          MongoDB connection configuration
  middleware/      Authentication and subscription guards
  models/          MongoDB models for users, trades, notifications, and chat
  routes/          REST endpoints for auth, feed, scanner, chat, and admin
  services/        Market data, scoring, scanner, AI, and email services
  server.js        Express and Socket.IO entry point
frontend/
  css/             Application and redesign styles
  js/              API client, localization, feed, profile, chat, and engine UI
  *.html           Application pages
```

## Local Development

### Prerequisites

- Node.js 18 or later
- npm
- MongoDB Community Server, running locally or reachable over the network
- API keys for Anthropic and Finnhub for AI and news features
- A Resend API key for verification and notification emails

### 1. Clone and install

```bash
git clone https://github.com/veredhb90/codex-SRVersionRedesign.git
cd codex-SRVersionRedesign
npm install
```

### 2. Configure environment variables

Create your local environment file from the template:

```bash
cp .env.example .env
```

Set the values in `.env`. Do not commit this file.

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/swingrush
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5000

ANTHROPIC_API_KEY=your_anthropic_key
FINNHUB_API_KEY=your_finnhub_key
RESEND_API_KEY=your_resend_key
```

### 3. Start MongoDB

Use the URI in `MONGO_URI` as the source of truth. For example, if your local database is on port `27018` and its data directory is `$HOME/mongodb/data`:

```bash
mongod --dbpath "$HOME/mongodb/data" --port 27018 --bind_ip 127.0.0.1
```

Then set:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27018/swingrush
```

This connects to the existing database at that path; it does not erase or recreate its data. Use the exact data directory and port that belong to the MongoDB instance you want to preserve.

### 4. Start SwingRush

For development with automatic server reloads:

```bash
npm run dev
```

Nodemon watches `backend/**/*` only, so frontend edits take effect on the next page load without restarting the server or interrupting in-flight requests.

For a normal server process:

```bash
npm start
```

Open [http://localhost:5000](http://localhost:5000). The health endpoint is available at [http://localhost:5000/api/health](http://localhost:5000/api/health).

### Existing local MongoDB shortcut

`npm run dev:local` is a convenience script for this particular workstation. It starts the bundled MongoDB binary on port `27018` only when it is not already running, then launches Nodemon. It expects the existing data path configured in `package.json` and a local MongoDB distribution under `.local/`, which is intentionally excluded from Git.

Use `npm run dev` with a separately started MongoDB instance for a portable setup or on another machine.

## Configuration Reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP server port. Defaults to `5000`. |
| `MONGO_URI` | Yes | MongoDB connection string. Defaults to a local `swingrush` database on port `27017`. |
| `JWT_SECRET` | Yes | Secret used to sign authentication tokens. Use a long random value. |
| `CLIENT_URL` | Yes | Base URL included in email links. |
| `ANTHROPIC_API_KEY` | For AI features | Enables Claude-backed chat and Pro Engine news analysis. |
| `FINNHUB_API_KEY` | For news features | Enables news sentiment and analyst context. |
| `RESEND_API_KEY` | For email features | Enables verification and notification emails. |

The application can still load without every optional external-service key, but the corresponding AI, news, or email capability will not work correctly.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the Node.js server. |
| `npm run dev` | Start the server with Nodemon. |
| `npm run local` | Start the workstation-specific local MongoDB shortcut, then run the server. |
| `npm run dev:local` | Start the workstation-specific local MongoDB shortcut, then run Nodemon. |

## Operational Notes

- Scanner results are persisted in MongoDB. A completed result is cached for readers until the next scheduled scan replaces it.
- The scanner depends on external market-data services. Rate limits, vendor outages, and unavailable symbols can affect scan duration or coverage.
- MongoDB is the authoritative store for accounts, trades, social actions, notifications, chat history, and scanner results.
- `.env`, MongoDB data directories, `.local/`, logs, and dependencies are ignored by Git. Keep credentials and production data outside the repository.

## License

This is a private project. All rights reserved.
