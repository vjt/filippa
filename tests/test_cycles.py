"""Cycles from the states of the home_connect entities, fed in time order."""
from datetime import datetime, timedelta, timezone

import pytest

from machine.cycles import CycleLog, CycleTracker, Stats, cycles_in

T0 = datetime(2026, 10, 11, 14, 31, tzinfo=timezone.utc)
AUTO = "dishcare_dishwasher_program_auto_2"
ECO = "dishcare_dishwasher_program_eco_50"
HALF = "dishcare_dishwasher_option_half_load"
VARIO = "dishcare_dishwasher_option_vario_speed_plus"


def at(minutes):
    return T0 + timedelta(minutes=minutes)


def iso(minutes):
    return at(minutes).isoformat()


def feed(tracker, *events):
    """events: (minutes, role, value); the cycles that closed."""
    closed = []
    for minutes, role, value in events:
        if cycle := tracker.feed(at(minutes), role, value):
            closed.append(cycle)
    return closed


@pytest.fixture
def ready():
    tracker = CycleTracker()
    feed(tracker, (-60, "state", "ready"), (-60, HALF, "off"), (-60, VARIO, "off"))
    return tracker


def test_a_finished_cycle_has_program_estimate_and_real_duration(ready):
    closed = feed(
        ready,
        (0, "selected", AUTO),
        (1, VARIO, "on"),
        (2, "state", "run"),
        (2, "active", AUTO),
        (2, "finish", iso(2 + 155)),
        (30, "finish", iso(2 + 150)),
        (154, "state", "finished"),
    )
    assert closed == [{
        "program": AUTO,
        "started": iso(2),
        "ended": iso(154),
        "estimate": 155,
        "actual": 152,
        "options": [VARIO],
        "outcome": "finished",
    }]


def test_a_stopped_cycle_is_interrupted_and_has_no_real_duration(ready):
    closed = feed(
        ready,
        (0, "state", "run"),
        (0, "active", ECO),
        (0, "finish", iso(235)),
        (10, "state", "aborting"),
        (11, "state", "ready"),
    )
    assert len(closed) == 1
    assert closed[0]["outcome"] == "interrupted"
    assert closed[0]["actual"] is None
    assert closed[0]["estimate"] == 235


def test_pause_and_action_required_do_not_end_a_cycle(ready):
    closed = feed(
        ready,
        (0, "state", "run"),
        (0, "active", ECO),
        (20, "state", "pause"),
        (25, "state", "run"),
        (40, "state", "actionrequired"),
        (41, "state", "run"),
        (200, "state", "finished"),
    )
    assert [c["actual"] for c in closed] == [200]


def test_a_restart_or_a_lost_connection_says_nothing_about_the_cycle(ready):
    closed = feed(
        ready,
        (0, "state", "run"),
        (0, "active", ECO),
        (50, "state", "unavailable"),
        (50, "active", "unavailable"),
        (52, "state", "run"),
        (52, "active", ECO),
        (60, "state", "unknown"),
        (200, "state", "finished"),
    )
    assert [(c["program"], c["actual"]) for c in closed] == [(ECO, 200)]


def test_a_cycle_already_running_when_first_seen_has_no_start():
    tracker = CycleTracker()
    closed = feed(tracker, (0, "active", AUTO), (0, "state", "run"), (90, "state", "finished"))
    assert closed[0]["started"] is None
    assert closed[0]["actual"] is None
    assert closed[0]["program"] == AUTO


def test_the_program_falls_back_on_the_selected_one(ready):
    closed = feed(ready, (0, "selected", AUTO), (1, "state", "run"), (100, "state", "finished"))
    assert closed[0]["program"] == AUTO


def test_the_active_program_overrides_a_stale_one(ready):
    feed(ready, (0, "active", AUTO), (1, "state", "run"), (100, "state", "finished"))
    # The select may keep showing the last program: the next start corrects it.
    closed = feed(ready, (200, "state", "run"), (200, "active", ECO), (400, "state", "finished"))
    assert closed[0]["program"] == ECO


