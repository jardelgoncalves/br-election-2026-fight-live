import type { FighterPose } from '../types';

type FighterSpriteProps = {
  candidateNumber: string;
  pose: FighterPose;
  side: 'left' | 'right';
};

export function FighterSprite({ candidateNumber, pose, side }: FighterSpriteProps) {
  const candidate = candidateNumber === '13' ? 'lula' : 'flavio';
  const source = `/assets/fighters/${candidate}/${pose}.png`;

  return (
    <div
      aria-label={`Personagem do candidato ${candidateNumber}`}
      className={`fighter-sprite fighter-${side} fighter-${pose}`}
      style={{
        backgroundImage: `url(${source})`,
      }}
    />
  );
}
