export class EventBus {
  #clients = new Map();

  add(response, clientIp) {
    this.#clients.set(response, clientIp);
  }

  remove(response) {
    this.#clients.delete(response);
  }

  publish(event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.#clients.keys()) {
      try {
        if (!client.write(message)) {
          this.remove(client);
          client.destroy();
        }
      } catch {
        this.remove(client);
        client.destroy();
      }
    }
  }

  countForIp(clientIp) {
    let count = 0;
    for (const ip of this.#clients.values()) {
      if (ip === clientIp) count += 1;
    }
    return count;
  }

  closeAll() {
    for (const client of this.#clients.keys()) client.end();
    this.#clients.clear();
  }

  get size() {
    return this.#clients.size;
  }
}
