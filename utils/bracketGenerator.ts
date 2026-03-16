/**
 * bracketGenerator.ts
 *
 * Generates a complete double-elimination bracket for N participants.
 *
 * Architecture:
 *   1. Round up N to the next power-of-2 (P). Extra "slots" become byes.
 *   2. Build Winners Bracket (WB): standard single-elimination with seeded positions.
 *   3. Build Losers Bracket (LB): alternating consolidation / drop-in rounds that
 *      receive losers from each WB round.
 *   4. Create Grand Final match (+ potential reset) wired to WB and LB champions.
 *   5. Run `propagateByes` to auto-complete all bye/void matches and pre-fill
 *      participant slots that are deterministic from the outset.
 *
 * Bracket seeding:
 *   Uses the standard recursive halving algorithm so 1 vs P, then 2 vs P-1, etc.
 *   Top seeds receive byes in WB Round 1 when N is not a power of 2.
 *
 * LB structure (for P=8 as example):
 *   LB R1 (consolidation): 2 matches  ← WB R1 losers play each other
 *   LB R2 (drop-in):       2 matches  ← LB R1 winners vs WB R2 losers
 *   LB R3 (consolidation): 1 match
 *   LB R4 (drop-in):       1 match    ← LB R3 winner vs WB Finals loser
 *   Grand Final:           1 match    ← WB champion vs LB champion
 *   GF Reset (if needed):  1 match    ← played only if LB champ wins GF game 1
 */

import { Match, MatchSlot, Participant } from '../types/tournament';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Returns bracket slot positions for a power-of-2 sized bracket.
 * Result is a flat array of 2*size seeds arranged as adjacent pairs:
 *   [slot0_top, slot0_bottom, slot1_top, slot1_bottom, ...]
 * e.g. getBracketSeeds(8) = [1,8,4,5,2,7,3,6]
 * Pairs: (1v8), (4v5), (2v7), (3v6)
 */
function getBracketSeeds(size: number): number[] {
  if (size === 1) return [1];
  const half = getBracketSeeds(size / 2);
  return half.flatMap((seed) => [seed, size + 1 - seed]);
}

// ─── Core generator ──────────────────────────────────────────────────────────

