"""
Bundle runner for the leanislaw backend.

Reads a normalized weekly bundle (same shape as sample_data.json) as JSON on
stdin, runs the EXISTING engine unchanged — build_report (flagging/thresholds),
build_dashboard_html, build_client_pdf — and writes a JSON result to stdout:

  {
    "report": { ...full report model: summary, clients[] with status/flags... },
    "dashboard_html": "<!doctype html>...",
    "clients": [ { "id", "name", "status", "pdf_base64" }, ... ]
  }

PDFs are base64 so the Node backend can persist them the same way the app already
stores binaries in Postgres (see direct_messages.image_base64). Nothing about the
flagging logic is reimplemented here — this is just an I/O adapter.

Usage (from the backend): echo "<bundle json>" | python3 run_from_bundle.py
"""

from __future__ import annotations
import base64
import json
import os
import sys
import tempfile

from transform import build_report
from report_html import build_dashboard_html
from report_pdf import build_client_pdf


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        json.dump({"error": "empty bundle on stdin"}, sys.stdout)
        return 1
    try:
        bundle = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"error": f"invalid bundle JSON: {e}"}, sys.stdout)
        return 1

    report = build_report(bundle)
    dashboard_html = build_dashboard_html(report)

    clients_out = []
    with tempfile.TemporaryDirectory() as tmp:
        for c in report["clients"]:
            pdf_path = os.path.join(tmp, f"{c['id']}.pdf")
            build_client_pdf(c, report, pdf_path)
            with open(pdf_path, "rb") as fh:
                pdf_b64 = base64.b64encode(fh.read()).decode("ascii")
            clients_out.append({
                "id": c["id"],
                "name": c["name"],
                "status": c["status"],
                "pdf_base64": pdf_b64,
            })

    json.dump({
        "report": report,
        "dashboard_html": dashboard_html,
        "clients": clients_out,
    }, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
