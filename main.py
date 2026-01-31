"""Minimal CLI to run discovery, then persist results to SQLite."""

from __future__ import annotations

import sys

from core.discovery import DiscoveryError, discover_candidates
from core.store import (
    get_endpoint_count,
    get_endpoints,
    store_endpoints,
    store_verifications,
    dump_verifications_csv,
)
from core.verify import verify_endpoint
from dotenv import load_dotenv


def main() -> int:
    # Load variables from .env, then rely on discovery to resolve SHODAN key
    load_dotenv()

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
    return 0


if __name__ == "__main__":
	raise SystemExit(main())
