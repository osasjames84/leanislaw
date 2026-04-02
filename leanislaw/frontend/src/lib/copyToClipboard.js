/**
 * Copy plain text. Uses Clipboard API when available; falls back to execCommand
 * so copy works over HTTP and inside some embedded WebViews where the API is blocked.
 */
export async function copyTextToClipboard(text) {
    const s = String(text ?? "");
    if (!s || typeof window === "undefined") return false;

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(s);
            return true;
        } catch {
            /* fall through */
        }
    }

    try {
        const ta = document.createElement("textarea");
        ta.value = s;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, s.length);
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}
