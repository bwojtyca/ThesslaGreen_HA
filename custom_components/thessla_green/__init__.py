from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, CONF_HOST, CONF_PORT, CONF_SLAVE, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
from .modbus_controller import ThesslaGreenModbusController
from .coordinator import ThesslaGreenCoordinator

import logging
import os

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "switch", "binary_sensor", "select", "number"]

# Lovelace card bundled with the integration. It is served from the integration
# folder and auto-registered as a frontend JS module, so the user does not have
# to copy the file to /config/www/ or add a dashboard resource by hand.
CARD_VERSION = "3.2.1"  # bump to bust the browser cache after card changes
CARD_URL = f"/{DOMAIN}/thessla-green-card.js"
CARD_PATH = os.path.join(os.path.dirname(__file__), "www", "thessla-green-card.js")


async def _register_card(hass: HomeAssistant) -> None:
    """Serve the bundled card and auto-load it as a frontend module."""
    if not os.path.exists(CARD_PATH):
        _LOGGER.error(
            "ThesslaGreen card not found at %s — was the www/ folder installed?", CARD_PATH
        )
        return
    # 1) Serve the file. Prefer the modern async API; only fall back to the
    #    legacy sync one if async_register_static_paths is genuinely missing.
    try:
        from homeassistant.components.http import StaticPathConfig
        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, CARD_PATH, False)]
        )
    except AttributeError:
        try:
            hass.http.register_static_path(CARD_URL, CARD_PATH, False)
        except Exception as e:  # noqa: BLE001
            _LOGGER.error("Could not serve the ThesslaGreen card: %s", e)
            return
    except Exception as e:  # noqa: BLE001
        _LOGGER.error("Could not serve the ThesslaGreen card at %s: %s", CARD_URL, e)
        return
    # 2) Auto-load it as a JS module on the frontend (no manual resource needed).
    #    Requires the `frontend` component to be set up first — declared as a
    #    dependency in manifest.json so DATA_EXTRA_MODULE_URL already exists.
    try:
        from homeassistant.components.frontend import add_extra_js_url
        add_extra_js_url(hass, f"{CARD_URL}?v={CARD_VERSION}")
    except Exception as e:  # noqa: BLE001
        _LOGGER.error("Could not auto-register the ThesslaGreen card module: %s", e)
        return
    _LOGGER.info("ThesslaGreen card served at %s and auto-loaded on the frontend", CARD_URL)


def _capabilities(coordinator) -> dict:
    """Detect which hardware/functions the unit actually has, from the registers
    it exposes. Registers that are illegal on a given model are skipped by the
    tolerant reader, so their absence is a reliable "not present" signal.

    Used to create model-irrelevant entities as *disabled by default* rather than
    cluttering the device with always-zero entities.
    """
    d = coordinator.safe_data
    return {
        "postheater": 4704 in d.holding,  # secondary heater / ERV present
        # Constant-Flow module: INPUT reg 271 responds (=1) only on CF units — the
        # whole 271-277 CF block is illegal-address without it, so presence is reliable.
        "cf": 271 in d.input,
    }


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up from YAML (not used) + register the bundled Lovelace card."""
    await _register_card(hass)
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Thessla Green integration from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    host = entry.data[CONF_HOST]
    port = entry.data[CONF_PORT]
    slave = entry.data[CONF_SLAVE]
    update_interval = entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)

    # Tworzenie kontrolera Modbus
    controller = ThesslaGreenModbusController(
        host=host,
        port=port,
        slave_id=slave,
        update_interval=update_interval,
    )

    # Tworzenie koordynatora danych
    coordinator = ThesslaGreenCoordinator(
        hass=hass,
        controller=controller,
        scan_interval=update_interval,
    )

    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as e:
        _LOGGER.error("Failed to fetch initial data: %s", e)
        return False

    # Zapisywanie instancji w hass.data
    hass.data[DOMAIN][entry.entry_id] = {
        "controller": controller,
        "coordinator": coordinator,
        "slave": slave,
        "scan_interval": update_interval,
        "caps": _capabilities(coordinator),
    }

    # Forward setup dla każdej platformy
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload Thessla Green integration."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    data = hass.data[DOMAIN].pop(entry.entry_id, None)
    if data:
        controller: ThesslaGreenModbusController = data["controller"]
        await controller.stop()

    return unload_ok