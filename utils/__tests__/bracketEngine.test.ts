/**
 * bracketEngine.test.ts
 *
 * Behavioural tests for the pure bracket engine (bracketGenerator + doubleElimLogic).
 *
 * The core of this suite is `playRandomTournament`, which plays a bracket through
 * to completion by repeatedly picking an available match and choosing a winner.
 * Every finished tournament is then checked against `assertTournamentInvariants`.
 *
 * This matters because the engine's failure mode is *silent*: a bug in the bye
 * propagation can auto-resolve a real match as a bye, eliminating a player who
 * never got to play. Nothing throws — the bracket just produces wrong standings.
 * Only the end-state invariants catch it.
 */

import { generateDoubleElimBracket } from '../bracketGenerator';
import {
  getAvailableMatches,
  recordResult,
  rescoreMatch,
} from '../doubleElimLogic';
import { Participant, Tournament } from '../../types/tournament';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeParticipants(n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    wins: 0,
    losses: 0,
    eliminated: false,
    placement: null,
  }));
}

function makeTournament(n: number): Tournament {
  const participants = makeParticipants(n);
  return {
    id: 't1',
    name: 'Test Cup',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    format: 'double-elimination',
    participants,
    matches: generateDoubleElimBracket(participants),
    needsGrandFinalReset: false,
  };
}

/** Deterministic PRNG so any failure is reproducible from its seed. */
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Plays a tournament to completion, picking a random available match each step
 * and a random winner. Throws if the bracket deadlocks (no available matches
 * while still incomplete), which is itself a bug worth failing on.
 */
function playRandomTournament(n: number, seed: number): Tournament {
  const rng = makeRng(seed);
  let t = makeTournament(n);

  for (let guard = 0; guard < 500; guard++) {
    if (t.status === 'complete') return t;

    const available = getAvailableMatches(t);
    if (available.length === 0) {
      throw new Error(
        `Bracket deadlocked with N=${n} seed=${seed}: no available matches but status is "${t.status}"`,
      );
    }

    const match = available[Math.floor(rng() * available.length)];
    const p1Wins = rng() < 0.5;
    const winnerId = (p1Wins ? match.p1Id : match.p2Id)!;
    t = recordResult(t, match.id, winnerId, p1Wins ? 2 : 0, p1Wins ? 0 : 2);
  }

  throw new Error(`Tournament did not converge with N=${n} seed=${seed}`);
}

/**
 * Asserts each participant's W/L record is exactly what the played matches say.
 *
 * Records are maintained incrementally (recordResult adds, rescoreMatch reverses
 * then reapplies), so they can drift out of step with the bracket without any
 * single operation looking wrong. Byes are excluded — nobody earns a win for one.
 */
function assertRecordsMatchPlayedMatches(t: Tournament, ctx: string): void {
  const played = t.matches.filter((m) => m.status === 'complete' && !m.isBye);

  const expected = t.participants.map((p) => ({
    name: p.name,
    wins: played.filter((m) => m.winnerId === p.id).length,
    losses: played.filter((m) => m.loserId === p.id).length,
  }));
  const actual = t.participants.map((p) => ({
    name: p.name,
    wins: p.wins,
    losses: p.losses,
  }));

  expect({ ctx, records: actual }).toEqual({ ctx, records: expected });
}

/**
 * Asserts everything that must hold for a finished double-elimination bracket.
 */