export function generateDoubleElimBracket(participants: Participant[]): Match[] {
  const n = participants.length;
  if (n < 2) throw new Error('Need at least 2 participants');

  const p = nextPowerOf2(n);

  // Randomise participant order (random seeding)
  const shuffled = [...participants].sort(() => Math.random() - 0.5);

  // Seed positions → participant IDs (null = bye)
  const seeds = getBracketSeeds(p);
  const seedToId = (seed: number): string | null =>
    seed <= n ? shuffled[seed - 1].id : null;

  let counter = 0;
  const makeId = () => `m${++counter}`;

  const matches: Match[] = [];
  const matchMap = new Map<string, Match>();

  const addMatch = (m: Match): Match => {
    matches.push(m);
    matchMap.set(m.id, m);
    return m;
  };

  const makeMatch = (
    bracket: Match['bracket'],
    round: number,
    index: number,
    p1Id: string | null = null,
    p2Id: string | null = null,
  ): Match =>
    addMatch({
      id: makeId(),
      round,
      bracket,
      matchIndex: index,
      p1Id,
      p2Id,
      p1Score: 0,
      p2Score: 0,
      winnerId: null,
      loserId: null,
      status: 'pending',
      isBye: false,
      winnerNextMatchId: null,
      winnerNextSlot: null,
      loserNextMatchId: null,
      loserNextSlot: null,
    });

  // ═══ Winners Bracket ═══════════════════════════════════════════════════════

  const wbRounds: Match[][] = [];

  // WB Round 1 — fill participant slots from seeding
  const wbR1: Match[] = [];
  for (let i = 0; i < p / 2; i++) {
    const p1Id = seedToId(seeds[i * 2]);
    const p2Id = seedToId(seeds[i * 2 + 1]);
    wbR1.push(makeMatch('winners', 1, i, p1Id, p2Id));
  }
  wbRounds.push(wbR1);

  // WB Rounds 2 … Finals — each match receives winners from two prior matches
  let prevWb = wbR1;
  for (let r = 2; prevWb.length > 1; r++) {
    const round: Match[] = [];
    for (let i = 0; i < prevWb.length / 2; i++) {
      const m = makeMatch('winners', r, i);
      wire(prevWb[i * 2], 'winner', m, 'p1');
      wire(prevWb[i * 2 + 1], 'winner', m, 'p2');
      round.push(m);
    }
    wbRounds.push(round);
    prevWb = round;
  }

  const wbFinals = wbRounds[wbRounds.length - 1][0];

  // ═══ Losers Bracket ════════════════════════════════════════════════════════
  //
  // Pattern for P participants (WB has wbRounds.length rounds):
  //   totalLbRounds = 2 * (wbRounds.length - 1)
  //   LB R1   → consolidation of WB R1 losers (cross-paired to avoid early rematches)
  //   LB R2k  → drop-in: LB R(2k-1) winners vs WB R(k+1) losers
  //   LB R2k+1→ consolidation: LB R(2k) winners vs each other

  const lbRounds: Match[][] = [];

  if (p >= 4) {
    // LB Round 1: cross-pair WB R1 losers
    // Match i pairs WB R1 match[i] loser vs WB R1 match[P/2-1-i] loser
    const lbR1: Match[] = [];
    for (let i = 0; i < wbR1.length / 2; i++) {
      const m = makeMatch('losers', 1, i);
      wire(wbR1[i], 'loser', m, 'p1');
      wire(wbR1[wbR1.length - 1 - i], 'loser', m, 'p2');
      lbR1.push(m);
    }
    lbRounds.push(lbR1);

    const totalLbRounds = 2 * (wbRounds.length - 1);
    let prevLb = lbR1;

    for (let lbR = 2; lbR <= totalLbRounds; lbR++) {
      const isDropIn = lbR % 2 === 0;
      const round: Match[] = [];

      if (isDropIn) {
        // Drop-in round: each LB winner is paired with a WB round loser
        // WB round that feeds this LB drop-in: index = lbR/2 (0-based into wbRounds)
        const wbRoundIdx = lbR / 2; // e.g. lbR=2 → wbRounds[1] = WB R2
        const wbSource = wbRounds[wbRoundIdx] ?? [];

        for (let i = 0; i < prevLb.length; i++) {
          const m = makeMatch('losers', lbR, i);
          wire(prevLb[i], 'winner', m, 'p1');
          if (wbSource[i]) wire(wbSource[i], 'loser', m, 'p2');
          round.push(m);
        }
      } else {
        // Consolidation round: pair adjacent LB winners
        for (let i = 0; i < prevLb.length / 2; i++) {
          const m = makeMatch('losers', lbR, i);
          wire(prevLb[i * 2], 'winner', m, 'p1');
          wire(prevLb[i * 2 + 1], 'winner', m, 'p2');
          round.push(m);
        }
      }

      lbRounds.push(round);
      prevLb = round;
    }

    // ═══ Grand Final ═════════════════════════════════════════════════════════

    const lbFinals = lbRounds[lbRounds.length - 1][0];

    // GF Game 1 — WB champion (p1) vs LB champion (p2)
    const gf1 = makeMatch('grand-final', 1, 0);
    wire(wbFinals, 'winner', gf1, 'p1');
    wire(lbFinals, 'winner', gf1, 'p2');

    // GF Game 2 (reset) — created ahead of time; only becomes active if LB wins GF1
    // Both finalists are the same people; routing is handled by doubleElimLogic.
    makeMatch('grand-final', 2, 0);
    // Note: gf2 routing is wired dynamically in doubleElimLogic after GF1 resolves.
  } else {
    // p === 2: degenerate case — just a grand final, no LB
    const gf1 = makeMatch('grand-final', 1, 0);
    wire(wbFinals, 'winner', gf1, 'p1');
    // GF Reset slot
    makeMatch('grand-final', 2, 0);
  }

  // ═══ Propagate byes ════════════════════════════════════════════════════════
  propagateByes(matches, matchMap);

  return matches;
}

// ─── Wiring helpers ──────────────────────────────────────────────────────────

