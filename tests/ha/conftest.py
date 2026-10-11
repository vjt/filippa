"""Home Assistant tests: pip install pytest-homeassistant-custom-component,
then run `pytest tests/ha` from the repository root (see README)."""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

# Imported now, before the hass fixture puts Home Assistant's own testing
# config (which has a custom_components package too) on the path.
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
import custom_components.filippa.dashboard  # noqa: E402,F401

import pytest
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

pytest_plugins = "pytest_homeassistant_custom_component"

from fake import ENTITIES, HA_ID, PROGRAMS


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
def dependencies(hass):
    """Taken as set up: the real ones need the frontend build and the Home
    Connect cloud."""
    for domain in ("frontend", "home_connect"):
        hass.config.components.add(domain)


@pytest.fixture
def no_dashboard():
    """The page needs Lovelace and the http server: tested on its own."""
    with patch("custom_components.filippa.dashboard.async_setup_dashboard", AsyncMock()), patch(
        "custom_components.filippa.dashboard.async_save_dashboard", AsyncMock()
    ):
        yield


@pytest.fixture
def dishwasher(hass):
    """A home_connect dishwasher in the registries, with its states. Returns
    the device id."""
    hc = MockConfigEntry(domain="home_connect", title="Home Connect")
    hc.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=hc.entry_id, identifiers={("home_connect", HA_ID)},
        name="Filippa", manufacturer="Bosch",
    )
    registry = er.async_get(hass)
    for key, (domain, object_id, state) in ENTITIES.items():
        entry = registry.async_get_or_create(
            domain, "home_connect", f"{HA_ID}-{key}", config_entry=hc,
            device_id=device.id, suggested_object_id=object_id,
        )
        attributes = {"options": PROGRAMS} if domain == "select" else {}
        hass.states.async_set(entry.entity_id, state, attributes)
    return device.id


@pytest.fixture
def oven(hass):
    hc = MockConfigEntry(domain="home_connect", title="Home Connect 2")
    hc.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=hc.entry_id, identifiers={("home_connect", "SIEMENS-HB000-1")}, name="Forno",
    )
    er.async_get(hass).async_get_or_create(
        "sensor", "home_connect", "SIEMENS-HB000-1-BSH.Common.Status.OperationState",
        config_entry=hc, device_id=device.id,
    )
    return device.id
