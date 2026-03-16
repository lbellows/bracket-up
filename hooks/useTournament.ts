/**
 * useTournament.ts
 *
 * Central hook for loading, persisting and mutating a single tournament.
 * All state lives in AsyncStorage; this hook provides a reactive view of it.
 *
 * Usage:
 *   const { tournament, loading, recordResult, deleteTournament } = useTournament(id);
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tournament, STORAGE_KEYS } from '../types/tournament';
import { recordResult as applyResult, rescoreMatch as applyRescore } from '../utils/doubleElimLogic';

// ─── All-tournaments helpers (used by Home screen) ───────────────────────────

export async function loadAllTournaments(): Promise<Tournament[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TOURNAMENTS);
    if (!raw) return [];
    return JSON.parse(raw) as Tournament[];
  } catch {
    return [];
  }
}

export async function saveTournamentToStorage(tournament: Tournament): Promise<void> {
  const all = await loadAllTournaments();
  const idx = all.findIndex((t) => t.id === tournament.id);
  if (idx >= 0) {
    all[idx] = tournament;
  } else {
    all.push(tournament);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(all));
}

export async function deleteTournamentFromStorage(id: string): Promise<void> {
  const all = await loadAllTournaments();
  const updated = all.filter((t) => t.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(updated));
}

// ─── Single-tournament hook ───────────────────────────────────────────────────

interface UseTournamentReturn {
  tournament: Tournament | null;
  loading: boolean;
  error: string | null;
  /** Records a result and returns the freshly-updated tournament (or null on error). */
  recordResult: (matchId: string, winnerId: string, p1Score: number, p2Score: number) => Promise<Tournament | null>;
  /** Re-scores an already-completed match (corrects scores / winner). */
  rescoreMatch: (matchId: string, winnerId: string, p1Score: number, p2Score: number) => Promise<Tournament | null>;
  updateTournament: (updated: Tournament) => Promise<void>;
  deleteTournament: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useTournament(id: string): UseTournamentReturn {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track the latest version to avoid stale-closure issues
  const tournamentRef = useRef<Tournament | null>(null);
  tournamentRef.current = tournament;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await loadAllTournaments();
      const found = all.find((t) => t.id === id) ?? null;
      setTournament(found);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tournament');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateTournament = useCallback(async (updated: Tournament) => {
    setTournament(updated);
    await saveTournamentToStorage(updated);
  }, []);

  const recordMatchResult = useCallback(
    async (matchId: string, winnerId: string, p1Score: number, p2Score: number): Promise<Tournament | null> => {
      const current = tournamentRef.current;
      if (!current) return null;
      try {
        const updated = applyResult(current, matchId, winnerId, p1Score, p2Score);
        await updateTournament(updated);
        return updated;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to record result');
        return null;
      }
    },
    [updateTournament],
  );

  const rescoreMatchResult = useCallback(
    async (matchId: string, winnerId: string, p1Score: number, p2Score: number): Promise<Tournament | null> => {
      const current = tournamentRef.current;
      if (!current) return null;
      try {
        const updated = applyRescore(current, matchId, winnerId, p1Score, p2Score);
        await updateTournament(updated);
        return updated;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to update result');
        return null;
      }
    },
    [updateTournament],
  );

  const deleteTournament = useCallback(async () => {
    await deleteTournamentFromStorage(id);
    setTournament(null);
  }, [id]);

  return {
    tournament,
    loading,
    error,
    recordResult: recordMatchResult,
    rescoreMatch: rescoreMatchResult,
    updateTournament,
    deleteTournament,
    reload: load,
  };
}
