"""Filippa: a Bosch dishwasher, with a card worth opening.

Home Connect already reaches Home Assistant through the core home_connect
integration, which gets each change pushed. Filippa adds no client of its
own: it finds the dishwasher's home_connect entities, follows their states
to learn how often each program runs and how long it takes (live, and from
the recorder for whatever happened while it was not looking), and gives the
dishwasher a card. Programs, options, starts and stops all go through
home_connect's own entities and services.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from functools import partial
from typing import Callable

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util

from .machine.cycles import CycleTracker, Stats
from .machine.roles import find, is_dishwasher

_LOGGER = logging.getLogger(__name__)

DOMAIN = "filippa"
HOME_CONNECT = "home_connect"
PLATFORMS = [Platform.SENSOR]
CONF_DEVICE_ID = "device_id"
CYCLES = f"{DOMAIN}_cycles"
# How far back the first look at the recorder goes; it keeps 10 days by default.
HISTORY = timedelta(days=30)
# The parts a cycle is read from, besides the option switches.
FOLLOWED = ("state", "active", "selected", "finish")

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    from .dashboard import async_setup_dashboard

    await async_setup_dashboard(hass)
    store = CycleStore(hass)
    await store.async_load()
    hass.data[CYCLES] = store
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    dishwasher = Dishwasher.find(hass, entry.data[CONF_DEVICE_ID], hass.data[CYCLES])
    if dishwasher is None:
        raise ConfigEntryNotReady("home_connect has not set up this dishwasher (yet)")
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = dishwasher
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    dishwasher.async_follow(entry)

    from .dashboard import async_save_dashboard

    await async_save_dashboard(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    hass.data[DOMAIN].pop(entry.entry_id)

    from .dashboard import async_save_dashboard

    await async_save_dashboard(hass)
    return True


def home_connect_entities(hass: HomeAssistant, device_id: str) -> dict[str, str]:
    """{unique_id: entity_id} of a device's enabled home_connect entities."""
    registry = er.async_get(hass)
    return {
        entry.unique_id: entry.entity_id
        for entry in er.async_entries_for_device(registry, device_id)
        if entry.platform == HOME_CONNECT
    }


def dishwashers(hass: HomeAssistant) -> dict[str, str]:
    """{device_id: name} of the home_connect dishwashers."""
    registry = dr.async_get(hass)
    found = {}
    for entry in hass.config_entries.async_entries(HOME_CONNECT):
        for device in dr.async_entries_for_config_entry(registry, entry.entry_id):
            if is_dishwasher(home_connect_entities(hass, device.id)):
                found[device.id] = device.name_by_user or device.name or device.id
    return found


class CycleStore:
    """Per appliance (haId): the tracker, the stats and the time of the last
    state they took in, kept in .storage."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store = Store(hass, 1, f"{DOMAIN}.cycles")
        self._data: dict[str, dict] = {}

    async def async_load(self) -> None:
        self._data = await self._store.async_load() or {}

    def get(self, ha_id: str) -> dict:
        return self._data.get(ha_id, {})

    def put(self, ha_id: str, data: dict) -> None:
        self._data[ha_id] = data
        self._store.async_delay_save(lambda: self._data, 10)


class Dishwasher:
    """One home_connect dishwasher: its parts and what its cycles taught."""

    def __init__(
        self,
        hass: HomeAssistant,
        device: dr.DeviceEntry,
        parts: dict[str, str],
        switches: dict[str, str],
        store: CycleStore,
    ) -> None:
        self.hass = hass
        # Filippa's own entities join this device, home_connect's.
        self.device = device
        self.device_id = device.id
        self.ha_id = next(i for domain, i in device.identifiers if domain == HOME_CONNECT)
        self.name = device.name_by_user or device.name or "Filippa"
        self.parts = parts
        self.switches = switches
        self._store = store
        saved = store.get(self.ha_id)
        self.tracker = CycleTracker(saved.get("tracker"))
        self.stats = Stats(saved.get("stats"))
        cursor = saved.get("cursor")
        self.cursor: datetime | None = dt_util.parse_datetime(cursor) if cursor else None
        # entity_id -> part the tracker knows it by.
        self._followed = {parts[p]: p for p in FOLLOWED if p in parts}
        self._followed.update({entity_id: field for field, entity_id in switches.items()})
        # Changes that land while the recorder is being read, None otherwise.
        self._queue: list[tuple[datetime, str, str]] | None = None
        self._listeners: list[Callable[[], None]] = []

    @classmethod
    def find(cls, hass: HomeAssistant, device_id: str, store: CycleStore) -> Dishwasher | None:
        device = dr.async_get(hass).async_get(device_id)
        if device is None or not any(d == HOME_CONNECT for d, _ in device.identifiers):
            return None
        parts, switches = find(home_connect_entities(hass, device_id))
        if "state" not in parts:
            return None
        return cls(hass, device, parts, switches, store)

    @callback
    def async_follow(self, entry: ConfigEntry) -> None:
        """Follow the states from now on, after catching up on the recorder."""
        if not self._followed:
            return
        self._queue = []
        entry.async_on_unload(
            async_track_state_change_event(self.hass, list(self._followed), self._on_change)
        )
        entry.async_create_background_task(self.hass, self._async_catch_up(), f"{DOMAIN} history")

    @callback
    def _on_change(self, event: Event[EventStateChangedData]) -> None:
        new, old = event.data["new_state"], event.data["old_state"]
        if new is None or (old is not None and old.state == new.state):
            return
        item = (new.last_changed, self._followed[new.entity_id], new.state)
        if self._queue is not None:
            self._queue.append(item)
        else:
            self._feed([item])

    async def _async_catch_up(self) -> None:
        try:
            items = await self._async_history()
        except Exception:  # the live states are still worth following
            _LOGGER.exception("%s: reading the recorder failed", self.name)
            items = []
        # Already taken in: the recorder repeats the states at its start.
        if self.cursor is not None:
            items = [item for item in items if item[0] > self.cursor]
        # What changed while the recorder was read may be in both. Sorted
        # stably: an entity's states keep their order, however close in time.
        queued, self._queue = self._queue or [], None
        self._feed(sorted(dict.fromkeys(items + queued), key=lambda item: item[0]))

    async def _async_history(self) -> list[tuple[datetime, str, str]]:
        if "recorder" not in self.hass.config.components:
            return []
        from homeassistant.components.recorder import history
        from homeassistant.helpers.recorder import get_instance

        start = self.cursor or dt_util.utcnow() - HISTORY
        found = await get_instance(self.hass).async_add_executor_job(
            partial(
                history.get_significant_states,
                self.hass,
                start,
                entity_ids=list(self._followed),
                significant_changes_only=False,
                no_attributes=True,
            )
        )
        return [
            (state.last_changed, self._followed[entity_id], state.state)
            for entity_id, states in found.items()
            for state in states
            if isinstance(state, State)
        ]

    def _feed(self, items: list[tuple[datetime, str, str]]) -> None:
        if not items:
            return
        closed = False
        for when, part, value in items:
            if cycle := self.tracker.feed(when, part, value):
                self.stats.add(cycle)
                closed = True
        cursor = max(items[-1][0], self.cursor) if self.cursor else items[-1][0]
        self.cursor = cursor
        self._store.put(
            self.ha_id,
            {
                "tracker": self.tracker.as_dict(),
                "stats": self.stats.as_dict(),
                "cursor": cursor.isoformat(),
            },
        )
        if closed:
            self._notify()

    @callback
    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener)

    def _notify(self) -> None:
        for listener in list(self._listeners):
            listener()
