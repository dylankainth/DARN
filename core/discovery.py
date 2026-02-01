"""Discovery helpers for finding candidate Ollama endpoints via Shodan."""

from __future__ import annotations

import os
from typing import List, Set

import shodan


DEFAULT_QUERY = 'ollama is running'
DEFAULT_LIMIT = 500


class DiscoveryError(Exception):
	"""Raised when discovery cannot complete."""


def _resolve_api_key(provided: str | None) -> str:
	"""Return a Shodan API key from an argument or the environment."""

	key = provided or os.getenv("SHODAN_API_KEY")
	if not key:
		raise DiscoveryError(
			"Missing Shodan API key. Provide --api-key or set SHODAN_API_KEY."
		)
	return key


def discover_candidates(
	query: str = DEFAULT_QUERY, limit: int = DEFAULT_LIMIT, api_key: str | None = None
) -> List[str]:
	"""Query Shodan once and return a capped, deduplicated list of IPs."""

	if limit <= 0:
		return []

	resolved_key = _resolve_api_key(api_key)
	client = shodan.Shodan(resolved_key)

	try:
		result = client.search(query, limit=limit)
	except shodan.APIError as exc:  # type: ignore[attr-defined]
		raise DiscoveryError(f"Shodan query failed: {exc}") from exc

	matches = result.get("matches", []) if isinstance(result, dict) else []
	candidates: List[str] = []
	seen: Set[str] = set()

	for match in matches:
		ip = match.get("ip_str") if isinstance(match, dict) else None
		if not ip or ip in seen:
			continue
		candidates.append(ip)
		seen.add(ip)
		if len(candidates) >= limit:
			break

	return candidates

