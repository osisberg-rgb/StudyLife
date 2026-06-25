import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { initDb } from '@/lib/db';
import '@/lib/notifications'; // sætter notifikations-handleren ved opstart
import { useSettingsStore } from '@/store/settingsStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const loadSettings = useSettingsStore((s) => s.load);
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await loadSettings();
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
  }, [loadSettings]);

  // Tryk på en deadline-notifikation → åbn den pågældende deadline.
  useEffect(() => {
    if (!ready) return;
    const deadlineId = lastResponse?.notification.request.content.data?.deadlineId;
    if (typeof deadlineId === 'string') {
      router.push(`/deadline/${deadlineId}`);
    }
  }, [ready, lastResponse, router]);

  if (!ready) return null; // splash vises indtil DB + indstillinger er klar

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ presentation: 'modal', title: 'Importér plan' }} />
        <Stack.Screen name="settings" options={{ title: 'Indstillinger' }} />
        <Stack.Screen name="deadline/new" options={{ presentation: 'modal', title: 'Ny deadline' }} />
        <Stack.Screen name="deadline/[id]" options={{ title: 'Rediger deadline' }} />
        <Stack.Screen
          name="focus-session"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
