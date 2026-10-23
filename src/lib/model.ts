// Energy and cost model for one residential hall.
//
// Everything here is an ex-ante estimate. The baseline comes from an appliance
// inventory for a reference hall, not from a meter or a bill. Each input carries
// a "basis" so a reader can see where the number came from. Scenario values are
// [conservative, expected, optimistic].

import { count, share, SURVEY_N } from './survey.ts';

export type Basis = 'survey' | 'literature' | 'nameplate' | 'market' | 'tariff' | 'estimate';
export type Triple = [number, number, number];
export const SCENARIOS = ['Conservative', 'Expected', 'Optimistic'] as const;

export const BASIS_LABEL: Record<Basis, string> = {
  survey: 'Our survey (N=16)',
  literature: 'Published study',
  nameplate: 'Manufacturer rating',
  market: 'Market price, Oct 2026',
  tariff: 'BERC tariff',
  estimate: 'Team estimate, to be measured',
};

export interface Hall {
  floors: number;
  wingsPerFloor: number;
  roomsPerWing: number;
  studentsPerRoom: number;
  activeDays: number; // days per year the hall is occupied
  classDays: number; // days per year with morning classes
  tariff: number; // BDT per kWh, energy charge only
}

export const REFERENCE_HALL: Hall = {
  floors: 4,
  wingsPerFloor: 2,
  roomsPerWing: 12,
  studentsPerRoom: 4,
  activeDays: 300,
  classDays: 210,
  tariff: 9.05,
};

export const counts = (h: Hall) => {
  const wings = h.floors * h.wingsPerFloor;
  const rooms = wings * h.roomsPerWing;
  return { wings, rooms, students: rooms * h.studentsPerRoom, floors: h.floors };
};

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export interface Assumption {
  id: string;
  label: string;
  unit: string;
  value: Triple;
  basis: Basis;
  note: string;
}

// Daytime hours that corridor lights stay on for no reason, averaged over all days.
// Built from the "common-area lights" question: respondents who said "almost daily,
// 4-8 h" and "sometimes, 2-4 h". Night-only and "no" answers count as zero.
function corridorWasteHours(): Triple {
  const daily = count('commonLights', 'daily');
  const some = count('commonLights', 'sometimes');
  const calc = (dailyH: number, someH: number, someDaysPerWeek: number) =>
    (daily * dailyH + some * someH * (someDaysPerWeek / 7)) / SURVEY_N;
  return [calc(4, 2, 1), calc(6, 3, 3), calc(8, 4, 5)];
}

// Hours per day the pump keeps running after the tank is full, for halls that
// do NOT already have a float switch (5 of 16 respondents said they do).
function pumpOverflowHours(): Triple {
  const daily = count('tank', 'daily');
  const weekly = count('tank', 'weekly');
  const rare = count('tank', 'rare');
  const withoutSwitch = SURVEY_N - count('tank', 'auto');
  const calc = (weeklyDays: number, rareDays: number, hoursPerEvent: number) =>
    ((daily * 7 + weekly * weeklyDays + rare * rareDays) / withoutSwitch / 7) * hoursPerEvent;
  return [calc(2, 0.1, 0.25), calc(2.5, 0.25, 0.5), calc(3, 0.5, 0.75)];
}

const r2 = (t: Triple): Triple => t.map((x) => Math.round(x * 100) / 100) as Triple;

