'use client';

import { useMemo, useState } from 'react';
import { Download, Leaf, PiggyBank, RotateCcw, Timer, Zap } from 'lucide-react';
import {
  BASIS_LABEL,
  BLDC_PRICE,
  BLDC_W,
  CONTINGENCY,
  FAN_PRICE,
  FAN_W,
  GRID_EF,
  SCENARIOS,
  bomTotal,
  counts,
  dailyKwh,
  economics,
  inventory,
  qtyOf,
  runModel,
  type Assumption,
  type AssumptionMap,
  type Basis,
  type CostOptions,
  type Hall,
  type Triple,
} from '@/lib/model';
import { BarList, Badge, Button, InlineNumber, Kpi, Note, NumberField, PageHeader, Panel, Segmented, Table, Toggle, bdt, fmt, pct } from './ui';

type Props = {
  hall: Hall;
  setHall: (h: Hall) => void;
  assumptions: Assumption[];
  setAssumptions: (a: Assumption[]) => void;
  a: AssumptionMap;
  costs: CostOptions;
  setCosts: (c: CostOptions) => void;
  onReset: () => void;
};

const BLDC_PLAN: Triple = [30, 50, 70];
const GROUP_LABEL = { room: 'Room fans and lights', personal: 'Personal devices', cooking: 'Cooking and heating', common: 'Corridors and washrooms', infra: 'Pump, stairs, Wi-Fi' } as const;
const BASIS_TONE: Record<Basis, 'brand' | 'good' | 'neutral' | 'warn'> = {
  survey: 'brand',
  literature: 'good',
  nameplate: 'neutral',
  market: 'neutral',
  tariff: 'neutral',
  estimate: 'warn',
};

const SourceBadge = ({ b }: { b: Basis }) => (
  <Badge tone={BASIS_TONE[b]} icon={null}>
    {BASIS_LABEL[b]}
  </Badge>
);

