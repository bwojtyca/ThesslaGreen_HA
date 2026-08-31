# Fork changes — extra Modbus registers

## v0.5.3 — card 3.2.1 — fix: card intermittently showed "Configuration error"

Bugfix only, no entity or behaviour changes.

The card is auto-loaded from `index.html` (`frontend.add_extra_js_url`), so it is evaluated in
parallel with the frontend's own `app.js` — not after it. Early in its boot, `app.js` installs the
scoped custom element registry polyfill, which **replaces `window.customElements` with a new, empty
registry**. A tag registered before that swap stays in the native registry only, so Lovelace's
`customElements.get("thessla-green-card")` lookup misses it and renders the **"Configuration
error"** card instead — permanently, because the retry it arms (`customElements.whenDefined`) also
queries the new registry and never fires.

Which side of the swap this file landed on was a pure timing race (measured: card at 17–28 ms,
registry swap at 33–92 ms), so a warm browser cache made the card *lose* — hence "it usually needs
a few reloads". Other custom cards are unaffected because Lovelace *resources* are loaded after the
frontend has booted.

- **Fix**: `customElements.define()` for `thessla-green-card` / `thessla-green-card-editor` is now
  deferred until the frontend's registry is in place (registry swapped, or its own elements
  visible), with a 10 s safety net. Registering late is harmless — Lovelace rebuilds the card as
  soon as the tag is defined.
- Verified against a live HA 2026.8.3 in a real browser: before the fix 4/4 page loads rendered the
  error card, after it 5/5 rendered the card.
- **Hardening**: the weekly-schedule parsing (`_slotsSorted`, `_airingWindows`, `_miniValueAt`,
  `_renderCalendar`) no longer assumes a full, well-formed week. Times go through one
  `minutesOfDay()` helper and both schedule views bail out unless the season holds all 7 days — an
  exception thrown from the card's `hass` setter also shows up as "Configuration error".

## v0.5.2 (stable) — card 3.2.0

Stable release of the 0.5.2 line (rc.1–rc.3 below). Reworks the old "COP" into an honest,
**season-aware thermal benefit** that no longer reads `unavailable` in summer.

- **Sign follows the thermal goal** (season reg 4209): beneficial ΔT = `(Ts − To)` when heating,
  `(To − Ts)` when cooling. Positive = the exchanger helps the goal, negative = works against it,
  ~0 = no effect. Deliberately **signed**; only `unavailable` when data is missing / airflow 0 /
  fan power 0.
- **Renamed** (unique_ids unchanged → history + dashboards survive): `Moc Odzysku` → **`Bilans
  Termiczny`** (kW, signed), `COP` → **`Wskaźnik Korzyści Termicznej`** (dimensionless, signed).
  Both expose `cel` / `status` (korzystna/neutralna/niekorzystna) / `status_opis` / `dt_wymiennik`,
  and carry `state_class = measurement` (line chart + long-term statistics).
- **Bypass-aware**: while the bypass actuator is open (coil 9; fallback reg 4330) the exchanger is
  deliberately bypassed, so its benefit is **not judged** — status goes neutral instead of red.
- **Card 3.2.0**: season-aware tile labels (`Odzysk ciepła` ↔ `Odzysk chłodu`, `Korzyść`),
  colour-by-status (green helps / red works against / muted neutral), status tooltip; entity
  resolution accepts the new and legacy slugs.

---

## v0.5.2-rc.3 (integration only) — card 3.2.0-rc.1

- **Don't judge the exchanger while the bypass is open.** When the bypass actuator is open (coil 9;
  fallback reg 4330 ≠ 0) the core is deliberately bypassed, so rating its "benefit" is meaningless —
  the status now goes **neutralna** ("Bypass aktywny — wymiennik omijany, nie oceniam") instead of
  flagging red. The kW/index value is still computed (continuous chart), just not colour-judged. With
  the bypass **closed**, evaluation is unchanged — so an adverse reading (e.g. summer, cool outside,
  supply warmed to indoor temp) still correctly shows red as a "consider bypass/free-cooling" nudge.
  Verified against live screenshots: bypass off → supply 26.1 °C = extract, 100 % efficiency,
  −0.94 kW (red); bypass on → supply 24.1 °C, neutral.

