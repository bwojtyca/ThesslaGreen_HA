# ThesslaGreen Lovelace card (bundled)

This fork ships a custom Lovelace card (`custom:thessla-green-card`) that reproduces the
Air++ / AirS control screen: airflow diagram, unified mode selector, season, bypass,
efficiency / thermal balance / benefit index, filter + fault status.

The card file lives in `custom_components/thessla_green/www/thessla-green-card.js` and is
**auto-registered** by the integration (served at `/thessla_green/thessla-green-card.js` and
loaded as a frontend module). **No manual step** — after installing the integration and
restarting HA, add a card and search for “ThesslaGreen”, or paste:

```yaml
type: custom:thessla-green-card
```

If it doesn't appear, hard-refresh the browser (Ctrl/Cmd+Shift+R). Bump `CARD_VERSION` in
`__init__.py` to bust the browser cache after editing the card.

## Config (all optional; entities are auto-detected)

```yaml
type: custom:thessla-green-card
name: Rekuperator          # header title (default: localized)
speed_step: 5              # −/+ intensity step (%)
show_diagram: true         # airflow schematic
show_metrics: true         # efficiency / thermal balance / benefit index
accent: theme              # "theme" (HA --primary-color, default) or "thessla"
functions:                 # which special functions to show (default: all)
  - Wietrzenie
  - Pusty Dom
  - Okna
entities: {}               # override auto-detection per role (see the editor)
```

- **Language** follows the HA user (pl/en). Values written to `select` entities stay Polish.
- **Modes**: Auto/Manual toggle + special functions in one grid; Temporary is a read-only
  indicator. The active mode takes over the UI; the intensity slider shows only in Manual.
- **Bypass**: the chip toggles the bypass *function* (reg 4320); the diagram badge shows the
  actuator open now (coil 9). With the extra fork registers you can switch the badge to the true
  status (`sensor.…_status_bypass`, reg 4330) via the entity override.
- **Optimistic locking**: after a command the control is disabled + spinner until HA confirms.
- Faults: header icon amber (E warning) / red (S blocking). Tap any value → history.

Development workspace (notes, register maps, Modbus probe) lives outside this repo in the
author's `thessla-green-card/` folder — see its `PROJECT.md`.