export function Savings({ hall, setHall, assumptions, setAssumptions, a, costs, setCosts, onReset }: Props) {
  const r = useMemo(() => runModel(hall, a), [hall, a]);
  const econ = useMemo(() => economics(r, a, costs), [r, a, costs]);
  const bom = useMemo(() => bomTotal(hall, costs), [hall, costs]);
  const inv = useMemo(() => inventory(a, 1), [a]);
  const c = counts(hall);
  const [halls, setHalls] = useState(100);
  const plan = a.bldcShare.some((x) => x > 0) ? 'bldc' : 'controls';

  const setAssumption = (id: string, i: number, v: number) =>
    setAssumptions(assumptions.map((x) => (x.id === id ? { ...x, value: x.value.map((y, j) => (j === i ? v : y)) as Triple } : x)));
  const setBldc = (t: Triple) => setAssumptions(assumptions.map((x) => (x.id === 'bldcShare' ? { ...x, value: t } : x)));

  const csv = () => {
    const lines = [['measure', ...SCENARIOS.map((s) => `${s} kWh/yr`)].join(',')];
    for (const m of r.measures) lines.push([`"${m.name}"`, ...m.kwh.map((x) => Math.round(x))].join(','));
    lines.push(['Total', ...r.totalKwh.map((x) => Math.round(x))].join(','));
    lines.push(['Baseline', ...r.baselineKwh.map((x) => Math.round(x))].join(','));
    lines.push(['Saving %', ...r.totalPct.map((x) => x.toFixed(2))].join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const el = document.createElement('a');
    el.href = url;
    el.download = 'hallgrid-savings.csv';
    el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings model"
        description="Every figure on this page is calculated from the inputs below. Change any input and the whole page updates."
        actions={
          <>
            <Button icon={Download} onClick={csv}>
              Export CSV
            </Button>
            <Button icon={RotateCcw} onClick={onReset}>
              Reset inputs
            </Button>
          </>
        }
      />

      <Note title="Planning estimate">
        The baseline comes from an appliance list, not a meter or an electricity bill. A pilot starts with two weeks of metering with all automation off,
        to measure the real baseline.
      </Note>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-ink-2">Plan</span>
        <Segmented
          label="Plan"
          value={plan}
          options={[
            { value: 'controls', label: 'Controls and behaviour' },
            { value: 'bldc', label: `+ BLDC fans (${BLDC_PLAN[1]}% of fans)` },
          ]}
          onChange={(v) => setBldc(v === 'bldc' ? BLDC_PLAN : [0, 0, 0])}
        />
        <span className="text-xs text-ink-3">
          BLDC: {FAN_W} W to {BLDC_W} W per fan (Walton ratings), checked wing by wing on the meters.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Zap} tone="good" label="Saving, expected" value={fmt(r.totalPct[1], 1)} unit="%" sub={`${pct(r.totalPct[0])} conservative · ${pct(r.totalPct[2])} optimistic`} />
        <Kpi icon={Leaf} label="Energy saved" value={fmt(r.totalKwh[1])} unit="kWh/yr" sub={`${fmt(r.co2t[1], 1)} t CO₂ at ${GRID_EF} kg/kWh`} />
        <Kpi icon={PiggyBank} label="Money saved" value={bdt(r.bdt[1])} unit="/yr" sub={`At ৳${hall.tariff}/kWh energy charge`} />
        <Kpi
          icon={Timer}
          label="Net payback"
          value={Number.isFinite(econ[1].paybackYears) ? fmt(econ[1].paybackYears, 1) : 'never'}
          unit={Number.isFinite(econ[1].paybackYears) ? 'years' : undefined}
          sub={`Setup cost ${bdt(econ[1].capex)}`}
        />
      </div>

      {plan === 'controls' && r.totalPct[1] < 15 && (
        <Note tone="info" title="Below the 15% target">
          Controls and reminders alone do not reach 15% in this model. Ceiling fans use about {fmt(((dailyKwh(inv.find((x) => x.id === 'fan')!, hall) * hall.activeDays) / r.baselineKwh[1]) * 100)}%
          of the hall&apos;s electricity, so the realistic path to 15% is HallGrid plus BLDC fans, with the wing meters verifying the result.
        </Note>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Savings by measure" description="kWh per year in each scenario" flush>
          <Table
            head={['Measure', ...SCENARIOS]}
            rows={[
              ...r.measures.map((m) => [
                <div key="m" className="min-w-[220px]">
                  <div className="font-medium text-ink">{m.name}</div>
                  <div className="mt-0.5 text-xs text-ink-3">{m.how}</div>
                </div>,
                ...m.kwh.map((x, i) => <span key={i} className={i === 1 ? 'font-medium text-ink' : 'text-ink-2'}>{fmt(x)}</span>),
              ]),
              [<b key="t">Total</b>, ...r.totalKwh.map((x, i) => <b key={i}>{fmt(x)}</b>)],
              [<span key="s" className="text-ink-2">Share of baseline</span>, ...r.totalPct.map((x, i) => <span key={i}>{pct(x)}</span>)],
              [<span key="b" className="text-ink-2">Value per year</span>, ...r.bdt.map((x, i) => <span key={i}>{bdt(x)}</span>)],
            ]}
          />
        </Panel>

        <Panel title="Where the electricity goes" description={`Baseline ${fmt(r.baselineKwh[1])} kWh/yr, expected case`}>
          <BarList
            items={r.baselineByGroup.map((g) => ({ label: GROUP_LABEL[g.group], value: (g.kwh / r.baselineKwh[1]) * 100 })).sort((x, y) => y.value - x.value)}
            unit="%"
            max={100}
            format={(n) => fmt(n, 1)}
          />
        </Panel>
      </div>

      <Panel title="Hall" description="Defaults describe a common corridor-type hall. Change them to match a real one.">
        <div className="flex flex-wrap gap-x-5 gap-y-4">
          <NumberField label="Floors" value={hall.floors} min={1} max={20} onChange={(v) => setHall({ ...hall, floors: v })} width="w-24" />
          <NumberField label="Wings per floor" value={hall.wingsPerFloor} min={1} max={6} onChange={(v) => setHall({ ...hall, wingsPerFloor: v })} width="w-24" />
          <NumberField label="Rooms per wing" value={hall.roomsPerWing} min={1} max={60} onChange={(v) => setHall({ ...hall, roomsPerWing: v })} width="w-24" />
          <NumberField label="Students per room" value={hall.studentsPerRoom} min={1} max={12} onChange={(v) => setHall({ ...hall, studentsPerRoom: v })} width="w-24" />
          <NumberField label="Occupied days" value={hall.activeDays} min={1} max={365} suffix="/yr" onChange={(v) => setHall({ ...hall, activeDays: v })} />
          <NumberField label="Class days" value={hall.classDays} min={0} max={365} suffix="/yr" onChange={(v) => setHall({ ...hall, classDays: v })} />
          <NumberField label="Tariff" value={hall.tariff} step={0.01} min={0} suffix="৳/kWh" onChange={(v) => setHall({ ...hall, tariff: v })} width="w-32" />
        </div>
        <p className="mt-4 text-xs text-ink-3">
          {c.rooms} rooms, {c.students} students. Tariff: BERC LT-D1 (education), June 2026. Check it against the hall&apos;s own bill.
        </p>
      </Panel>

      <Panel title="Assumptions" description="Conservative, expected and optimistic values are kept separate so the range stays visible." flush>
        <Table
          head={['Assumption', ...SCENARIOS, 'Source']}
          rows={assumptions.map((x) => [
            <div key="l" className="min-w-[260px]">
              <div className="text-ink">
                {x.label} <span className="text-ink-3">({x.unit})</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-3">{x.note}</div>
            </div>,
            ...x.value.map((v, i) => <InlineNumber key={i} value={v} label={`${x.label}, ${SCENARIOS[i]}`} onChange={(n) => setAssumption(x.id, i, n)} />),
            <SourceBadge key="b" b={x.basis} />,
          ])}
        />
      </Panel>

      <Panel title="Baseline inventory" description="Expected case. Quantities scale with the hall size." flush>
        <Table
          head={['Appliance', 'Qty', 'Watts', 'Hours/day', 'kWh/yr', 'Share', 'Source']}
          rows={inv.map((it) => {
            const k = dailyKwh(it, hall) * hall.activeDays;
            return [
              <div key="n" className="min-w-[220px]">
                <div className="text-ink">{it.name}</div>
                {it.note && <div className="mt-0.5 text-xs text-ink-3">{it.note}</div>}
              </div>,
              fmt(qtyOf(it, hall)),
              fmt(it.watts),
              fmt(it.hours, 2),
              fmt(k),
              pct((k / r.baselineKwh[1]) * 100),
              <SourceBadge key="b" b={it.basis} />,
            ];
          })}
        />
      </Panel>

      <Panel title="Cost and payback" description="Hardware prices checked 21 October 2026. Lines marked as estimates need a local quotation." flush>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-line-soft px-5 py-4">
          <Toggle checked={costs.pantry} onChange={(v) => setCosts({ ...costs, pantry: v })} label="Shared induction cookers" />
          <Toggle checked={costs.bldcOnFailure} onChange={(v) => setCosts({ ...costs, bldcOnFailure: v })} label={`Buy BLDC when old fans fail (extra ৳${fmt(BLDC_PRICE - FAN_PRICE)} each)`} />
          <NumberField label="Student reward" value={costs.rebatePct} min={0} max={100} suffix="%" onChange={(v) => setCosts({ ...costs, rebatePct: v })} width="w-24" />
          <NumberField label="Hosting and support" value={costs.serviceBdtPerMonth} min={0} suffix="৳/mo" onChange={(v) => setCosts({ ...costs, serviceBdtPerMonth: v })} />
        </div>
        <Table
          head={['', ...SCENARIOS]}
          rows={[
            [<span key="h" className="text-ink-2">Monitoring and control hardware, installed</span>, ...econ.map((_, i) => <span key={i}>{bdt(bom.total)}</span>)],
            [<span key="f" className="text-ink-2">BLDC fans</span>, ...econ.map((e, i) => <span key={i}>{bdt(e.bldc)}</span>)],
            [<b key="c">Setup cost</b>, ...econ.map((e, i) => <b key={i}>{bdt(e.capex)}</b>)],
            [<span key="s" className="text-ink-2">Saving per year</span>, ...econ.map((e, i) => <span key={i}>{bdt(e.gross)}</span>)],
            [<span key="r" className="text-ink-2">Student reward</span>, ...econ.map((e, i) => <span key={i}>−{bdt(e.rebate)}</span>)],
            [<span key="o" className="text-ink-2">Hosting and support</span>, ...econ.map((e, i) => <span key={i}>−{bdt(e.service)}</span>)],
            [<b key="n">Net to the hall per year</b>, ...econ.map((e, i) => <b key={i}>{bdt(e.net)}</b>)],
            [<b key="p">Payback</b>, ...econ.map((e, i) => <b key={i}>{Number.isFinite(e.paybackYears) ? `${fmt(e.paybackYears, 1)} years` : 'does not pay back'}</b>)],
          ]}
        />
        <p className="px-5 py-4 text-xs leading-relaxed text-ink-3">
          Hardware includes {CONTINGENCY * 100}% contingency. Savings use the energy charge only; the ৳60/kVA demand charge and 5% VAT are left out, so the
          bill saving may be slightly higher. The student reward needs written approval from the provost and the treasury.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="If more halls use it" description="Expected case multiplied by the number of halls. There is no verified national count of halls, so enter your own.">
          <div className="flex flex-wrap items-end gap-6">
            <NumberField label="Halls" value={halls} min={1} max={10000} onChange={setHalls} width="w-28" />
            <dl className="grid flex-1 grid-cols-3 gap-4">
              {[
                ['Energy', `${fmt((r.totalKwh[1] * halls) / 1000)} MWh`],
                ['Money', bdt(r.bdt[1] * halls)],
                ['CO₂', `${fmt(r.co2t[1] * halls)} t`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-ink-3">{k} per year</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>

        <Panel title="Sources">
          <ul className="space-y-2 text-xs leading-relaxed text-ink-2">
            <li>Williams, Atkinson, Garbesi, Page, Rubinstein (2012). Lighting controls in commercial buildings. LEUKOS 8(3), 161-180.</li>
            <li>Darby (2006). The effectiveness of feedback on energy consumption. Environmental Change Institute, University of Oxford.</li>
            <li>Petersen, Shunturov, Janda, Platt, Weinberger (2007). Dormitory residents reduce electricity consumption when exposed to real-time visual feedback and incentives. IJSHE 8(1), 16-33.</li>
            <li>US DOE (2009). Technical Support Document, residential cooking products: coil about 74%, induction about 84% efficient.</li>
            <li>Department of Environment, Bangladesh: grid emission factor 0.62 t CO₂/MWh (2020-22).</li>
            <li>BERC retail tariff, June 2026: LT-D1 ৳9.05/kWh plus ৳60/kVA demand charge.</li>
            <li>Walton: WCF5601EM 56&quot; fan 75 W, ৳4,150; BLDC Super Saver-IR 56&quot; 35 W, ৳6,490.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
