// Simulated wing readings for the dashboard when no node is reporting.
//
// Daily energy per appliance comes from the model inventory; this file only
// spreads it over the day with an hourly usage pattern. The patterns are our
// guess at a typical hall day, not measurements.

import { counts, inventory, qtyOf, type AssumptionMap, type Hall, type Item } from './model.ts';

const FAN = [10, 10, 10, 10, 10, 9, 7, 5, 4, 3, 3, 4, 5, 6, 6, 5, 5, 6, 7, 8, 9, 10, 10, 10];
const EVENING = [3, 2, 1, 1, 1, 1, 2, 4, 3, 1, 1, 1, 1, 1, 1, 1, 2, 4, 8, 10, 10, 10, 9, 6];
const STUDY = [4, 3, 1, 0, 0, 0, 0, 1, 2, 1, 1, 2, 3, 3, 3, 3, 4, 5, 6, 7, 8, 9, 8, 6];
const PHONE = [6, 4, 2, 1, 1, 1, 1, 3, 2, 1, 1, 2, 3, 3, 2, 2, 3, 4, 5, 5, 6, 7, 8, 8];
const COOK = [0, 0, 0, 0, 0, 0, 3, 8, 6, 1, 0, 1, 4, 5, 2, 0, 0, 1, 4, 8, 10, 6, 2, 0];
const WASH = [6, 4, 3, 3, 3, 5, 10, 10, 9, 7, 6, 6, 7, 8, 7, 6, 7, 9, 10, 10, 10, 10, 9, 8];
const DAYTIME = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const NIGHT = DAYTIME.map((x) => 1 - x);
const FLAT = Array(24).fill(1);
const PUMP = [0, 0, 0, 0, 0, 1, 3, 3, 2, 1, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0];

function profile(it: Item): number[] {
  switch (it.id) {
    case 'fan':
    case 'tableFan':
      return FAN;
    case 'roomLight':
      return EVENING;
    case 'studyLamp':
    case 'laptop':
    case 'desktop':
      return STUDY;
    case 'phone':
      return PHONE;
    case 'cooker':
    case 'kettle':
      return COOK;
    case 'washroom':
      return WASH;
    case 'exhaust':
      return DAYTIME;
    case 'stair':
      return NIGHT;
    case 'pump':
      return PUMP;
    case 'corridor': {
      // 12 night hours at full load; the daytime waste spread over 12 daytime hours.
      const waste = Math.max(0, it.hours - 12) / 12;
      return NIGHT.map((n) => (n ? 1 : waste));
    }
    default:
      return FLAT;
  }
}

// Average power of an item during hour h, in W, never above its connected load.
function powerAt(it: Item, qty: number, h: number): number {
  const p = profile(it);
  const sum = p.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  const w = (qty * it.watts * it.hours * p[h]) / sum;
  return Math.min(w, qty * it.watts);
}

// Fixed per-wing differences so the wings do not all read the same.
const WING_FACTOR = [1.06, 0.95, 1.02, 0.91, 1.1, 0.98, 0.93, 1.04, 1.0, 0.97, 1.03, 0.96];

export type Reading = {
  p: number; // W
  n: number; // VA, non-active
  pf: number;
  parts: { label: string; w: number }[];
};

export type WingId = { id: string; label: string; floor: number; side: string };

export function wingIds(h: Hall): WingId[] {
  const sides = h.wingsPerFloor === 2 ? ['north', 'south'] : Array.from({ length: h.wingsPerFloor }, (_, i) => `w${i + 1}`);
  const out: WingId[] = [];
  for (let f = 1; f <= h.floors; f++) for (const s of sides) out.push({ id: `f${f}-${s}`, label: `Floor ${f} ${s}`, floor: f, side: s });
  return out;
}

const PART: Record<string, string> = {
  fan: 'Fans', tableFan: 'Fans', roomLight: 'Lights', studyLamp: 'Lights',
  laptop: 'Devices', desktop: 'Devices', phone: 'Devices',
  cooker: 'Cooking', kettle: 'Cooking',
  corridor: 'Corridor', washroom: 'Washroom', exhaust: 'Washroom',
  stair: 'Stairs', router: 'Wi-Fi', pump: 'Pump',
};

function sum(items: { it: Item; qty: number }[], h: number, factor: number): Reading {
  let p = 0;
  let n = 0;
  const parts = new Map<string, number>();
  for (const { it, qty } of items) {
    const w = powerAt(it, qty, h) * factor;
    p += w;
    n += w * Math.tan(Math.acos(it.pf));
    const k = PART[it.id] ?? it.name;
    parts.set(k, (parts.get(k) ?? 0) + w);
  }
  return { p, n, pf: p > 0 ? p / Math.hypot(p, n) : 1, parts: Array.from(parts, ([label, w]) => ({ label, w })) };
}

export function simulateHall(hall: Hall, a: AssumptionMap, hour: number, opts: { daylightControl: boolean }) {
  const c = counts(hall);
  const inv = inventory(a, 1).map((it) => {
    if (opts.daylightControl && it.id === 'corridor') {
      // Same capture rate as the savings model: some daytime use remains.
      return { ...it, hours: 12 + a.corridorWasteH[1] * (1 - a.daylightCapture[1] / 100) };
    }
    return it;
  });
  const wingItems = inv.filter((it) => it.node === 'wing').map((it) => ({ it, qty: qtyOf(it, hall) / c.wings }));
  const commonItems = inv.filter((it) => it.node === 'common').map((it) => ({ it, qty: qtyOf(it, hall) }));
  const wings = wingIds(hall).map((w, i) => ({ ...w, reading: sum(wingItems, hour, WING_FACTOR[i % WING_FACTOR.length]) }));
  const common = sum(commonItems, hour, 1);
  const total = wings.reduce((t, w) => t + w.reading.p, 0) + common.p;
  return { wings, common, total };
}

// A day's worth of hall power, for the overview chart. Corridor lighting is
// returned separately because at whole-hall scale the difference is too small to see.
export function dayCurve(hall: Hall, a: AssumptionMap) {
  const corridor = (x: ReturnType<typeof simulateHall>) =>
    x.wings.reduce((t, w) => t + (w.reading.parts.find((p) => p.label === 'Corridor')?.w ?? 0), 0) / 1000;
  return Array.from({ length: 24 }, (_, h) => {
    const off = simulateHall(hall, a, h, { daylightControl: false });
    const on = simulateHall(hall, a, h, { daylightControl: true });
    return { hour: h, now: off.total / 1000, controlled: on.total / 1000, corridorNow: corridor(off), corridorControlled: corridor(on) };
  });
}
