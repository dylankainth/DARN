"""Heuristic scoring for probed endpoints."""

from __future__ import annotations

import math
from typing import Iterable, List, Mapping


MAX_SCORE = 100.0
BASE_OK_SCORE = 60.0  # floor for any healthy endpoint
MODEL_BONUS_WEIGHT = 12.0  # bonus grows with model count, capped
MODEL_BONUS_CAP = 20.0
LATENCY_TARGET_MS = 500.0  # good latency target
LATENCY_PENALTY_MAX = 40.0


def _model_bonus(models: Iterable[str]) -> float:
	names = [m for m in models if m]
	if not names:
		return 0.0
	# Diminishing returns with log scale so a couple models help, many do not dominate.
	bonus = MODEL_BONUS_WEIGHT * math.log10(1 + len(names))
	return min(bonus, MODEL_BONUS_CAP)


def _latency_penalty(latency_ms: float | None) -> float:
	if latency_ms is None or latency_ms <= 0:
		return 0.0
	# Linear penalty relative to target; capped to avoid nuking the score.
	ratio = latency_ms / LATENCY_TARGET_MS
	penalty = (ratio - 1.0) * (LATENCY_PENALTY_MAX / 2)
	penalty = max(0.0, penalty)
	return min(penalty, LATENCY_PENALTY_MAX)


def score_verification(rec: Mapping[str, object]) -> float:
	"""Return a 0-100 score for a single verification record."""

	if not rec.get("ok"):
		return 0.0

	models = rec.get("models") or []
	latency_ms = rec.get("latency_ms")
	latency_val = float(latency_ms) if isinstance(latency_ms, (int, float)) else None

	score = BASE_OK_SCORE
	score += _model_bonus(models)
	score -= _latency_penalty(latency_val)

	return max(0.0, min(score, MAX_SCORE))


def rank_verifications(records: Iterable[Mapping[str, object]]) -> List[dict]:
	"""Attach scores and return records sorted by best first."""

	enriched: List[dict] = []
	for rec in records:
		row = dict(rec)
		row["score"] = score_verification(rec)
		enriched.append(row)

	return sorted(enriched, key=lambda r: r.get("score", 0.0), reverse=True)