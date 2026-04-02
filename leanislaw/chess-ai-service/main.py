"""
Chad chess: negamax + alpha-beta pruning. Difficulty selects search depth.
"""
import random
from typing import List, Optional, Tuple

import chess
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="LeanIsLaw Chess AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Search depth (plies) per difficulty — black is the AI
DIFFICULTY_DEPTH = {"easy": 2, "medium": 4, "hard": 6}

MATE_SCORE = 100_000


def piece_value(p: chess.PieceType) -> int:
    return {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 0,
    }.get(p, 0)


def evaluate_white_perspective(board: chess.Board) -> int:
    """Material balance: positive favors White."""
    if board.is_checkmate():
        return -MATE_SCORE if board.turn == chess.WHITE else MATE_SCORE
    if board.is_stalemate():
        return 0
    w = b = 0
    for sq in chess.SQUARES:
        pc = board.piece_at(sq)
        if pc is None:
            continue
        v = piece_value(pc.piece_type)
        if pc.color == chess.WHITE:
            w += v
        else:
            b += v
    mob = len(list(board.legal_moves))
    score = w - b + mob // 10
    return score


def pov_eval(board: chess.Board) -> int:
    """Leaf / terminal score for the side to move (negamax convention)."""
    e = evaluate_white_perspective(board)
    return e if board.turn == chess.WHITE else -e


def order_moves(board: chess.Board) -> List[chess.Move]:
    moves = list(board.legal_moves)

    def key(m: chess.Move) -> Tuple[int, int]:
        if not board.is_capture(m):
            return (1, 0)
        cap_pc = board.piece_at(m.to_square)
        if cap_pc is None:
            return (0, -piece_value(chess.PAWN))
        return (0, -piece_value(cap_pc.piece_type))

    moves.sort(key=key)
    return moves


def negamax(board: chess.Board, depth: int, alpha: int, beta: int) -> int:
    if board.is_checkmate() or board.is_stalemate():
        return pov_eval(board)
    if depth == 0:
        return pov_eval(board)

    max_eval = -10**9
    for move in order_moves(board):
        board.push(move)
        ev = -negamax(board, depth - 1, -beta, -alpha)
        board.pop()
        max_eval = max(max_eval, ev)
        alpha = max(alpha, ev)
        if alpha >= beta:
            break
    return max_eval


def best_move_at_depth(board: chess.Board, depth: int) -> Optional[chess.Move]:
    legal = list(board.legal_moves)
    if not legal:
        return None
    if depth <= 0:
        return random.choice(legal)

    best_m: Optional[chess.Move] = None
    best_score = -10**9
    alpha = -10**9
    beta = 10**9
    for move in order_moves(board):
        board.push(move)
        score = -negamax(board, depth - 1, -beta, -alpha)
        board.pop()
        if score > best_score:
            best_score = score
            best_m = move
        alpha = max(alpha, score)
        if alpha >= beta:
            break
    return best_m or random.choice(legal)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/best-move")
def best_move(
    fen: str = Query(..., description="FEN; side to move plays the reply"),
    difficulty: str = Query("medium", description="easy | medium | hard"),
    depth: Optional[int] = Query(None, ge=0, le=10, description="Override plies if set"),
):
    fen = fen.strip()
    if not fen:
        raise HTTPException(400, "fen required")
    d = depth
    if d is None:
        d = DIFFICULTY_DEPTH.get(difficulty.lower(), DIFFICULTY_DEPTH["medium"])
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise HTTPException(400, f"invalid fen: {e}") from e

    if board.is_game_over():
        return {"uci": None, "done": True, "result": board.result()}

    move = best_move_at_depth(board, d)
    if move is None:
        return {"uci": None, "done": True, "result": board.result()}

    return {"uci": move.uci(), "done": False}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
