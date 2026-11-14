"""Saved progress (docs/06-privacy-and-safety.md): a tiny SQLite store for consented child profiles.

What is saved (and nothing else): Lumi's stars, the child's best explanation quote per concept,
concepts unlocked for Teach mode, and Lumi's Town visit counts. No names, images, audio, transcripts
or event logs. A profile is keyed by a random id held on the child's device; there are no accounts.

- Nothing is written without a grown-up's opt-in (`create(consent_version=...)`).
- `delete()` removes a profile at once; `purge()` drops profiles unused for RETENTION_DAYS.
- The database path comes from LUMI_DB (default backend/data/lumi.db), read on every call so tests can
  point it at a temp file.
"""
from __future__ import annotations

import json
import os
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

RETENTION_DAYS = 180
CONSENT_VERSION = "2026-10-27"  # bump when the consent text in the app changes

_lock = threading.Lock()
_ready: set[str] = set()
_DEFAULT = Path(__file__).resolve().parents[2] / "data" / "lumi.db"


def _path() -> str:
    return os.getenv("LUMI_DB") or str(_DEFAULT)


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    path = _path()
    with _lock:
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(path)
        try:
            if path not in _ready:
                con.execute(
                    "CREATE TABLE IF NOT EXISTS profiles ("
                    " id TEXT PRIMARY KEY, created_at REAL NOT NULL, updated_at REAL NOT NULL,"
                    " consent_version TEXT NOT NULL, consented_at REAL NOT NULL, data TEXT NOT NULL)"
                )
                _ready.add(path)
            yield con
            con.commit()
        finally:
            con.close()


def create(consent_version: str) -> str:
    """New empty profile. Only call after a grown-up has opted in."""
    pid = secrets.token_hex(16)  # 128-bit, unguessable; the device keeps it
    now = time.time()
    with _db() as con:
        con.execute(
            "INSERT INTO profiles (id, created_at, updated_at, consent_version, consented_at, data) VALUES (?,?,?,?,?,?)",
            (pid, now, now, consent_version, now, json.dumps(_empty())),
        )
    return pid


def load(profile_id: str) -> Optional[dict]:
    with _db() as con:
        row = con.execute("SELECT data FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if row is None:
            return None
        con.execute("UPDATE profiles SET updated_at = ? WHERE id = ?", (time.time(), profile_id))
    return {**_empty(), **json.loads(row[0])}


def save(profile_id: str, data: dict) -> bool:
    clean = {k: data[k] for k in _empty() if k in data}  # whitelist: never store anything else
    with _db() as con:
        cur = con.execute(
            "UPDATE profiles SET data = ?, updated_at = ? WHERE id = ?", (json.dumps(clean), time.time(), profile_id)
        )
    return cur.rowcount == 1


def delete(profile_id: str) -> bool:
    with _db() as con:
        cur = con.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    return cur.rowcount == 1


def purge(days: int = RETENTION_DAYS) -> int:
    """Delete profiles nobody has used for `days` days. Returns how many were removed."""
    with _db() as con:
        cur = con.execute("DELETE FROM profiles WHERE updated_at < ?", (time.time() - days * 86400,))
    return cur.rowcount


def _empty() -> dict:  # the whitelist: nothing else is ever stored
    return {"mastery": {}, "quotes": {}, "ready": [], "town_visits": {}, "story": {"chosen": {}, "seen": []}}
