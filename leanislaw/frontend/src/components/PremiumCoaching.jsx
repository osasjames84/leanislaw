import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import CoachingHero from "../assets/coaching_hero.png";

/** GBP pricing — Stripe price IDs will match these in production. */
const MONTHLY_GBP = 60;
const SEMIANNUAL_GBP = 300; // billed every 6 months
const YEARLY_GBP = 540; // billed once per year

const SIX_MONTHS_AT_MONTHLY = MONTHLY_GBP * 6; // £360
const SEMIANNUAL_SAVINGS_GBP = SIX_MONTHS_AT_MONTHLY - SEMIANNUAL_GBP; // £60 vs paying monthly for 6 months
const SEMIANNUAL_DISCOUNT_PERCENT = Math.round((SEMIANNUAL_SAVINGS_GBP / SIX_MONTHS_AT_MONTHLY) * 100); // 17%

const ANNUAL_AT_MONTHLY_RATE = MONTHLY_GBP * 12; // £720
const YEARLY_SAVINGS_VS_MONTHLY_GBP = ANNUAL_AT_MONTHLY_RATE - YEARLY_GBP; // £180
const YEARLY_VS_MONTHLY_PERCENT = Math.round((YEARLY_SAVINGS_VS_MONTHLY_GBP / ANNUAL_AT_MONTHLY_RATE) * 100); // 25%

const ANNUAL_AT_SEMIANNUAL_RATE = SEMIANNUAL_GBP * 2; // £600 (two 6-month renewals)
const YEARLY_SAVINGS_VS_SEMIANNUAL_GBP = ANNUAL_AT_SEMIANNUAL_RATE - YEARLY_GBP; // £60
const YEARLY_VS_SEMIANNUAL_PERCENT = Math.round((YEARLY_SAVINGS_VS_SEMIANNUAL_GBP / ANNUAL_AT_SEMIANNUAL_RATE) * 100); // 10%

const SEMIANNUAL_EFFECTIVE_MONTHLY = (SEMIANNUAL_GBP / 6).toFixed(0);
const YEARLY_EFFECTIVE_MONTHLY = (YEARLY_GBP / 12).toFixed(2);

