"""Start, stop, and cancel a pending delayed start."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity

from . import DOMAIN
from .entity import FilippaEntity


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    if discovery_info is None:
        return
    entities = []
    for washer in hass.data[DOMAIN]:
        entities += [FilippaStart(washer), FilippaStop(washer), FilippaCancelDelay(washer)]
    async_add_entities(entities)


class FilippaStart(FilippaEntity, ButtonEntity):
    _attr_icon = "mdi:play"

    def __init__(self, washer) -> None:
        super().__init__(washer, "start", "Avvia")

    async def async_press(self) -> None:
        await self._washer.start()


class FilippaStop(FilippaEntity, ButtonEntity):
    _attr_icon = "mdi:stop"

    def __init__(self, washer) -> None:
        super().__init__(washer, "stop", "Stop")

    async def async_press(self) -> None:
        await self._washer.stop()


class FilippaCancelDelay(FilippaEntity, ButtonEntity):
    _attr_icon = "mdi:timer-off-outline"

    def __init__(self, washer) -> None:
        super().__init__(washer, "cancel_delayed_start", "Annulla avvio ritardato")

    async def async_press(self) -> None:
        self._washer.cancel_delayed_start()
