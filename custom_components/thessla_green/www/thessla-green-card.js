/**
 * ThesslaGreen Card — custom Lovelace card for the ThesslaGreen_HA integration
 * (https://github.com/aLAN-LDZ/ThesslaGreen_HA)
 *
 * A control panel in the style of the ThesslaGreen Air++ / AirS screen:
 *   - a minimalist heat-exchanger airflow diagram (live temps, m³/h, bypass),
 *   - a single unified mode selector (Auto / Manual / special functions),
 *   - season, bypass, efficiency / recovery power / COP, filter + fault status.
 *
 * Single file, no dependencies, no build step. Copy it into /config/www/ and
 * register it as a "JavaScript Module" resource.
 *
 * NOTE: strings passed to select entities (e.g. "Wietrzenie", "Zima",
 * "Brak trybu") are the exact option values expected by the integration and
 * MUST stay in Polish. Only their on-screen labels are localized.
 */

const TG_VERSION = "3.0.0-rc.1";

// ---------------------------------------------------------------------------
//  Entity handling. The card auto-detects the ThesslaGreen entities at runtime
//  (by platform + entity_id suffix); the defaults below (with the device-name
//  prefix HA adds) are only a fallback. Everything is overridable via config.
// ---------------------------------------------------------------------------
const DEV = "rekuperator_thessla_";

const DEFAULT_ENTITIES = {
  power: `switch.${DEV}rekuperator_on_off`,
  mode_switch: `switch.${DEV}rekuperator_mode`, // 4208: on=Auto(0), off=Manual(1)
  mode_state: `sensor.${DEV}rekuperator_tryb_pracy`, // 0=Auto,1=Manual,2=Temporary
  speed: `number.${DEV}rekuperator_predkosc`, // manual intensity % (reg 4210)
  special: `select.${DEV}rekuperator_tryb`, // Brak trybu / Wietrzenie / Pusty Dom / Kominek / Okna
  season: `select.${DEV}rekuperator_sezon`, // Lato / Zima
  comfort: `select.${DEV}rekuperator_eco_komfort`,
  erv: `select.${DEV}rekuperator_erv_tryb`,
  bypass: `switch.${DEV}rekuperator_bypass`, // reg 4320: enable/disable bypass FUNCTION
  bypass_open: `binary_sensor.${DEV}rekuperator_silownik_bypassu`, // coil 9: actuator = open now
  temp_intake: `sensor.${DEV}rekuperator_temperatura_czerpnia`,
  temp_supply: `sensor.${DEV}rekuperator_temperatura_nawiew`,
  temp_extract: `sensor.${DEV}rekuperator_temperatura_wywiew`,
  temp_fpx: `sensor.${DEV}rekuperator_temperatura_za_fpx`,
  temp_ambient: `sensor.${DEV}rekuperator_temperatura_otoczenia`, // reg 22: ambient (TO) probe
  flow_supply: `sensor.${DEV}rekuperator_strumien_nawiew`,
  flow_extract: `sensor.${DEV}rekuperator_strumien_wywiew`,
  efficiency: `sensor.${DEV}rekuperator_sprawnosc`,
  recovery_power: `sensor.${DEV}rekuperator_moc_odzysku`,
  cop: `sensor.${DEV}rekuperator_cop`,
  filter_change: `binary_sensor.${DEV}rekuperator_wymiana_filtrow`, // E252 (8444)
  alarm: `binary_sensor.${DEV}rekuperator_alarm`, // 8192: any "E" warning
  error: `binary_sensor.${DEV}rekuperator_error`, // 8193: any "S" (blocking) error
  // --- optional entities from the fork (v0.3.0+); card falls back if absent ---
  fan_supply_pct: `sensor.${DEV}rekuperator_wydajnosc_nawiew`, // dac 1280 → effective %
  fan_extract_pct: `sensor.${DEV}rekuperator_wydajnosc_wywiew`, // dac 1281 → effective %
  bypass_status: `sensor.${DEV}rekuperator_status_bypass`, // 4330: true bypass status
  alarm_code: `sensor.${DEV}rekuperator_kod_alarmu`, // 4384: blocking S-alarm number
  filter_days: `sensor.${DEV}rekuperator_filtr_nawiew_dni`, // 4660: days to filter change
  filter_wear_sup: `sensor.${DEV}rekuperator_filtr_nawiew_zuzycie`, // 4482: supply filter wear %
  filter_wear_ext: `sensor.${DEV}rekuperator_filtr_wywiew_zuzycie`, // 4483: exhaust filter wear %
  target_temp: `sensor.${DEV}rekuperator_temperatura_zadana`, // 4212: target supply temp
  bypass_cool: `sensor.${DEV}rekuperator_bypass_prog_chlodzenie`, // 4323: free-cooling activation °C
  bypass_heat: `sensor.${DEV}rekuperator_bypass_prog_grzanie`, // 4322: free-heating activation °C
  bypass_min: `sensor.${DEV}rekuperator_bypass_prog_min`, // 4321: min bypass temp °C
};

const ENTITY_RULES = {
  power: { domain: "switch", suffix: "rekuperator_on_off" },
  mode_switch: { domain: "switch", suffix: "rekuperator_mode" },
  bypass: { domain: "switch", suffix: "rekuperator_bypass" },
  bypass_open: { domain: "binary_sensor", suffix: "silownik_bypassu" },
  speed: { domain: "number", suffix: "predkosc" },
  mode_state: { domain: "sensor", suffix: "tryb_pracy" },
  special: { domain: "select", suffix: "rekuperator_tryb" },
  season: { domain: "select", suffix: "sezon" },
  comfort: { domain: "select", suffix: "eco_komfort" },
  erv: { domain: "select", suffix: "erv_tryb" },
  temp_intake: { domain: "sensor", suffix: "temperatura_czerpnia" },
  temp_supply: { domain: "sensor", suffix: "temperatura_nawiew" },
  temp_extract: { domain: "sensor", suffix: "temperatura_wywiew" },
  temp_fpx: { domain: "sensor", suffix: "temperatura_za_fpx" },
  temp_ambient: { domain: "sensor", suffix: "temperatura_otoczenia" },
  flow_supply: { domain: "sensor", suffix: "strumien_nawiew" },
  flow_extract: { domain: "sensor", suffix: "strumien_wywiew" },
  efficiency: { domain: "sensor", suffix: "sprawnosc" },
  recovery_power: { domain: "sensor", suffix: "moc_odzysku" },
  cop: { domain: "sensor", suffix: "rekuperator_cop" },
  filter_change: { domain: "binary_sensor", suffix: "wymiana_filtrow" },
  alarm: { domain: "binary_sensor", suffix: "rekuperator_alarm" },
  error: { domain: "binary_sensor", suffix: "rekuperator_error" },
  fan_supply_pct: { domain: "sensor", suffix: "wydajnosc_nawiew" },
  fan_extract_pct: { domain: "sensor", suffix: "wydajnosc_wywiew" },
  bypass_status: { domain: "sensor", suffix: "status_bypass" },
  alarm_code: { domain: "sensor", suffix: "kod_alarmu" },
  filter_days: { domain: "sensor", suffix: "filtr_nawiew_dni" },
  filter_wear_sup: { domain: "sensor", suffix: "filtr_nawiew_zuzycie" },
  filter_wear_ext: { domain: "sensor", suffix: "filtr_wywiew_zuzycie" },
  target_temp: { domain: "sensor", suffix: "temperatura_zadana" },
  bypass_cool: { domain: "sensor", suffix: "bypass_prog_chlodzenie" },
  bypass_heat: { domain: "sensor", suffix: "bypass_prog_grzanie" },
  bypass_min: { domain: "sensor", suffix: "bypass_prog_min" },
};

function findThesslaEntities(hass) {
  if (!hass) return { ids: [], viaRegistry: false };
  const reg = hass.entities;
  if (reg) {
    let ids = Object.keys(reg).filter((id) => reg[id] && reg[id].platform === "thessla_green");
    if (ids.length) return { ids, viaRegistry: true };
    if (hass.devices) {
      const dev = Object.keys(hass.devices).find((d) => {
        const x = hass.devices[d] || {};
        return x.manufacturer === "Thessla Green" || /thessla/i.test(x.name || x.name_by_user || "");
      });
      if (dev) {
        ids = Object.keys(reg).filter((id) => reg[id] && reg[id].device_id === dev);
        if (ids.length) return { ids, viaRegistry: true };
      }
    }
  }
  const ids = Object.keys(hass.states || {}).filter((id) => id.includes("rekuperator") || id.includes("thessla"));
  return { ids, viaRegistry: false };
}

