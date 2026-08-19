const US_UNIVERSE = require('../data/usUniverse2000');

const KNOWN_TICKERS = new Set(US_UNIVERSE.map(symbol => String(symbol).toUpperCase()));

const NAME_TO_TICKER = {
  APPLE: 'AAPL', MICROSOFT: 'MSFT', GOOGLE: 'GOOGL', ALPHABET: 'GOOGL',
  AMAZON: 'AMZN', TESLA: 'TSLA', FACEBOOK: 'META', NVIDIA: 'NVDA',
  NETFLIX: 'NFLX', ORACLE: 'ORCL', INTEL: 'INTC', DISNEY: 'DIS',
  BOEING: 'BA', PAYPAL: 'PYPL', STARBUCKS: 'SBUX', WALMART: 'WMT',
  COSTCO: 'COST', MCDONALDS: 'MCD', NIKE: 'NKE', VISA: 'V',
  MASTERCARD: 'MA', PEPSI: 'PEP', ADOBE: 'ADBE', SALESFORCE: 'CRM',
  AIRBNB: 'ABNB', PALANTIR: 'PLTR', COINBASE: 'COIN', ROBINHOOD: 'HOOD',
  SNAPCHAT: 'SNAP', SPOTIFY: 'SPOT', MONGODB: 'MDB', BROADCOM: 'AVGO',
  QUALCOMM: 'QCOM', MICRON: 'MU', FORD: 'F', RIVIAN: 'RIVN',
  LUCID: 'LCID', ALIBABA: 'BABA', BAIDU: 'BIDU', AMD: 'AMD',
};

// Ordinary words that are also valid short exchange symbols must not silently
// turn a normal sentence into a stock question. Explicit $TICKER syntax still
// works for every symbol, including these collisions.
const AMBIGUOUS_WORDS = new Set([
  'A','I','AI','ALL','AM','AN','AND','ANY','ARE','AS','ASK','AT','BE','BEEN','BEFORE','BEST','BOTH','BUT','BY',
  'CAN','CASE','CEO','CFO','CHART','CLOSE','COME','COULD','DATA','DATE','DATES','DAY','DO','DOES','DONE','DURING',
  'EACH','EVENT','EVENTS','EVER','EVERY','FACT','FACTS','FEEL','FEELS','FIND','FOR','FROM','GET','GIVE','GO','GOOD',
  'GRAPH','HAS','HAVE','HE','HELP','HER','HERE','HIM','HIS','HOLD','HOW','IF','IN','INTO','IS','IT','ITS','JUST',
  'KEEP','KNOW','LAST','LATER','LESS','LET','LIKE','LINE','LIST','LIVE','LOOK','LOOKS','LOW','MAKE','MANY','MARKET','MAY',
  'MAYBE','ME','MORE','MOST','MOVE','MOVES','MUCH','MUST','MY','NEED','NEVER','NEW','NEWS','NO','NOT','NOW','OF',
  'OFF','OFTEN','OLD','ON','ONLY','OPEN','OR','OUR','OUT','OVER','PART','PLAN','PLAY','PRICE','PRO','REAL','REPORT',
  'RESULT','RESULTS','SAID','SAY','SCORE','SEE','SEEM','SELL','SHE','SHOULD','SHOW','SIDE','SIGNAL','SINCE','SO','SOME',
  'SOON','STILL','STOCK','STOCKS','SUCH','TAKE','TELL','THAN','THAT','THE','THEIR','THEM','THEN','THEY','THIS','THUS',
  'TO','TODAY','TOP','TRADE','TRUE','TRY','UNTIL','UP','US','VERY','WAIT','WANT','WAS','WAY','WE','WEEK','WERE','WHAT',
  'WHEN','WHICH','WHILE','WHO','WHY','WILL','WITH','WORK','WORKS','WOULD','YEAR','YES','YOU','YOUR',
  'ADX','ATR','EMA','ETF','IPO','MACD','PM','RSI','SL','SMA','TP','USD',
]);

const extractSymbols = (value, limit = 3) => {
  const text = String(value || '');
  const found = [];
  const add = (symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    if (!normalized || found.includes(normalized)) return;
    found.push(normalized);
  };

  // Explicit cashtags are strong user intent and are allowed even when a new
  // listing has not yet made it into the scanner's static universe.
  for (const match of text.matchAll(/\$([A-Za-z]{1,5}(?:\.[A-Za-z])?)(?![A-Za-z])/g)) add(match[1]);

  const tokens = text.match(/[A-Za-z]{1,12}/g) || [];
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (NAME_TO_TICKER[upper]) add(NAME_TO_TICKER[upper]);
  }

  const trimmedUpper = text.trim().toUpperCase();
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (!KNOWN_TICKERS.has(upper) || AMBIGUOUS_WORDS.has(upper) || NAME_TO_TICKER[upper]) continue;

    // One-letter tickers are too ambiguous inside prose. They remain supported
    // when written as $F/$V/etc. or when the whole message is just that ticker.
    if (upper.length === 1 && trimmedUpper !== upper) continue;
    add(upper);
  }

  return found.slice(0, Math.max(1, limit));
};

module.exports = { extractSymbols, NAME_TO_TICKER, KNOWN_TICKERS };