## v0.5.2-rc.2 (integration only) — card 3.2.0-rc.1

- **Fix: more-info history drew categorical colour-bars + discrete logbook values instead of a line
  chart** for the benefit index. Cause: rc.1 dropped the unit (`x`) to mark it dimensionless, but
  without a unit *or* a `state_class` HA treats a sensor as non-numeric → categorical history. Added
  **`state_class = measurement`** to the three computed sensors (Sprawność, Bilans Termiczny, Wskaźnik
  Korzyści Termicznej) → proper line chart **and** long-term statistics (min/mean/max, usable in
  statistics-graph cards).

## v0.5.2-rc.1 — card 3.2.0-rc.1

Reworks the "COP" metric into an honest, **season-aware thermal benefit** and fixes it reading
`unavailable` in summer.

- **Root cause**: the old COP was `recovery_power / fan_power` and forced to `unavailable` whenever
  recovered heat wasn't positive. In summer the exchanger *cools* the incoming air (supply < intake),
  so `ΔT = Ts − To` is negative → the metric vanished even though the unit worked perfectly.
- **New model — sign follows the thermal goal** (season reg **4209**: Zima→grzanie, Lato→chłodzenie):
  `ΔT_benefit = (Ts − To)` when heating, `(To − Ts)` when cooling. Positive = the exchanger *helps*
  the goal; negative = it works *against* it (e.g. bypass didn't open on a cool summer night); ~0 = no
  effect. This is deliberately **signed** — a negative value is a diagnostic signal, not hidden away.
- **Renamed** (unique_ids unchanged, so history + existing dashboards survive):
  - `Rekuperator Moc Odzysku` → **`Rekuperator Bilans Termiczny`** (kW, signed).
  - `Rekuperator COP` → **`Rekuperator Wskaźnik Korzyści Termicznej`** (dimensionless, signed; unit
    `x` dropped). It is **no longer forced `unavailable`** when working against the goal — only when
    data is missing / airflow is 0 / fan power is 0.
  - Both expose `cel`, `status` (korzystna/neutralna/niekorzystna), `status_opis`, `dt_wymiennik`.
- **Card 3.2.0-rc.1**: the two tiles now carry a **season-aware label** (`Odzysk ciepła` ↔
  `Odzysk chłodu`, `Korzyść`), **colour by status** (green helps / red works against / muted neutral),
  and a **tooltip** with the human explanation. Entity resolution accepts the new and legacy slugs.

---

## v0.5.1 (stable) — card 3.1.0

Stable release of the 0.5.1 line (rc.1–rc.7 below). Adds the **weekly Auto schedule** and reworks the
diagram **flow animation**:
- Integration reads the weekly Auto schedule (regs 16-180, cached on a slow cadence) and exposes it as
  a **"Harmonogram"** sensor (parsed attributes: both seasons × 7 days + airing).
- Card gains two optional, locale-aware **schedule sections**: a **mini chart** under the tiles when
  Auto is active (12 h back / 24 h ahead, night shading from `sun.sun`, airing peak, "now" marker,
  hover tooltip) and a weekly **calendar** heat-grid. Toggle via `show_schedule` / `show_calendar`.
- Flow-pulse **animation** is now **per-duct**, driven by each fan's flow ÷ nominal blended with the
  fan drive %, along a **tunable cubic-bezier** speed curve (`flow_curve: [x1,y1,x2,y2]`).

---

**v0.5.1-rc.7** — animation blend fix + mini-chart gating (card **3.1.0-rc.7**).
- Flow-animation % now uses the **stable true % (272/273)** for the airflow part (blended with the fan
  drive %), instead of the instantaneous flow (256/257) that briefly reads 0 on spin-up — so a fan at
  40 % no longer animates slower than one at 20 %.
- The **mini schedule chart hides unless the Auto tile is active** (not just base-mode Auto) — so it's
  gone in Manual/Temporary and when a panel-selected special is running.

**v0.5.1-rc.6** — smooth (bezier) flow-animation curve (card **3.1.0-rc.6**).
- Flow-pulse speed now follows a **tunable cubic-bezier** curve (CSS-style) instead of a straight
  line — smooth, with a steep drop-off below 10 % and a fast top: **0 %→6 s, 10 %→2.7 s, 50 %→0.8 s,
  75 %→0.4 s, 100 %→0.1 s**. Override with `flow_curve: [x1,y1,x2,y2]` in the card config.
- Per-fan % now **blends airflow % (flow ÷ nominal) with the fan drive % (DAC signal)**, so a fan
  maxed out but only moving e.g. 550 m³/h still animates fast instead of looking slow.

**v0.5.1-rc.5** — per-duct flow-animation speed (card **3.1.0-rc.5**).
- Diagram flow speed is now computed **per fan** from **actual flow ÷ nominal (max)** and scaled
  **linearly: 0 % → 5 s, 100 % → 0.25 s** (was one global speed with a different curve). Uses the
  measured flow / nominal reference (falls back to the true % 272/273, then DAC).
- **Per-duct**: intake follows the supply fan, extract the exhaust fan; **supply = 75 % supply +
  25 % exhaust**, **exhaust = 25 % supply + 75 % exhaust** (the streams mix after the exchanger).

**v0.5.1-rc.4** — schedule chart fixes (card **3.1.0-rc.4**).
- **Airing integrated into the line**: it's now shown as a 100 % **peak of the intensity line** (with
  the same filled area) instead of a separate bar — and 100 % now reaches the top of the box. Calendar
  airing likewise drawn as a full-height column in the base accent colour.
