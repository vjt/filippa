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
  - The operation state turning `unavailable` mid-cycle, then anything
    other than a running state: the end was not seen, the outcome is
    `unknown` (a use, no duration).
  - Stats keep, per program, the estimate, real duration and options of its
    last finished cycle, all from that one cycle.
  - The log keeps the cycles seen whole: a start, an end seen as it
    happened, at least a minute between them (the machine flickers run,
    ready, run as a program starts: those are not washes). The last 365
    days, 1000 at most, deduplicated by their end (one second apart at
    most: the recorder gives timestamps back a microsecond off).
- `__init__.py`: one `Dishwasher` per entry. It subscribes to the state
  changes first, reads the recorder since its cursor (the time of the last
  state it took in), feeds both in time order (stably, so an entity's
  states keep their order) and then follows live. With an empty log (the
  first time, or after the update to 0.3) it reads a year back instead and
  replays it with a tracker of its own, into the log only: the stats count
  only what comes after the cursor, as before, and a cycle both replayed
  and fed is logged once. A window that opens mid-cycle leaves that cycle
  out (no start). Tracker, stats, log and cursor are kept in
  `.storage/filippa.cycles`. The `filippa/cycles` websocket command returns
  a dishwasher's log, newest first.
- `sensor.py`: `sensor.<name>_cicli`, linked to the home_connect device with
  `device_entry`. In 2026.9 a `device_info` with home_connect's identifier
  would make a second device owned by Filippa. `recent` (the last six
  cycles of the log) is left out of the recorder.
- `dashboard.py`: Peppina's approach, a storage-mode Lovelace panel rewritten
  on every load. Roles and option switches follow the registry; roles and
  card options added by hand survive. Each dishwasher also gets a subview
  (no tab, a back arrow) with `custom:filippa-cycles-card`, the history
  page; the main card links to it through `history_path`.
- `www/filippa-card.js`: the card, and the history page's card. All
  their texts sit in one table per language (`STRINGS.it`, `STRINGS.en`),
  picked from the user's profile: Italian for Italian, English for any
  other.

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
- 0.2.0, English: 6 more card tests (the texts in English, 12 or 24 hours,
  the fallback for other languages, a change of language in the profile)
  and 3 more in Home Assistant 2026.10.4 (the sensor's name in English,
  Italian and a language Filippa lacks).
- 0.3.0, cycle history: tests of the tracker's unseen ends and of the log
  (order, what it leaves out, once per cycle, a year and a thousand at
  most), of the log rebuilt from ten days of a real dishwasher's recorder
  history (anonymised: parts instead of entity ids, every timestamp moved
  by one offset; `tests/fixtures/history.json`), in Home Assistant 2026.2.3
  (`recent`, the websocket command, the subview, a year back, an update
  rebuilding the log without counting twice, again and again), and of both
  cards in jsdom. Replayed over the real recorder (43 days at the time),
  the tracker closes the same 43 cycles the live stats counted; the log
  keeps 40 of them, leaving out three start flickers.
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