function resolveEntities(hass, overrides = {}) {
  const { ids, viaRegistry } = findThesslaEntities(hass);
  const map = { ...DEFAULT_ENTITIES };
  for (const [role, rule] of Object.entries(ENTITY_RULES)) {
    if (overrides[role]) {
      map[role] = overrides[role];
      continue;
    }
    const found = ids.find((id) => id.startsWith(rule.domain + ".") && id.endsWith(rule.suffix));
    if (found) map[role] = found;
  }
  for (const k of Object.keys(overrides)) if (overrides[k]) map[k] = overrides[k];
  return { map, viaRegistry };
}

// Special functions. `option` = integration select value (Polish); `key` = i18n label.
const SPECIAL_FUNCTIONS = [
  { option: "Wietrzenie", key: "fn_airing", icon: "M14.5,17A2.5,2.5 0 0,1 12,19.5A2.5,2.5 0 0,1 9.5,17H11A1.5,1.5 0 0,0 12.5,18.5A1.5,1.5 0 0,0 14,17A1.5,1.5 0 0,0 12.5,15.5H2V14H12.5A3,3 0 0,1 15.5,17M18,10.5A3.5,3.5 0 0,0 21.5,7A3.5,3.5 0 0,0 18,3.5A3.5,3.5 0 0,0 14.5,7H16A2,2 0 0,1 18,5A2,2 0 0,1 20,7A2,2 0 0,1 18,9H2V10.5H18M18.5,12H2V13.5H18.5A2,2 0 0,1 20.5,15.5A2,2 0 0,1 18.5,17.5H17V19H18.5A3.5,3.5 0 0,0 22,15.5A3.5,3.5 0 0,0 18.5,12Z" },
  { option: "Pusty Dom", key: "fn_away", icon: "M12,3L2,12H5V20H19V12H22L12,3M12,7.7C14.1,7.7 15.8,9.4 15.8,11.5C15.8,14.5 12,18 12,18C12,18 8.2,14.5 8.2,11.5C8.2,9.4 9.9,7.7 12,7.7M12,10A1.5,1.5 0 0,0 10.5,11.5A1.5,1.5 0 0,0 12,13A1.5,1.5 0 0,0 13.5,11.5A1.5,1.5 0 0,0 12,10Z" },
  { option: "Okna", key: "fn_window", icon: "M20,3H4A2,2 0 0,0 2,5V19A2,2 0 0,0 4,21H20A2,2 0 0,0 22,19V5A2,2 0 0,0 20,3M20,19H13V17H11V19H4V5H11V7H13V5H20V19Z" },
  { option: "Kominek", key: "fn_fireplace", icon: "M17,7C17,7 18,10 15,13C15,13 16,9 12,7C12,7 13,11 9,13C9,13 5,15 7,20C7,20 3,17 4,12C4,12 5,13 6,13C6,13 4,9 8,4C8,4 8,7 10,7C10,7 9,2 15,2C15,2 13,5 15,7C15,7 16,6 17,4C17,4 18,5 17,7Z" },
];
const SPECIAL_NONE = "Brak trybu";

// Base-mode tiles (register 4208). Temporary is read-only (integration can't set it).
const MODE_ICONS = {
  auto: "M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z",
  manual: "M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z",
  temporary: "M6,2V8H6V8L10,12L6,16V16H6V22H18V16H18V16L14,12L18,8V8H18V2H6M16,16.5V20H8V16.5L12,12.5L16,16.5M12,11.5L8,7.5V4H16V7.5L12,11.5Z",
};

const ICONS = {
  power: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  snow: "M20.79,13.95L18.46,14.57L16.46,13.44V10.56L18.46,9.43L20.79,10.05L21.31,8.12L19.54,7.65L20,5.88L18.07,5.36L17.45,7.69L15.45,8.82L13,7.38V5.12L14.71,3.41L13.29,2L12,3.29L10.71,2L9.29,3.41L11,5.12V7.38L8.5,8.82L6.5,7.69L5.88,5.36L3.95,5.88L4.41,7.65L2.64,8.12L3.16,10.05L5.5,9.43L7.5,10.56V13.44L5.5,14.57L3.16,13.95L2.64,15.88L4.41,16.35L3.95,18.12L5.88,18.64L6.5,16.31L8.5,15.18L11,16.62V18.88L9.29,20.59L10.71,22L12,20.71L13.29,22L14.71,20.59L13,18.88V16.62L15.5,15.18L17.45,16.31L18.07,18.64L20,18.12L19.54,16.35L21.31,15.88L20.79,13.95M9.5,10.56L12,9.11L14.5,10.56V13.44L12,14.89L9.5,13.44V10.56Z",
  sun: "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  filter: "M12,3A9,9 0 0,0 3,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12H21A9,9 0 0,0 12,3M12,7A5,5 0 0,0 7,12H9A3,3 0 0,1 12,9A3,3 0 0,1 15,12H17A5,5 0 0,0 12,7M11,13V19H13V13H11M11,20V22H13V20H11Z",
  bypass: "M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4C14.4,4 16.5,5.2 17.8,7L7,17.8C5.2,16.5 4,14.4 4,12A8,8 0 0,1 12,4M12,20C9.6,20 7.5,18.8 6.2,17L17,6.2C18.8,7.5 20,9.6 20,12A8,8 0 0,1 12,20Z",
  alert: "M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z",
};

// Airflow stream colours (semantic — always shown, in both palettes).
const FLOW = {
  intake: "#2E8FD8", // outdoor air in — cool blue
  extract: "#E1614E", // from rooms — warm red
  supply: "#E24E8E", // to rooms — magenta
  exhaust: "#E0A63C", // to outside — amber
};

const I18N = {
  en: {
    name: "Recuperator", power: "Power", season: "Season", winter: "Winter", summer: "Summer",
    intensity: "Intensity", auto: "Auto", manual: "Manual", temporary: "Temporary",
    fn_airing: "Airing", fn_away: "Away", fn_window: "Open window", fn_fireplace: "Fireplace",
    bypass: "Bypass", enabled: "Enabled", disabled: "Disabled", open: "Open", closed: "Closed", device: "Device",
    bypass_hint_off: "Bypass function disabled",
    bypass_hint_closed: "Function enabled — bypass closed (opens automatically when conditions allow)",
    bypass_hint_open: "Bypass open (active)",
    filters: "Filters", replace: "Replace", ok: "OK",
    efficiency: "Efficiency", recovery: "Recovery", cop: "COP",
    intake: "INTAKE", extract: "EXTRACT", exhaust: "EXHAUST", supply: "SUPPLY",
    warning: "Warning", error: "Error", schedule: "schedule", active: "active", off: "Off", target: "target",
  },
  pl: {
    name: "Rekuperator", power: "Zasilanie", season: "Sezon", winter: "Zima", summer: "Lato",
    intensity: "Intensywność", auto: "Auto", manual: "Ręczny", temporary: "Chwilowy",
    fn_airing: "Wietrzenie", fn_away: "Pusty dom", fn_window: "Otwarte okno", fn_fireplace: "Kominek",
    bypass: "Bypass", enabled: "Włączony", disabled: "Wyłączony", open: "Otwarty", closed: "Zamknięty", device: "Urządzenie",
    bypass_hint_off: "Funkcja bypass wyłączona",
    bypass_hint_closed: "Funkcja włączona — bypass zamknięty (uaktywni się, gdy warunki będą sprzyjające)",
    bypass_hint_open: "Bypass otwarty (aktywny)",
    filters: "Filtry", replace: "Wymień", ok: "OK",
    efficiency: "Sprawność", recovery: "Odzysk", cop: "COP",
    intake: "CZERPNIA", extract: "WYWIEW", exhaust: "WYRZUTNIA", supply: "NAWIEW",
    warning: "Ostrzeżenie", error: "Błąd", schedule: "harmonogram", active: "aktywne", off: "Wyłączony", target: "cel",
  },
};