function assertTournamentInvariants(t: Tournament, n: number, seed: number): void {
  const ctx = `N=${n} seed=${seed}`;

  expect(t.status).toBe('complete');

  // Exactly one champion, who cannot have lost more than once.
  const champions = t.participants.filter((p) => p.placement === 1);
  expect(`${ctx}: champions=${champions.length}`).toBe(`${ctx}: champions=1`);
  expect(champions[0].losses).toBeLessThanOrEqual(1);

  // Placements form a contiguous 1..N with no gaps or duplicates.
  const placements = t.participants.map((p) => p.placement).sort((a, b) => a! - b!);
  expect({ ctx, placements }).toEqual({
    ctx,
    placements: Array.from({ length: n }, (_, i) => i + 1),
  });

  // In double elimination everyone below the top two leaves with exactly two
  // losses. A player sitting on 0 or 1 losses was eliminated without playing —
  // the signature of the bye-propagation bug this suite exists to catch.
  const wrongLosses = t.participants
    .filter((p) => p.placement! > 2 && p.losses !== 2)
    .map((p) => `${p.name}(place ${p.placement}, ${p.wins}W-${p.losses}L)`);
  expect({ ctx, wrongLosses }).toEqual({ ctx, wrongLosses: [] });

  // ...and they must be flagged as eliminated.
  const notFlagged = t.participants
    .filter((p) => p.placement! > 2 && !p.eliminated)
    .map((p) => p.name);
  expect({ ctx, notFlagged }).toEqual({ ctx, notFlagged: [] });

  // No match may be marked a bye while holding two real participants: that means
  // a genuine matchup was auto-resolved without being played.
  const corruptByes = t.matches
    .filter((m) => m.isBye && m.p1Id !== null && m.p2Id !== null)
    .map((m) => `${m.id} (${m.bracket} R${m.round})`);
  expect({ ctx, corruptByes }).toEqual({ ctx, corruptByes: [] });

  assertRecordsMatchPlayedMatches(t, ctx);
}

// ─── Generation ──────────────────────────────────────────────────────────────

describe('generateDoubleElimBracket', () => {
  it('rejects brackets with fewer than 2 participants', () => {
    expect(() => generateDoubleElimBracket(makeParticipants(1))).toThrow(
      /at least 2 participants/,
    );
  });

  it('seeds every participant into exactly one winners-bracket R1 slot', () => {
    for (let n = 2; n <= 32; n++) {
      const matches = generateDoubleElimBracket(makeParticipants(n));
      const seeded = matches
        .filter((m) => m.bracket === 'winners' && m.round === 1)
        .flatMap((m) => [m.p1Id, m.p2Id])
        .filter((id): id is string => id !== null);

      expect(new Set(seeded).size).toBe(n);
    }
  });

  it('gives byes only when the field is not a power of two', () => {
    const exact = generateDoubleElimBracket(makeParticipants(8));
    expect(exact.filter((m) => m.bracket === 'winners' && m.round === 1 && m.isBye)).toHaveLength(0);

    const padded = generateDoubleElimBracket(makeParticipants(5));
    expect(
      padded.filter((m) => m.bracket === 'winners' && m.round === 1 && m.isBye).length,
    ).toBeGreaterThan(0);
  });

  it('always creates a grand final with a reset slot held in reserve', () => {
    for (const n of [3, 5, 8, 16, 32]) {
      const matches = generateDoubleElimBracket(makeParticipants(n));
      const gf = matches.filter((m) => m.bracket === 'grand-final');
      expect(gf.map((m) => m.round).sort()).toEqual([1, 2]);

      // The reset must stay dormant until GF1 resolves.
      const reset = gf.find((m) => m.round === 2)!;
      expect(reset.status).toBe('pending');
      expect(reset.p1Id).toBeNull();
      expect(reset.p2Id).toBeNull();
    }
  });
});

// ─── Full-tournament invariants ──────────────────────────────────────────────

describe('full tournament playthroughs', () => {
  // Power-of-two fields always worked; the non-power-of-two ones are where the
  // bye-propagation bug lived (N=9, 17, 18 and 19 failed 100% of the time).
  const sizes = Array.from({ length: 30 }, (_, i) => i + 3); // 3..32

  it.each(sizes)('holds all invariants for %i participants', (n) => {
    for (let seed = 1; seed <= 30; seed++) {
      const t = playRandomTournament(n, seed);
      assertTournamentInvariants(t, n, seed);
    }
  });
});

// ─── Regression: bye propagation ─────────────────────────────────────────────

