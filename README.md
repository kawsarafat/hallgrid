# HallGrid

Wing-level energy metering and common-area control for university residential halls in Bangladesh.

Team SustainSSTU, Sunamganj Science and Technology University: Kawsar Arafat and MD Firdaus Nur Arif.
Entry for the Sustainable Energy Idea Contest 2026, Category 2 (15% energy savings by 2030).

Live demo: https://hallgrid-bd.vercel.app

## Status

| Part | State |
|---|---|
| Dashboard, savings model, QR report page | Working. Readings are **simulated** until a node reports. |
| Node API (`/api/telemetry`), alerts, reports | Working and tested locally. Storage is in memory, so data is lost on restart. |
| ESP32 firmware (`firmware/hallgrid_node`) | Compiles for ESP32 (core 2.0.17). **Not yet run on real hardware.** |
| Heater detection | Same rules in TypeScript and C++, checked on 7 synthetic test cases. **Not validated on a real feeder.** |
| Savings figures | **Estimates** from an appliance model and our survey. No measured savings. |

## The problem

Students in public halls do not pay for electricity, so nobody owns the waste: corridor lights left on in daylight, fans running in empty rooms during class, coil heaters and rice cookers in bedrooms, and roof tanks overflowing because nobody switches the pump off. In our survey (16 students, 12 institutions, October 2026), 15 of 16 see common-area lights on with nobody around (12 of them in the daytime), 11 of 16 say fans or lights are left on when rooms are empty, and 5 of 16 say many students cook in their rooms.

## What HallGrid does

1. **A meter per wing.** A PZEM-004T with a split-core CT on each wing feeder in the distribution board. No cables are cut and nothing is installed inside rooms.
2. **Common-area control.** Corridor lights switch off in steady daylight (never between 18:00 and 06:00). Washroom lights follow a motion sensor with a 15-minute hold. Relays are wired so that a failed node leaves the lights on.
3. **Pump control.** An ultrasonic level sensor stops the pump at 95% and starts it at 40%. It locks out after 90 minutes, or if the level does not rise.
4. **Heater detection.** A resistive appliance changes active power but not non-active power. The node flags a step of over 800 W with cos φ of the step at least 0.98. If that load stays on for more than 2 minutes it is counted as a violation for the wing and an alert goes to the house tutor and electrician; this includes kettles. Shorter uses, such as a quick re-boil or an iron's thermostat pulses, are logged but not counted. The alert names the wing, not the room.
5. **Feedback for students.** Wing-level ranking per student, a class-time reminder, and QR stickers for reporting faults.

## Savings estimate

Reference hall: 4 floors, 8 wings, 96 rooms, 384 students, 300 occupied days, BERC LT-D1 tariff ৳9.05/kWh. Run `npm run model` to reproduce these numbers.

| kWh per year | Conservative | Expected | Optimistic |
|---|---:|---:|---:|
| Baseline (appliance model) | 93,908 | 94,380 | 94,960 |
| Daylight cut-off, corridors | 433 | 891 | 1,485 |
| Motion sensors, washrooms | 622 | 995 | 1,452 |
| Pump stop at full tank | 36 | 78 | 144 |
| Reminder and wing ranking | 1,132 | 2,830 | 5,660 |
| Shared induction cooker | 161 | 360 | 482 |
| **Total, controls and behaviour** | **2,384 (2.5%)** | **5,155 (5.5%)** | **9,223 (9.7%)** |
| Plus BLDC fans on 30/50/70% of fans | 9,296 (9.9%) | 16,675 (17.7%) | 25,351 (26.7%) |

Controls and reminders alone do not reach 15%. Ceiling fans use about 46% of the electricity in the model, so the realistic route to 15% is HallGrid plus BLDC fans (Walton 56": 75 W conventional vs 35 W BLDC), with the wing meters showing whether the drop is real.

Cost for the reference hall: ৳79,459 for monitoring and control hardware including installation and 15% contingency. Net payback is about 3.5 years for controls only, after a 25% student reward and ৳1,000/month hosting, or 3.0 years with BLDC fans bought when old fans fail.

Every assumption, its range and its source is listed on the dashboard's **Savings model** page and in [`src/lib/model.ts`](src/lib/model.ts).

## Measurement plan for a pilot

1. Install the meters only. For two weeks, log the baseline with all automation and reminders off.
2. Switch on one measure at a time, two weeks each, and compare wing by wing against the baseline, adjusted for occupancy and temperature.
3. Record every heater alert and check it on site, to measure true and false alarm rates.
4. Publish the data in this repository.

## Run it

```bash
npm install
npm run dev               # http://localhost:3000
npm run test:detector     # heater detection test cases
npm run model             # savings model for the reference hall
```

To accept data from real nodes, set environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `NODE_KEYS` | `nodeId:key` pairs, comma separated. Without it, `/api/telemetry` rejects all node data. |
| `ADMIN_KEY` | Needed to read QR reports and send test alerts. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_*` | The hall's Telegram bot and the chats for tutors, electrician, provost and students. |

## API

| Endpoint | Use |
|---|---|
| `POST /api/telemetry` | Node summary (every 60 s) or event. Header `X-Node-Key`. |
| `POST /api/telemetry?validate=1` | Check a message against the schema without storing it. |
| `GET /api/telemetry` | Latest summary per node, recent events, and this month's violation count per wing. |
| `POST /api/report` | QR fault report. Public, rate limited. |
| `GET /api/report` | Recent reports. Header `X-Admin-Key`. |
| `POST /api/alert` | Send a Telegram message. Header `X-Admin-Key`. |
| `GET /api/status` | Which features are configured on this server. |

Message formats are in [`src/lib/payload.ts`](src/lib/payload.ts).

## Limits

- The baseline is modelled, not metered. Real halls differ.
- The survey is a small convenience sample.
- Heater detection works per wing, misses heaters under 800 W, and can miss a heater that switches on at the same moment as several fans.
- The PZEM-004T does not measure reactive power directly; we use non-active power √(S² − P²), which has no sign.
- Three-phase wing boards need one meter per phase.
- Server storage is in memory. A pilot needs a database.

## Sources

- Williams et al. (2012), Lighting controls in commercial buildings, LEUKOS 8(3).
- Darby (2006), The effectiveness of feedback on energy consumption, University of Oxford.
- Petersen et al. (2007), Dormitory residents reduce electricity consumption when exposed to real-time visual feedback and incentives, IJSHE 8(1).
- US DOE (2009), Technical Support Document, residential cooking products.
- Department of Environment, Bangladesh: grid emission factor 0.62 t CO₂/MWh.
- BERC retail tariff, June 2026.
- Prices: RoboticsBD, Walton, King Power and BDStall listings, checked 21 October 2026.

## License

MIT
