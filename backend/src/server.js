import { config } from './config.js';
import { EventBus } from './event-bus.js';
import { createApiServer } from './http-server.js';
import { SnapshotStore } from './snapshot-store.js';
import { TseCollector } from './tse-collector.js';

const store = new SnapshotStore(config.dataFile, config.historyMemoryLimit);
await store.initialize();

const eventBus = new EventBus();
const collector = new TseCollector({
  url: config.tseResultsUrl,
  intervalMs: config.pollIntervalMs,
  store,
  eventBus,
  maxResponseBytes: config.maxTseResponseBytes,
});

const server = createApiServer({ store, collector, eventBus, config });

server.listen(config.port, config.host, () => {
  console.log(`[api] http://${config.host}:${config.port}`);
  console.log(`[collector] ${config.tseResultsUrl} a cada ${config.pollIntervalMs}ms`);
  collector.start();
});

function shutdown(signal) {
  console.log(`[api] encerrando por ${signal}`);
  collector.stop();
  eventBus.closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
