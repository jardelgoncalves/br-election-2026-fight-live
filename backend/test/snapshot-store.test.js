import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { SnapshotStore } from '../src/snapshot-store.js';

test('persiste apenas uma vez cada geração do TSE', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'election-store-'));
  const file = join(directory, 'snapshots.jsonl');
  const store = new SnapshotStore(file, 10);
  await store.initialize();

  const snapshot = { generation: { id: '123' }, collectedAt: '2026-10-25T21:00:00.000Z' };
  assert.equal(await store.append(snapshot), true);
  assert.equal(await store.append(snapshot), false);
  assert.equal(store.getHistory(10).length, 1);

  const lines = (await readFile(file, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
});

test('aceita reprocessar uma geração quando o schema muda', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'election-store-schema-'));
  const file = join(directory, 'snapshots.jsonl');
  const store = new SnapshotStore(file, 10);
  await store.initialize();

  assert.equal(await store.append({ schemaVersion: 1, generation: { id: '123' } }), true);
  assert.equal(await store.append({ schemaVersion: 2, generation: { id: '123' } }), true);
  assert.equal(store.getHistory(10).length, 2);
});
