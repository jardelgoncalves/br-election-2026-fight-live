import { useMemo } from 'react';
import { Database, Gauge, Radio, RotateCcw, Swords, Volume2, VolumeX } from 'lucide-react';

import { CombatLog } from './components/CombatLog';
import { FighterHud } from './components/FighterHud';
import { FighterSprite } from './components/FighterSprite';
import { StatusCards } from './components/StatusCards';
import { useArcadeAudio } from './hooks/useArcadeAudio';
import { useCombatDirector } from './hooks/useCombatDirector';
import { useElectionStream } from './hooks/useElectionStream';
import { formatPercent, formatTime } from './lib/format';
import type { Candidate, Fighter, FighterPose } from './types';

const fallbackCandidates: Candidate[] = [
  { number: '13', name: 'LULA', displayName: 'LULA', party: 'PT', coalition: '', votes: 0, percentage: 0, elected: false, status: '' },
  { number: '22', name: 'FLÁVIO BOLSONARO', displayName: 'FLÁVIO BOLSONARO', party: 'PL', coalition: '', votes: 0, percentage: 0, elected: false, status: '' },
];

const fallbackFighters: Fighter[] = fallbackCandidates.map((candidate) => ({
  number: candidate.number,
  displayName: candidate.displayName,
  healthPoints: 50,
  healthBarPercent: 100,
  damageTaken: 0,
}));

export default function App() {
  const { snapshot, connection, error } = useElectionStream();
  const audio = useArcadeAudio();
  const combat = useCombatDirector(snapshot, audio.playAttack);

  const candidates = snapshot?.candidates.length === 2 ? snapshot.candidates : fallbackCandidates;
  const fighters = snapshot?.battle?.fighters.length === 2 ? snapshot.battle.fighters : fallbackFighters;
  const progress = snapshot?.progress.countedPercent ?? 0;

  const fighterData = useMemo(
    () =>
      candidates.map((candidate, index) => ({
        candidate,
        fighter: fighters.find((fighter) => fighter.number === candidate.number) ?? fallbackFighters[index],
      })),
    [candidates, fighters],
  );

  function poseFor(number: string): FighterPose {
    if (combat.poses[number]) return combat.poses[number];
    const fighter = fighters.find((item) => item.number === number);
    if (fighter?.healthPoints === 0 && progress === 100) return 'defeat';
    if (snapshot?.election.finalized && fighter && fighter.healthPoints > 0) return 'victory';
    return 'idle';
  }

  return (
    <div className="app-shell min-h-screen overflow-hidden bg-[#070910] text-white">
      <div className="scanlines pointer-events-none fixed inset-0 z-50 opacity-20" />

      <header className="relative z-20 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="brand-lockup" aria-label="Apuração Fight Brasil 2026">
            <div className="brand-emblem" aria-hidden="true">
              <span className="brand-emblem-red" />
              <span className="brand-emblem-green" />
              <Swords className="brand-emblem-swords" size={25} strokeWidth={2.8} />
              <span className="brand-emblem-vs">VS</span>
            </div>
            <div className="brand-wordmark">
              <p className="brand-kicker">
                <span>Brasil 2026</span>
                <span className="brand-kicker-line" />
                <span>Contagem oficial</span>
              </p>
              <h1 className="brand-name">
                <span>Apuração</span>
                <strong>Fight</strong>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
              <span className={`h-2 w-2 rounded-full ${connection === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                {connection === 'live' ? 'Ao vivo' : 'Reconectando'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void audio.toggle()}
              className={`icon-button ${audio.enabled ? 'border-emerald-400/40 text-emerald-300' : ''}`}
              aria-label={audio.enabled ? 'Desativar música e efeitos' : 'Ativar música e efeitos'}
              title={audio.enabled ? 'Desativar música e efeitos' : 'Ativar música e efeitos'}
            >
              {audio.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1500px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <section className="mb-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3 sm:gap-6">
          <FighterHud {...fighterData[0]} side="left" />
          <div className="pb-4 text-center">
            <p className="font-display text-[8px] uppercase tracking-[0.18em] text-white/40">2º turno</p>
            <p className="mt-1 font-display text-lg text-amber-300 sm:text-3xl">VS</p>
          </div>
          <FighterHud {...fighterData[1]} side="right" />
        </section>

        <section className="arena relative overflow-hidden border border-cyan-300/20 bg-[#0b1020] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
          <div className="arena-sky absolute inset-0" />

          <div className="absolute left-1/2 top-5 z-20 w-[min(88%,620px)] -translate-x-1/2 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Radio size={13} className={connection === 'live' ? 'text-emerald-300' : 'text-amber-300'} />
              <span className="font-display text-[8px] uppercase tracking-[0.18em] text-white/55">
                {progress === 0 ? 'Aguardando início da totalização' : `${formatPercent(progress)} das seções`}
              </span>
            </div>
            <div className="h-2 overflow-hidden border border-white/20 bg-black/60 p-[1px]">
              <div className="h-full bg-gradient-to-r from-cyan-500 via-sky-300 to-white transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {combat.activeEvent && (
            <div className="combat-callout pointer-events-none absolute left-1/2 top-[28%] z-30 -translate-x-1/2 text-center">
              <p className="font-display text-lg uppercase text-amber-300 drop-shadow-[3px_3px_0_#9a3412] sm:text-3xl">
                {combat.activeEvent.label}
              </p>
              <p className="mt-2 font-display text-xs text-white">-{combat.activeEvent.damage.toFixed(2)} HP</p>
            </div>
          )}

          <div className="absolute inset-x-[2%] bottom-[8%] z-10 flex items-end justify-between sm:inset-x-[18%] lg:inset-x-[20%]">
            <FighterSprite candidateNumber="13" pose={poseFor('13')} side="left" />
            <FighterSprite candidateNumber="22" pose={poseFor('22')} side="right" />
          </div>

          <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center">
            <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-md">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
                atualização {formatTime(snapshot?.collectedAt)} · geração {snapshot?.generation.id || '—'}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-3 flex items-center justify-center gap-2 border border-amber-300/15 bg-amber-300/5 px-4 py-2 text-center font-mono text-[10px] text-amber-200/70">
            <RotateCcw size={12} className="animate-spin" /> {error}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div>{snapshot ? <StatusCards snapshot={snapshot} /> : <LoadingCards />}</div>
          <CombatLog history={combat.history} />
        </div>

        <footer className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2 font-mono text-[10px] text-white/35">
            <Database size={13} /> Dados oficiais do Tribunal Superior Eleitoral
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-white/35">
            <Gauge size={13} /> Atualização automática a cada 5 segundos
          </div>
        </footer>
      </main>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="panel h-[74px] animate-pulse bg-white/[0.025]" />
      ))}
    </div>
  );
}
