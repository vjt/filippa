// The card in jsdom, against the entities of vjt's dishwasher as the core
// home_connect integration names them. jsdom has no layout: how the
// dishwasher looks is not checked here.
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";

// Dates and times of the cycles are the browser's local ones: fixed here.
process.env.TZ = "UTC";

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

const O = (k) => `dishcare_dishwasher_option_${k}`;
// The last cycles, newest first, as the cycles sensor gives them.
const RECENT = [
  { program: P("quick_45"), started: "2026-10-07T17:06:26+00:00", ended: "2026-10-07T17:47:38+00:00",
    estimate: 29, actual: 41, options: [], outcome: "finished" },
  { program: P("super_60"), started: "2026-10-06T06:49:53+00:00", ended: "2026-10-06T09:24:05+00:00",
    estimate: 158, actual: 154, options: [O("hygiene_plus"), O("intensiv_zone")], outcome: "finished" },
  { program: P("kurz_60"), started: "2026-10-05T13:52:47+00:00", ended: "2026-10-05T15:33:33+00:00",
    estimate: 125, actual: null, options: [], outcome: "interrupted" },
  { program: P("eco_50"), started: "2026-10-03T18:01:07+00:00", ended: "2026-10-03T22:32:59+00:00",
    estimate: 270, actual: 272, options: [], outcome: "finished" },
  { program: P("intensiv_70"), started: "2026-09-29T19:03:12+00:00", ended: "2026-09-29T22:01:25+00:00",
    estimate: 180, actual: 178, options: [O("extra_dry")], outcome: "finished" },
  { program: P("auto_2"), started: "2026-09-28T13:25:16+00:00", ended: "2026-09-28T16:00:11+00:00",
    estimate: 160, actual: 155, options: [], outcome: "finished" },
];

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
    "sensor.filippa_cicli": s("50", { programs: LEARNED, recent: RECENT }),
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

// What hass says of the user's language: Italian unless a test says otherwise.
const ITALIAN = { locale: { language: "it", time_format: "language" } };
const ENGLISH = { locale: { language: "en", time_format: "language" } };

function mount(states = readyStates(), config = {}, i18n = ITALIAN) {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: "https://ha.local/filippa" });
  const { window } = dom;
  windows.push(window);
  window.eval(source);
  const calls = [];
  const card = window.document.createElement("filippa-card");
  card.setConfig({
    name: "Filippa", device_id: "dev123", entities: ENTITIES, switches: SWITCHES,
    history_path: "/filippa/cycles", ...config,
  });
  window.document.body.appendChild(card);
  let current = states;
  let lang = i18n;
  const hass = () => ({ ...lang, states: { ...current }, callService: (d, sv, data) => { calls.push([d, sv, data]); return Promise.resolve(); } });
  card.hass = hass();
  const root = card.shadowRoot;
  const $ = (q) => root.querySelector(q);
  const $$ = (q) => [...root.querySelectorAll(q)];
  const set = (next) => { current = next; card.hass = hass(); };
  // The user switches language in their profile.
  const speak = (next) => { lang = next; card.hass = hass(); };
  // jsdom objects are cross-realm: compare calls through JSON.
  const sent = () => JSON.parse(JSON.stringify(calls));
  const tiles = (box = ".tiles.top") => $$(`${box} .tile`).map((t) => t.querySelector(".tn").textContent);
  return { window, card, root, $, $$, calls, sent, set, speak, tiles };
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
  t.card.hass = { ...ITALIAN, states: readyStates(), callService: () => Promise.reject(new Error("no")) };
  t.$(".start").click();
  assert.equal(t.$(".start").textContent, "Avvio…");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(t.$(".start").textContent, "Avvia");
});

test("in English: the programs, their groups and the options", () => {
  const t = mount(readyStates(), {}, ENGLISH);
  assert.equal(t.$(".tlabel").textContent, "Most used");
  assert.deepEqual(t.tiles(), ["Auto 45–65°", "Eco 50°", "Quick 45°", "Intensive 70°"]);
  assert.match(t.$(".pdesc").textContent, /^Feels how dirty the dishes are/);
  assert.equal(t.$(".pnote").textContent,
    "Last wash: 2 h 32 min (the dishwasher reckoned 2 h 35 min), with VarioSpeed");
  assert.equal(t.$(".more").textContent, "All programs (12)");
  t.$(".more").click();
  assert.deepEqual(t.$$(".tiles.all .group").map((g) => g.textContent),
    ["Everyday", "Quick", "Heavy soiling", "Delicate", "Special"]);
  assert.equal(t.$(".more").textContent, "Fewer programs");
  assert.equal(t.$(".optbox .label").textContent, "Options");
  assert.deepEqual(t.$$(".pill").map((p) => p.textContent),
    ["Intensive zone", "VarioSpeed", "Half load", "Extra dry"]);
  assert.equal(t.$$(".pill")[2].title, "For a few plates: less water and energy.");
});

