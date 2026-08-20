// Structured company reports/events for both Pro Engine and AI chat.
// Finnhub supplies earnings calendar/history. SEC EDGAR is authoritative for
// filing/acceptance dates and links. This service has its own cache and does
// not alter the existing OpenAI news-analysis cache.

const https = require('https');
const { enqueueFinnhubCall } = require('./finnhubQueue');
const usUniverse2000 = require('../data/usUniverse2000');

const configuredTtl = Number(process.env.COMPANY_REPORTS_CACHE_MS);
const REPORTS_TTL = configuredTtl > 0 ? configuredTtl : 30 * 60 * 1000;
const UPCOMING_TTL = 6 * 60 * 60 * 1000;
const TICKER_MAP_TTL = 24 * 60 * 60 * 1000;
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'SwingRush/1.0 support@swing-rush.com';
const reportsCache = new Map();
const upcomingCache = new Map();
const secSubmissionsCache = new Map();
let tickerMapCache = { ts: 0, data: null, pending: null };

const fromCache = (cache, key, ttl) => {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.ts > ttl) {
    if (hit) cache.delete(key);
    return null;
  }
  return hit.data;
};
const toCache = (cache, key, data) => cache.set(key, { ts: Date.now(), data });

const requestJson = (url, headers = {}, redirectsLeft = 2) => new Promise((resolve, reject) => {
  const req = https.get(url, { timeout: 15000, headers }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
      res.resume();
      return requestJson(new URL(res.headers.location, url).toString(), headers, redirectsLeft - 1).then(resolve, reject);
    }
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { reject(error); }
    });
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('request timed out')));
});

const requestText = (url, headers = {}, redirectsLeft = 2) => new Promise((resolve, reject) => {
  const req = https.get(url, { timeout: 15000, headers }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
      res.resume();
      return requestText(new URL(res.headers.location, url).toString(), headers, redirectsLeft - 1).then(resolve, reject);
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.resume();
      return reject(new Error(`HTTP ${res.statusCode}`));
    }
    const chunks = [];
    let size = 0;
    res.on('data', chunk => {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) return req.destroy(new Error('SEC filing exceeded size limit'));
      chunks.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('request timed out')));
});

