const { getCandlesForRange } = require('./proEngine');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RETURNED_SESSIONS = 35;

const roundPrice = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return +(Math.abs(number) < 1 ? number.toFixed(4) : number.toFixed(2));
};

const roundPct = value => Number.isFinite(value) ? +value.toFixed(2) : null;

const parseDateKey = value => {
  const key = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(key + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key ? date : null;
};

// Yahoo daily timestamps represent US-market sessions. Format them in New
// York time so an exact-session request cannot drift to the adjacent UTC date.
const marketDateKey = unixSeconds => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(Number(unixSeconds) * 1000));
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const validateHistoryRequest = (startDate, endDate = startDate, now = new Date()) => {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end) throw new Error('Dates must use YYYY-MM-DD format.');
  if (start > end) throw new Error('startDate must be on or before endDate.');
  const rangeDays = Math.round((end - start) / DAY_MS);
  const today = parseDateKey(now.toISOString().slice(0, 10));
  if (start > today || end > today) throw new Error('Historical dates cannot be in the future.');
  return { start, end, rangeDays };
};

const buildStockHistory = (symbol, candles, startDate, endDate = startDate) => {
  const allRows = (candles?.t || []).map((time, index) => ({
    date: marketDateKey(time),
    time: Number(time),
    open: roundPrice(candles.o?.[index]),
    high: roundPrice(candles.h?.[index]),
    low: roundPrice(candles.l?.[index]),
    close: roundPrice(candles.c?.[index]),
    adjustedClose: roundPrice(candles.a?.[index]),
    volume: Number(candles.v?.[index]) || null,
  })).filter(row => row.open != null && row.high != null && row.low != null && row.close != null);

  const sessions = allRows.reduce((matched, row, index) => {
    if (row.date < startDate || row.date > endDate) return matched;
    const priorClose = index > 0 ? allRows[index - 1].close : null;
    const priorAdjustedClose = index > 0 ? allRows[index - 1].adjustedClose : null;
    const percentageStart = priorAdjustedClose || priorClose;
    const percentageEnd = row.adjustedClose || row.close;
    matched.push({
      ...row,
      priorClose,
      changeFromPriorClose: priorClose == null ? null : roundPrice(row.close - priorClose),
      changeFromPriorClosePct: percentageStart ? roundPct(((percentageEnd - percentageStart) / percentageStart) * 100) : null,
      intradayOpenToClosePct: row.open ? roundPct(((row.close - row.open) / row.open) * 100) : null,
    });
    return matched;
  }, []);

  const before = [...allRows].reverse().find(row => row.date < startDate) || null;
  const after = allRows.find(row => row.date > endDate) || null;
  const firstSession = sessions[0] || null;
  const lastSession = sessions[sessions.length - 1] || null;
  let periodPerformance = null;
  if (firstSession && lastSession && firstSession !== lastSession) {
    const useAdjusted = firstSession.adjustedClose != null && lastSession.adjustedClose != null;
    const startValue = useAdjusted ? firstSession.adjustedClose : firstSession.close;
    const endValue = useAdjusted ? lastSession.adjustedClose : lastSession.close;
    periodPerformance = {
      startDate: firstSession.date,
      endDate: lastSession.date,
      startClose: firstSession.close,
      endClose: lastSession.close,
      calculationStartValue: startValue,
      calculationEndValue: endValue,
      change: roundPrice(endValue - startValue),
      changePct: startValue ? roundPct(((endValue - startValue) / startValue) * 100) : null,
      basis: useAdjusted ? 'split/dividend-adjusted close' : 'raw close',
    };
  }
  const returnedSessions = sessions.length <= MAX_RETURNED_SESSIONS
    ? sessions
    : [firstSession, lastSession];
  return {
    source: 'Yahoo Finance daily candles',
    retrievedAt: new Date().toISOString(),
    symbol,
    requestedStartDate: startDate,
    requestedEndDate: endDate,
    sessions: returnedSessions,
    sessionCount: sessions.length,
    sessionsTruncated: sessions.length > MAX_RETURNED_SESSIONS,
    periodPerformance,
    noTradingSession: sessions.length === 0,
    nearestSessionBefore: before,
    nearestSessionAfter: after,
  };
};

const getVerifiedStockHistory = async (symbol, startDate, endDate = startDate) => {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) throw new Error('A stock ticker is required.');
  const request = validateHistoryRequest(startDate, endDate);
  // The leading buffer supplies the true prior close; the trailing buffer
  // identifies the nearest session after a holiday. Long periods are fetched
  // daily for exact split-adjusted math, but only their endpoints are returned
  // to the model so tool output stays small.
  const period1 = Math.floor((request.start.getTime() - 10 * DAY_MS) / 1000);
  const period2 = Math.floor((request.end.getTime() + 11 * DAY_MS) / 1000);
  const candles = await getCandlesForRange(sym, period1, period2, '1d');
  return buildStockHistory(sym, candles, startDate, endDate);
};

module.exports = {
  buildStockHistory,
  getVerifiedStockHistory,
  marketDateKey,
  validateHistoryRequest,
};
