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
/** Set at sign-up: save this phone's language on the account at the first sign-in. */
const NEW_ACCOUNT_KEY = 'darclean_lang_new_account';

/**
 * A new account's language is French until told otherwise, so someone who
 * signed up in English landed in French at their first sign-in. Called once
 * the account exists; it can't be saved there before signing in.
 */
export async function keepLanguageForNewAccount(lang: Lang) {
  await AsyncStorage.multiSet([[STORAGE_KEY, lang], [NEW_ACCOUNT_KEY, lang]]).catch(() => {});
}

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

/** The phone's language when it's one of ours, else English. */
function phoneLang(): Lang {
  try {
    const code = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
    return code === 'fr' ? 'FR' : code === 'ar' ? 'AR' : 'EN';
  } catch {
    return 'EN';
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
  const { session, isLoading, updateSessionUser } = useAuth();
  // Until someone picks one: the phone's own language.
  const [lang, setLangState] = useState<Lang>(phoneLang);

  // Resolution order: whatever the person picked on this device
  // (AsyncStorage) wins immediately; otherwise fall back to the language
  // saved on their account, then to the phone's language.
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && DICTS[stored as Lang]) {
        setLangState(stored as Lang);
        applyDirection(stored as Lang);
      } else {
        const saved = session?.user?.preferredLanguage;
        const next = saved && DICTS[saved] ? saved : phoneLang();
        setLangState(next);
        applyDirection(next);
      }
    });
  }, [isLoading, session?.user?.preferredLanguage]);

  const token = session?.accessToken;
  const userId = session?.user?.id;
  useEffect(() => {
    if (!token) return;
    (async () => {
      const wanted = await AsyncStorage.getItem(NEW_ACCOUNT_KEY).catch(() => null);
      if (!wanted || !DICTS[wanted as Lang]) return;
      await api.users.updateLanguage(wanted as Lang, token);
      await AsyncStorage.removeItem(NEW_ACCOUNT_KEY);
      updateSessionUser({ preferredLanguage: wanted as Lang });
    })().catch(() => {
      // Tried again at the next start.
    });
    // Once per signed-in user, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