function pickLang(hass) {
  const l = (hass?.language || hass?.locale?.language || "en").toLowerCase();
  return l.startsWith("pl") ? "pl" : "en";
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Optimistic-state locking (Modbus writes + a refresh can take a few seconds).
const PENDING_TIMEOUT = 15000;
const SCOPE_ALL = ["power", "season", "intensity", "modes", "bypass"];

class ThesslaGreenCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._e = {};
  }

  // ---- Lovelace API --------------------------------------------------------
  setConfig(config) {
    if (!config) throw new Error("Missing configuration");
    this._config = {
      name: config.name,
      speed_step: Number(config.speed_step ?? 5),
      show_metrics: config.show_metrics !== false,
      show_diagram: config.show_diagram !== false,
      functions: Array.isArray(config.functions) ? config.functions : null,
      accent: config.accent === "thessla" ? "thessla" : "theme",
      entities: { ...(config.entities || {}) },
    };
    this._entities = null;
    this._resolvedViaRegistry = false;
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 10;
  }

  static getStubConfig() {
    return { type: "custom:thessla-green-card" };
  }

  static getConfigElement() {
    return document.createElement("thessla-green-card-editor");
  }

  // ---- Helpers -------------------------------------------------------------
  _stateObj(id) {
    return id && this._hass ? this._hass.states[id] : undefined;
  }
  _state(id) {
    const s = this._stateObj(id);
    return s ? s.state : undefined;
  }
  _num(id) {
    const v = parseFloat(this._state(id));
    return Number.isFinite(v) ? v : null;
  }
  _isOn(id) {
    return this._state(id) === "on";
  }
  _temp(id) {
    const v = this._num(id);
    return v === null ? "—" : `${v.toFixed(1)}°C`;
  }
  _flow(id) {
    const v = this._num(id);
    return v === null ? "" : `${Math.round(v)} m³/h`;
  }
  // Effective fan output % from the fork's dac sensors (avg of supply+extract).
  // null when the fork entities aren't present → callers fall back.
  _effPct() {
    const s = this._num(this._entities.fan_supply_pct);
    const e = this._num(this._entities.fan_extract_pct);
    if (s === null && e === null) return null;
    if (s !== null && e !== null) return Math.round((s + e) / 2);
    return Math.round(s ?? e);
  }
  // Clip the solid filter copy from the top so its visible height = % of filter
  // life still left (100 − wear). Full when the wear sensor is absent.
  // Box spans y 59–81 (cy 70 ± 11).
  _setFilterWear(rect, wear) {
    if (!rect) return;
    const H = 22, B = 81;
    const avail = wear === null ? 100 : 100 - Math.max(0, Math.min(100, wear));
    const ah = (H * avail) / 100;
    rect.setAttribute("y", B - ah);
    rect.setAttribute("height", ah);
  }
  _t(key) {
    const lang = pickLang(this._hass);
    return (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  }

  _call(domain, service, data) {
    if (this._hass) this._hass.callService(domain, service, data);
  }
  _toggleSwitch(id, on) {
    if (id) this._call("switch", on ? "turn_on" : "turn_off", { entity_id: id });
  }
  _selectOption(id, option) {
    if (id) this._call("select", "select_option", { entity_id: id, option });
  }
  _setNumber(id, value) {
    if (id) this._call("number", "set_value", { entity_id: id, value });
  }
  _moreInfo(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }
  // Registry device_id of the ThesslaGreen device (from any resolved entity).
  _deviceId() {
    const reg = this._hass && this._hass.entities;
    if (!reg) return null;
    const en = this._entities || {};
    for (const role of ["power", "speed", "temp_supply", "mode_state", "special"]) {
      const id = en[role];
      if (id && reg[id] && reg[id].device_id) return reg[id].device_id;
    }
    const k = Object.keys(reg).find((x) => reg[x] && reg[x].platform === "thessla_green" && reg[x].device_id);
    return k ? reg[k].device_id : null;
  }
  // Navigate to the device page (all entities); fall back to power more-info.
  _openDevice() {
    const id = this._deviceId();
    if (!id) {
      this._moreInfo(this._entities && this._entities.power);
      return;
    }
    history.pushState(null, "", `/config/devices/device/${id}`);
    const ev = new Event("location-changed", { bubbles: true, composed: true });
    ev.detail = { replace: false };
    window.dispatchEvent(ev);
  }
  _icon(path, cls = "") {
    return `<svg class="ic ${cls}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  }

  // Current operating mode: 0=Auto, 1=Manual, 2=Temporary (null if unknown).
  _mode() {
    const en = this._entities;
    let m = this._num(en.mode_state);
    if (m === null && this._stateObj(en.mode_switch)) m = this._isOn(en.mode_switch) ? 0 : 1;
    return m;
  }
  // Active special function option (or null when none / "Brak trybu").
  _activeSpecial() {
    const s = this._state(this._entities.special);
    return s != null && s !== SPECIAL_NONE ? s : null;
  }

  // ---- Render --------------------------------------------------------------
  _render() {
    if (!this._hass) return;
    if (!this._entities || !this._resolvedViaRegistry) {
      const r = resolveEntities(this._hass, this._config.entities);
      this._entities = r.map;
      this._resolvedViaRegistry = r.viaRegistry;
    }
    if (!this._built) this._build();
    this._update();
  }

  _build() {
    const c = this._config;
    const t = (k) => this._t(k);
    const fns = SPECIAL_FUNCTIONS.filter((f) => !c.functions || c.functions.includes(f.option));

    // Unified mode tiles: Auto, Manual, visible specials, and (read-only) Temporary.
    const tile = (kind, val, icon, label, extra = "") =>
      `<button class="mtile ${extra}" data-kind="${kind}" data-val="${val}" title="${label}">
         ${this._icon(icon)}<span>${label}</span></button>`;
    const modeTiles =
      tile("mode", "auto", MODE_ICONS.auto, t("auto")) +
      tile("mode", "manual", MODE_ICONS.manual, t("manual")) +
      fns.map((f) => tile("special", f.option, f.icon, t(f.key))).join("") +
      tile("temp", "temporary", MODE_ICONS.temporary, t("temporary"), "ro");

    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="wrap" data-off="false" data-accent="${c.accent}">
          <header>
            <button class="dev" data-el="power" title="${t("power")}">${this._icon(ICONS.power)}</button>
            <span class="title" data-el="title" title="${t("device")}">${c.name || t("name")}</span>
            <div class="head-right">
              <button class="warn" data-el="warn" hidden>${this._icon(ICONS.alert)}</button>
              <button class="season-pill" data-el="season" title="${t("season")}">
                <span data-el="season-ic"></span><span data-el="season-txt">—</span>
              </button>
            </div>
          </header>

          ${c.show_diagram ? this._diagram() : ""}

          <div class="status" data-el="status"></div>

          <div class="modes" data-el="modes">${modeTiles}</div>

          <!-- Intensity: only shown/editable in Manual mode -->
          <div class="speed-row" data-el="speed-row">
            <button class="round" data-el="speed-dn" title="−">−</button>
            <div class="speed-track" data-el="speed-track">
              <div class="speed-fill" data-el="speed-fill"></div>
              <span class="speed-cap" data-el="speed-cap">${t("intensity")}</span>
            </div>
            <button class="round" data-el="speed-up" title="+">+</button>
          </div>

          ${
            c.show_metrics
              ? `<div class="metrics">
                  <button class="metric" data-mref="efficiency"><span class="mv" data-el="m-eff">—</span><span class="ml">${t("efficiency")}</span></button>
                  <button class="metric" data-mref="recovery_power"><span class="mv" data-el="m-pow">—</span><span class="ml">${t("recovery")}</span></button>
                  <button class="metric" data-mref="cop"><span class="mv" data-el="m-cop">—</span><span class="ml">${t("cop")}</span></button>
                </div>`
              : ""
          }

          <div class="chips">
            <button class="chip" data-el="bypass">${this._icon(ICONS.bypass)}<span>${t("bypass")}</span><b data-el="bypass-txt">—</b></button>
            <button class="chip" data-el="filter">${this._icon(ICONS.filter)}<span>${t("filters")}</span><b data-el="filter-txt">—</b></button>
          </div>
        </div>
      </ha-card>
    `;

    const q = (name) => this.shadowRoot.querySelector(`[data-el="${name}"]`);
    this._e = {
      wrap: this.shadowRoot.querySelector(".wrap"),
      power: q("power"),
      title: q("title"),
      warn: q("warn"),
      season: q("season"),
      seasonIc: q("season-ic"),
      seasonTxt: q("season-txt"),
      status: q("status"),
      speedRow: q("speed-row"),
      speedFill: q("speed-fill"),
      speedCap: q("speed-cap"),
      speedDn: q("speed-dn"),
      speedUp: q("speed-up"),
      track: q("speed-track"),
      modes: q("modes"),
      mEff: q("m-eff"),
      mPow: q("m-pow"),
      mCop: q("m-cop"),
      bypass: q("bypass"),
      bypassTxt: q("bypass-txt"),
      filter: q("filter"),
      filterTxt: q("filter-txt"),
      dIntake: q("d-intake"),
      dExtract: q("d-extract"),
      dSupply: q("d-supply"),
      dTarget: q("d-target"),
      dFpx: q("d-fpx"),
      dFlowSup: q("d-flow-sup"),
      dFlowExt: q("d-flow-ext"),
      dPctSup: q("d-pct-sup"),
      dPctExt: q("d-pct-ext"),
      filtFillSup: q("fmask-sup"),
      filtFillExt: q("fmask-ext"),
      dAmbient: q("d-ambient"),
      probe: q("probe"),
      bp: q("bp"),
      bpThr: q("bp-thr"),
      bpThrT: q("bp-thr-t"),
      hx: q("hx"),
      hex: this.shadowRoot.querySelector(".hex"),
      flows: this.shadowRoot.querySelectorAll(".flow"),
    };
    this._e.modeTiles = Array.from(this._e.modes.querySelectorAll(".mtile"));

    this._wire();
    this._built = true;
  }

  // Minimalist ThesslaGreen-style airflow schematic (viewBox 0 0 480 200).
  //  left = outdoor side, right = house side. Ducts run edge-to-edge (no inner
  //  padding). Values carry data-mref → tap opens more-info (with history).
  _diagram() {
    const bg = "var(--tg-card-bg)";
    // Fan icon only (no background mask, no group — the caller wraps it with its
    // readouts in one interactive group, and the duct mask is a separate layer).
    const fanIcon = (cx, cy, color, dir) => {
      const tri =
        dir === "r"
          ? `${cx - 5},${cy - 7} ${cx + 7},${cy} ${cx - 5},${cy + 7}`
          : `${cx + 5},${cy - 7} ${cx - 7},${cy} ${cx + 5},${cy + 7}`;
      return `<circle class="fan-c" cx="${cx}" cy="${cy}" r="14" style="stroke:${color}"/>`
           + `<polygon class="fan-t" points="${tri}" style="fill:${color}"/>`;
    };
    // Air filter: a hatched box straddling the duct (before the fan). Drawn twice —
    // a faint "ghost" (whole filter) and a solid copy clipped from the top in
    // _update so its visible height = % of filter life STILL left. Clickable.
    const fbox = (L, cx, R, T, cy, B) =>
      `<rect class="filt-b" x="${L}" y="${T}" width="${R - L}" height="${B - T}"/>`
      + `<line class="filt-b" x1="${L}" y1="${cy}" x2="${cx}" y2="${T}"/>`
      + `<line class="filt-b" x1="${L}" y1="${B}" x2="${R}" y2="${T}"/>`
      + `<line class="filt-b" x1="${cx}" y1="${B}" x2="${R}" y2="${cy}"/>`;
    // Filter layers only (no background mask, no group). Caller wraps in an
    // interactive .filt-grp; the duct mask is a separate always-opaque layer.
    const filterLayers = (cx, cy, clipId, clipEl) => {
      const w = 5, h = 11, L = cx - w, R = cx + w, T = cy - h, B = cy + h;
      const box = fbox(L, cx, R, T, cy, B);
      return `<clipPath id="${clipId}"><rect data-el="${clipEl}" x="${L - 1}" y="${T}" width="${2 * w + 2}" height="${2 * h}"/></clipPath>`
        + `<g class="filt-ghost">${box}</g>`
        + `<g class="filt-live" clip-path="url(#${clipId})">${box}</g>`;
    };
    // Arrow centered on (x,y): a short shaft + chevron head (like "→"), always
    // solid so the duct shows a line through the arrow even between flow dashes.
    // Rotated `a`° to follow the flow (SVG rotate is clockwise; y-axis points down).
    const arrow = (x, y, a, color) =>
      `<path class="ah" d="M${x - 6},${y}L${x + 2},${y}M${x - 2},${y - 5}L${x + 6},${y}L${x - 2},${y + 5}" transform="rotate(${a} ${x} ${y})" style="stroke:${color}"/>`;
    const F = FLOW;
    // Rounded-corner path from a point list. Closed → every corner rounded;
    // open → the two endpoints stay sharp, inner corners rounded (radius r).
    const roundPath = (pts, r, close) => {
      const n = pts.length, seg = [];
      const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const unit = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
      for (let i = 0; i < n; i++) {
        const c = pts[i];
        if (!close && (i === 0 || i === n - 1)) {
          seg.push(`${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`);
          continue;
        }
        const p = pts[(i - 1 + n) % n], q = pts[(i + 1) % n];
        const rr = Math.min(r, D(p, c) / 2, D(q, c) / 2); // clamp so short edges don't overlap
        const [ax, ay] = unit(p, c), [bx, by] = unit(q, c);
        seg.push(`${i === 0 ? "M" : "L"}${(c.x + ax * rr).toFixed(1)},${(c.y + ay * rr).toFixed(1)}`);
        seg.push(`Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${(c.x + bx * rr).toFixed(1)},${(c.y + by * rr).toFixed(1)}`);
      }
      return seg.join(" ") + (close ? " Z" : "");
    };
    // Flat-top hexagon, lightly rounded.
    const hexPath = roundPath(
      [{x:216,y:70},{x:264,y:70},{x:288,y:112},{x:264,y:154},{x:216,y:154},{x:192,y:112}], 5, true);
    // Counter-flow core: 7 horizontal lines (top/bottom-edge width) whose left ends
    // run parallel to the upper-left edge down to the lower-left edge, and right
    // ends parallel to the lower-right edge up to the upper-right edge.
    let corePath = "";
    // Ys chosen so the VISIBLE gaps are equal: top border inner edge (70 + 3/2) →
    // 7 lines (stroke 1) → bottom inner edge (154 − 3/2), split into 8 equal gaps.
    // gap = ((152.5 − 71.5) − 7·1) / 8 = 9.25 → first line 81.25, step 10.25.
    for (let k = 1; k <= 7; k++) {
      const Y = 81.25 + (k - 1) * 10.25;
      const sx = 216 - (2 / 7) * (154 - Y), sy = (Y + 154) / 2;
      const ex = 264 + (2 / 7) * (Y - 70), ey = (Y + 70) / 2;
      corePath += roundPath([{x:sx,y:sy},{x:216,y:Y},{x:264,y:Y},{x:ex,y:ey}], 3, false) + " ";
    }
    corePath = corePath.trim();
    // Bypass ribbon: intake→supply, thin at the ends (diagonals at 60°, parallel
    // to the hexagon's side edges), swelling into a labelled bar across the middle.
    const RIBBON = roundPath([
      { x: 205.3, y: 90.3 }, { x: 216, y: 104 }, { x: 264, y: 104 }, { x: 277.3, y: 132.3 },
      { x: 274.7, y: 133.7 }, { x: 264, y: 120 }, { x: 216, y: 120 }, { x: 202.7, y: 91.7 },
    ], 3, true);
    // Ducts: horizontal run + a rounded kink into the exchanger's slanted face.
    const DUCTS = [
      [F.intake, [[6, 70], [192, 70], [204, 91]]],
      [F.extract, [[474, 70], [288, 70], [276, 91]]],
      [F.exhaust, [[204, 133], [192, 154], [6, 154]]],
      [F.supply, [[276, 133], [288, 154], [474, 154]]],
    ];
    const ductD = (p) => roundPath(p.map(([x, y]) => ({ x, y })), 5, false);
    return `
      <div class="diagram">
        <svg viewBox="0 0 480 200" class="diag" role="img" aria-label="Airflow diagram">
          <defs>
            <linearGradient id="bpgrad" gradientUnits="userSpaceOnUse" x1="210" y1="112" x2="270" y2="112">
              <stop offset="0" stop-color="${F.intake}"/><stop offset="1" stop-color="${F.supply}"/>
            </linearGradient>
            <mask id="bpk" maskUnits="userSpaceOnUse" x="198" y="84" width="86" height="56">
              <rect x="198" y="84" width="86" height="56" fill="#fff"/>
              <text class="bp-cut" x="240" y="115" text-anchor="middle" fill="#000">BYPASS</text>
            </mask>
          </defs>
          <!-- Duct base tracks: horizontal run level with the exchanger's flat
               top/bottom, then a rounded 60° kink along its slanted face into it -->
          ${DUCTS.map((d) => `<path class="track" d="${ductD(d[1])}" style="stroke:${d[0]}"/>`).join("\n          ")}

          <!-- Animated flow pulses (point order = airflow direction) -->
          ${DUCTS.map((d) => `<path class="flow" d="${ductD(d[1])}" style="stroke:${d[0]}"/>`).join("\n          ")}

          <!-- Two arrows per duct: one mid-slant by the exchanger, one at the duct end -->
          ${arrow(198, 80.5, 60, F.intake)}   ${arrow(12, 70, 0, F.intake)}
          ${arrow(282, 80.5, 120, F.extract)} ${arrow(468, 70, 180, F.extract)}
          ${arrow(198, 143.5, 120, F.exhaust)} ${arrow(12, 154, 180, F.exhaust)}
          ${arrow(282, 143.5, 60, F.supply)}  ${arrow(468, 154, 0, F.supply)}

          <!-- Counter-flow core pattern (heat-exchanger symbol), drawn UNDER the
               outline; fades out when the bypass is actually open — set in _update -->
          <path class="hx-core" data-el="hx" d="${corePath}"/>
          <!-- Bypass route (intake → supply, skipping the core): drawn under the
               outline but over the pattern; grey when closed, gradient when open -->
          <g class="bp" data-el="bp">
            <path class="bp-mask" d="${RIBBON}"/>
            <path class="bp-band" d="${RIBBON}" mask="url(#bpk)"/>
            <g class="bp-thr" data-el="bp-thr">
              <rect class="bp-thr-bg" x="219" y="124.5" width="42" height="13" rx="3"/>
              <text class="bp-thr-t" data-el="bp-thr-t" x="240" y="134" text-anchor="middle"></text>
            </g>
          </g>
          <!-- Heat exchanger: flat-top hexagon (near-regular, lightly rounded) -->
          <path class="hex" d="${hexPath}"/>

          <!-- Ambient (TO) sensor: a probe hanging under the exchanger -->
          <g data-el="probe">
            <path class="probe" d="M220,154 V170 q0,5 4,5 q4,0 4,-5 q0,-3 3,-3 H262"/>
            <text class="temp" data-el="d-ambient" data-mref="temp_ambient" x="258" y="184" text-anchor="middle">—</text>
          </g>

          <!-- Line masks: keep the duct + its animation from showing under the
               icons. Always opaque, non-interactive (never dimmed on hover). -->
          <circle cx="160" cy="70" r="14" fill="${bg}"/>
          <circle cx="320" cy="70" r="14" fill="${bg}"/>
          <rect x="92" y="58" width="31" height="24" fill="${bg}"/>
          <rect x="356" y="58" width="12" height="24" fill="${bg}"/>

          <!-- Intake duct (czerpnia): filter + FPX pre-heater grouped, then supply fan -->
          <g data-mref="filter_wear_sup" class="filt-grp">${filterLayers(98, 70, "fclip-sup", "fmask-sup")}<rect class="hitbox" x="92" y="57" width="12" height="26"/></g>
          <g data-mref="temp_fpx" class="grp">
            <polyline class="coil" points="116,59 122,64 110,70 122,76 116,81"/>
            <text class="tag" x="107" y="53" text-anchor="middle">FPX</text>
            <text class="sub" data-el="d-fpx" x="107" y="97" text-anchor="middle"></text>
            <rect class="hitbox" x="104" y="46" width="24" height="54"/>
          </g>
          <g data-mref="flow_supply" class="grp">
            ${fanIcon(160, 70, F.intake, "r")}
            <text class="sub" data-el="d-pct-sup"  x="160" y="97"  text-anchor="middle"></text>
            <text class="sub" data-el="d-flow-sup" x="160" y="108" text-anchor="middle"></text>
            <rect class="hitbox" x="142" y="54" width="36" height="62"/>
          </g>

          <!-- Extract duct (wywiew): filter, then extract fan -->
          <g data-mref="filter_wear_ext" class="filt-grp">${filterLayers(362, 70, "fclip-ext", "fmask-ext")}<rect class="hitbox" x="356" y="57" width="12" height="26"/></g>
          <g data-mref="flow_extract" class="grp">
            ${fanIcon(320, 70, F.extract, "l")}
            <text class="sub" data-el="d-pct-ext"  x="320" y="97"  text-anchor="middle"></text>
            <text class="sub" data-el="d-flow-ext" x="320" y="108" text-anchor="middle"></text>
            <rect class="hitbox" x="302" y="54" width="36" height="62"/>
          </g>

          <!-- Stream names -->
          <text class="fname" x="5"   y="58"  style="fill:${F.intake}"  text-anchor="start">${this._t("intake")}</text>
          <text class="fname" x="475" y="58"  style="fill:${F.extract}" text-anchor="end">${this._t("extract")}</text>
          <text class="fname" x="5"   y="176" style="fill:${F.exhaust}" text-anchor="start">${this._t("exhaust")}</text>
          <text class="fname" x="475" y="176" style="fill:${F.supply}"  text-anchor="end">${this._t("supply")}</text>

          <!-- Temperatures: intake/extract below the top ducts, supply above the
               bottom-right duct (clickable → history) -->
          <text class="temp" data-el="d-intake"  data-mref="temp_intake"  x="45"  y="89"  text-anchor="middle">—</text>
          <text class="temp" data-el="d-extract" data-mref="temp_extract" x="435" y="89"  text-anchor="middle">—</text>
          <text class="temp" data-el="d-supply"  data-mref="temp_supply"  x="435" y="146" text-anchor="middle">—</text>
          <text class="sub"  data-el="d-target"  data-mref="target_temp"  x="435" y="134" text-anchor="middle"></text>
        </svg>
      </div>`;
  }

  _lock(scopes, spinEl, check) {
    if (check()) return;
    this._pending = { scopes: new Set(scopes), spin: spinEl, check, until: Date.now() + PENDING_TIMEOUT };
    clearTimeout(this._pendTimer);
    this._pendTimer = setTimeout(() => {
      this._pending = null;
      this._update();
    }, PENDING_TIMEOUT + 250);
    this._update();
  }

  _wire() {
    const en = () => this._entities;

    this._e.power.onclick = () => {
      const want = !this._isOn(en().power);
      this._toggleSwitch(en().power, want);
      this._lock(SCOPE_ALL, this._e.power, () => this._isOn(en().power) === want);
    };

    this._e.warn.onclick = () => this._moreInfo(this._warnTarget);
    this._e.title.onclick = () => this._openDevice();

    this._e.season.onclick = () => {
      const next = this._state(en().season) === "Zima" ? "Lato" : "Zima";
      this._selectOption(en().season, next);
      this._lock(["season"], this._e.season, () => this._state(en().season) === next);
    };

    const cur = () => {
      const s = this._num(en().speed);
      return s === null ? 0 : s;
    };
    const setSpeed = (val, spinEl) => {
      this._setNumber(en().speed, val);
      this._lock(["intensity"], spinEl, () => {
        const n = this._num(en().speed);
        return n !== null && Math.round(n) === val;
      });
    };
    this._e.speedDn.onclick = () => setSpeed(clamp(cur() - this._config.speed_step, 0, 100), this._e.speedDn);
    this._e.speedUp.onclick = () => setSpeed(clamp(cur() + this._config.speed_step, 0, 100), this._e.speedUp);
    this._e.track.onclick = (ev) => {
      const r = this._e.track.getBoundingClientRect();
      const val = clamp(Math.round(((ev.clientX - r.left) / r.width) * 100), 0, 100);
      setSpeed(val, this._e.track);
    };

    this._e.modeTiles.forEach((tl) => {
      if (tl.dataset.kind === "temp") return; // read-only indicator
      tl.onclick = () => {
        const kind = tl.dataset.kind;
        const val = tl.dataset.val;
        if (kind === "mode") {
          const wantMode = val === "auto" ? 0 : 1;
          this._toggleSwitch(en().mode_switch, wantMode === 0); // on=Auto(0), off=Manual(1)
          const hadSpecial = this._activeSpecial() !== null;
          if (hadSpecial) this._selectOption(en().special, SPECIAL_NONE); // base mode cancels specials
          this._lock(
            ["modes", "intensity"],
            tl,
            () => this._mode() === wantMode && this._activeSpecial() === null
          );
        } else {
          const want = this._state(en().special) === val ? SPECIAL_NONE : val;
          this._selectOption(en().special, want);
          this._lock(["modes", "intensity"], tl, () => (this._state(en().special) ?? SPECIAL_NONE) === want);
        }
      };
    });

    this._e.bypass.onclick = () => {
      const want = !this._isOn(en().bypass);
      this._toggleSwitch(en().bypass, want);
      this._lock(["bypass"], this._e.bypass, () => this._isOn(en().bypass) === want);
    };

    this._e.filter.onclick = () => this._moreInfo(en().filter_change);
    this.shadowRoot.querySelectorAll("[data-mref]").forEach((el) => {
      el.onclick = () => this._moreInfo(en()[el.dataset.mref]);
    });
    // Both filters read as one: hovering either highlights both.
    const filts = this.shadowRoot.querySelectorAll(".filt-grp");
    filts.forEach((f) => {
      f.addEventListener("mouseenter", () => filts.forEach((g) => g.classList.add("hover")));
      f.addEventListener("mouseleave", () => filts.forEach((g) => g.classList.remove("hover")));
    });
  }

  _applyPending() {
    const p = this._pending;
    const groups = p ? p.scopes : null;
    const apply = (el, group) => {
      if (!el) return;
      const blocked = !!groups && groups.has(group);
      const isSpin = blocked && p && el === p.spin;
      el.classList.toggle("pending", isSpin);
      el.classList.toggle("blocked", blocked && !isSpin);
      if ("disabled" in el) el.disabled = blocked;
      else el.style.pointerEvents = blocked ? "none" : "";
    };
    apply(this._e.power, "power");
    apply(this._e.season, "season");
    apply(this._e.speedDn, "intensity");
    apply(this._e.speedUp, "intensity");
    apply(this._e.track, "intensity");
    this._e.modeTiles.forEach((tl) => tl.dataset.kind !== "temp" && apply(tl, "modes"));
    apply(this._e.bypass, "bypass");
  }

  _update() {
    const en = this._entities;
    const e = this._e;
    const t = (k) => this._t(k);

    if (this._pending && (this._pending.check() || Date.now() > this._pending.until)) {
      this._pending = null;
      clearTimeout(this._pendTimer);
    }

    // Power (header device icon).
    const powerOn = this._isOn(en.power);
    const powerAvail = this._stateObj(en.power) !== undefined;
    e.wrap.dataset.off = powerAvail && !powerOn ? "true" : "false";
    e.power.classList.toggle("on", powerOn);

    // Faults: error = blocking "S" group (red); alarm = "E" warning (amber).
    // (Filter change has its own chip, so it is not duplicated here.)
    const errOn = this._isOn(en.error);
    const almOn = this._isOn(en.alarm);
    const showWarn = errOn || almOn;
    e.warn.hidden = !showWarn;
    e.warn.classList.toggle("critical", errOn);
    this._warnTarget = errOn ? en.error : en.alarm;
    const acode = this._num(en.alarm_code); // fork: blocking S-alarm number (4384)
    e.warn.title = errOn ? `${t("error")}${acode ? ` (${acode})` : ""}` : t("warning");

    // Season.
    const season = this._state(en.season);
    const winter = season === "Zima";
    e.seasonTxt.textContent = season === "Zima" ? t("winter") : season === "Lato" ? t("summer") : "—";
    e.seasonIc.innerHTML = this._icon(winter ? ICONS.snow : ICONS.sun);
    e.season.dataset.season = winter ? "winter" : "summer";

    // Mode + active special.
    const mode = this._mode();
    const special = this._activeSpecial();
    const specialActive = special !== null;

    // Manual intensity (register 4210) — meaningful only in Manual mode.
    const speed = this._num(en.speed);
    const speedPct = clamp(speed ?? 0, 0, 100);
    e.speedFill.style.width = `${speedPct}%`;
    e.speedCap.textContent = speed === null ? t("intensity") : `${t("intensity")} · ${Math.round(speedPct)}%`;

    // Real current airflow (registers 256/257) — truthful in every mode.
    const flowSup = this._num(en.flow_supply);
    const flowExt = this._num(en.flow_extract);
    const airflow = flowSup ?? flowExt;
    const m3 = airflow === null ? "" : ` · ${Math.round(airflow)} m³/h`;
    // Effective fan output % (fork dac sensors) — real intensity in any mode.
    const effPct = this._effPct();
    const pctStr = effPct === null ? "" : ` · ${effPct}%`;

    // Intensity slider only when Manual, powered, no special override.
    const manualEditable = powerOn && !specialActive && mode === 1;
    if (e.speedRow) e.speedRow.hidden = !manualEditable;

    // Mode tiles: highlight the active one; show Temporary only when active.
    e.modeTiles.forEach((tl) => {
      const kind = tl.dataset.kind;
      const val = tl.dataset.val;
      let active = false;
      if (kind === "special") active = special === val;
      else if (kind === "mode") active = !specialActive && ((val === "auto" && mode === 0) || (val === "manual" && mode === 1));
      else if (kind === "temp") {
        active = !specialActive && mode === 2;
        tl.hidden = !active;
      }
      tl.classList.toggle("active", active);
    });

    // Status line: what currently controls the airflow (effective % + m³/h).
    const info = `${pctStr}${m3}`;
    let status;
    if (!powerAvail) status = "";
    else if (!powerOn) status = t("off");
    else if (specialActive) {
      const fn = SPECIAL_FUNCTIONS.find((f) => f.option === special);
      status = `${fn ? t(fn.key) : special} · ${t("active")}${info}`;
    } else if (mode === 1) {
      // Manual: prefer the effective %, else the manual setpoint from the slider.
      const man = effPct !== null ? info : speed === null ? "" : ` · ${Math.round(speedPct)}%`;
      status = `${t("manual")}${man}`;
    } else if (mode === 0) status = `${t("auto")} · ${t("schedule")}${info}`;
    else if (mode === 2) status = `${t("temporary")}${info}`;
    else status = info.replace(/^ · /, "");
    e.status.textContent = status;
    e.status.hidden = !status;

    // Airflow animation: prefer the effective fan % (fork), else real m³/h.
    const running = powerOn && (effPct ?? airflow ?? 0) > 0;
    const dur =
      effPct !== null
        ? clamp(2.6 - effPct / 45, 0.5, 2.6)
        : clamp(2.6 - (airflow ?? 0) / 150, 0.5, 2.6);
    e.flows.forEach((f) => {
      f.style.animationDuration = `${dur}s`;
      f.style.animationPlayState = running ? "running" : "paused";
    });

    // Diagram values.
    if (this._config.show_diagram) {
      e.dIntake.textContent = this._temp(en.temp_intake);
      e.dExtract.textContent = this._temp(en.temp_extract);
      e.dSupply.textContent = this._temp(en.temp_supply);
      e.dFpx.textContent = this._temp(en.temp_fpx);
      e.dFlowSup.textContent = this._flow(en.flow_supply);
      e.dFlowExt.textContent = this._flow(en.flow_extract);
      const ps = this._num(en.fan_supply_pct); // fork: effective fan % (dac)
      const pe = this._num(en.fan_extract_pct);
      e.dPctSup.textContent = ps === null ? "" : `${Math.round(ps)}%`;
      e.dPctExt.textContent = pe === null ? "" : `${Math.round(pe)}%`;
      this._setFilterWear(e.filtFillSup, this._num(en.filter_wear_sup));
      this._setFilterWear(e.filtFillExt, this._num(en.filter_wear_ext));
      const amb = this._num(en.temp_ambient); // reg 22: ambient (TO) probe
      if (e.probe) e.probe.style.display = amb === null ? "none" : "";
      if (e.dAmbient) e.dAmbient.textContent = amb === null ? "" : `${amb.toFixed(1)}°C`;
      const tt = this._num(en.target_temp); // fork: target supply temp (4212)
      e.dTarget.textContent = tt === null ? "" : `${t("target")} ${tt.toFixed(1)}°C`;
    }

    // Bypass: chip = function enable (reg 4320); badge = actuator open now (coil 9).
    const bypassEnabled = this._isOn(en.bypass);
    // Prefer the true bypass status (fork reg 4330: 0=inactive, 1/2=active);
    // fall back to the actuator coil (9) when the fork sensor isn't present.
    const bypStatus = this._num(en.bypass_status);
    const bypassOpen = bypStatus !== null ? bypStatus !== 0 : this._isOn(en.bypass_open);
    // Show the bypass route when the function is armed; add "open" (colour
    // gradient) when the damper is actually open, else it stays grey (closed).
    if (e.bp) {
      e.bp.classList.toggle("show", bypassEnabled);
      e.bp.classList.toggle("open", bypassOpen);
    }
    // Core pattern fades out when the exchanger is actually bypassed.
    if (e.hx) e.hx.style.opacity = bypassOpen ? "0.1" : "0.5";
    // When enabled but closed, show the season activation threshold in the hexagon
    // centre (e.g. "≥ 24°C") so it's clear when the bypass will open.
    if (e.bpThr) {
      const thr = this._num(winter ? en.bypass_heat : en.bypass_cool);
      const showThr = bypassEnabled && !bypassOpen && thr !== null;
      e.bpThr.style.display = showThr ? "" : "none";
      if (e.bpThrT) e.bpThrT.textContent = showThr ? `≥ ${Math.round(thr)}°C` : "";
    }
    // Show BOTH facts at once: is the function enabled, and is the bypass open
    // right now. "Enabled · Closed" = armed but idle (will auto-open when the
    // conditions allow); green = open (active); dimmed = function disabled.
    // Clicking still toggles the bypass function (reg 4320); the tooltip explains.
    e.bypass.classList.toggle("on", bypassOpen);
    e.bypass.classList.toggle("dim", !bypassEnabled);
    e.bypassTxt.textContent = !bypassEnabled
      ? t("disabled")
      : `${t("enabled")} · ${bypassOpen ? t("open") : t("closed")}`;
    e.bypass.title = !bypassEnabled
      ? t("bypass_hint_off")
      : bypassOpen
      ? t("bypass_hint_open")
      : t("bypass_hint_closed");

    // Metrics.
    if (this._config.show_metrics) {
      const eff = this._num(en.efficiency);
      const pow = this._num(en.recovery_power);
      const cop = this._num(en.cop);
      e.mEff.textContent = eff === null ? "—" : `${Math.round(eff)}%`;
      e.mPow.textContent = pow === null ? "—" : `${pow.toFixed(2)} kW`;
      e.mCop.textContent = cop === null ? "—" : cop.toFixed(1);
    }

    // Filters.
    const filterAlarm = this._isOn(en.filter_change);
    e.filter.classList.toggle("warn", filterAlarm);
    const fdays = this._num(en.filter_days); // fork: days to filter change (4660)
    e.filterTxt.textContent = filterAlarm ? t("replace") : fdays !== null ? `${Math.round(fdays)} d` : t("ok");

    this._applyPending();
  }

  // ---- Style ---------------------------------------------------------------
  _css() {
    return `
      :host {
        --tg-accent: var(--primary-color);
        --tg-accent-d: var(--primary-color);
        --tg-on-accent: var(--text-primary-color, #fff);
        --tg-hex: var(--primary-color);
        --tg-winter:#3E9BD6; --tg-summer:#F2A93B; --tg-warn:#E8A33D; --tg-crit:#DB4B3C;
        --tg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
      }
      .wrap[data-accent="thessla"] {
        --tg-accent:#7DB93B; --tg-accent-d:#57811F; --tg-on-accent:#fff; --tg-hex:#15C0DE;
      }
      ha-card { padding:16px; }
      .ic { width:22px; height:22px; fill:currentColor; display:block; }
      .wrap { display:flex; flex-direction:column; gap:14px;
              color:var(--primary-text-color); font-family:var(--paper-font-body1_-_font-family,inherit); }
      .wrap[data-off="true"] .diagram,
      .wrap[data-off="true"] .speed-row,
      .wrap[data-off="true"] .modes { opacity:.42; filter:grayscale(.55); }

      /* Header */
      header { display:flex; align-items:center; gap:11px; }
      .title { flex:1; font-size:1.15rem; font-weight:600; letter-spacing:.2px; min-width:0;
               overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
      .title:hover { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; }
      button { font:inherit; color:inherit; cursor:pointer; border:none; background:none;
               -webkit-tap-highlight-color:transparent; }
      .dev { width:38px; height:38px; flex:0 0 auto; border-radius:50%; display:grid; place-items:center;
             background:var(--secondary-background-color); border:1px solid var(--divider-color);
             color:var(--secondary-text-color); transition:.2s; }
      .dev .ic { width:20px; height:20px; }
      .dev.on { background:var(--tg-accent); color:var(--tg-on-accent); border-color:var(--tg-accent); }
      .head-right { display:flex; align-items:center; gap:8px; }
      .warn { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; color:var(--tg-warn); }
      .warn .ic { width:22px; height:22px; fill:currentColor; }
      .warn.critical { color:var(--tg-crit); }
      .warn[hidden] { display:none; }
      .season-pill { display:flex; align-items:center; gap:5px; padding:5px 11px 5px 8px; border-radius:999px;
                     font-size:.82rem; font-weight:600; background:var(--secondary-background-color);
                     border:1px solid var(--divider-color); }
      .season-pill .ic { width:18px; height:18px; }
      .season-pill[data-season="winter"] { color:var(--tg-winter); }
      .season-pill[data-season="summer"] { color:var(--tg-summer); }

      /* Airflow diagram — fills the full card width, no inner padding */
      .diagram { line-height:0; }
      .diag { width:100%; height:auto; display:block; }
      .diag [data-mref] { cursor:pointer; }
      .diag [data-mref]:hover { opacity:.6; }
      .diag .hex { fill:none; stroke:var(--tg-hex); stroke-width:3; stroke-linejoin:round; transition:.3s; }
      .diag .hx-core { fill:none; stroke:var(--secondary-text-color); stroke-width:1; stroke-linecap:round; stroke-linejoin:round; opacity:.5; transition:opacity .3s; }
      .diag .bp { display:none; }
      .diag .bp.show { display:inline; }
      .diag .ah { fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
      .diag .track { fill:none; stroke-width:2.2; opacity:.3; stroke-linecap:round; stroke-linejoin:round; }
      .diag .coil { fill:none; stroke:var(--secondary-text-color); stroke-width:2; stroke-linejoin:round; opacity:.7; }
      .diag .filt-b { fill:none; stroke:var(--secondary-text-color); stroke-width:1.4; stroke-linecap:round; }
      .diag .filt-ghost { opacity:.25; }
      .diag .filt-live { opacity:1; }
      .diag .filt-grp.hover { opacity:.55; }
      /* Invisible hit target: makes the whole icon area (not just its strokes) hoverable/clickable */
      .diag .hitbox { fill:transparent; pointer-events:all; }
      .diag .probe { fill:none; stroke:var(--secondary-text-color); stroke-width:1.6; opacity:.5; stroke-linecap:round; stroke-linejoin:round; }
      .diag .fan-c { fill:none; stroke-width:2.5; }
      .diag .bp-mask { fill:var(--tg-card-bg); }
      .diag .bp-band { fill:var(--secondary-text-color); opacity:.5; }
      .diag .bp.open .bp-band { fill:url(#bpgrad); opacity:1; }
      .diag .bp-cut { font-size:9px; font-weight:800; letter-spacing:.4px; }
      .diag .bp-thr-bg { fill:var(--tg-card-bg); }
      .diag .bp-thr-t { fill:var(--secondary-text-color); font-size:10px; font-weight:700; }
      .diag .fname { font-size:12px; font-weight:500; letter-spacing:.3px; }
      .diag .temp { fill:var(--primary-text-color); font-size:15px; font-weight:700; font-variant-numeric:tabular-nums; }
      .diag .sub { fill:var(--secondary-text-color); font-size:10px; font-weight:600; font-variant-numeric:tabular-nums; }
      .diag .tag { fill:var(--secondary-text-color); font-size:9px; font-weight:700; letter-spacing:.5px; }
      .flow { fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:12 14; animation:dash 1.6s linear infinite; }
      @keyframes dash { to { stroke-dashoffset:-26; } }  /* = dash+gap → seamless loop */

      /* Status line */
      .status { text-align:center; font-size:.82rem; font-weight:600; color:var(--secondary-text-color);
                font-variant-numeric:tabular-nums; }
      .status[hidden] { display:none; }

      /* Unified mode tiles — always one row; columns adapt to width */
      .modes { display:grid; grid-auto-flow:column; grid-auto-columns:1fr; gap:8px; }
      .mtile { display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
               gap:6px; padding:12px 3px; border-radius:14px; background:var(--secondary-background-color);
               border:1px solid var(--divider-color); color:var(--secondary-text-color);
               font-size:.72rem; font-weight:600; line-height:1.15; text-align:center; transition:.15s; }
      .mtile .ic { width:24px; height:24px; }
      .mtile:hover { border-color:var(--tg-accent); }
      .mtile.active { background:var(--tg-accent); color:var(--tg-on-accent); border-color:var(--tg-accent); }
      .mtile.active .ic { fill:var(--tg-on-accent); }
      .mtile.ro { pointer-events:none; background:transparent; border-color:var(--tg-summer); color:var(--tg-summer); }
      .mtile.ro.active { background:transparent; }
      .mtile.ro.active .ic { fill:var(--tg-summer); }
      .mtile[hidden] { display:none; }

      /* Intensity */
      .speed-row { display:flex; align-items:center; gap:12px; }
      .speed-row[hidden] { display:none; }
      .round { width:40px; height:40px; flex:0 0 auto; border-radius:50%; font-size:1.4rem; line-height:1;
               background:var(--secondary-background-color); border:1px solid var(--divider-color);
               display:grid; place-items:center; }
      .round:active { transform:scale(.94); }
      .speed-track { position:relative; flex:1; height:34px; border-radius:10px;
                     background:var(--secondary-background-color); overflow:hidden; cursor:pointer;
                     border:1px solid var(--divider-color); }
      .speed-fill { position:absolute; inset:0 auto 0 0; width:0;
                    background:linear-gradient(90deg,var(--tg-accent-d),var(--tg-accent)); transition:width .4s ease; }
      .speed-cap { position:absolute; inset:0; display:grid; place-items:center; font-size:.78rem; font-weight:600;
                   color:var(--primary-text-color); text-shadow:0 1px 2px rgba(0,0,0,.18); pointer-events:none; }

      /* Metrics */
      .metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
      .metric { display:flex; flex-direction:column; align-items:center; gap:2px; padding:12px 2px;
                border-radius:12px; background:var(--secondary-background-color); border:1px solid var(--divider-color); }
      .metric .mv { font-size:1.25rem; font-weight:700; color:var(--tg-accent-d); font-variant-numeric:tabular-nums; }
      .metric .ml { font-size:.7rem; color:var(--secondary-text-color); text-transform:uppercase; letter-spacing:.5px; }

      /* Chips (consistent active styling with mode tiles) */
      .chips { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .chip { display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:12px;
              background:var(--secondary-background-color); border:1px solid var(--divider-color);
              font-size:.85rem; color:var(--secondary-text-color); min-width:0; }
      .chip .ic { width:20px; height:20px; flex:0 0 auto; }
      .chip > span { flex:0 0 auto; }
      .chip b { margin-left:auto; color:var(--primary-text-color); font-weight:600;
                min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .chip.on { background:var(--tg-accent); border-color:var(--tg-accent); color:var(--tg-on-accent); }
      .chip.on .ic, .chip.on b { fill:var(--tg-on-accent); color:var(--tg-on-accent); }
      .chip.warn { background:var(--tg-crit); border-color:var(--tg-crit); color:#fff; }
      .chip.warn .ic, .chip.warn b { fill:#fff; color:#fff; }
      .chip.dim { opacity:.5; }

      /* Optimistic-state locking */
      .blocked { opacity:.4 !important; pointer-events:none; }
      .pending { position:relative; pointer-events:none; opacity:.7; }
      .pending::after { content:""; position:absolute; top:50%; left:50%; width:16px; height:16px;
                        margin:-8px 0 0 -8px; border:2px solid currentColor; border-right-color:transparent;
                        border-radius:50%; animation:tgspin .7s linear infinite; }
      @keyframes tgspin { to { transform:rotate(360deg); } }

      button:focus-visible, .metric:focus-visible { outline:2px solid var(--tg-accent); outline-offset:2px; }
      @media (prefers-reduced-motion:reduce) { .flow { animation:none !important; } .pending::after { animation:none; } }
    `;
  }
}

