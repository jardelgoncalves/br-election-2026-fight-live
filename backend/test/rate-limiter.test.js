import assert from 'node:assert/strict';
import test from 'node:test';

import { FixedWindowRateLimiter } from '../src/rate-limiter.js';

test('limita por chave e libera novamente na próxima janela', () => {
  const limiter = new FixedWindowRateLimiter({ windowMs: 1_000, limit: 2 });

  assert.equal(limiter.consume('rede-a', 0).allowed, true);
  assert.equal(limiter.consume('rede-a', 10).allowed, true);
  assert.equal(limiter.consume('rede-a', 20).allowed, false);
  assert.equal(limiter.consume('rede-b', 20).allowed, true);
  assert.equal(limiter.consume('rede-a', 1_001).allowed, true);
});
