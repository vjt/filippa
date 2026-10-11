"""The home_connect dishwasher the tests set up: ids, entities, states, and
how a cycle shows on them."""
from datetime import timedelta

from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry

DOMAIN = "filippa"
STATE = "sensor.filippa_operation_state"
ACTIVE = "select.filippa_active_program"
FINISH = "sensor.filippa_program_finish_time"
VARIO = "switch.filippa_vario_speed"
CYCLES = "sensor.filippa_cicli"

HA_ID = "BOSCH-SMV4HCX48E-68A40E000000"
P = "dishcare_dishwasher_program_"
PROGRAMS = [P + k for k in ("eco_50", "auto_2", "intensiv_70", "quick_45", "glas_40")]

# key -> (domain, object id, state)
ENTITIES = {
    "BSH.Common.Status.OperationState": ("sensor", "filippa_operation_state", "ready"),
    "BSH.Common.Status.DoorState": ("sensor", "filippa_door", "closed"),
    "BSH.Common.Option.ProgramProgress": ("sensor", "filippa_program_progress", "unavailable"),
    "BSH.Common.Option.RemainingProgramTime": ("sensor", "filippa_program_finish_time", "unavailable"),
    "BSH.Common.Root.ActiveProgram": ("select", "filippa_active_program", "unknown"),
    "BSH.Common.Root.SelectedProgram": ("select", "filippa_selected_program", P + "auto_2"),
    "BSH.Common.Status.RemoteControlStartAllowed": ("binary_sensor", "filippa_remote_start", "on"),
    "StopProgram": ("button", "filippa_stop_program", "unknown"),
    "Dishcare.Dishwasher.Event.SaltNearlyEmpty": ("sensor", "filippa_salt_nearly_empty", "off"),
    "Dishcare.Dishwasher.Option.HalfLoad": ("switch", "filippa_half_load", "off"),
    "Dishcare.Dishwasher.Option.VarioSpeedPlus": ("switch", "filippa_vario_speed", "off"),
}


async def setup_entry(hass, device_id):
    entry = MockConfigEntry(domain=DOMAIN, unique_id=device_id, data={"device_id": device_id})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    return entry


def cycle(hass, freezer, program, minutes, estimate, vario=False):
    """A whole cycle as home_connect reports it, a minute from now."""
    freezer.tick(timedelta(minutes=1))
    if vario:
        hass.states.async_set(VARIO, "on")
    hass.states.async_set(STATE, "run")
    hass.states.async_set(ACTIVE, program)
    hass.states.async_set(FINISH, (dt_util.utcnow() + timedelta(minutes=estimate)).isoformat())
    freezer.tick(timedelta(minutes=minutes))
    hass.states.async_set(STATE, "finished")
    hass.states.async_set(FINISH, "unavailable")
    freezer.tick(timedelta(minutes=5))
    hass.states.async_set(STATE, "ready")
    hass.states.async_set(VARIO, "off")