const PremiumCoaching = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { token, user, refreshUser } = useAuth();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [unlocking, setUnlocking] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [billing, setBilling] = useState("yearly");

    const checkoutEnabled = Boolean(status?.stripe_checkout_enabled);
    const stripeWebhookOk = Boolean(status?.stripe_webhook_configured);

    useEffect(() => {
        if (!token) return;
        fetch("/api/v1/coaching/status", { headers: authBearerHeaders(token) })
            .then(async (r) => {
                const data = await r.json().catch(() => ({}));
                if (!r.ok) {
                    setStatus({
                        ...data,
                        stripe_checkout_enabled: false,
                        stripe_status_error: data.error || `Could not load status (${r.status})`,
                    });
                    return;
                }
                setStatus(data);
            })
            .catch(() => setStatus({ stripe_checkout_enabled: false, stripe_status_error: "Network error loading status." }))
            .finally(() => setLoading(false));
    }, [token]);

    const stripeEnv = status?.stripe_env_check;
    const payBlockedReasons = [];
    if (!loading && stripeEnv && !checkoutEnabled) {
        if (!stripeEnv.secret_key) payBlockedReasons.push("STRIPE_SECRET_KEY");
        if (!stripeEnv.frontend_url) payBlockedReasons.push("FRONTEND_URL (Vercel site, e.g. https://yoursite.vercel.app)");
        if (!stripeEnv.price_monthly) payBlockedReasons.push("STRIPE_PRICE_ID_MONTHLY");
        if (!stripeEnv.price_semiannual) payBlockedReasons.push("STRIPE_PRICE_ID_SEMIANNUAL");
        if (!stripeEnv.price_yearly) payBlockedReasons.push("STRIPE_PRICE_ID_YEARLY");
    }

    const checkoutParam = searchParams.get("checkout");
    useEffect(() => {
        if (checkoutParam === "cancelled") {
            setMsg("Checkout cancelled. You can try again anytime.");
            setSearchParams({}, { replace: true });
            return;
        }
        if (checkoutParam !== "success" || !token) return;

        let cancelled = false;
        const headers = authBearerHeaders(token);
        const refresh = async () => {
            await refreshUser?.();
            const r = await fetch("/api/v1/coaching/status", { headers });
            const data = await r.json().catch(() => ({}));
            if (cancelled) return;
            setStatus((s) => ({ ...s, ...data }));
            if (data.premium_coaching_active) {
                setMsg("Payment successful — premium coaching is active.");
            } else {
                setMsg(
                    "Payment received. If access doesn’t show yet, wait a few seconds and pull to refresh or reopen this page."
                );
            }
            setSearchParams({}, { replace: true });
        };
        refresh();
        return () => {
            cancelled = true;
        };
    }, [checkoutParam, token, refreshUser, setSearchParams]);

    const isCoach = user?.role === "coach";
    const hasPremium = Boolean(status?.premium_coaching_active);

    const handleDevUnlock = async () => {
        if (!token) return;
        setUnlocking(true);
        setMsg("");
        try {
            const res = await fetch("/api/v1/coaching/dev/unlock-premium", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not unlock");
            await refreshUser?.();
            setStatus((s) => ({ ...s, premium_coaching_active: true }));
            setMsg("Premium coaching unlocked (dev). Stripe will replace this in production.");
        } catch (e) {
            setMsg(e.message);
        } finally {
            setUnlocking(false);
        }
    };

    const handleCheckout = async () => {
        if (!token || !checkoutEnabled || checkoutLoading) return;
        setCheckoutLoading(true);
        setMsg("");
        try {
            const res = await fetch("/api/v1/coaching/create-checkout-session", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ billing }),
            });
            const raw = await res.text();
            let data = {};
            try {
                data = raw ? JSON.parse(raw) : {};
            } catch {
                /* non-JSON response (e.g. proxy HTML) */
            }
            if (!res.ok) {
                const hint = data.hint ? ` ${data.hint}` : "";
                throw new Error(
                    (data.error || data.message || raw?.slice(0, 160) || `Request failed (${res.status})`) + hint
                );
            }
            if (data.url) {
                window.location.assign(data.url);
                return;
            }
            throw new Error("No checkout URL returned");
        } catch (e) {
            const text = e instanceof Error ? e.message : String(e);
            setMsg(text === "Failed to fetch" ? "Network error — check connection and that /api routes reach your backend." : text);
        } finally {
            setCheckoutLoading(false);
        }
    };

    if (isCoach) {
        return (
            <div style={page}>
                <button type="button" onClick={() => navigate("/coach")} style={backBtn}>
                    ← Coach dashboard
                </button>
                <p style={{ color: "#636366", marginTop: 24 }}>
                    You&apos;re signed in as a coach. This page is for clients purchasing coaching.
                </p>
            </div>
        );
    }

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" onClick={() => navigate(-1)} style={backBtn}>
                    ← Back
                </button>
            </header>

            <div style={heroCard}>
                <div style={photoRing}>
                    <img src={CoachingHero} alt="LeanIsLaw coach" style={photo} />
                </div>
                <p style={kicker}>Premium coaching</p>
                <h1 style={title}>Get coached by the #1 ranked Chad</h1>
                <p style={lead}>
                    Real check-ins, programming feedback, and accountability from the top of the LeanIsLaw
                    leaderboard. Spots are limited.
                </p>
                <p style={choosePlanLabel}>Choose your plan</p>
                <div style={pricingBlock} role="radiogroup" aria-label="Billing period">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={billing === "monthly"}
                        onClick={() => setBilling("monthly")}
                        style={{
                            ...tierBtn,
                            ...priceTier,
                            ...(billing === "monthly" ? tierBtnSelected : tierBtnIdle),
                        }}
                    >
                        <span style={billing === "monthly" ? selectedRing : radioOuter} aria-hidden>
                            <span style={billing === "monthly" ? radioDotOn : radioDotOff} />
                        </span>
                        <div style={tierBtnBody}>
                            <p style={tierLabel}>Monthly</p>
                            <p style={tierAmount}>
                                £{MONTHLY_GBP}
                                <span style={tierUnit}>/month</span>
                            </p>
                            <p style={tierHint}>Most flexible · cancel anytime</p>
                        </div>
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={billing === "semiannual"}
                        onClick={() => setBilling("semiannual")}
                        style={{
                            ...tierBtn,
                            ...priceTier,
                            ...(billing === "semiannual" ? tierBtnSelected : tierBtnIdle),
                        }}
                    >
                        <span style={billing === "semiannual" ? selectedRing : radioOuter} aria-hidden>
                            <span style={billing === "semiannual" ? radioDotOn : radioDotOff} />
                        </span>
                        <div style={tierBtnBody}>
                            <p style={tierLabel}>Every 6 months</p>
                            <p style={tierAmount}>
                                £{SEMIANNUAL_GBP}
                                <span style={tierUnit}>/6 months</span>
                            </p>
                            <p style={savingsLine}>
                                {`Save £${SEMIANNUAL_SAVINGS_GBP} vs £${MONTHLY_GBP}/mo for 6 months — ${SEMIANNUAL_DISCOUNT_PERCENT}% off`}
                            </p>
                            <p style={tierHint}>~£{SEMIANNUAL_EFFECTIVE_MONTHLY}/month equivalent</p>
                        </div>
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={billing === "yearly"}
                        onClick={() => setBilling("yearly")}
                        style={{
                            ...tierBtn,
                            ...priceTier,
                            ...priceTierBest,
                            ...(billing === "yearly" ? tierBtnSelectedYearly : tierBtnIdleYearly),
                        }}
                    >
                        <span style={bestValuePill}>Best value</span>
                        <span
                            style={{ ...(billing === "yearly" ? selectedRing : radioOuter), ...yearlyRadioWrap }}
                            aria-hidden
                        >
                            <span style={billing === "yearly" ? radioDotOn : radioDotOff} />
                        </span>
                        <div style={tierBtnBody}>
                            <p style={tierLabel}>1 year</p>
                            <p style={tierAmount}>
                                £{YEARLY_GBP}
                                <span style={tierUnit}>/year</span>
                            </p>
                            <p style={savingsLine}>
                                {`Save £${YEARLY_SAVINGS_VS_MONTHLY_GBP} vs £${MONTHLY_GBP}/mo for a year — ${YEARLY_VS_MONTHLY_PERCENT}% off`}
                            </p>
                            <p style={savingsLineMuted}>
                                {`Also £${YEARLY_SAVINGS_VS_SEMIANNUAL_GBP} less than two 6-month renewals (£${ANNUAL_AT_SEMIANNUAL_RATE}/yr · ${YEARLY_VS_SEMIANNUAL_PERCENT}% off)`}
                            </p>
                            <p style={tierHint}>
                                ~£{YEARLY_EFFECTIVE_MONTHLY}/month billed annually
                            </p>
                        </div>
                    </button>
                </div>

                {loading ? (
                    <p style={muted}>Loading…</p>
                ) : hasPremium ? (
                    <div style={activeBanner}>
                        <span style={badge}>ACTIVE</span>
                        <p style={{ margin: "8px 0 0", fontWeight: 700 }}>You have premium coaching access.</p>
                        <p style={{ margin: "6px 0 0", fontSize: "0.88rem", color: "#636366" }}>
                            More coach features will appear here as we ship them.
                        </p>
                    </div>
                ) : (
                    <>
                        <button
                            type="button"
                            style={{
                                ...payBtn,
                                ...(checkoutEnabled ? payBtnActive : {}),
                            }}
                            disabled={!checkoutEnabled || checkoutLoading}
                            onClick={handleCheckout}
                        >
                            {checkoutLoading
                                ? "Redirecting to Stripe…"
                                : billing === "monthly"
                                  ? `Pay with card — £${MONTHLY_GBP}/month`
                                  : billing === "semiannual"
                                    ? `Pay with card — £${SEMIANNUAL_GBP} every 6 months`
                                    : `Pay with card — £${YEARLY_GBP}/year`}
                        </button>
                        <p style={stripeHint}>
                            {checkoutEnabled
                                ? stripeWebhookOk
                                    ? "Secure checkout with Stripe. Your coaching access turns on after payment completes."
                                    : "Secure checkout with Stripe. If your access doesn’t show right away after paying, wait a minute and refresh this page."
                                : import.meta.env.DEV
                                  ? "Local dev: add Stripe env vars on the backend (see backend/HOSTING_BACKEND.md) to enable Pay."
                                  : "Checkout is off until your server has the Stripe variables below."}
                        </p>
                        {status?.stripe_status_error ? (
                            <p style={{ ...stripeHint, color: "#b45309", marginTop: 8 }}>{status.stripe_status_error}</p>
                        ) : null}
                        {!checkoutEnabled && payBlockedReasons.length > 0 ? (
                            <div style={payBlockedBox}>
                                <p style={payBlockedTitle}>Set these on Railway (backend service), then redeploy:</p>
                                <ul style={payBlockedList}>
                                    {payBlockedReasons.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                                <p style={stripeHint}>
                                    Names must match exactly. Use test <code style={inlineCode}>price_...</code> IDs with a
                                    test <code style={inlineCode}>sk_test_...</code> key.
                                </p>
                            </div>
                        ) : null}
                        {!checkoutEnabled && !loading && status && status.stripe_env_check == null && !status.stripe_status_error ? (
                            <p style={{ ...stripeHint, color: "#b45309", marginTop: 10 }}>
                                Pay is off. Redeploy the backend on Railway so it has the latest code, then set Stripe
                                variables on that same service (not only the database).
                            </p>
                        ) : null}
                        {import.meta.env.DEV || import.meta.env.VITE_SHOW_COACHING_DEV_UNLOCK === "true" ? (
                            <button
                                type="button"
                                style={devBtn}
                                onClick={handleDevUnlock}
                                disabled={unlocking}
                            >
                                {unlocking ? "Unlocking…" : "Dev: unlock without payment"}
                            </button>
                        ) : null}
                    </>
                )}

                {msg ? (
                    <p
                        style={{
                            color:
                                /successful|subscribed|unlock|Payment received|active/i.test(msg)
                                    ? "#047857"
                                    : "#b45309",
                            fontSize: "0.88rem",
                        }}
                    >
                        {msg}
                    </p>
                ) : null}
            </div>

            <p style={footer}>
                <Link to="/dashboard" style={link}>
                    Home
                </Link>
            </p>
        </div>
    );
};

