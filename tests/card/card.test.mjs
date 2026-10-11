// The card in jsdom, against the entities of vjt's dishwasher as the core
// home_connect integration names them. jsdom has no layout: how the
// dishwasher looks is not checked here.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";

const here = (path) => new URL(path, import.meta.url);
const source = fs.readFileSync(here("../../custom_components/filippa/www/filippa-card.js"), "utf8");
let failures = 0;
const test = (name, fn) => {
  try { fn(); console.log("ok  ", name); } catch (e) { failures++; console.log("FAIL", name, "\n     ", e.message); }
};

const P = (k) => `dishcare_dishwasher_program_${k}`;
const PROGRAMS = ["eco_50", "auto_2", "intensiv_70", "kurz_60", "quick_45", "glas_40", "night_wash",
  "machine_care", "pre_rinse", "super_60", "intensiv_power", "mixed_load"].map(P);
const ENTITIES = {
  state: "sensor.filippa_operation_state", door: "sensor.filippa_door",
  progress: "sensor.filippa_program_progress", finish: "sensor.filippa_program_finish_time",
  active: "select.filippa_active_program", selected: "select.filippa_selected_program",
  remote: "binary_sensor.filippa_remote_control", remote_start: "binary_sensor.filippa_remote_start",
  connected: "binary_sensor.filippa_connectivity", power: "switch.filippa_power",
  stop: "button.filippa_stop_program", salt: "sensor.filippa_salt_nearly_empty",
  rinse_aid: "sensor.filippa_rinse_aid_nearly_empty", cycles: "sensor.filippa_cicli",
};
const SWITCHES = {
  dishcare_dishwasher_option_intensiv_zone: "switch.filippa_intensive_zone",
  dishcare_dishwasher_option_vario_speed_plus: "switch.filippa_vario_speed",
  dishcare_dishwasher_option_half_load: "switch.filippa_half_load",
  dishcare_dishwasher_option_hygiene_plus: "switch.filippa_hygiene",
  dishcare_dishwasher_option_extra_dry: "switch.filippa_extra_dry",
  dishcare_dishwasher_option_silence_on_demand: "switch.filippa_silence_on_demand",
};
const LEARNED = {
  [P("auto_2")]: { usage: 31, estimate: 155, actual: 152, options: ["dishcare_dishwasher_option_vario_speed_plus"] },
  [P("eco_50")]: { usage: 12, estimate: 235, actual: 235, options: [] },
  [P("quick_45")]: { usage: 4, estimate: null, actual: null, options: [] },
  [P("intensiv_70")]: { usage: 2, estimate: 165, actual: 170, options: [] },
  [P("glas_40")]: { usage: 1, estimate: 110, actual: 108, options: [] },
};

const s = (state, attributes = {}) => ({ state, attributes, last_changed: new Date().toISOString() });

function readyStates(over = {}) {
  return {
    "sensor.filippa_operation_state": s("ready"),
    "sensor.filippa_door": s("closed"),
    "sensor.filippa_program_progress": s("unavailable"),
    "sensor.filippa_program_finish_time": s("unavailable"),
    "select.filippa_active_program": s("unknown", { options: PROGRAMS }),
    "select.filippa_selected_program": s(P("auto_2"), { options: PROGRAMS }),
    "binary_sensor.filippa_remote_control": s("on"),
    "binary_sensor.filippa_remote_start": s("on"),
    "binary_sensor.filippa_connectivity": s("on"),
    "switch.filippa_power": s("on"),
    "button.filippa_stop_program": s("unknown"),
    "sensor.filippa_salt_nearly_empty": s("off"),
    "sensor.filippa_rinse_aid_nearly_empty": s("off"),
    "sensor.filippa_cicli": s("50", { programs: LEARNED }),
    "switch.filippa_intensive_zone": s("off"),
    "switch.filippa_vario_speed": s("on"),
    "switch.filippa_half_load": s("off"),
    "switch.filippa_hygiene": s("unavailable"),
    "switch.filippa_extra_dry": s("off"),
    "switch.filippa_silence_on_demand": s("unavailable"),
    ...over,
  };
}

