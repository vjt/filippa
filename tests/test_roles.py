"""Which home_connect entity plays which part, by unique_id."""
from machine.roles import find, is_dishwasher, option_field

HA_ID = "BOSCH-SMV4HCX48E-68A40E000000"


def uid(key):
    return f"{HA_ID}-{key}"


REGISTRY = {
    uid("BSH.Common.Status.OperationState"): "sensor.filippa_operation_state",
    uid("BSH.Common.Status.DoorState"): "sensor.filippa_door",
    uid("BSH.Common.Option.ProgramProgress"): "sensor.filippa_program_progress",
    uid("BSH.Common.Option.RemainingProgramTime"): "sensor.filippa_program_finish_time",
    uid("BSH.Common.Root.ActiveProgram"): "select.filippa_active_program",
    uid("BSH.Common.Root.SelectedProgram"): "select.filippa_selected_program",
    uid("BSH.Common.Status.RemoteControlActive"): "binary_sensor.filippa_remote_control",
    uid("BSH.Common.Status.RemoteControlStartAllowed"): "binary_sensor.filippa_remote_start",
    uid("BSH.Common.Appliance.Connected"): "binary_sensor.filippa_connectivity",
    uid("BSH.Common.Setting.PowerState"): "switch.filippa_power",
    uid("StopProgram"): "button.filippa_stop_program",
    uid("BSH.Common.Option.StartInRelative"): "number.filippa_start_in_relative",
    uid("Dishcare.Dishwasher.Event.SaltNearlyEmpty"): "sensor.filippa_salt_nearly_empty",
    uid("Dishcare.Dishwasher.Event.RinseAidNearlyEmpty"): "sensor.filippa_rinse_aid_nearly_empty",
    uid("BSH.Common.Event.ProgramFinished"): "sensor.filippa_program_finished",
    uid("Dishcare.Dishwasher.Option.IntensivZone"): "switch.filippa_intensive_zone",
    uid("Dishcare.Dishwasher.Option.VarioSpeedPlus"): "switch.filippa_vario_speed",
    uid("Dishcare.Dishwasher.Option.HalfLoad"): "switch.filippa_half_load",
    uid("Dishcare.Dishwasher.Option.HygienePlus"): "switch.filippa_hygiene",
    uid("Dishcare.Dishwasher.Option.ExtraDry"): "switch.filippa_extra_dry",
    uid("Dishcare.Dishwasher.Option.SilenceOnDemand"): "switch.filippa_silence_on_demand",
}


def test_every_part_is_found_by_unique_id():
    entities, options = find(REGISTRY)
    assert entities == {
        "state": "sensor.filippa_operation_state",
        "door": "sensor.filippa_door",
        "progress": "sensor.filippa_program_progress",
        "finish": "sensor.filippa_program_finish_time",
        "active": "select.filippa_active_program",
        "selected": "select.filippa_selected_program",
        "remote": "binary_sensor.filippa_remote_control",
        "remote_start": "binary_sensor.filippa_remote_start",
        "connected": "binary_sensor.filippa_connectivity",
        "power": "switch.filippa_power",
        "stop": "button.filippa_stop_program",
        "salt": "sensor.filippa_salt_nearly_empty",
        "rinse_aid": "sensor.filippa_rinse_aid_nearly_empty",
    }
    assert options == {
        "dishcare_dishwasher_option_intensiv_zone": "switch.filippa_intensive_zone",
        "dishcare_dishwasher_option_vario_speed_plus": "switch.filippa_vario_speed",
        "dishcare_dishwasher_option_half_load": "switch.filippa_half_load",
        "dishcare_dishwasher_option_hygiene_plus": "switch.filippa_hygiene",
        "dishcare_dishwasher_option_extra_dry": "switch.filippa_extra_dry",
        "dishcare_dishwasher_option_silence_on_demand": "switch.filippa_silence_on_demand",
    }


def test_renamed_entities_keep_their_part():
    entities, _ = find({uid("BSH.Common.Status.OperationState"): "sensor.lavastoviglie_stato"})
    assert entities == {"state": "sensor.lavastoviglie_stato"}


def test_the_delay_is_left_out():
    # vjt: no delayed start, so the card never sees StartInRelative.
    entities, options = find({uid("BSH.Common.Option.StartInRelative"): "number.x"})
    assert entities == {} and options == {}


def test_option_fields_are_the_service_fields():
    assert option_field("Dishcare.Dishwasher.Option.VarioSpeedPlus") == (
        "dishcare_dishwasher_option_vario_speed_plus"
    )
    assert option_field("Dishcare.Dishwasher.Option.IntensivZone") == (
        "dishcare_dishwasher_option_intensiv_zone"
    )
    assert option_field("BSH.Common.Option.StartInRelative") is None


def test_a_dishwasher_is_told_apart_from_other_appliances():
    assert is_dishwasher(REGISTRY)
    oven = [uid("BSH.Common.Status.OperationState"), uid("Cooking.Oven.Option.SetpointTemperature")]
    assert not is_dishwasher(oven)
    assert not is_dishwasher([uid("Dishcare.Dishwasher.Option.HalfLoad")])