def test_a_stale_finish_time_is_no_estimate(ready):
    feed(ready, (0, "state", "run"), (0, "active", AUTO), (0, "finish", iso(150)),
         (150, "state", "finished"))
    # The finish time of the last cycle lingers until the machine sends a new one.
    closed = feed(ready, (300, "state", "run"), (300, "active", AUTO), (450, "state", "finished"))
    assert closed[0]["estimate"] is None
    late = feed(ready, (500, "state", "run"), (500, "active", AUTO), (503, "finish", iso(650)),
                (650, "state", "finished"))
    assert late[0]["estimate"] == 150


def test_a_delayed_start_counts_from_the_run(ready):
    closed = feed(
        ready,
        (0, "active", AUTO),
        (0, "state", "delayedstart"),
        (0, "finish", iso(60 + 150)),
        (60, "state", "run"),
        (210, "state", "finished"),
    )
    assert closed[0]["started"] == iso(60)
    assert closed[0]["estimate"] == 150
    assert closed[0]["actual"] == 150


def test_options_are_those_of_the_running_program(ready):
    closed = feed(
        ready,
        (0, HALF, "on"),
        (1, "state", "run"),
        (1, "active", ECO),
        (2, HALF, "unavailable"),
        (3, VARIO, "on"),
        (100, "state", "finished"),
        (101, VARIO, "off"),
    )
    assert closed[0]["options"] == [HALF, VARIO]


def test_a_cycle_that_ends_out_of_sight_has_an_unknown_outcome(ready):
    """Out of reach, then ready: finished or stopped, and when, nobody saw."""
    closed = feed(
        ready,
        (0, "state", "run"),
        (0, "active", ECO),
        (0, "finish", iso(230)),
        (100, "state", "unavailable"),
        (400, "state", "ready"),
    )
    assert [(c["outcome"], c["actual"], c["ended"]) for c in closed] == [("unknown", None, iso(400))]


def test_a_finish_seen_only_after_a_blackout_teaches_no_duration(ready):
    closed = feed(
        ready,
        (0, "state", "run"),
        (0, "active", ECO),
        (100, "state", "unavailable"),
        (101, "state", "unknown"),
        (400, "state", "finished"),
    )
    assert [(c["outcome"], c["actual"]) for c in closed] == [("unknown", None)]


def test_a_cycle_seen_running_again_after_a_blackout_ends_as_usual(ready):
    closed = feed(
        ready,
        (0, "state", "run"),
        (0, "active", ECO),
        (100, "state", "unavailable"),
        (130, "state", "run"),
        (230, "state", "finished"),
        (300, "state", "run"),
        (310, "state", "ready"),
    )
    assert [(c["outcome"], c["actual"]) for c in closed] == [("finished", 230), ("interrupted", None)]


def test_the_tracker_survives_a_round_trip_through_storage(ready):
    feed(ready, (0, "state", "run"), (0, "active", ECO), (0, "finish", iso(230)))
    again = CycleTracker(ready.as_dict())
    closed = feed(again, (0, "state", "run"), (231, "state", "finished"))
    assert [(c["started"], c["estimate"], c["actual"]) for c in closed] == [(iso(0), 230, 231)]


def cycle(program, outcome="finished", estimate=150, actual=152, options=(), ended=0):
    return {
        "program": program, "started": iso(ended - (actual or 10)), "ended": iso(ended),
        "estimate": estimate, "actual": actual if outcome == "finished" else None,
        "options": list(options), "outcome": outcome,
    }


def test_stats_count_every_started_cycle_and_keep_the_last_finished_duration():
    stats = Stats()
    stats.add(cycle(AUTO, estimate=160, actual=158, options=[VARIO], ended=0))
    stats.add(cycle(AUTO, estimate=150, actual=152, ended=1000))
    stats.add(cycle(AUTO, outcome="interrupted", estimate=140, ended=2000))
    stats.add(cycle(ECO, estimate=235, actual=233, ended=3000))
    assert stats.programs() == {
        AUTO: {"usage": 3, "estimate": 150, "actual": 152, "options": []},
        ECO: {"usage": 1, "estimate": 235, "actual": 233, "options": []},
    }
    assert stats.total == 4
    assert stats.last["program"] == ECO


