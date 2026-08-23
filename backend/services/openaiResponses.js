const https = require('https');

// The everyday chat route uses Terra: it keeps the full GPT-5.6 tool and
// reasoning capabilities while materially reducing cost. Quality-first Pro
// Engine news analysis opts into Sol explicitly at its own call site.
const DEFAULT_MODEL = 'gpt-5.6-terra';
const DEFAULT_REASONING_EFFORT = 'medium';
const DEFAULT_TIMEOUT_MS = 180000;

const getOpenAIConfig = () => ({
  model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
  reasoningEffort: process.env.OPENAI_CHAT_REASONING_EFFORT || process.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
  timeoutMs: Number(process.env.OPENAI_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
});

const extractOutputText = (response) => {
  const blocks = (response?.output || [])
    .filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' && typeof item.text === 'string');

  const text = blocks
    .map((block) => {
      const citations = (block.annotations || [])
        .filter(annotation => annotation.type === 'url_citation' && /^https?:\/\//.test(annotation.url || ''))
        .filter((annotation, index, all) => all.findIndex(other => other.url === annotation.url) === index);
      if (!citations.length) return block.text;

      const sources = citations.map((citation) => {
        const title = String(citation.title || citation.url).replace(/]/g, '\\]');
        return `- [${title}](${citation.url})`;
      }).join('\n');
      return `${block.text}\n\nSources:\n${sources}`;
    })
    .join('\n\n')
    .trim();

  if (text) return text;
  return typeof response?.output_text === 'string' ? response.output_text.trim() : '';
};

const createOpenAIResponse = ({
  input,
  instructions,
  tools,
  toolChoice,
  maxOutputTokens = 16000,
  model,
  reasoningEffort,
  textFormat,
  verbosity = 'medium',
}) => new Promise((resolve, reject) => {
  if (!process.env.OPENAI_API_KEY) {
    return reject(new Error('OPENAI_API_KEY is not configured'));
  }

  const config = getOpenAIConfig();
  const body = {
    model: model || config.model,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: reasoningEffort || config.reasoningEffort },
    text: {
      verbosity,
      ...(textFormat ? { format: textFormat } : {}),
    },
    store: false,
    include: ['reasoning.encrypted_content'],
  };

  if (Array.isArray(tools) && tools.length) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }

  const request = https.request({
    hostname: 'api.openai.com',
    path: '/v1/responses',
    method: 'POST',
    timeout: config.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  }, (response) => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        return reject(new Error(`OpenAI returned invalid JSON (HTTP ${response.statusCode || 'unknown'})`));
      }

      if ((response.statusCode || 500) < 200 || response.statusCode >= 300 || parsed.error) {
        const message = parsed?.error?.message || `OpenAI request failed with HTTP ${response.statusCode}`;
        return reject(new Error(message));
      }

      if (parsed.status === 'failed') {
        const message = parsed?.error?.message || parsed?.incomplete_details?.reason || 'OpenAI response failed';
        return reject(new Error(message));
      }

      resolve(parsed);
    });
  });

  request.on('timeout', () => request.destroy(new Error(`OpenAI API call timed out after ${config.timeoutMs}ms`)));
  request.on('error', reject);
  request.write(JSON.stringify(body));
  request.end();
});

module.exports = {
  createOpenAIResponse,
  extractOutputText,
  getOpenAIConfig,
};
