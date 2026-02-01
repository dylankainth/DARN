"""Probe endpoints with a simple, deterministic prompt."""

from __future__ import annotations

import time
from typing import Dict, List, Mapping, MutableMapping, Sequence

import requests


DEFAULT_PORT = 11434
DEFAULT_TIMEOUT = 3.0
PROBE_PATH = "/api/generate"
PROBE_PROMPT = "Reply with exactly the word 'ping'."
PROBE_PREFERENCE: List[str] = ["llama3", "phi", "mistral", "qwen"]


def _extract_response_text(resp: requests.Response) -> str:
	"""Pull response text regardless of whether body is JSON or plain text."""

	text_body = resp.text or ""
	try:
		data = resp.json()
		if isinstance(data, dict):
			text_body = data.get("response") or data.get("message", {}).get("content") or text_body
	except ValueError:
		pass
	return text_body if isinstance(text_body, str) else str(text_body)


def _is_ping(text: str) -> bool:
	"""Check if the model replied with exactly 'ping' (case/spacing-insensitive)."""

	normalized = "".join(ch for ch in text.lower() if ch.isalpha())
	return normalized == "ping"


def _build_url(host: str, port: int = DEFAULT_PORT, path: str = PROBE_PATH) -> str:
	"""Return an http URL for the given host."""

	if host.startswith("http://") or host.startswith("https://"):
		base = host.rstrip("/")
	elif ":" in host and host.count(":") == 1:
		base = f"http://{host}"
	else:
		base = f"http://{host}:{port}"
	return f"{base}{path}"


def select_probe_model(models: Sequence[str]) -> str | None:
	"""Choose a model using preference list, else smallest name."""

	normalized = [m.strip() for m in models if m]
	if not normalized:
		return None

	lower_map = {m.lower(): m for m in normalized}
	for preferred in PROBE_PREFERENCE:
		if preferred in lower_map:
			return lower_map[preferred]

	# Fallback: pick by shortest name, then lexicographic for stability
	return sorted(normalized, key=lambda m: (len(m), m))[0]


def probe_node(
	ip: str,
	available_models: Sequence[str],
	*,
	timeout: float = DEFAULT_TIMEOUT,
	port: int = DEFAULT_PORT,
) -> Dict[str, object]:
	"""Send a cheap probe to a single node/model and return metrics."""

	model = select_probe_model(available_models)
	if not model:
		return {
			"ip": ip,
			"model": None,
			"success": False,
			"latency_ms": None,
			"status_code": None,
			"error": "no models available",
			"ts": time.time(),
		}

	url = _build_url(ip, port=port, path=PROBE_PATH)
	payload = {
		"model": model,
		"prompt": PROBE_PROMPT,
		"stream": False,
		"options": {
			"temperature": 0,
			"num_predict": 5,
		},
	}

	start = time.perf_counter()
	try:
		resp = requests.post(url, json=payload, timeout=timeout)
		latency_ms = int((time.perf_counter() - start) * 1000)
	except requests.RequestException as exc:
		return {
			"ip": ip,
			"model": model,
			"success": False,
			"latency_ms": None,
			"status_code": None,
			"error": str(exc),
			"ts": time.time(),
		}

	text_body = _extract_response_text(resp)
	success = resp.status_code == 200 and _is_ping(text_body)
	error = None if success else ("unexpected_output" if resp.status_code == 200 else f"status {resp.status_code}")

	return {
		"ip": ip,
		"model": model,
		"success": bool(success),
		"latency_ms": latency_ms,
		"status_code": resp.status_code,
		"body": text_body,
		"error": error,
		"ts": time.time(),
	}


def record_metric(
	metrics: MutableMapping[str, MutableMapping[str, List[dict]]],
	probe_result: Mapping[str, object],
) -> None:
	"""Append a probe result into metrics[ip][model]."""

	ip = probe_result.get("ip")
	model = probe_result.get("model")
	if not isinstance(ip, str) or not isinstance(model, str):
		return

	node_bucket = metrics.setdefault(ip, {})
	model_bucket = node_bucket.setdefault(model, [])
	model_bucket.append(dict(probe_result))