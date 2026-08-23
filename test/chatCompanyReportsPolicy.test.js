const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../backend/routes/chat.js'), 'utf8');

test('chat exposes lightweight single-company and market-wide reports tools', () => {
  assert.match(source, /name: 'get_company_reports'/);
  assert.match(source, /name: 'get_upcoming_earnings'/);
  assert.match(source, /getCompanyReports\(sym\)/);
  assert.match(source, /getImportantUpcomingEarnings/);
});

test('chat policy forbids mixing fiscal, announcement, and filing dates', () => {
  assert.match(source, /fiscal-period end is NOT the announcement date/);
  assert.match(source, /Keep announcement date, fiscal-period end, and SEC filing date explicitly separate/);
  assert.match(source, /Preserve BMO\/AMC\/TBD status/);
});

test('chat forces web search when structured company-report dates are incomplete or conflicting', () => {
  assert.match(source, /WEB_SEARCH_REQUIRED_FOR_COMPANY_REPORT_DATES/);
  assert.match(source, /nextToolChoice = \{ type: 'web_search' \}/);
  assert.match(source, /web-search fallback is mandatory/);
});
