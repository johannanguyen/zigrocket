import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tar0bunny.zigrocket',       // must match App Store Connect bundle ID
  appName: 'ZigRocket',
  webDir: 'dist',
  plugins: {
    AdMob: {
      // Test mode — swap to your real iOS App ID before release
      // Format: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
      appId: 'ca-app-pub-3940256099942544~1458002511', // Apple test App ID
    },
  },
};

export default config;