- **Night feathering fixed**: the night band is merged across midnight (one continuous night) and the
  edges that meet the chart boundary are pushed off-canvas, so only the real **sunrise/sunset** edges
  blur — no more lighter bleed at the chart start/end. Same fix on the calendar (clipped to the grid).

**v0.5.1-rc.3** — schedule mini-chart in a slider-style box (card **3.1.0-rc.3**).
- The mini chart's plot now sits in a **box matching the intensity slider** (same background, border,
  rounded corners and 34 px height) for visual consistency; the day/hour labels + "now" dot moved to an
  axis row **below** the box.
- Night overlay switched to **translucent black with feathered (blurred) edges** (~30–60 min fade at
  sunrise/sunset), on both the mini chart and the calendar.
- Overlays (night band, day line, "now" line) capped at the plot height (never above the 100 % airing
  spike); strokes stay crisp under the stretched box (`non-scaling-stroke`).

**v0.5.1-rc.2** — schedule chart polish (card **3.1.0-rc.2**).
- **Mini chart**: dropped the headers; ~⅓ the height; **filled area** under the step line; **night
  shading** (from `sun.sun` sunrise/sunset); **date shown at midnight** on the axis; airing drawn in
  the accent colour (not orange) as a 100 % spike; **hover tooltip** (time · intensity, marks airing).
- **Calendar**: intensity now drawn as **bar height** (not opacity); **night shading** per row from the
  sun entity; airing marked in the same accent style as the mini chart.

**v0.5.1-rc.1** — weekly Auto schedule exposed + card schedule sections (card **3.1.0-rc.1**).
- Integration reads the **weekly Auto schedule** (regs 16-180: 4 time-slots/day/season with intensity
  + target temp, and a per-day airing start time). Static config, so it's read on a slow cadence and
  **cached** — no per-poll cost. Exposed as one **"Harmonogram"** sensor whose attributes hold the
  parsed schedule (summer/winter → 7 days), plus airing duration/intensity. Block reads validated live
  (device caps holding reads at ~17 regs → 16-reg chunks).
- Card gains two **optional schedule sections** (both respect HA locale — 12/24 h + first-day-of-week):
  - **Mini chart** under the mode tiles, shown when **Auto** is active: base intensity over the last
    12 h + next 24 h as a step line, with airing windows and a "now" marker (`show_schedule`, on by default).
  - **Calendar**: a weekly heat-grid (X = 00–24 h, Y = days) coloured by intensity with airing blocks
    marked (`show_calendar`, opt-in).

