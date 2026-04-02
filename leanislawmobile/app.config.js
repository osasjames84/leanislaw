/** Expo loads `.env` / `.env.local` before this runs — exposes URL to the JS bundle via `expo-constants`. */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      webUrl: process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") || null,
    },
  },
};