function runningStates(over = {}) {
  const finish = new Date(Date.now() + 83 * 60000 + 30000);
  return readyStates({
    "sensor.filippa_operation_state": s("run"),
    "sensor.filippa_door": s("locked"),
    "sensor.filippa_program_progress": s("46"),
    "sensor.filippa_program_finish_time": s(finish.toISOString()),
    "select.filippa_active_program": s(P("auto_2"), { options: PROGRAMS }),
    "binary_sensor.filippa_remote_start": s("off"),
    ...over,
  });
}

// Closed at the end: a running cycle keeps the card's clock ticking.
const windows = [];

function mount(states = readyStates(), config = {}) {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: "https://ha.local/filippa" });
  const { window } = dom;
  windows.push(window);
  window.eval(source);
  const calls = [];
  const card = window.document.createElement("filippa-card");
  card.setConfig({ name: "Filippa", device_id: "dev123", entities: ENTITIES, switches: SWITCHES, ...config });
  window.document.body.appendChild(card);
  let current = states;
  const hass = () => ({ states: { ...current }, callService: (d, sv, data) => { calls.push([d, sv, data]); return Promise.resolve(); } });
  card.hass = hass();
  const root = card.shadowRoot;
  const $ = (q) => root.querySelector(q);
  const $$ = (q) => [...root.querySelectorAll(q)];
  const set = (next) => { current = next; card.hass = hass(); };
  // jsdom objects are cross-realm: compare calls through JSON.
  const sent = () => JSON.parse(JSON.stringify(calls));
  const tiles = (box = ".tiles.top") => $$(`${box} .tile`).map((t) => t.querySelector(".tn").textContent);
  return { window, card, root, $, $$, calls, sent, set, tiles };
}

test("ready: the most used programs first, with their duration and count", () => {
  const t = mount();
  assert.equal(t.$(".tlabel").textContent, "Più usati");
  assert.deepEqual(t.tiles(), ["Auto 45–65°", "Eco 50°", "Rapido 45°", "Intensivo 70°"]);
  const meta = t.$$(".tiles.top .tile .tm").map((m) => m.textContent);
  assert.deepEqual(meta, ["≈ 2 h 32 min · 31×", "≈ 3 h 55 min · 12×", "4×", "≈ 2 h 50 min · 2×"]);
  assert.ok(t.$('.tile[data-key="dishcare_dishwasher_program_auto_2"]').classList.contains("sel"));
});

test("ready: status, the machine's display and the description of the program", () => {
  const t = mount();
  assert.equal(t.$(".big").textContent, "Pronta");
  assert.equal(t.$(".small").textContent, "Avvio remoto attivo");
  assert.equal(t.$(".lcd").textContent, "2:32");
  assert.match(t.$(".pdesc").textContent, /Sente quanto sono sporche/);
  assert.equal(t.$(".pnote").textContent,
    "Ultimo lavaggio: 2 h 32 min (la lavastoviglie ne stimava 2 h 35 min), con VarioSpeed");
});

test("a program never finished says its duration is not known yet", () => {
  const t = mount(readyStates({ "select.filippa_selected_program": s(P("quick_45"), { options: PROGRAMS }) }));
  assert.match(t.$(".pnote").textContent, /Durata non ancora nota/);
  assert.equal(t.$(".lcd").textContent, "--:--");
});

test("all programs, grouped, behind one tap", () => {
  const t = mount();
  assert.ok(t.$(".tiles.all").classList.contains("hidden"));
  assert.equal(t.$(".more").textContent, "Tutti i programmi (12)");
  t.$(".more").click();
  assert.ok(!t.$(".tiles.all").classList.contains("hidden"));
  assert.deepEqual(t.$$(".tiles.all .group").map((g) => g.textContent),
    ["Tutti i giorni", "Veloci", "Sporco forte", "Delicati", "Speciali"]);
  assert.equal(t.tiles(".tiles.all").length, 12);
  assert.equal(t.$(".more").textContent, "Meno programmi");
});

test("nothing used yet: the usual programs first", () => {
  const t = mount(readyStates({ "sensor.filippa_cicli": s("0", { programs: {} }) }));
  assert.equal(t.$(".tlabel").textContent, "Programmi");
  assert.deepEqual(t.tiles(), ["Auto 45–65°", "Eco 50°", "Rapido 45°", "Intensivo 70°"]);
});

