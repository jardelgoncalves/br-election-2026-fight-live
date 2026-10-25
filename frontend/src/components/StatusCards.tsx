import { BarChart3, CheckCircle2, UsersRound } from 'lucide-react';

import { formatNumber, formatPercent } from '../lib/format';
import type { ElectionSnapshot } from '../types';

export function StatusCards({ snapshot }: { snapshot: ElectionSnapshot }) {
  const cards = [
    {
      label: 'Seções totalizadas',
      value: formatNumber(snapshot.progress.countedSections),
      detail: `de ${formatNumber(snapshot.progress.totalSections)}`,
      icon: CheckCircle2,
    },
    {
      label: 'Votos válidos',
      value: formatNumber(snapshot.votes.valid),
      detail: `${formatNumber(snapshot.votes.blank)} brancos`,
      icon: BarChart3,
    },
    {
      label: 'Comparecimento',
      value: formatNumber(snapshot.electorate.turnout),
      detail: formatPercent(snapshot.electorate.turnoutPercent),
      icon: UsersRound,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {cards.map(({ label, value, detail, icon: Icon }) => (
        <article key={label} className="panel flex items-center gap-4 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center border border-cyan-300/25 bg-cyan-300/5 text-cyan-200">
            <Icon size={19} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
            <p className="mt-1 truncate font-display text-sm text-white">{value}</p>
            <p className="mt-1 font-mono text-[10px] text-white/35">{detail}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