test("in English: Filippa says how she is", () => {
  const said = (states) => {
    const t = mount(states, {}, ENGLISH);
    return [t.$(".big").textContent, t.$(".small").textContent];
  };
  assert.deepEqual(said(readyStates()), ["Ready", "Remote start on"]);
  assert.deepEqual(said(readyStates({ "sensor.filippa_operation_state": s("inactive") })),
    ["Filippa is napping", "Switched off"]);
  assert.deepEqual(said(readyStates({ "sensor.filippa_operation_state": s("unavailable"),
    "binary_sensor.filippa_connectivity": s("off") })), ["Out of reach", "Home Connect can't hear her"]);
  assert.deepEqual(said(runningStates({ "sensor.filippa_operation_state": s("finished"),
    "sensor.filippa_door": s("closed") })), ["All done", "Waiting to be emptied"]);
  assert.deepEqual(said(runningStates({ "sensor.filippa_operation_state": s("actionrequired") })),
    ["Needs a hand", "Check the dishwasher's display"]);
  const [big, small] = said(runningStates());
  assert.equal(big, "Washing");
  assert.match(small, /^Auto 45–65° · finishes at \d\d:\d\d [AP]M$/);
});

test("in English: Start and Stop, and why Start is off", () => {
  const t = mount(runningStates(), {}, ENGLISH);
  assert.equal(t.$(".stop").textContent, "Stop");
  t.$(".stop").click();
  assert.equal(t.$(".stop").textContent, "Sure? Stop");
  const why = (over) => mount(readyStates(over), {}, ENGLISH).$(".why").textContent;
  assert.equal(why({ "binary_sensor.filippa_remote_start": s("off") }), "Press Remote Start on the dishwasher");
  assert.equal(why({ "sensor.filippa_door": s("open") }), "Close the door");
  assert.equal(why({ "sensor.filippa_operation_state": s("inactive") }), "Switch the dishwasher on");
  assert.equal(why({ "select.filippa_selected_program": s("unknown", { options: PROGRAMS }) }), "Pick a program");
  const ready = mount(readyStates({ "sensor.filippa_salt_nearly_empty": s("present"),
    "sensor.filippa_rinse_aid_nearly_empty": s("present") }), {}, ENGLISH);
  assert.deepEqual(ready.$$(".chip.warn").map((c) => c.textContent), ["Almost out of salt", "Almost out of rinse aid"]);
  assert.equal(ready.$(".start").textContent, "Start");
  ready.$(".start").click();
  assert.equal(ready.$(".start").textContent, "Starting…");
  const quick = mount(readyStates({ "select.filippa_selected_program": s(P("quick_45"), { options: PROGRAMS }) }), {}, ENGLISH);
  assert.equal(quick.$(".pnote").textContent, "Duration not known yet: she learns it from the first wash");
});

test("in English: times follow the profile, 12 or 24 hours", () => {
  const small = (time_format) =>
    mount(runningStates(), {}, { locale: { language: "en", time_format } }).$(".small").textContent;
  assert.match(small("12"), /finishes at \d\d:\d\d [AP]M$/);
  assert.match(small("24"), /finishes at \d\d:\d\d$/);
  // The machine's display keeps its own clock.
  assert.equal(mount(runningStates(), {}, { locale: { language: "en", time_format: "12" } }).$(".lcd").textContent, "1:24");
});

test("Italian for any Italian, English for any other language, or none", () => {
  const big = (i18n) => mount(readyStates(), {}, i18n).$(".big").textContent;
  assert.equal(big({ locale: { language: "it-CH" } }), "Pronta");
  assert.equal(big({ language: "it" }), "Pronta");  // hass.language alone, no locale
  assert.equal(big({ locale: { language: "en-GB" } }), "Ready");
  assert.equal(big({ locale: { language: "fr" } }), "Ready");
  assert.equal(big({ locale: { language: "ita" } }), "Ready");
  assert.equal(big({}), "Ready");
});

