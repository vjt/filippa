// Filippa card: the dishwasher itself, full page, with its controls.
//
// Served by the integration (see dashboard.py) and dropped into the Filippa
// dashboard. Everything it shows comes from the core home_connect entities,
// plus Filippa's cycles sensor; everything it does goes through them:
//   type: custom:filippa-card
//   name: Filippa
//   device_id: <home_connect device>
//   entities: {state: sensor.filippa_operation_state, selected: select..., ...}
//   switches: {dishcare_dishwasher_option_half_load: switch.filippa_half_load, ...}
// Missing roles are simply not shown.

// Every text the card shows, in one table: the card speaks Italian only,
// until it learns other languages.
const STRINGS = {
  programs: {
    dishcare_dishwasher_program_auto_1: {
      name: "Auto 35–45°",
      description: "Sente quanto sono sporche le stoviglie e regola da sé acqua, temperatura e durata. Per lo sporco leggero.",
    },
    dishcare_dishwasher_program_auto_2: {
      name: "Auto 45–65°",
      description: "Sente quanto sono sporche le stoviglie e regola da sé acqua, temperatura e durata. Va bene quasi sempre.",
    },
    dishcare_dishwasher_program_auto_3: {
      name: "Auto 65–75°",
      description: "Sente quanto sono sporche le stoviglie e regola da sé acqua, temperatura e durata. Per lo sporco forte.",
    },
    dishcare_dishwasher_program_eco_50: {
      name: "Eco 50°",
      description: "Il più parsimonioso in acqua ed energia, per lo sporco di tutti i giorni. Ci mette tanto: è così che risparmia.",
    },
    dishcare_dishwasher_program_mixed_load: {
      name: "Carico misto",
      description: "Pentole e piatti sotto, bicchieri sopra: forte nel cestello di sotto, delicato in quello di sopra.",
    },
    dishcare_dishwasher_program_night_wash: {
      name: "Notturno",
      description: "Il più silenzioso, per lavare mentre si dorme. Più lungo degli altri.",
    },
    dishcare_dishwasher_program_quick_45: {
      name: "Rapido 45°",
      description: "Per stoviglie appena usate e poco sporche. Il più breve.",
    },
    dishcare_dishwasher_program_kurz_60: {
      name: "Rapido 60°",
      description: "Breve ma più caldo, per lo sporco leggero o normale.",
    },
    dishcare_dishwasher_program_super_60: {
      name: "Super 60°",
      description: "Lo sporco di tutti i giorni in meno tempo dell'Eco, consumando un po' di più.",
    },
    dishcare_dishwasher_program_intensiv_70: {
      name: "Intensivo 70°",
      description: "Pentole, teglie e sporco incrostato o bruciato.",
    },
    dishcare_dishwasher_program_intensiv_power: {
      name: "Intensivo Power",
      description: "Il più energico, per lo sporco più ostinato.",
    },
    dishcare_dishwasher_program_glas_40: {
      name: "Bicchieri 40°",
      description: "Delicato, per bicchieri e stoviglie fragili.",
    },
    dishcare_dishwasher_program_pre_rinse: {
      name: "Prelavaggio",
      description: "Solo un risciacquo freddo: tiene morbido lo sporco finché la lavastoviglie non è piena.",
    },
    dishcare_dishwasher_program_machine_care: {
      name: "Cura macchina",
      description: "Pulisce la lavastoviglie stessa: va fatto a vuoto, con il prodotto per la cura.",
    },
  },
  // Groups in the order the card lists them; programs not listed go in "others".
  groups: [
    ["Tutti i giorni", ["auto_2", "auto_1", "auto_3", "eco_50", "mixed_load", "night_wash"]],
    ["Veloci", ["quick_45", "kurz_60", "super_60"]],
    ["Sporco forte", ["intensiv_70", "intensiv_power"]],
    ["Delicati", ["glas_40"]],
    ["Speciali", ["pre_rinse", "machine_care"]],
  ],
  switches: {
    dishcare_dishwasher_option_intensiv_zone: {
      name: "Zona intensiva", description: "Più forza nel cestello di sotto, per le pentole.",
    },
    dishcare_dishwasher_option_vario_speed_plus: {
      name: "VarioSpeed", description: "Finisce molto prima, consumando un po' di più.",
    },
    dishcare_dishwasher_option_half_load: {
      name: "Mezzo carico", description: "Per pochi piatti: meno acqua ed energia.",
    },
    dishcare_dishwasher_option_hygiene_plus: {
      name: "Igiene+", description: "Risciacquo finale più caldo, per taglieri e biberon.",
    },
    dishcare_dishwasher_option_extra_dry: {
      name: "Extra asciutto", description: "Più calore alla fine: esce più asciutto, plastica compresa.",
    },
    dishcare_dishwasher_option_silence_on_demand: {
      name: "Silenzio", description: "Più piano per un po', quando serve silenzio.",
    },
    dishcare_dishwasher_option_brilliance_dry: {
      name: "Brillantezza", description: "Asciugatura che lascia i bicchieri più brillanti.",
    },
    dishcare_dishwasher_option_eco_dry: {
      name: "Asciugatura Eco", description: "Apre lo sportello alla fine, per asciugare consumando meno.",
    },
    dishcare_dishwasher_option_zeolite_dry: {
      name: "Zeolite", description: "Asciugatura con la zeolite.",
    },
  },
  others: "Altri",
  program: "Programma",
  mostUsed: "Più usati",
  firstChoices: "Programmi",
  allPrograms: (n) => `Tutti i programmi (${n})`,
  fewerPrograms: "Meno programmi",
  options: "Opzioni",
  start: "Avvia",
  starting: "Avvio…",
  stop: "Ferma",
  stopSure: "Sicuro? Ferma",
  sleeps: (name) => `${name} dorme`,
  off: "Spenta",
  unreachable: "Non raggiungibile",
  unreachableNote: "Home Connect non la sente",
  ready: "Pronta",
  remoteOn: "Avvio remoto attivo",
  states: {
    delayedstart: "Avvio programmato",
    run: "Lava",
    pause: "In pausa",
    actionrequired: "Serve una mano",
    finished: "Finita",
    error: "Errore",
    aborting: "Si ferma…",
  },
  checkDisplay: "Guarda il display della lavastoviglie",
  doorOpen: "Sportello aperto",
  toEmpty: "Da svuotare",
  ends: (time) => `finisce alle ${time}`,
  progress: (pct) => `${pct}%`,
  salt: "Sale quasi finito",
  rinseAid: "Brillantante quasi finito",
  disconnected: "Non connessa",
  // Why Avvia is off, the first that applies.
  why: {
    unreachable: "La lavastoviglie non è raggiungibile",
    off: "Accendi la lavastoviglie",
    door: "Chiudi lo sportello",
    remote: "Premi Avvio remoto sulla lavastoviglie",
    program: "Scegli un programma",
  },
  times: (n) => `${n}×`,
  duration: (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
  },
  estimate: (minutes) => `≈ ${STRINGS.duration(minutes)}`,
  // How long the program took last time, and what the machine expected.
  durationNote: ({ actual, estimate, options }) => {
    const names = (options || []).map((o) => (STRINGS.switches[o] || {}).name || o);
    const said = estimate && estimate !== actual
      ? ` (la lavastoviglie ne stimava ${STRINGS.duration(estimate)})` : "";
    const withs = names.length ? `, con ${names.join(" e ")}` : "";
    return `Ultimo lavaggio: ${STRINGS.duration(actual)}${said}${withs}`;
  },
  noDuration: "Durata non ancora nota: la impara dal primo lavaggio",
};
const PROGRAM_PREFIX = "dishcare_dishwasher_program_";
const MOST_USED = 4;
// Shown first while nothing has been used yet.
const FIRST_CHOICES = ["auto_2", "eco_50", "quick_45", "intensiv_70"].map((k) => PROGRAM_PREFIX + k);
// Operation states a cycle goes on through.
const BUSY = new Set(["delayedstart", "run", "pause", "actionrequired", "aborting"]);
const STOPPABLE = new Set(["delayedstart", "run", "pause", "actionrequired"]);
// How long a pick or a start waits for the machine before giving up.
const PENDING_MS = 15000;

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const hhmm = (d) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const pretty = (key) => {
  const words = key.replace(PROGRAM_PREFIX, "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const programName = (key) => (STRINGS.programs[key] || {}).name || pretty(key);
const minutesOf = (d) => (d ? d.actual || d.estimate : undefined);

const STYLE = `
  :host { display: block; height: 100%; }
  .wrap {
    min-height: calc(100vh - var(--header-height, 56px));
    box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 20px; padding: 16px;
    background: radial-gradient(ellipse at 50% 30%, var(--fl-glow) 0%, transparent 60%),
                var(--primary-background-color);
    --fl-glow: rgba(80, 160, 255, 0.10);
    font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
    color: var(--primary-text-color);
  }
  .wrap.washing { --fl-glow: rgba(80, 160, 255, 0.30); }
  .wrap.done { --fl-glow: rgba(120, 230, 170, 0.25); }
  .wrap.error { --fl-glow: rgba(255, 80, 80, 0.25); }

  .stage { width: min(72vw, 52vh, 460px); position: relative; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }

  .machine { transform-origin: 50% 100%; transform-box: fill-box; }
  .washing .machine { animation: hum 0.25s linear infinite; }
  @keyframes hum { 50% { transform: translateY(0.6px); } }

  .inside { opacity: 0.55; transition: opacity 0.8s ease; }
  .washing .inside, .open .inside, .done .inside { opacity: 1; }
  .glow { opacity: 0; transition: opacity 0.8s ease; }
  .washing .glow { opacity: 1; }

  .arm { transform-box: fill-box; transform-origin: center; }
  .washing .arm { animation: rotor 1.1s linear infinite; }
  .washing .arm.up { animation-duration: 1.5s; animation-direction: reverse; }
  @keyframes rotor {
    0%, 50%, 100% { transform: scaleX(1); }
    25%, 75% { transform: scaleX(0.12); }
  }

  .jet { opacity: 0; }
  .washing .jet { animation: jet 1.2s ease-out infinite; }
  .jet:nth-of-type(2n) { animation-delay: 0.3s !important; }
  .jet:nth-of-type(3n) { animation-delay: 0.6s !important; }
  .jet:nth-of-type(5n) { animation-delay: 0.9s !important; }
  @keyframes jet {
    0% { opacity: 0; transform: translateY(0); }
    15% { opacity: 0.9; }
    100% { opacity: 0; transform: translateY(-70px); }
  }
  .washing .jet.down { animation-name: jetdown; }
  @keyframes jetdown {
    0% { opacity: 0; transform: translateY(0); }
    15% { opacity: 0.9; }
    100% { opacity: 0; transform: translateY(60px); }
  }

  .spray { opacity: 0; stroke-dasharray: 4 12; }
  .washing .spray { opacity: 0.55; animation: spray 0.5s linear infinite; }
  .spray:nth-of-type(2n) { animation-duration: 0.65s; }
  .spray:nth-of-type(3n) { animation-duration: 0.8s; }
  @keyframes spray { to { stroke-dashoffset: -32; } }

  .sump { transform: translateY(30px); transition: transform 1.2s ease; }
  .washing .sump { transform: translateY(0); }
  .wave { animation: wave 2.5s linear infinite; }
  @keyframes wave { to { transform: translateX(-80px); } }

  .steam { opacity: 0; }
  .washing .steam, .done.open .steam { animation: steam 4s ease-in infinite; }
  .steam:nth-of-type(2) { animation-delay: 1.3s !important; }
  .steam:nth-of-type(3) { animation-delay: 2.6s !important; }
  @keyframes steam {
    0% { opacity: 0; transform: translateY(0) scale(0.8); }
    30% { opacity: 0.45; }
    100% { opacity: 0; transform: translateY(-80px) scale(1.4); }
  }

  .sparkle { opacity: 0; transform-box: fill-box; transform-origin: center; }
  .done .sparkle { animation: sparkle 2.2s ease-in-out infinite; }
  .sparkle:nth-of-type(2) { animation-delay: 0.7s !important; }
  .sparkle:nth-of-type(3) { animation-delay: 1.4s !important; }
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0.3) rotate(0); }
    50% { opacity: 1; transform: scale(1) rotate(45deg); }
  }

  .door { transform-origin: 200px 492px; transition: transform 0.9s ease; }
  .open .door { transform: perspective(900px) rotateX(-78deg); }

  .lcd { font: 700 22px/1 ui-monospace, "SF Mono", Menlo, monospace; fill: #7dd3ff; }
  .paused .lcd, .error .lcd { animation: blink 1s steps(2) infinite; }
  .error .lcd { fill: #ff6b6b; }
  @keyframes blink { 50% { opacity: 0.2; } }
  .led { fill: #2a333a; }
  .washing .led { fill: #3fb7ff; filter: drop-shadow(0 0 4px #3fb7ff); }
  .done .led { fill: #36e27f; filter: drop-shadow(0 0 4px #36e27f); }
  .error .led { fill: #ff4d4d; }

  .timelight { opacity: 0; transition: opacity 0.8s ease; }
  .washing .timelight { opacity: 1; }
  .tl { font: 700 15px/1 ui-monospace, "SF Mono", Menlo, monospace; fill: #9fe0ff; }

  .status { text-align: center; display: flex; flex-direction: column; gap: 4px; }
  .status .big { font-size: 1.6em; font-weight: 600; letter-spacing: 0.01em; }
  .status .small { opacity: 0.7; }
  .bar {
    height: 6px; border-radius: 3px; overflow: hidden; margin-top: 6px;
    background: var(--secondary-background-color, #e5e5e5);
  }
  .bar > div {
    height: 100%; width: 0; border-radius: 3px; transition: width 0.8s ease;
    background: linear-gradient(90deg, #3fb7ff, #7dd3ff);
  }

  .panel {
    width: min(100%, 560px); box-sizing: border-box;
    background: var(--card-background-color, #fff);
    border-radius: 20px; padding: 16px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    display: flex; flex-direction: column; gap: 14px;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .chips:empty { display: none; }
  .chip {
    padding: 6px 12px; border-radius: 999px; font-size: 0.9em;
    background: var(--secondary-background-color, #eee);
  }
  .chip.warn { background: rgba(255, 170, 0, 0.18); color: var(--warning-color, #b36b00); }
  label, .label { font-size: 0.8em; opacity: 0.7; display: block; margin-bottom: 6px; }
  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .group {
    grid-column: 1 / -1;
    font-size: 0.72em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    opacity: 0.55; padding: 8px 2px 0;
  }
  button {
    font: inherit; font-weight: 600; font-size: 1em; cursor: pointer;
    padding: 12px 16px; border-radius: 14px; border: none;
    background: var(--secondary-background-color, #eee); color: var(--primary-text-color);
    transition: transform 0.1s ease, filter 0.2s ease, background 0.2s ease;
  }
  button:active { transform: scale(0.97); }
  button:disabled { opacity: 0.4; cursor: default; }
  .tile {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0;
    text-align: left; padding: 10px 12px; border: 2px solid transparent;
  }
  .tile .tn { font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tile .tm { font-size: 0.8em; font-weight: normal; opacity: 0.65; }
  .tile.sel { border-color: var(--primary-color, #03a9f4); background: rgba(3, 169, 244, 0.12); }
  .tile.pending { animation: blink 1s steps(2) infinite; }
  .tile:disabled.sel { opacity: 1; }
  .more { width: 100%; padding: 8px; font-size: 0.85em; font-weight: normal; background: none; }
  .pdesc { font-size: 0.85em; opacity: 0.75; line-height: 1.35; }
  .pdesc:empty, .pnote:empty { display: none; }
  .pnote { font-size: 0.75em; opacity: 0.6; margin-top: 4px; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pills:empty, .optbox.hidden { display: none; }
  .pill {
    padding: 7px 14px; border-radius: 999px; font-size: 0.9em; font-weight: 500;
    border: 1px solid var(--divider-color, #ccc); background: none;
  }
  .pill.on {
    background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff);
    border-color: transparent;
  }
  .btns { display: flex; gap: 10px; }
  .btns > button { flex: 1; min-width: 0; }
  button.go { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  button.stop { background: var(--error-color, #db4437); color: #fff; }
  button.stop.sure { filter: brightness(1.15); box-shadow: 0 0 0 3px rgba(219, 68, 55, 0.35); }
  .why { font-size: 0.85em; opacity: 0.7; text-align: center; }
  .why:empty { display: none; }
  .hidden { display: none !important; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 20px;
          width: min(100%, 560px); }
  @media (min-width: 900px) and (min-aspect-ratio: 1/1) {
    .wrap { flex-direction: row; gap: 48px; }
    .stage { width: min(42vw, 74vh, 560px); }
    .side { width: min(40vw, 520px); }
    .status { text-align: left; align-self: stretch; }
    .status .big { font-size: 2.2em; }
    .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
`;

const SVG = `
<svg viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fl-body" x1="0" x2="1">
      <stop offset="0" stop-color="#dfe4ea"/><stop offset="0.5" stop-color="#f7f9fb"/>
      <stop offset="1" stop-color="#d3d9e0"/>
    </linearGradient>
    <linearGradient id="fl-cavity" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a6774"/><stop offset="1" stop-color="#2b343e"/>
    </linearGradient>
    <linearGradient id="fl-strip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2c3238"/><stop offset="1" stop-color="#1b1f24"/>
    </linearGradient>
    <linearGradient id="fl-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#cfe8ff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#9cc7ee" stop-opacity="0.08"/>
    </linearGradient>
    <radialGradient id="fl-light" cx="0.5" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#8fd3ff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#8fd3ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fl-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6cc4ff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#1f6fd1" stop-opacity="0.9"/>
    </linearGradient>
    <radialGradient id="fl-tl" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#3fb7ff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#3fb7ff" stop-opacity="0"/>
    </radialGradient>
    <filter id="fl-blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <clipPath id="fl-cave"><rect x="52" y="78" width="296" height="414" rx="6"/></clipPath>
  </defs>

  <ellipse cx="200" cy="560" rx="175" ry="10" fill="rgba(0,0,0,0.22)"/>
  <g class="timelight">
    <ellipse cx="200" cy="578" rx="70" ry="14" fill="url(#fl-tl)"/>
    <text class="tl" x="200" y="583" text-anchor="middle"></text>
  </g>

  <g class="machine">
    <rect x="36" y="18" width="328" height="534" rx="16" fill="url(#fl-body)"
          stroke="#b9c2cc" stroke-width="2"/>

    <rect x="52" y="78" width="296" height="414" rx="6" fill="url(#fl-cavity)"/>
    <g class="inside" clip-path="url(#fl-cave)">
      <rect class="glow" x="52" y="78" width="296" height="414" fill="url(#fl-light)"/>

      <!-- upper rack: cups and glasses, upside down -->
      <g stroke="#aab6c2" stroke-width="2" fill="none">
        <path d="M66 238 h268 M66 238 v-14 M334 238 v-14"/>
        <path d="M80 238 v-10 M110 238 v-10 M140 238 v-10 M170 238 v-10 M200 238 v-10
                 M230 238 v-10 M260 238 v-10 M290 238 v-10 M320 238 v-10"/>
      </g>
      <path d="M84 236 l6 -44 h22 l6 44z" fill="#d9eefc" opacity="0.8"/>
      <path d="M132 236 l4 -36 h18 l4 36z" fill="#f7d8a8" opacity="0.9"/>
      <path d="M176 236 l6 -44 h22 l6 44z" fill="#d9eefc" opacity="0.8"/>
      <path d="M226 236 c0 -30 40 -30 40 0z" fill="#ffffff" opacity="0.9"/>
      <path d="M282 236 l6 -44 h22 l6 44z" fill="#d9eefc" opacity="0.8"/>

      <!-- upper spray arm -->
      <rect x="196" y="244" width="8" height="6" fill="#8793a0"/>
      <rect class="arm up" x="110" y="250" width="180" height="7" rx="3.5" fill="#c3ccd6"/>

      <!-- lower rack: plates on edge, a pot -->
      <g stroke="#aab6c2" stroke-width="2" fill="none">
        <path d="M66 420 h268 M66 420 v-16 M334 420 v-16"/>
        <path d="M80 420 v-12 M110 420 v-12 M140 420 v-12 M170 420 v-12 M200 420 v-12
                 M230 420 v-12 M260 420 v-12 M290 420 v-12 M320 420 v-12"/>
      </g>
      <rect x="78" y="318" width="12" height="100" rx="6" fill="#ffffff"/>
      <rect x="98" y="318" width="12" height="100" rx="6" fill="#f2f6fa"/>
      <rect x="118" y="318" width="12" height="100" rx="6" fill="#ffffff"/>
      <rect x="138" y="318" width="12" height="100" rx="6" fill="#e6f1fb"/>
      <rect x="158" y="330" width="10" height="88" rx="5" fill="#ffffff"/>
      <rect x="176" y="330" width="10" height="88" rx="5" fill="#f2f6fa"/>
      <path d="M214 418 v-64 q0 -10 10 -10 h76 q10 0 10 10 v64z" fill="#7f8c99"/>
      <rect x="206" y="344" width="112" height="8" rx="4" fill="#5e6a76"/>

      <!-- lower spray arm, water in the sump -->
      <rect x="196" y="426" width="8" height="8" fill="#8793a0"/>
      <rect class="arm" x="90" y="434" width="220" height="8" rx="4" fill="#c3ccd6"/>
      <g class="sump">
        <g class="wave">
          <path d="M40 474 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 v40 h-360z"
                fill="url(#fl-water)"/>
        </g>
      </g>

      <!-- water fanning out of the arms -->
      <g stroke="#cdeeff" stroke-width="3" stroke-linecap="round" fill="none">
        <path class="spray" d="M110 432 L92 310"/><path class="spray" d="M140 432 L132 300"/>
        <path class="spray" d="M170 432 L168 296"/><path class="spray" d="M230 432 L232 296"/>
        <path class="spray" d="M260 432 L268 300"/><path class="spray" d="M290 432 L308 310"/>
        <path class="spray" d="M130 248 L112 120"/><path class="spray" d="M170 248 L164 112"/>
        <path class="spray" d="M230 248 L236 112"/><path class="spray" d="M270 248 L288 120"/>
        <path class="spray" d="M150 258 L140 330"/><path class="spray" d="M250 258 L260 330"/>
      </g>
      <!-- jets off the arms -->
      <g fill="#bfe6ff">
        <circle class="jet" cx="120" cy="430" r="3"/><circle class="jet" cx="150" cy="430" r="2.5"/>
        <circle class="jet" cx="180" cy="430" r="3"/><circle class="jet" cx="220" cy="430" r="2.5"/>
        <circle class="jet" cx="250" cy="430" r="3"/><circle class="jet" cx="280" cy="430" r="2.5"/>
        <circle class="jet" cx="135" cy="246" r="2.5"/><circle class="jet" cx="175" cy="246" r="3"/>
        <circle class="jet" cx="225" cy="246" r="2.5"/><circle class="jet" cx="265" cy="246" r="3"/>
        <circle class="jet down" cx="150" cy="258" r="2.5"/><circle class="jet down" cx="250" cy="258" r="2.5"/>
      </g>

      <!-- steam, and the shine of clean dishes -->
      <g fill="#ffffff" filter="url(#fl-blur)">
        <ellipse class="steam" cx="140" cy="150" rx="30" ry="14"/>
        <ellipse class="steam" cx="230" cy="140" rx="36" ry="16"/>
        <ellipse class="steam" cx="190" cy="170" rx="26" ry="12"/>
      </g>
      <g fill="#ffffff">
        <path class="sparkle" d="M98 300 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z"/>
        <path class="sparkle" d="M196 196 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z"/>
        <path class="sparkle" d="M290 330 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z"/>
      </g>
    </g>

    <g class="door">
      <path fill="url(#fl-body)" stroke="#b9c2cc" stroke-width="2" fill-rule="evenodd"
            d="M40 76 h320 v418 h-320z M78 120 h244 a14 14 0 0 1 14 14 v300 a14 14 0 0 1 -14 14
               h-244 a14 14 0 0 1 -14 -14 v-300 a14 14 0 0 1 14 -14z"/>
      <rect x="64" y="120" width="272" height="328" rx="14" fill="url(#fl-glass)"
            stroke="#c5ced8" stroke-width="2"/>
      <path d="M84 140 l60 0 l-40 120 l-30 0z" fill="#ffffff" opacity="0.12"/>
      <rect x="150" y="462" width="100" height="10" rx="5" fill="#c3ccd6"/>
    </g>

    <rect x="36" y="18" width="328" height="58" rx="16" fill="url(#fl-strip)"/>
    <rect x="36" y="56" width="328" height="20" fill="url(#fl-strip)"/>
    <rect x="148" y="30" width="104" height="34" rx="6" fill="#0b1116"/>
    <text class="lcd" x="200" y="55" text-anchor="middle">--:--</text>
    <circle cx="70" cy="47" r="9" fill="none" stroke="#5d6772" stroke-width="2"/>
    <rect x="96" y="42" width="30" height="10" rx="5" fill="#3b444d"/>
    <rect x="274" y="42" width="30" height="10" rx="5" fill="#3b444d"/>
    <circle class="led" cx="330" cy="47" r="5"/>

    <rect x="44" y="500" width="312" height="44" rx="6" fill="#c9d0d8"/>
  </g>
</svg>`;

class FilippaCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entities) throw new Error("filippa-card: entities required");
    this._config = config;
    this._built = false;
  }

  getCardSize() {
    return 12;
  }

  disconnectedCallback() {
    clearTimeout(this._tick);
    clearTimeout(this._sureTimer);
    clearInterval(this._clock);
    this._clock = undefined;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  _id(role) {
    return this._config.entities[role];
  }

  _state(role) {
    const id = this._id(role);
    return id ? this._hass.states[id] : undefined;
  }

  _val(role) {
    const s = this._state(role);
    return s && !["unknown", "unavailable"].includes(s.state) ? s.state : undefined;
  }

  // Option switches the selected program allows: the others are unavailable.
  _switches() {
    return Object.entries(this._config.switches || {})
      .map(([field, id]) => [field, id, this._hass.states[id]])
      .filter(([, , s]) => s && !["unknown", "unavailable"].includes(s.state));
  }

  _learned() {
    return ((this._state("cycles") || {}).attributes || {}).programs || {};
  }

  // The programs the machine offers, else every one the card can name.
  _programs() {
    const sel = this._state("selected");
    const options = sel && sel.attributes && sel.attributes.options;
    return options && options.length ? options : Object.keys(STRINGS.programs);
  }

  _call(domain, service, data) {
    // The frontend shows the error itself; the card only stops waiting.
    return Promise.resolve(this._hass.callService(domain, service, data)).catch(() => {
      this._pending = undefined;
      this._update();
    });
  }

  _wait(what) {
    this._pending = { ...what, until: Date.now() + PENDING_MS };
    clearTimeout(this._tick);
    this._tick = setTimeout(() => this._update(), PENDING_MS + 50);
  }

  _pick(key) {
    const id = this._id("selected");
    if (!id || key === this._val("selected")) return;
    this._wait({ pick: key });
    this._update();
    this._call("select", "select_option", { entity_id: id, option: key });
  }

  _start() {
    const program = this._val("selected");
    if (!program || !this._config.device_id) return;
    const data = { device_id: this._config.device_id, affects_to: "active_program", program };
    // The options as the switches show them: home_connect would start the
    // program with its defaults otherwise.
    for (const [field, , s] of this._switches()) data[field] = s.state === "on";
    this._wait({ start: true });
    this._update();
    this._call("home_connect", "set_program_and_options", data);
  }

  _stop() {
    // A cycle stopped by mistake leaves wet, dirty dishes: tap twice.
    if (!this._sure) {
      this._sure = true;
      clearTimeout(this._sureTimer);
      this._sureTimer = setTimeout(() => {
        this._sure = false;
        this._update();
      }, 4000);
      this._update();
      return;
    }
    this._sure = false;
    clearTimeout(this._sureTimer);
    this._update();
    const id = this._id("stop");
    if (id) this._call("button", "press", { entity_id: id });
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="wrap">
        <div class="stage">${SVG}</div>
        <div class="side">
          <div class="status">
            <div class="big"></div><div class="small"></div>
            <div class="bar hidden"><div></div></div>
          </div>
          <div class="panel">
            <div class="chips"></div>
            <div class="progbox">
              <div class="label tlabel"></div>
              <div class="tiles top"></div>
              <div class="tiles all hidden"></div>
              <button class="more" type="button"></button>
              <div class="pdesc"></div>
              <div class="pnote"></div>
            </div>
            <div class="optbox">
              <div class="label">${STRINGS.options}</div>
              <div class="pills"></div>
            </div>
            <div class="btns">
              <button class="go start" type="button">${STRINGS.start}</button>
              <button class="stop" type="button">${STRINGS.stop}</button>
            </div>
            <div class="why"></div>
          </div>
        </div>
      </div>`;
    const $ = (sel) => root.querySelector(sel);
    this.$ = {
      wrap: $(".wrap"), lcd: $(".lcd"), tl: $(".tl"), big: $(".big"), small: $(".small"),
      bar: $(".bar"), fill: $(".bar > div"), chips: $(".chips"), tlabel: $(".tlabel"),
      top: $(".tiles.top"), all: $(".tiles.all"), more: $(".more"), desc: $(".pdesc"),
      note: $(".pnote"), optbox: $(".optbox"), pills: $(".pills"), start: $(".start"),
      stop: $(".stop"), why: $(".why"),
    };
    try {
      this._showAll = localStorage.getItem("filippa-all-programs") === "1";
    } catch (err) {
      this._showAll = false;
    }
    this.$.more.addEventListener("click", () => {
      this._showAll = !this._showAll;
      try {
        localStorage.setItem("filippa-all-programs", this._showAll ? "1" : "0");
      } catch (err) {
        // private browsing: the choice lasts until the page reloads
      }
      this._update();
    });
    for (const box of [this.$.top, this.$.all]) {
      box.addEventListener("click", (e) => {
        const tile = e.target.closest(".tile");
        if (tile && !tile.disabled) this._pick(tile.dataset.key);
      });
    }
    this.$.pills.addEventListener("click", (e) => {
      const pill = e.target.closest(".pill");
      if (pill && !pill.disabled) this._call("switch", "toggle", { entity_id: pill.dataset.entity });
    });
    this.$.start.addEventListener("click", () => this._start());
    this.$.stop.addEventListener("click", () => this._stop());
    this._built = true;
  }

  _tile(key, learned, selected, canPick) {
    const tile = el("button", "tile");
    tile.type = "button";
    tile.dataset.key = key;
    tile.classList.toggle("sel", key === selected);
    tile.classList.toggle("pending", !!(this._pending && this._pending.pick === key));
    tile.disabled = !canPick;
    const d = learned[key];
    const meta = [
      minutesOf(d) && STRINGS.estimate(minutesOf(d)),
      d && d.usage > 0 && STRINGS.times(d.usage),
    ].filter(Boolean).join(" · ");
    tile.append(el("span", "tn", programName(key)), el("span", "tm", meta || " "));
    tile.title = (STRINGS.programs[key] || {}).description || "";
    return tile;
  }

  _renderTiles(selected, canPick) {
    const programs = this._programs();
    const learned = this._learned();
    const used = programs.filter((k) => (learned[k] || {}).usage > 0)
      .sort((a, b) => learned[b].usage - learned[a].usage).slice(0, MOST_USED);
    const top = used.length ? used : FIRST_CHOICES.filter((k) => programs.includes(k));
    // The program on the machine stays in sight even when it is not a favourite.
    if (selected && programs.includes(selected) && !top.includes(selected) && !this._showAll) {
      top.push(selected);
    }
    this.$.tlabel.textContent = used.length ? STRINGS.mostUsed : STRINGS.firstChoices;
    this.$.top.replaceChildren(...top.map((k) => this._tile(k, learned, selected, canPick)));

    const groups = STRINGS.groups.map(([name, keys]) => [name, keys.map((k) => PROGRAM_PREFIX + k)]);
    const grouped = new Set(groups.flatMap(([, keys]) => keys));
    groups.push([STRINGS.others, programs.filter((k) => !grouped.has(k))]);
    const nodes = [];
    for (const [name, keys] of groups) {
      const shown = keys.filter((k) => programs.includes(k));
      if (!shown.length) continue;
      nodes.push(el("div", "group", name), ...shown.map((k) => this._tile(k, learned, selected, canPick)));
    }
    this.$.all.replaceChildren(...nodes);
    this.$.all.classList.toggle("hidden", !this._showAll);
    this.$.top.classList.toggle("hidden", this._showAll);
    this.$.more.textContent = this._showAll ? STRINGS.fewerPrograms : STRINGS.allPrograms(programs.length);

    const d = selected && learned[selected];
    this.$.desc.textContent = selected ? (STRINGS.programs[selected] || {}).description || "" : "";
    this.$.note.textContent = !selected ? "" : d && d.actual ? STRINGS.durationNote(d) : STRINGS.noDuration;
  }

  _renderPills(canPick) {
    const pills = this._switches().map(([field, id, s]) => {
      const text = STRINGS.switches[field] || { name: field.replace(/^dishcare_dishwasher_option_/, "") };
      const pill = el("button", s.state === "on" ? "pill on" : "pill", text.name);
      pill.type = "button";
      pill.dataset.entity = id;
      pill.title = text.description || "";
      pill.setAttribute("aria-pressed", String(s.state === "on"));
      pill.disabled = !canPick;
      return pill;
    });
    this.$.pills.replaceChildren(...pills);
    this.$.optbox.classList.toggle("hidden", !pills.length);
  }

  _update() {
    const name = this._config.name || "Filippa";
    const state = this._val("state");
    const connected = this._val("connected") !== "off" && state !== undefined;
    const door = this._val("door");
    const doorOpen = door === "open";
    const remoteStart = this._val("remote_start") === "on";
    const active = this._val("active");
    const selectedNow = this._val("selected");
    const finishRaw = this._val("finish");
    const finish = finishRaw ? new Date(finishRaw) : undefined;
    const progress = Number(this._val("progress"));
    const busy = BUSY.has(state);
    const running = state === "run";

    // A pick or a start is over once the machine shows it, or after a while.
    const p = this._pending;
    if (p && (Date.now() > p.until || (p.pick && p.pick === selectedNow) || (p.start && busy))) {
      this._pending = undefined;
    }

    const w = this.$.wrap.classList;
    w.toggle("washing", running);
    w.toggle("paused", state === "pause");
    w.toggle("done", state === "finished");
    w.toggle("error", state === "error" || state === "actionrequired");
    w.toggle("open", doorOpen);

    let lcd = "";
    let big;
    let small = "";
    const program = busy || state === "finished" ? active || selectedNow : selectedNow;
    // Counted up, like the machine: 0:00 only once it is done.
    const left = finish ? Math.max(0, Math.ceil((finish - Date.now()) / 60000)) : undefined;
    const clock = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    if (!connected) {
      big = STRINGS.unreachable;
      small = STRINGS.unreachableNote;
    } else if (busy || state === "finished" || state === "error") {
      big = STRINGS.states[state];
      const ends = finish && state !== "finished" ? STRINGS.ends(hhmm(finish)) : "";
      const line = [program && programName(program), ends].filter(Boolean).join(" · ");
      small = state === "actionrequired" ? STRINGS.checkDisplay
        : state === "finished" ? (doorOpen ? STRINGS.doorOpen : STRINGS.toEmpty)
        : line;
      lcd = state === "finished" ? "0:00" : left !== undefined ? clock(left) : "--:--";
    } else if (state === "ready") {
      big = STRINGS.ready;
      small = remoteStart ? STRINGS.remoteOn : STRINGS.why.remote;
      const m = minutesOf(this._learned()[selectedNow]);
      lcd = m ? clock(m) : "--:--";
    } else {
      big = STRINGS.sleeps(name);
      small = STRINGS.off;
    }
    // The countdown moves between the machine's updates too.
    if (finish && busy && !this._clock) this._clock = setInterval(() => this._update(), 30000);
    if (!(finish && busy) && this._clock) {
      clearInterval(this._clock);
      this._clock = undefined;
    }
    this.$.lcd.textContent = lcd;
    this.$.tl.textContent = running && left !== undefined ? clock(left) : "";
    this.$.big.textContent = big;
    this.$.small.textContent = small;
    const showBar = (busy || state === "finished") && Number.isFinite(progress);
    this.$.bar.classList.toggle("hidden", !showBar);
    this.$.fill.style.width = `${showBar ? Math.min(100, Math.max(0, progress)) : 0}%`;
    if (showBar) this.$.bar.title = STRINGS.progress(progress);

    const chips = [];
    if (!connected && this._id("connected")) chips.push([STRINGS.disconnected, true]);
    if (doorOpen && state !== "finished") chips.push([STRINGS.doorOpen, false]);
    if (this._val("salt") === "present") chips.push([STRINGS.salt, true]);
    if (this._val("rinse_aid") === "present") chips.push([STRINGS.rinseAid, true]);
    this.$.chips.replaceChildren(...chips.map(([text, warn]) => el("span", warn ? "chip warn" : "chip", text)));

    // Programs and options can change on the machine only while it waits;
    // a select that is merely unknown (nothing selected yet) takes a pick.
    const sel = this._state("selected");
    const selectable = !!sel && sel.state !== "unavailable";
    const canPick = connected && selectable && !busy && !this._pending && state !== "inactive";
    this._renderTiles(program, canPick);
    this._renderPills(canPick && !!selectedNow);

    let why = "";
    if (!connected) why = STRINGS.why.unreachable;
    else if (busy || state === "finished") why = "";
    else if (state === "inactive") why = STRINGS.why.off;
    else if (doorOpen) why = STRINGS.why.door;
    else if (!remoteStart) why = STRINGS.why.remote;
    else if (!selectedNow) why = STRINGS.why.program;
    const starting = !!(this._pending && this._pending.start);
    // Home Connect starts a program only from Ready, with remote start allowed.
    this.$.start.disabled = state !== "ready" || !!why || starting;
    this.$.start.textContent = starting ? STRINGS.starting : STRINGS.start;
    this.$.why.textContent = why;
    const stoppable = STOPPABLE.has(state) && !!this._id("stop");
    this.$.stop.disabled = !stoppable;
    if (!stoppable) this._sure = false;
    this.$.stop.classList.toggle("sure", !!this._sure);
    this.$.stop.textContent = this._sure ? STRINGS.stopSure : STRINGS.stop;
  }
}

// The frontend swaps window.customElements for a scoped-registry polyfill
// while it boots. Loaded before that, the card lands in the native registry
// only, the polyfill never sees it and the page shows "Configuration error".
// Define again, wherever window.customElements points, once the app is up.
const define = () => {
  if (!customElements.get("filippa-card")) customElements.define("filippa-card", FilippaCard);
};
define();
customElements.whenDefined("home-assistant").then(define);
window.customCards = window.customCards || [];
window.customCards.push({ type: "filippa-card", name: "Filippa", description: "La lavastoviglie." });
