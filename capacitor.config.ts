import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brimo.enhancer',
  appName: 'Brimo UI Enhancer',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  bundledWebRuntime: false,
};

export default config;