const page = {
    minHeight: "100vh",
    background: "#f2f2f7",
    padding: "calc(14px + env(safe-area-inset-top, 0px)) 16px calc(88px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    boxSizing: "border-box",
};

const header = { marginBottom: 8 };
const backBtn = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: 700,
    fontSize: "0.95rem",
    cursor: "pointer",
    padding: "8px 0",
};

const heroCard = {
    background: "#fff",
    borderRadius: 20,
    padding: "28px 22px",
    border: "0.5px solid #e5e5ea",
    boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
    textAlign: "center",
};

const photoRing = {
    width: 120,
    height: 120,
    margin: "0 auto 16px",
    borderRadius: "50%",
    padding: 3,
    background: "linear-gradient(135deg, #007aff 0%, #5856d6 100%)",
    boxSizing: "border-box",
};
const photo = {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
    background: "#e5e5ea",
};

const kicker = {
    margin: "0 0 6px",
    fontSize: "0.68rem",
    fontWeight: 800,
    letterSpacing: "1.2px",
    color: "#007aff",
    textTransform: "uppercase",
};

const title = {
    margin: "0 0 12px",
    fontSize: "1.45rem",
    fontWeight: 800,
    letterSpacing: "-0.4px",
    lineHeight: 1.2,
    color: "#000",
};

