import { normalizeTseResult } from './tse-normalizer.js';

async function readBodyWithLimit(response, maximumBytes) {
  if (!response.body) throw new Error('Resposta do TSE sem corpo');

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error(`Resposta do TSE excede ${maximumBytes} bytes`);
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, totalBytes).toString('utf8');
}

export class TseCollector {
  #url;
  #intervalMs;
  #store;
  #eventBus;
  #maxResponseBytes;
  #timer = null;
  #running = false;
  #etag = null;
  #lastModified = null;

  status = {
    state: 'idle',
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastChangeAt: null,
    lastError: null,
    consecutiveFailures: 0,
    nextAttemptAt: null,
  };

  constructor({ url, intervalMs, store, eventBus, maxResponseBytes = 5_000_000 }) {
    this.#url = url;
    this.#intervalMs = intervalMs;
    this.#store = store;
    this.#eventBus = eventBus;
    this.#maxResponseBytes = maxResponseBytes;
  }

  start() {
    if (this.status.state === 'running') return;
    this.status.state = 'running';
    void this.#runLoop();
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.status.state = 'stopped';
    this.status.nextAttemptAt = null;
  }

  async #runLoop() {
    await this.collect();
    if (this.status.state !== 'running') return;

    const multiplier = 2 ** Math.min(this.status.consecutiveFailures, 4);
    const delay = Math.min(60_000, this.#intervalMs * multiplier);
    this.status.nextAttemptAt = new Date(Date.now() + delay).toISOString();
    this.#timer = setTimeout(() => void this.#runLoop(), delay);
  }

  async collect() {
    if (this.#running) return;
    this.#running = true;
    this.status.lastAttemptAt = new Date().toISOString();

    try {
      const headers = {
        accept: 'application/json',
        'user-agent': 'apuracao-fight/1.0 (+public-election-dashboard)',
      };
      if (this.#etag) headers['if-none-match'] = this.#etag;
      if (this.#lastModified) headers['if-modified-since'] = this.#lastModified;

      const response = await fetch(this.#url, {
        headers,
        signal: AbortSignal.timeout(4_000),
      });

      if (response.status === 304) {
        this.status.lastSuccessAt = new Date().toISOString();
        this.status.lastError = null;
        this.status.consecutiveFailures = 0;
        return;
      }

      if (!response.ok) throw new Error(`TSE respondeu HTTP ${response.status}`);

      this.#etag = response.headers.get('etag') ?? this.#etag;
      this.#lastModified = response.headers.get('last-modified') ?? this.#lastModified;

      const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10);
      if (declaredLength > this.#maxResponseBytes) {
        throw new Error(`Resposta do TSE excede ${this.#maxResponseBytes} bytes`);
      }

      const body = await readBodyWithLimit(response, this.#maxResponseBytes);
      const raw = JSON.parse(body);
      const snapshot = normalizeTseResult(raw, this.#url);
      const changed = await this.#store.append(snapshot);

      this.status.lastSuccessAt = new Date().toISOString();
      this.status.lastError = null;
      this.status.consecutiveFailures = 0;

      if (changed) {
        this.status.lastChangeAt = snapshot.collectedAt;
        this.#eventBus.publish('election-update', snapshot);
      }
    } catch (error) {
      this.status.consecutiveFailures += 1;
      this.status.lastError = {
        message: error.message,
        at: new Date().toISOString(),
      };
      console.error('[collector]', error.message);
    } finally {
      this.#running = false;
    }
  }
}