function wire(
  from: Match,
  edge: 'winner' | 'loser',
  to: Match,
  slot: MatchSlot,
): void {
  if (edge === 'winner') {
    from.winnerNextMatchId = to.id;
    from.winnerNextSlot = slot;
  } else {
    from.loserNextMatchId = to.id;
    from.loserNextSlot = slot;
  }
}

// ─── Bye propagation ─────────────────────────────────────────────────────────

/**
 * Iteratively resolves bye and void matches, propagating participants into
 * subsequent match slots until the bracket is in a stable initial state.
 *
 * A match is auto-completed as a bye when:
 *   - One participant slot is filled and the other will NEVER be filled (its
 *     only feeder match is already complete with no real participant).
 *   - Both slots are null and neither will ever be filled (void match).
 */
export function propagateByes(
  matches: Match[],
  matchMap?: Map<string, Match>,
): void {
  const mm = matchMap ?? new Map(matches.map((m) => [m.id, m]));

  // Step 1: mark WB R1 byes immediately
  for (const m of matches) {
    if (m.bracket === 'winners' && m.round === 1) {
      if (m.p1Id === null || m.p2Id === null) {
        m.winnerId = m.p1Id ?? m.p2Id;
        m.loserId = null;
        m.status = 'complete';
        m.isBye = true;
      }
    }
  }

  // Step 2: iteratively propagate completions and resolve downstream byes
  let changed = true;
  while (changed) {
    changed = false;

    for (const m of matches) {
      if (m.status !== 'complete') continue;

      // Propagate winner into next match slot
      if (m.winnerNextMatchId && m.winnerId) {
        const next = mm.get(m.winnerNextMatchId)!;
        if (m.winnerNextSlot === 'p1' && next.p1Id !== m.winnerId) {
          next.p1Id = m.winnerId;
          changed = true;
        } else if (m.winnerNextSlot === 'p2' && next.p2Id !== m.winnerId) {
          next.p2Id = m.winnerId;
          changed = true;
        }
      }

      // Propagate loser into LB slot (skip if bye — no real loser)
      if (m.loserNextMatchId && m.loserId) {
        const next = mm.get(m.loserNextMatchId)!;
        if (m.loserNextSlot === 'p1' && next.p1Id !== m.loserId) {
          next.p1Id = m.loserId;
          changed = true;
        } else if (m.loserNextSlot === 'p2' && next.p2Id !== m.loserId) {
          next.p2Id = m.loserId;
          changed = true;
        }
      }
    }

    // After propagation pass: look for newly resolvable byes
    for (const m of matches) {
      if (m.status === 'complete') continue;

      const p1Filled = m.p1Id !== null;
      const p2Filled = m.p2Id !== null;

      if (!p1Filled && !p2Filled) {
        // Void match: both slots are null
        if (!canSlotBeFilled(m.id, 'p1', matches) && !canSlotBeFilled(m.id, 'p2', matches)) {
          m.winnerId = null;
          m.loserId = null;
          m.status = 'complete';
          m.isBye = true;
          changed = true;
        }
      } else if (p1Filled && !p2Filled) {
        if (!canSlotBeFilled(m.id, 'p2', matches)) {
          m.winnerId = m.p1Id;
          m.loserId = null;
          m.status = 'complete';
          m.isBye = true;
          changed = true;
        }
      } else if (!p1Filled && p2Filled) {
        if (!canSlotBeFilled(m.id, 'p1', matches)) {
          m.winnerId = m.p2Id;
          m.loserId = null;
          m.status = 'complete';
          m.isBye = true;
          changed = true;
        }
      }
    }
  }
}

/**
 * Returns true if at least one incomplete match will eventually place a
 * participant into the given slot of matchId.
 */
function canSlotBeFilled(matchId: string, slot: MatchSlot, allMatches: Match[]): boolean {
  for (const m of allMatches) {
    if (m.status === 'complete') continue;
    if (m.winnerNextMatchId === matchId && m.winnerNextSlot === slot) return true;
    if (m.loserNextMatchId === matchId && m.loserNextSlot === slot) return true;
  }
  return false;
}
