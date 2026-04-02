import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Device from "expo-device";

/** Prefer `extra` from app.config.js (reliable with `.env.local`) then Metro-inlined env. */
const WEB_BASE = String(
  Constants.expoConfig?.extra?.webUrl ||
    process.env.EXPO_PUBLIC_WEB_URL ||
    "http://localhost:5173",
).replace(/\/$/, "");

/** Entry URL signals RN WebView host (`rnWebView.js` + sessionStorage) so SPA routes still apply fixes. */
function webEntryUri(base) {
  try {
    const u = new URL(base);
    u.searchParams.set("leanislaw_rn", "1");
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}leanislaw_rn=1`;
  }
}

const WEB_ENTRY_URI = webEntryUri(WEB_BASE);

const simCreds = Constants.expoConfig?.extra?.simAutoLogin;
const simForce = Boolean(Constants.expoConfig?.extra?.simAutoLoginForce);
const useSimAutoLogin =
  Platform.OS === "ios" &&
  simCreds?.email &&
  simCreds.password != null &&
  String(simCreds.password) !== "" &&
  (!Device.isDevice || simForce);

const simCredsJson = useSimAutoLogin
  ? JSON.stringify({
      email: simCreds.email,
      password: simCreds.password,
    })
  : "";

const simLoginInject = simCredsJson
  ? `try{window.__LEANISLAW_SIM_AUTO_LOGIN=${simCredsJson};}catch(_){}`
  : "";

/** After document loads, set creds again + notify (fixes Strict Mode / injection ordering). */
const SIM_LOGIN_INJECT_AFTER_LOAD = simCredsJson
  ? `try{window.__LEANISLAW_SIM_AUTO_LOGIN=${simCredsJson};window.dispatchEvent(new Event('leanislaw-sim-autologin'));}catch(_){}`
  : "";

/** Sets RN host + optional iOS Simulator auto-login creds before page JS (see web `Login.jsx`). */
const INJECT_BEFORE_CONTENT = `window.__LEANISLAW_RN_WEBVIEW=true;${simLoginInject};true;`;

const fillScreen = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: "center",
  justifyContent: "center",
};

export default function App() {
  const webRef = useRef(null);
  const loadOkRef = useRef(false);
  const [loadError, setLoadError] = useState(null);

  const clearErrorAndReload = useCallback(() => {
    setLoadError(null);
    loadOkRef.current = false;
    webRef.current?.reload();
  }, []);

  const safeReloadAfterCrash = useCallback(() => {
    if (loadOkRef.current) {
      webRef.current?.reload();
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {loadError ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Could not load the app</Text>
          <Text style={styles.errorUrl} selectable>
            {WEB_BASE}
          </Text>
          <Text style={styles.errorHint}>
            {Platform.OS === "android"
              ? "Android blocks plain http unless usesCleartextTraffic is enabled. It is in app.json — create a new dev client / rebuild native after this change."
              : ""}
            {Platform.OS === "ios"
              ? "Simulator: localhost works. On a device use your computer’s LAN IP and bind Vite to 0.0.0.0."
              : ""}
            {"\n\n"}
            Set EXPO_PUBLIC_WEB_URL in leanislawmobile/.env.local, then run{" "}
            <Text style={styles.mono}>npx expo start --clear</Text>.
          </Text>
          {loadError.description ? (
            <Text style={styles.errorDetail} selectable>
              {loadError.description}
            </Text>
          ) : null}
          <Pressable style={styles.retryBtn} onPress={clearErrorAndReload}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={webRef}
        source={{ uri: WEB_ENTRY_URI }}
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE_CONTENT}
        onLoadEnd={() => {
          loadOkRef.current = true;
          setLoadError(null);
          if (SIM_LOGIN_INJECT_AFTER_LOAD) {
            webRef.current?.injectJavaScript(`${SIM_LOGIN_INJECT_AFTER_LOAD};true;`);
          }
        }}
        onError={(e) => {
          const ev = e?.nativeEvent;
          setLoadError({
            description: [ev?.description, ev?.title].filter(Boolean).join(" — ") || "Unknown error",
          });
        }}
        onHttpError={(e) => {
          const ne = e?.nativeEvent;
          const s = ne?.statusCode;
          if (s == null || s < 400) return;
          const u = ne?.url || "";
          let origin = "";
          try {
            origin = new URL(WEB_BASE).origin;
          } catch {
            /* ignore */
          }
          if (origin && u && !u.startsWith(origin)) return;
          setLoadError({ description: `HTTP ${s}` });
        }}
        onContentProcessDidTerminate={safeReloadAfterCrash}
        onRenderProcessGone={
          Platform.OS === "android" ? safeReloadAfterCrash : undefined
        }
        {...(Platform.OS === "ios"
          ? {
              useSharedProcessPool: false,
              /** Strong Password / accessory bar uses native bridges that often crash with secure fields. */
              hideKeyboardAccessoryView: true,
              keyboardDisplayRequiresUserAction: true,
            }
          : { nestedScrollEnabled: true })}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingHint} selectable>
              {WEB_BASE}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loading: {
    ...fillScreen,
    backgroundColor: "#000",
  },
  loadingHint: {
    marginTop: 16,
    color: "#8e8e93",
    fontSize: 12,
    paddingHorizontal: 24,
  },
  errorPanel: {
    ...fillScreen,
    backgroundColor: "#1c1c1e",
    padding: 24,
    zIndex: 2,
    elevation: 4,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  errorUrl: {
    color: "#8e8e93",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  errorHint: {
    color: "#aec0d0",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  errorDetail: {
    color: "#ff9f0a",
    fontSize: 12,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: "#0a84ff",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#fff",
  },
});
