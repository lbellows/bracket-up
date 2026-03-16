module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin replaces react-native-reanimated/plugin in reanimated v4
    plugins: ['react-native-worklets/plugin'],
  };
};
