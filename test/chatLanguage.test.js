const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const chatSource = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'js', 'chat.js'),
  'utf8'
);

const helperStart = chatSource.indexOf('  function siteLang()');
const helperEnd = chatSource.indexOf('  window.setChatStockContext');
const languageHelpers = chatSource.slice(helperStart, helperEnd);

const loadHelpers = (siteLanguage, rememberedLanguage) => {
  const context = {
    window: { SRLang: { lang: siteLanguage } },
    document: { documentElement: { lang: siteLanguage } },
    localStorage: {
      getItem(key) {
        return key === 'sr_chat_lang' ? rememberedLanguage : null;
      },
    },
  };

  return vm.runInNewContext(
    `(function () { ${languageHelpers}; return { lastChatLang, signalLabel }; })()`,
    context
  );
};

test('English Pro Engine handoff never inherits a remembered Hebrew label', () => {
  const helpers = loadHelpers('en', 'he');
  assert.equal(helpers.lastChatLang(), 'en');
  assert.equal(helpers.signalLabel('SELL'), 'SELL');
  assert.equal(helpers.signalLabel('BUY'), 'BUY');
});

test('Pro Engine handoff direction follows each selected site language', () => {
  assert.equal(loadHelpers('ar', 'en').signalLabel('SELL'), 'بيع');
  assert.equal(loadHelpers('he', 'en').signalLabel('SELL'), 'מכירה');
});
