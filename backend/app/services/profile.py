"""Linking an in-memory Session to a consented saved profile (store.py). Spec: docs/05-architecture-and-api.md"""
from __future__ import annotations

from .math_check import TEACHABLE
from .session import Session, _sessions
from . import store

_RANK = {"concept": 2, "procedure": 1}


def snapshot(session: Session) -> dict:
    """The only fields that leave memory: stars, best quotes, Teach readiness, town visits."""
    from .teach import ready_concepts  # local import: teach imports session too

    return {
        "mastery": {c: v for c, v in session.lumi_mastery.items() if c in TEACHABLE},
        "quotes": {c: list(q) for c, q in session.teach_quotes.items() if c in TEACHABLE},
        "ready": sorted(ready_concepts(session)),
        "town_visits": dict(session.town_visits),
    }


def merge_into(session: Session, data: dict) -> None:
    """Saved progress + whatever this session already earned: keep the best of each."""
    for c, v in data.get("mastery", {}).items():
        if c in TEACHABLE:
            session.lumi_mastery[c] = max(session.lumi_mastery.get(c, 0.0), float(v))
    for c, q in data.get("quotes", {}).items():
        if c not in TEACHABLE or len(q) != 2:
            continue
        cur = session.teach_quotes.get(c)
        if cur is None or _RANK.get(q[0], 0) > _RANK.get(cur[0], 0):
            session.teach_quotes[c] = (q[0], q[1])
    session.saved_ready |= {c for c in data.get("ready", []) if c in TEACHABLE}
    for c, n in data.get("town_visits", {}).items():
        session.town_visits[c] = max(session.town_visits.get(c, 0), int(n))


def attach(session: Session, profile_id: str) -> bool:
    data = store.load(profile_id)
    if data is None:
        return False
    session.profile_id = profile_id
    merge_into(session, data)
    store.save(profile_id, snapshot(session))
    return True


def autosave(session: Session) -> None:
    """Write-through after anything that can change progress. No-op without consent."""
    if session.profile_id:
        if not store.save(session.profile_id, snapshot(session)):
            session.profile_id = None  # profile was deleted elsewhere: stop saving


def forget(profile_id: str) -> bool:
    """Delete saved progress and stop every live session from writing to it again."""
    for s in _sessions.values():
        if s.profile_id == profile_id:
            s.profile_id = None
    return store.delete(profile_id)


def summary(session: Session) -> dict:
    stars = {c: session.lumi_mastery.get(c, 0.0) for c in TEACHABLE}
    return {"stars": stars, "skills_taught": sum(1 for v in stars.values() if v > 0)}
