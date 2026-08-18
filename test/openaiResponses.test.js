const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('https');

const {
  createOpenAIResponse,
  extractOutputText,
  getOpenAIConfig,
} = require('../backend/services/openaiResponses');

test('extractOutputText joins Responses API output text blocks', () => {
  const text = extractOutputText({
    output: [
      { type: 'reasoning', encrypted_content: 'opaque' },
      {
        type: 'message',
        content: [
          { type: 'output_text', text: 'First' },
          { type: 'output_text', text: 'Second' },
        ],
      },
    ],
  });

  assert.equal(text, 'First\n\nSecond');
});

test('extractOutputText preserves web-search citations as source links', () => {
  const text = extractOutputText({
    output: [{
      type: 'message',
      content: [{
        type: 'output_text',
        text: 'The filing was published today.',
        annotations: [{
          type: 'url_citation',
          title: 'Company filing',
          url: 'https://example.com/filing',
          start_index: 4,
          end_index: 10,
        }],
      }],
    }],
  });

  assert.equal(text, 'The filing was published today.\n\nSources:\n- [Company filing](https://example.com/filing)');
});

test('OpenAI configuration defaults to the accuracy-first model', () => {
  const oldModel = process.env.OPENAI_MODEL;
  const oldEffort = process.env.OPENAI_REASONING_EFFORT;
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_REASONING_EFFORT;

  try {
    const config = getOpenAIConfig();
    assert.equal(config.model, 'gpt-5.6-sol');
    assert.equal(config.reasoningEffort, 'high');
  } finally {
    if (oldModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = oldModel;
    if (oldEffort === undefined) delete process.env.OPENAI_REASONING_EFFORT;
    else process.env.OPENAI_REASONING_EFFORT = oldEffort;
  }
});

test('createOpenAIResponse sends Responses API privacy, reasoning, and automatic tool settings', async () => {
  const originalRequest = https.request;
  const oldKey = process.env.OPENAI_API_KEY;
  const oldModel = process.env.OPENAI_MODEL;
  const oldEffort = process.env.OPENAI_REASONING_EFFORT;
  process.env.OPENAI_API_KEY = 'test-key-not-real';
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_REASONING_EFFORT;
  let capturedOptions;
  let capturedBody;

  https.request = (options, onResponse) => {
    capturedOptions = options;
    const request = new EventEmitter();
    request.write = value => { capturedBody = JSON.parse(value); };
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = 200;
      onResponse(response);
      queueMicrotask(() => {
        response.emit('data', Buffer.from(JSON.stringify({
          id: 'resp_test',
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }],
        })));
        response.emit('end');
      });
    };
    request.destroy = error => request.emit('error', error);
    return request;
  };

  try {
    const response = await createOpenAIResponse({
      instructions: 'Be accurate.',
      input: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'web_search' }],
      maxOutputTokens: 1234,
    });

    assert.equal(extractOutputText(response), 'ok');
    assert.equal(capturedOptions.hostname, 'api.openai.com');
    assert.equal(capturedOptions.path, '/v1/responses');
    assert.equal(capturedOptions.headers.Authorization, 'Bearer test-key-not-real');
    assert.equal(capturedBody.model, 'gpt-5.6-sol');
    assert.equal(capturedBody.reasoning.effort, 'high');
    assert.equal(capturedBody.tool_choice, 'auto');
    assert.equal(capturedBody.store, false);
    assert.deepEqual(capturedBody.include, ['reasoning.encrypted_content']);
    assert.equal(capturedBody.max_output_tokens, 1234);
  } finally {
    https.request = originalRequest;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = oldModel;
    if (oldEffort === undefined) delete process.env.OPENAI_REASONING_EFFORT;
    else process.env.OPENAI_REASONING_EFFORT = oldEffort;
  }
});
