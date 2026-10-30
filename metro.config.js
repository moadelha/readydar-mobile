const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The app draws its icons with Ionicons; Material Symbols fonts are never
// shown, so they resolve to a tiny stub instead of ~7 MB of .ttf files.
const materialSymbolsStub = path.resolve(__dirname, 'src/stubs/material-symbols.js');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@expo-google-fonts/material-symbols' || moduleName.startsWith('@expo-google-fonts/material-symbols/')) {
    return { type: 'sourceFile', filePath: materialSymbolsStub };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
