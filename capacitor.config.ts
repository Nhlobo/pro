import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d782484e4dde45029b59ffe68f3de0a7',
  appName: 'medilegal-nexus',
  webDir: 'dist',
  server: {
    url: 'https://kamedico-legal.co.za',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false
    }
  }
};

export default config;