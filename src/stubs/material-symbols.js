// Stand-in for @expo-google-fonts/material-symbols (see metro.config.js).
// expo-router imports expo-symbols for its native tabs, which this app
// doesn't use, and expo-symbols would otherwise put all seven Material
// Symbols font files (~7 MB) into every build and over-the-air update.
const useFonts = () => [true, null];
module.exports = {
  __esModule: true,
  useFonts,
  MaterialSymbols_100Thin: null,
  MaterialSymbols_200ExtraLight: null,
  MaterialSymbols_300Light: null,
  MaterialSymbols_400Regular: null,
  MaterialSymbols_500Medium: null,
  MaterialSymbols_600SemiBold: null,
  MaterialSymbols_700Bold: null,
};
