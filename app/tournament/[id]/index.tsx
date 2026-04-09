/**
 * Bracket View Screen
 *
 * Shows the full double-elimination bracket with:
 *  - Scrollable BracketView component
 *  - Progress indicator (matches remaining)
 *  - MatchDetailSheet for entering scores
 *  - Export and Results nav buttons
 */

import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BracketView from '../../../components/BracketView';
import MatchDetailSheet from '../../../components/MatchDetailSheet';
import { useBracketEngine } from '../../../hooks/useBracketEngine';
import { useTournament } from '../../../hooks/useTournament';
import { Match } from '../../../types/tournament';
import { exportTournamentMarkdown } from '../../../utils/exportUtils';

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { tournament, loading, error, recordResult, rescoreMatch } = useTournament(id);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [exportLabel, setExportLabel] = useState('Export');
  // Ref so handleSaveResult always sees the current match without needing it as a dep
  const selectedMatchRef = useRef<Match | null>(null);

  const engine = useBracketEngine(tournament ?? {
    id: '', name: '', createdAt: '', status: 'setup', format: 'double-elimination',
    participants: [], matches: [], needsGrandFinalReset: false
  });

  // ── Header buttons ────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      title: tournament?.name ?? 'Bracket',
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={handleExport}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <Text style={styles.headerBtnText}>{exportLabel}</Text>
          </TouchableOpacity>
          {tournament?.status === 'complete' && (
            <TouchableOpacity
              onPress={() => router.push(`/tournament/${id}/results`)}
              style={[styles.headerBtn, styles.headerBtnAccent]}
              hitSlop={8}
            >
              <Text style={[styles.headerBtnText, styles.headerBtnTextAccent]}>Results</Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [tournament, id, navigation, router, exportLabel]);

  const handleExport = useCallback(() => {
    if (!tournament) return;
    exportTournamentMarkdown(tournament)
      .then(() => {
        if (Platform.OS === 'web' && navigator.clipboard?.writeText) {
          setExportLabel('Copied!');
          setTimeout(() => setExportLabel('Export'), 2000);
        }
      })
      .catch((e) => Alert.alert('Export failed', e instanceof Error ? e.message : String(e)));
  }, [tournament]);

  // ── Match press handler ───────────────────────────────────────────────────

  const handleMatchPress = useCallback(
    (match: Match) => {
      if (match.isBye) return;
      if (!match.p1Id || !match.p2Id) {
        Alert.alert('Not ready', 'Both participants must be known before recording a result.');
        return;
      }
      selectedMatchRef.current = match;
      setSelectedMatch(match);
    },
    [],
  );

  const handleSaveResult = useCallback(
    async (matchId: string, winnerId: string, p1Score: number, p2Score: number) => {
      const isEdit = selectedMatchRef.current?.status === 'complete';
      const updated = isEdit
        ? await rescoreMatch(matchId, winnerId, p1Score, p2Score)
        : await recordResult(matchId, winnerId, p1Score, p2Score);
      if (updated?.status === 'complete') {
        const champion = updated.participants.find((p) => p.placement === 1);
        setTimeout(() => {
          Alert.alert(
            'Tournament Complete!',
            `🏆 ${champion?.name ?? 'Unknown'} wins!`,
            [
              { text: 'View Results', onPress: () => router.push(`/tournament/${id}/results`) },
              { text: 'Stay here', style: 'cancel' },
            ],
          );
        }, 400);
      }
    },
    [recordResult, rescoreMatch, router, id],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (error || !tournament) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Tournament not found'}</Text>
      </View>
    );
  }

  const totalMatches = engine.completedCount + engine.remainingCount;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: totalMatches > 0 ? `${(engine.completedCount / totalMatches) * 100}%` : '0%' },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {engine.remainingCount === 0
            ? 'Tournament complete!'
            : `${engine.remainingCount} match${engine.remainingCount !== 1 ? 'es' : ''} remaining`}
        </Text>
      </View>

      {/* Bracket */}
      <BracketView
        winnersSection={engine.winnersSection}
        losersSection={engine.losersSection}
        grandFinalMatches={engine.grandFinalMatches}
        participantMap={engine.participantMap}
        onMatchPress={handleMatchPress}
      />

      {/* Match detail sheet */}
      <MatchDetailSheet
        match={selectedMatch}
        participantMap={engine.participantMap}
        onSave={handleSaveResult}
        onClose={() => { selectedMatchRef.current = null; setSelectedMatch(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  errorText: { color: '#ef4444', fontSize: 15 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  headerBtnAccent: { backgroundColor: '#1d4ed8' },
  headerBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  headerBtnTextAccent: { color: '#fff' },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#1e293b',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  progressText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
});
