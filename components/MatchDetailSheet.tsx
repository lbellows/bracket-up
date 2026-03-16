/**
 * MatchDetailSheet.tsx
 *
 * Modal bottom sheet for entering match scores and recording results.
 * Uses Animated for the slide-up entrance.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Match, Participant } from '../types/tournament';

interface Props {
  match: Match | null;
  participantMap: Map<string, Participant>;
  onSave: (matchId: string, winnerId: string, p1Score: number, p2Score: number) => void;
  onClose: () => void;
}

export default function MatchDetailSheet({ match, participantMap, onSave, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const visible = match !== null;

  useEffect(() => {
    if (visible && match) {
      setP1Score(match.p1Score);
      setP2Score(match.p2Score);
      setWinnerId(match.winnerId);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, match, slideAnim]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onClose());
  }, [onClose, slideAnim]);

  const handleSave = useCallback(() => {
    if (!match || !winnerId) return;
    onSave(match.id, winnerId, p1Score, p2Score);
    handleClose();
  }, [match, winnerId, p1Score, p2Score, onSave, handleClose]);

  if (!match) return null;

  const p1 = match.p1Id ? participantMap.get(match.p1Id) : null;
  const p2 = match.p2Id ? participantMap.get(match.p2Id) : null;
  const canSave = winnerId !== null && p1 !== null && p2 !== null;

  const sectionLabel =
    match.bracket === 'winners'
      ? `Winners Bracket · Round ${match.round}`
      : match.bracket === 'losers'
      ? `Losers Bracket · Round ${match.round}`
      : match.round === 2
      ? 'Grand Final · Reset'
      : 'Grand Final';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle bar */}
          <View style={styles.handle} />

          <Text style={styles.section}>{sectionLabel}</Text>

          {/* Score entry rows */}
          <View style={styles.scoreContainer}>
            <ScoreRow
              name={p1?.name ?? 'TBD'}
              record={p1 ? `${p1.wins}W – ${p1.losses}L` : ''}
              score={p1Score}
              isWinner={winnerId === match.p1Id}
              onScoreChange={setP1Score}
              onSelectWinner={() => setWinnerId(match.p1Id)}
              disabled={!p1 || !p2}
            />
            <View style={styles.vsRow}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <ScoreRow
              name={p2?.name ?? 'TBD'}
              record={p2 ? `${p2.wins}W – ${p2.losses}L` : ''}
              score={p2Score}
              isWinner={winnerId === match.p2Id}
              onScoreChange={setP2Score}
              onSelectWinner={() => setWinnerId(match.p2Id)}
              disabled={!p1 || !p2}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>
              {match.status === 'complete' ? 'Update Result' : 'Save Result'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ScoreRow sub-component ───────────────────────────────────────────────────

interface ScoreRowProps {
  name: string;
  record: string;
  score: number;
  isWinner: boolean;
  onScoreChange: (v: number) => void;
  onSelectWinner: () => void;
  disabled: boolean;
}

function ScoreRow({
  name,
  record,
  score,
  isWinner,
  onScoreChange,
  onSelectWinner,
  disabled,
}: ScoreRowProps) {
  return (
    <TouchableOpacity
      style={[styles.scoreRow, isWinner && styles.scoreRowWinner]}
      onPress={onSelectWinner}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.scoreNameBlock}>
        <Text style={[styles.scoreName, isWinner && styles.scoreNameWinner]} numberOfLines={1}>
          {name}
        </Text>
        {record ? <Text style={styles.scoreRecord}>{record}</Text> : null}
      </View>
      <View style={styles.scoreControls}>
        <TouchableOpacity
          style={styles.adjBtn}
          onPress={() => onScoreChange(Math.max(0, score - 1))}
          disabled={disabled}
        >
          <Text style={styles.adjBtnText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.scoreInput}
          value={String(score)}
          onChangeText={(t) => {
            const n = parseInt(t, 10);
            if (!isNaN(n) && n >= 0) onScoreChange(n);
          }}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <TouchableOpacity
          style={styles.adjBtn}
          onPress={() => onScoreChange(score + 1)}
          disabled={disabled}
        >
          <Text style={styles.adjBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {isWinner && (
        <View style={styles.winnerBadge}>
          <Text style={styles.winnerBadgeText}>W</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 16,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 4,
  },
  section: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  scoreContainer: {
    gap: 0,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginVertical: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  scoreRowWinner: {
    borderColor: '#22c55e',
  },
  scoreNameBlock: {
    flex: 1,
    gap: 2,
  },
  scoreName: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreNameWinner: {
    color: '#f1f5f9',
  },
  scoreRecord: {
    color: '#475569',
    fontSize: 12,
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnText: {
    color: '#f1f5f9',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '300',
  },
  scoreInput: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '700',
    width: 48,
    textAlign: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 4,
  },
  winnerBadge: {
    backgroundColor: '#22c55e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
  winnerBadgeText: {
    color: '#052e16',
    fontSize: 12,
    fontWeight: '800',
  },
  vsRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  vsText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#1e3a5f',
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
