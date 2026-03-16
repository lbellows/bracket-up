import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Participant } from '../types/tournament';

interface Props {
  participant: Participant;
  onDelete?: () => void;
  showRecord?: boolean;
}

export default function ParticipantRow({ participant, onDelete, showRecord = false }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {participant.name}
        </Text>
        {showRecord && (
          <Text style={styles.record}>
            {participant.wins}W – {participant.losses}L
          </Text>
        )}
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  record: {
    color: '#94a3b8',
    fontSize: 12,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  deleteText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
  },
});
