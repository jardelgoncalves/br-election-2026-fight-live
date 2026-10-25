import { Swords } from 'lucide-react';

import { formatTime } from '../lib/format';
import type { CombatEvent } from '../types';

export function CombatLog({ history }: { history: CombatEvent[] }) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords size={17} className="text-amber-300" />
          <h3 className="font-display text-[10px] uppercase tracking-[0.16em] text-white">Registro de golpes</h3>
        </div>
        <span className="font-mono text-[10px] text-white/30">últimos eventos</span>
      </div>
      {history.length === 0 ? (
        <div className="grid min-h-24 place-items-center border border-dashed border-white/10 text-center">
          <p className="max-w-sm text-xs leading-5 text-white/35">
            Os golpes aparecerão aqui quando novos lotes forem totalizados.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {history.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 border-l-2 border-amber-300/60 bg-white/[0.025] px-3 py-2">
              <div>
                <p className="font-display text-[9px] text-white">
                  {event.attacker} → {event.target} · {event.label}
                </p>
                <p className="mt-1 font-mono text-[10px] text-white/35">
                  {formatTime(event.createdAt)}
                </p>
              </div>
              <strong className="font-display text-xs text-amber-300">-{event.damage.toFixed(2)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
