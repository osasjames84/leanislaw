#!/usr/bin/env python3
"""Wrap the artifact source (index.html) into a standalone page for static hosting.

The artifact platform supplies its own <!doctype>/<head>/<body> skeleton, so
index.html is written as bare page content. A web host does not, hence this.
Run after editing index.html:  python3 tdee-calculator/build.py
Outputs site/index.html (served) and artifact.html (bare, for the Claude Artifact preview).
"""
import io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "index.html")
OUT_DIR = os.path.join(HERE, "site")
OUT = os.path.join(OUT_DIR, "index.html")

TITLE = "JD Osas Maintenance Calculator"
DESC = ("Work out your maintenance calories from bodyweight, body fat and how often "
        "you train. Get your rest-day, training-day and weekly average targets.")
FAVICON = ("data:image/svg+xml,"
           "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E"
           "%3Ctext y='.9em' font-size='90'%3E%F0%9F%94%A5%3C/text%3E%3C/svg%3E")

body = io.open(SRC, encoding="utf-8").read()

# Inline the 3D figure data so both outputs are single files (the Artifact
# host cannot load a sibling script; Railway could, but one file is simpler).
DATA = os.path.join(HERE, "body-data.js")
if os.path.exists(DATA):
    body = body.replace('<script src="body-data.js"></script>',
                        "<script>" + io.open(DATA, encoding="utf-8").read() + "</script>")

# The <title> and font <link>s belong in <head>, not the body. Lift them out.
head_bits = []
page = body
for pattern in (r"<title>.*?</title>\s*", r"<link [^>]*>\s*"):
    for m in re.findall(pattern, page, flags=re.S):
        head_bits.append(m.strip())
    page = re.sub(pattern, "", page, flags=re.S)

html = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        "<meta name=\"description\" content=\"" + DESC + "\">\n"
        "<meta name=\"color-scheme\" content=\"light dark\">\n"
        "<link rel=\"icon\" href=\"" + FAVICON + "\">\n"
        + "\n".join(head_bits) + "\n</head>\n<body>\n" + page + "\n</body>\n</html>\n")
os.makedirs(OUT_DIR, exist_ok=True)
io.open(OUT, "w", encoding="utf-8").write(html)
print("built %s (%d bytes)" % (OUT, len(html.encode("utf-8"))))

# Bare version for publishing as a Claude Artifact (the host adds the skeleton).
ART = os.path.join(HERE, "artifact.html")
io.open(ART, "w", encoding="utf-8").write(body)
print("built %s (%d bytes)" % (ART, len(body.encode("utf-8"))))
