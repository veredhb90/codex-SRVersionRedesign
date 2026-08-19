const ProReport = require('../models/ProReport');
const { getProTechnicalScore } = require('./proEngine');
const { getOpenAINewsAnalysis } = require('./openaiNewsAnalysis');

// Display/context freshness metadata only. It never controls whether a Pro
// run executes and does not alter the existing OPENAI_NEWS_CACHE_MS cache.
const DEFAULT_FRESH_MS = 10 * 60 * 1000;

const getConfidence = (absScore) => {
  if (absScore >= 17) return 'Very High';
  if (absScore >= 12) return 'High';
  if (absScore >= 8) return 'Medium';
  if (absScore >= 4) return 'Low';
  return 'Insufficient';
};

const combineProAnalysis = (symbol, technical, newsAnalysis, generatedAt = new Date()) => {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!technical || technical.insufficientData) {
    return {
      symbol: sym,
      insufficientData: true,
      message: 'Not enough price history for this symbol yet.',
      generatedAt: generatedAt.toISOString(),
    };
  }

  const news = newsAnalysis || {};
  const technicalScore = Number(technical.score || 0);
  const newsScore = Number(news.score || 0);
  const combinedScore = technicalScore + newsScore;
  const absScore = Math.abs(combinedScore);
  const hasSignal = absScore >= 4;
  const direction = !hasSignal ? 'NEUTRAL' : (combinedScore > 0 ? 'BUY' : 'SELL');
  const confidence = getConfidence(absScore);
  const tpMult = absScore >= 12 ? 4.5 : absScore >= 8 ? 3.5 : absScore >= 5 ? 2.5 : 2.0;
  const realAtr = technical.realAtr || (technical.price * 0.02);
  let takeProfit = null;
  let stopLoss = null;
  let riskReward = null;
  let tpPct = null;
  let slPct = null;

  if (direction !== 'NEUTRAL') {
    takeProfit = direction === 'BUY'
      ? +(technical.price + realAtr * tpMult).toFixed(2)
      : +(technical.price - realAtr * tpMult).toFixed(2);
    stopLoss = direction === 'BUY'
      ? +(technical.price - realAtr * 1.5).toFixed(2)
      : +(technical.price + realAtr * 1.5).toFixed(2);
    riskReward = +(Math.abs(takeProfit - technical.price) / Math.abs(stopLoss - technical.price)).toFixed(2);
    tpPct = +(((takeProfit - technical.price) / technical.price) * 100).toFixed(2);
    slPct = +(((stopLoss - technical.price) / technical.price) * 100).toFixed(2);
  }

  let targetUpsidePct = null;
  if (news.priceTarget?.mean && technical.price) {
    targetUpsidePct = +(((news.priceTarget.mean - technical.price) / technical.price) * 100).toFixed(2);
  }

  return {
    symbol: sym,
    name: technical.name || sym,
    price: technical.price,
    regularSessionPrice: technical.regularSessionPrice || technical.price,
    changePct: technical.changePct,
    marketState: technical.marketState || 'Regular Session',
    quoteTime: technical.priceTime ? new Date(technical.priceTime * 1000).toISOString() : null,
    score: combinedScore,
    direction,
    confidence,
    takeProfit,
    stopLoss,
    riskReward,
    tpPct,
    slPct,
    technicalScore,
    technicalSignals: technical.signals || [],
    technicalBreakdown: technical.breakdown || [],
    change1w: technical.change1w,
    change1m: technical.change1m,
    newsScore,
    newsLabel: news.label || 'Unavailable',
    newsSummary: news.summary || '',
    newsReasoning: news.reasoning || '',
    catalysts: news.catalysts || [],
    risks: news.risks || [],
    analystSummary: news.analystSummary || '',
    articleCount: news.articleCount || 0,
    priceTarget: news.priceTarget || null,
    targetUpsidePct,
    holdingPeriod: news.holdingPeriod || '',
    upcomingEarnings: news.upcomingEarnings || [],
    earningsHistory: news.earningsHistory || [],
    newsFromCache: Boolean(news.fromCache),
    newsAnalyzedAt: news.analyzedAt || null,
    priceHistory: technical.candles || [],
    news: [],
    generatedAt: generatedAt.toISOString(),
  };
};

const toReportSnapshot = (value) => {
  if (!value) return null;
  const report = value.report ? value.report : value;
  const snapshot = { ...report };
  delete snapshot.priceHistory;
  delete snapshot.news;
  snapshot.reportId = String(value._id || report.reportId || '');
  snapshot.generatedAt = new Date(value.generatedAt || report.generatedAt || Date.now()).toISOString();
  snapshot.freshUntil = new Date(value.freshUntil || report.freshUntil || snapshot.generatedAt).toISOString();
  snapshot.isStale = new Date(snapshot.freshUntil).getTime() < Date.now();
  return snapshot;
};

// Keep the historical comparison deliberately small. The UI needs the exact
// prior setup and its follow-up, not a second copy of the old news or chart.
const toReportHistorySummary = (value) => {
  const snapshot = toReportSnapshot(value);
  if (!snapshot) return null;
  return {
    reportId: snapshot.reportId,
    symbol: snapshot.symbol,
    generatedAt: snapshot.generatedAt,
    direction: snapshot.direction || 'NEUTRAL',
    score: Number(snapshot.score || 0),
    technicalScore: Number(snapshot.technicalScore || 0),
    newsScore: Number(snapshot.newsScore || 0),
    entryPrice: Number(snapshot.price || 0) || null,
    takeProfit: Number(snapshot.takeProfit || 0) || null,
    stopLoss: Number(snapshot.stopLoss || 0) || null,
  };
};

