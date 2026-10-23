'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, BellOff, Gauge, PiggyBank, Receipt, Zap } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { counts, runModel, type AssumptionMap, type Hall } from '@/lib/model';
import { nodeLabel } from '@/lib/payload';
import { dayCurve, simulateHall } from '@/lib/sim';
import { BarList, Badge, Card, CHART, ChartTooltip, DataSource, Kpi, LegendItem, Note, PageHeader, Panel, Segmented, Toggle, bdt, fmt } from './ui';

export type LiveNode = {
  nodeId: string;
  label: string;
  ageS: number;
  body: {
    meter?: { v: number; p: number; n: number; pf?: number } | null;
    relays?: Record<string, boolean>;
    tank?: { pct: number; state: string };
    faults?: string[];
  };
};

export type LiveEvent = { nodeId: string; receivedAt: string; event: Record<string, unknown> };
export type Violation = { nodeId: string; label: string; month: string; count: number; lastAt: string };

const EVENT_TEXT: Record<string, (e: Record<string, unknown>) => string> = {
  resistive_alert: (e) => `Violation: ${fmt(Number(e.dP))} W resistive appliance on for more than 2 minutes`,
  resistive_end: (e) => `Resistive load switched off after ${fmt(Number(e.durationS) / 60)} min`,
  resistive_short: (e) => `Short resistive use (${fmt(Number(e.durationS) / 60, 1)} min), no alert`,
  step: (e) => `Resistive step of ${fmt(Number(e.dP))} W`,
  outage: () => 'Power cut',
  restore: () => 'Power back',
  pump_stop: (e) => `Pump stopped: ${String(e.reason).replace('_', ' ')}`,
};

