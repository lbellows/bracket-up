import 'react-native-get-random-values'; // must be first import for uuid
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: '#0f172a' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'BracketUp', headerLargeTitle: true }} />
        <Stack.Screen name="new-tournament" options={{ title: 'New Tournament', presentation: 'modal' }} />
        <Stack.Screen name="tournament/[id]/index" options={{ title: 'Bracket' }} />
        <Stack.Screen name="tournament/[id]/results" options={{ title: 'Results' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
