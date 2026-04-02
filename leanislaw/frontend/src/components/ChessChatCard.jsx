/**
 * Chat bubble card for chess: finished game or paused mid-game.
 */
export default function ChessChatCard({ paused, winner, resultLabel, difficulty, quote }) {
    const diffLabel = difficulty ? String(difficulty).charAt(0).toUpperCase() + String(difficulty).slice(1) : "";

    if (paused) {
        return (
            <div style={card}>
                <div style={iconRow} aria-hidden>
                    <span style={emoji}>♟️</span>
                </div>
                <div style={title}>Chess paused</div>
                <p style={body}>Your game vs Chad was saved. Open Games → Chess to continue.</p>
                {diffLabel ? <p style={meta}>Difficulty: {diffLabel}</p> : null}
            </div>
        );
    }

    let banner = "Draw";
    if (winner === "white") banner = "You won";
    if (winner === "black") banner = "Chad wins";

    return (
        <div style={card}>
            <div style={iconRow} aria-hidden>
                <span style={emoji}>♟️</span>
            </div>
            <div style={title}>{banner}</div>
            {resultLabel ? <p style={body}>{resultLabel}</p> : null}
            {quote ? <p style={quoteStyle}>{quote}</p> : null}
            {diffLabel ? <p style={meta}>Difficulty: {diffLabel}</p> : null}
        </div>
    );
}

const card = {
    borderRadius: 16,
    padding: "14px 16px",
    maxWidth: 300,
    margin: "4px 0",
    background: "linear-gradient(155deg, #2a2438 0%, #1a1624 100%)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
};

const iconRow = {
    display: "flex",
    justifyContent: "center",
    marginBottom: 6,
};

const emoji = { fontSize: "1.75rem", lineHeight: 1 };

const title = {
    margin: "0 0 8px",
    fontSize: "1.05rem",
    fontWeight: 800,
    color: "#fff",
    textAlign: "center",
};

const body = {
    margin: "0 0 6px",
    fontSize: "0.82rem",
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
};

const meta = {
    margin: 0,
    fontSize: "0.72rem",
    fontWeight: 650,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
};

const quoteStyle = {
    margin: "0 0 8px",
    fontSize: "0.8rem",
    fontStyle: "italic",
    lineHeight: 1.35,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
};