const HOURS = [
  { value: 7, label: '07:00' },
  { value: 11, label: '11:00' },
  { value: 15, label: '15:00' },
  { value: 20, label: '20:00' },
  { value: 2, label: '02:00' },
];

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function Overview({
  hall,
  a,
  live,
  events,
  violations,
  onNavigate,
}: {
  hall: Hall;
  a: AssumptionMap;
  live: LiveNode[];
  events: LiveEvent[];
  violations: Violation[];
  onNavigate: (t: 'savings' | 'detection') => void;
}) {
  const [hour, setHour] = useState(11);
  const [control, setControl] = useState(false);
  const [view, setView] = useState<'hall' | 'corridor'>('hall');
  const sim = useMemo(() => simulateHall(hall, a, hour, { daylightControl: control }), [hall, a, hour, control]);
  const curve = useMemo(() => dayCurve(hall, a), [hall, a]);
  const model = useMemo(() => runModel(hall, a), [hall, a]);
  const c = counts(hall);
  const liveById = new Map(live.filter((n) => n.ageS < 180).map((n) => [n.nodeId, n]));
  const liveCount = liveById.size;
  const commonLive = liveById.get('common');

  const violationsById = new Map(violations.map((v) => [v.nodeId, v.count]));
  const totalViolations = violations.reduce((t, v) => t + v.count, 0);
  const wings = sim.wings.map((w) => {
    const m = liveById.get(w.id)?.body.meter;
    return {
      ...w,
      measured: Boolean(m),
      p: m ? m.p : w.reading.p,
      pf: m ? (m.pf ?? m.p / Math.hypot(m.p, m.n)) : w.reading.pf,
      faults: liveById.get(w.id)?.body.faults ?? [],
      violations: violationsById.get(w.id) ?? 0,
    };
  });
  const commonP = commonLive?.body.meter?.p ?? sim.common.p;
  const hallLoad = wings.reduce((t, w) => t + w.p, 0) + commonP;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Wing-level load for the reference hall: ${c.floors} floors, ${c.wings} wings, ${c.rooms} rooms, ${c.students} students.`}
        actions={
          <>
            <Segmented label="Time of day" value={hour} options={HOURS} onChange={setHour} />
            <Toggle checked={control} onChange={setControl} label="Daylight control" />
          </>
        }
      />

      {liveCount === 0 ? (
        <Note title="Demo data">
          No meters are installed yet. Readings are simulated from the appliance model. When a node reports, its tile switches to measured values.
        </Note>
      ) : (
        <Note tone="info" title={`${liveCount} node${liveCount > 1 ? 's' : ''} reporting`}>
          Tiles marked Measured show real readings; the rest are still simulated.
        </Note>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Zap}
          tone="brand"
          label={liveCount ? 'Hall load now' : `Hall load at ${hh(hour)}`}
          value={fmt(hallLoad / 1000, 1)}
          unit="kW"
          sub={liveCount ? `${liveCount} measured, ${wings.length + 1 - liveCount} simulated` : 'Simulated'}
        />
        <Kpi
          icon={Gauge}
          label="Baseline use"
          value={fmt(model.baselineKwh[1] / 1000, 1)}
          unit="MWh/yr"
          sub={`${fmt(model.baselineKwh[1] / c.students / (hall.activeDays / 30), 1)} kWh per student per occupied month`}
        />
        <Kpi icon={Receipt} label="Baseline bill" value={bdt(model.baselineKwh[1] * hall.tariff)} unit="/yr" sub={`Energy charge at ৳${hall.tariff}/kWh`} />
        <Kpi
          icon={PiggyBank}
          tone="good"
          label="Estimated saving"
          value={fmt(model.totalPct[1], 1)}
          unit="%"
          sub={`Expected case. Range ${fmt(model.totalPct[0], 1)}% to ${fmt(model.totalPct[2], 1)}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Daily load profile"
          description={view === 'hall' ? 'Hourly average for the whole hall, from the model.' : 'Corridor and veranda lights only, before and after daylight control.'}
          actions={<Segmented label="Chart view" value={view} options={[{ value: 'hall', label: 'Whole hall' }, { value: 'corridor', label: 'Corridor lighting' }]} onChange={setView} />}
        >
          <div className="mb-2 flex flex-wrap gap-4">
            {view === 'hall' ? (
              <LegendItem color={CHART.s1} label="Hall load" />
            ) : (
              <>
                <LegendItem color={CHART.s1} label="As now" />
                <LegendItem color={CHART.s2} label="With daylight control" />
              </>
            )}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="hour" tickFormatter={hh} tick={CHART.tick} stroke={CHART.axis} interval={2} tickLine={false} />
                <YAxis tick={CHART.tick} stroke={CHART.axis} width={52} tickLine={false} axisLine={false} unit=" kW" />
                <Tooltip content={<ChartTooltip unit="kW" labelFormat={(l) => hh(Number(l))} />} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
                <ReferenceLine x={hour} stroke={CHART.axis} strokeDasharray="3 3" />
                {view === 'hall' ? (
                  <Line type="monotone" dataKey={control ? 'controlled' : 'now'} name="Hall load" stroke={CHART.s1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                ) : (
                  [
                    <Line key="a" type="stepAfter" dataKey="corridorNow" name="As now" stroke={CHART.s1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />,
                    <Line key="b" type="stepAfter" dataKey="corridorControlled" name="With daylight control" stroke={CHART.s2} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />,
                  ]
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {view === 'hall'
              ? 'The dashed line marks the selected time. Fans drive the evening and night peak.'
              : 'Daytime gap = corridor lights left on in daylight that the sensor switches off. Night lighting stays on for safety.'}
          </p>
        </Panel>

        <Panel title={`Load by wing at ${hh(hour)}`} description="kW, highest first">
          <BarList
            items={[...wings].sort((x, y) => y.p - x.p).map((w) => ({ label: w.label, value: w.p / 1000, note: w.measured ? 'measured' : undefined }))}
            unit="kW"
            format={(n) => fmt(n, 2)}
          />
        </Panel>
      </div>

      <Panel title="Meters" description="One PZEM-004T per wing distribution board and one on the common board." flush>
        <div className="grid gap-px overflow-hidden rounded-b-xl bg-line-soft sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {wings.map((w) => (
            <div key={w.id} className="bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink">{w.label}</span>
                <DataSource measured={w.measured} />
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{fmt(w.p / 1000, 2)}</span>
                <span className="text-xs text-ink-2">kW</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-3">PF {fmt(w.pf, 2)}</div>
              {!w.measured && (
                <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-xs">
                  {[...w.reading.parts]
                    .sort((x, y) => y.w - x.w)
                    .slice(0, 3)
                    .map((x) => (
                      <div key={x.label} className="flex justify-between">
                        <dt className="text-ink-2">{x.label}</dt>
                        <dd className="tabular-nums text-ink">{fmt(x.w)} W</dd>
                      </div>
                    ))}
                </dl>
              )}
              {w.violations > 0 && (
                <div className="mt-2">
                  <Badge tone="crit">
                    {w.violations} violation{w.violations > 1 ? 's' : ''} this month
                  </Badge>
                </div>
              )}
              {w.faults.length > 0 && (
                <div className="mt-2">
                  <Badge tone="crit">Fault: {w.faults.join(', ')}</Badge>
                </div>
              )}
            </div>
          ))}
          <div className="bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-ink">Common / pump</span>
              <DataSource measured={Boolean(commonLive)} />
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">{fmt(commonP / 1000, 2)}</span>
              <span className="text-xs text-ink-2">kW</span>
            </div>
            {commonLive?.body.tank ? (
              <div className="mt-3 border-t border-line-soft pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-2">Roof tank</span>
                  <span className="tabular-nums">{commonLive.body.tank.pct < 0 ? 'no reading' : `${commonLive.body.tank.pct}%`}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-ink-2">Pump</span>
                  <span>{commonLive.body.tank.state}</span>
                </div>
              </div>
            ) : (
              <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-xs">
                {sim.common.parts.map((x) => (
                  <div key={x.label} className="flex justify-between">
                    <dt className="text-ink-2">{x.label}</dt>
                    <dd className="tabular-nums text-ink">{fmt(x.w)} W</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Events"
          description="Unauthorised appliances on for more than 2 minutes, pump stops and power cuts."
          actions={totalViolations > 0 ? <Badge tone="crit">{totalViolations} violation{totalViolations > 1 ? 's' : ''} this month</Badge> : undefined}
          flush
        >
          {events.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-ink-3">
                <BellOff size={18} aria-hidden />
              </span>
              <div className="mt-3 text-[13px] font-medium text-ink">No events yet</div>
              <p className="mt-1 max-w-xs text-xs text-ink-3">Events appear here once nodes are installed and reporting.</p>
              <button onClick={() => onNavigate('detection')} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700">
                See how detection works <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {events.slice(0, 8).map((e, i) => {
                const crit = e.event.type === 'resistive_alert';
                return (
                  <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-[13px]">
                    <div className="flex items-start gap-2">
                      {crit ? <Badge tone="crit">Violation</Badge> : <Badge>Info</Badge>}
                      <span>
                        <span className="font-medium">{nodeLabel(e.nodeId)}</span>
                        <span className="text-ink-2"> · {(EVENT_TEXT[String(e.event.type)] ?? (() => String(e.event.type)))(e.event)}</span>
                      </span>
                    </div>
                    <time className="text-xs tabular-nums text-ink-3">{new Date(e.receivedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'short', timeStyle: 'short' })}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Where the saving comes from"
          description="Expected case, kWh per year"
          actions={
            <button onClick={() => onNavigate('savings')} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700">
              Savings model <ArrowRight size={14} aria-hidden />
            </button>
          }
        >
          <BarList items={model.measures.filter((m) => m.kwh[1] > 0).map((m) => ({ label: m.name, value: m.kwh[1] })).sort((x, y) => y.value - x.value)} unit="kWh" />
          <Card className="mt-4 bg-sunken p-3 text-xs text-ink-2 shadow-none">
            Total {fmt(model.totalKwh[1])} kWh of {fmt(model.baselineKwh[1])} kWh, worth {bdt(model.bdt[1])} a year.
          </Card>
        </Panel>
      </div>
    </div>
  );
}
