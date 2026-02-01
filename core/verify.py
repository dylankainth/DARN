"""Verify whether a host is an Ollama endpoint by calling a single API."""

from __future__ import annotations

import time
from typing import Dict, List, Optional

import requests

from .geoip import geolocate_ip

DEFAULT_PORT = 11434
DEFAULT_TIMEOUT = 1.5  # seconds, for /api/tags metadata
INFERENCE_TIMEOUT = 40.0  # seconds, for actual model inference
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


PREFERRED_PROBE_MODELS = (
	"phi",
	"qwen2.5:0.5b",
	"qwen2.5:1.5b",
	"llama3.2:1b",
)


def _pick_probe_model(models: List[str]) -> Optional[str]:
	"""Pick a tiny/fast model if available, else first model."""

	normalized = [m for m in models if isinstance(m, str) and m]
	for preferred in PREFERRED_PROBE_MODELS:
		for m in normalized:
			if m.startswith(preferred):
				return m
	return normalized[0] if normalized else None


def _inference_probe(base_url: str, model: str, timeout: float) -> Optional[str]:
	"""Call /api/chat once and return the assistant message text."""

	url = f"{base_url}/api/chat"
	payload = {
		"model": model,
		"messages": [{"role": "user", "content": "Say hello"}],
		"stream": False,
	}
	try:
		resp = requests.post(url, json=payload, timeout=timeout)
		if resp.status_code != 200:
			return None
		data = resp.json()
	except Exception:
		return None

	message = data.get("message") if isinstance(data, dict) else None
	content = message.get("content") if isinstance(message, dict) else None
	return content if isinstance(content, str) else None


def _looks_like_language(text: str) -> bool:
	"""Cheap heuristic: short, mostly alphabetic tokens -> likely real output."""

	if len(text) < 3 or len(text) > 200:
		return False

	tokens = text.split()
	alphaish = 0
	for token in tokens:
		letters = "".join(ch for ch in token if ch.isalpha())
		if letters:
			alphaish += 1

	return alphaish / max(len(tokens), 1) > 0.5


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
	base = _build_url(ip, port=port, path="").rstrip("/")
	probe_model = _pick_probe_model(models)

	if not probe_model:
		return {
			"ip": ip,
			"ok": False,
			"models": models,
			"latency_ms": latency_ms,
			"error": "no_probe_model",
		}

	reply = _inference_probe(base, probe_model, INFERENCE_TIMEOUT)
	if not reply or not _looks_like_language(reply):
		return {
			"ip": ip,
			"ok": False,
			"models": models,
			"latency_ms": latency_ms,
			"error": "inference_gibberish",
		}

	result = {"ip": ip, "ok": True, "models": models, "latency_ms": latency_ms}
	
	# Add geolocation data
	geo = geolocate_ip(ip)
	if geo:
		result.update(geo)
	
	return result