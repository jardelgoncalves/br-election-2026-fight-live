export class FixedWindowRateLimiter {
  #entries = new Map();
  #windowMs;
  #limit;
  #maxEntries;
  #checks = 0;

  constructor({ windowMs, limit, maxEntries = 50_000 }) {
    this.#windowMs = windowMs;
    this.#limit = limit;
    this.#maxEntries = maxEntries;
  }

  consume(key, now = Date.now()) {
    this.#checks += 1;
    if (this.#checks % 1_000 === 0) this.#sweep(now);

    const current = this.#entries.get(key);
    if (!current || current.resetAt <= now) {
      if (!current && this.#entries.size >= this.#maxEntries) {
        return { allowed: false, limit: this.#limit, remaining: 0, resetAt: now + this.#windowMs };
      }

      const next = { count: 1, resetAt: now + this.#windowMs };
      this.#entries.set(key, next);
      return { allowed: true, limit: this.#limit, remaining: this.#limit - 1, resetAt: next.resetAt };
    }

    current.count += 1;
    return {
      allowed: current.count <= this.#limit,
      limit: this.#limit,
      remaining: Math.max(0, this.#limit - current.count),
      resetAt: current.resetAt,
    };
  }

  #sweep(now) {
    for (const [key, entry] of this.#entries) {
      if (entry.resetAt <= now) this.#entries.delete(key);
    }
  }
}
