"""Expose stored discovery and verification data via FastAPI."""

from __future__ import annotations

import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.discovery import DiscoveryError, discover_candidates
from core.probe import probe_node
from core.scoring import rank_verifications
from core.store import (
    dump_verifications_csv,
    fetch_verifications,
    get_endpoint_count,
    get_endpoints,
    store_probes,
    store_endpoints,
    store_verifications,
)
from core.verify import verify_endpoint
from dotenv import load_dotenv


# Load variables from .env so the DB path/env overrides are available to the API.
load_dotenv()

app = FastAPI(title="DARN API", version="0.1.0")

# Allow local dev frontends (Vite default port 5173) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"service": "DARN API", "docs": "/docs"}


@app.get("/verifications")
def list_verifications() -> dict[str, object]:
    try:
        records = fetch_verifications()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"count": len(records), "items": records}


@app.get("/endpoints")
def list_endpoints() -> dict[str, object]:
    try:
        endpoints = get_endpoints()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"count": len(endpoints), "items": endpoints}


def main() -> int:
    # Keep the original CLI flow for discovery + verification.
    endpoints: list[str] = []

    if get_endpoint_count() > 0:
        print("Endpoints already stored; skipping discovery.")
        endpoints = get_endpoints()
    else:
        try:
            candidates = discover_candidates()
        except DiscoveryError as exc:
            print(exc, file=sys.stderr)
            return 1

        if not candidates:
            print("No candidate endpoints found.")
            return 0

        inserted = store_endpoints(candidates)
        endpoints = candidates

        print("Discovered candidate endpoints:")
        for ip in candidates:
            print(ip)
        print(f"Stored {inserted} new endpoint(s).")

    if not endpoints:
        print("No endpoints available to verify.")
        return 0

    results = [verify_endpoint(ip) for ip in endpoints]
    stored = store_verifications(results)
    csv_path = dump_verifications_csv()

    print("Verification results:")
    for res in results:
        status = "ok" if res.get("ok") else "fail"
        lat = res.get("latency_ms")
        models = res.get("models") or []
        print(f"- {res.get('ip')}: {status} (latency_ms={lat}, models={models})")
    print(f"Stored/updated {stored} verification record(s).")
    print(f"Wrote CSV: {csv_path}")

    probe_candidates = [r for r in results if r.get("ok") and r.get("models")]
    probe_results = [probe_node(r["ip"], r.get("models", [])) for r in probe_candidates]
    probe_stored = store_probes(probe_results) if probe_results else 0

    if probe_results:
        print("Probe results:")
        for res in probe_results:
            status = "ok" if res.get("success") else "fail"
            print(
                "- {} [{}]: latency_ms={}, status_code={}, error={}".format(
                    res.get("ip"),
                    res.get("model"),
                    res.get("latency_ms"),
                    res.get("status_code"),
                    res.get("error"),
                )
            )
        print(f"Stored {probe_stored} probe record(s).")
    else:
        print("No probe candidates (need verified endpoints with models).")

    ranked = rank_verifications(results)
    print("Ranked endpoints (best first):")
    for item in ranked:
        score_val = item.get("score") or 0.0
        print(
            "- {}: score={:.1f}, latency_ms={}, models={}, ok={}".format(
                item.get("ip"),
                score_val,
                item.get("latency_ms"),
                item.get("models"),
                item.get("ok"),
            )
        )
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