const roundPct = value => Number.isFinite(value) ? +value.toFixed(2) : null;

// Daily candles can prove that a prior TP/SL was crossed on a later session.
// We intentionally ignore the report-day candle because it includes trading
// from before the report was generated. If both levels occur in one later
// daily candle, their order is unknowable and we say so rather than guessing.
const evaluatePreviousReport = (previous, currentReport) => {
  if (!previous) return null;
  const currentPrice = Number(currentReport?.price || 0) || null;
  const entry = Number(previous.entryPrice || 0) || null;
  const target = Number(previous.takeProfit || 0) || null;
  const stop = Number(previous.stopLoss || 0) || null;
  const direction = previous.direction;
  const directional = direction === 'BUY' || direction === 'SELL';
  const rawMovePct = entry && currentPrice ? ((currentPrice - entry) / entry) * 100 : null;
  const performancePct = directional && rawMovePct != null
    ? roundPct(direction === 'SELL' ? -rawMovePct : rawMovePct)
    : null;
  const evaluated = {
    ...previous,
    currentPrice,
    performancePct,
    status: directional && target && stop ? 'OPEN' : 'NO_SIGNAL',
    statusAt: null,
  };
  if (!directional || !target || !stop) return evaluated;

  const reportTime = new Date(previous.generatedAt).getTime();
  const candles = (currentReport?.priceHistory || [])
    .filter(candle => Number(candle?.time) * 1000 > reportTime)
    .sort((a, b) => Number(a.time) - Number(b.time));

  for (const candle of candles) {
    const high = Number(candle.high);
    const low = Number(candle.low);
    const targetHit = direction === 'BUY' ? high >= target : low <= target;
    const stopHit = direction === 'BUY' ? low <= stop : high >= stop;
    if (!targetHit && !stopHit) continue;
    evaluated.status = targetHit && stopHit ? 'AMBIGUOUS' : targetHit ? 'TARGET_HIT' : 'STOP_HIT';
    evaluated.statusAt = new Date(Number(candle.time) * 1000).toISOString();
    return evaluated;
  }

  if (currentPrice != null) {
    const currentlyAtTarget = direction === 'BUY' ? currentPrice >= target : currentPrice <= target;
    const currentlyAtStop = direction === 'BUY' ? currentPrice <= stop : currentPrice >= stop;
    if (currentlyAtTarget) evaluated.status = 'CURRENTLY_AT_TARGET';
    else if (currentlyAtStop) evaluated.status = 'CURRENTLY_AT_STOP';
  }
  return evaluated;
};

const persistReport = async (report) => {
  const freshMs = Math.max(60_000, Number(process.env.PRO_REPORT_FRESH_MS) || DEFAULT_FRESH_MS);
  const generatedAt = new Date(report.generatedAt || Date.now());
  const freshUntil = new Date(generatedAt.getTime() + freshMs);
  const doc = await ProReport.create({
    symbol: report.symbol,
    report: { ...report, freshUntil: freshUntil.toISOString() },
    generatedAt,
    freshUntil,
    model: process.env.OPENAI_PRO_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-sol',
  });
  return { ...report, reportId: String(doc._id), freshUntil: freshUntil.toISOString(), isStale: false };
};

const generateProReport = async (symbol) => {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) throw new Error('A stock ticker is required.');
  const generatedAt = new Date();
  const [technical, newsAnalysis, previousDoc] = await Promise.all([
    getProTechnicalScore(sym),
    getOpenAINewsAnalysis(sym),
    ProReport.findOne({ symbol: sym }).sort({ generatedAt: -1 }).lean().catch(error => {
      console.log('Previous Pro report lookup error:', error.message);
      return null;
    }),
  ]);
  const report = combineProAnalysis(sym, technical, newsAnalysis, generatedAt);
  const previousReport = evaluatePreviousReport(toReportHistorySummary(previousDoc), report);
  if (report.insufficientData) return { ...report, previousReport };
  try {
    const persisted = await persistReport(report);
    return { ...persisted, previousReport };
  } catch (error) {
    console.log('Pro report persistence error:', error.message);
    return { ...report, reportId: '', freshUntil: report.generatedAt, isStale: true, previousReport };
  }
};

const getLatestProReports = async (symbols) => {
  const unique = [...new Set((symbols || []).map(value => String(value).toUpperCase().trim()).filter(Boolean))];
  if (!unique.length) return [];
  try {
    const docs = await Promise.all(unique.map(symbol => ProReport.findOne({ symbol }).sort({ generatedAt: -1 }).lean()));
    return docs.filter(Boolean).map(toReportSnapshot);
  } catch (error) {
    console.log('Latest Pro reports lookup error:', error.message);
    return [];
  }
};

module.exports = {
  combineProAnalysis,
  evaluatePreviousReport,
  generateProReport,
  getLatestProReports,
  toReportHistorySummary,
  toReportSnapshot,
};
