import { formatNumber, formatPercent } from '../lib/format';
import type { Candidate, Fighter } from '../types';
import { HealthBar } from './HealthBar';

type FighterHudProps = {
  candidate: Candidate;
  fighter: Fighter;
  side: 'left' | 'right';
};

export function FighterHud({ candidate, fighter, side }: FighterHudProps) {
  const accent = candidate.number === '13' ? 'red' : 'green';
  const partyLogo = candidate.party === 'PT' ? '/assets/parties/pt.png' : '/assets/parties/pl.jpg';

  return (
    <article className={`min-w-0 ${side === 'right' ? 'text-right' : ''}`}>
      <div className={`mb-2 flex items-end gap-3 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        <span className="h-10 w-10 shrink-0 overflow-hidden border-2 border-white/70 bg-white shadow-lg sm:h-12 sm:w-12">
          <img
            src={partyLogo}
            alt={`Logo do ${candidate.party}`}
            className="h-full w-full object-cover"
          />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[8px] uppercase tracking-[0.18em] text-white/45 sm:text-[9px]">
            {candidate.party}
          </p>
          <h2 className="truncate font-display text-sm uppercase text-white sm:text-xl lg:text-2xl">
            {candidate.displayName}
          </h2>
        </div>
      </div>
      <HealthBar
        value={fighter.healthBarPercent}
        health={fighter.healthPoints}
        align={side}
        accent={accent}
      />
      <div className={`mt-2 flex items-center gap-3 text-xs ${side === 'right' ? 'justify-end' : ''}`}>
        <strong className="font-display text-sm text-white sm:text-lg">{formatPercent(candidate.percentage)}</strong>
        <span className="font-mono text-white/50">{formatNumber(candidate.votes)} votos</span>
      </div>
    </article>
  );
}
