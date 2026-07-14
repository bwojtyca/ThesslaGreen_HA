import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict

from pymodbus.client import AsyncModbusTcpClient

_LOGGER = logging.getLogger(__name__)


@dataclass
class ControllerData:
    holding: Dict[int, int] = field(default_factory=dict)
    input: Dict[int, int] = field(default_factory=dict)
    coil: Dict[int, bool] = field(default_factory=dict)
    update_interval: float = 0.0


class ControllerException(Exception):
    def __init__(self, message):
        super().__init__(message)


class ThesslaGreenModbusController:

    def __init__(self, host: str, port: int, slave_id: int, update_interval: int = 30):
        self._host = host
        self._port = port
        self._slave = slave_id
        self._update_interval = update_interval

        self._client = AsyncModbusTcpClient(
            host=self._host,
            port=self._port,
            reconnect_delay=1,
            reconnect_delay_max=300,
            retries=10,
        )
        self._controller_lock = asyncio.Lock()

        self._last_update_timestamp: float = 0
        self._last_update_interval: float = 0

        # Each tuple = (start_address, register_count) → one "read holding registers"
        # request per block. fetch_data() reads them tolerantly (a block the device
        # does not support is skipped, not fatal).
        self._holding_blocks = [
            # --- original registers ---
            (256, 2),    # 256 supplyAirFlow + 257 exhaustAirFlow — current airflow (m3/h)
            (4192, 2),   # 4192 antifreezMode (FPX active flag) + 4193 (reserved)
            (4198, 1),   # 4198 antifreezStage — FPX anti-freeze stage/mode
            (4208, 3),   # 4208 mode (0=Auto/1=Manual/2=Temp) + 4209 seasonMode (Lato/Zima) + 4210 airFlowRateManual
            (4210, 1),   # 4210 airFlowRateManual — manual intensity % (note: already in the 4208 block)
            (4224, 1),   # 4224 specialMode — special function (Wietrzenie/Pusty Dom/Kominek/Okna)
            (4320, 1),   # 4320 bypassOff — bypass FUNCTION enable (0=enabled, 1=disabled)
            (4387, 1),   # 4387 onOffPanelMode — device ON/OFF
            (8192, 2),   # 8192 alarm (any "E" warning) + 8193 error (any "S" blocking error)
            (8208, 1),   # 8208 S16 — heater thermal protection tripped
            (8222, 2),   # 8222 S30 + 8223 S31 — supply/exhaust fan not working
            (8330, 2),   # 8330 E138 + 8331 E139 — supply/exhaust CF (constant-flow) sensor fault
            (4704, 1),   # 4704 postHeater_on — secondary/post-heater status (exposed as "ERV")
            (4711, 1),   # 4711 cfgPostHeaterMode — post-heater / ERV mode
            (8444, 1),   # 8444 E252 — filter change required
            (4304, 2),   # 4304 comfortModePanel (EKO/KOMFORT) + 4305 comfortMode (current status)
            # --- extended registers (fork additions; all live-confirmed on AirPack 800v) ---
            (1280, 4),   # 1280/1281 dac_supply/exhaust + 1282/1283 heater/cooler → output % (0..4095)
            (4212, 1),   # 4212 supplyAirTemperatureManual → target supply temp (x0.5 °C)
            (4230, 1),   # 4230 airingCoef → "Wietrzenie" configured intensity (%)
            (4233, 1),   # 4233 airingPanelModeTime → "Wietrzenie" duration (min)
            (4330, 1),   # 4330 bypassMode → CURRENT bypass status (0=inactive, 1/2=active)
            (4354, 2),   # 4354/4355 nominalSupply/ExhaustAirFlow → 100% reference (m3/h)
            (4384, 1),   # 4384 stopAhuCode → blocking S-alarm number (0=none)
            (4401, 1),   # 4401 airFlowRateTemporary → temporary-mode intensity (%)
            (4660, 1),   # 4660 filter_supply_date_limit → days to supply filter change
            (4662, 1),   # 4662 filter_exhaust_date_limit → days to exhaust filter change
            (8190, 1),   # 8190 requiredTemp → KOMFORT target temp (x0.5 °C)
            (4321, 3),   # 4321 minBypassTemp + 4322 free-heating + 4323 free-cooling (x0.5 °C) — read-only config
            (4331, 3),   # 4331 bypassUserMode + 4332 flow-diff % + 4333 intensity % — read-only config
            (4228, 1),   # 4228 fireplaceSupplyCoef → "Kominek" intensity (%)
            (4237, 1),   # 4237 fireplaceModeTime → "Kominek" duration (min)
            (4232, 1),   # 4232 emptyHouseCoef → "Pusty dom" intensity (%)
            (4239, 1),   # 4239 openWindowCoef → "Otwarte okno" intensity (%)
            (8202, 1),   # 8202 S10 → fire alarm (P.POŻ) tripped
            (8206, 2),   # 8206 S14 + 8207 S15 → heater anti-freeze protection tripped
            (8215, 4),   # 8215-8218 S23-S26 → temperature-sensor faults
            (4213, 1),   # 4213 supplyAirTemperatureTemporary → target supply temp in Temporary mode (x0.5 °C)
            (4216, 3),   # 4216-4218 fanSpeed1/2/3Coef → speed-preset intensities (%)
            (4482, 2),   # 4482/4483 cfgSZF_FN/FW → supply/exhaust filter wear (%)
        ]
        # Input registers (temperatures, ×0.1 °C). Kept as separate blocks so an
        # unsupported optional sensor (TN2/GWC on units without them) can't take
        # the core temperatures offline — the tolerant reader skips only its block.
        self._input_blocks = [
            (0, 5),    # 0 VERSION_MAJOR + 1 VERSION_MINOR + (2,3 reserved) + 4 VERSION_PATCH → firmware
            (16, 4),   # 16 czerpnia + 17 nawiew + 18 wywiew + 19 za FPX
            (20, 2),   # 20 TN2 (kanałowa) + 21 GWC — read 0 / skipped if not installed
            (22, 1),   # 22 otoczenie (TO)
            (24, 6),   # 24-29 serial_number_1..6 → controller serial number
        ]
        # Coils: 9 bypass actuator output, 10 work-confirmation (info), 11 fan-power relay.
        self._coil_blocks = [(9, 3)]

    async def stop(self):
        async with self._controller_lock:
            _LOGGER.info("Stopping Modbus controller for %s:%d", self._host, self._port)
            self._client.close()

    async def fetch_data(self) -> ControllerData:
        async with self._controller_lock:
            await self._ensure_connected()

            data_holding: dict[int, int] = {}
            data_input: dict[int, int] = {}
            data_coil: dict[int, bool] = {}

            now = time.time()
            if self._last_update_timestamp:
                self._last_update_interval = now - self._last_update_timestamp
                _LOGGER.debug("Time since last update: %.2f seconds", self._last_update_interval)
            self._last_update_timestamp = now

            _LOGGER.debug("Reading all register blocks for slave %d", self._slave)

            # Per-block reads are TOLERANT: a block that the device does not
            # support (illegal address) or that errors transiently is skipped
            # instead of failing the whole update — so optional/model-specific
            # registers can't take the whole integration offline. A real
            # connection failure makes every block fail, which we detect below.
            read_ok = 0

            # Read holding registers
            for start, count in self._holding_blocks:
                try:
                    result = await self._client.read_holding_registers(address=start, count=count,
                                                                        device_id=self._slave)
                except Exception as e:
                    _LOGGER.debug("Holding %d-%d read exception (skipped): %s", start, start + count - 1, e)
                    continue
                if result is None or result.isError():
                    _LOGGER.debug("Holding %d-%d not available (skipped)", start, start + count - 1)
                    continue
                for i, val in enumerate(result.registers):
                    data_holding[start + i] = val
                read_ok += len(result.registers)

            # Read input registers
            for start, count in self._input_blocks:
                try:
                    result = await self._client.read_input_registers(address=start, count=count, device_id=self._slave)
                except Exception as e:
                    _LOGGER.debug("Input %d-%d read exception (skipped): %s", start, start + count - 1, e)
                    continue
                if result is None or result.isError():
                    _LOGGER.debug("Input %d-%d not available (skipped)", start, start + count - 1)
                    continue
                for i, val in enumerate(result.registers):
                    data_input[start + i] = val
                read_ok += len(result.registers)

            # Read coils
            for start, count in self._coil_blocks:
                try:
                    result = await self._client.read_coils(address=start, count=count, device_id=self._slave)
                except Exception as e:
                    _LOGGER.debug("Coils %d-%d read exception (skipped): %s", start, start + count - 1, e)
                    continue
                if result is None or result.isError():
                    _LOGGER.debug("Coils %d-%d not available (skipped)", start, start + count - 1)
                    continue
                for i, val in enumerate(result.bits):
                    data_coil[start + i] = bool(val)
                read_ok += len(result.bits)

            # If nothing at all was read, the device is unreachable → fail the
            # update so HA marks entities unavailable and retries.
            if read_ok == 0:
                raise ControllerException("No Modbus registers could be read (device unreachable?)")

            return ControllerData(
                holding=data_holding,
                input=data_input,
                coil=data_coil,
                update_interval=round(self._last_update_interval, 2)
            )

    async def write_register(self, address: int, value: int) -> bool:
        async with self._controller_lock:
            await self._ensure_connected()

            try:
                _LOGGER.debug("Writing register %d = %s (slave=%d)", address, value, self._slave)
                result = await self._client.write_register(address=address, value=value, device_id=self._slave)
                if result.isError():
                    raise ControllerException(f"Failed to write register {address} with value {value}")
                _LOGGER.info("Successfully wrote register %d = %s", address, value)
                return True
            except Exception as e:
                raise ControllerException(f"Exception writing register {address} = {value}: {e}") from e

    async def _ensure_connected(self):
        if self._client.connected:
            return

        _LOGGER.info("Attempting connection to Modbus server %s:%d", self._host, self._port)
        try:
            if await self._client.connect():
                _LOGGER.info("Successfully connected to Modbus server %s:%d", self._host, self._port)
                return
        except Exception as e:
            raise ControllerException(f"Exception during Modbus connection to {self._host}:{self._port}: {e}") from e

        raise ControllerException(f"Failed to connect to Modbus server {self._host}:{self._port}")