export const DEFAULT_ASSUMPTIONS: Assumption[] = [
  {
    id: 'corridorWasteH',
    label: 'Corridor lights on in daylight for no reason',
    unit: 'h/day',
    value: r2(corridorWasteHours()),
    basis: 'survey',
    note: '6 of 16 said "almost daily, 4-8 h", 6 said "sometimes, 2-4 h". Low/mid/high read the answer ranges at their low, middle and high ends.',
  },
  {
    id: 'daylightCapture',
    label: 'Share of that waste removed by the daylight sensor',
    unit: '%',
    value: [70, 85, 95],
    basis: 'estimate',
    note: 'Cloudy days and dark stretches of corridor still need light.',
  },
  {
    id: 'washroomPirSaving',
    label: 'Washroom lighting saved by motion sensors (15 min hold)',
    unit: '%',
    value: [15, 24, 35],
    basis: 'literature',
    note: 'Williams et al. (2012), LEUKOS 8(3), meta-analysis: occupancy controls saved 24% on average.',
  },
  {
    id: 'pumpOverflowH',
    label: 'Pump running after the tank is full (halls without float switch)',
    unit: 'h/day',
    value: r2(pumpOverflowHours()),
    basis: 'survey',
    note: 'Overflow frequency from the survey; 15/30/45 min per event is our estimate.',
  },
  {
    id: 'feedbackSaving',
    label: 'Reduction in room fan and light use from reminders and wing ranking',
    unit: '%',
    value: [2, 5, 10],
    basis: 'literature',
    note: 'Darby (2006): direct feedback 5-15%. Petersen et al. (2007): 32% in a two-week dorm contest. We assume much less because effects fade.',
  },
  {
    id: 'cookingShift',
    label: 'In-room cooking moved to the shared induction cooker',
    unit: '%',
    value: [25, Math.round(share('pantry', 'yes') * 100), Math.round((share('pantry', 'yes') + share('pantry', 'partly')) * 100)],
    basis: 'survey',
    note: '9 of 16 said students would use it; 3 more said partly.',
  },
  {
    id: 'bldcShare',
    label: 'Ceiling fans replaced with BLDC fans',
    unit: '%',
    value: [0, 0, 0],
    basis: 'estimate',
    note: 'Optional retrofit, off by default. Set a share to include it.',
  },
];

export type AssumptionMap = Record<string, Triple>;
export const toMap = (a: Assumption[]): AssumptionMap => Object.fromEntries(a.map((x) => [x.id, x.value]));

// ---------------------------------------------------------------------------
// Appliance inventory (baseline, one active day)
// ---------------------------------------------------------------------------

export type Group = 'room' | 'personal' | 'cooking' | 'common' | 'infra';
export type Per = 'room' | 'student' | 'wing' | 'hall';

export interface Item {
  id: string;
  name: string;
  group: Group;
  node: 'wing' | 'common'; // which meter sees it
  per: Per;
  perQty: number;
  watts: number;
  hours: number; // average hours per active day
  pf: number;
  basis: Basis;
  note: string;
}

export const FAN_W = 75; // Walton WCF5601EM 56" conventional, rated 75 W
export const BLDC_W = 35; // Walton BLDC Super Saver-IR 56", rated 35 W

