# Fork changes — extra Modbus registers

**v0.5.0-rc.10** — operating-mode "unknown" fix + Auto-airing display (card **3.0.0-rc.8**).
- **"Rekuperator Tryb" no longer goes `unknown`.** The select mapped only 5 of the documented
  `specialMode` (4224) codes; when the schedule started airing in Auto it reported **8 =
  WIETRZENIE (tryb AUTOMATYCZNY)**, which wasn't mapped → `unknown`. Added a full read map that
  collapses every documented code (incl. the 3–9 airing variants) onto one of the five settable
  options; writing is unchanged. The raw code is now also exposed as a `special_code` attribute.
- **Auto stays Auto while a scheduled function runs.** Base mode (4208) and special function (4224)
  are independent on the device — airing doesn't leave Auto. The card no longer blanks the Auto/Manual
  tile when a *schedule/sensor-triggered* special is active: the base-mode tile stays lit, the special
  shows as a dashed "automatic" tile, and the status line reads e.g. **"Auto · Wietrzenie · aktywne"**.
  A *panel-selected* function (Kominek/Okna/Pusty dom/manual airing) still replaces the base mode as
  before.

**v0.5.0-rc.9** — options-flow 500 fix + tighter SVG crop (card **3.0.0-rc.7**).
- **Options flow no longer 500s.** The handler set `self.config_entry` in its `__init__`, which HA
  deprecated (2024.11) and later removed — on current cores that assignment raises, so opening the
  integration's *Configure* dialog (`POST …/options/flow`) errored out. Dropped the custom `__init__`
  (the base `OptionsFlow` provides `self.config_entry`) and stopped passing the entry to the handler;
  empty power-sensor default now uses `vol.UNDEFINED` instead of `None`.
- Diagram `viewBox` tightened to `0 44 480 147` — the previous crop still left a visible band above
  the drawing; now clamped to the actual content bounds (top = FPX label, bottom = ambient temp).

