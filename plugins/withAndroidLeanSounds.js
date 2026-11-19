/**
 * expo-notifications copies every file listed in its `sounds` option into android/app/src/main/res/raw. The iOS
 * notification sounds (.wav, ~1–2 MB each) are listed there too, but Android never plays them: the Android adhan uses
 * the .mp3 clips and the native alarm module. This plugin removes the unused .wav files from the Android project.
 *
 * It must be listed BEFORE `expo-notifications` in app.json: Expo runs the mods of the last-listed plugin first.
 */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withAndroidLeanSounds(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const raw = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      if (fs.existsSync(raw)) {
        for (const f of fs.readdirSync(raw)) if (f.endsWith('.wav')) fs.rmSync(path.join(raw, f));
      }
      return cfg;
    },
  ]);
};
