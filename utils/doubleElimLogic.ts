/**
 * doubleElimLogic.ts
 *
 * Stateless functions that advance the tournament state after a match result
 * is recorded. All functions return new copies of the tournament data
 * (immutable update pattern) so hooks can detect changes via reference equality.
 *
 * Grand Final reset rule:
 *   In double-elimination the WB champion enters the Grand Final with one loss
 *   "in hand". If the LB champion wins GF Game 1, both finalists have one loss
 *   each, so a GF Game 2 (reset) is played to determine the overall winner.
 *   GF Game 2 participants are the same two players; the GF2 match is pre-created
 *   by bracketGenerator with bracket='grand-final' and round=2.
 */

import { Match, MatchSlot, Participant, Tournament } from '../types/tournament';
import { propagateByes } from './bracketGenerator';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Records a match result, advances the bracket, and returns an updated tournament.
 * Throws if the match is not in a recordable state.
 */
export function recordResult(
  tournament: Tournament,
  matchId: string,
  winnerId: string,
  p1Score: number,
  p2Score: number,
): Tournament {
  const matches = tournament.matches.map((m) => ({ ...m }));
  const participants = tournament.participants.map((p) => ({ ...p }));

  const matchMap = new Map(matches.map((m) => [m.id, m]));
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const match = matchMap.get(matchId);
  if (!match) throw new Error(`Match ${matchId} not found`);
  if (match.status === 'complete') throw new Error(`Match ${matchId} is already complete`);

  const loserId = winnerId === match.p1Id ? match.p2Id : match.p1Id;

  // Update match
  match.winnerId = winnerId;
  match.loserId = loserId;
  match.p1Score = p1Score;
  match.p2Score = p2Score;
  match.status = 'complete';

  // Update participant win/loss records
  const winner = participantMap.get(winnerId);
  if (winner) winner.wins += 1;

  if (loserId) {
    const loser = participantMap.get(loserId);
    if (loser) loser.losses += 1;
  }

  // ── Grand Final logic ────────────────────────────────────────────────────
  if (match.bracket === 'grand-final' && match.round === 1) {
    return handleGrandFinal1(
      { ...tournament, matches, participants: Array.from(participantMap.values()) },
      match,
      matchMap,
      participantMap,
    );
  }

  if (match.bracket === 'grand-final' && match.round === 2) {
    return handleGrandFinal2(
      { ...tournament, matches, participants: Array.from(participantMap.values()) },
      match,
      participantMap,
    );
  }

  // ── Normal match: place winner and loser into next matches ───────────────
  // WB loser routing to LB is handled via match.loserNextMatchId (set by bracketGenerator).
  if (match.bracket === 'losers' && loserId) {
    // Losing in LB = eliminated
    const loser = participantMap.get(loserId);
    if (loser) loser.eliminated = true;
  }

  placeInNextMatch(match, 'winner', matchMap);
  placeInNextMatch(match, 'loser', matchMap);

  // Re-run bye propagation to resolve any newly deterministic slots
  const updatedMatches = Array.from(matchMap.values());
  propagateByes(updatedMatches, matchMap);

  return {
    ...tournament,
    matches: updatedMatches,
    participants: Array.from(participantMap.values()),
  };
}

// ─── Rescore a completed match ───────────────────────────────────────────────

/**
 * Updates the score (and optionally the winner) of an already-completed match.
 *
 * If the winner changes, the old participants are removed from any *pending*
 * downstream matches and the new ones are placed in their slots. Downstream
 * matches that are already complete are left untouched.
 *
 * Grand-final re-scoring updates scores and W/L counts but does not
 * re-evaluate tournament completion or the GF-reset branch.
 */
