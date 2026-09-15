import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vazfitness.app',
  appName: 'Vaz Fitness',
  webDir: 'www',
  server: { androidScheme: 'https' },
  android: { useLegacyBridge: true },
  ios: { contentInset: 'automatic' }
};

export default config;
