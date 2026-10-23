'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DETECT, SCENARIOS, runScenario } from '@/lib/detect';
import { Badge, CHART, ChartTooltip, LegendItem, Note, PageHeader, Panel, fmt } from './ui';

const RULES = [
  ['Step', `A change larger than ${DETECT.MIN_STEP_W} W that holds for ${DETECT.CONFIRM_S} s is measured against the level just before it.`],
  ['Shape', `If cos φΔ of that step is at least ${DETECT.MIN_COS_DELTA}, the appliance is resistive: a heater, cooker, kettle, iron or immersion rod.`],
  ['Duration', `If it stays on for more than ${DETECT.MIN_ON_S / 60} minutes it is counted as a violation for the wing and an alert is sent. Shorter uses are logged only.`],
  ['Power cuts', `After load-shedding, steps are ignored for ${DETECT.OUTAGE_HOLDOFF_S / 60} minutes while everything restarts.`],
  ['Location', 'The alert names the wing, not the room. The electrician checks the circuits at the wing board with a clamp meter.'],
];

export function Detector() {
  const results = useMemo(() => SCENARIOS.map((sc) => ({ sc, ...runScenario(sc) })), []);
  const [sel, setSel] = useState(results[0].sc.id);
  const cur = results.find((r) => r.sc.id === sel)!;
  const alertAt = cur.events.find((e) => e.type === 'resistive_alert')?.t;
  const data = cur.trace.filter((_, i) => i % 5 === 0).map((s) => ({ min: s.t / 60, p: s.p, n: s.n }));
  const passed = results.filter((r) => r.pass).length;
  const firstStep = cur.events.find((e) => e.type === 'step');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Heater detection"
        description={
          <>
            A resistive appliance raises active power P but barely changes non-active power N. Fans, chargers and LED drivers change both. The node therefore
            looks at the power factor of the step itself, cos φ<sub>Δ</sub> = ΔP / √(ΔP² + ΔN²), not at the total wing power factor.
          </>
        }
        actions={<Badge tone={passed === results.length ? 'good' : 'crit'}>{passed} of {results.length} test cases pass</Badge>}
      />

      <Panel title="Rules" description="The same rules run in the ESP32 firmware and in this page.">
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {RULES.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
              <div>
                <div className="text-[13px] font-semibold text-ink">{t}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Note title="Synthetic test data">
        The traces below are generated (1.5 kW wing base load with meter noise), not recorded. Detection and false-alarm rates on a real feeder are still unknown;
        measuring them is the first job of a pilot.
      </Note>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-2" title="Test cases" description="Select a case to see its trace." flush>
          <ul className="divide-y divide-line-soft" role="listbox" aria-label="Test cases">
            {results.map((r) => {
              const on = r.sc.id === sel;
              return (
                <li key={r.sc.id}>
                  <button
                    role="option"
                    aria-selected={on}
                    onClick={() => setSel(r.sc.id)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${on ? 'bg-brand-50' : 'hover:bg-sunken'}`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-[13px] ${on ? 'font-semibold text-brand-800' : 'font-medium text-ink'}`}>{r.sc.title}</span>
                      <span className="mt-0.5 block text-xs text-ink-3">Expected: {r.sc.expect}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-ink-2">{r.alerted ? 'Alert' : 'No alert'}</span>
                      <Badge tone={r.pass ? 'good' : 'crit'}>{r.pass ? 'Pass' : 'Fail'}</Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          className="xl:col-span-3"
          title={cur.sc.title}
          description={cur.sc.why}
          actions={
            <div className="flex gap-4">
              <LegendItem color={CHART.s1} label="Active power P (W)" />
              <LegendItem color={CHART.s2} label="Non-active power N (VA)" />
            </div>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="min" type="number" domain={[0, cur.sc.minutes]} tickFormatter={(m) => `${m} min`} tick={CHART.tick} stroke={CHART.axis} tickLine={false} />
                <YAxis tick={CHART.tick} stroke={CHART.axis} width={48} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip labelFormat={(m) => `${Number(m).toFixed(1)} min`} />} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
                <Line type="stepAfter" dataKey="p" name="P (W)" stroke={CHART.s1} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line type="stepAfter" dataKey="n" name="N (VA)" stroke={CHART.s2} dot={false} strokeWidth={2} isAnimationActive={false} />
                {alertAt !== undefined && (
                  <ReferenceLine x={alertAt / 60} stroke={CHART.crit} strokeDasharray="4 3" label={{ value: 'Alert sent', fontSize: 11, fill: CHART.crit, position: 'insideTopRight' }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line-soft pt-4 text-[13px]">
            <div>
              <dt className="text-xs text-ink-3">First large step</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{firstStep && firstStep.type === 'step' ? `${fmt(firstStep.dP)} W` : 'none'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">cos φΔ of the step</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{firstStep && firstStep.type === 'step' ? firstStep.cosDelta.toFixed(2) : '–'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Result</dt>
              <dd className="mt-0.5">
                <Badge tone={cur.pass ? 'good' : 'crit'}>{cur.pass ? 'As expected' : 'Not as expected'}</Badge>
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel title="Known limits">
        <ul className="grid gap-3 text-[13px] leading-relaxed text-ink-2 sm:grid-cols-2">
          <li>A heater that switches on in the same few seconds as several fans may not look resistive, and can be missed.</li>
          <li>Detection is per wing (12 rooms). It tells staff where to look, not who to blame.</li>
          <li>Heaters under 800 W, and appliances with electronic power control, are not covered.</li>
          <li>The PZEM-004T reports power factor to two decimals, which limits how small a step can be classified.</li>
        </ul>
      </Panel>
    </div>
  );
}
