import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alger.musicplayer',
  appName: 'AlgerMusicPlayer',
  webDir: 'out/renderer',
  server: {
    androidScheme: 'https'
  }
};

export default config;
