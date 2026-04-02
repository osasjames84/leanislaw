/**
 * Lean Is Law mobile shell (react-native-webview): detection + password-field helpers.
 * Query `?leanislaw_rn=1` is appended to the WebView entry URL; we also persist in sessionStorage
 * so client-side navigations still see the host as RN WebView before the injected global runs.
 */
function bootstrapLeanislawRnHost() {
    if (typeof window === "undefined") return;
    try {
        if (window.__LEANISLAW_RN_WEBVIEW === true) {
            sessionStorage.setItem("leanislaw_rn", "1");
            return;
        }
        const q = new URLSearchParams(window.location.search).get("leanislaw_rn");
        if (q === "1") {
            window.__LEANISLAW_RN_WEBVIEW = true;
            sessionStorage.setItem("leanislaw_rn", "1");
            return;
        }
        if (sessionStorage.getItem("leanislaw_rn") === "1") {
            window.__LEANISLAW_RN_WEBVIEW = true;
        }
    } catch {
        /* private mode, blocked storage */
    }
}

bootstrapLeanislawRnHost();

export function isReactNativeWebView() {
    if (typeof window === "undefined") return false;
    bootstrapLeanislawRnHost();
    return window.__LEANISLAW_RN_WEBVIEW === true;
}

/**
 * `type="password"` uses native secure text in embedded WebViews and often crashes WKWebView /
 * Android WebView on each keystroke. Use plain `text` plus bullet masking instead.
 */
export function passwordInputTypeForWebView(rnWeb, showPlain) {
    if (rnWeb) return "text";
    return showPlain ? "text" : "password";
}

export function mergePasswordFieldStyle(baseStyle, rnWeb, showPlain) {
    if (!rnWeb || showPlain) return baseStyle;
    return { ...baseStyle, WebkitTextSecurity: "disc" };
}

/** Dials back password managers / Keychain hooks that still make some WebViews crash. */
export function rnWebPasswordExtraProps(rnWeb) {
    if (!rnWeb) return {};
    return {
        autoComplete: "off",
        "data-lpignore": "true",
        "data-1p-ignore": "true",
    };
}
