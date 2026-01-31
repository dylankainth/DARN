"""Minimal CLI to run discovery, then persist results to SQLite."""

from __future__ import annotations

import sys

from core.discovery import DiscoveryError, discover_candidates
from core.store import get_endpoint_count, store_endpoints
from dotenv import load_dotenv


def main() -> int:
    # Load variables from .env, then rely on discovery to resolve SHODAN key
    load_dotenv()

    if get_endpoint_count() > 0:
        print("Endpoints already stored; skipping discovery.")
        return 0

    try:
        candidates = discover_candidates()
    except DiscoveryError as exc:
        print(exc, file=sys.stderr)
        return 1

    if not candidates:
        print("No candidate endpoints found.")
        return 0

    inserted = store_endpoints(candidates)

    print("Discovered candidate endpoints:")
    for ip in candidates:
        print(ip)
    print(f"Stored {inserted} new endpoint(s).")
    return 0


if __name__ == "__main__":
	raise SystemExit(main())
