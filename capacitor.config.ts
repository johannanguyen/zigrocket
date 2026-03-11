import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tar0bunny.zigrocket',
  appName: 'ZigRocket',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-9841742295978516~6744164137',
    },
  },
};

export default config;