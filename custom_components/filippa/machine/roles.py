"""Which home_connect entity plays which part.

The core names its entities' unique ids `<haId>-<key>`, the key being the
Home Connect one (BSH.Common.Status.OperationState, ...). Entity ids can be
renamed, unique ids cannot: the parts are found by key.
"""
from __future__ import annotations

import re

# Home Connect key -> part, as the card calls it.
PARTS = {
    "BSH.Common.Status.OperationState": "state",
    "BSH.Common.Status.DoorState": "door",
    "BSH.Common.Option.ProgramProgress": "progress",
    "BSH.Common.Option.RemainingProgramTime": "finish",
    "BSH.Common.Root.ActiveProgram": "active",
    "BSH.Common.Root.SelectedProgram": "selected",
    "BSH.Common.Status.RemoteControlActive": "remote",
    "BSH.Common.Status.RemoteControlStartAllowed": "remote_start",
    "BSH.Common.Appliance.Connected": "connected",
    "BSH.Common.Setting.PowerState": "power",
    "StopProgram": "stop",
    "Dishcare.Dishwasher.Event.SaltNearlyEmpty": "salt",
    "Dishcare.Dishwasher.Event.RinseAidNearlyEmpty": "rinse_aid",
}
OPTION_PREFIX = "Dishcare.Dishwasher.Option."

# Same as the core's bsh_key_to_translation_key, which names the service fields.
_CAMEL = re.compile(r"(?<!^)(?=[A-Z])|(?=\d)(?<=\D)")


def option_field(key: str) -> str | None:
    """The set_program_and_options field of a dishwasher option key."""
    if not key.startswith(OPTION_PREFIX):
        return None
    return "_".join(_CAMEL.sub("_", part) for part in key.split(".")).lower()


def key_of(unique_id: str) -> str:
    """Keys have no dashes, haIds do (BOSCH-SMV4HCX48E-68A40E...)."""
    return unique_id.rsplit("-", 1)[-1]


def is_dishwasher(unique_ids) -> bool:
    """An appliance with an operation state and something of a dishwasher."""
    keys = {key_of(unique_id) for unique_id in unique_ids}
    return "BSH.Common.Status.OperationState" in keys and any(
        key.startswith("Dishcare.Dishwasher.") for key in keys
    )


def find(entities: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    """{unique_id: entity_id} of one appliance -> ({part: entity_id},
    {option field: entity_id})."""
    parts, options = {}, {}
    for unique_id, entity_id in entities.items():
        key = key_of(unique_id)
        if key in PARTS:
            parts[PARTS[key]] = entity_id
        elif field := option_field(key):
            options[field] = entity_id
    return parts, options
