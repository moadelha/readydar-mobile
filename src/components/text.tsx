import { createContext, forwardRef, useContext } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { colors, fonts, isDark } from '@/theme';
import { useLangOrNull } from '@/lib/i18n/language-context';

/**
 * Text and TextInput set in IBM Plex — every screen imports these instead of
 * react-native's, so the whole app is in the brand typeface without each
 * style naming a font file.
 *
 * A custom font is one file per weight, and Android ignores `fontWeight` on
 * it (or fakes a bold), so the weight a style asks for is mapped to the
 * matching Plex file here. Plex ships 400/500/600 in the app, like the web;
 * heavier weights resolve to 600. In Arabic the Plex Sans Arabic files are
 * used (they carry Latin too), with no letter-spacing and 10% more leading.
 * A style that names its own fontFamily (mono codes) is left alone.
 */

type Weight = 400 | 500 | 600;

function toWeight(w: TextStyle['fontWeight']): Weight {
  if (w === undefined || w === null) return 400;
  if (w === 'bold') return 600;
  const n = typeof w === 'number' ? w : parseInt(w, 10);
  if (Number.isNaN(n)) return 400;
  if (n >= 600) return 600;
  if (n >= 500) return 500;
  return 400;
}

// A nested <Text> inherits its parent's weight in React Native; with one
// file per weight that has to be passed down explicitly.
const ParentWeight = createContext<Weight | null>(null);

function brandStyle(style: StyleProp<TextStyle>, arabic: boolean, parent: Weight | null) {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return { style, weight: toWeight(flat.fontWeight) };
  const weight = flat.fontWeight !== undefined ? toWeight(flat.fontWeight) : (parent ?? 400);
  const extra: TextStyle = {
    fontFamily: (arabic ? fonts.arabic : fonts.latin)[weight],
    fontWeight: 'normal',
  };
  if (arabic) {
    extra.letterSpacing = 0;
    if (flat.lineHeight) extra.lineHeight = Math.round(flat.lineHeight * 1.1);
  }
  return { style: [style, extra], weight };
}

export const Text = forwardRef<RNText, TextProps>(function BrandText({ style, children, ...rest }, ref) {
  const arabic = useLangOrNull() === 'AR';
  const parent = useContext(ParentWeight);
  const { style: s, weight } = brandStyle(style, arabic, parent);
  const plain = typeof children === 'string' || typeof children === 'number';
  return (
    <RNText ref={ref} style={s} {...rest}>
      {plain ? children : <ParentWeight.Provider value={weight}>{children}</ParentWeight.Provider>}
    </RNText>
  );
}) as unknown as typeof RNText;
export type Text = RNText;

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function BrandTextInput({ style, ...rest }, ref) {
  const arabic = useLangOrNull() === 'AR';
  return (
    <RNTextInput
      ref={ref}
      keyboardAppearance={isDark ? 'dark' : 'light'}
      selectionColor={colors.primary}
      {...rest}
      style={brandStyle(style, arabic, null).style}
    />
  );
}) as unknown as typeof RNTextInput;
export type TextInput = RNTextInput;
