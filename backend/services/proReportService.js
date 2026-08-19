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
    latestEarningsReport: news.latestEarningsReport || null,
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
  const [technical, newsAnalysis] = await Promise.all([
    getProTechnicalScore(sym),
    getOpenAINewsAnalysis(sym),
  ]);
  const report = combineProAnalysis(sym, technical, newsAnalysis, generatedAt);
  if (report.insufficientData) return report;
  try {
    return await persistReport(report);
  } catch (error) {
    console.log('Pro report persistence error:', error.message);
    return { ...report, reportId: '', freshUntil: report.generatedAt, isStale: true };
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
  generateProReport,
  getLatestProReports,
  toReportSnapshot,
};
