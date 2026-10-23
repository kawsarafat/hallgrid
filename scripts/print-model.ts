// Prints the savings model for the reference hall.
// Usage: npm run model            controls and behaviour only
//        npm run model -- --bldc  with BLDC fans on 30/50/70% of fans
import { DEFAULT_ASSUMPTIONS, DEFAULT_COSTS, REFERENCE_HALL, SCENARIOS, bomTotal, economics, runModel, toMap, type Triple } from '../src/lib/model.ts';

const a = toMap(DEFAULT_ASSUMPTIONS);
if (process.argv.includes('--bldc')) a.bldcShare = [30, 50, 70] as Triple;

const r = runModel(REFERENCE_HALL, a);
const e = economics(r, a, DEFAULT_COSTS);
const b = bomTotal(REFERENCE_HALL, DEFAULT_COSTS);
const f = (n: number) => Math.round(n).toLocaleString('en-US');
const row = (label: string, v: string[]) => console.log(label.padEnd(40), ...v.map((x) => x.padStart(13)));

row('', [...SCENARIOS]);
row('Baseline, kWh/yr', r.baselineKwh.map(f));
for (const m of r.measures) row(m.name, m.kwh.map(f));
row('Total saved, kWh/yr', r.totalKwh.map(f));
row('Share of baseline', r.totalPct.map((x) => `${x.toFixed(1)}%`));
row('Saved, BDT/yr', r.bdt.map(f));
row('CO2 avoided, t/yr', r.co2t.map((x) => x.toFixed(1)));
row('Setup cost, BDT', e.map((x) => f(x.capex)));
row('Net to hall, BDT/yr', e.map((x) => f(x.net)));
row('Net payback, years', e.map((x) => (Number.isFinite(x.paybackYears) ? x.paybackYears.toFixed(1) : 'never')));
console.log(`\nHardware: ${f(b.subtotal)} + ${f(b.contingency)} contingency = ${f(b.total)} BDT`);
