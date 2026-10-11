"""Filippa and the recorder: cycles from before it, across restarts.

The recorder must come before hass, hence the module's own autouse fixture."""
from datetime import timedelta

import pytest
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.components.recorder.common import (
    async_wait_recording_done,
)

from fake import ACTIVE, CYCLES, FINISH, P, STATE, cycle, setup_entry


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