def test_a_finished_cycle_without_a_known_start_keeps_no_duration():
    stats = Stats()
    stats.add(cycle(AUTO, estimate=150, actual=152, ended=0))
    joined = {**cycle(AUTO, estimate=None, ended=1000), "started": None, "actual": None}
    stats.add(joined)
    assert stats.programs()[AUTO] == {"usage": 2, "estimate": 150, "actual": 152, "options": []}


def test_a_cycle_without_a_program_counts_but_belongs_to_none():
    stats = Stats()
    stats.add(cycle(None))
    assert stats.programs() == {}
    assert stats.total == 1


def test_stats_survive_a_round_trip_through_storage():
    stats = Stats()
    stats.add(cycle(AUTO, options=[HALF]))
    again = Stats(stats.as_dict())
    assert again.programs() == stats.programs()
    assert again.total == 1 and again.last == stats.last


def test_an_unknown_outcome_counts_but_teaches_no_duration():
    stats = Stats()
    stats.add(cycle(AUTO, estimate=150, actual=152, ended=0))
    stats.add({**cycle(AUTO, ended=1000), "outcome": "unknown", "actual": None})
    assert stats.programs()[AUTO] == {"usage": 2, "estimate": 150, "actual": 152, "options": []}


# The log: every cycle seen whole, for the history page.

NOW = at(10_000)


def logged(*cycles, now=NOW):
    log = CycleLog()
    for c in cycles:
        log.add(c, now)
    return log


def test_the_log_keeps_cycles_oldest_first_and_gives_them_newest_first():
    log = logged(cycle(AUTO, ended=1000), cycle(ECO, ended=3000), cycle(AUTO, ended=2000))
    assert [c["ended"] for c in log.cycles] == [iso(1000), iso(2000), iso(3000)]
    assert [c["ended"] for c in log.newest()] == [iso(3000), iso(2000), iso(1000)]
    assert [c["ended"] for c in log.newest(2)] == [iso(3000), iso(2000)]


def test_the_log_keeps_interrupted_cycles():
    log = logged(cycle(ECO, outcome="interrupted", actual=None, ended=1000))
    assert [c["outcome"] for c in log.cycles] == ["interrupted"]


def test_the_log_leaves_out_what_was_not_seen_whole():
    unknown = {**cycle(AUTO, ended=1000), "outcome": "unknown", "actual": None}
    joined = {**cycle(AUTO, ended=2000), "started": None, "actual": None}
    # The machine flickers run, ready, run when a program starts.
    flicker = {**cycle(ECO, outcome="interrupted", ended=3000), "started": iso(3000)}
    assert logged(unknown, joined, flicker).cycles == []


def test_the_log_keeps_a_cycle_once():
    again = cycle(AUTO, ended=1000)
    # From the recorder, a timestamp may come back a microsecond off.
    nudged = {**again, "ended": (at(1000) + timedelta(microseconds=1)).isoformat()}
    log = logged(cycle(AUTO, ended=1000), again, nudged, cycle(ECO, ended=1001))
    assert [c["ended"] for c in log.cycles] == [iso(1000), iso(1001)]


def test_the_log_keeps_a_year_at_most():
    year = timedelta(days=365) / timedelta(minutes=1)
    log = logged(cycle(AUTO, ended=0), cycle(ECO, ended=1000), now=at(year + 500))
    assert [c["program"] for c in log.cycles] == [ECO]
    log.trim(at(year + 2000))
    assert log.cycles == []


def test_the_log_keeps_a_thousand_cycles_at_most():
    log = logged(*(cycle(AUTO, ended=-200 * n) for n in range(1005)))
    assert len(log.cycles) == 1000
    assert log.cycles[0]["ended"] == iso(-200 * 999)
    assert log.cycles[-1]["ended"] == iso(0)


def test_the_log_survives_a_round_trip_through_storage():
    log = logged(cycle(AUTO, ended=1000), cycle(ECO, ended=2000))
    assert CycleLog(log.as_list()).cycles == log.cycles


def test_cycles_in_replays_states_with_a_tracker_of_its_own(ready):
    states = [
        (at(-60), "state", "ready"),
        (at(0), "state", "run"),
        (at(0), "active", ECO),
        (at(230), "state", "finished"),
        (at(300), "state", "run"),
    ]
    assert [(c["program"], c["actual"]) for c in cycles_in(states)] == [(ECO, 230)]
    # The cycle still running is not one of them.
