import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolean(value, fallback = false) {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = Object.freeze({
  host: process.env.HOST ?? '127.0.0.1',
  port: positiveInteger(process.env.PORT, 3001),
  pollIntervalMs: positiveInteger(process.env.POLL_INTERVAL_MS, 5_000),
  tseResultsUrl:
    process.env.TSE_RESULTS_URL ??
    'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json',
  historyMemoryLimit: positiveInteger(process.env.HISTORY_MEMORY_LIMIT, 5_000),
  historyResponseLimit: positiveInteger(process.env.HISTORY_RESPONSE_LIMIT, 200),
  dataFile: resolve(backendRoot, process.env.DATA_FILE ?? 'data/snapshots.jsonl'),
  staticDir: resolve(backendRoot, process.env.STATIC_DIR ?? '../frontend/dist'),
  trustProxy: boolean(process.env.TRUST_PROXY),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  publicSiteUrl: process.env.PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? '',
  rateLimitWindowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMaxRequests: positiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 600),
  historyRateLimitMaxRequests: positiveInteger(process.env.HISTORY_RATE_LIMIT_MAX_REQUESTS, 60),
  maxSseClients: positiveInteger(process.env.MAX_SSE_CLIENTS, 2_000),
  maxSseClientsPerIp: positiveInteger(process.env.MAX_SSE_CLIENTS_PER_IP, 250),
  maxTseResponseBytes: positiveInteger(process.env.MAX_TSE_RESPONSE_BYTES, 5_000_000),
});
