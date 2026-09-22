const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/ai-provider.js');
const config = { protocol: 'openai', baseUrl: 'https://provider.example', apiKey: 'test-only-secret', model: 'fixture', openaiEndpoint: 'responses', transport: 'browser' };
const data = { decks: [{ name: 'Fixture', main: [{ name: 'Blue-Eyes White Dragon', count: 3, language: 'en' }], extra: [], side: [], uncertain: [] }] };
const image = 'data:image/jpeg;base64,YWJj';
const envelope = (c, value = data) => c.protocol === 'anthropic' ? { model: 'actual', content: [{ type: 'tool_use', name: 'extract_decks', input: value }] } : c.openaiEndpoint === 'responses' ? { model: 'actual', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] } : { model: 'actual', choices: [{ message: { content: JSON.stringify(value) } }] };
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });

for (const variant of [{}, { openaiEndpoint: 'chat-completions' }, { protocol: 'anthropic' }]) test('protocol request and response: ' + JSON.stringify(variant), async () => {
  const c = { ...config, ...variant }; let captured;
  const result = await P.complete(c, { text: 'Extract this list.', images: [image] }, { fetch: async (url, options) => { captured = { url, ...options, body: JSON.parse(options.body) }; return response(envelope(c)); } });
  assert.deepEqual(result.data, data); assert.equal(result.model, 'actual');
  assert.equal(captured.redirect, 'error'); assert.equal(captured.credentials, 'omit');
  if (c.protocol === 'anthropic') {
    assert.equal(captured.url, config.baseUrl + '/v1/messages'); assert.equal(captured.headers['x-api-key'], config.apiKey);
    assert.equal(captured.headers['anthropic-dangerous-direct-browser-access'], 'true');
    assert.deepEqual(captured.body.tools[0].input_schema, P.schema); assert.equal(captured.body.messages[0].content[1].source.data, 'YWJj');
  } else if (c.openaiEndpoint === 'responses') {
    assert.equal(captured.url, config.baseUrl + '/v1/responses'); assert.equal(captured.body.text.format.strict, true);
    assert.equal(captured.body.input[0].content[1].image_url, image);
  } else {
    assert.equal(captured.url, config.baseUrl + '/v1/chat/completions'); assert.equal(captured.body.response_format.json_schema.strict, true);
    assert.equal(captured.body.messages[1].content[1].image_url.url, image);
  }
});
test('base paths, https, credentials and full URL validation', () => {
  assert.equal(P.endpoint({ ...config, baseUrl: 'https://provider.example/prefix/v1/' }), 'https://provider.example/prefix/v1/responses');
  for (const baseUrl of ['http://provider.example', 'https://key@provider.example', 'https://provider.example/?key=x', 'javascript:foo']) assert.throws(() => P.endpoint({ ...config, baseUrl }), { code: 'url' });
});
test('strict local schema rejects IDs, half responses, invalid counts and extra fields', () => {
  for (const mutate of [v => { v.decks[0].main[0].id = 'blue-eyes'; }, v => { v.decks[0].main[0].name = '89631139'; }, v => { v.decks[0].main[0].count = 4; }, v => { delete v.decks[0].side; }, v => { v.decks[0].main[0].language = 'fr'; }]) {
    const value = structuredClone(data); mutate(value); assert.throws(() => P.validate(value), { code: 'schema' });
  }
  assert.throws(() => P.validate({ items: [{ input: 'changed', isCard: true, zh: '', en: '', ja: '' }] }, 'normalize', ['original']), { code: 'schema' });
  const numeric = structuredClone(data); numeric.decks[0].main[0].name = '1234567'; assert.throws(() => P.validate(numeric), { code: 'schema' });
  numeric.decks[0].main[0].name = '７'; assert.equal(P.validate(numeric), numeric);
});
test('retry only transient upstream errors, twice, with backoff', async () => {
  const waits = []; let calls = 0;
  await P.complete(config, {}, { sleep: async ms => waits.push(ms), fetch: async () => ++calls < 3 ? response({}, 429) : response(envelope(config)) });
  assert.equal(calls, 3); assert.deepEqual(waits, [1000, 3000]);
  for (const [status, code] of [[401, 'auth'], [403, 'auth'], [404, 'endpoint'], [400, 'request']]) { calls = 0; await assert.rejects(P.complete(config, {}, { fetch: async () => { calls++; return response({}, status); } }), { code }); assert.equal(calls, 1); }
});
test('JSON-mode compatibility fallback retains local schema validation', async () => {
  const c = { ...config, openaiEndpoint: 'chat-completions' }, bodies = [];
  const result = await P.complete(c, {}, { fetch: async (_url, options) => { bodies.push(JSON.parse(options.body)); return bodies.length === 1 ? response({ error: 'response_format json_schema is not supported' }, 400) : response(envelope(c)); } });
  assert.equal(result.jsonMode, true); assert.equal(bodies[1].response_format.type, 'json_object'); assert.match(bodies[1].messages[0].content, /JSON Schema/);
});
test('server transport sends key only in the dedicated header and does not retry server errors', async () => {
  let calls = 0;
  const result = await P.complete({ ...config, transport: 'server' }, {}, { fetch: async (url, options) => {
    calls++; assert.equal(url, '/api/ai/complete'); assert.equal(options.headers['X-Duel-AI-Key'], config.apiKey); assert.ok(!options.body.includes(config.apiKey));
    return response({ data, model: 'actual', elapsed: 2 });
  } }); assert.deepEqual(result.data, data); assert.equal(calls, 1);
});
test('malformed outputs show a bounded, redacted preview; truncation is an error', async () => {
  await assert.rejects(P.complete(config, {}, { fetch: async () => new Response('oops ' + config.apiKey + ' '.repeat(700)) }), e => e.code === 'json' && !e.preview.includes(config.apiKey) && e.preview.length <= 500);
  await assert.rejects(P.complete(config, {}, { fetch: async () => response({ ...envelope(config), status: 'incomplete' }) }), { code: 'truncated' });
});
test('payload limits, cancellation and deadline', async () => {
  for (const [input, code] of [[{ text: '汉'.repeat(20001) }, 'textLimit'], [{ images: [image, image, image, image, image] }, 'imageLimit'], [{ images: ['https://unsafe/image'] }, 'imageLimit']]) await assert.rejects(P.complete(config, input), { code });
  const controller = new AbortController(); controller.abort(); await assert.rejects(P.complete(config, {}, { signal: controller.signal }), { code: 'cancelled' });
  const timer = setTimeout(() => {}, 200);
  await assert.rejects(P.complete(config, {}, { timeout: 10, fetch: (_url, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason))) }), { code: 'timeout' }); clearTimeout(timer);
});
test('connection test uses a minimal request and confirms a real response', async () => {
  const c = { ...config, openaiEndpoint: 'chat-completions' };
  const result = await P.complete(c, {}, { operation: 'test', fetch: async (_url, options) => { const body = JSON.parse(options.body); assert.equal(body.max_tokens, 128); assert.equal(body.response_format, undefined); return response({ model: 'actual', choices: [{ message: { content: 'OK' } }] }); } });
  assert.equal(result.data, 'OK');
});
test('DeepSeek transcription disables its default thinking mode', () => {
  const request = P.buildRequest({ ...config, baseUrl: 'https://api.deepseek.com', openaiEndpoint: 'chat-completions' }, {}, 'test');
  assert.deepEqual(request.body.thinking, { type: 'disabled' });
});
