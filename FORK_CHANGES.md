# Fork changes — extra Modbus registers

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