test("a change of language in the profile rebuilds the card in it", () => {
  const t = mount();
  assert.equal(t.$(".start").textContent, "Avvia");
  t.speak(ENGLISH);
  assert.equal(t.$(".start").textContent, "Start");
  assert.equal(t.$(".optbox .label").textContent, "Options");
  assert.equal(t.$(".big").textContent, "Ready");
  assert.deepEqual(t.tiles(), ["Auto 45–65°", "Eco 50°", "Quick 45°", "Intensive 70°"]);
  t.$('.tile[data-key="dishcare_dishwasher_program_eco_50"]').click();
  assert.equal(t.sent().pop()[2].option, P("eco_50"));
  t.speak(ITALIAN);
  assert.equal(t.$(".big").textContent, "Pronta");
});

const text = (node) => [...node.querySelectorAll(".cname, .cdur, .chip, .cwhen")].map((n) => n.textContent);

test("the last cycle, in evidence: what, when, how long, with what, how it ended", () => {
  const t = mount();
  assert.ok(!t.$(".cyclebox").classList.contains("hidden"));
  assert.equal(t.$(".cyclebox .label").textContent, "Ultimo ciclo");
  assert.deepEqual(text(t.$(".lastc")), ["Rapido 45°", "Finito", "mer 7 ott · 17:06–17:47", "41 min"]);
});

test("the cycles before it, in a short list that scrolls", () => {
  const t = mount();
  assert.equal(t.$(".before").textContent, "Prima");
  const rows = t.$$(".clist .cycle");
  assert.equal(rows.length, 5);
  assert.deepEqual(text(rows[0]), ["Super 60°", "2 h 34 min", "mar 6 ott · 06:49–09:24 · Igiene+, Zona intensiva"]);
  assert.deepEqual(text(rows[1]), ["Rapido 60°", "fermato dopo 1 h 41 min", "lun 5 ott · 13:52–15:33"]);
  assert.ok(rows[1].classList.contains("stopped"));
  assert.ok(!rows[0].classList.contains("stopped"));
});

test("an interrupted last cycle says so", () => {
  const recent = [RECENT[2], ...RECENT.slice(3)];
  const t = mount(readyStates({ "sensor.filippa_cicli": s("50", { programs: LEARNED, recent }) }));
  assert.deepEqual(text(t.$(".lastc")), ["Rapido 60°", "Interrotto", "lun 5 ott · 13:52–15:33", "fermato dopo 1 h 41 min"]);
  assert.ok(t.$(".lastc .chip").classList.contains("warn"));
});

test("Tutti i cicli opens the history page inside the frontend", () => {
  const t = mount();
  const changes = [];
  t.window.addEventListener("location-changed", () => changes.push(t.window.location.pathname));
  assert.equal(t.$(".allc").textContent, "Tutti i cicli");
  t.$(".allc").click();
  assert.equal(t.window.location.pathname, "/filippa/cycles");
  assert.deepEqual(changes, ["/filippa/cycles"]);
});

test("no cycles yet, or an older Filippa: no cycle box; no page: no link", () => {
  const none = mount(readyStates({ "sensor.filippa_cicli": s("0", { programs: {} }) }));
  assert.ok(none.$(".cyclebox").classList.contains("hidden"));
  const alone = mount(readyStates({ "sensor.filippa_cicli": s("1", { programs: LEARNED, recent: RECENT.slice(0, 1) }) }),
    { history_path: undefined });
  assert.ok(!alone.$(".cyclebox").classList.contains("hidden"));
  assert.ok(alone.$(".before").classList.contains("hidden"));
  assert.ok(alone.$(".allc").classList.contains("hidden"));
});

test("the list is drawn again only when the cycles change, so it keeps its scroll", () => {
  const t = mount();
  const row = t.$(".clist .cycle");
  t.set(runningStates());
  assert.equal(t.$(".clist .cycle"), row);
  const recent = [{ ...RECENT[0], ended: "2026-10-08T10:00:00+00:00", started: "2026-10-08T09:00:00+00:00" }, ...RECENT];
  t.set(readyStates({ "sensor.filippa_cicli": s("51", { programs: LEARNED, recent }) }));
  assert.notEqual(t.$(".clist .cycle"), row);
  assert.equal(t.$$(".clist .cycle").length, 6);
});

