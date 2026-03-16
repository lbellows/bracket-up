/**
 * useBracketEngine.ts
 *
 * Derives all read-only bracket state needed by UI components from a
 * Tournament object. This keeps components declarative — they receive
 * stable derived values rather than computing them inline.
 */

import { useMemo } from 'react';
import { Match, Participant, Tournament } from '../types/tournament';
import {
  getAvailableMatches,
  getRemainingMatchCount,
  groupMatchesBySection,
} from '../utils/doubleElimLogic';

export interface BracketSection {
  label: string;
  rounds: BracketRound[];
}

export interface BracketRound {
  roundNumber: number;
  matches: Match[];
}

export interface UseBracketEngineReturn {
  participantMap: Map<string, Participant>;
  availableMatches: Match[];
  remainingCount: number;
  completedCount: number;
  winnersSection: BracketSection;
  losersSection: BracketSection;
  grandFinalMatches: Match[];
  champion: Participant | null;
}

export function useBracketEngine(tournament: Tournament): UseBracketEngineReturn {
  const participantMap = useMemo(
    () => new Map(tournament.participants.map((p) => [p.id, p])),
    [tournament.participants],
  );

  const availableMatches = useMemo(
    () => getAvailableMatches(tournament),
    [tournament],
  );

  const remainingCount = useMemo(
    () => getRemainingMatchCount(tournament),
    [tournament],
  );

  const completedCount = useMemo(
    () => tournament.matches.filter((m) => !m.isBye && m.status === 'complete').length,
    [tournament.matches],
  );

  const { winners, losers, grandFinal } = useMemo(
    () => groupMatchesBySection(tournament),
    [tournament],
  );

  const winnersSection: BracketSection = useMemo(() => {
    const rounds: BracketRound[] = Array.from(winners.entries())
      .sort(([a], [b]) => a - b)
      .map(([roundNumber, matches]) => ({
        roundNumber,
        matches: [...matches].sort((a, b) => a.matchIndex - b.matchIndex),
      }));
    return { label: 'Winners Bracket', rounds };
  }, [winners]);

  const losersSection: BracketSection = useMemo(() => {
    const rounds: BracketRound[] = Array.from(losers.entries())
      .sort(([a], [b]) => a - b)
      .map(([roundNumber, matches]) => ({
        roundNumber,
        matches: [...matches].sort((a, b) => a.matchIndex - b.matchIndex),
      }));
    return { label: 'Losers Bracket', rounds };
  }, [losers]);

  const grandFinalMatches = useMemo(
    () => [...grandFinal].sort((a, b) => a.round - b.round),
    [grandFinal],
  );

  const champion = useMemo(() => {
    if (tournament.status !== 'complete') return null;
    const top = tournament.participants.find((p) => p.placement === 1);
    return top ?? null;
  }, [tournament]);

  return {
    participantMap,
    availableMatches,
    remainingCount,
    completedCount,
    winnersSection,
    losersSection,
    grandFinalMatches,
    champion,
  };
}