## v0.5.0 (stable) — card 3.0.0

First stable release of the 0.5.0 line (rc.1–rc.19 below). Highlights:
- **Rebuilt Lovelace card**: manufacturer-style airflow diagram (rotated exchanger, kinked ducts,
  filters/FPX/fans, counter-flow core, bypass ribbon, ambient probe, heater coil), unified mode
  selector with a real drag slider (debounced writes), a dedicated **bypass section**, and a light
  **statistics** strip (efficiency / recovery / COP / filters — each individually toggleable).
- **Much more Modbus data as entities**: effective/true ventilation % (272/273), CF flow + status,
  bypass configuration, special-function configs, curated + full fault codes, firmware / serial,
  filter wear % and days, speed presets, physical **discrete inputs** (filter presostats enabled;
  the rest disabled-by-default).
- **Correctness**: mode never falls to "unknown" (full specialMode map); Auto stays Auto while a
  scheduled function runs; bypass "why closed" only shown when derivable; true ventilation % shown
  instead of the DAC control signal.
- **Robustness / perf**: Reconfigure flow, options-flow 500 fixed, Modbus reads consolidated
  (~41→24 round-trips) with live-validated static blocks, `retries` lowered, and optimistic write
  push for an instant UI.

Everything was confirmed live against a real AirPack 800v.

---

**v0.5.0-rc.19** — full register audit: real ventilation %, CF, physical inputs (card **3.0.0-rc.16**).
Audited every documented register live on the 800v (`tools/audit_registers.py`) — several useful ones
were being missed because we probed them in the wrong Modbus space.
- **True ventilation % (INPUT 272/273)** — the actual airflow %, read as *input* registers (we'd only
  tried them as *holding* = illegal). The card now shows this instead of the DAC control-signal %
  (1280/1281), which over-reads: confirmed live at 25 % (Auto), 75 % (Manual), 20 % (Empty-house),
  100 % (Airing), while DAC showed ~40/81/40/100 %. New sensors: **Wydajność rzeczywista nawiew/wywiew**
  (272/273), **Przepływ CF nawiew/wywiew** (274/275), **Intensywność min/max** (276/277).
- **Constant Flow is actually present** (INPUT 271 = 1). Added a **Constant Flow aktywny** binary_sensor
  and **re-enabled the CF fault sensors** (8330/8331), now gated on real CF detection.
- **Physical inputs (DISCRETE INPUTS)** — never read before. Enabled: **filter presostats**
  (`dp_ahu_filter_overflow` 18, `dp_duct_filter_overflow` 3 — hardware "filter clogged"). Added
  disabled-by-default: heater thermal protections, P.POŻ input, AirS switch positions (speed 1/2/3,
  airing), hood/fireplace/empty-house/air-quality/humidity inputs.
- **Bypass "why closed" gained a case:** open-window stops the supply fan, which holds the bypass shut
  even when the temperatures would open it — now shown as **"nawiew zatrzymany"** (confirmed live).
- Also exposed **Status komfort** (4305).

**v0.5.0-rc.18** — tighter bottom section (card **3.0.0-rc.15**).
- **Bypass** dropped its box (background + heavy padding) — now a borderless row (subtle hover),
  reclaiming the vertical space the padding cost.
- **Statistics** trimmed vertical padding. The **Filters** cell now shows days-to-change and both
  wear %s **on one row, side by side** (equal weight, each still tappable) instead of the wear in a
  third line.

**v0.5.0-rc.17** — Modbus communication optimised (card unchanged, 3.0.0-rc.14).
- **Writes feel instant.** After a successful write the value is now pushed into the cache
  optimistically (`coordinator.apply_optimistic`) so the UI updates immediately, instead of waiting
  for a full re-poll of every register. The scheduled poll reconciles derived values afterwards.
