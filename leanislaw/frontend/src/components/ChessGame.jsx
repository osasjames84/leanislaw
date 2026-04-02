import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, ChessboardProvider } from "react-chessboard";
import { authBearerHeaders } from "../apiHeaders";

function applyUci(game, uci) {
    if (!uci || uci.length < 4) return null;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    return game.move({ from, to, promotion });
}

function endingLabel(g) {
    if (g.isCheckmate()) return g.turn() === "w" ? "Checkmate — Chad wins." : "Checkmate — you win.";
    if (g.isDraw()) return "Draw.";
    if (g.isStalemate()) return "Stalemate.";
    return "Game over.";
}

function winnerFromGame(g) {
    if (g.isCheckmate()) return g.turn() === "w" ? "black" : "white";
    return "draw";
}

const DIFF_OPTS = [
    { id: "easy", label: "Easy" },
    { id: "medium", label: "Medium" },
    { id: "hard", label: "Hard" },
];

/**
 * Full-screen chess vs Chad (Black). Negamax AI via Python service.
 * Drag pieces or tap a piece then a highlighted square.
 */
export default function ChessGame({ onClose, token, initialSnapshot, onPause, onFinished, onNewGame }) {
    const gameRef = useRef(new Chess());
    const [fen, setFen] = useState(() => gameRef.current.fen());
    const [thinking, setThinking] = useState(false);
    const [error, setError] = useState("");
    const [chadLine, setChadLine] = useState("");
    const [status, setStatus] = useState("");
    const [difficulty, setDifficulty] = useState(() =>
        initialSnapshot?.difficulty && ["easy", "medium", "hard"].includes(initialSnapshot.difficulty)
            ? initialSnapshot.difficulty
            : "medium"
    );
    const [selectedSquare, setSelectedSquare] = useState(null);
    const endReportedRef = useRef(false);
    const lastQuoteRef = useRef("");

    const syncFen = useCallback(() => {
        setFen(gameRef.current.fen());
    }, []);

    useEffect(() => {
        if (!initialSnapshot?.fen) return;
        try {
            const g = new Chess(initialSnapshot.fen);
            if (!g.isGameOver()) {
                gameRef.current = g;
                syncFen();
            }
        } catch {
            /* keep default */
        }
    }, [initialSnapshot?.fen, syncFen]);

    const reportFinished = useCallback(() => {
        const g = gameRef.current;
        if (!g.isGameOver() || endReportedRef.current) return;
        endReportedRef.current = true;
        const label = endingLabel(g);
        setStatus(label);
        onFinished?.({
            winner: winnerFromGame(g),
            resultLabel: label,
            fen: g.fen(),
            difficulty,
            chadQuote: lastQuoteRef.current || "",
        });
    }, [difficulty, onFinished]);

    const runChadMove = useCallback(
        async (fenToSend) => {
            setThinking(true);
            setError("");
            setChadLine("");
            try {
                const q = new URLSearchParams({ fen: fenToSend, difficulty });
                const res = await fetch(`/api/v1/chess/move?${q.toString()}`, {
                    headers: authBearerHeaders(token),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const d = data.detail;
                    const detailStr = Array.isArray(d)
                        ? d.map((x) => (typeof x === "object" && x?.msg ? x.msg : String(x))).join(" ")
                        : d
                          ? String(d)
                          : "";
                    throw new Error(data.error || detailStr || "Chad engine error");
                }
                if (data.line) {
                    const line = String(data.line);
                    setChadLine(line);
                    lastQuoteRef.current = line;
                }
                const g = gameRef.current;
                if (data.done || !data.uci) {
                    syncFen();
                    if (g.isGameOver()) reportFinished();
                    return;
                }
                const m = applyUci(g, data.uci);
                if (!m) {
                    throw new Error("Invalid move from engine");
                }
                syncFen();
                setSelectedSquare(null);
                if (g.isGameOver()) reportFinished();
            } catch (e) {
                gameRef.current.undo();
                syncFen();
                setError(e.message || "Chess AI unavailable. Start the Python service (port 8000).");
            } finally {
                setThinking(false);
            }
        },
        [difficulty, syncFen, token, reportFinished]
    );

    const afterUserMove = useCallback(() => {
        syncFen();
        setStatus("");
        setChadLine("");
        setSelectedSquare(null);
        const g = gameRef.current;
        if (g.isGameOver()) {
            reportFinished();
            return;
        }
        void runChadMove(g.fen());
    }, [syncFen, runChadMove, reportFinished]);

    const tryUserMove = useCallback(
        (from, to) => {
            if (thinking) return false;
            const g = gameRef.current;
            if (g.turn() !== "w" || g.isGameOver()) return false;

            const piece = g.get(from);
            let promotion;
            if (piece?.type === "p" && to[1] === "8") {
                promotion = "q";
            }
            const move = g.move({ from, to, promotion });
            if (!move) return false;
            afterUserMove();
            return true;
        },
        [thinking, afterUserMove]
    );

    const onPieceDrop = useCallback(
        ({ sourceSquare, targetSquare }) => {
            return tryUserMove(sourceSquare, targetSquare);
        },
        [tryUserMove]
    );

    const legalDests = useMemo(() => {
        const g = gameRef.current;
        if (!selectedSquare || thinking || g.turn() !== "w" || g.isGameOver()) return [];
        const moves = g.moves({ square: selectedSquare, verbose: true });
        return moves.map((m) => m.to);
    }, [selectedSquare, thinking]);

    const squareStyles = useMemo(() => {
        const styles = {};
        if (selectedSquare) {
            styles[selectedSquare] = { backgroundColor: "rgba(250, 204, 21, 0.38)" };
            for (const sq of legalDests) {
                styles[sq] = {
                    ...(styles[sq] || {}),
                    backgroundColor: "rgba(34, 197, 94, 0.36)",
                };
            }
        }
        return styles;
    }, [selectedSquare, legalDests]);

    const onPieceClick = useCallback(
        ({ piece, square }) => {
            if (thinking) return;
            const g = gameRef.current;
            if (g.turn() !== "w" || g.isGameOver()) return;
            const p = String(piece?.pieceType || "");
            if (!p.startsWith("w")) return;
            setSelectedSquare((prev) => (prev === square ? null : square));
        },
        [thinking]
    );

    const onSquareClick = useCallback(
        ({ square }) => {
            if (thinking) return;
            const g = gameRef.current;
            if (g.turn() !== "w" || g.isGameOver()) return;
            if (!selectedSquare) return;
            if (selectedSquare === square) {
                setSelectedSquare(null);
                return;
            }
            if (legalDests.includes(square)) {
                tryUserMove(selectedSquare, square);
            } else {
                const pc = g.get(square);
                if (pc && pc.color === "w") {
                    setSelectedSquare(square);
                } else {
                    setSelectedSquare(null);
                }
            }
        },
        [thinking, selectedSquare, legalDests, tryUserMove]
    );

    const newGame = () => {
        gameRef.current = new Chess();
        setFen(gameRef.current.fen());
        setError("");
        setChadLine("");
        setStatus("");
        setThinking(false);
        setSelectedSquare(null);
        endReportedRef.current = false;
        lastQuoteRef.current = "";
        onNewGame?.();
    };

    const canDragPiece = useCallback(
        ({ piece }) => {
            if (thinking) return false;
            const g = gameRef.current;
            if (g.turn() !== "w" || g.isGameOver()) return false;
            return String(piece?.pieceType || "").startsWith("w");
        },
        [thinking]
    );

    const handleClose = () => {
        const g = gameRef.current;
        if (!g.isGameOver()) {
            onPause?.({ fen: g.fen(), difficulty });
        }
        onClose?.();
    };

    const boardOptions = useMemo(
        () => ({
            id: "chad-chess",
            position: fen,
            boardOrientation: "white",
            allowDragging: true,
            canDragPiece,
            onPieceDrop,
            onPieceClick,
            onSquareClick,
            squareStyles,
            boardStyle: { borderRadius: 8 },
        }),
        [fen, canDragPiece, onPieceDrop, onPieceClick, onSquareClick, squareStyles]
    );

    return (
        <div style={shell}>
            <div style={scrim} aria-hidden />
            <div style={panel}>
                <button type="button" style={closeFab} onClick={handleClose} aria-label="Close chess">
                    ✕
                </button>
                <h2 style={title}>Chess vs Chad</h2>
                <p style={subtitle}>You are White · Chad is Black</p>

                <div style={diffRow} role="group" aria-label="Difficulty">
                    {DIFF_OPTS.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            style={{
                                ...diffBtn,
                                ...(difficulty === d.id ? diffBtnOn : {}),
                            }}
                            onClick={() => setDifficulty(d.id)}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>

                <div style={boardWrap}>
                    <ChessboardProvider options={boardOptions}>
                        <Chessboard />
                    </ChessboardProvider>
                </div>

                <p style={hint}>Drag a piece or tap White, then tap a green square.</p>

                {thinking ? <div style={thinkingLine}>Chad is thinking…</div> : null}
                {chadLine ? <div style={personality}>{chadLine}</div> : null}
                {status ? <div style={statusLine}>{status}</div> : null}
                {error ? <div style={errLine}>{error}</div> : null}

                <div style={actions}>
                    <button type="button" style={secondaryBtn} onClick={newGame}>
                        New game
                    </button>
                </div>
            </div>
        </div>
    );
}

const shell = {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    boxSizing: "border-box",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};

const scrim = {
    position: "absolute",
    inset: 0,
    background: "rgba(15, 12, 28, 0.72)",
    backdropFilter: "blur(6px)",
};

const panel = {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 420,
    background: "#1c1c1e",
    borderRadius: 18,
    padding: "18px 16px 20px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};

const closeFab = {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    fontSize: "1rem",
    cursor: "pointer",
};

const title = {
    margin: "0 0 4px",
    fontSize: "1.25rem",
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
};

const subtitle = {
    margin: "0 0 10px",
    fontSize: "0.82rem",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
};

const diffRow = {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
};

const diffBtn = {
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: "0.8rem",
    fontWeight: 700,
    cursor: "pointer",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.85)",
};

const diffBtnOn = {
    background: "rgba(167, 139, 250, 0.35)",
    borderColor: "rgba(167, 139, 250, 0.6)",
    color: "#fff",
};

const boardWrap = {
    width: "100%",
    maxWidth: 360,
    margin: "0 auto",
};

const hint = {
    margin: "10px 0 0",
    fontSize: "0.72rem",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
};

const thinkingLine = {
    marginTop: 12,
    textAlign: "center",
    fontSize: "0.88rem",
    fontWeight: "650",
    color: "#a78bfa",
};

const personality = {
    marginTop: 8,
    textAlign: "center",
    fontSize: "0.85rem",
    fontStyle: "italic",
    color: "rgba(255,255,255,0.85)",
};

const statusLine = {
    marginTop: 8,
    textAlign: "center",
    fontSize: "0.9rem",
    fontWeight: "700",
    color: "#86efac",
};

const errLine = {
    marginTop: 8,
    textAlign: "center",
    fontSize: "0.82rem",
    color: "#fca5a5",
    lineHeight: 1.35,
};

const actions = {
    marginTop: 16,
    display: "flex",
    justifyContent: "center",
};

const secondaryBtn = {
    border: "none",
    borderRadius: 12,
    padding: "12px 20px",
    fontSize: "0.95rem",
    fontWeight: "700",
    cursor: "pointer",
    background: "rgba(255,255,255,0.14)",
    color: "#fff",
};
