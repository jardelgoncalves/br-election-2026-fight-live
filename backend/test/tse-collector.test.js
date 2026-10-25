import assert from 'node:assert/strict';
import test from 'node:test';

import { TseCollector } from '../src/tse-collector.js';

test('interrompe respostas do TSE maiores que o limite configurado', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  context.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  console.error = () => {};
  globalThis.fetch = async () => new Response('x'.repeat(64), { status: 200 });
  const collector = new TseCollector({
    url: 'https://example.test/result.json',
    intervalMs: 5_000,
    maxResponseBytes: 16,
    store: { append: async () => true },
    eventBus: { publish: () => {} },
  });

  await collector.collect();

  assert.equal(collector.status.consecutiveFailures, 1);
  assert.match(collector.status.lastError.message, /excede 16 bytes/);
});