const lead = {
    margin: "0 0 20px",
    fontSize: "0.95rem",
    color: "#636366",
    lineHeight: 1.45,
};

const choosePlanLabel = {
    margin: "0 0 10px",
    fontSize: "0.78rem",
    fontWeight: 800,
    letterSpacing: "0.6px",
    color: "#8e8e93",
    textTransform: "uppercase",
    textAlign: "left",
};
const pricingBlock = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 20,
    textAlign: "left",
};
const tierBtn = {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    width: "100%",
    boxSizing: "border-box",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    textAlign: "left",
    font: "inherit",
    outline: "none",
};
const tierBtnBody = { flex: 1, minWidth: 0 };
const tierBtnSelected = {
    border: "2px solid #007aff",
    boxShadow: "0 0 0 3px rgba(0, 122, 255, 0.2)",
    background: "#fff",
};
const tierBtnIdle = {
    border: "1px solid #d1d1d6",
    background: "#f5f5f7",
};
const tierBtnSelectedYearly = {
    border: "2px solid #007aff",
    boxShadow: "0 0 0 3px rgba(0, 122, 255, 0.2), 0 4px 16px rgba(0, 122, 255, 0.12)",
    background: "linear-gradient(180deg, #e8f2ff 0%, #fff 55%)",
};
const tierBtnIdleYearly = {
    border: "1px solid #b8d4f0",
    background: "linear-gradient(180deg, #e8f0fa 0%, #f7f9fc 100%)",
};
const selectedRing = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid #007aff",
    flexShrink: 0,
    marginTop: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
};
const radioOuter = {
    ...selectedRing,
    borderColor: "#c7c7cc",
    background: "#fff",
};
const radioDotOn = {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#007aff",
};
const radioDotOff = {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "transparent",
};
const yearlyRadioWrap = { marginTop: 2 };
const priceTier = {
    padding: "14px 16px",
    borderRadius: 14,
    background: "#fafafa",
    position: "relative",
};
const priceTierBest = {
    background: "linear-gradient(180deg, #f0f7ff 0%, #fff 100%)",
    boxShadow: "0 2px 12px rgba(0, 122, 255, 0.06)",
};
const bestValuePill = {
    position: "absolute",
    top: 12,
    right: 12,
    fontSize: "0.62rem",
    fontWeight: 800,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "#fff",
    background: "#007aff",
    padding: "4px 8px",
    borderRadius: 6,
};
const tierLabel = {
    margin: "0 0 6px",
    fontSize: "0.72rem",
    fontWeight: 800,
    letterSpacing: "0.8px",
    color: "#8e8e93",
    textTransform: "uppercase",
};
const tierAmount = {
    margin: 0,
    fontSize: "1.65rem",
    fontWeight: 800,
    color: "#000",
    letterSpacing: "-0.5px",
};
const tierUnit = { fontSize: "0.95rem", fontWeight: 700, color: "#636366" };
const tierHint = {
    margin: "8px 0 0",
    fontSize: "0.82rem",
    color: "#8e8e93",
    fontWeight: 600,
};
const savingsLine = {
    margin: "10px 0 0",
    fontSize: "0.88rem",
    color: "#047857",
    fontWeight: 700,
    lineHeight: 1.35,
};
const savingsLineMuted = {
    margin: "8px 0 0",
    fontSize: "0.8rem",
    color: "#0f766e",
    fontWeight: 600,
    lineHeight: 1.35,
};

