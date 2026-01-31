"""SQLite-backed storage for discovered endpoints."""

from __future__ import annotations

import os
import sqlite3
from typing import Iterable


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
	"""Create the endpoints table if needed."""

	conn.execute(
		"""
		CREATE TABLE IF NOT EXISTS endpoints (
			ip TEXT PRIMARY KEY,
			discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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