describe('bye propagation (regression)', () => {
  /**
   * Guards the specific defect: `canSlotBeFilled` used to skip every completed
   * match, but the bye pass marks matches complete one at a time. A downstream
   * match evaluated later in the same pass saw its feeder as "complete, so it
   * will never fill this slot", voided itself, and handed the win to whoever
   * happened to occupy the other slot — eliminating a player at 0W-1L.
   */
  it('never eliminates a player who still has losers-bracket life left', () => {
    for (let n = 3; n <= 32; n++) {
      for (let seed = 1; seed <= 20; seed++) {
        const t = playRandomTournament(n, seed);
        const stranded = t.participants.filter(
          (p) => p.placement! > 2 && p.losses < 2,
        );
        expect(
          stranded.map((p) => `N=${n} seed=${seed} ${p.name} ${p.wins}W-${p.losses}L`),
        ).toEqual([]);
      }
    }
  });

  it('never writes a participant into an already-resolved match', () => {
    // A bye may carry at most one real participant (the player advancing through
    // it). Two means someone was propagated into a match that had already been
    // resolved, so the pairing is real but was never played.
    const overfilled: string[] = [];

    for (let n = 3; n <= 32; n++) {
      const t = playRandomTournament(n, 7);
      for (const m of t.matches) {
        if (!m.isBye) continue;
        if (m.p1Id !== null && m.p2Id !== null) {
          overfilled.push(`N=${n} ${m.id} (${m.bracket} R${m.round}): ${m.p1Id} vs ${m.p2Id}`);
        }
      }
    }

    expect(overfilled).toEqual([]);
  });
});

// ─── Grand final ─────────────────────────────────────────────────────────────

describe('grand final', () => {
  /** Plays every match except the grand final, returning the tournament at that point. */
  function playToGrandFinal(n: number, seed: number): Tournament {
    const rng = makeRng(seed);
    let t = makeTournament(n);

    for (let guard = 0; guard < 500; guard++) {
      const available = getAvailableMatches(t).filter((m) => m.bracket !== 'grand-final');
      if (available.length === 0) break;
      const match = available[Math.floor(rng() * available.length)];
      const p1Wins = rng() < 0.5;
      t = recordResult(t, match.id, (p1Wins ? match.p1Id : match.p2Id)!, p1Wins ? 2 : 0, p1Wins ? 0 : 2);
    }
    return t;
  }

  it('ends the tournament when the winners-bracket champion wins game 1', () => {
    const t = playToGrandFinal(8, 3);
    const gf1 = t.matches.find((m) => m.bracket === 'grand-final' && m.round === 1)!;
    expect(gf1.p1Id).not.toBeNull();

    const done = recordResult(t, gf1.id, gf1.p1Id!, 3, 1);

    expect(done.status).toBe('complete');
    expect(done.needsGrandFinalReset).toBe(false);
    expect(done.participants.find((p) => p.id === gf1.p1Id)!.placement).toBe(1);
    expect(done.participants.find((p) => p.id === gf1.p2Id)!.placement).toBe(2);
  });

  it('activates the reset when the losers-bracket champion wins game 1', () => {
    const t = playToGrandFinal(8, 3);
    const gf1 = t.matches.find((m) => m.bracket === 'grand-final' && m.round === 1)!;

    const afterGf1 = recordResult(t, gf1.id, gf1.p2Id!, 1, 3);

    expect(afterGf1.status).toBe('active');
    expect(afterGf1.needsGrandFinalReset).toBe(true);

    const reset = afterGf1.matches.find((m) => m.bracket === 'grand-final' && m.round === 2)!;
    expect(reset.status).toBe('pending');
    expect([reset.p1Id, reset.p2Id].sort()).toEqual([gf1.p1Id, gf1.p2Id].sort());

    // The reset decides the title.
    const done = recordResult(afterGf1, reset.id, reset.p2Id!, 1, 3);
    expect(done.status).toBe('complete');
    expect(done.participants.find((p) => p.id === reset.p2Id)!.placement).toBe(1);
    expect(done.participants.find((p) => p.id === reset.p1Id)!.placement).toBe(2);
  });
});

// ─── Rescoring ───────────────────────────────────────────────────────────────