const dateOnly = value => {
  const text = String(value || '').trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

const mapEarningsEntry = entry => ({
  symbol: String(entry?.symbol || '').toUpperCase() || null,
  date: dateOnly(entry?.date),
  quarter: entry?.quarter ?? null,
  year: entry?.year ?? null,
  hour: entry?.hour === 'bmo' ? 'Before Market Open' : entry?.hour === 'amc' ? 'After Market Close' : 'Time TBD',
  epsEstimate: entry?.epsEstimate ?? null,
  epsActual: entry?.epsActual ?? null,
  revenueEstimate: entry?.revenueEstimate ?? null,
  revenueActual: entry?.revenueActual ?? null,
  scheduleStatus: entry?.hour === 'bmo' || entry?.hour === 'amc' ? 'Timing supplied by Finnhub' : 'Time TBD; date may be estimated',
  source: 'Finnhub earnings calendar',
});

const fetchEarningsCalendar = (symbol, fromDate, toDate) => new Promise(resolve => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const from = fromDate || new Date(now.getTime() - 200 * 86400000).toISOString().split('T')[0];
  const to = toDate || new Date(now.getTime() + 270 * 86400000).toISOString().split('T')[0];
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return resolve({ upcoming: [], latestReported: null, all: [] });
  const symbolParam = symbol ? `&symbol=${encodeURIComponent(symbol)}` : '';
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}${symbolParam}&token=${apiKey}`;
  requestJson(url).then(parsed => {
    const all = Array.isArray(parsed?.earningsCalendar) ? parsed.earningsCalendar.map(mapEarningsEntry).filter(e => e.date) : [];
    const upcoming = all.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, symbol ? 3 : all.length);
    const latestReported = all
      .filter(e => e.date < today && (e.epsActual != null || e.revenueActual != null))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
    resolve({ upcoming, latestReported, all });
  }).catch(() => resolve({ upcoming: [], latestReported: null, all: [] }));
});

const fetchEarningsHistory = symbol => new Promise(resolve => {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return resolve([]);
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  requestJson(url).then(parsed => {
    const list = Array.isArray(parsed) ? parsed.map(entry => ({
      period: dateOnly(entry.period),
      quarter: entry.quarter,
      year: entry.year,
      epsActual: entry.actual,
      epsEstimate: entry.estimate,
      surprisePercent: entry.surprisePercent,
    })).sort((a, b) => String(b.period).localeCompare(String(a.period))).slice(0, 4) : [];
    resolve(list);
  }).catch(() => resolve([]));
});

const finiteOrNull = value => value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const pctSurprise = (actual, estimate) => {
  const a = finiteOrNull(actual);
  const e = finiteOrNull(estimate);
  return a == null || e == null || e === 0 ? null : +(((a - e) / Math.abs(e)) * 100).toFixed(2);
};

const buildLatestEarningsReport = (calendarLatest, earningsHistory) => {
  const history = Array.isArray(earningsHistory) ? earningsHistory : [];
  const matchingHistory = calendarLatest
    ? history.find(item => Number(item.quarter) === Number(calendarLatest.quarter) && Number(item.year) === Number(calendarLatest.year))
    : history[0];
  if (!calendarLatest && !matchingHistory) return null;
  const epsActual = finiteOrNull(calendarLatest?.epsActual ?? matchingHistory?.epsActual);
  const epsEstimate = finiteOrNull(calendarLatest?.epsEstimate ?? matchingHistory?.epsEstimate);
  const revenueActual = finiteOrNull(calendarLatest?.revenueActual);
  const revenueEstimate = finiteOrNull(calendarLatest?.revenueEstimate);
  return {
    reportedDate: calendarLatest?.date || null,
    fiscalPeriod: matchingHistory?.period || null,
    quarter: calendarLatest?.quarter ?? matchingHistory?.quarter ?? null,
    year: calendarLatest?.year ?? matchingHistory?.year ?? null,
    hour: calendarLatest?.hour || null,
    epsActual,
    epsEstimate,
    epsSurprisePercent: finiteOrNull(matchingHistory?.surprisePercent) ?? pctSurprise(epsActual, epsEstimate),
    revenueActual,
    revenueEstimate,
    revenueSurprisePercent: pctSurprise(revenueActual, revenueEstimate),
    source: 'Finnhub earnings calendar/history',
  };
};

const normalizeTickerMap = payload => {
  const map = new Map();
  if (Array.isArray(payload?.data) && Array.isArray(payload?.fields)) {
    const tickerIndex = payload.fields.indexOf('ticker');
    const cikIndex = payload.fields.indexOf('cik');
    const nameIndex = payload.fields.indexOf('name');
    payload.data.forEach(row => {
      const ticker = String(row[tickerIndex] || '').toUpperCase();
      if (ticker) map.set(ticker, { cik: Number(row[cikIndex]), name: row[nameIndex] || ticker });
    });
  } else if (payload && typeof payload === 'object') {
    Object.values(payload).forEach(row => {
      const ticker = String(row?.ticker || '').toUpperCase();
      if (ticker) map.set(ticker, { cik: Number(row.cik_str), name: row.title || ticker });
    });
  }
  return map;
};

const getTickerMap = async () => {
  if (tickerMapCache.data && Date.now() - tickerMapCache.ts < TICKER_MAP_TTL) return tickerMapCache.data;
  if (tickerMapCache.pending) return tickerMapCache.pending;
  tickerMapCache.pending = requestJson('https://www.sec.gov/files/company_tickers_exchange.json', {
    'User-Agent': SEC_USER_AGENT,
    Accept: 'application/json',
  }).then(normalizeTickerMap).then(data => {
    tickerMapCache = { ts: Date.now(), data, pending: null };
    return data;
  }).catch(error => {
    tickerMapCache.pending = null;
    throw error;
  });
  return tickerMapCache.pending;
};

const ITEM_LABELS = {
  '1.01': 'Material definitive agreement', '1.02': 'Agreement terminated',
  '2.01': 'Acquisition or disposition', '2.02': 'Results of operations and financial condition',
  '2.03': 'New financial obligation', '2.04': 'Triggering event',
  '2.05': 'Exit or disposal plan', '2.06': 'Material impairment',
  '3.01': 'Listing or compliance notice', '3.02': 'Unregistered securities sale',
  '4.01': 'Accountant change', '4.02': 'Financial statements should not be relied upon',
  '5.01': 'Change in control', '5.02': 'Director or executive change',
  '5.03': 'Charter or bylaws change', '5.07': 'Shareholder vote results',
  '7.01': 'Regulation FD disclosure', '8.01': 'Other material event',
  '9.01': 'Financial statements and exhibits',
};

const itemNumbers = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const baseForm = value => String(value || '').replace(/\/A$/, '');
const IMPORTANT_FORMS = new Set(['10-Q', '10-K', '8-K', '20-F', '6-K']);
const PERIODIC_FORMS = new Set(['10-Q', '10-K', '20-F']);

const filingUrl = (cik, accessionNumber, primaryDocument) => {
  if (!cik || !accessionNumber || !primaryDocument) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${String(accessionNumber).replace(/-/g, '')}/${encodeURIComponent(primaryDocument)}`;
};

