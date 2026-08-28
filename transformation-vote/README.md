# 45-Day Lean Transformation vote

One-page public vote for the 18 finalists. Node + Express + Postgres.

## How it works

- `public/index.html` is the whole front end. No build step.
- `public/photos/<slug>-front.jpg` and `-back.jpg` are the Week 1 vs Week 6
  collages, converted from the original PNGs at quality 82 (about 80KB each so
  the page opens fast on mobile data).
- `finalists.json` maps slug to display name. Edit this to rename anyone.

## Voting rules enforced by the server

- One vote per browser. `voter_id` is the table's PRIMARY KEY, so two
  simultaneous requests cannot both insert; the second is rejected by Postgres.
- `IP_CAP` (default 8) votes per network, to blunt trivial scripted abuse.
  Deliberately loose because mobile carriers put many real people behind one IP.
- Results are hidden until you have voted, so nobody is swayed by who is ahead.
- Card order is shuffled per visitor, so no one gains from being first.

This is a friendly community vote, not a secure ballot. Anyone determined enough
can clear their storage and vote again. Do not treat it as fraud proof.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Without it the app runs in memory and loses votes on restart. The page shows a warning when this happens. |
| `VOTE_CLOSES_AT` | ISO timestamp when voting closes, e.g. `2026-08-30T12:00:00Z`. Drives the countdown and blocks late votes. Omit to leave voting open. |
| `ADMIN_KEY` | Secret for `/api/results?key=...`, the full ranked tally. |
| `IP_CAP` | Max votes per network. Default 8. |

## Checking the result

    curl "https://<service>.onrender.com/api/results?key=<ADMIN_KEY>"

Returns every finalist ranked by votes, including full names.