customElements.define("thessla-green-card", ThesslaGreenCard);

// ---------------------------------------------------------------------------
//  Visual editor (native <ha-form>, localized)
// ---------------------------------------------------------------------------
const EDITOR_ROLES = [
  "power", "mode_switch", "mode_state", "speed", "special", "season",
  "bypass", "bypass_open", "temp_intake", "temp_supply", "temp_extract", "temp_fpx",
  "flow_supply", "flow_extract", "efficiency", "recovery_power", "cop",
  "filter_change", "alarm", "error", "comfort", "erv",
];

const EDITOR_I18N = {
  en: {
    name: "Name", speed_step: "Intensity step (%)", show_diagram: "Airflow diagram",
    show_metrics: "Metrics (efficiency / COP)", functions: "Special functions shown",
    accent: "Colours", accent_theme: "Home Assistant theme", accent_thessla: "ThesslaGreen",
    entities: "Entities (override auto-detection)",
    power: "Power (switch)", mode_switch: "Mode Auto/Manual (switch)", mode_state: "Mode state (sensor)",
    speed: "Intensity (number)", special: "Special functions (select)", season: "Season (select)",
    bypass: "Bypass enable (switch)", bypass_open: "Bypass open — actuator (binary_sensor)",
    temp_intake: "Temperature — intake", temp_supply: "Temperature — supply",
    temp_extract: "Temperature — extract", temp_fpx: "Temperature — after FPX",
    flow_supply: "Airflow — supply", flow_extract: "Airflow — extract",
    efficiency: "Efficiency", recovery_power: "Recovery power", cop: "COP",
    filter_change: "Filter change", alarm: "Warning (E group)", error: "Error (S, blocking)",
    comfort: "ECO/Comfort", erv: "ERV mode",
  },
  pl: {
    name: "Nazwa", speed_step: "Krok intensywności (%)", show_diagram: "Schemat przepływu",
    show_metrics: "Metryki (sprawność / COP)", functions: "Widoczne funkcje specjalne",
    accent: "Kolory", accent_theme: "Motyw Home Assistant", accent_thessla: "ThesslaGreen",
    entities: "Encje (nadpisanie auto-wykrywania)",
    power: "Zasilanie (switch)", mode_switch: "Tryb Auto/Ręczny (switch)", mode_state: "Stan trybu (sensor)",
    speed: "Intensywność (number)", special: "Funkcje specjalne (select)", season: "Sezon (select)",
    bypass: "Bypass — włączenie (switch)", bypass_open: "Bypass otwarty — siłownik (binary_sensor)",
    temp_intake: "Temperatura — czerpnia", temp_supply: "Temperatura — nawiew",
    temp_extract: "Temperatura — wywiew", temp_fpx: "Temperatura — za FPX",
    flow_supply: "Strumień — nawiew", flow_extract: "Strumień — wywiew",
    efficiency: "Sprawność", recovery_power: "Moc odzysku", cop: "COP",
    filter_change: "Wymiana filtrów", alarm: "Ostrzeżenie (grupa E)", error: "Błąd (S, blokujący)",
    comfort: "EKO/Komfort", erv: "Tryb ERV",
  },
};

class ThesslaGreenCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _ed(key) {
    const lang = pickLang(this._hass);
    return (EDITOR_I18N[lang] && EDITOR_I18N[lang][key]) ?? EDITOR_I18N.en[key] ?? key;
  }

  async _ensureForm() {
    if (customElements.get("ha-form")) return;
    try {
      const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
      if (helpers) {
        const el = await helpers.createCardElement({ type: "entities", entities: [] });
        if (el && el.constructor && el.constructor.getConfigElement) await el.constructor.getConfigElement();
      }
    } catch (e) {
      /* ignore */
    }
    if (!customElements.get("ha-form")) await customElements.whenDefined("ha-form").catch(() => {});
  }

  _schema() {
    const lang = pickLang(this._hass);
    const t = (k) => this._ed(k);
    return [
      { name: "name", selector: { text: {} } },
      { name: "speed_step", selector: { number: { min: 1, max: 50, step: 1, mode: "box" } } },
      { name: "show_diagram", selector: { boolean: {} } },
      { name: "show_metrics", selector: { boolean: {} } },
      {
        name: "accent",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "theme", label: t("accent_theme") },
              { value: "thessla", label: t("accent_thessla") },
            ],
          },
        },
      },
      {
        name: "functions",
        selector: {
          select: {
            multiple: true,
            mode: "list",
            options: SPECIAL_FUNCTIONS.map((f) => ({ value: f.option, label: I18N[lang][f.key] })),
          },
        },
      },
      {
        type: "expandable",
        name: "",
        title: t("entities"),
        icon: "mdi:tune-variant",
        schema: EDITOR_ROLES.map((role) => ({
          name: role,
          selector: { entity: { integration: "thessla_green", domain: ENTITY_RULES[role].domain } },
        })),
      },
    ];
  }

  _data() {
    const c = this._config || {};
    return {
      name: c.name ?? "",
      speed_step: c.speed_step ?? 5,
      show_diagram: c.show_diagram !== false,
      show_metrics: c.show_metrics !== false,
      accent: c.accent === "thessla" ? "thessla" : "theme",
      functions: Array.isArray(c.functions) ? c.functions : SPECIAL_FUNCTIONS.map((f) => f.option),
      ...(c.entities || {}),
    };
  }

  async _render() {
    if (!this._config || !this._hass) return;
    if (!this._formReady) this._formReady = this._createForm();
    await this._formReady;
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = this._data();
  }

  async _createForm() {
    await this._ensureForm();
    this._form = document.createElement("ha-form");
    this._form.computeLabel = (s) => this._ed(s.name) || s.name;
    this._form.computeHelper = (s) => {
      if (ENTITY_RULES[s.name] && this._hass) {
        const auto = resolveEntities(this._hass, {}).map[s.name];
        return auto ? `Auto: ${auto}` : undefined;
      }
      return undefined;
    };
    this._form.addEventListener("value-changed", (ev) => this._valueChanged(ev));
    this.shadowRoot.appendChild(this._form);
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    const value = ev.detail.value || {};
    const entities = {};
    for (const role of EDITOR_ROLES) if (value[role]) entities[role] = value[role];

    const out = { type: this._config.type || "custom:thessla-green-card" };
    if (value.name) out.name = value.name;
    if (value.speed_step != null) out.speed_step = value.speed_step;
    if (value.show_diagram === false) out.show_diagram = false;
    if (value.show_metrics === false) out.show_metrics = false;
    if (value.accent === "thessla") out.accent = "thessla";
    const allFns = SPECIAL_FUNCTIONS.map((f) => f.option);
    if (Array.isArray(value.functions) && value.functions.length && value.functions.length < allFns.length) {
      out.functions = value.functions;
    }
    if (Object.keys(entities).length) out.entities = entities;

    this._config = out;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: out }, bubbles: true, composed: true }));
  }
}

customElements.define("thessla-green-card-editor", ThesslaGreenCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "thessla-green-card",
  name: "ThesslaGreen Card",
  description: "ThesslaGreen recuperator control panel with airflow diagram.",
  preview: true,
});

console.info(
  `%c THESSLA-GREEN-CARD %c v${TG_VERSION} `,
  "background:#7DB93B;color:#fff;border-radius:3px 0 0 3px;padding:2px 4px;font-weight:700",
  "background:#333;color:#fff;border-radius:0 3px 3px 0;padding:2px 4px"
);
