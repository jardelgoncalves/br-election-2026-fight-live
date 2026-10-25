import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { EventBus } from '../src/event-bus.js';
import { createApiServer } from '../src/http-server.js';

test('expõe health, resultado atual e histórico', async (context) => {
  const current = {
    generation: { id: '42' },
    progress: { countedPercent: 50 },
  };
  const store = {
    current,
    getHistory: (limit) => [current].slice(-limit),
  };
  const collector = {
    status: {
      state: 'running',
      lastError: null,
    },
  };
  const eventBus = new EventBus();
  const config = {
    pollIntervalMs: 5_000,
    tseResultsUrl: 'https://example.test/result.json',
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 600,
    historyRateLimitMaxRequests: 60,
    historyResponseLimit: 200,
    maxSseClients: 2_000,
    maxSseClientsPerIp: 250,
  };
  const server = createApiServer({ store, collector, eventBus, config });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/health`);
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.status, 'ok');
  assert.equal(health.polling.intervalMs, 5_000);

  const currentResponse = await fetch(`${baseUrl}/api/v1/election`);
  assert.deepEqual(await currentResponse.json(), current);

  const historyResponse = await fetch(`${baseUrl}/api/v1/election/history?limit=10`);
  const history = await historyResponse.json();
  assert.equal(history.count, 1);
  assert.deepEqual(history.items, [current]);
});

test('aplica rate limit sem compartilhar cotas entre IPs confiáveis', async (context) => {
  const store = { current: { generation: { id: '42' } }, getHistory: () => [] };
  const collector = { status: { state: 'running', lastError: null } };
  const eventBus = new EventBus();
  const config = {
    pollIntervalMs: 5_000,
    tseResultsUrl: 'https://example.test/result.json',
    trustProxy: true,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 2,
    historyRateLimitMaxRequests: 2,
  };
  const server = createApiServer({ store, collector, eventBus, config });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headersA = { 'x-forwarded-for': '203.0.113.1' };
  const headersB = { 'x-forwarded-for': '203.0.113.2' };

  assert.equal((await fetch(`${baseUrl}/health`, { headers: headersA })).status, 200);
  assert.equal((await fetch(`${baseUrl}/health`, { headers: headersA })).status, 200);
  const limited = await fetch(`${baseUrl}/health`, { headers: headersA });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after') !== null, true);
  assert.equal((await fetch(`${baseUrl}/health`, { headers: headersB })).status, 200);
});

test('limita o tamanho do histórico retornado', async (context) => {
  let receivedLimit = null;
  const store = {
    current: { generation: { id: '42' } },
    getHistory: (limit) => {
      receivedLimit = limit;
      return [];
    },
  };
  const collector = { status: { state: 'running', lastError: null } };
  const server = createApiServer({
    store,
    collector,
    eventBus: new EventBus(),
    config: {
      pollIntervalMs: 5_000,
      tseResultsUrl: 'https://example.test/result.json',
      historyResponseLimit: 25,
    },
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/election/history?limit=999999`);
  assert.equal(response.status, 200);
  assert.equal(receivedLimit, 25);
});

test('limita streams simultâneos por rede sem bloquear a API comum', async (context) => {
  const store = { current: { generation: { id: '42' } }, getHistory: () => [] };
  const collector = { status: { state: 'running', lastError: null } };
  const eventBus = new EventBus();
  const server = createApiServer({
    store,
    collector,
    eventBus,
    config: {
      pollIntervalMs: 5_000,
      tseResultsUrl: 'https://example.test/result.json',
      trustProxy: true,
      maxSseClients: 10,
      maxSseClientsPerIp: 1,
    },
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => {
    eventBus.closeAll();
    return new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'x-forwarded-for': '203.0.113.10' };
  const firstStream = await fetch(`${baseUrl}/api/v1/events`, { headers });
  assert.equal(firstStream.status, 200);

  const rejectedStream = await fetch(`${baseUrl}/api/v1/events`, { headers });
  assert.equal(rejectedStream.status, 429);
  assert.equal((await fetch(`${baseUrl}/api/v1/election`, { headers })).status, 200);

  await firstStream.body.cancel();
});

test('serve metadados sociais com a origem pública absoluta', async (context) => {
  const staticDirectory = await mkdtemp(join(tmpdir(), 'election-static-'));
  await writeFile(
    join(staticDirectory, 'index.html'),
    '<meta property="og:url" content="__PUBLIC_ORIGIN__/"><meta property="og:image" content="__PUBLIC_ORIGIN__/og.png">',
  );

  const server = createApiServer({
    store: { current: null, getHistory: () => [] },
    collector: { status: { state: 'running', lastError: null } },
    eventBus: new EventBus(),
    config: {
      staticDir: staticDirectory,
      publicSiteUrl: 'https://apuracaofight.example/path-ignorado',
    },
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /https:\/\/apuracaofight\.example\/og\.png/);
  assert.doesNotMatch(html, /__PUBLIC_ORIGIN__/);

  const headResponse = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'HEAD' });
  assert.equal(headResponse.status, 200);
  assert.equal(await headResponse.text(), '');
});
