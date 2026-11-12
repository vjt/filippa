"""Dishwasher cycles from the states of its home_connect entities.

A tracker is fed one state at a time, in time order, from the recorder or
live, by part: "state" (operation state), "active" and "selected" (program
keys), "finish" (the finish time sensor) and the option switches (by service
field). It notices a cycle starting (the operation state turns to run), which
program runs, the machine's estimate (finish time - start) and how the cycle
ends: finished, with its real duration, or interrupted. When the machine was
out of reach as the cycle ended, nobody saw how or when: the outcome is
unknown.

The log keeps the cycles themselves, for the history page.
"""
from __future__ import annotations

from bisect import bisect
from datetime import datetime, timedelta

# States a cycle goes on through: the machine waits for a hand, or for its door.
RUNNING = {"run", "pause", "actionrequired"}
# A restart or a lost connection says nothing about the cycle.
UNAVAILABLE = {"unavailable"}
UNKNOWN = {None, "", "unknown"}
OPTION_PREFIX = "dishcare_dishwasher_option_"
# Past this, a finish time belongs to some other cycle.
LONGEST = timedelta(hours=12)
# The log keeps a year of cycles (what the recorder can hold), at most KEEP_MAX.
KEEP = timedelta(days=365)
KEEP_MAX = 1000
# Shorter than this, a cycle washed nothing: the machine flickers run,
# ready, run as a program starts.
SHORTEST = timedelta(minutes=1)
# Ends this close are the same cycle's, read back from the recorder.
SAME = timedelta(seconds=1)


def _minutes(delta: timedelta) -> int:
    return round(delta.total_seconds() / 60)


class CycleTracker:
    def __init__(self, data: dict | None = None) -> None:
        data = data or {}
        # Last known value by part; None once the machine said "unknown".
        self.states: dict[str, str | None] = dict(data.get("states", {}))
        # The cycle under way: started (ISO, None if it was already running
        # when first seen), program, estimate (minutes), options.
        self.open: dict | None = data.get("open")

    def as_dict(self) -> dict:
        return {"states": dict(self.states), "open": self.open}

    def feed(self, when: datetime, part: str, value: str | None) -> dict | None:
        """The cycle that closed with this state, if one did."""
        if value in UNAVAILABLE:
            # Out of reach mid-cycle: until it shows running again, an end
            # would be seen late, if at all.
            if part == "state" and self.open is not None:
                self.open["unseen"] = True
            return None
        if value in UNKNOWN:
            if part == "state":
                return None
            value = None
        if part == "state" and value in RUNNING and self.open is not None:
            self.open.pop("unseen", None)
        first = part not in self.states
        previous = self.states.get(part)
        self.states[part] = value
        if value == previous and not first:
            return None
        if part == "state":
            return self._state(when, value, first)
        if self.open is None:
            return None
        if part == "active" and value:
            # The select may still show the last cycle's program at a start.
            self.open["program"] = value
        elif part == "finish":
            self._estimate()
        elif part.startswith(OPTION_PREFIX):
            self.open["options"] = self._options()
        return None

    def _state(self, when: datetime, value: str, first: bool) -> dict | None:
        if value in RUNNING and self.open is None:
            self.open = {
                "started": None if first else when.isoformat(),
                "program": self.states.get("active") or self.states.get("selected"),
                "estimate": None,
                "options": self._options(),
            }
            self._estimate()
            return None
        if value not in RUNNING and self.open is not None:
            return self._close(when, value)
        return None

    def _estimate(self) -> None:
        open_ = self.open
        if open_["estimate"] is not None or open_["started"] is None:
            return
        finish = _time(self.states.get("finish"))
        started = datetime.fromisoformat(open_["started"])
        if finish and started < finish < started + LONGEST:
            open_["estimate"] = _minutes(finish - started)

    def _options(self) -> list[str]:
        return sorted(
            part for part, value in self.states.items()
            if part.startswith(OPTION_PREFIX) and value == "on"
        )

    def _close(self, when: datetime, value: str) -> dict:
        open_, self.open = self.open, None
        outcome = (
            "unknown" if open_.get("unseen") else "finished" if value == "finished" else "interrupted"
        )
        started = open_["started"]
        return {
            "program": open_["program"],
            "started": started,
            "ended": when.isoformat(),
            "estimate": open_["estimate"],
            "actual": (
                _minutes(when - datetime.fromisoformat(started))
                if outcome == "finished" and started
                else None
            ),
            "options": open_["options"],
            "outcome": outcome,
        }


def _time(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value) if value else None
    except ValueError:
        return None


class Stats:
    """What the card needs of past cycles: how often each program ran and
    how long its last finished cycle took (estimate, real, with which options)."""

    def __init__(self, data: dict | None = None) -> None:
        data = data or {}
        self.counts: dict[str, int] = dict(data.get("counts", {}))
        self.durations: dict[str, dict] = dict(data.get("durations", {}))
        self.total: int = data.get("total", 0)
        self.last: dict | None = data.get("last")

    def as_dict(self) -> dict:
        return {
            "counts": dict(self.counts),
            "durations": dict(self.durations),
            "total": self.total,
            "last": self.last,
        }

    def add(self, cycle: dict) -> None:
        self.total += 1
        self.last = cycle
        program = cycle["program"]
        if not program:
            return
        self.counts[program] = self.counts.get(program, 0) + 1
        # Estimate, real duration and options of one and the same cycle.
        if cycle["outcome"] == "finished" and cycle["actual"] is not None:
            self.durations[program] = {
                "estimate": cycle["estimate"],
                "actual": cycle["actual"],
                "options": cycle["options"],
            }

    def programs(self) -> dict[str, dict]:
        """{program: {usage, estimate, actual, options}}, for the card."""
        empty = {"estimate": None, "actual": None, "options": []}
        return {
            program: {"usage": count, **self.durations.get(program, empty)}
            for program, count in self.counts.items()
        }


def cycles_in(states) -> list[dict]:
    """The cycles a tracker of its own closes over these states, in time order:
    the log rebuilt from the recorder, without touching the stats."""
    tracker = CycleTracker()
    return [cycle for when, part, value in states if (cycle := tracker.feed(when, part, value))]


def _ended(cycle: dict) -> datetime:
    return datetime.fromisoformat(cycle["ended"])


def _whole(cycle: dict) -> bool:
    """Seen from start to end, with a wash in between: a cycle to list."""
    return (
        cycle["started"] is not None
        and cycle["outcome"] != "unknown"
        and _ended(cycle) - datetime.fromisoformat(cycle["started"]) >= SHORTEST
    )


class CycleLog:
    """The cycles seen whole, oldest first: a year of them, KEEP_MAX at most."""

    def __init__(self, data: list | None = None) -> None:
        self.cycles: list[dict] = list(data or [])

    def as_list(self) -> list[dict]:
        return list(self.cycles)

    def add(self, cycle: dict, now: datetime) -> bool:
        """Keep a closed cycle, unless it is not one to list or is kept already."""
        if not _whole(cycle):
            return False
        ended = _ended(cycle)
        at = bisect(self.cycles, ended, key=_ended)
        if any(abs(_ended(c) - ended) < SAME for c in self.cycles[max(at - 1, 0) : at + 1]):
            return False
        self.cycles.insert(at, cycle)
        self.trim(now)
        return True

    def trim(self, now: datetime) -> None:
        oldest = now - KEEP
        while self.cycles and _ended(self.cycles[0]) <= oldest:
            self.cycles.pop(0)
        del self.cycles[:-KEEP_MAX]

    def newest(self, count: int | None = None) -> list[dict]:
        return self.cycles[::-1][:count]