describe('rescoreMatch', () => {
  function playSomeMatches(n: number, seed: number, steps: number): Tournament {
    const rng = makeRng(seed);
    let t = makeTournament(n);
    for (let i = 0; i < steps; i++) {
      const available = getAvailableMatches(t);
      if (available.length === 0) break;
      const match = available[Math.floor(rng() * available.length)];
      const p1Wins = rng() < 0.5;
      t = recordResult(t, match.id, (p1Wins ? match.p1Id : match.p2Id)!, p1Wins ? 2 : 0, p1Wins ? 0 : 2);
    }
    return t;
  }

  it('refuses to rescore a match that has not been played', () => {
    const t = makeTournament(8);
    const pending = getAvailableMatches(t)[0];
    expect(() => rescoreMatch(t, pending.id, pending.p1Id!, 1, 0)).toThrow(/not yet complete/);
  });

  it('updates the score without touching the winner', () => {
    const t = playSomeMatches(8, 5, 4);
    const played = t.matches.find((m) => m.status === 'complete' && !m.isBye)!;
    const before = t.participants.find((p) => p.id === played.winnerId)!.wins;

    const after = rescoreMatch(t, played.id, played.winnerId!, 9, 4);
    const updated = after.matches.find((m) => m.id === played.id)!;

    expect(updated.p1Score).toBe(9);
    expect(updated.p2Score).toBe(4);
    expect(updated.winnerId).toBe(played.winnerId);
    // W/L counts are reversed then reapplied — they must land back where they were.
    expect(after.participants.find((p) => p.id === played.winnerId)!.wins).toBe(before);
  });

  it('moves both players when the winner is flipped', () => {
    const t = playSomeMatches(8, 5, 4);
    const played = t.matches.find(
      (m) => m.status === 'complete' && !m.isBye && m.bracket === 'winners',
    )!;
    const newWinner = played.loserId!;
    const newLoser = played.winnerId!;

    const after = rescoreMatch(t, played.id, newWinner, 0, 5);
    const updated = after.matches.find((m) => m.id === played.id)!;

    expect(updated.winnerId).toBe(newWinner);
    expect(updated.loserId).toBe(newLoser);

    // The new winner should now occupy the downstream winners slot.
    if (updated.winnerNextMatchId) {
      const next = after.matches.find((m) => m.id === updated.winnerNextMatchId)!;
      expect([next.p1Id, next.p2Id]).toContain(newWinner);
      expect([next.p1Id, next.p2Id]).not.toContain(newLoser);
    }
  });

  // ── Grand-final rescoring ─────────────────────────────────────────────────
  //
  // Flipping game 1 changes whether a reset is played at all, so the tournament
  // has to be able to move backwards out of "complete" as well as forwards.

  /** Plays everything up to and including grand final game 1. */
  function playThroughGameOne(seed: number, wbChampionWins: boolean) {
    const rng = makeRng(seed);
    let t = makeTournament(8);

    for (let guard = 0; guard < 500; guard++) {
      const available = getAvailableMatches(t).filter((m) => m.bracket !== 'grand-final');
      if (available.length === 0) break;
      const match = available[Math.floor(rng() * available.length)];
      const p1Wins = rng() < 0.5;
      t = recordResult(t, match.id, (p1Wins ? match.p1Id : match.p2Id)!, p1Wins ? 2 : 0, p1Wins ? 0 : 2);
    }

    const gf1 = t.matches.find((m) => m.bracket === 'grand-final' && m.round === 1)!;
    const winnerId = (wbChampionWins ? gf1.p1Id : gf1.p2Id)!;
    return {
      tournament: recordResult(t, gf1.id, winnerId, wbChampionWins ? 3 : 1, wbChampionWins ? 1 : 3),
      gf1,
    };
  }

  it('re-opens the tournament when game 1 is flipped to the losers-bracket champion', () => {
    const { tournament, gf1 } = playThroughGameOne(11, true);
    expect(tournament.status).toBe('complete');

    const reopened = rescoreMatch(tournament, gf1.id, gf1.p2Id!, 1, 3);

    expect(reopened.status).toBe('active');
    expect(reopened.needsGrandFinalReset).toBe(true);

    // Nobody holds the title while the reset is outstanding.
    expect(reopened.participants.filter((p) => p.placement !== null)).toEqual([]);

    const reset = reopened.matches.find((m) => m.bracket === 'grand-final' && m.round === 2)!;
    expect(reset.status).toBe('pending');
    expect([reset.p1Id, reset.p2Id].sort()).toEqual([gf1.p1Id, gf1.p2Id].sort());
  });

  it('discards the reset when game 1 is flipped back to the winners-bracket champion', () => {
    const { tournament, gf1 } = playThroughGameOne(11, false);
    expect(tournament.needsGrandFinalReset).toBe(true);

    const settled = rescoreMatch(tournament, gf1.id, gf1.p1Id!, 3, 1);

    expect(settled.status).toBe('complete');
    expect(settled.needsGrandFinalReset).toBe(false);
    expect(settled.participants.find((p) => p.id === gf1.p1Id)!.placement).toBe(1);
    expect(settled.participants.find((p) => p.id === gf1.p2Id)!.placement).toBe(2);

    const reset = settled.matches.find((m) => m.bracket === 'grand-final' && m.round === 2)!;
    expect(reset.status).toBe('pending');
    expect(reset.p1Id).toBeNull();
    expect(reset.p2Id).toBeNull();
  });

  it('reverses an already-played reset when game 1 is flipped', () => {
    const { tournament, gf1 } = playThroughGameOne(11, false);

    // Play the reset out, then flip game 1 so the reset should never have happened.
    const reset = tournament.matches.find((m) => m.bracket === 'grand-final' && m.round === 2)!;
    const played = recordResult(tournament, reset.id, reset.p2Id!, 1, 3);
    expect(played.status).toBe('complete');

    const settled = rescoreMatch(played, gf1.id, gf1.p1Id!, 3, 1);

    // The discarded reset must not leave a phantom result on anyone's record.
    // (The losers-bracket champion had won both game 1 and the reset, so they
    // legitimately shed two wins here — hence checking against the match list
    // rather than a hand-computed delta.)
    assertRecordsMatchPlayedMatches(settled, 'after discarding a played reset');
    expect(settled.participants.find((p) => p.id === gf1.p1Id)!.placement).toBe(1);

    const clearedReset = settled.matches.find((m) => m.bracket === 'grand-final' && m.round === 2)!;
    expect(clearedReset.status).toBe('pending');
    expect(clearedReset.winnerId).toBeNull();
  });

  it('swaps the title when the reset itself is rescored', () => {
    const { tournament } = playThroughGameOne(11, false);
    const reset = tournament.matches.find((m) => m.bracket === 'grand-final' && m.round === 2)!;

    const played = recordResult(tournament, reset.id, reset.p2Id!, 1, 3);
    expect(played.participants.find((p) => p.id === reset.p2Id)!.placement).toBe(1);

    const flipped = rescoreMatch(played, reset.id, reset.p1Id!, 3, 1);

    expect(flipped.status).toBe('complete');
    expect(flipped.participants.find((p) => p.id === reset.p1Id)!.placement).toBe(1);
    expect(flipped.participants.find((p) => p.id === reset.p2Id)!.placement).toBe(2);
  });

  it('leaves placements contiguous after any grand-final rescore', () => {
    for (const wbChampionWins of [true, false]) {
      for (let seed = 1; seed <= 8; seed++) {
        const { tournament, gf1 } = playThroughGameOne(seed, wbChampionWins);
        const flippedTo = (wbChampionWins ? gf1.p2Id : gf1.p1Id)!;
        const after = rescoreMatch(tournament, gf1.id, flippedTo, 1, 3);

        if (after.status !== 'complete') continue;
        const placements = after.participants.map((p) => p.placement).sort((a, b) => a! - b!);
        expect({ seed, placements }).toEqual({
          seed,
          placements: Array.from({ length: 8 }, (_, i) => i + 1),
        });
      }
    }
  });

  it('never drives a win/loss record negative', () => {
    for (let n = 3; n <= 24; n++) {
      for (let seed = 1; seed <= 10; seed++) {
        let t = playSomeMatches(n, seed, 6);
        const played = t.matches.filter(
          (m) => m.status === 'complete' && !m.isBye && m.bracket !== 'grand-final',
        );
        if (played.length === 0) continue;

        const target = played[played.length - 1];
        const flipped = target.winnerId === target.p1Id ? target.p2Id! : target.p1Id!;
        t = rescoreMatch(t, target.id, flipped, 1, 3);

        const negative = t.participants
          .filter((p) => p.wins < 0 || p.losses < 0)
          .map((p) => `${p.name} ${p.wins}W-${p.losses}L`);
        expect({ n, seed, negative }).toEqual({ n, seed, negative: [] });
      }
    }
  });
});
