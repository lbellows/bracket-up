import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Match, Participant } from '../types/tournament';

interface Props {
  match: Match;
  participantMap: Map<string, Participant>;
  onPress: () => void;
  compact?: boolean;
}

export default function MatchCard({ match, participantMap, onPress, compact = false }: Props) {
  const p1 = match.p1Id ? participantMap.get(match.p1Id) : null;
  const p2 = match.p2Id ? participantMap.get(match.p2Id) : null;
  const isDone = match.status === 'complete';
  const isActive = match.status === 'active' || (match.status === 'pending' && p1 && p2);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, compact && styles.cardCompact, isDone && styles.cardDone]}
      activeOpacity={0.75}
    >
      <ParticipantLine
        name={p1?.name ?? 'TBD'}
        score={match.p1Score}
        isWinner={isDone && match.winnerId === match.p1Id}
        isLoser={isDone && match.loserId === match.p1Id}
        showScore={isDone}
      />
      <View style={styles.divider} />
      <ParticipantLine
        name={p2?.name ?? 'TBD'}
        score={match.p2Score}
        isWinner={isDone && match.winnerId === match.p2Id}
        isLoser={isDone && match.loserId === match.p2Id}
        showScore={isDone}
      />
      {!isDone && isActive && (
        <View style={styles.playBadge}>
          <Text style={styles.playText}>▶</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ParticipantLine({
  name,
  score,
  isWinner,
  isLoser,
  showScore,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  isLoser: boolean;
  showScore: boolean;
}) {
  return (
    <View style={styles.playerRow}>
      {isWinner && <View style={styles.winDot} />}
      {!isWinner && <View style={styles.dotPlaceholder} />}
      <Text
        style={[
          styles.playerName,
          isWinner && styles.winnerText,
          isLoser && styles.loserText,
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {showScore && <Text style={[styles.score, isLoser && styles.loserText]}>{score}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    overflow: 'hidden',
    width: 160,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  cardCompact: {
    width: 140,
  },
  cardDone: {
    borderColor: '#1e293b',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  winDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  dotPlaceholder: {
    width: 6,
    height: 6,
    marginRight: 6,
  },
  playerName: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  winnerText: {
    color: '#f1f5f9',
    fontWeight: '700',
  },
  loserText: {
    color: '#475569',
  },
  score: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  playBadge: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: [{ translateY: -8 }],
  },
  playText: {
    color: '#3b82f6',
    fontSize: 12,
  },
});