const payBtn = {
    width: "100%",
    padding: "16px 20px",
    borderRadius: 14,
    border: "none",
    background: "#000",
    color: "#fff",
    fontWeight: 800,
    fontSize: "1rem",
    cursor: "not-allowed",
    opacity: 0.5,
};
const payBtnActive = {
    cursor: "pointer",
    opacity: 1,
};

const stripeHint = {
    margin: "12px 0 0",
    fontSize: "0.78rem",
    color: "#8e8e93",
    lineHeight: 1.35,
};

const payBlockedBox = {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    background: "#fff8eb",
    border: "1px solid #fde68a",
    textAlign: "left",
};
const payBlockedTitle = {
    margin: "0 0 8px",
    fontSize: "0.8rem",
    fontWeight: 800,
    color: "#92400e",
};
const payBlockedList = {
    margin: "0 0 8px",
    paddingLeft: 18,
    fontSize: "0.78rem",
    color: "#78350f",
    lineHeight: 1.45,
};
const inlineCode = {
    fontSize: "0.72rem",
    background: "#f3f4f6",
    padding: "1px 4px",
    borderRadius: 4,
};

const devBtn = {
    width: "100%",
    marginTop: 12,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px dashed #c7c7cc",
    background: "#f9f9fb",
    color: "#636366",
    fontWeight: 700,
    fontSize: "0.88rem",
    cursor: "pointer",
};

const activeBanner = {
    padding: 16,
    borderRadius: 14,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    textAlign: "center",
};

const badge = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    background: "#047857",
    color: "#fff",
    fontSize: "0.65rem",
    fontWeight: 800,
    letterSpacing: "0.5px",
};

const muted = { color: "#8e8e93" };
const footer = { textAlign: "center", marginTop: 24 };
const link = { color: "#007aff", fontWeight: 600, textDecoration: "none" };

export default PremiumCoaching;
