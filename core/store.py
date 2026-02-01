"""SQLite-backed storage for discovered endpoints."""

from __future__ import annotations

import csv
import json
import os
import sqlite3
from typing import Iterable, List, Sequence


DEFAULT_DB_PATH = "darn.sqlite3"
DB_PATH_ENV = "DARN_DB_PATH"


def _db_path(path: str | None = None) -> str:
	"""Resolve the SQLite file path, allowing override via env or argument."""

	candidate = path or os.getenv(DB_PATH_ENV, DEFAULT_DB_PATH)
	candidate = os.path.expanduser(candidate)
	candidate = os.path.abspath(candidate)
	return candidate


def _ensure_parent_dir(db_path: str) -> None:
	"""Create parent directory for the DB file if it does not exist."""

	parent = os.path.dirname(db_path)
	if parent and not os.path.exists(parent):
		os.makedirs(parent, exist_ok=True)


def _ensure_schema(conn: sqlite3.Connection) -> None:
	"""Create required tables if needed."""

	conn.execute(
		"""
		CREATE TABLE IF NOT EXISTS endpoints (
			ip TEXT PRIMARY KEY,
			discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
		"""
	)
	conn.execute(
		"""
		CREATE TABLE IF NOT EXISTS verifications (
			ip TEXT PRIMARY KEY,
			ok INTEGER NOT NULL,
			models TEXT,
			latency_ms INTEGER,
			error TEXT,
			lat REAL,
			lon REAL,
			city TEXT,
			region TEXT,
			country TEXT,
			checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(ip) REFERENCES endpoints(ip) ON DELETE CASCADE
		)
		"""
	)
	
	# Migrate existing tables to add location columns if missing
	try:
		cur = conn.execute("PRAGMA table_info(verifications)")
		columns = {row[1] for row in cur.fetchall()}
		if 'lat' not in columns:
			conn.execute("ALTER TABLE verifications ADD COLUMN lat REAL")
		if 'lon' not in columns:
			conn.execute("ALTER TABLE verifications ADD COLUMN lon REAL")
		if 'city' not in columns:
			conn.execute("ALTER TABLE verifications ADD COLUMN city TEXT")
		if 'region' not in columns:
			conn.execute("ALTER TABLE verifications ADD COLUMN region TEXT")
		if 'country' not in columns:
			conn.execute("ALTER TABLE verifications ADD COLUMN country TEXT")
		conn.commit()
	except Exception:
		# If migration fails, continue - table might not exist yet
		pass
	
	conn.execute(
		"""
		CREATE TABLE IF NOT EXISTS probes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ip TEXT NOT NULL,
			model TEXT,
			success INTEGER NOT NULL,
			latency_ms INTEGER,
			status_code INTEGER,
			error TEXT,
			body TEXT,
			ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(ip) REFERENCES endpoints(ip) ON DELETE CASCADE
		)
		"""
	)


def store_endpoints(endpoints: Iterable[str], path: str | None = None) -> int:
	"""Persist endpoints, ignoring duplicates. Returns count inserted."""

	endpoints = [ip.strip() for ip in endpoints if ip]
	if not endpoints:
		return 0

	db_path = _db_path(path)
	_ensure_parent_dir(db_path)

	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		before = conn.total_changes
		conn.executemany(
			"INSERT OR IGNORE INTO endpoints (ip) VALUES (?)",
			[(ip,) for ip in endpoints],
		)
		conn.commit()
		inserted = conn.total_changes - before
	finally:
		conn.close()

	return inserted


def get_endpoint_count(path: str | None = None) -> int:
	"""Return the number of stored endpoints, creating the DB/table if absent."""

	db_path = _db_path(path)
	_ensure_parent_dir(db_path)

	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		cur = conn.execute("SELECT COUNT(*) FROM endpoints")
		row = cur.fetchone()
		return int(row[0]) if row else 0
	finally:
		conn.close()


def get_endpoints(path: str | None = None) -> List[str]:
	"""Return all stored endpoint IPs."""

	db_path = _db_path(path)
	_ensure_parent_dir(db_path)

	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		cur = conn.execute("SELECT ip FROM endpoints ORDER BY discovered_at ASC")
		return [row[0] for row in cur.fetchall() if row and row[0]]
	finally:
		conn.close()


def store_verifications(results: Sequence[dict], path: str | None = None) -> int:
	"""Persist verification results; returns rows inserted/updated."""

	if not results:
		return 0

	db_path = _db_path(path)
	_ensure_parent_dir(db_path)

	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		before = conn.total_changes
		payloads = []
		for item in results:
			ip = item.get("ip") if isinstance(item, dict) else None
			if not ip:
				continue
			ok_val = 1 if item.get("ok") else 0
			models = item.get("models") if isinstance(item, dict) else []
			models_json = json.dumps(models) if models is not None else None
			latency = item.get("latency_ms") if isinstance(item, dict) else None
			error = item.get("error") if isinstance(item, dict) else None
			lat = item.get("lat") if isinstance(item, dict) else None
			lon = item.get("lon") if isinstance(item, dict) else None
			city = item.get("city") if isinstance(item, dict) else None
			region = item.get("region") if isinstance(item, dict) else None
			country = item.get("country") if isinstance(item, dict) else None
			payloads.append((ip, ok_val, models_json, latency, error, lat, lon, city, region, country))

			# Ensure endpoint exists to satisfy FK; insert ignore
		conn.executemany(
			"INSERT OR IGNORE INTO endpoints (ip) VALUES (?)",
			[(p[0],) for p in payloads],
		)

		conn.executemany(
			"""
			INSERT INTO verifications (ip, ok, models, latency_ms, error, lat, lon, city, region, country)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(ip) DO UPDATE SET
				ok=excluded.ok,
				models=excluded.models,
				latency_ms=excluded.latency_ms,
				error=excluded.error,
				lat=COALESCE(excluded.lat, lat),
				lon=COALESCE(excluded.lon, lon),
				city=COALESCE(excluded.city, city),
				region=COALESCE(excluded.region, region),
				country=COALESCE(excluded.country, country),
				checked_at=CURRENT_TIMESTAMP
			""",
			payloads,
		)
		conn.commit()
		return conn.total_changes - before
	finally:
		conn.close()


