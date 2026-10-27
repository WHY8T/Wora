import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.waheb.wora",
  appName: "Wora",
  webDir: "dist/public",
  plugins: {
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
  },
};

export default config;