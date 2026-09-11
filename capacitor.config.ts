import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ddanez.gestorpro',
  appName: "D'Danez Gestor Pro",
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
