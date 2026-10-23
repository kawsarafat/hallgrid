// Step-change detector for a wing feeder, one sample per second.
//
// The same rules run in the ESP32 firmware (firmware/hallgrid_node/detector.h).
// Keep the two in sync: if you change a constant here, change it there too.
//
// Idea: a coil heater, rice cooker or immersion rod is almost purely resistive,
// so when it switches on, the wing's active power P jumps but its non-active
// power N = sqrt(S^2 - P^2) barely moves. Fans, chargers and LED drivers move
// both. We look at the change, not the total, because the total wing power
// factor stays low (0.8-0.9) even with a heater running.
//
// Any resistive load above MIN_STEP_W that stays on for MIN_ON_S (2 minutes)
// is treated as unauthorised: it is counted against the wing and an alert is
// sent. This includes a kettle boiling for more than 2 minutes. Very short uses
// (a quick re-boil, an iron's thermostat pulses) are logged but not counted.

export const DETECT = {
  MIN_STEP_W: 800, // smallest step treated as a high-power appliance
  MIN_COS_DELTA: 0.98, // cos(phi) of the step itself
  CONFIRM_S: 5, // step must hold this long before it is measured
  MIN_ON_S: 120, // resistive load on for 2 min = counted violation + alert
  OUTAGE_V: 150, // below this the feeder is treated as off (load-shedding)
  OUTAGE_HOLDOFF_S: 120, // ignore steps for 2 min after power returns
  STABLE_BAND_W: 150, // baseline only tracks when P is within this band
  BASELINE_ALPHA: 0.05, // baseline smoothing per sample
};

export type Sample = { t: number; v: number; p: number; n: number };

export type DetectorEvent =
  | { type: 'step'; t: number; dP: number; dN: number; cosDelta: number; resistive: boolean }
  | { type: 'resistive_alert'; t: number; startedAt: number; dP: number; cosDelta: number }
  | { type: 'resistive_short'; t: number; startedAt: number; dP: number; durationS: number }
  | { type: 'resistive_end'; t: number; startedAt: number; durationS: number }
  | { type: 'outage'; t: number }
  | { type: 'restore'; t: number };

type Open = { startedAt: number; dP: number; cosDelta: number; level: number; alerted: boolean };

export class StepDetector {
  private pBase = NaN;
  private nBase = NaN;
  private pending: Sample[] = [];
  private open: Open | null = null;
  private inOutage = false;
  private holdoffUntil = -1;
  private belowSince = -1;

  update(s: Sample): DetectorEvent[] {
    const out: DetectorEvent[] = [];

    if (s.v < DETECT.OUTAGE_V) {
      if (!this.inOutage) out.push({ type: 'outage', t: s.t });
      this.inOutage = true;
      this.pending = [];
      this.open = null;
      return out;
    }
    if (this.inOutage) {
      this.inOutage = false;
      this.holdoffUntil = s.t + DETECT.OUTAGE_HOLDOFF_S;
      this.pBase = NaN;
      out.push({ type: 'restore', t: s.t });
    }
    if (Number.isNaN(this.pBase) || s.t < this.holdoffUntil) {
      // Re-learn the baseline after start-up or a power cut.
      this.pBase = s.p;
      this.nBase = s.n;
      return out;
    }

    // Track the end of an open resistive load: P falls back by at least half the step.
    if (this.open) {
      if (s.p < this.open.level - this.open.dP / 2) {
        if (this.belowSince < 0) this.belowSince = s.t;
        if (s.t - this.belowSince >= DETECT.CONFIRM_S) {
          const durationS = this.belowSince - this.open.startedAt;
          if (this.open.alerted) out.push({ type: 'resistive_end', t: s.t, startedAt: this.open.startedAt, durationS });
          else out.push({ type: 'resistive_short', t: s.t, startedAt: this.open.startedAt, dP: this.open.dP, durationS });
          this.open = null;
          this.belowSince = -1;
          this.pBase = s.p;
          this.nBase = s.n;
          this.pending = [];
          return out;
        }
      } else {
        this.belowSince = -1;
      }
      if (!this.open.alerted && s.t - this.open.startedAt >= DETECT.MIN_ON_S) {
        this.open.alerted = true;
        out.push({ type: 'resistive_alert', t: s.t, startedAt: this.open.startedAt, dP: this.open.dP, cosDelta: this.open.cosDelta });
      }
    }

    const dev = s.p - this.pBase;
    if (Math.abs(dev) < DETECT.STABLE_BAND_W) {
      this.pending = [];
      this.pBase += DETECT.BASELINE_ALPHA * (s.p - this.pBase);
      this.nBase += DETECT.BASELINE_ALPHA * (s.n - this.nBase);
      return out;
    }

    if (Math.abs(dev) < DETECT.MIN_STEP_W) {
      // Medium change (a few fans, a PC). Accept it as the new level once it holds.
      this.pending.push(s);
      if (this.pending.length >= DETECT.CONFIRM_S) {
        this.pBase = median(this.pending.map((x) => x.p));
        this.nBase = median(this.pending.map((x) => x.n));
        this.pending = [];
      }
      return out;
    }

    this.pending.push(s);
    if (this.pending.length < DETECT.CONFIRM_S) return out;

    const p = median(this.pending.map((x) => x.p));
    const n = median(this.pending.map((x) => x.n));
    const dP = p - this.pBase;
    const dN = n - this.nBase;
    const cosDelta = Math.abs(dP) / Math.hypot(dP, dN);
    const startedAt = this.pending[0].t;
    const resistive = dP > 0 && cosDelta >= DETECT.MIN_COS_DELTA;
    out.push({ type: 'step', t: s.t, dP: Math.round(dP), dN: Math.round(dN), cosDelta: round3(cosDelta), resistive });

    if (resistive && !this.open) {
      this.open = { startedAt, dP, cosDelta: round3(cosDelta), level: p, alerted: false };
    }
    this.pBase = p;
    this.nBase = n;
    this.pending = [];
    return out;
  }
}