test("the program on the machine shows even when it is not among the most used", () => {
  const t = mount(readyStates({ "select.filippa_selected_program": s(P("night_wash"), { options: PROGRAMS }) }));
  assert.deepEqual(t.tiles(), ["Auto 45–65°", "Eco 50°", "Rapido 45°", "Intensivo 70°", "Notturno"]);
});

test("a tap on a program selects it on the machine, and waits for it", () => {
  const t = mount();
  t.$('.tile[data-key="dishcare_dishwasher_program_eco_50"]').click();
  assert.deepEqual(t.sent(), [["select", "select_option",
    { entity_id: "select.filippa_selected_program", option: P("eco_50") }]]);
  assert.ok(t.$('.tile[data-key="dishcare_dishwasher_program_eco_50"]').classList.contains("pending"));
  assert.ok(t.$$(".tile").every((tile) => tile.disabled));
  t.set(readyStates({ "select.filippa_selected_program": s(P("eco_50"), { options: PROGRAMS }) }));
  assert.ok(t.$('.tile[data-key="dishcare_dishwasher_program_eco_50"]').classList.contains("sel"));
  assert.ok(!t.$$(".tile").some((tile) => tile.disabled));
});

test("with nothing selected yet, any program can be picked, and Avvia asks for one", () => {
  const t = mount(readyStates({ "select.filippa_selected_program": s("unknown", { options: PROGRAMS }) }));
  assert.ok(t.$$(".tile").every((tile) => !tile.disabled));
  assert.equal(t.$(".tile.sel"), null);
  assert.deepEqual([t.$(".start").disabled, t.$(".why").textContent], [true, "Scegli un programma"]);
  assert.equal(t.$(".pnote").textContent, "");
});

test("options are pills, only those the program allows", () => {
  const t = mount();
  const pills = t.$$(".pill").map((p) => [p.textContent, p.classList.contains("on")]);
  assert.deepEqual(pills, [["Zona intensiva", false], ["VarioSpeed", true], ["Mezzo carico", false],
    ["Extra asciutto", false]]);
  t.$$(".pill")[2].click();
  assert.deepEqual(t.sent(), [["switch", "toggle", { entity_id: "switch.filippa_half_load" }]]);
});

test("Avvia starts the selected program with the options the pills show", () => {
  const t = mount();
  assert.equal(t.$(".start").disabled, false);
  assert.equal(t.$(".why").textContent, "");
  t.$(".start").click();
  assert.deepEqual(t.sent(), [["home_connect", "set_program_and_options", {
    device_id: "dev123", affects_to: "active_program", program: P("auto_2"),
    dishcare_dishwasher_option_intensiv_zone: false,
    dishcare_dishwasher_option_vario_speed_plus: true,
    dishcare_dishwasher_option_half_load: false,
    dishcare_dishwasher_option_extra_dry: false,
  }]]);
  assert.equal(t.$(".start").textContent, "Avvio…");
  assert.equal(t.$(".start").disabled, true);
  t.set(runningStates());
  assert.equal(t.$(".start").textContent, "Avvia");
});

test("no delayed start is ever sent", () => {
  const t = mount(readyStates({ "number.filippa_start_in_relative": s("3600") }));
  t.$(".start").click();
  assert.ok(!Object.keys(t.sent()[0][2]).some((k) => k.includes("start_in")));
});

test("Avvia says why it is off", () => {
  const why = (over) => {
    const t = mount(readyStates(over));
    return [t.$(".start").disabled, t.$(".why").textContent];
  };
  assert.deepEqual(why({ "binary_sensor.filippa_remote_start": s("off") }),
    [true, "Premi Avvio remoto sulla lavastoviglie"]);
  assert.deepEqual(why({ "sensor.filippa_door": s("open") }), [true, "Chiudi lo sportello"]);
  assert.deepEqual(why({ "sensor.filippa_operation_state": s("inactive") }), [true, "Accendi la lavastoviglie"]);
  assert.deepEqual(why({ "sensor.filippa_operation_state": s("unavailable"),
    "binary_sensor.filippa_connectivity": s("off") }), [true, "La lavastoviglie non è raggiungibile"]);
});