**v0.5.0-rc.8** — heater symbol + CF sensors + SVG crop (card **3.0.0-rc.6**).
- Diagram heater/cooler symbol is now a flat **spiral coil** (like the product's coil element),
  placed away from the exchanger and centred under the extract-filter icon.
- SVG `viewBox` cropped (`0 20 480 172`) to remove the excess padding above and below the drawing.
- **CF (Constant-Flow) fault sensors** (8330/8331) are now **disabled by default unconditionally** —
  CF detection over Modbus is unreliable (reg 271 answers 0 even without the module), so instead of
  guessing we ship them off; enable them manually on units that actually have CF. Dropped the
  271-based capability probe.

**v0.5.0-rc.7** — secondary heater/cooler on the diagram (card **3.0.0-rc.5**).
- New coil on the supply (nawiew) duct, after the exchanger, driven by `dac_heater` (1282) /
  `dac_cooler` (1283): dim when idle, **warm + %** when heating, **cool + %** when cooling.
  Clickable → heater sensor. Hidden entirely when the unit has neither. New roles `heater_pct`,
  `cooler_pct`.

**v0.5.0-rc.6** — tile tweaks + temp sentinel guard (card **3.0.0-rc.4**).
- Mode tiles: **Auto** no longer shows a % (it's schedule-driven, no fixed setpoint); **Otwarte okno**
  shows **0%** (the function stops the supply fan; `openWindowCoef` reads 101 = out of range).
- Sensor guard: raw `0x8000` (32768) is Thessla's "no reading / sensor error" sentinel — without it a
  faulty/absent temperature probe rendered as ~-3276.8 °C. Now returned as unavailable.

**v0.5.0-rc.5** — capability detection (card unchanged, 3.0.0-rc.3).
- Reads `271 constant_flow_active` + `4704 postHeater_on` to detect what the unit actually has.
- Model-irrelevant entities are created **disabled by default** instead of cluttering the device:
  CF sensor faults (8330/8331) → disabled on non-CF units; "Status ERV" (4704) → disabled without a
  secondary heater. Only affects newly-created entities; existing ones keep their state.
- Mechanism: a `requires:` tag on the entity + a `caps` map — extensible to more functions.

**v0.5.0-rc.4** — dropped misleading bypass mode-2/3 sensors (różnicowanie 4332, intensywność 4333);
the 800v runs bypass mode 1 (damper 100%).

**v0.5.0-rc.3** — filter tweaks + openWindow guard (card **3.0.0-rc.3**).
- Diagram filters are independent again (they're separate entities: supply vs exhaust wear) — hovering
  one no longer highlights both; each opens its own history.
- Filters chip shows **both** wear values (supply / exhaust).
- "Otwarte okno" tile: `openWindowCoef` (4239) reads **101** on the 800v, which is outside the
  documented 0–100 range (a not-set/sentinel value) — the card now hides out-of-range intensities
  instead of showing a bogus "101%".

**v0.5.0-rc.2** — fixes + config on tiles (card **3.0.0-rc.2**).
- Fixed the **visual editor** crash (`ha-form` got an undefined schema — now populated before attach).
- Guarded `customElements.define` against double-load; ambient temp auto-detect now also matches the
  legacy `temperatura_pcb` entity_id (renamed entities keep their old id).
- Mode tiles show their **configured intensity** (Manual/Temporary setpoint, per-function %, + duration
  for timed modes). Bypass chip shows **KOMFORT setpoint + min outdoor temp**; Filters chip shows
  **wear % + days**.
- Bypass now references the **KOMFORT temp (8190)**, not the outdoor free-heat/cool thresholds
  (4322/4323) — the 800v uses mode 1 (damper 100%), so those and the differentiation % (4332/4333)
  are not shown on the card.

**v0.5.0-rc.1** — release candidate. Entity-name fixes + a full airflow-diagram overhaul
(card **3.0.0-rc.1**).
- Entity names corrected against the Modbus doc: sensor 22 "PCB" → **Temperatura otoczenia** (TO);
  4212 → "Temperatura zadana manualny"; removed the redundant `speedmanual` sensor (= number
  "Prędkość"); coil 11 "Potwierdzenie pracy" → **Zasilanie wentylatorów** + new coil 10
  **Potwierdzenie pracy centrali**; 8208 → **Zabezpieczenie termiczne nagrzewnicy** (was "FPX").
- Card diagram rebuilt to match the manufacturer panel: rotated flat-top exchanger (rounded),
  kinked/rounded duct lines with two chevrons each, filters + FPX + fans with proper hit-boxes and
  grouped hover/click, per-fan % + m³/h, filter-wear icons, ambient (TO) probe, counter-flow core
  pattern (fades when bypassed), and a bypass **ribbon** intake→supply with a knocked-out BYPASS
  label — grey when armed-closed, intake→supply gradient when open.
- New roles/entities used: `temp_ambient` (reg 22), `filter_wear_sup/ext` (4482/4483).

**v0.4.1** — more read-only data, no card change. Device page now shows **firmware**
(input regs 0/1/4 → e.g. `4.92.7`) and **serial number** (input regs 24-29) via `device_info`
(merged onto the shared device by the generic sensors). New sensors: **filter wear %**
(4482/4483 — complements "days to change"), **speed presets 1/2/3** (4216-4218, e.g. 30/60/100 %),
and **Temporary-mode target supply temp** (4213, ×0.5 °C). All live-confirmed on the AirPack 800v.
Also adds a **Reconfigure flow** — host / port / slave / scan-interval can now be edited after
setup (integration entry ⋮ → *Reconfigure*), instead of having to delete and re-add the device.

**v0.4.0** — more Modbus data. New read-only sensors for the **bypass configuration** (min /
free-heating / free-cooling thresholds ×0.5 °C, bypass user-mode, flow-differentiation %,
intensity %) and for the **special-function configuration** (fireplace intensity % + duration min,
empty-house intensity %, open-window intensity %). New **fault binary_sensors** (curated, most
diagnostically useful): fire alarm P.POŻ (S10), heater anti-freeze protection (S14/S15), and the
four temperature-sensor faults (S23–S26 — inlet / duct / outdoor / outdoor-2). The card now draws
the active season bypass threshold (`≥ X°C`) in the exchanger when the bypass is enabled but
closed. All registers confirmed live on an AirPack 800v; every fault read 0 (no faults).
Note: the P.POŻ *fire* state is taken from the S10 fault register (8202), **not** the raw digital
input (`ppoz`, DI 15) — that input reads 1 in normal operation, so its polarity is ambiguous.
Filter presostats and the P.POŻ input sit on **discrete inputs (fc2)**, which the integration does
not read yet — deferred.

**v0.3.1** — fix card auto-registration (added `frontend` to manifest dependencies so
`add_extra_js_url` no longer fails with a swallowed `KeyError`; clearer logging). Card now uses
the new entities: effective fan % (dac) in the status line + flow animation, true bypass status
(4330) for the badge, alarm code in the fault tooltip, filter days on the Filters chip, and the
target supply temperature on the diagram — all with graceful fallback when a sensor is absent.


Fork of [aLAN-LDZ/ThesslaGreen_HA](https://github.com/aLAN-LDZ/ThesslaGreen_HA) that exposes
more of the AirPack Modbus map as Home Assistant entities. Branch: `feature/extra-registers`.

All added registers were **confirmed live** against a real AirPack 800v (probe in the companion
`thessla-green-card/tools/tg_probe.py`). Read-only registers become sensors; the temporary
intensity is a writable number.

## What changed

### `modbus_controller.py`
- **Hardened `fetch_data`**: each register block is now read independently. A block the device
  doesn't support (illegal address) or that errors transiently is **skipped** instead of failing
  the whole update — so optional/model-specific registers can't take the integration offline.
  If *no* block reads at all (device unreachable), the update still fails (entities go
  unavailable and HA retries).
- Added holding blocks: `1280-1283` (fan/heater/cooler PWM), `4212` (target supply temp),
  `4230`, `4233` (airing config), `4330` (bypass status), `4354-4355` (nominal airflow),
  `4384` (stop-alarm code), `4401` (temporary intensity), `4660`, `4662` (filter days),
  `8190` (comfort target temp). Widened input block to `16-22` (adds TN2 duct temp 20, GWC temp 21).

### `sensor.py` — new sensors
| Entity name | Register | Meaning |
|---|---|---|
| Rekuperator Wydajność nawiew / wywiew | 1280 / 1281 | effective fan output % (PWM, works in any mode) |
| Rekuperator Nagrzewnica / Chłodnica | 1282 / 1283 | duct heater / cooler output % |
| Rekuperator Strumień nominalny nawiew / wywiew | 4354 / 4355 | 100% reference airflow (m³/h) |
| Rekuperator Status bypass | 4330 | true current bypass status (0=inactive, 1/2=active) |
| Rekuperator Kod alarmu | 4384 | blocking S-alarm number (0=none) |
| Rekuperator Temperatura zadana | 4212 | target supply temp (×0.5 °C) |
| Rekuperator Temperatura komfort | 8190 | KOMFORT target temp (×0.5 °C) |
| Rekuperator Wietrzenie intensywność / czas | 4230 / 4233 | airing configured intensity % / duration min |
| Rekuperator Filtr nawiew / wywiew dni | 4660 / 4662 | days to filter change |

### `number.py` — new control
- **Rekuperator Prędkość chwilowa** (register 4401) — intensity for Temporary mode.

### `manifest.json`
- version `0.2.5` → `0.3.0`; `dependencies: ["http"]` (for serving the card);
  documentation/issue_tracker point to the fork; added codeowner.

## Install / test

Replace the files in your HA `config/custom_components/thessla_green/` with this fork's
(or install the fork via HACS as a custom repository), then **restart Home Assistant**.
New entities appear under the *Rekuperator Thessla* device, e.g.
`sensor.rekuperator_thessla_rekuperator_wydajnosc_nawiew`,
`sensor.rekuperator_thessla_rekuperator_status_bypass`,
`number.rekuperator_thessla_rekuperator_predkosc_chwilowa`.

Not-installed hardware reads 0 (e.g. GWC temp, duct heater/cooler on units without them) — those
sensors will simply show 0; the Constant-Flow-only registers (272/273 etc.) are not read.

## Bundled Lovelace card

This fork also **bundles and auto-registers** the `custom:thessla-green-card` Lovelace card
(`custom_components/thessla_green/www/thessla-green-card.js`) — `__init__.py` serves it and loads
it as a frontend module, so no manual `/config/www` copy or dashboard resource is needed. See
[CARD.md](CARD.md).

## Notes
- Register semantics verified against `MODBUS_USER_AirPack_Home` / `ProtokolModbusRTU_AirPack4`
  and confirmed by live reads on an AirPack 800v.
- (Earlier probe timeouts were just the laptop being off the home LAN — not a gateway
  connection limit.)
