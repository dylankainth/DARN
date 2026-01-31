"""Verify whether a host is an Ollama endpoint by calling a single API."""

from __future__ import annotations

import time
from typing import Dict, List, Optional

import requests

DEFAULT_PORT = 11434
DEFAULT_TIMEOUT = 1.5  # seconds, hard cap per instructions
PATH = "/api/tags"  # choose tags to also learn available models


def _build_url(host: str, port: int = DEFAULT_PORT, path: str = PATH) -> str:
	"""Return a URL for the given host, respecting an already provided scheme/port."""

	if host.startswith("http://") or host.startswith("https://"):
		base = host.rstrip("/")
	elif ":" in host and host.count(":") == 1:
		# host already has a port
		base = f"http://{host}"
	else:
		base = f"http://{host}:{port}"
	return f"{base}{path}"


def _extract_models(payload: object) -> List[str]:
	"""Pull model names from the /api/tags payload."""

	if not isinstance(payload, dict):
		return []

	raw_models = payload.get("models")
	if isinstance(raw_models, list):
		names: List[str] = []
		for item in raw_models:
			if isinstance(item, dict):
				name = item.get("name")
				if isinstance(name, str):
					names.append(name)
		return names
	return []


def verify_endpoint(
	ip: str, timeout: float = DEFAULT_TIMEOUT, port: int = DEFAULT_PORT
) -> Dict[str, object]:
	"""Probe a host once and report success, models, and latency."""

	url = _build_url(ip, port=port)
	start = time.perf_counter()
	try:
		resp = requests.get(url, timeout=timeout)
		latency_ms: Optional[int] = int((time.perf_counter() - start) * 1000)
	except requests.RequestException as exc:
		return {"ip": ip, "ok": False, "models": [], "latency_ms": None, "error": str(exc)}

	if resp.status_code != 200:
		return {
			"ip": ip,
			"ok": False,
			"models": [],
			"latency_ms": latency_ms,
			"error": f"status {resp.status_code}",
		}

	try:
		payload = resp.json()
	except ValueError as exc:
		return {
			"ip": ip,
			"ok": False,
			"models": [],
			"latency_ms": latency_ms,
			"error": f"invalid json: {exc}",
		}

	models = _extract_models(payload)
	return {"ip": ip, "ok": True, "models": models, "latency_ms": latency_ms}