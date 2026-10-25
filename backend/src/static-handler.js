import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
  };
}

export function createStaticHandler(rootDirectory) {
  const root = resolve(rootDirectory);
  const cache = new Map();

  return async function serveStatic(pathname, response, publicOrigin = '') {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      return false;
    }

    const requested = decodedPath === '/' ? '/index.html' : decodedPath;
    const candidate = resolve(root, `.${requested}`);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return false;

    let filePath = candidate;
    try {
      if (!(await stat(filePath)).isFile()) {
        if (extname(requested)) return false;
        filePath = resolve(root, 'index.html');
      }
    } catch {
      if (extname(requested)) return false;
      filePath = resolve(root, 'index.html');
    }

    try {
      let source = cache.get(filePath);
      if (!source) {
        source = await readFile(filePath);
        cache.set(filePath, source);
      }

      const body = extname(filePath).toLowerCase() === '.html' && publicOrigin
        ? Buffer.from(source.toString('utf8').replaceAll('__PUBLIC_ORIGIN__', publicOrigin))
        : source;

      const isHashedAsset = requested.startsWith('/assets/') && /-[A-Za-z0-9_-]{6,}\./.test(requested);
      response.writeHead(200, {
        ...securityHeaders(),
        'content-type': contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'content-length': body.length,
        'cache-control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      response.end(response.req.method === 'HEAD' ? undefined : body);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  };
}