def fetch_verifications(path: str | None = None) -> List[dict]:
	"""Return all verification records as dicts (models parsed from JSON)."""

	db_path = _db_path(path)
	_ensure_parent_dir(db_path)

	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		cur = conn.execute(
			"""
			SELECT ip, ok, models, latency_ms, error, lat, lon, city, region, country, checked_at
			FROM verifications
			ORDER BY checked_at DESC
			"""
		)
		rows = cur.fetchall()
	finally:
		conn.close()

	results: List[dict] = []
	for ip, ok, models_json, latency, error, lat, lon, city, region, country, checked_at in rows:
		models_list = []
		if models_json:
			try:
				models_list = json.loads(models_json)
			except json.JSONDecodeError:
				models_list = []
		result = {
			"ip": ip,
			"ok": bool(ok),
			"models": models_list,
			"latency_ms": latency,
			"error": error,
			"checked_at": checked_at,
		}
		if lat is not None and lon is not None:
			result["lat"] = lat
			result["lon"] = lon
		if city:
			result["city"] = city
		if region:
			result["region"] = region
		if country:
			result["country"] = country
		results.append(result)

	return results


def dump_verifications_csv(
	file_path: str = "verifications.csv", path: str | None = None
) -> str:
	"""Write all verification records to a CSV file. Returns the CSV path."""

	records = fetch_verifications(path)
	if not records:
		return os.path.abspath(file_path)

	file_path = os.path.abspath(file_path)
	parent = os.path.dirname(file_path)
	if parent and not os.path.exists(parent):
		os.makedirs(parent, exist_ok=True)

	fieldnames = ["ip", "ok", "models", "latency_ms", "error", "checked_at"]
	with open(file_path, "w", newline="", encoding="utf-8") as f:
		writer = csv.DictWriter(f, fieldnames=fieldnames)
		writer.writeheader()
		for rec in records:
			row = dict(rec)
			# Store models as comma-separated string for readability
			row["models"] = ",".join(rec.get("models", []) or [])
			writer.writerow(row)

	return file_path


def fetch_probes(path: str | None = None, limit: int | None = None) -> List[dict]:
	"""Return probe records as dicts, ordered by timestamp desc."""
	
	db_path = _db_path(path)
	_ensure_parent_dir(db_path)
	
	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		
		query = """
			SELECT ip, model, success, latency_ms, status_code, error, body, ts
			FROM probes
			ORDER BY ts DESC
		"""
		
		if limit:
			query += f" LIMIT {limit}"
		
		cur = conn.execute(query)
		rows = cur.fetchall()
	finally:
		conn.close()
	
	results: List[dict] = []
	for ip, model, success, latency, status_code, error, body, ts in rows:
		results.append({
			"ip": ip,
			"model": model,
			"success": bool(success),
			"latency_ms": latency,
			"status_code": status_code,
			"error": error,
			"body": body,
			"timestamp": ts,
		})
	
	return results

def store_probes(results: Sequence[dict], path: str | None = None) -> int:
	"""Persist probe results in the probes table."""

	if not results:
		return 0

	db_path = _db_path(path)
	_ensure_parent_dir(db_path)

	conn = sqlite3.connect(db_path)
	try:
		_ensure_schema(conn)
		before = conn.total_changes

		payloads = []
		for item in results:
			if not isinstance(item, dict):
				continue
			ip = item.get("ip")
			if not ip:
				continue
			model = item.get("model") if isinstance(item.get("model"), str) else None
			success = 1 if item.get("success") else 0
			latency = item.get("latency_ms") if isinstance(item.get("latency_ms"), (int, float)) else None
			status_code = item.get("status_code") if isinstance(item.get("status_code"), int) else None
			error = item.get("error") if isinstance(item.get("error"), str) else None
			body = item.get("body") if isinstance(item.get("body"), str) else None
			payloads.append((ip, model, success, latency, status_code, error, body))

		if not payloads:
			return 0

		conn.executemany(
			"INSERT OR IGNORE INTO endpoints (ip) VALUES (?)",
			[(p[0],) for p in payloads],
		)

		conn.executemany(
			"""
			INSERT INTO probes (
				ip, model, success, latency_ms, status_code, error, body
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			""",
			payloads,
		)
		conn.commit()
		return conn.total_changes - before
	finally:
		conn.close()

