import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useAuth } from '../auth-context';
import { api } from '../api';
import { en, fr, ar, Dict } from './dictionary';

export type Lang = 'EN' | 'FR' | 'AR';

const DICTS: Record<Lang, Dict> = { EN: en, FR: fr, AR: ar };
const STORAGE_KEY = 'darclean_lang';
const RTL_RELOAD_KEY = 'darclean_rtl_reload';

/**
 * Arabic runs the whole app right-to-left: rows, margins, text and the
 * navigation all mirror. React Native only applies a direction change on
 * the next start, so after switching it the app restarts itself once.
 * RTL_RELOAD_KEY remembers that restart: if the direction still doesn't
 * match afterwards (e.g. a runtime that can't switch), it doesn't try
 * again, so the app can never get stuck restarting.
 */
async function applyDirection(lang: Lang) {
  const rtl = lang === 'AR';
  if (!!I18nManager.isRTL === rtl) {
    await AsyncStorage.removeItem(RTL_RELOAD_KEY).catch(() => {});
    return;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  const tried = await AsyncStorage.getItem(RTL_RELOAD_KEY).catch(() => null);
  if (tried === lang) return;
  await AsyncStorage.setItem(RTL_RELOAD_KEY, lang).catch(() => {});
  try {
    await Updates.reloadAsync();
  } catch {
    // Development builds can't use expo-updates' reload.
    DevSettings?.reload?.();
  }
}

interface LanguageContextValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Deliberately minimal — a plain AsyncStorage key plus an in-memory React
 * context. No locale-detection native module, no ICU library: this is the
 * lightest thing that lets a host or cleaner pick English/French/Arabic
 * and have it stick.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { session, updateSessionUser } = useAuth();
  const [lang, setLangState] = useState<Lang>('EN');

  // Resolution order: whatever the person picked on this device
  // (AsyncStorage) wins immediately; otherwise fall back to the language
  // saved on their account once the session loads.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && DICTS[stored as Lang]) {
        setLangState(stored as Lang);
        applyDirection(stored as Lang);
      } else if (session?.user.preferredLanguage && DICTS[session.user.preferredLanguage]) {
        setLangState(session.user.preferredLanguage);
        applyDirection(session.user.preferredLanguage);
      }
    });
  }, [session?.user.preferredLanguage]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      const saves: Promise<unknown>[] = [AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {})];
      if (session) {
        updateSessionUser({ preferredLanguage: next });
        saves.push(
          api.users.updateLanguage(next, session.accessToken).catch(() => {
            // Best-effort — the choice still sticks locally via AsyncStorage.
          }),
        );
      }
      // Saved first: switching direction may restart the app.
      Promise.all(saves).then(() => applyDirection(next));
    },
    [session, updateSessionUser],
  );

  return <LanguageContext.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</LanguageContext.Provider>;
}

/** The current language, or null outside the provider — for the shared Text component, which also renders above it. */
export function useLangOrNull(): Lang | null {
  return useContext(LanguageContext)?.lang ?? null;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
