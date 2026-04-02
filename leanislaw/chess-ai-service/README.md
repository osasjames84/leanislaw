# Chess AI service (Chad Bot)

FastAPI + `python-chess`. Node proxies `GET /api/v1/chess/move` → `GET /best-move` here.

## Setup

```bash
cd chess-ai-service
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

From repo `leanislaw/`:

```bash
npm run chess-ai
```

Or:

```bash
cd chess-ai-service && uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## API

- `GET /health` — liveness
- `GET /best-move?fen=<FEN>&depth=0|1|2` — `depth=0` random legal move; `depth>=1` shallow material greedy

Response: `{ "uci": "e7e5" | null, "done": boolean, "result"?: string }`

## Production

Host this service (or container) and set `CHESS_AI_SERVICE_URL` on the Node backend to its public base URL (no trailing slash).
