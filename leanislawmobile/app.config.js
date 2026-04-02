/** Expo loads `.env` / `.env.local` before this runs — exposes URL to the JS bundle via `expo-constants`. */
const appJson = require("./app.json");

const simOn =
  process.env.EXPO_PUBLIC_SIM_AUTO_LOGIN === "1" ||
  /^true$/i.test(String(process.env.EXPO_PUBLIC_SIM_AUTO_LOGIN || ""));
const simEmail = String(process.env.EXPO_PUBLIC_SIM_LOGIN_EMAIL || "").trim();
const simPassword = process.env.EXPO_PUBLIC_SIM_LOGIN_PASSWORD;
const simAutoLogin =
  simOn && simEmail && simPassword != null && String(simPassword) !== ""
    ? { email: simEmail, password: String(simPassword) }
    : null;
/** If iOS reports Device.isDevice incorrectly, set 1 to still inject sim creds. */
const simAutoLoginForce =
  process.env.EXPO_PUBLIC_SIM_AUTO_LOGIN_FORCE === "1" ||
  /^true$/i.test(String(process.env.EXPO_PUBLIC_SIM_AUTO_LOGIN_FORCE || ""));

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      webUrl: process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") || null,
      simAutoLogin,
      simAutoLoginForce,
    },
  },
};
