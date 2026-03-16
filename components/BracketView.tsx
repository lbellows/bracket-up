/**
 * BracketView.tsx
 *
 * Horizontally scrollable bracket visualiser.
 * Renders Winners Bracket and Losers Bracket as two swimlanes,
 * with the Grand Final at the far right.
 *
 * Each round is a column; each match is a MatchCard.
 * Connector lines between rounds are drawn using a simple View-based approach.
 */

import React, { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BracketSection } from '../hooks/useBracketEngine';
import { Match, Participant } from '../types/tournament';
import MatchCard from './MatchCard';

interface Props {
  winnersSection: BracketSection;
  losersSection: BracketSection;
  grandFinalMatches: Match[];
  participantMap: Map<string, Participant>;
  onMatchPress: (match: Match) => void;
}

const CARD_HEIGHT = 80;
const CARD_WIDTH = 160;
const COL_GAP = 40;
const ROW_GAP = 16;

export default function BracketView({
  winnersSection,
  losersSection,
  grandFinalMatches,
  participantMap,
  onMatchPress,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.container}>
        {/* ── Winners Bracket ── */}
        <SwimlaneHeader label="Winners Bracket" />
        <View style={styles.swimlane}>
          {winnersSection.rounds.map((round) => (
            <RoundColumn
              key={`wb-r${round.roundNumber}`}
              label={`Round ${round.roundNumber}`}
              matches={round.matches}
              participantMap={participantMap}
              onMatchPress={onMatchPress}
            />
          ))}
        </View>

        <View style={styles.dividerH} />

        {/* ── Losers Bracket ── */}
        {losersSection.rounds.length > 0 && (
          <>
            <SwimlaneHeader label="Losers Bracket" />
            <View style={styles.swimlane}>
              {losersSection.rounds.map((round) => (
                <RoundColumn
                  key={`lb-r${round.roundNumber}`}
                  label={`Round ${round.roundNumber}`}
                  matches={round.matches}
                  participantMap={participantMap}
                  onMatchPress={onMatchPress}
                />
              ))}
            </View>
            <View style={styles.dividerH} />
          </>
        )}

        {/* ── Grand Final ── */}
        {grandFinalMatches.length > 0 && (
          <>
            <SwimlaneHeader label="Grand Final" accent />
            <View style={styles.swimlane}>
              {grandFinalMatches.map((match) => (
                <Animated.View
                  key={match.id}
                  entering={FadeIn.duration(400)}
                  style={styles.gfColumn}
                >
                  <Text style={styles.roundLabel}>
                    {match.round === 2 ? 'Reset' : 'Game 1'}
                  </Text>
                  <MatchCard
                    match={match}
                    participantMap={participantMap}
                    onPress={() => onMatchPress(match)}
                  />
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── RoundColumn ──────────────────────────────────────────────────────────────

function RoundColumn({
  label,
  matches,
  participantMap,
  onMatchPress,
}: {
  label: string;
  matches: Match[];
  participantMap: Map<string, Participant>;
  onMatchPress: (m: Match) => void;
}) {
  return (
    <View style={[styles.column, { width: CARD_WIDTH + COL_GAP }]}>
      <Text style={styles.roundLabel}>{label}</Text>
      <View style={styles.matchList}>
        {matches.map((match) => (
          <Animated.View key={match.id} entering={FadeIn.duration(300)} style={{ marginBottom: ROW_GAP }}>
            <MatchCard
              match={match}
              participantMap={participantMap}
              onPress={() => onMatchPress(match)}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── SwimlaneHeader ───────────────────────────────────────────────────────────

function SwimlaneHeader({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View style={styles.swimlaneHeader}>
      <View style={[styles.swimlaneDot, accent && styles.swimlaneDotAccent]} />
      <Text style={[styles.swimlaneLabel, accent && styles.swimlaneLabelAccent]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  container: {
    paddingTop: 8,
  },
  swimlane: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: 8,
  },
  swimlaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  swimlaneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  swimlaneDotAccent: {
    backgroundColor: '#f59e0b',
  },
  swimlaneLabel: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  swimlaneLabelAccent: {
    color: '#f59e0b',
  },
  dividerH: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 8,
  },
  column: {
    marginRight: 0,
    paddingRight: COL_GAP,
  },
  roundLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchList: {
    flexDirection: 'column',
  },
  gfColumn: {
    marginRight: COL_GAP,
    width: CARD_WIDTH,
  },
});
