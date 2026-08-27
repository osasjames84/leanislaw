#!/usr/bin/env python3
"""Wrap the artifact source (index.html) into a standalone page for static hosting.

The artifact platform supplies its own <!doctype>/<head>/<body> skeleton, so
index.html is written as bare page content. A web host does not, hence this.
Run after editing index.html:  python3 tdee-calculator/build.py
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

# The <title> and font <link>s belong in <head>, not the body. Lift them out.
head_bits = []
for pattern in (r"<title>.*?</title>\s*", r"<link [^>]*>\s*"):
    for m in re.findall(pattern, body, flags=re.S):
        head_bits.append(m.strip())
    body = re.sub(pattern, "", body, flags=re.S)

head_links = "\n  ".join(b for b in head_bits if b.startswith("<link"))

page = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="{favicon}">
  {links}
</head>
<body>
{body}
</body>
</html>
""".format(title=TITLE, desc=DESC, favicon=FAVICON, links=head_links, body=body.strip())

if not os.path.isdir(OUT_DIR):
    os.makedirs(OUT_DIR)
io.open(OUT, "w", encoding="utf-8").write(page)
print("built %s (%d bytes)" % (OUT, len(page)))