function median(a: number[]) {
  const b = [...a].sort((x, y) => x - y);
  const m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------
// Synthetic traces used by the dashboard demo and by scripts/test-detector.ts.
// They are generated, not recorded. Real validation needs a metered feeder.
// ---------------------------------------------------------------------------

export type Load = { from: number; to: number; p: number; pf: number; cycleOn?: number; cycleOff?: number };

export interface Scenario {
  id: string;
  title: string;
  expect: 'alert' | 'no alert';
  why: string;
  minutes: number;
  loads: Load[];
  outage?: [number, number];
}

const N = (p: number, pf: number) => p * Math.tan(Math.acos(pf));

export const SCENARIOS: Scenario[] = [
  {
    id: 'cooker',
    title: 'Rice cooker, 1000 W, 25 min',
    expect: 'alert',
    why: 'Resistive and stays on past 2 minutes: counted and alerted.',
    minutes: 30,
    loads: [{ from: 180, to: 180 + 25 * 60, p: 1000, pf: 1 }],
  },
  {
    id: 'kettle',
    title: 'Kettle, 1500 W, 4 min',
    expect: 'alert',
    why: 'Resistive and on for more than 2 minutes, so it counts like any other unauthorised appliance.',
    minutes: 15,
    loads: [{ from: 180, to: 180 + 4 * 60, p: 1500, pf: 1 }],
  },
  {
    id: 'reboil',
    title: 'Kettle re-boil, 1500 W, 90 s',
    expect: 'no alert',
    why: 'Switched off before 2 minutes: logged as short use, not counted.',
    minutes: 10,
    loads: [{ from: 180, to: 180 + 90, p: 1500, pf: 1 }],
  },
  {
    id: 'iron',
    title: 'Iron, 1000 W, thermostat cycling for 15 min',
    expect: 'no alert',
    why: 'The thermostat switches the element in short pulses (45 s here), so no single resistive load lasts 2 minutes.',
    minutes: 20,
    loads: [{ from: 120, to: 120 + 15 * 60, p: 1000, pf: 1, cycleOn: 45, cycleOff: 60 }],
  },
  {
    id: 'fans',
    title: '12 fans switched on together',
    expect: 'no alert',
    why: 'Large step, but fan motors draw reactive power, so cos(phi) of the step is about 0.9.',
    minutes: 15,
    loads: [{ from: 180, to: 900, p: 900, pf: 0.9 }],
  },
  {
    id: 'outage',
    title: 'Load-shedding for 10 min, then power returns',
    expect: 'no alert',
    why: 'The whole wing restarts at once; steps are ignored for 2 min after power returns.',
    minutes: 20,
    loads: [],
    outage: [240, 840],
  },
  {
    id: 'hidden',
    title: 'Room lights and fans off, then a 1200 W heater on',
    expect: 'alert',
    why: 'The 180 W drop is accepted as a new level; the heater step is measured from there.',
    minutes: 25,
    loads: [
      { from: 0, to: 150, p: 180, pf: 0.88 },
      { from: 200, to: 200 + 20 * 60, p: 1200, pf: 1 },
    ],
  },
];

// Base wing load: about 1.5 kW at pf 0.86 with slow drift and meter noise.
export function synthTrace(sc: Scenario, seed = 1): Sample[] {
  let r = seed;
  const rnd = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647 - 0.5;
  };
  const out: Sample[] = [];
  for (let t = 0; t < sc.minutes * 60; t++) {
    if (sc.outage && t >= sc.outage[0] && t < sc.outage[1]) {
      out.push({ t, v: 0, p: 0, n: 0 });
      continue;
    }
    let p = 1500 + 60 * Math.sin(t / 300);
    let n = N(p, 0.86);
    for (const l of sc.loads) {
      if (t < l.from || t >= l.to) continue;
      if (l.cycleOn && l.cycleOff && (t - l.from) % (l.cycleOn + l.cycleOff) >= l.cycleOn) continue;
      p += l.p;
      n += N(l.p, l.pf);
    }
    p *= 1 + 0.004 * rnd();
    n *= 1 + 0.01 * rnd();
    out.push({ t, v: 228 + 2 * rnd(), p: Math.round(p), n: Math.round(n) });
  }
  return out;
}

export function runScenario(sc: Scenario) {
  const trace = synthTrace(sc);
  const d = new StepDetector();
  const events: DetectorEvent[] = [];
  for (const s of trace) events.push(...d.update(s));
  const alerted = events.some((e) => e.type === 'resistive_alert');
  return { trace, events, alerted, pass: alerted === (sc.expect === 'alert') };
}