export function rescoreMatch(
  tournament: Tournament,
  matchId: string,
  newWinnerId: string,
  newP1Score: number,
  newP2Score: number,
): Tournament {
  const matches = tournament.matches.map((m) => ({ ...m }));
  const participants = tournament.participants.map((p) => ({ ...p }));
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const match = matchMap.get(matchId);
  if (!match) throw new Error(`Match ${matchId} not found`);
  if (match.status !== 'complete') throw new Error(`Match ${matchId} is not yet complete`);

  const oldWinnerId = match.winnerId;
  const oldLoserId = match.loserId;
  const newLoserId = newWinnerId === match.p1Id ? match.p2Id : match.p1Id;
  const winnerChanged = newWinnerId !== oldWinnerId;

  // ── Reverse old W/L counts ────────────────────────────────────────────────
  if (oldWinnerId) {
    const p = participantMap.get(oldWinnerId);
    if (p) p.wins = Math.max(0, p.wins - 1);
  }
  if (oldLoserId) {
    const p = participantMap.get(oldLoserId);
    if (p) {
      p.losses = Math.max(0, p.losses - 1);
      // Restore LB-eliminated flag if winner changed
      if (winnerChanged && match.bracket === 'losers') p.eliminated = false;
    }
  }

  if (winnerChanged) {
    // Remove old winner/loser from any *pending* downstream match slots
    removeFromPendingSlot(oldWinnerId, match.winnerNextMatchId, matchMap);
    removeFromPendingSlot(oldLoserId, match.loserNextMatchId, matchMap);
  }

  // ── Apply new result ──────────────────────────────────────────────────────
  match.winnerId = newWinnerId;
  match.loserId = newLoserId ?? null;
  match.p1Score = newP1Score;
  match.p2Score = newP2Score;

  const newWinner = participantMap.get(newWinnerId);
  if (newWinner) newWinner.wins += 1;

  if (newLoserId) {
    const newLoser = participantMap.get(newLoserId);
    if (newLoser) {
      newLoser.losses += 1;
      if (match.bracket === 'losers') newLoser.eliminated = true;
    }
  }

  if (winnerChanged) {
    placeInNextMatch(match, 'winner', matchMap);
    placeInNextMatch(match, 'loser', matchMap);
  }

  const updatedMatches = Array.from(matchMap.values());
  propagateByes(updatedMatches, matchMap);

  return {
    ...tournament,
    matches: updatedMatches,
    participants: Array.from(participantMap.values()),
  };
}

function removeFromPendingSlot(
  participantId: string | null,
  nextMatchId: string | null,
  matchMap: Map<string, Match>,
): void {
  if (!participantId || !nextMatchId) return;
  const next = matchMap.get(nextMatchId);
  if (!next || next.status === 'complete') return;
  if (next.p1Id === participantId) next.p1Id = null;
  else if (next.p2Id === participantId) next.p2Id = null;
}

// ─── Grand Final handlers ────────────────────────────────────────────────────

function handleGrandFinal1(
  tournament: Tournament,
  gf1: Match,
  matchMap: Map<string, Match>,
  participantMap: Map<string, Participant>,
): Tournament {
  const wbChampionId = gf1.p1Id; // WB champion always enters as p1
  const lbChampionId = gf1.p2Id;

  if (gf1.winnerId === wbChampionId) {
    // WB champion wins GF1 → tournament over, no reset needed
    if (wbChampionId) setPlacement(participantMap, wbChampionId, 1);
    if (lbChampionId) {
      setPlacement(participantMap, lbChampionId, 2);
      const loser = participantMap.get(lbChampionId);
      if (loser) loser.eliminated = true;
    }
    return finaliseTournament(tournament, matchMap, participantMap);
  }

  // LB champion wins GF1 → bracket reset, play GF2
  // Find or activate GF2 match
  const gf2 = Array.from(matchMap.values()).find(
    (m) => m.bracket === 'grand-final' && m.round === 2,
  );
  if (gf2) {
    gf2.p1Id = wbChampionId; // same participants
    gf2.p2Id = lbChampionId;
    gf2.status = 'pending';
    gf2.p1Score = 0;
    gf2.p2Score = 0;
    gf2.winnerId = null;
    gf2.loserId = null;
  }

  return {
    ...tournament,
    matches: Array.from(matchMap.values()),
    participants: Array.from(participantMap.values()),
    needsGrandFinalReset: true,
  };
}

