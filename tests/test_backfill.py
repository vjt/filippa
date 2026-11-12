"""The log rebuilt from the recorder, against ten days of a real dishwasher's
history: the states of its parts as the recorder gives them back, entity ids
replaced by parts, every timestamp moved by the same offset."""
import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from machine.cycles import CycleLog, cycles_in

P = "dishcare_dishwasher_program_"
O = "dishcare_dishwasher_option_"


@pytest.fixture(scope="module")
def history():
    rows = json.loads((Path(__file__).parent / "fixtures" / "history.json").read_text())
    return [(datetime.fromisoformat(when), part, value) for when, part, value in rows]


def window(states, since):
    """The states as the recorder gives them from `since` on: each part's
    state at that time first, then every change."""
    first = {part: value for when, part, value in states if when < since}
    return [(since, part, value) for part, value in first.items()] + [
        item for item in states if item[0] >= since
    ]


def rebuilt(states, now=None):
    log = CycleLog()
    now = now or states[-1][0]
    for cycle in cycles_in(states):
        log.add(cycle, now)
    return log


def short(cycle):
    return (cycle["program"].removeprefix(P), cycle["actual"], cycle["outcome"])


def test_every_cycle_of_the_window_comes_back(history):
    assert [short(c) for c in cycles_in(history)] == [
        ("auto_2", 146, "finished"),
        # Starting eco_50, the machine said run, ready, run, ready, run.
        ("eco_50", None, "interrupted"),
        ("eco_50", None, "interrupted"),
        ("eco_50", 294, "finished"),
        ("super_60", 179, "finished"),
        ("eco_50", 156, "finished"),
        # A delayed start: counted from the run.
        ("eco_50", 297, "finished"),
        ("eco_50", 159, "finished"),
        ("kurz_60", 141, "finished"),
        ("super_60", 156, "finished"),
        ("eco_50", 293, "finished"),
        ("kurz_60", 113, "finished"),
        ("intensiv_70", 178, "finished"),
        # Out of reach twice while it ran, back running both times: then stopped.
        ("kurz_60", None, "interrupted"),
    ]


def test_the_log_lists_the_washes_not_the_flickers(history):
    log = rebuilt(history)
    assert len(log.cycles) == 12
    assert [short(c) for c in log.newest(3)] == [
        ("kurz_60", None, "interrupted"),
        ("intensiv_70", 178, "finished"),
        ("kurz_60", 113, "finished"),
    ]
    assert log.newest(2)[1]["options"] == [O + "extra_dry", O + "hygiene_plus", O + "intensiv_zone"]


def test_a_window_opening_mid_cycle_leaves_that_cycle_out(history):
    """Its start is before what the recorder holds: no start, no entry."""
    running = cycles_in(history)[4]
    assert running["program"] == P + "super_60"
    middle = datetime.fromisoformat(running["started"]) + timedelta(minutes=30)
    log = rebuilt(window(history, middle))
    assert [c["started"] for c in cycles_in(window(history, middle))][0] is None
    # The nine after it, none left out.
    assert len(log.cycles) == 9
    assert all(datetime.fromisoformat(c["started"]) > middle for c in log.cycles)


def test_rebuilding_twice_keeps_each_cycle_once(history):
    log = rebuilt(history)
    for cycle in cycles_in(history):
        log.add(cycle, history[-1][0])
    assert len(log.cycles) == 12


def test_what_the_year_no_longer_covers_is_dropped(history):
    a_year_on = datetime.fromisoformat(cycles_in(history)[7]["ended"]) + timedelta(days=365)
    # The six washes after the eighth cycle.
    assert len(rebuilt(history, now=a_year_on).cycles) == 6
