import { I18nManager } from 'react-native';

/**
 * Mirrors a direction icon (chevron, arrow) when the app runs right-to-left
 * for Arabic. React Native already mirrors rows, margins and text in RTL;
 * glyphs that point somewhere have to be flipped by hand. The direction is
 * fixed for the app's lifetime (switching it restarts the app, see
 * language-context.tsx), so a constant is enough.
 */
export const rtlFlip = I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined;
