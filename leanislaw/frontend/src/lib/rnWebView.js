/** Set early by `leanislawmobile` WebView injection (see App.js). */
export function isReactNativeWebView() {
    return typeof window !== "undefined" && window.__LEANISLAW_RN_WEBVIEW === true;
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
