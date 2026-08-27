# JD Osas Maintenance Calculator

Client-facing maintenance calorie calculator. Static page, no build step, no
dependencies, no backend.

## Files

- `index.html` — the page. Written as bare content (no `<!doctype>`/`<head>`/
  `<body>`) because it is also published as a Claude Artifact, which supplies
  its own document skeleton.
- `build.py` — wraps `index.html` into a standalone document for web hosting:
  adds the doctype, charset, viewport, favicon and Open Graph tags, and lifts
  the `<title>` and font `<link>`s into a real `<head>`.
- `site/index.html` — generated output. **This is what Render serves.**

## Making a change

Edit `index.html`, then rebuild and commit both:

    python3 tdee-calculator/build.py
    git add tdee-calculator && git commit && git push

Render auto-deploys from this branch. `site/index.html` is committed rather
than built on Render so a missing interpreter can never break a deploy.

## What it calculates

BMR from lean mass and fat mass separately, then a daily multiplier built from
non-exercise movement, training, and the thermic effect of food. Training is
entered as sessions per week, so the page can return rest-day, training-day and
weekly average figures.

The per-hour coefficients and multipliers are deliberately not shown in the UI.
They live in the `NEAT` and `INTENSITY` tables at the top of the script.

A self-check runs on load and warns in the console if the reference examples
(2340 / 2160 / 2880) ever stop matching.
