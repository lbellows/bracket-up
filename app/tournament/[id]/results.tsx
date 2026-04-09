/**
 * Results Screen
 *
 * Final standings and full match history for a tournament.
 * Accessible from the bracket view once the tournament is complete
 * (or mid-tournament to see current standings).
 */

import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTournament } from '../../../hooks/useTournament';
import { Match, Participant, Tournament } from '../../../types/tournament';
import { exportTournamentMarkdown } from '../../../utils/exportUtils';

const PLACEMENT_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tournament, loading } = useTournament(id);
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(() => {
    if (!tournament) return;
    exportTournamentMarkdown(tournament)
      .then(() => {
        // On web the clipboard path returns without throwing — show brief confirmation.
        if (Platform.OS === 'web' && navigator.clipboard?.writeText) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      })
      .catch((e) => Alert.alert('Export failed', e instanceof Error ? e.message : String(e)));
  }, [tournament]);

  if (loading || !tournament) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        contentContainerStyle={styles.list}
        sections={buildSections(tournament)}
        keyExtractor={(item, idx) => String(idx)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          if (section.title === 'Standings') {
            return <StandingRow participant={item as Participant} />;
          }
          return <MatchHistoryRow match={item as Match} tournament={tournament} />;
        }}
        ListFooterComponent={
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Text style={styles.exportBtnText}>
              {copied ? 'Copied to clipboard!' : 'Export as Markdown'}
            </Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

// ─── Section builder ──────────────────────────────────────────────────────────

function buildSections(tournament: Tournament) {
  const participantMap = new Map(tournament.participants.map((p) => [p.id, p]));

  const placed = tournament.participants
    .filter((p) => p.placement !== null)
    .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));

  const unplaced = tournament.participants
    .filter((p) => p.placement === null)
    .sort((a, b) => b.wins - a.wins);

  const standings = [...placed, ...unplaced];

  const completedMatches = tournament.matches
    .filter((m) => m.status === 'complete' && !m.isBye)
    .sort((a, b) => {
      // Sort by bracket section then round
      const sectionOrder = { winners: 0, losers: 1, 'grand-final': 2 };
      const so = sectionOrder[a.bracket] - sectionOrder[b.bracket];
      return so !== 0 ? so : a.round - b.round || a.matchIndex - b.matchIndex;
    });

  return [
    { title: 'Standings', data: standings },
    { title: 'Match History', data: completedMatches },
  ];
}

// ─── StandingRow ──────────────────────────────────────────────────────────────

function StandingRow({ participant }: { participant: Participant }) {
  const placement = participant.placement;
  const medal = placement ? PLACEMENT_MEDALS[placement] ?? `${placement}.` : '—';

  return (
    <View style={styles.standingRow}>
      <Text style={styles.medal}>{medal}</Text>
      <View style={styles.standingInfo}>
        <Text style={styles.standingName}>{participant.name}</Text>
        <Text style={styles.standingRecord}>
          {participant.wins}W – {participant.losses}L
        </Text>
      </View>
    </View>
  );
}

// ─── MatchHistoryRow ──────────────────────────────────────────────────────────

function MatchHistoryRow({
  match,
  tournament,
}: {
  match: Match;
  tournament: Tournament;
}) {
  const pMap = new Map(tournament.participants.map((p) => [p.id, p]));
  const p1 = pMap.get(match.p1Id ?? '');
  const p2 = pMap.get(match.p2Id ?? '');
  const winner = pMap.get(match.winnerId ?? '');

  if (!p1 || !p2) return null;

  const sectionLabel =
    match.bracket === 'winners'
      ? `WB R${match.round}`
      : match.bracket === 'losers'
      ? `LB R${match.round}`
      : match.round === 2
      ? 'GF Reset'
      : 'Grand Final';

  return (
    <View style={styles.matchRow}>
      <Text style={styles.matchSection}>{sectionLabel}</Text>
      <View style={styles.matchParticipants}>
        <Text
          style={[styles.matchName, match.winnerId === match.p1Id && styles.matchWinner]}
          numberOfLines={1}
        >
          {p1.name}
        </Text>
        <Text style={styles.matchScore}>
          {match.p1Score} – {match.p2Score}
        </Text>
        <Text
          style={[styles.matchName, styles.matchNameRight, match.winnerId === match.p2Id && styles.matchWinner]}
          numberOfLines={1}
        >
          {p2.name}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  list: { padding: 16, paddingBottom: 40, gap: 8 },
  sectionHeader: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    gap: 12,
  },
  medal: { fontSize: 22, width: 32, textAlign: 'center' },
  standingInfo: { flex: 1, gap: 2 },
  standingName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  standingRecord: { color: '#64748b', fontSize: 12 },
  matchRow: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    gap: 6,
  },
  matchSection: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchName: {
    flex: 1,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  matchNameRight: {
    textAlign: 'right',
  },
  matchWinner: {
    color: '#f1f5f9',
    fontWeight: '700',
  },
  matchScore: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  exportBtn: {
    marginTop: 24,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  exportBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
