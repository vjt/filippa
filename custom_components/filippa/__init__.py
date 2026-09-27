"""Filippa: program, start, stop and delayed start for hOn washing machines.

The gvigroux/hon integration talks to the appliance but exposes no way to
stop a washing machine program. Filippa rides on top of its runtime (it does
not log in to hOn by itself) and adds four controls per appliance that knows
both the startProgram and stopProgram commands.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Callable

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, Platform
from homeassistant.core import CoreState, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.discovery import async_load_platform
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "filippa"
HON = "hon"
PLATFORMS = [Platform.SELECT, Platform.BUTTON, Platform.DATETIME]
START = "startProgram"
STOP = "stopProgram"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Load the platforms once hon has had the chance to load its devices."""

    async def _load(_event=None) -> None:
        hass.data[DOMAIN] = discover_washers(hass)
        _LOGGER.info("Filippa found %d appliance(s)", len(hass.data[DOMAIN]))
        for platform in PLATFORMS:
            hass.async_create_task(
                async_load_platform(hass, platform, DOMAIN, {}, config)
            )

    if hass.state is CoreState.running:
        await _load()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _load)
    return True


def discover_washers(hass: HomeAssistant) -> list[Washer]:
    """Every hon device that can both start and stop a program."""
    washers = []
    for entry in dr.async_get(hass).devices.values():
        if not any(ident[0] == HON for ident in entry.identifiers):
            continue
        washer = Washer(hass, entry)
        device = washer.hon_device(required=False)
        if device is not None and START in device.commands and STOP in device.commands:
            washers.append(washer)
    return washers


class Washer:
    """One hOn appliance, as seen through the hon integration runtime."""

    def __init__(self, hass: HomeAssistant, entry: dr.DeviceEntry) -> None:
        self.hass = hass
        self.device_id = entry.id
        self.name = entry.name_by_user or entry.name or "hOn"
        # hon registers 3-tuples: (domain, mac, appliance type)
        self.mac = next(ident[1] for ident in entry.identifiers if ident[0] == HON)
        self.program: str | None = None
        self.delayed_start: datetime | None = None
        self._unsub_delayed: Callable[[], None] | None = None
        self._listeners: list[Callable[[], None]] = []

    def hon_device(self, required: bool = True):
        for connection in hass_hon_connections(self.hass):
            device = connection.get_device(self.hass, self.device_id)
            if device is not None:
                return device
        if required:
            raise HomeAssistantError(f"{self.name}: hon has not loaded this appliance")
        return None

    @property
    def programs(self) -> list[str]:
        device = self.hon_device(required=False)
        if device is None or START not in device.commands:
            return []
        return list(device.commands[START].get_programs().keys())

    async def start(self) -> None:
        device = self.hon_device()
        program = self.program
        if program not in self.programs:
            raise HomeAssistantError(f"{self.name}: unknown program {program!r}")
        if not await device.start_command(program).send():
            raise HomeAssistantError(f"{self.name}: hOn rejected start of {program}")

    async def stop(self) -> None:
        self.cancel_delayed_start()
        if not await self.hon_device().stop_command().send():
            raise HomeAssistantError(f"{self.name}: hOn rejected stop")

    def schedule_start(self, when: datetime) -> None:
        self.cancel_delayed_start()
        self.delayed_start = when
        self._unsub_delayed = async_track_point_in_time(self.hass, self._delayed_fire, when)
        self._notify()

    def cancel_delayed_start(self) -> None:
        if self._unsub_delayed is not None:
            self._unsub_delayed()
            self._unsub_delayed = None
        if self.delayed_start is not None:
            self.delayed_start = None
            self._notify()

    async def _delayed_fire(self, _now: datetime) -> None:
        self._unsub_delayed = None
        self.delayed_start = None
        self._notify()
        try:
            await self.start()
        except HomeAssistantError as err:
            _LOGGER.error("Delayed start failed: %s", err)

    @callback
    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener)

    def _notify(self) -> None:
        for listener in list(self._listeners):
            listener()


def hass_hon_connections(hass: HomeAssistant) -> list:
    """hon stores one connection per account next to its own bookkeeping."""
    return [c for c in hass.data.get(HON, {}).values() if hasattr(c, "get_device")]
