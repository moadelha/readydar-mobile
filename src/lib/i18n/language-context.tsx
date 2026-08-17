import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth-context';
import { api } from '../api';
import { en, fr, ar, Dict } from './dictionary';

export type Lang = 'EN' | 'FR' | 'AR';

const DICTS: Record<Lang, Dict> = { EN: en, FR: fr, AR: ar };
const STORAGE_KEY = 'darclean_lang';

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
      } else if (session?.user.preferredLanguage && DICTS[session.user.preferredLanguage]) {
        setLangState(session.user.preferredLanguage);
      }
    });
  }, [session?.user.preferredLanguage]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      if (session) {
        updateSessionUser({ preferredLanguage: next });
        api.users.updateLanguage(next, session.accessToken).catch(() => {
          // Best-effort — the choice still sticks locally via AsyncStorage.
        });
      }
    },
    [session, updateSessionUser],
  );

  return <LanguageContext.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
