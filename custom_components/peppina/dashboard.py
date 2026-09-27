"""Sidebar dashboard: one page per install, status on the left, controls on the right.

Same approach as ha-verisure-italy: register a storage-mode Lovelace panel and
rewrite its config on every load from what the entity registry holds. It rides
on Lovelace internals (LovelaceStorage), so a failure is logged and swallowed:
the controls keep working without the page.
"""
from __future__ import annotations

import logging

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from . import DOMAIN, HON, Washer

_LOGGER = logging.getLogger(__name__)

URL = "peppina"
TITLE = "Peppina"
ICON = "mdi:washing-machine"

# hon entities worth showing, by the tail of their unique_id (after the mac).
STATUS = [
    "mach_mode",
    "pr_phase",
    "program_name",
    "remaining_time_m_m",
    "end time",
    "door_status",
    "remote_ctr_valid",
    "errors",
]
CONTROLS = ["program", "start", "stop", "delayed_start", "cancel_delayed_start"]


async def async_setup_dashboard(hass: HomeAssistant, washers: list[Washer]) -> None:
    frontend.async_register_built_in_panel(
        hass,
        component_name="lovelace",
        sidebar_title=TITLE,
        sidebar_icon=ICON,
        frontend_url_path=URL,
        config={"mode": "storage"},
        require_admin=False,
        update=True,
    )
    try:
        await _save(hass, washers)
    except (AttributeError, KeyError, TypeError, ImportError, OSError):
        _LOGGER.exception("Dashboard setup failed, Lovelace internals may have changed")


async def _save(hass: HomeAssistant, washers: list[Washer]) -> None:
    from homeassistant.components.lovelace.dashboard import LovelaceStorage

    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        return
    storage = lovelace.dashboards.get(URL)
    if not isinstance(storage, LovelaceStorage):
        storage = LovelaceStorage(
            hass,
            {
                "id": URL,
                "url_path": URL,
                "title": TITLE,
                "icon": ICON,
                "show_in_sidebar": True,
                "require_admin": False,
            },
        )
        lovelace.dashboards[URL] = storage

    registry = er.async_get(hass)
    sections = []
    for washer in washers:
        status = [
            registry.async_get_entity_id(domain, HON, f"{washer.mac}_{key}")
            for key in STATUS
            for domain in ("sensor", "binary_sensor")
        ]
        controls = [
            registry.async_get_entity_id(domain, DOMAIN, f"{DOMAIN}_{washer.mac}_{key}")
            for key in CONTROLS
            for domain in ("select", "button", "datetime")
        ]
        sections.append(_grid(f"{washer.name}: stato", status))
        sections.append(_grid(f"{washer.name}: comandi", controls))

    await storage.async_save(
        {
            "views": [
                {
                    "title": TITLE,
                    "path": "default",
                    "icon": ICON,
                    "type": "sections",
                    "max_columns": 2,
                    "sections": sections,
                }
            ]
        }
    )


def _grid(heading: str, entity_ids: list[str | None]) -> dict:
    cards = [{"type": "heading", "heading": heading}]
    cards += [{"type": "tile", "entity": e} for e in entity_ids if e is not None]
    return {"type": "grid", "cards": cards}
