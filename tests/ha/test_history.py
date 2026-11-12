"""Filippa and the recorder: cycles from before it, across restarts, and the
cycle log rebuilt from it.

The recorder must come before hass, hence the module's own autouse fixture."""
from datetime import timedelta

import pytest
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.components.recorder.common import (
    async_wait_recording_done,
)

from fake import ACTIVE, CYCLES, FINISH, HA_ID, P, STATE, cycle, flicker, setup_entry


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(recorder_mock, enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
def dependencies(recorder_mock, hass):
    for domain in ("frontend", "home_connect"):
        hass.config.components.add(domain)


async def test_cycles_before_filippa_come_from_the_recorder(
    recorder_mock, hass, dishwasher, no_dashboard, freezer
):
    cycle(hass, freezer, P + "eco_50", minutes=233, estimate=235)
    cycle(hass, freezer, P + "quick_45", minutes=29, estimate=29, vario=True)
    await async_wait_recording_done(hass)
    await setup_entry(hass, dishwasher)
    await hass.async_block_till_done(wait_background_tasks=True)
    state = hass.states.get(CYCLES)
    assert state.state == "2"
    assert state.attributes["programs"][P + "eco_50"]["actual"] == 233
    assert state.attributes["programs"][P + "quick_45"]["options"] == [
        "dishcare_dishwasher_option_vario_speed_plus"
    ]
    assert [c["program"] for c in state.attributes["recent"]] == [P + "quick_45", P + "eco_50"]


async def test_the_first_look_goes_a_year_back(recorder_mock, hass, dishwasher, no_dashboard, freezer):
    cycle(hass, freezer, P + "eco_50", minutes=233, estimate=235)
    freezer.tick(timedelta(days=200))
    cycle(hass, freezer, P + "auto_2", minutes=150, estimate=152)
    freezer.tick(timedelta(days=200))
    await async_wait_recording_done(hass)
    await setup_entry(hass, dishwasher)
    state = hass.states.get(CYCLES)
    # 400 days ago is more than the log keeps; 200 days ago is in.
    assert state.state == "1"
    assert [c["program"] for c in state.attributes["recent"]] == [P + "auto_2"]


def forget_the_log(hass):
    """The store as 0.2.0 left it: tracker, stats and cursor, no log."""
    store = hass.data["filippa_cycles"]
    store.put(HA_ID, {k: v for k, v in store.get(HA_ID).items() if k != "history"})


async def test_an_upgrade_rebuilds_the_log_from_the_recorder_counting_nothing_twice(
    recorder_mock, hass, dishwasher, no_dashboard, freezer
):
    entry = await setup_entry(hass, dishwasher)
    cycle(hass, freezer, P + "eco_50", minutes=233, estimate=235)
    flicker(hass, freezer)
    cycle(hass, freezer, P + "auto_2", minutes=150, estimate=152)
    await hass.async_block_till_done(wait_background_tasks=True)
    await async_wait_recording_done(hass)
    await hass.config_entries.async_unload(entry.entry_id)
    forget_the_log(hass)
    # ... and one more cycle while Filippa was down.
    cycle(hass, freezer, P + "quick_45", minutes=29, estimate=29)
    await async_wait_recording_done(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)

    def seen():
        state = hass.states.get(CYCLES)
        usage = {k: v["usage"] for k, v in state.attributes["programs"].items()}
        return state.state, usage, [c["program"] for c in state.attributes["recent"]]

    rebuilt = (
        "4",
        {P + "eco_50": 2, P + "auto_2": 1, P + "quick_45": 1},
        [P + "quick_45", P + "auto_2", P + "eco_50"],
    )
    assert seen() == rebuilt
    # Again, and rebuilt again from scratch: still each cycle once.
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert seen() == rebuilt
    await hass.config_entries.async_unload(entry.entry_id)
    forget_the_log(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert seen() == rebuilt


async def test_a_restart_counts_nothing_twice(recorder_mock, hass, dishwasher, no_dashboard, freezer):
    entry = await setup_entry(hass, dishwasher)
    cycle(hass, freezer, P + "eco_50", minutes=233, estimate=235)
    await hass.async_block_till_done(wait_background_tasks=True)
    await async_wait_recording_done(hass)
    assert hass.states.get(CYCLES).state == "1"
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get(CYCLES).state == "1"
    # ... and what happened while it was down is caught up on.
    await hass.config_entries.async_unload(entry.entry_id)
    cycle(hass, freezer, P + "auto_2", minutes=150, estimate=152)
    await async_wait_recording_done(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get(CYCLES).state == "2"


async def test_a_cycle_running_through_a_restart_keeps_its_start(
    recorder_mock, hass, dishwasher, no_dashboard, freezer
):
    entry = await setup_entry(hass, dishwasher)
    hass.states.async_set(STATE, "run")
    hass.states.async_set(ACTIVE, P + "auto_2")
    hass.states.async_set(FINISH, (dt_util.utcnow() + timedelta(minutes=155)).isoformat())
    await hass.async_block_till_done(wait_background_tasks=True)
    await async_wait_recording_done(hass)
    await hass.config_entries.async_unload(entry.entry_id)
    freezer.tick(timedelta(minutes=60))
    hass.states.async_set(STATE, "unavailable")
    hass.states.async_set(STATE, "run")
    await async_wait_recording_done(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    freezer.tick(timedelta(minutes=93))
    hass.states.async_set(STATE, "finished")
    await hass.async_block_till_done(wait_background_tasks=True)
    programs = hass.states.get(CYCLES).attributes["programs"]
    assert programs[P + "auto_2"]["actual"] == 153
    assert programs[P + "auto_2"]["estimate"] == 155
