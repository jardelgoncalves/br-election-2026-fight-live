import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class SnapshotStore {
  #filePath;
  #memoryLimit;
  #history = [];

  constructor(filePath, memoryLimit = 5_000) {
    this.#filePath = filePath;
    this.#memoryLimit = memoryLimit;
  }

  async initialize() {
    await mkdir(dirname(this.#filePath), { recursive: true });

    try {
      const contents = await readFile(this.#filePath, 'utf8');
      this.#history = contents
        .split('\n')
        .filter(Boolean)
        .slice(-this.#memoryLimit)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  get current() {
    return this.#history.at(-1) ?? null;
  }

  getHistory(limit = 100) {
    const safeLimit = Math.min(Math.max(1, limit), this.#memoryLimit);
    return this.#history.slice(-safeLimit);
  }

  async append(snapshot) {
    const isSameGeneration =
      snapshot.generation.id && snapshot.generation.id === this.current?.generation.id;
    const isSameSchema = snapshot.schemaVersion === this.current?.schemaVersion;

    if (isSameGeneration && isSameSchema) {
      return false;
    }

    await appendFile(this.#filePath, `${JSON.stringify(snapshot)}\n`, 'utf8');
    this.#history.push(snapshot);
    if (this.#history.length > this.#memoryLimit) this.#history.shift();
    return true;
  }
}
