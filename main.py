"""Expose stored discovery and verification data via FastAPI."""

from __future__ import annotations

import os
import sys
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from core.discovery import DiscoveryError, discover_candidates
from core.probe import probe_node
from core.scoring import rank_verifications
from core.store import (
    _db_path,
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

DEFAULT_OLLAMA_PORT = 11434
GENERATE_PATH = "/api/generate"


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


@app.get("/ip/{ip}")
def get_ip_details(ip: str) -> dict[str, object]:
    """Get detailed information about a specific IP including verification and probe history."""
    try:
        from core.store import _db_path
        import sqlite3
        
        db_file = _db_path()
        conn = sqlite3.connect(db_file)
        
        # Fetch verification
        cur = conn.execute(
            "SELECT ip, ok, models, latency_ms, error, checked_at FROM verifications WHERE ip = ?",
            (ip,)
        )
        verify_row = cur.fetchone()
        if not verify_row:
            conn.close()
            raise HTTPException(status_code=404, detail=f"IP {ip} not found")
        
        models_json = verify_row[2]
        models = []
        if models_json:
            try:
                import json
                models = json.loads(models_json)
            except:
                pass
        
        verification = {
            "ip": verify_row[0],
            "ok": bool(verify_row[1]),
            "models": models,
            "latency_ms": verify_row[3],
            "error": verify_row[4],
            "checked_at": verify_row[5],
        }
        
        # Fetch probes
        cur = conn.execute(
            """SELECT ip, model, success, latency_ms, status_code, error, body, ts 
               FROM probes WHERE ip = ? ORDER BY ts DESC LIMIT 100""",
            (ip,)
        )
        probe_rows = cur.fetchall()
        probes = [
            {
                "ip": row[0],
                "model": row[1],
                "success": bool(row[2]),
                "latency_ms": row[3],
                "status_code": row[4],
                "error": row[5],
                "body": row[6],
                "ts": row[7],
            }
            for row in probe_rows
        ]
        
        conn.close()
        
        return {"verification": verification, "probes": probes}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/chat/choices")
def list_ranked_choices() -> dict[str, object]:
    try:
        records = fetch_verifications()
        ranked = rank_verifications(records)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Only keep entries with available models
    ranked = [r for r in ranked if r.get("models")]
    return {"count": len(ranked), "items": ranked}


def _build_chat_url(ip: str, port: int = DEFAULT_OLLAMA_PORT, path: str = GENERATE_PATH) -> str:
    if ip.startswith("http://") or ip.startswith("https://"):
        base = ip.rstrip("/")
    elif ":" in ip and ip.count(":") == 1:
        base = f"http://{ip}"
    else:
        base = f"http://{ip}:{port}"
    return f"{base}{path}"


@app.post("/chat/relay")
def chat_relay(
    *,
    ip: str,
    model: str,
    prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 256,
    timeout: float = 15.0,
) -> dict[str, object]:
    if not ip or not model or not prompt:
        raise HTTPException(status_code=400, detail="ip, model, and prompt are required")

    url = _build_chat_url(ip)
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=timeout)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}") from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    try:
        data = resp.json()
    except ValueError:
        data = {"text": resp.text}

    return {"upstream": url, "model": model, "ip": ip, "data": data}


@app.post("/refresh")
def refresh_all() -> dict[str, object]:
    """Delete stored data and re-run discovery + verification."""
    try:
        # Delete SQLite DB
        db_file = _db_path()
        if os.path.exists(db_file):
            os.remove(db_file)
        
        # Delete CSV
        csv_file = os.path.abspath("verifications.csv")
        if os.path.exists(csv_file):
            os.remove(csv_file)
        
        # Run discovery
        try:
            candidates = discover_candidates()
        except DiscoveryError as exc:
            raise HTTPException(status_code=500, detail=f"Discovery failed: {exc}") from exc
        
        if not candidates:
            return {"message": "No candidates found", "count": 0}
        
        # Store endpoints
        inserted = store_endpoints(candidates)
        
        # Verify endpoints in parallel
        results = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {executor.submit(verify_endpoint, ip): (idx, ip) for idx, ip in enumerate(candidates, 1)}
            for future in as_completed(future_to_ip):
                idx, ip = future_to_ip[future]
                try:
                    result = future.result()
                    results.append(result)
                    status = "✓" if result.get("ok") else "✗"
                    print(f"[{len(results)}/{len(candidates)}] {status} {ip}")
                except Exception as exc:
                    print(f"[{len(results)+1}/{len(candidates)}] ✗ {ip} - {exc}")
                    results.append({"ip": ip, "ok": False, "models": [], "latency_ms": None, "error": str(exc)})
        stored = store_verifications(results)
        dump_verifications_csv()
        
        # Probe healthy endpoints
        probe_candidates = [r for r in results if r.get("ok") and r.get("models")]
        probe_results = [probe_node(r["ip"], r.get("models", [])) for r in probe_candidates]
        probe_stored = store_probes(probe_results) if probe_results else 0
        
        healthy = sum(1 for r in results if r.get("ok"))
        
        return {
            "message": "Refresh complete",
            "discovered": inserted,
            "verified": stored,
            "probed": probe_stored,
            "healthy": healthy,
            "total": len(results),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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

    results = []
    print(f"Verifying {len(endpoints)} endpoints in parallel...")
    with ThreadPoolExecutor(max_workers=50) as executor:
        future_to_ip = {executor.submit(verify_endpoint, ip): (idx, ip) for idx, ip in enumerate(endpoints, 1)}
        for future in as_completed(future_to_ip):
            idx, ip = future_to_ip[future]
            try:
                result = future.result()
                results.append(result)
                status = "✓" if result.get("ok") else "✗"
                print(f"[{len(results)}/{len(endpoints)}] {status} {ip}")
            except Exception as exc:
                print(f"[{len(results)+1}/{len(endpoints)}] ✗ {ip} - {exc}")
                results.append({"ip": ip, "ok": False, "models": [], "latency_ms": None, "error": str(exc)})
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
