const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const i18nSource = fs.readFileSync(require.resolve('../frontend/js/i18n.js'), 'utf8');
const feedSource = fs.readFileSync(require.resolve('../frontend/feed.html'), 'utf8');

const loadLanguageApi = () => {
  const localStorage = {
    value: null,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; },
  };
  const document = {
    readyState: 'complete',
    documentElement: {},
    body: { classList: { toggle() {} } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const window = { dispatchEvent() {} };
  vm.runInNewContext(i18nSource, {
    window,
    document,
    localStorage,
    CustomEvent: function CustomEvent() {},
  });
  return window.SRLang;
};

test('Hot Stocks copy is available in English, Arabic, and Hebrew', () => {
  const language = loadLanguageApi();
  const copy = {
    en: {
      'feed.hot_stocks_full_title': 'ALL HOT STOCKS',
      'feed.hot_stocks_full_copy': 'Every stock with open community trades, ranked by trade count. The bar shows BUY vs SELL sentiment.',
      'feed.open_full_list': 'Open full list',
      'feed.open_trades_suffix': 'open trades',
      'feed.sentiment_label': 'Sentiment',
      'feed.no_open_trades': 'No open trades yet',
      'feed.hot_stocks_load_failed': 'Could not load Hot Stocks',
    },
    ar: {
      'feed.hot_stocks_full_title': 'جميع الأسهم الساخنة',
      'feed.hot_stocks_full_copy': 'كل سهم لديه صفقات مجتمع مفتوحة، مرتبة حسب عدد الصفقات. يعرض الشريط معنويات الشراء مقابل البيع.',
      'feed.open_full_list': 'فتح القائمة الكاملة',
      'feed.open_trades_suffix': 'صفقات مفتوحة',
      'feed.sentiment_label': 'المعنويات',
      'feed.no_open_trades': 'لا توجد صفقات مفتوحة بعد',
      'feed.hot_stocks_load_failed': 'تعذر تحميل الأسهم الساخنة',
    },
    he: {
      'feed.hot_stocks_full_title': 'כל המניות החמות',
      'feed.hot_stocks_full_copy': 'כל מניה עם עסקאות קהילה פתוחות, מדורגת לפי מספר העסקאות. הסרגל מציג סנטימנט קנייה מול מכירה.',
      'feed.open_full_list': 'פתיחת הרשימה המלאה',
      'feed.open_trades_suffix': 'עסקאות פתוחות',
      'feed.sentiment_label': 'סנטימנט',
      'feed.no_open_trades': 'אין עדיין עסקאות פתוחות',
      'feed.hot_stocks_load_failed': 'לא ניתן לטעון מניות חמות',
    },
  };

  for (const lang of ['en', 'ar', 'he']) {
    language.set(lang);
    for (const [key, expected] of Object.entries(copy[lang])) {
      assert.equal(language.t(key, copy.en[key]), expected, `${lang}: ${key}`);
    }
  }
});

test('Hot Stocks dynamic rows re-render immediately after a language switch', () => {
  assert.match(feedSource, /addEventListener\('sr:language_changed'[\s\S]*?renderHotStocksPreview\(\)/);
  assert.match(feedSource, /classList\.contains\('is-open'\)[\s\S]*?renderHotStocksFull\(\)/);
});
