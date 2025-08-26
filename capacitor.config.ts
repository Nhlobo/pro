import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d782484e4dde45029b59ffe68f3de0a7',
  appName: 'medilegal-nexus',
  webDir: 'dist',
  server: {
    url: 'https://d782484e-4dde-4502-9b59-ffe68f3de0a7.lovableproject.com?forceHideBadge=true',
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