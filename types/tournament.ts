// ─── Core domain types for BracketUp ─────────────────────────────────────────

export type TournamentStatus = 'setup' | 'active' | 'complete';
export type BracketSide = 'winners' | 'losers' | 'grand-final';
export type MatchStatus = 'pending' | 'active' | 'complete';
export type MatchSlot = 'p1' | 'p2';

export interface Participant {
  id: string;
  name: string;
  wins: number;
  losses: number;
  eliminated: boolean;
  /** Final placement after tournament ends (1-based). Null while active. */
  placement: number | null;
}

export interface Match {
  id: string;
  /** Visual round number within the bracket section (1-based) */
  round: number;
  bracket: BracketSide;
  /** Position index within the round (0-based) */
  matchIndex: number;

  p1Id: string | null; // null = TBD or bye
  p2Id: string | null;
  p1Score: number;
  p2Score: number;

  winnerId: string | null;
  loserId: string | null;
  status: MatchStatus;

  /** True when the match was auto-completed because one slot had no participant (bye) */
  isBye: boolean;

  // ── Routing ────────────────────────────────────────────────────────────────
  winnerNextMatchId: string | null;
  winnerNextSlot: MatchSlot | null;
  loserNextMatchId: string | null;
  loserNextSlot: MatchSlot | null;
}

export interface Tournament {
  id: string;
  name: string;
  createdAt: string; // ISO date string
  status: TournamentStatus;
  format: 'double-elimination';
  participants: Participant[];
  matches: Match[];
  /** Set to true after grand final game 1 is won by the LB champion, requiring a reset match */
  needsGrandFinalReset: boolean;
}

// ─── Storage key helpers ──────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  TOURNAMENTS: '@bracketup/tournaments',
} as const;
