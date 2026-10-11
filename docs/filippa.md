# Filippa: how it is built, what is verified

## Why no client of its own

Peppina talks to hOn by itself because nothing else could stop or schedule
a Haier washer. A Bosch dishwasher is already in Home Assistant through the
core `home_connect` integration (2026.9: Home Connect's event stream, every
change pushed), and its services already start, select and stop programs.
What was missing is the card and the memory of past cycles, so Filippa is
only that: no requirements, `dependencies: [frontend, home_connect]`.

## Parts

- `machine/roles.py` (no Home Assistant): which home_connect entity plays
  which part, by unique id. The core names them `<haId>-<Home Connect key>`;
  entity ids can be renamed, unique ids cannot. The option switches map to
  the `set_program_and_options` fields the same way the core derives them
  (`bsh_key_to_translation_key`). `StartInRelative` is left out on purpose.
- `machine/cycles.py` (no Home Assistant): the tracker and the stats.
  - `run`, `pause` and `actionrequired` keep a cycle going; `finished` ends
    it with its real duration; any other state ends it as interrupted.
  - `unavailable` is ignored (a restart, a lost connection, and the program
    sensors, which the core makes unavailable outside a cycle).
  - The program is the active one, else the selected one; an active program
    seen during the cycle wins (the select may still show the last one).
  - The estimate is `finish time - start`, from the first finish time newer
    than the start.
  - A cycle already running when Filippa first sees it has no start: it
    counts, but its duration is not kept.
  - Stats keep, per program, the estimate, real duration and options of its
    last finished cycle, all from that one cycle.
- `__init__.py`: one `Dishwasher` per entry. It subscribes to the state
  changes first, reads the recorder since its cursor (the time of the last
  state it took in; the first time 30 days back), feeds both in time order
  (stably, so an entity's states keep their order) and then follows live.
  Tracker, stats and cursor are kept in `.storage/filippa.cycles`.
- `sensor.py`: `sensor.<name>_cicli`, linked to the home_connect device with
  `device_entry`. In 2026.9 a `device_info` with home_connect's identifier
  would make a second device owned by Filippa.
- `dashboard.py`: Peppina's approach, a storage-mode Lovelace panel rewritten
  on every load. Roles and option switches follow the registry; roles and
  card options added by hand survive.
- `www/filippa-card.js`: the card. All its texts sit in one table
  (`STRINGS`), for when it learns other languages.

## Verified

- 20 tests of the logic without Home Assistant (`pytest`).
- 10 tests in Home Assistant 2026.9.4 (`pytest-homeassistant-custom-component`):
  - the config flow offers dishwashers only;
  - the sensor lands on the home_connect device;
  - cycles learned live, and from the recorder for those before setup;
  - a restart counts nothing twice and catches up on what happened while
    Filippa was down;
  - a cycle running through a restart keeps its start;
  - the dashboard card, and what the user added to it, survives a rewrite.
- 20 tests of the card in jsdom: tiles, pills, the service calls it makes
  (and that it never sends a delay), the reasons Avvia is off, the states.
- The SVG drawn with rsvg-convert, still frames only.
- The service, entity keys and option fields read from the Home Assistant
  2026.9.4 sources and aiohomeconnect 0.39.1.

## Not verified

- Nothing has run on vjt's Home Assistant, and nothing has been looked at
  in a real browser (animations, layout, iPhone). Headless browsers are
  blocked where this was written.
- The states of a real cycle were not measured: there was no Home Assistant
  token where this was written, so the cycle of 2026-10-11 (auto_2, ending
  17:06) could not be watched. To check on the first real cycle:
  - the operation states and their order (does it pass through `finished`,
    then `ready`/`inactive`?);
  - what `select.*_active_program` shows once the cycle is over;
  - when the finish time sensor first appears after the start;
  - whether option switches stay available during the run.
- Whether `set_program_and_options` is accepted with every option switch the
  card sends (it sends the available ones only, as the core exposes them).
- Whether a program can be selected while the machine is `finished`.

## Rolling back

Remove the Filippa entry (Settings → Devices & services), then the
integration from HACS. The home_connect entities are untouched: Filippa
never writes to them except through the card's taps. The stats live in
`.storage/filippa.cycles`, the page in `.storage/lovelace.filippa`.