test("running: what, until when, how far, on the display and on the floor", () => {
  const t = mount(runningStates());
  assert.equal(t.$(".big").textContent, "Lava");
  assert.match(t.$(".small").textContent, /^Auto 45–65° · finisce alle \d\d:\d\d$/);
  assert.equal(t.$(".lcd").textContent, "1:24");
  assert.equal(t.$(".tl").textContent, "1:24");
  assert.ok(!t.$(".bar").classList.contains("hidden"));
  assert.equal(t.$(".bar > div").style.width, "46%");
  assert.ok(t.$(".wrap").classList.contains("washing"));
  assert.equal(t.$(".start").disabled, true);
  assert.equal(t.$(".why").textContent, "");
  assert.ok(t.$$(".tile").every((tile) => tile.disabled));
  assert.ok(t.$$(".pill").every((pill) => pill.disabled));
});

test("Ferma wants a second tap, then presses home_connect's stop", () => {
  const t = mount(runningStates());
  assert.equal(t.$(".stop").disabled, false);
  t.$(".stop").click();
  assert.equal(t.$(".stop").textContent, "Sicuro? Ferma");
  assert.deepEqual(t.sent(), []);
  t.$(".stop").click();
  assert.deepEqual(t.sent(), [["button", "press", { entity_id: "button.filippa_stop_program" }]]);
  assert.equal(t.$(".stop").textContent, "Ferma");
});

test("Ferma is off when nothing runs", () => {
  const t = mount();
  assert.equal(t.$(".stop").disabled, true);
});

test("finished: done, to be emptied, the door", () => {
  const t = mount(runningStates({ "sensor.filippa_operation_state": s("finished"),
    "sensor.filippa_program_progress": s("100"), "sensor.filippa_door": s("closed") }));
  assert.equal(t.$(".big").textContent, "Finita");
  assert.equal(t.$(".small").textContent, "Da svuotare");
  assert.ok(t.$(".wrap").classList.contains("done"));
  t.set(runningStates({ "sensor.filippa_operation_state": s("finished"), "sensor.filippa_door": s("open") }));
  assert.equal(t.$(".small").textContent, "Sportello aperto");
  assert.ok(t.$(".wrap").classList.contains("open"));
});

test("off and unreachable", () => {
  const off = mount(readyStates({ "sensor.filippa_operation_state": s("inactive") }));
  assert.equal(off.$(".big").textContent, "Filippa dorme");
  const away = mount(readyStates({ "sensor.filippa_operation_state": s("unavailable"),
    "binary_sensor.filippa_connectivity": s("off") }));
  assert.equal(away.$(".big").textContent, "Non raggiungibile");
  assert.ok(away.$$(".chip").some((c) => c.textContent === "Non connessa"));
});

test("salt and rinse aid running low are warnings", () => {
  const t = mount(readyStates({ "sensor.filippa_salt_nearly_empty": s("present"),
    "sensor.filippa_rinse_aid_nearly_empty": s("present") }));
  assert.deepEqual(t.$$(".chip.warn").map((c) => c.textContent), ["Sale quasi finito", "Brillantante quasi finito"]);
});

test("unknown programs of other models get a readable name, under Altri", () => {
  const options = [...PROGRAMS, P("steam_fresh")];
  const t = mount(readyStates({ "select.filippa_selected_program": s(P("auto_2"), { options }) }));
  t.$(".more").click();
  const groups = t.$$(".tiles.all .group").map((g) => g.textContent);
  assert.equal(groups.at(-1), "Altri");
  assert.ok(t.tiles(".tiles.all").includes("Steam fresh"));
});

test("a failed call stops the waiting", async () => {
  const t = mount();
  t.card.hass = { states: readyStates(), callService: () => Promise.reject(new Error("no")) };
  t.$(".start").click();
  assert.equal(t.$(".start").textContent, "Avvio…");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(t.$(".start").textContent, "Avvia");
});

await new Promise((r) => setTimeout(r, 20));
for (const window of windows) window.close();
if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
