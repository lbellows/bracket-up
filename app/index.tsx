/**
 * Home Screen — lists saved tournaments and lets the user create a new one.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteTournamentFromStorage, loadAllTournaments } from '../hooks/useTournament';
import { Tournament, TournamentStatus } from '../types/tournament';
import { useFocusEffect } from 'expo-router';

const STATUS_COLORS: Record<TournamentStatus, string> = {
  setup: '#64748b',
  active: '#3b82f6',
  complete: '#22c55e',
};

const STATUS_LABELS: Record<TournamentStatus, string> = {
  setup: 'Setup',
  active: 'Active',
  complete: 'Complete',
};

export default function HomeScreen() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await loadAllTournaments();
    // Sort newest first
    setTournaments(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }, []);

  // Reload every time the screen comes back into focus (e.g. after creating a tournament)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = useCallback(
    (t: Tournament) => {
      Alert.alert('Delete Tournament', `Delete "${t.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTournamentFromStorage(t.id);
            load();
          },
        },
      ]);
    },
    [load],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={tournaments}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState />}
        renderItem={({ item }) => (
          <TournamentCard
            tournament={item}
            onPress={() => router.push(`/tournament/${item.id}`)}
            onLongPress={() => handleDelete(item)}
          />
        )}
      />
      <View style={styles.fab}>
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => router.push('/new-tournament')}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+ New Tournament</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── TournamentCard ───────────────────────────────────────────────────────────

function TournamentCard({
  tournament,
  onPress,
  onLongPress,
}: {
  tournament: Tournament;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const date = new Date(tournament.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const color = STATUS_COLORS[tournament.status];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.cardName} numberOfLines={1}>
          {tournament.name}
        </Text>
        <Text style={styles.cardMeta}>
          {date} · {tournament.participants.length} players
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
        <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[tournament.status]}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🏆</Text>
      <Text style={styles.emptyTitle}>No tournaments yet</Text>
      <Text style={styles.emptySubtitle}>Tap the button below to create your first bracket</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  list: {
    padding: 16,
    paddingBottom: 100,
    gap: 10,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardLeft: { flex: 1, gap: 4 },
  cardName: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  cardMeta: { color: '#64748b', fontSize: 13 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
  },
  fabBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: {
    alignItems: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
