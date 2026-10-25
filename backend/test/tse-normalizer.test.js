import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeTseResult, numberFromTse } from '../src/tse-normalizer.js';

test('converte números no formato usado pelo TSE', () => {
  assert.equal(numberFromTse('53,25'), 53.25);
  assert.equal(numberFromTse('1.234,56'), 1234.56);
  assert.equal(numberFromTse('499248'), 499248);
});

test('normaliza candidatos e calcula o HP usando a apuração', () => {
  const raw = {
    ele: '6258',
    t: '2',
    idg: '42',
    dg: '25/10/2026',
    hg: '18:00:00',
    s: { ts: '100', st: '50', pst: '50,00', snt: '50', psnt: '50,00' },
    e: { te: '1000', est: '500', c: '400', pc: '80,00', a: '100', pa: '20,00' },
    v: { tv: '400', vvc: '380', vb: '10', vn: '10' },
    carg: [
      {
        cd: '1',
        nmn: 'Presidente',
        agr: [
          {
            com: 'PARTIDO A',
            par: [
              {
                sg: 'PA',
                cand: [{ n: '13', nm: 'CANDIDATO A', nmu: 'A', vap: '201', pvap: '53,00' }],
              },
            ],
          },
          {
            com: 'PARTIDO B',
            par: [
              {
                sg: 'PB',
                cand: [{ n: '22', nm: 'CANDIDATO B', nmu: 'B', vap: '179', pvap: '47,00' }],
              },
            ],
          },
        ],
      },
    ],
  };

  const snapshot = normalizeTseResult(raw, 'https://example.test/result.json', new Date('2026-10-25T21:00:00Z'));

  assert.equal(snapshot.progress.countedPercent, 50);
  assert.equal(snapshot.candidates[0].displayName, 'A');
  assert.equal(snapshot.candidates[0].party, 'PA');
  assert.equal(snapshot.battle.fighters[0].healthPoints, 26.5);
  assert.equal(snapshot.battle.fighters[1].healthPoints, 23.5);

  raw.s.st = '100';
  raw.s.pst = '100,00';
  raw.s.snt = '0';
  raw.s.psnt = '0,00';
  const finalSnapshot = normalizeTseResult(raw, 'https://example.test/result.json');

  assert.equal(finalSnapshot.battle.fighters[0].healthPoints, 3);
  assert.equal(finalSnapshot.battle.fighters[1].healthPoints, 0);
});
