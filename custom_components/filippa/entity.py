"""Shared base for Filippa entities."""
from __future__ import annotations

from homeassistant.helpers.entity import Entity

from . import DOMAIN, Washer


class FilippaEntity(Entity):
    """Named after the appliance; YAML-loaded, so no device_info link."""

    _attr_should_poll = False

    def __init__(self, washer: Washer, key: str, label: str) -> None:
        self._washer = washer
        self._attr_unique_id = f"{DOMAIN}_{washer.mac}_{key}"
        self._attr_name = f"{washer.name} {label}"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._washer.add_listener(self.async_write_ha_state))
