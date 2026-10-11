"""What Filippa learned of the dishwasher's cycles, for the card."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.util import slugify

from . import DOMAIN, Dishwasher


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([FilippaCycles(hass.data[DOMAIN][entry.entry_id])])


class FilippaCycles(SensorEntity):
    """The cycles seen so far. Attributes: per program how often it ran and
    how long its last finished cycle took (`programs`), the last cycle."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_icon = "mdi:dishwasher"
    _attr_state_class = SensorStateClass.TOTAL_INCREASING

    def __init__(self, dishwasher: Dishwasher) -> None:
        self._dishwasher = dishwasher
        self._attr_unique_id = f"{DOMAIN}_{dishwasher.ha_id}_cycles"
        self._attr_name = "Cicli"
        # Linked, not described: a device_info would make a device of Filippa's own.
        self.device_entry = dishwasher.device
        # Next to home_connect's sensor.filippa_*; registered ones keep their id.
        self.entity_id = f"sensor.{slugify(dishwasher.name)}_cicli"

    @property
    def native_value(self) -> int:
        return self._dishwasher.stats.total

    @property
    def extra_state_attributes(self) -> dict:
        stats = self._dishwasher.stats
        return {"programs": stats.programs(), "last": stats.last}

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self._dishwasher.add_listener(self.async_write_ha_state))