test("in English: the last cycle and the ones before", () => {
  const t = mount(readyStates(), {}, ENGLISH);
  assert.deepEqual(t.$$(".cyclebox .label").map((l) => l.textContent), ["Last cycle", "Before that"]);
  assert.deepEqual(text(t.$(".lastc")), ["Quick 45°", "Finished", "Wed, Oct 7 · 05:06 PM–05:47 PM", "41 min"]);
  assert.deepEqual(text(t.$$(".clist .cycle")[1]),
    ["Quick 60°", "stopped after 1 h 41 min", "Mon, Oct 5 · 01:52 PM–03:33 PM"]);
  assert.equal(t.$(".allc").textContent, "All cycles");
  t.speak({ locale: { language: "en", time_format: "24" } });
  assert.deepEqual(text(t.$(".lastc"))[2], "Wed, Oct 7 · 17:06–17:47");
});

// The history page.
function mountCycles({ reply = Promise.resolve({ cycles: RECENT }), i18n = ITALIAN, config = {} } = {}) {
  const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: "https://ha.local/filippa/cycles" });
  const { window } = dom;
  windows.push(window);
  window.eval(source);
  const asked = [];
  let answer = reply;
  const card = window.document.createElement("filippa-cycles-card");
  card.setConfig({ name: "Filippa", device_id: "dev123", entities: { cycles: "sensor.filippa_cicli" }, ...config });
  window.document.body.appendChild(card);
  let sensor = { state: "50", attributes: {}, last_updated: "2026-10-07T17:47:38+00:00" };
  let lang = i18n;
  const hass = () => ({
    ...lang, states: { "sensor.filippa_cicli": sensor, "sensor.other": s(String(Math.random())) },
    callWS: (msg) => { asked.push(JSON.parse(JSON.stringify(msg))); return answer; },
  });
  card.hass = hass();
  const $ = (q) => card.shadowRoot.querySelector(q);
  const $$ = (q) => [...card.shadowRoot.querySelectorAll(q)];
  return {
    card, $, $$, asked,
    poke: () => { card.hass = hass(); },
    cycleEnds: (next) => { answer = next; sensor = { ...sensor, state: "51", last_updated: "2026-10-08T10:00:00+00:00" }; card.hass = hass(); },
    speak: (next) => { lang = next; card.hass = hass(); },
  };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

await (async () => {
  const t = mountCycles();
  assert.equal(t.$(".note").textContent, "Leggo i cicli…");
  await settle();
  test("history page: every cycle kept, newest first, by month", () => {
    assert.deepEqual(t.asked, [{ type: "filippa/cycles", device_id: "dev123" }]);
    assert.equal(t.$("h1").textContent, "I cicli di Filippa");
    assert.equal(t.$(".count").textContent, "6 cicli");
    assert.equal(t.$(".note").textContent, "");
    assert.deepEqual(t.$$(".month").map((m) => m.textContent), ["Ottobre 2026", "Settembre 2026"]);
    assert.deepEqual(t.$$(".cycle .cname").map((n) => n.textContent),
      ["Rapido 45°", "Super 60°", "Rapido 60°", "Eco 50°", "Intensivo 70°", "Auto 45–65°"]);
    assert.deepEqual(text(t.$$(".cycle")[2]), ["Rapido 60°", "fermato dopo 1 h 41 min", "lun 5 ott · 13:52–15:33"]);
  });
  t.poke();
  t.cycleEnds(Promise.resolve({ cycles: [{ ...RECENT[0], started: "2026-11-01T09:00:00+00:00", ended: "2026-11-01T10:00:00+00:00", actual: 60 }, ...RECENT] }));
  await settle();
  test("history page: read again when a cycle ends, not on every update", () => {
    assert.equal(t.asked.length, 2);
    assert.equal(t.$(".count").textContent, "7 cicli");
    assert.equal(t.$(".month").textContent, "Novembre 2026");
  });
  t.speak(ENGLISH);
  test("history page: in English, without reading again", () => {
    assert.equal(t.asked.length, 2);
    assert.equal(t.$("h1").textContent, "Filippa's cycles");
    assert.equal(t.$(".count").textContent, "7 cycles");
    assert.deepEqual(t.$$(".month").map((m) => m.textContent), ["November 2026", "October 2026", "September 2026"]);
  });

  const empty = mountCycles({ reply: Promise.resolve({ cycles: [] }) });
  const broken = mountCycles({ reply: Promise.reject(new Error("no")), i18n: ENGLISH });
  await settle();
  test("history page: nothing yet, or nothing readable", () => {
    assert.equal(empty.$(".note").textContent, "Ancora nessun ciclo");
    assert.equal(empty.$(".count").textContent, "0 cicli");
    assert.equal(broken.$(".note").textContent, "Couldn't read the cycles");
  });
})();

await new Promise((r) => setTimeout(r, 20));
for (const window of windows) window.close();
if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
