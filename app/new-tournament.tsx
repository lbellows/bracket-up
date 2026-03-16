/**
 * New Tournament Screen
 *
 * 1. Enter tournament name
 * 2. Add participants one at a time (min 3, max 32)
 * 3. "Generate Bracket" → creates the Tournament, saves to storage, navigates to bracket view
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import ParticipantRow from '../components/ParticipantRow';
import { saveTournamentToStorage } from '../hooks/useTournament';
import { Participant, Tournament } from '../types/tournament';
import { generateDoubleElimBracket } from '../utils/bracketGenerator';

const MIN_PARTICIPANTS = 3;
const MAX_PARTICIPANTS = 32;

export default function NewTournamentScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [inputName, setInputName] = useState('');
  const inputRef = useRef<TextInput>(null);

  const addParticipant = useCallback(() => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    if (participants.length >= MAX_PARTICIPANTS) {
      Alert.alert('Max participants', `Maximum ${MAX_PARTICIPANTS} participants allowed.`);
      return;
    }
    if (participants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate name', `"${trimmed}" is already in the list.`);
      return;
    }
    const newParticipant: Participant = {
      id: uuidv4(),
      name: trimmed,
      wins: 0,
      losses: 0,
      eliminated: false,
      placement: null,
    };
    setParticipants((prev) => [...prev, newParticipant]);
    setInputName('');
    inputRef.current?.focus();
  }, [inputName, participants]);

  const removeParticipant = useCallback((id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter a tournament name.');
      return;
    }
    if (participants.length < MIN_PARTICIPANTS) {
      Alert.alert(
        'Not enough players',
        `Add at least ${MIN_PARTICIPANTS} participants to generate a bracket.`,
      );
      return;
    }

    Keyboard.dismiss();

    try {
      const matches = generateDoubleElimBracket(participants);
      const tournament: Tournament = {
        id: uuidv4(),
        name: trimmedName,
        createdAt: new Date().toISOString(),
        status: 'active',
        format: 'double-elimination',
        participants,
        matches,
        needsGrandFinalReset: false,
      };

      await saveTournamentToStorage(tournament);
      router.replace(`/tournament/${tournament.id}`);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to generate bracket.');
    }
  }, [name, participants, router]);

  const canGenerate = name.trim().length > 0 && participants.length >= MIN_PARTICIPANTS;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={participants}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Tournament name */}
            <Text style={styles.label}>Tournament Name</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="e.g. Summer Championships"
              placeholderTextColor="#475569"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              onSubmitEditing={() => inputRef.current?.focus()}
            />

            {/* Add participant */}
            <Text style={styles.label}>
              Participants ({participants.length}/{MAX_PARTICIPANTS})
            </Text>
            <View style={styles.addRow}>
              <TextInput
                ref={inputRef}
                style={styles.addInput}
                placeholder="Player name"
                placeholderTextColor="#475569"
                value={inputName}
                onChangeText={setInputName}
                returnKeyType="done"
                onSubmitEditing={addParticipant}
                maxLength={40}
              />
              <TouchableOpacity
                style={[styles.addBtn, !inputName.trim() && styles.addBtnDisabled]}
                onPress={addParticipant}
                disabled={!inputName.trim()}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {participants.length > 0 && (
              <Text style={styles.sectionTitle}>Lineup</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ParticipantRow participant={item} onDelete={() => removeParticipant(item.id)} />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {participants.length < MIN_PARTICIPANTS && participants.length > 0 && (
              <Text style={styles.hint}>
                Add {MIN_PARTICIPANTS - participants.length} more player
                {MIN_PARTICIPANTS - participants.length !== 1 ? 's' : ''} to continue
              </Text>
            )}
            <TouchableOpacity
              style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
              onPress={handleGenerate}
              disabled={!canGenerate}
            >
              <Text style={styles.generateBtnText}>Generate Bracket</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    gap: 12,
    marginBottom: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  nameInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f1f5f9',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addBtnDisabled: {
    backgroundColor: '#1e3a5f',
    opacity: 0.4,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
    gap: 12,
  },
  hint: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  generateBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateBtnDisabled: {
    backgroundColor: '#14532d',
    opacity: 0.5,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
