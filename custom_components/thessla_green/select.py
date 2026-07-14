from __future__ import annotations
import logging

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry

from . import DOMAIN
from .coordinator import ThesslaGreenCoordinator

_LOGGER = logging.getLogger(__name__)

# Settable options → register 4224 (specialMode) write code. The panel can only
# *set* these five canonical functions; "Wietrzenie" is written as 7 (manual).
MODES = {
    "Brak trybu": 0,
    "Wietrzenie": 7,
    "Pusty Dom": 11,
    "Kominek": 2,
    "Okna": 10,
}

# Read map: the device may *report* any documented specialMode variant, not just
# the five we can set. In particular WIETRZENIE has several trigger flavours
# (3-9 — e.g. 8 = started by the AUTO schedule), so without covering them the
# entity fell to "unknown" whenever auto-airing kicked in. Collapse every
# documented code onto one of the settable options so current_option is always
# valid (and the card lights the right tile). Doc: MODBUS_USER_AirPack_Home reg 4224.
MODE_READ_MAP = {
    0: "Brak trybu",
    2: "Kominek",
    3: "Wietrzenie", 4: "Wietrzenie", 5: "Wietrzenie", 6: "Wietrzenie",
    7: "Wietrzenie", 8: "Wietrzenie", 9: "Wietrzenie",
    10: "Okna",
    11: "Pusty Dom",
}

SEASONS = {
    "Lato": 0,
    "Zima": 1,
}

ERV_MODES = {
    "ERV nieaktywny": 0,
    "ERV tryb 1": 1,
    "ERV tryb 2": 2,
}

COMFORT_MODES = {
    "EKO": 0,
    "KOMFORT": 1,
}

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up select entities."""
    modbus_data = hass.data[DOMAIN][entry.entry_id]
    coordinator: ThesslaGreenCoordinator = modbus_data["coordinator"]
    slave = modbus_data["slave"]

    async_add_entities([
        RekuperatorTrybSelect(coordinator=coordinator, slave=slave),
        RekuperatorSezonSelect(coordinator=coordinator, slave=slave),
        RekuperatorErvTrybSelect(coordinator=coordinator, slave=slave),
        RekuperatorKomfortSelect(coordinator=coordinator, slave=slave),
    ])


class RekuperatorTrybSelect(SelectEntity):
    """Representation of Rekuperator Tryb Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4224
        self._slave = slave
        self._attr_name = "Rekuperator Tryb"
        self._attr_options = list(MODES.keys())
        self._value_map = MODE_READ_MAP  # device value → settable option (covers all variants)
        self._reverse_map = MODES
        self._attr_unique_id = f"thessla_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(self._address, code)
            if success:
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during tryb selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    @property
    def extra_state_attributes(self):
        # Raw specialMode code (4224) so the card can tell schedule/sensor-triggered
        # airing (codes 3-6/8/9) from a panel-selected function (7/2/10/11).
        value = self.coordinator.safe_data.holding.get(self._address)
        return {"special_code": value} if value is not None else {}

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))

class RekuperatorSezonSelect(SelectEntity):
    """Representation of Rekuperator Sezon Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4209
        self._slave = slave
        self._attr_name = "Rekuperator Sezon"
        self._attr_options = list(SEASONS.keys())
        self._value_map = {v: k for k, v in SEASONS.items()}
        self._reverse_map = SEASONS
        self._attr_unique_id = f"thessla_sezon_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(self._address, code)
            if success:
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during sezon selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))

class RekuperatorErvTrybSelect(SelectEntity):
    """Representation of ERV mode Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4711
        self._slave = slave
        self._attr_name = "Rekuperator ERV tryb"
        self._attr_options = list(ERV_MODES.keys())
        self._value_map = {v: k for k, v in ERV_MODES.items()}
        self._reverse_map = ERV_MODES
        self._attr_unique_id = f"thessla_erv_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown ERV option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(
                self._address, code
            )
            if success:
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during ERV mode selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )


class RekuperatorKomfortSelect(SelectEntity):
    """Representation of ECO/KOMFORT Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4304
        self._slave = slave
        self._attr_name = "Rekuperator ECO/KOMFORT"
        self._attr_options = list(COMFORT_MODES.keys())
        self._value_map = {v: k for k, v in COMFORT_MODES.items()}
        self._reverse_map = COMFORT_MODES
        self._attr_unique_id = f"thessla_komfort_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown ECO/KOMFORT option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(
                self._address, code
            )
            if success:
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during ECO/KOMFORT selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )
