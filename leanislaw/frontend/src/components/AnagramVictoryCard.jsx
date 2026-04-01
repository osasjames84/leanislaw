/**
 * Word-game style result card (green board, 4×4 ? tiles, crown, banner) for chat.
 */
export default function AnagramVictoryCard({ won, youPts, chadPts, quote }) {
    const banner = won ? "YOU WON!" : "CHAD WINS";
    const tiles = Array.from({ length: 16 }, (_, i) => i);

    return (
        <div style={card}>
            <div style={patternBg} />
            <div style={inner}>
                <div style={birdBadge} aria-hidden>
                    <span style={birdEmoji}>🐦</span>
                </div>
                <div style={gridWrap}>
                    <div style={tileGrid}>
                        {tiles.map((i) => (
                            <div key={i} style={tile}>
                                ?
                            </div>
                        ))}
                    </div>
                    <div style={crownWrap} aria-hidden>
                        <span style={crown}>👑</span>
                    </div>
                </div>
                <div style={bannerBar}>{banner}</div>
                <p style={scoreLine}>
                    {youPts.toLocaleString()} — you · {chadPts.toLocaleString()} — Chad
                </p>
                {quote ? <p style={quoteText}>{quote}</p> : null}
            </div>
        </div>
    );
}

const card = {
    position: "relative",
    borderRadius: 18,
    overflow: "hidden",
    maxWidth: 320,
    margin: "4px 0",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    border: "2px solid rgba(0,0,0,0.2)",
};

const patternBg = {
    position: "absolute",
    inset: 0,
    background: `
    repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 14px,
      rgba(0,0,0,0.07) 14px,
      rgba(0,0,0,0.07) 15px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 14px,
      rgba(0,0,0,0.07) 14px,
      rgba(0,0,0,0.07) 15px
    ),
    linear-gradient(155deg, #1e6b45 0%, #12402a 42%, #1a5c3c 100%)
  `,
};

const inner = {
    position: "relative",
    zIndex: 1,
    padding: "14px 14px 0",
};

const birdBadge = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(180deg, #2d8f5a 0%, #1a5c3a 100%)",
    border: "2px solid #fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
};

const birdEmoji = { fontSize: "1.15rem", lineHeight: 1 };

const gridWrap = {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    marginBottom: 4,
};

const tileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 5,
    padding: 10,
    background: "rgba(0,0,0,0.12)",
    borderRadius: 14,
};

const tile = {
    width: 36,
    height: 40,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "1rem",
    color: "#1a0f08",
    background: "linear-gradient(155deg, #efd9b8 0%, #c99d6b 42%, #8b623f 100%)",
    border: "2px solid #4a3020",
    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.45), 0 3px 8px rgba(0,0,0,0.25)",
};

const crownWrap = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
};

const crown = {
    fontSize: "3.25rem",
    lineHeight: 1,
    filter: "drop-shadow(0 0 2px #fff) drop-shadow(0 2px 0 #000)",
};

const bannerBar = {
    background: "#000",
    color: "#fff",
    fontWeight: 900,
    fontSize: "1.05rem",
    letterSpacing: "0.06em",
    textAlign: "center",
    padding: "12px 10px",
    margin: "0 -14px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};

const scoreLine = {
    margin: "10px 0 6px",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
};

const quoteText = {
    margin: "0 0 14px",
    fontSize: "0.85rem",
    lineHeight: 1.4,
    fontWeight: 650,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    textShadow: "0 1px 3px rgba(0,0,0,0.45)",
};
