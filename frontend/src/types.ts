export type Candidate = {
  number: string;
  name: string;
  displayName: string;
  party: string;
  coalition: string;
  votes: number;
  percentage: number;
  elected: boolean;
  status: string;
};

export type Fighter = {
  number: string;
  displayName: string;
  healthPoints: number;
  healthBarPercent: number;
  damageTaken: number;
};

export type ElectionSnapshot = {
  schemaVersion: number;
  source: string;
  collectedAt: string;
  generation: { id: string; date: string; time: string };
  election: {
    id: string;
    round: number;
    officeCode: string;
    office: string;
    finalized: boolean;
  };
  progress: {
    totalSections: number;
    countedSections: number;
    countedPercent: number;
    remainingSections: number;
    remainingPercent: number;
  };
  electorate: {
    total: number;
    counted: number;
    turnout: number;
    turnoutPercent: number;
    abstentions: number;
    abstentionPercent: number;
  };
  votes: { total: number; valid: number; blank: number; null: number };
  candidates: Candidate[];
  battle: { maxHealthPoints: number; fighters: Fighter[] } | null;
};

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';
export type FighterPose = 'idle' | 'windup' | 'attack' | 'hit' | 'victory' | 'defeat';

export type CombatEvent = {
  id: string;
  attacker: string;
  target: string;
  damage: number;
  label: string;
  kind: 'light' | 'heavy' | 'special' | 'ko';
  createdAt: string;
};
