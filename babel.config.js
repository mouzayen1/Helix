// babel-preset-expo includes the transform that substitutes
// `process.env.EXPO_PUBLIC_*` references with their values at bundle
// time. Without this file, Babel applies no preset, so those
// references stay as runtime lookups against Hermes' empty
// `process.env` and evaluate to undefined — breaking auth in
// any bundle produced by `expo export` / `eas update`.
//
// EAS Build is unaffected because it runs its own env-substitution
// step before invoking Metro; the bug only manifests in OTA bundles
// shipped via `eas update`.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
