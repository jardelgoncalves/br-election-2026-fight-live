import { useEffect, useState } from 'react';

import type { ConnectionState, ElectionSnapshot } from '../types';

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function apiUrl(path: string) {
  return `${apiBase}${path}`;
}

export function useElectionStream() {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch(apiUrl('/api/v1/election'))
      .then(async (response) => {
        if (!response.ok) throw new Error('Aguardando o primeiro resultado do TSE');
        return response.json() as Promise<ElectionSnapshot>;
      })
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });

    const events = new EventSource(apiUrl('/api/v1/events'));

    events.addEventListener('open', () => {
      if (!active) return;
      setConnection('live');
      setError(null);
    });

    events.addEventListener('connected', (event) => {
      if (!active) return;
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        current: ElectionSnapshot | null;
      };
      if (payload.current) setSnapshot(payload.current);
    });

    events.addEventListener('election-update', (event) => {
      if (!active) return;
      setSnapshot(JSON.parse((event as MessageEvent<string>).data) as ElectionSnapshot);
      setConnection('live');
      setError(null);
    });

    events.onerror = () => {
      if (!active) return;
      setConnection(navigator.onLine ? 'reconnecting' : 'offline');
      setError('Reconectando ao placar ao vivo');
    };

    return () => {
      active = false;
      events.close();
    };
  }, []);

  return { snapshot, connection, error };
}