- **~46% fewer Modbus round-trips per poll** (41 → 22): register blocks were statically widened to
  span each function's whole run in a single read. Every widened block was **confirmed live** against
  the 800v with no illegal-address holes (`tools/scan_ranges.py` + `tools/validate_blocks.py`); the
  8xxx fault region keeps a couple of splits where the device caps multi-register reads.
- **Client `retries` 10 → 2** — a single flaky transaction could otherwise stall the whole locked
  poll (and any queued write) for seconds; the tolerant reader + 30 s re-poll already cover a
  skipped block.

**v0.5.0-rc.16** — icon + layout polish (card **3.0.0-rc.14**).
- **Bypass section** trimmed to **two rows** (config now sits next to the title; state + reason below)
  and given a clearer icon (a "step-over" arc = air routed around the exchanger). New **`show_bypass`**
  config toggle (editor: *Bypass section*) to hide the whole section.
- **Mode icons** reworked to match function: Manual → hand, Empty-house → house-with-exit-arrow,
  Open-window → open sash, Fireplace → fireplace (Airing kept — you liked it).
- **Statistics** restyled: label **above** the value. Filters now shows **three tappable values** —
  days-to-change and both wear %s — each opening its own entity (the box itself is no longer a button).

**v0.5.0-rc.15** — bottom-section redesign + mode/bypass detail (card **3.0.0-rc.13**).
- **Mode tiles** are now strictly equal width (`minmax(0,1fr)`), so a long label like "Wietrzenie"
  no longer stretches its column; long words wrap on narrow screens.
- **Statistics** are a new light, borderless section (hairline-separated cells, not buttons) and each
  is **individually toggleable** via `metrics: [...]` in config / a multi-select in the editor. **Filters**
  moved in here as a richer cell (days-to-change + wear %). Example: drop `cop` to hide COP.
- **Bypass** is now its own full-width section (was a cramped chip): icon + title, a real on/off
  **toggle** (the function enable, reg 4320), the state (open / closed / disabled) and its config
  (comfort ° · min °).
- **Auto tile** shows a sub-line of what Auto is doing right now — `harmonogram`, or the active
  auto-triggered function (e.g. `Wietrzenie`).
- **Open-window tile** shows `0% · auto` (fan stopped, no fixed duration), mirroring airing's `% · min`.
- **Bypass "why closed"**: the in-hexagon note + a highlighted reason on the bypass section now appear
  **only when we can actually derive the reason** from live values against the documented logic
  (reg 4321 outdoor-min, 4322 free-heating, 4323 free-cooling): "za zimno na zewnątrz" (outdoor below
  min) or "temperatura w normie" (room temp between the heat/cool thresholds). If the closure can't be
  explained, nothing is shown.

**v0.5.0-rc.13** — slider polish (card **3.0.0-rc.11**).
- Intensity slider shows a **spinner** while the write is being confirmed by the device (after the
  debounce fires), same as the other controls.
- **Handle hidden** — the blue fill on the grey track shows the selection; no separate knob.

**v0.5.0-rc.12** — real drag slider for intensity (card **3.0.0-rc.10**).
- The manual-intensity control is now a native **`<input type="range">`** — it drags like a proper
  slider (was click/tap-only). Same filled-bar look (gradient fill via `--pct`, centred caption) plus
  a handle. Removed the **+/- buttons** and the **`speed_step`** config option (no longer needed).
- Debounce raised to **900 ms**: drag freely; the modbus write goes out only after you stop moving.
  The fill tracks your finger optimistically and reconciles with the device once it confirms.

**v0.5.0-rc.11** — debounced intensity slider + status tidy (card **3.0.0-rc.9**).
- **Manual-intensity slider is now debounced.** Every click/drag used to fire a modbus write
  immediately; now the writes are coalesced — the request goes out only after ~450 ms of no further
  input, so you can click/slide freely and only the final value is sent. The slider updates
  optimistically while you drag and reconciles with the device once it confirms.
- Dropped the redundant "aktywne" word from the status line under the diagram
  (e.g. now **"Auto · Wietrzenie · 100% · 547 m³/h"**).

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
