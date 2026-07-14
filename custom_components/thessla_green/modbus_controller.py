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
            # A full poll is ~35 sequential requests; 10 retries per request could
            # stall the whole cycle (and any queued write) for a long time when the
            # link hiccups. The reader is already tolerant (skips a failed block), so
            # keep retries low for snappy polls + writes.
            retries=2,
        )
        self._controller_lock = asyncio.Lock()

        self._last_update_timestamp: float = 0
        self._last_update_interval: float = 0

        # Each tuple = (start_address, register_count) → one "read holding registers"
        # request. Blocks are STATICALLY widened to span each function's whole
        # register run in a single read; gap registers inside a run are read too but
        # harmless (entities only look up known addresses). Every range below was
        # confirmed to read back with NO illegal-address holes on the AirPack 800v
        # (tools/scan_ranges.py, 2026-07-14) — if a future/other unit drops a block,
        # split that one entry. fetch_data() reads tolerantly (skips a failing block).
        self._holding_blocks = [
            (256, 2),    # 256/257 supply/exhaust airflow (m3/h)
            (1280, 4),   # 1280-1283 dac supply/exhaust/heater/cooler output % (0..4095)
            (4192, 7),   # 4192 FPX flag .. 4198 FPX anti-freeze stage
            (4208, 11),  # 4208 mode + 4209 season + 4210 manual% + 4212/4213 target temps + 4216-4218 speed presets
            (4224, 16),  # 4224 specialMode + 4228/4230/4232/4233/4237/4239 special-function coefs & times
            (4304, 2),   # 4304/4305 comfort panel (EKO/KOMFORT) + status
            (4320, 12),  # 4320 bypass enable + 4321-4323 thresholds + 4330 status + 4331 user-mode
            (4354, 2),   # 4354/4355 nominal airflow (100% reference)
            (4384, 4),   # 4384 blocking S-alarm code .. 4387 device ON/OFF
            (4401, 1),   # 4401 temporary-mode intensity %
            (4482, 2),   # 4482/4483 supply/exhaust filter wear %
            (4660, 3),   # 4660/4662 supply/exhaust days-to-filter-change
            (4704, 8),   # 4704 post-heater status .. 4711 post-heater/ERV mode
            (8190, 1),   # 8190 KOMFORT target temp (block boundary: 8190-91 and 8192+ can't share a read)
            (8192, 2),   # 8192 alarm (E) + 8193 error (S)
            (8202, 17),  # 8202 P.POŻ .. 8206-8208 anti-freeze/thermal .. 8215-8218 sensor faults (device caps this block at ~8218)
            (8222, 2),   # 8222/8223 S30/S31 supply/exhaust fan faults
            (8330, 2),   # 8330/8331 CF sensor faults
            (8444, 1),   # 8444 filter change required
        ]
        # Input registers (temperatures, ×0.1 °C). Kept as separate blocks so an
        # unsupported optional sensor (TN2/GWC on units without them) can't take
        # the core temperatures offline — the tolerant reader skips only its block.
        # 0-4 firmware, then a gap (5-11 illegal), then one contiguous readable run
        # 16-29 (temps 16-19, TN2/GWC 20/21 = 0 when absent, TO 22, serial 24-29) —
        # confirmed no illegal holes on the 800v (tools/scan_ranges.py), so merged.
        self._input_blocks = [
            (0, 5),    # 0/1/4 firmware major/minor/patch (2,3 reserved)
            (16, 14),  # 16-19 temps (czerpnia/nawiew/wywiew/za-FPX) + 20/21 TN2/GWC + 22 TO + 24-29 serial
        ]
        # Coils: 9 bypass actuator output, 10 work-confirmation (info), 11 fan-power relay.
        self._coil_blocks = [(9, 3)]

    async def stop(self):
        async with self._controller_lock:
            _LOGGER.info("Stopping Modbus controller for %s:%d", self._host, self._port)
            self._client.close()

    async def _try_read_regs(self, func, start: int, count: int):
        """Read one register block; return the register list or None on error."""
        try:
            result = await func(address=start, count=count, device_id=self._slave)
        except Exception as e:  # noqa: BLE001
            _LOGGER.debug("Read %d-%d exception (skipped): %s", start, start + count - 1, e)
            return None
        if result is None or result.isError():
            _LOGGER.debug("Read %d-%d not available (skipped)", start, start + count - 1)
            return None
        return result.registers

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

            # Per-block reads are TOLERANT: a block the device does not support
            # (illegal address) or that errors transiently is skipped instead of
            # failing the whole update — so optional/model-specific registers can't
            # take the integration offline. A real connection failure makes every
            # block fail, which we detect below.
            read_ok = 0

            for start, count in self._holding_blocks:
                regs = await self._try_read_regs(self._client.read_holding_registers, start, count)
                if regs is not None:
                    for i, val in enumerate(regs):
                        data_holding[start + i] = val
                    read_ok += len(regs)

            for start, count in self._input_blocks:
                regs = await self._try_read_regs(self._client.read_input_registers, start, count)
                if regs is not None:
                    for i, val in enumerate(regs):
                        data_input[start + i] = val
                    read_ok += len(regs)

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
