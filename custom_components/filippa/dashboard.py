"""Sidebar dashboard: one full-page dishwasher card per dishwasher.

Same approach as Peppina's: register a storage-mode Lovelace panel and
rewrite its config on every load from what the entity registry holds. It
rides on Lovelace internals (LovelaceStorage), so a failure is logged and
swallowed: the home_connect controls keep working without the page.
"""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from . import DOMAIN
from .machine.roles import PARTS

_LOGGER = logging.getLogger(__name__)

URL = "filippa"
TITLE = "Filippa"
ICON = "mdi:dishwasher"
CARD_URL = "/filippa/filippa-card.js"
CARD_FILE = Path(__file__).parent / "www" / "filippa-card.js"
CARD_TYPE = "custom:filippa-card"

# Card keys Filippa writes; anything else on the card is the user's.
OWN_KEYS = ("type", "name", "device_id", "entities", "switches")
# Roles Filippa fills in; any other role on the card is the user's.
ROLES = {*PARTS.values(), "cycles"}


async def async_setup_dashboard(hass: HomeAssistant) -> None:
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(CARD_FILE), cache_headers=False)]
    )
    # mtime busts the browser cache when the card changes
    frontend.add_extra_js_url(hass, f"{CARD_URL}?v={int(CARD_FILE.stat().st_mtime)}")
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


async def async_save_dashboard(hass: HomeAssistant) -> None:
    """Rewrite the page from the dishwashers of every loaded entry."""
    try:
        await _save(hass, list(hass.data.get(DOMAIN, {}).values()))
    except (AttributeError, KeyError, TypeError, ImportError, OSError):
        _LOGGER.exception("Dashboard setup failed, Lovelace internals may have changed")


def card_entities(hass: HomeAssistant, dishwasher) -> dict[str, str]:
    """The home_connect parts, plus Filippa's own cycles sensor."""
    entities = dict(dishwasher.parts)
    cycles = er.async_get(hass).async_get_entity_id(
        "sensor", DOMAIN, f"{DOMAIN}_{dishwasher.ha_id}_cycles"
    )
    if cycles:
        entities["cycles"] = cycles
    return entities


async def _added_by_hand(storage) -> dict[str, tuple[dict, dict]]:
    """What the user added to each card, by view title: entities under roles
    of their own and card options, which a rewrite must not drop."""
    from homeassistant.components.lovelace.dashboard import ConfigNotFound

    try:
        config = await storage.async_load(False)
    except ConfigNotFound:
        return {}
    kept = {}
    for view in config.get("views", []):
        for card in view.get("cards", []):
            if card.get("type") == CARD_TYPE:
                extra = {k: v for k, v in card.get("entities", {}).items() if k not in ROLES}
                options = {k: v for k, v in card.items() if k not in OWN_KEYS}
                kept[view.get("title")] = (extra, options)
    return kept


async def _save(hass: HomeAssistant, dishwashers: list) -> None:
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

    views = []
    kept = await _added_by_hand(storage)
    for dishwasher in dishwashers:
        extra, options = kept.get(dishwasher.name, ({}, {}))
        entities = {**extra, **card_entities(hass, dishwasher)}
        views.append(
            {
                "title": dishwasher.name,
                "path": "default" if not views else dishwasher.ha_id.lower(),
                "icon": ICON,
                "type": "panel",
                "cards": [
                    {
                        **options,
                        "type": CARD_TYPE,
                        "name": dishwasher.name,
                        "device_id": dishwasher.device_id,
                        "entities": entities,
                        "switches": dict(dishwasher.switches),
                    }
                ],
            }
        )

    await storage.async_save({"views": views})
