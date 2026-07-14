import logging
from datetime import timedelta

from homeassistant.core import callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN
from .modbus_controller import ThesslaGreenModbusController, ControllerData

_LOGGER = logging.getLogger(__name__)


class ThesslaGreenCoordinator(DataUpdateCoordinator[ControllerData]):

    def __init__(self, hass, controller: ThesslaGreenModbusController, scan_interval: int):
        super().__init__(
            hass=hass,
            logger=_LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=scan_interval),
        )
        self.controller = controller

    async def _async_update_data(self):
        try:
            return await self.controller.fetch_data()
        except Exception as error:
            raise UpdateFailed(error)

    @property
    def safe_data(self) -> ControllerData:
        return self.data or ControllerData()

    @callback
    def apply_optimistic(self, address: int, value, input_type: str = "holding") -> None:
        """Reflect a just-written value in the cache immediately and notify entities,
        WITHOUT a Modbus round-trip. Writes are what the register will read back, so
        the UI updates instantly instead of waiting for the next full poll; the
        scheduled refresh reconciles derived values afterwards."""
        cur = self.data
        if cur is None:
            return
        new = ControllerData(
            holding=dict(cur.holding),
            input=dict(cur.input),
            coil=dict(cur.coil),
            update_interval=cur.update_interval,
        )
        if input_type == "coil":
            new.coil[address] = bool(value)
        else:
            new.holding[address] = int(value)
        self.async_set_updated_data(new)
