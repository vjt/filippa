# Filippa

**A Home Assistant card for a Bosch (Home Connect) dishwasher: pick a
program in plain Italian, toggle its options, start it, stop it, and watch it
wash.**

[![HACS custom repository](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories/)

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=vjt&repository=filippa&category=integration)

Filippa is [Peppina](https://github.com/vjt/peppina)'s sister, for the
dishwasher. Bosch, Siemens, Neff and Gaggenau appliances already reach Home
Assistant through the core **Home Connect** integration, which gets every
change pushed by the cloud. What it does not give you is a way to use them:
twelve program keys like `dishcare_dishwasher_program_kurz_60`, a pile of
option switches that come and go with the program, and a start service you
have to fill in by hand.

Filippa adds no cloud client and no polling. It sits on top of the
home_connect entities: it learns from their states how often each program
runs and how long it really takes, and it gives the dishwasher a full-page
card. Everything the card does goes through home_connect's own entities and
services.

## What you get

### The card

A **Filippa** sidebar dashboard, one full-page card per dishwasher:

- the dishwasher drawn in SVG: while it washes the spray arms turn, water
  fans out of them, steam rises, and the remaining time shows on its display
  and on the floor, like Bosch's TimeLight; when it is done the dishes
  sparkle; the door drops open when you open it;
- the programs under Italian names with a line on what each is for, the
  most used first (all of them, grouped, one tap away), each with how long
  it took last time and how often it ran;
- the options the selected program allows, as pills (Zona intensiva,
  VarioSpeed, Mezzo carico, Igiene+, Extra asciutto, Silenzio);
- **Avvia**, and **Ferma** (it asks for a second tap: a cycle stopped by
  mistake leaves wet, dirty dishes);
- why Avvia is off when it is ("Premi Avvio remoto sulla lavastoviglie",
  "Chiudi lo sportello", ...), and warnings for salt and rinse aid running
  low.

Picking a program selects it on the machine (`select.*_selected_program`),
so the machine shows it and offers its options; a pill toggles the option
switch; Avvia calls `home_connect.set_program_and_options` with
`affects_to: active_program`, the program and the options as the pills show
them. Filippa never sends a delayed start.

### One sensor

`sensor.<dishwasher>_cicli`, on the home_connect device: how many cycles
Filippa has seen, with these attributes:

- `programs`: per program key, `usage` (cycles started), `estimate` (what the
  machine expected at the start, minutes), `actual` (how long the last
  finished cycle took) and `options` (those it ran with);
- `last`: the last cycle: program, start, end, estimate, real duration,
  options, `finished` or `interrupted`.

A cycle starts when the operation state turns to `run` and ends at
`finished` (with its real duration) or at anything else that is not a pause
(interrupted: it counts as a use, but teaches no duration). Filippa follows
the states live, and on every start it catches up on the recorder since the
last state it took in: the first time, up to 30 days back, as far as the recorder
goes (10 days by default), so the card knows your habits from day one.

### What you can build on it

A push when she is done, only to whoever is home: the YAML is in
[docs/automations.md](docs/automations.md).

## Install

1. Set up the core Home Connect integration first, with the dishwasher in it.
2. With HACS: use the button above (or add `https://github.com/vjt/filippa`
   as a custom repository, type Integration), then download Filippa. Without
   HACS: copy `custom_components/filippa` into your `custom_components/`.
3. Restart Home Assistant.
4. Settings → Devices & services → Add integration → Filippa, and pick the
   dishwasher.

To start it from Home Assistant, press the remote start button on the
dishwasher first, as for the Home Connect app.

The integration ships its own icon (`custom_components/filippa/brand/`).

## Development

- `pytest` (the cycle logic, no Home Assistant needed)
- `pip install pytest-homeassistant-custom-component`, then
  `pytest -c tests/ha/pytest.ini tests/ha` (flow, setup, recorder, dashboard)
- `cd tests/card && npm install && npm test` (the card, in jsdom)

## License

MIT
