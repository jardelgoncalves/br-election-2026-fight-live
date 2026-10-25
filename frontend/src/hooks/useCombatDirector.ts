import { useCallback, useEffect, useRef, useState } from 'react';

import type { CombatEvent, ElectionSnapshot, FighterPose } from '../types';

type PoseMap = Record<string, FighterPose>;

function classifyDamage(damage: number): CombatEvent['kind'] {
  if (damage >= 1) return 'special';
  if (damage >= 0.25) return 'heavy';
  return 'light';
}

function attackLabel(kind: CombatEvent['kind']) {
  if (kind === 'ko') return 'K.O.';
  if (kind === 'special') return 'GOLPE ESPECIAL';
  if (kind === 'heavy') return 'GOLPE FORTE';
  return 'ATAQUE';
}

export function useCombatDirector(
  snapshot: ElectionSnapshot | null,
  playAttack: (event: CombatEvent) => void,
) {
  const previousRef = useRef<ElectionSnapshot | null>(null);
  const timersRef = useRef<number[]>([]);
  const [poses, setPoses] = useState<PoseMap>({});
  const [activeEvent, setActiveEvent] = useState<CombatEvent | null>(null);
  const [history, setHistory] = useState<CombatEvent[]>([]);

  const perform = useCallback(
    (event: CombatEvent) => {
      setActiveEvent(event);
      setHistory((current) => [event, ...current].slice(0, 6));
      setPoses({ [event.attacker]: 'windup', [event.target]: 'idle' });

      const attackTimer = window.setTimeout(() => {
        setPoses({ [event.attacker]: 'attack', [event.target]: 'hit' });
        playAttack(event);
      }, 160);
      const resetTimer = window.setTimeout(() => {
        setPoses({});
        setActiveEvent(null);
      }, 950);
      timersRef.current.push(attackTimer, resetTimer);
    },
    [playAttack],
  );

  useEffect(() => {
    if (!snapshot?.battle) return;
    const previous = previousRef.current;
    previousRef.current = snapshot;
    if (!previous?.battle || previous.generation.id === snapshot.generation.id) return;

    const events: CombatEvent[] = [];
    for (const fighter of snapshot.battle.fighters) {
      const oldFighter = previous.battle.fighters.find((item) => item.number === fighter.number);
      if (!oldFighter) continue;
      const damage = oldFighter.healthPoints - fighter.healthPoints;
      if (damage <= 0.0001) continue;

      const attacker = snapshot.battle.fighters.find((item) => item.number !== fighter.number);
      if (!attacker) continue;
      const kind: CombatEvent['kind'] = fighter.healthPoints === 0 ? 'ko' : classifyDamage(damage);
      events.push({
        id: `${snapshot.generation.id}-${fighter.number}`,
        attacker: attacker.number,
        target: fighter.number,
        damage: Number(damage.toFixed(2)),
        kind,
        label: attackLabel(kind),
        createdAt: snapshot.collectedAt,
      });
    }

    events.forEach((event, index) => {
      const timer = window.setTimeout(() => perform(event), index * 1_050);
      timersRef.current.push(timer);
    });
  }, [perform, snapshot]);

  useEffect(
    () => () => {
      timersRef.current.forEach(window.clearTimeout);
    },
    [],
  );

  return { poses, activeEvent, history };
}