const normalizeSecFilings = (payload, cik) => {
  const recent = payload?.filings?.recent || {};
  const forms = Array.isArray(recent.form) ? recent.form : [];
  return forms.map((form, index) => {
    const items = itemNumbers(recent.items?.[index]);
    return {
      form,
      filedDate: dateOnly(recent.filingDate?.[index]),
      acceptedAt: recent.acceptanceDateTime?.[index] || null,
      reportDate: dateOnly(recent.reportDate?.[index]),
      accessionNumber: recent.accessionNumber?.[index] || null,
      primaryDocument: recent.primaryDocument?.[index] || null,
      items,
      itemLabels: items.map(item => ITEM_LABELS[item] || `SEC item ${item}`),
      url: filingUrl(cik, recent.accessionNumber?.[index], recent.primaryDocument?.[index]),
      source: 'SEC EDGAR',
    };
  }).filter(filing => IMPORTANT_FORMS.has(baseForm(filing.form)) && filing.filedDate);
};

const decodeHtmlEntities = value => String(value || '')
  .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
    const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
    return Number.isFinite(number) ? String.fromCodePoint(number) : ' ';
  })
  .replace(/&nbsp;|&ensp;|&emsp;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');

const extractMaterialEventSummary = (html, items = []) => {
  const text = decodeHtmlEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const relevantItems = items.filter(item => item !== '9.01');
  let start = -1;
  let matchedItem = '';
  relevantItems.some(item => {
    const match = new RegExp(`Item\\s+${item.replace('.', '\\.')}\\b`, 'i').exec(text);
    if (!match) return false;
    start = match.index;
    matchedItem = item;
    return true;
  });
  if (start < 0) return null;
  const afterHeading = text.slice(start).replace(new RegExp(`^Item\\s+${matchedItem.replace('.', '\\.')}\\s*`, 'i'), '');
  const nextItem = afterHeading.search(/\bItem\s+\d+\.\d+\b/i);
  const signature = afterHeading.search(/\bSIGNATURES?\b/i);
  const ends = [nextItem, signature].filter(index => index > 20);
  let summary = afterHeading.slice(0, ends.length ? Math.min(...ends) : 700).trim();
  const label = ITEM_LABELS[matchedItem];
  if (label) summary = summary.replace(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?\\s*`, 'i'), '');
  summary = summary.replace(/^(Other Events?|Results of Operations and Financial Condition|Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers|Regulation FD Disclosure)\.?\s*/i, '');
  if (summary.length > 300) {
    const shortened = summary.slice(0, 300);
    summary = shortened.slice(0, Math.max(shortened.lastIndexOf(' '), 220)).trim() + '…';
  }
  return summary || null;
};

const fetchMaterialEventSummary = async filing => {
  if (!filing?.url || !/^https:\/\/www\.sec\.gov\/Archives\/edgar\//i.test(filing.url)) return null;
  try {
    const html = await requestText(filing.url, { 'User-Agent': SEC_USER_AGENT, Accept: 'text/html' });
    return extractMaterialEventSummary(html, filing.items);
  } catch (_) {
    return null;
  }
};

const fetchSecFilings = async symbol => {
  const sym = String(symbol || '').toUpperCase().trim();
  const cached = fromCache(secSubmissionsCache, sym, REPORTS_TTL);
  if (cached) return cached;
  try {
    const tickerMap = await getTickerMap();
    const company = tickerMap.get(sym.replace('.', '-')) || tickerMap.get(sym);
    if (!company?.cik) return { companyName: null, cik: null, filings: [], error: 'No SEC CIK mapping found' };
    const cik = String(company.cik).padStart(10, '0');
    const payload = await requestJson(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      'User-Agent': SEC_USER_AGENT,
      Accept: 'application/json',
    });
    const result = { companyName: payload.name || company.name, cik: Number(company.cik), filings: normalizeSecFilings(payload, company.cik) };
    toCache(secSubmissionsCache, sym, result);
    return result;
  } catch (error) {
    return { companyName: null, cik: null, filings: [], error: error.message };
  }
};

const enrichReports = (symbol, latestEarningsReport, upcomingEarnings, secData) => {
  const filings = Array.isArray(secData?.filings) ? secData.filings : [];
  const latestSecFiling = filings[0] || null;
  const latestMaterialEvent = filings.find(filing => baseForm(filing.form) === '8-K') || null;
  const latestEarningsEvent = filings.find(filing => baseForm(filing.form) === '8-K' && filing.items.includes('2.02')) || null;
  let earningsSecFiling = null;
  if (latestEarningsReport?.fiscalPeriod) {
    earningsSecFiling = filings.find(filing => PERIODIC_FORMS.has(baseForm(filing.form)) && filing.reportDate === latestEarningsReport.fiscalPeriod) || null;
  }
  if (!earningsSecFiling && latestEarningsReport?.reportedDate) {
    earningsSecFiling = filings.find(filing => PERIODIC_FORMS.has(baseForm(filing.form)) &&
      Math.abs(new Date(filing.filedDate) - new Date(latestEarningsReport.reportedDate)) <= 45 * 86400000) || null;
  }

  const earnings = latestEarningsReport ? {
    ...latestEarningsReport,
    announcedDate: latestEarningsReport.reportedDate || null,
    announcementSession: latestEarningsReport.hour || null,
    announcementSource: latestEarningsReport.reportedDate ? 'Finnhub earnings calendar' : null,
    earningsReleaseFiledDate: latestEarningsEvent?.filedDate || null,
    earningsReleaseSecUrl: latestEarningsEvent?.url || null,
    secForm: earningsSecFiling?.form || null,
    secFiledDate: earningsSecFiling?.filedDate || null,
    secAcceptedAt: earningsSecFiling?.acceptedAt || null,
    secAccessionNumber: earningsSecFiling?.accessionNumber || null,
    secUrl: earningsSecFiling?.url || null,
  } : null;

  const material = latestMaterialEvent ? {
    ...latestMaterialEvent,
    title: latestMaterialEvent.itemLabels.filter(label => label !== ITEM_LABELS['9.01']).join(' · ') || 'Material event filing',
    duplicatesLatestEarnings: Boolean(latestEarningsEvent && latestMaterialEvent.accessionNumber === latestEarningsEvent.accessionNumber && earnings),
  } : null;

  return {
    symbol: String(symbol || '').toUpperCase(),
    companyName: secData?.companyName || null,
    latestEarningsReport: earnings,
    upcomingEarnings: Array.isArray(upcomingEarnings) ? upcomingEarnings : [],
    nextEarnings: Array.isArray(upcomingEarnings) && upcomingEarnings.length ? upcomingEarnings[0] : null,
    latestSecFiling,
    latestMaterialEvent: material,
    source: 'Finnhub earnings calendar/history + SEC EDGAR submissions',
    retrievedAt: new Date().toISOString(),
    secUnavailable: Boolean(secData?.error),
  };
};

const getCompanyReports = async symbol => {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(sym)) throw new Error('A valid US stock ticker is required');
  const cached = fromCache(reportsCache, sym, REPORTS_TTL);
  if (cached) return { ...cached, fromCache: true };
  const [calendar, history, secData] = await Promise.all([
    enqueueFinnhubCall(() => fetchEarningsCalendar(sym), { priority: true }),
    enqueueFinnhubCall(() => fetchEarningsHistory(sym), { priority: true }),
    fetchSecFilings(sym),
  ]);
  const latestEarningsReport = buildLatestEarningsReport(calendar.latestReported, history);
  const enriched = enrichReports(sym, latestEarningsReport, calendar.upcoming, secData);
  if (enriched.latestMaterialEvent && !enriched.latestMaterialEvent.duplicatesLatestEarnings) {
    enriched.latestMaterialEvent.summary = await fetchMaterialEventSummary(enriched.latestMaterialEvent);
  }
  const result = {
    ...enriched,
    earningsHistory: history,
    fromCache: false,
  };
  toCache(reportsCache, sym, result);
  return result;
};

const universeRank = new Map(usUniverse2000.map((symbol, index) => [symbol, index]));
const importanceLabel = rank => rank < 100 ? 'Largest-cap / highest importance' : rank < 300 ? 'Large-cap / high importance' : rank < 1000 ? 'Broad-market importance' : 'Wider universe';

const getImportantUpcomingEarnings = async (fromDate, toDate, count = 15) => {
  const today = new Date().toISOString().split('T')[0];
  const from = dateOnly(fromDate) || today;
  const defaultTo = new Date(new Date(from + 'T12:00:00Z').getTime() + 7 * 86400000).toISOString().split('T')[0];
  const to = dateOnly(toDate) || defaultTo;
  if (to < from) throw new Error('End date must not be before start date');
  if (new Date(to) - new Date(from) > 31 * 86400000) throw new Error('Upcoming earnings range cannot exceed 31 days');
  const limit = Math.max(1, Math.min(Number(count) || 15, 30));
  const key = `${from}:${to}:${limit}`;
  const cached = fromCache(upcomingCache, key, UPCOMING_TTL);
  if (cached) return { ...cached, fromCache: true };
  const calendar = await enqueueFinnhubCall(() => fetchEarningsCalendar('', from, to), { priority: true });
  const ranked = calendar.all
    .filter(entry => universeRank.has(entry.symbol || ''))
    .map(entry => ({ ...entry, importanceRank: universeRank.get(entry.symbol), importance: importanceLabel(universeRank.get(entry.symbol)) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.importanceRank - b.importanceRank)
    .slice(0, limit);
  const result = { from, to, earnings: ranked, source: 'Finnhub earnings calendar ranked by SwingRush 2,000-stock market-cap universe', retrievedAt: new Date().toISOString(), fromCache: false };
  toCache(upcomingCache, key, result);
  return result;
};

module.exports = {
  buildLatestEarningsReport,
  enrichReports,
  getCompanyReports,
  getImportantUpcomingEarnings,
  extractMaterialEventSummary,
  normalizeSecFilings,
};