function handleGrandFinal2(
  tournament: Tournament,
  gf2: Match,
  participantMap: Map<string, Participant>,
): Tournament {
  const loserId = gf2.loserId;
  if (gf2.winnerId) setPlacement(participantMap, gf2.winnerId, 1);
  if (loserId) {
    setPlacement(participantMap, loserId, 2);
    const loser = participantMap.get(loserId);
    if (loser) loser.eliminated = true;
  }

  const matchMap = new Map(tournament.matches.map((m) => [m.id, m]));
  return finaliseTournament(tournament, matchMap, participantMap);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function placeInNextMatch(
  match: Match,
  edge: 'winner' | 'loser',
  matchMap: Map<string, Match>,
): void {
  const nextId = edge === 'winner' ? match.winnerNextMatchId : match.loserNextMatchId;
  const slot: MatchSlot | null = edge === 'winner' ? match.winnerNextSlot : match.loserNextSlot;
  const participantId = edge === 'winner' ? match.winnerId : match.loserId;

  if (!nextId || !slot || !participantId) return;

  const next = matchMap.get(nextId);
  if (!next) return;

  if (slot === 'p1') next.p1Id = participantId;
  else next.p2Id = participantId;
}

function setPlacement(
  participantMap: Map<string, Participant>,
  participantId: string,
  placement: number,
): void {
  const p = participantMap.get(participantId);
  if (p) p.placement = placement;
}

/**
 * Called when the tournament is over: assign final placements to everyone who
 * hasn't already been placed, mark tournament status as complete.
 */
function finaliseTournament(
  tournament: Tournament,
  matchMap: Map<string, Match>,
  participantMap: Map<string, Participant>,
): Tournament {
  // Assign placements to remaining participants based on elimination order.
  // Players eliminated later = better placement.
  // Collect participants without placement, sorted by losses then wins (desc).
  const unplaced = Array.from(participantMap.values())
    .filter((p) => p.placement === null)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  let nextPlace = 3;
  for (const p of unplaced) {
    p.placement = nextPlace++;
  }

  return {
    ...tournament,
    status: 'complete',
    matches: Array.from(matchMap.values()),
    participants: Array.from(participantMap.values()),
  };
}

// ─── Query helpers used by UI ─────────────────────────────────────────────────

/** Returns matches that are ready to be played (both participants known, not yet complete). */
export function getAvailableMatches(tournament: Tournament): Match[] {
  return tournament.matches.filter(
    (m) => !m.isBye && m.status !== 'complete' && m.p1Id !== null && m.p2Id !== null,
  );
}

/** Returns the number of non-bye matches remaining in the tournament. */
export function getRemainingMatchCount(tournament: Tournament): number {
  return tournament.matches.filter(
    (m) =>
      !m.isBye &&
      m.status !== 'complete' &&
      // Exclude the GF reset match until it's been activated
      !(m.bracket === 'grand-final' && m.round === 2 && m.p1Id === null && m.p2Id === null),
  ).length;
}

/** Returns matches grouped by bracket section and round for rendering. */
export function groupMatchesBySection(tournament: Tournament): {
  winners: Map<number, Match[]>;
  losers: Map<number, Match[]>;
  grandFinal: Match[];
} {
  const winners = new Map<number, Match[]>();
  const losers = new Map<number, Match[]>();
  const grandFinal: Match[] = [];

  for (const m of tournament.matches) {
    if (m.isBye) continue; // skip bye placeholders
    if (m.bracket === 'winners') {
      if (!winners.has(m.round)) winners.set(m.round, []);
      winners.get(m.round)!.push(m);
    } else if (m.bracket === 'losers') {
      if (!losers.has(m.round)) losers.set(m.round, []);
      losers.get(m.round)!.push(m);
    } else {
      // Hide the GF reset match until it has been activated (participants populated)
      if (m.round === 2 && m.p1Id === null && m.p2Id === null) continue;
      grandFinal.push(m);
    }
  }

  return { winners, losers, grandFinal };
}
