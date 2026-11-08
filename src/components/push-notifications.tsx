import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n/language-context';
import { registerPushForSession } from '@/lib/push';

/**
 * Mounted once, inside the auth and language providers (app/_layout.tsx),
 * on phones only. Registers the phone for a signed-in host, and opens the
 * screen a notification points at when it's tapped — including when the
 * tap is what launched the app.
 */
export function PushNotifications() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const userId = session?.user.id;
  const isHost = session?.user.role === 'HOST';

  useEffect(() => {
    if (!session || !isHost) return;
    registerPushForSession(session.accessToken, {
      title: t.common.pushPromptTitle,
      body: t.common.pushPromptBody,
      allow: t.common.pushPromptAllow,
      notNow: t.common.pushPromptNotNow,
    }).catch(() => {
      // Best-effort: the app works the same without notifications.
    });
    // Once per signed-in user (and per launch), not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isHost]);

  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || !userId) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = response.notification.request.content.data?.url;
    if (typeof url !== 'string' || !url.startsWith('/')) return;
    // A beat after start-up, so the launch redirect to Home lands first and
    // the opened screen sits on top of it (Back returns to Home).
    setTimeout(() => router.push(url as any), 300);
  }, [response, userId, router]);

  return null;
}