export function inventory(a: AssumptionMap, s = 1): Item[] {
  const lamp = share('devices', 'lamp');
  const tableFan = share('devices', 'tableFan');
  const laptop = share('devices', 'laptop');
  const desktop = share('devices', 'desktop');
  const overflow = a.pumpOverflowH[s];
  return [
    { id: 'fan', name: 'Ceiling fan', group: 'room', node: 'wing', per: 'room', perQty: 2, watts: FAN_W, hours: 10, pf: 0.9, basis: 'nameplate', note: 'Rating of a common 56" fan. 10 h/day is a yearly average (less in winter).' },
    { id: 'roomLight', name: 'Room LED tube light', group: 'room', node: 'wing', per: 'room', perQty: 2, watts: 20, hours: 7, pf: 0.9, basis: 'estimate', note: 'Two tubes per room as most respondents reported.' },
    { id: 'studyLamp', name: 'Study lamp', group: 'personal', node: 'wing', per: 'room', perQty: round2(lamp), watts: 10, hours: 5, pf: 0.6, basis: 'survey', note: `${count('devices', 'lamp')}/16 rooms report one.` },
    { id: 'tableFan', name: 'Table fan', group: 'personal', node: 'wing', per: 'room', perQty: round2(tableFan), watts: 35, hours: 6, pf: 0.9, basis: 'survey', note: `${count('devices', 'tableFan')}/16 rooms report one.` },
    { id: 'laptop', name: 'Laptop charging', group: 'personal', node: 'wing', per: 'room', perQty: round2(laptop * 2), watts: 45, hours: 4, pf: 0.6, basis: 'survey', note: `${count('devices', 'laptop')}/16 rooms report laptops; two per such room assumed.` },
    { id: 'desktop', name: 'Desktop PC and monitor', group: 'personal', node: 'wing', per: 'room', perQty: round2(desktop), watts: 120, hours: 5, pf: 0.9, basis: 'survey', note: `${count('devices', 'desktop')}/16 rooms report one.` },
    { id: 'phone', name: 'Phone charger', group: 'personal', node: 'wing', per: 'student', perQty: 1, watts: 10, hours: 3, pf: 0.5, basis: 'estimate', note: '' },
    { id: 'cooker', name: 'In-room rice cooker or coil stove', group: 'cooking', node: 'wing', per: 'hall', perQty: 18, watts: 1000, hours: 1, pf: 1, basis: 'estimate', note: '5/16 say many students cook in rooms; the number of units is our guess.' },
    { id: 'kettle', name: 'Kettle or iron', group: 'cooking', node: 'wing', per: 'hall', perQty: 48, watts: 1500, hours: 0.15, pf: 1, basis: 'estimate', note: 'Counted as a violation and alerted if on for more than 2 minutes.' },
    { id: 'corridor', name: 'Corridor and veranda light', group: 'common', node: 'wing', per: 'wing', perQty: 8, watts: 20, hours: round2(12 + a.corridorWasteH[s]), pf: 0.9, basis: 'survey', note: '12 h at night plus daytime waste from the survey.' },
    { id: 'washroom', name: 'Washroom light', group: 'common', node: 'wing', per: 'wing', perQty: 6, watts: 18, hours: 16, pf: 0.9, basis: 'estimate', note: '' },
    { id: 'exhaust', name: 'Washroom exhaust fan', group: 'common', node: 'wing', per: 'wing', perQty: 2, watts: 30, hours: 12, pf: 0.85, basis: 'estimate', note: 'Not switched by HallGrid; ventilation stays as it is.' },
    { id: 'stair', name: 'Stair and lobby light', group: 'infra', node: 'common', per: 'hall', perQty: 16, watts: 20, hours: 12, pf: 0.9, basis: 'estimate', note: 'Not switched by HallGrid (safety lighting).' },
    { id: 'router', name: 'Wi-Fi router and ONU', group: 'infra', node: 'common', per: 'hall', perQty: 24, watts: 12, hours: 24, pf: 0.6, basis: 'estimate', note: '' },
    { id: 'pump', name: 'Submersible pump, 2 HP', group: 'infra', node: 'common', per: 'hall', perQty: 1, watts: 2000, hours: round2(5 + overflow), pf: 0.8, basis: 'estimate', note: '1.49 kW shaft power at about 75% motor efficiency. 5 h/day of needed pumping is a guess.' },
  ];
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

export function qtyOf(it: Item, h: Hall): number {
  const c = counts(h);
  const n = it.per === 'room' ? c.rooms : it.per === 'student' ? c.students : it.per === 'wing' ? c.wings : 1;
  return it.perQty * n;
}

export const dailyKwh = (it: Item, h: Hall) => (qtyOf(it, h) * it.watts * it.hours) / 1000;

// ---------------------------------------------------------------------------
// Measures
// ---------------------------------------------------------------------------

export interface MeasureResult {
  id: string;
  name: string;
  how: string;
  kwh: Triple;
}

const DOE_COIL_EFF = 0.74;
const DOE_INDUCTION_EFF = 0.84;

export interface ModelResult {
  hall: Hall;
  baselineKwh: Triple; // per year
  baselineByGroup: { group: Group; kwh: number }[];
  measures: MeasureResult[];
  totalKwh: Triple;
  totalPct: Triple;
  bdt: Triple;
  co2t: Triple;
}

export const GRID_EF = 0.62; // kg CO2 per kWh, DoE Bangladesh (Article 6 DNA), 2020-22

export function runModel(h: Hall, a: AssumptionMap): ModelResult {
  const days = h.activeDays;
  const scen = [0, 1, 2] as const;
  const inv = scen.map((s) => inventory(a, s));
  const yearly = (s: number, id: string) => dailyKwh(inv[s].find((x) => x.id === id)!, h) * days;
  const baselineKwh = scen.map((s) => inv[s].reduce((t, it) => t + dailyKwh(it, h), 0) * days) as Triple;

  const groups: Group[] = ['room', 'personal', 'cooking', 'common', 'infra'];
  const baselineByGroup = groups.map((g) => ({
    group: g,
    kwh: inv[1].filter((x) => x.group === g).reduce((t, it) => t + dailyKwh(it, h), 0) * days,
  }));

  const c = counts(h);
  const corridorKw = (c.wings * 8 * 20) / 1000;
  const m: MeasureResult[] = [
    {
      id: 'daylight',
      name: 'Daylight cut-off for corridor lights',
      how: 'Light sensor at each wing board switches corridor lights off in daylight.',
      kwh: scen.map((s) => corridorKw * a.corridorWasteH[s] * (a.daylightCapture[s] / 100) * days) as Triple,
    },
    {
      id: 'pir',
      name: 'Motion sensors for washroom lights',
      how: 'Lights stay on for 15 min after the last movement.',
      kwh: scen.map((s) => yearly(s, 'washroom') * (a.washroomPirSaving[s] / 100)) as Triple,
    },
    {
      id: 'pump',
      name: 'Pump stop at full tank',
      how: 'Ultrasonic level sensor stops the pump; zero for halls that already have a float switch.',
      kwh: scen.map((s) => 2.0 * a.pumpOverflowH[s] * days) as Triple,
    },
    {
      id: 'feedback',
      name: 'Class-time reminder and wing ranking',
      how: 'Students see their own wing meter and get a reminder before class. No relays in rooms.',
      kwh: scen.map((s) => (yearly(s, 'fan') + yearly(s, 'roomLight') + yearly(s, 'tableFan') + yearly(s, 'studyLamp')) * (a.feedbackSaving[s] / 100)) as Triple,
    },
    {
      id: 'cooking',
      name: 'Shared induction cooker per floor',
      how: `Moves cooking from coil stoves (about ${DOE_COIL_EFF * 100}% efficient) to induction (about ${DOE_INDUCTION_EFF * 100}%). Main benefit is fire safety.`,
      kwh: scen.map((s) => yearly(s, 'cooker') * (a.cookingShift[s] / 100) * (1 - DOE_COIL_EFF / DOE_INDUCTION_EFF)) as Triple,
    },
    {
      id: 'bldc',
      name: 'BLDC ceiling fans (optional)',
      how: `Replaces ${FAN_W} W fans with ${BLDC_W} W BLDC fans; wing meters verify the drop.`,
      kwh: scen.map((s) => yearly(s, 'fan') * (a.bldcShare[s] / 100) * (1 - BLDC_W / FAN_W)) as Triple,
    },
  ];

  const totalKwh = scen.map((s) => m.reduce((t, x) => t + x.kwh[s], 0)) as Triple;
  const totalPct = scen.map((s) => (totalKwh[s] / baselineKwh[s]) * 100) as Triple;
  const bdt = scen.map((s) => totalKwh[s] * h.tariff) as Triple;
  const co2t = scen.map((s) => (totalKwh[s] * GRID_EF) / 1000) as Triple;
  return { hall: h, baselineKwh, baselineByGroup, measures: m, totalKwh, totalPct, bdt, co2t };
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

export interface BomLine {
  id: string;
  item: string;
  source: string;
  unit: number;
  qty: (h: Hall) => number;
  basis: Basis;
  optional?: 'pantry';
}

const nodes = (h: Hall) => counts(h).wings + 1;
const wings = (h: Hall) => counts(h).wings;

// Prices checked on 21 Oct 2026. "market" lines are RoboticsBD / Walton / retailer
// listings; "estimate" lines need a local quotation before purchase.
export const BOM: BomLine[] = [
  { id: 'pzem', item: 'PZEM-004T energy meter, open (split) CT', source: 'RoboticsBD RBD-3110', unit: 1690, qty: nodes, basis: 'market' },
  { id: 'esp32', item: 'ESP32 DevKit V1 (CP2102)', source: 'RoboticsBD RBD-2267', unit: 650, qty: nodes, basis: 'market' },
  { id: 'psu', item: 'HLK-PM01 230 V to 5 V supply', source: 'RoboticsBD RBD-4582', unit: 430, qty: nodes, basis: 'market' },
  { id: 'relay', item: '2-channel 5 V relay module', source: 'RoboticsBD RBD-0408', unit: 151, qty: nodes, basis: 'market' },
  { id: 'protect', item: '6 A MCB, fuse holder, 275 V MOV, terminals', source: 'Local electrical shop', unit: 650, qty: nodes, basis: 'estimate' },
  { id: 'box', item: 'IP65 ABS enclosure', source: 'Local electrical shop', unit: 450, qty: nodes, basis: 'estimate' },
  { id: 'ldr', item: 'LDR light sensor module', source: 'RoboticsBD RBD-2093', unit: 50, qty: wings, basis: 'market' },
  { id: 'pir', item: 'HC-SR501 PIR sensor + housing', source: 'RoboticsBD RBD-0023 + RBD-3032', unit: 247, qty: wings, basis: 'market' },
  { id: 'cable', item: 'Sensor cable, about 30 m per wing', source: 'Local electrical shop', unit: 750, qty: wings, basis: 'estimate' },
  { id: 'sonar', item: 'JSN-SR04T waterproof ultrasonic sensor', source: 'RoboticsBD RBD-3957', unit: 850, qty: () => 1, basis: 'market' },
  { id: 'contactor', item: '25 A contactor, 220 V coil (Schneider LC1D25M7)', source: 'King Power listing', unit: 2780, qty: () => 1, basis: 'market' },
  { id: 'labour', item: 'Licensed electrician, about 3 days', source: 'Local rate', unit: 4500, qty: () => 1, basis: 'estimate' },
  { id: 'induction', item: 'Induction cooker 2000 W (Walton WI-Cook Master)', source: 'BDStall listing', unit: 3300, qty: (h) => h.floors, basis: 'market', optional: 'pantry' },
  { id: 'pots', item: 'Induction-compatible steel pots', source: 'Local market', unit: 800, qty: (h) => h.floors, basis: 'estimate', optional: 'pantry' },
];

export const CONTINGENCY = 0.15;
export const BLDC_PRICE = 6490; // Walton BLDC Super Saver-IR list price
export const FAN_PRICE = 4150; // Walton WCF5601EM list price

export interface CostOptions {
  pantry: boolean;
  bldcOnFailure: boolean; // count only the extra cost over a normal fan
  rebatePct: number; // share of savings paid back to students
  serviceBdtPerMonth: number; // hosting and support per hall
}

export const DEFAULT_COSTS: CostOptions = { pantry: true, bldcOnFailure: true, rebatePct: 25, serviceBdtPerMonth: 1000 };

export function bomTotal(h: Hall, o: CostOptions) {
  const lines = BOM.filter((b) => !b.optional || (b.optional === 'pantry' && o.pantry)).map((b) => ({ ...b, n: b.qty(h), total: b.unit * b.qty(h) }));
  const subtotal = lines.reduce((t, l) => t + l.total, 0);
  const contingency = Math.round(subtotal * CONTINGENCY);
  return { lines, subtotal, contingency, total: subtotal + contingency };
}

export function economics(r: ModelResult, a: AssumptionMap, o: CostOptions) {
  const c = counts(r.hall);
  const sys = bomTotal(r.hall, o).total;
  const fans = c.rooms * 2;
  const bldcUnit = o.bldcOnFailure ? BLDC_PRICE - FAN_PRICE : BLDC_PRICE;
  return [0, 1, 2].map((s) => {
    const bldc = Math.round((fans * a.bldcShare[s]) / 100) * bldcUnit;
    const capex = sys + bldc;
    const gross = r.bdt[s];
    const rebate = gross * (o.rebatePct / 100);
    const service = o.serviceBdtPerMonth * 12;
    const net = gross - rebate - service;
    return {
      capex,
      bldc,
      gross,
      rebate,
      service,
      net,
      paybackYears: net > 0 ? capex / net : Infinity,
    };
  });
}
