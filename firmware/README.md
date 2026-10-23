# HallGrid node firmware

One sketch, two roles:

- `ROLE_WING`: wing distribution board. Energy meter, heater detection, corridor daylight relay, washroom motion relay.
- `ROLE_COMMON`: common/pump board. Energy meter, roof-tank level sensor, pump contactor relay.

**Status:** compiles without warnings for "ESP32 Dev Module" (esp32 core 2.0.17, PZEM004Tv30 library 1.2.1). It has not been run on a real distribution board.

## Build

1. Install the Arduino IDE or `arduino-cli`, the esp32 board package, and the **PZEM004Tv30** library by Jakub Mandula.
2. Copy `hallgrid_node/config.example.h` to `hallgrid_node/config.h` and fill in the role, node ID, key and Wi-Fi.
3. Board: ESP32 Dev Module. Upload.

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/hallgrid_node
```

## Safety

- Only a licensed electrician should work inside a distribution board, with the board isolated.
- Put a 6 A MCB and a fuse ahead of the node's supply and the PZEM voltage terminals.
- Wire lighting through the relay's **normally closed** contact. If the node fails, the lights stay on.
- Wire the pump contactor coil through the relay's **normally open** contact. If the node fails, the pump stays off, and the existing manual starter still works.
- If the tank already has a float switch, keep it in series as a backup cut-off.

## Detection

`detector.h` is a direct port of `src/lib/detect.ts`. To check that both give the same answers:

```bash
g++ -std=c++11 -O2 -o host_test firmware/test/host_test.cpp
node --experimental-strip-types scripts/export-traces.ts | ./host_test
```

## Calibration on site

- **LDR:** watch the `"bright"` value in the summary the node prints every minute, at midday and at dusk, then set `LDR_BRIGHT_OFF` and `LDR_DARK_ON` in `config.h`. Point the sensor at daylight, shielded from the corridor lamps.
- **Tank:** measure the distance from the sensor face to the overflow level and to the bottom, and set `TANK_FULL_CM` and `TANK_EMPTY_CM`. The sensor cannot read closer than about 25 cm.
