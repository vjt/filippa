"""Config flow: one entry per home_connect dishwasher."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow

from . import CONF_DEVICE_ID, DOMAIN, dishwashers


class FilippaConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        configured = {entry.unique_id for entry in self._async_current_entries()}
        choices = {k: v for k, v in dishwashers(self.hass).items() if k not in configured}
        if not choices:
            return self.async_abort(reason="no_dishwashers")
        if user_input is not None:
            device_id = user_input[CONF_DEVICE_ID]
            await self.async_set_unique_id(device_id)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=choices[device_id], data={CONF_DEVICE_ID: device_id}
            )
        schema = vol.Schema(
            {vol.Required(CONF_DEVICE_ID, default=next(iter(choices))): vol.In(choices)}
        )
        return self.async_show_form(step_id="user", data_schema=schema)
