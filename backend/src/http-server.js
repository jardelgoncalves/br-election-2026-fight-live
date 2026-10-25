import { createServer } from 'node:http';

import { FixedWindowRateLimiter } from './rate-limiter.js';
import { createStaticHandler } from './static-handler.js';

function corsHeaders(request, config) {
  const configured = config.corsOrigin ?? '*';
  if (configured === '*') return { 'access-control-allow-origin': '*' };

  const origin = request.headers.origin;
  const allowed = configured.split(',').map((value) => value.trim());
  return origin && allowed.includes(origin)
    ? { 'access-control-allow-origin': origin, vary: 'Origin' }
    : {};
}

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function writeJson(request, response, config, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    ...securityHeaders(),
    ...corsHeaders(request, config),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function clientIp(request, trustProxy) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = value?.split(',')[0]?.trim();
    if (first) return first;
  }

  return request.socket.remoteAddress ?? 'unknown';
}

function publicOrigin(request, config) {
  if (config.publicSiteUrl) {
    try {
      return new URL(config.publicSiteUrl).origin;
    } catch {
      return '';
    }
  }

  const forwardedProtocol = config.trustProxy
    ? request.headers['x-forwarded-proto']?.split(',')[0]?.trim()
    : null;
  const protocol = forwardedProtocol === 'https' ? 'https' : 'http';
  const host = request.headers.host ?? 'localhost';

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return '';
  }
}

function rateLimitHeaders(result) {
  return {
    'ratelimit-limit': String(result.limit),
    'ratelimit-remaining': String(result.remaining),
    'ratelimit-reset': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1_000))),
  };
}

export function createApiServer({ store, collector, eventBus, config }) {
  const apiLimiter = new FixedWindowRateLimiter({
    windowMs: config.rateLimitWindowMs ?? 60_000,
    limit: config.rateLimitMaxRequests ?? 600,
  });
  const historyLimiter = new FixedWindowRateLimiter({
    windowMs: config.rateLimitWindowMs ?? 60_000,
    limit: config.historyRateLimitMaxRequests ?? 60,
  });
  const serveStatic = config.staticDir ? createStaticHandler(config.staticDir) : null;

  const server = createServer(async (request, response) => {
    try {
      if ((request.url?.length ?? 0) > 2_048) {
        writeJson(request, response, config, 414, { error: 'uri_too_long' });
        return;
      }

      const url = new URL(request.url ?? '/', 'http://localhost');

      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          ...securityHeaders(),
          ...corsHeaders(request, config),
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        });
        response.end();
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        writeJson(request, response, config, 405, { error: 'method_not_allowed' }, { allow: 'GET, HEAD, OPTIONS' });
        return;
      }

      const isApiRequest = url.pathname === '/health' || url.pathname.startsWith('/api/');
      const ip = clientIp(request, config.trustProxy);
      let limitResult = null;
      if (isApiRequest) {
        limitResult = apiLimiter.consume(ip);
        if (!limitResult.allowed) {
          writeJson(request, response, config, 429, {
            error: 'rate_limit_exceeded',
            message: 'Muitas requisições. Tente novamente em instantes.',
          }, {
            ...rateLimitHeaders(limitResult),
            'retry-after': String(Math.max(1, Math.ceil((limitResult.resetAt - Date.now()) / 1_000))),
          });
          return;
        }
      }

      if (url.pathname === '/health') {
        writeJson(request, response, config, 200, {
          status: collector.status.lastError ? 'degraded' : 'ok',
          collector: collector.status,
          polling: {
            intervalMs: config.pollIntervalMs,
            source: config.tseResultsUrl,
          },
          sseClients: eventBus.size,
        }, rateLimitHeaders(limitResult));
        return;
      }

      if (url.pathname === '/api/v1/election') {
        if (!store.current) {
          writeJson(request, response, config, 503, {
            error: 'result_not_available',
            message: 'O coletor ainda não recebeu um resultado válido do TSE.',
          }, rateLimitHeaders(limitResult));
          return;
        }

        writeJson(request, response, config, 200, store.current, {
          ...rateLimitHeaders(limitResult),
          'cache-control': 'public, max-age=2, stale-while-revalidate=8',
        });
        return;
      }

      if (url.pathname === '/api/v1/election/history') {
        const historyLimitResult = historyLimiter.consume(ip);
        if (!historyLimitResult.allowed) {
          writeJson(request, response, config, 429, {
            error: 'history_rate_limit_exceeded',
            message: 'Muitas consultas ao histórico. Tente novamente em instantes.',
          }, {
            ...rateLimitHeaders(historyLimitResult),
            'retry-after': String(Math.max(1, Math.ceil((historyLimitResult.resetAt - Date.now()) / 1_000))),
          });
          return;
        }

        const defaultLimit = 50;
        const maximumLimit = config.historyResponseLimit ?? 200;
        const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? String(defaultLimit), 10);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(Math.max(1, requestedLimit), maximumLimit)
          : defaultLimit;
        const items = store.getHistory(limit);
        writeJson(request, response, config, 200, { count: items.length, items }, {
          ...rateLimitHeaders(historyLimitResult),
          'cache-control': 'public, max-age=5, stale-while-revalidate=15',
        });
        return;
      }

      if (url.pathname === '/api/v1/events') {
        const perIpLimit = config.maxSseClientsPerIp ?? 250;
        if (eventBus.countForIp(ip) >= perIpLimit) {
          writeJson(request, response, config, 429, {
            error: 'too_many_streams',
            message: 'Limite de conexões ao vivo atingido para esta rede.',
          }, { 'retry-after': '15' });
          return;
        }

        if (eventBus.size >= (config.maxSseClients ?? 2_000)) {
          writeJson(request, response, config, 503, {
            error: 'stream_capacity_reached',
            message: 'O placar ao vivo está temporariamente lotado.',
          }, { 'retry-after': '15' });
          return;
        }

        response.writeHead(200, {
          ...securityHeaders(),
          ...corsHeaders(request, config),
          ...rateLimitHeaders(limitResult),
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        response.write(`retry: 10000\nevent: connected\ndata: ${JSON.stringify({ current: store.current })}\n\n`);
        eventBus.add(response, ip);

        const heartbeat = setInterval(() => {
          if (!response.write(': heartbeat\n\n')) response.destroy();
        }, 20_000);
        response.on('close', () => {
          clearInterval(heartbeat);
          eventBus.remove(response);
        });
        return;
      }

      if (!isApiRequest && serveStatic && await serveStatic(url.pathname, response, publicOrigin(request, config))) return;

      writeJson(request, response, config, 404, { error: 'not_found' });
    } catch (error) {
      console.error('[api]', error.message);
      if (response.headersSent) response.destroy();
      else writeJson(request, response, config, 500, { error: 'internal_server_error' });
    }
  });

  server.maxHeadersCount = 100;
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxConnections = (config.maxSseClients ?? 2_000) + 500;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  return server;
}
