function numberFromTse(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return 0;

  const normalized = value.includes(',')
    ? value.replaceAll('.', '').replace(',', '.')
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function candidatePercentage(candidate) {
  return numberFromTse(candidate.pvapn ?? candidate.pvap);
}

function extractCandidates(cargo) {
  const candidates = [];

  for (const group of cargo?.agr ?? []) {
    for (const party of group.par ?? []) {
      for (const candidate of party.cand ?? []) {
        candidates.push({
          number: String(candidate.n ?? ''),
          name: candidate.nm ?? '',
          displayName: candidate.nmu ?? candidate.nm ?? '',
          party: party.sg ?? party.sgp ?? '',
          coalition: group.com ?? group.nm ?? '',
          votes: numberFromTse(candidate.vap),
          percentage: candidatePercentage(candidate),
          elected: candidate.e === 's',
          status: candidate.st ?? '',
        });
      }
    }
  }

  return candidates.sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number));
}

function createBattleState(candidates, countedPercent) {
  if (candidates.length !== 2) return null;

  const progress = Math.min(1, Math.max(0, countedPercent / 100));

  return {
    maxHealthPoints: 50,
    fighters: candidates.map((candidate, index) => {
      const opponent = candidates[index === 0 ? 1 : 0];
      const healthPoints = Math.max(0, 50 - progress * opponent.percentage);

      return {
        number: candidate.number,
        displayName: candidate.displayName,
        healthPoints: Number(healthPoints.toFixed(4)),
        healthBarPercent: Number(((healthPoints / 50) * 100).toFixed(4)),
        damageTaken: Number((50 - healthPoints).toFixed(4)),
      };
    }),
  };
}

export function normalizeTseResult(raw, sourceUrl, collectedAt = new Date()) {
  const cargo = raw?.carg?.find((item) => String(item.cd) === '1') ?? raw?.carg?.[0];
  if (!cargo) throw new Error('O arquivo do TSE não contém o cargo presidencial');

  const sections = raw.s ?? {};
  const voters = raw.e ?? {};
  const votes = raw.v ?? {};
  const countedPercent = numberFromTse(sections.pstn ?? sections.pst);
  const candidates = extractCandidates(cargo);

  return {
    schemaVersion: 1,
    source: sourceUrl,
    collectedAt: collectedAt.toISOString(),
    generation: {
      id: String(raw.idg ?? ''),
      date: raw.dg ?? '',
      time: raw.hg ?? '',
    },
    election: {
      id: String(raw.ele ?? ''),
      round: numberFromTse(raw.t),
      officeCode: String(cargo.cd ?? ''),
      office: cargo.nmn ?? cargo.nmm ?? 'Presidente',
      finalized: raw.tf === 's' || raw.and === 'f',
    },
    progress: {
      totalSections: numberFromTse(sections.ts),
      countedSections: numberFromTse(sections.st),
      countedPercent,
      remainingSections: numberFromTse(sections.snt),
      remainingPercent: numberFromTse(sections.psntn ?? sections.psnt),
    },
    electorate: {
      total: numberFromTse(voters.te),
      counted: numberFromTse(voters.est),
      turnout: numberFromTse(voters.c),
      turnoutPercent: numberFromTse(voters.pcn ?? voters.pc),
      abstentions: numberFromTse(voters.a),
      abstentionPercent: numberFromTse(voters.pan ?? voters.pa),
    },
    votes: {
      total: numberFromTse(votes.tv),
      valid: numberFromTse(votes.vvc ?? votes.vv),
      blank: numberFromTse(votes.vb),
      null: numberFromTse(votes.vn),
    },
    candidates,
    battle: createBattleState(candidates, countedPercent),
  };
}

export { numberFromTse };
