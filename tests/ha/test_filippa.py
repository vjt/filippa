"""Filippa inside Home Assistant: flow, setup, cycles live and from the recorder."""
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from homeassistant import config_entries
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.filippa import DOMAIN, dishwashers
from custom_components.filippa.dashboard import _save

from fake import ACTIVE, CYCLES, HA_ID, P, STATE, VARIO, cycle, setup_entry

async def test_flow_offers_the_dishwasher_only(hass, dishwasher, oven, no_dashboard):
    assert dishwashers(hass) == {dishwasher: "Filippa"}
    with patch("custom_components.filippa.async_setup_entry", AsyncMock(return_value=True)):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": config_entries.SOURCE_USER}
        )
        assert result["type"] == "form"
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {"device_id": dishwasher}
        )
    assert result["type"] == "create_entry"
    assert result["title"] == "Filippa"
    assert result["data"] == {"device_id": dishwasher}


async def test_flow_without_dishwashers_aborts(hass, oven, no_dashboard):
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == "abort"
    assert result["reason"] == "no_dishwashers"


async def test_the_cycles_sensor_joins_the_home_connect_device(hass, dishwasher, no_dashboard):
    await setup_entry(hass, dishwasher)
    entity = er.async_get(hass).async_get(CYCLES)
    assert entity is not None
    assert entity.device_id == dishwasher
    assert hass.states.get(CYCLES).state == "0"
    assert dr.async_get(hass).async_get(dishwasher).identifiers == {("home_connect", HA_ID)}


async def test_cycles_are_learned_live(hass, dishwasher, no_dashboard, freezer):
    await setup_entry(hass, dishwasher)
    cycle(hass, freezer, P + "auto_2", minutes=152, estimate=155, vario=True)
    cycle(hass, freezer, P + "auto_2", minutes=150, estimate=150)
    cycle(hass, freezer, P + "eco_50", minutes=233, estimate=235)
    await hass.async_block_till_done()
    state = hass.states.get(CYCLES)
    assert state.state == "3"
    assert state.attributes["programs"] == {
        P + "auto_2": {"usage": 2, "estimate": 150, "actual": 150, "options": []},
        P + "eco_50": {"usage": 1, "estimate": 235, "actual": 233, "options": []},
    }
    assert state.attributes["last"]["program"] == P + "eco_50"
    assert state.attributes["last"]["outcome"] == "finished"


async def test_a_stopped_cycle_counts_but_teaches_no_duration(hass, dishwasher, no_dashboard, freezer):
    await setup_entry(hass, dishwasher)
    hass.states.async_set(STATE, "run")
    hass.states.async_set(ACTIVE, P + "intensiv_70")
    freezer.tick(timedelta(minutes=12))
    hass.states.async_set(STATE, "aborting")
    hass.states.async_set(STATE, "ready")
    await hass.async_block_till_done()
    programs = hass.states.get(CYCLES).attributes["programs"]
    assert programs == {P + "intensiv_70": {"usage": 1, "estimate": None, "actual": None, "options": []}}


async def test_the_dashboard_gets_one_card_with_parts_and_switches(hass, dishwasher, no_dashboard):
    from homeassistant.components.lovelace.dashboard import LovelaceStorage

    entry = await setup_entry(hass, dishwasher)
    hass.data["lovelace"] = SimpleNamespace(dashboards={})
    filippa = hass.data[DOMAIN][entry.entry_id]
    await _save(hass, [filippa])
    storage = hass.data["lovelace"].dashboards["filippa"]
    assert isinstance(storage, LovelaceStorage)
    config = await storage.async_load(False)
    [view] = config["views"]
    [card] = view["cards"]
    assert card["type"] == "custom:filippa-card"
    assert card["device_id"] == dishwasher
    assert card["entities"]["state"] == STATE
    assert card["entities"]["selected"] == "select.filippa_selected_program"
    assert card["entities"]["stop"] == "button.filippa_stop_program"
    assert card["entities"]["cycles"] == CYCLES
    assert card["switches"] == {
        "dishcare_dishwasher_option_half_load": "switch.filippa_half_load",
        "dishcare_dishwasher_option_vario_speed_plus": VARIO,
    }

    # What the user added stays; what Filippa no longer finds goes.
    card["entities"]["extra"] = "automation.svuota"
    card["entities"]["door"] = "sensor.gone"
    card["theme"] = "dark"
    await storage.async_save(config)
    filippa.parts.pop("door")
    await _save(hass, [filippa])
    [card] = (await storage.async_load(False))["views"][0]["cards"]
    assert card["entities"]["extra"] == "automation.svuota"
    assert "door" not in card["entities"]
    assert card["theme"] == "dark"


async def test_without_home_connect_entities_setup_waits(hass, no_dashboard):
    hc = MockConfigEntry(domain="home_connect")
    hc.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=hc.entry_id, identifiers={("home_connect", HA_ID)}, name="Filippa"
    )
    entry = MockConfigEntry(domain=DOMAIN, unique_id=device.id, data={"device_id": device.id})
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    assert entry.state is config_entries.ConfigEntryState.SETUP_RETRY
