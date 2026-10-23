'use client';

import { useState } from 'react';
import { CheckCircle2, Cpu, ExternalLink, Gauge, Lightbulb, ShieldCheck, Waves, XCircle } from 'lucide-react';
import { BASIS_LABEL, CONTINGENCY, bomTotal, type CostOptions, type Hall } from '@/lib/model';
import { EXAMPLE_EVENT, EXAMPLE_SUMMARY } from '@/lib/payload';
import { Badge, Button, Kpi, Note, PageHeader, Panel, Table, bdt, fmt } from './ui';

const REPO = 'https://github.com/kawsarafat/hallgrid-bd';

const WIRING: [string, string, string][] = [
  ['Wing board live and neutral', '6 A MCB, then fuse and MOV', 'Feeds the HLK-PM01 and the PZEM voltage terminals'],
  ['Wing feeder live conductor', 'PZEM-004T split-core CT', 'Clamped around the cable; nothing is cut'],
  ['HLK-PM01 5 V / GND', 'ESP32 VIN, PZEM 5 V, relay VCC', 'One 5 V rail'],
  ['PZEM TX', 'ESP32 GPIO16 via 1 kΩ / 2 kΩ divider', 'PZEM output is pulled up to 5 V'],
  ['PZEM RX', 'ESP32 GPIO17', '3.3 V drives the PZEM input'],
  ['LDR module AO', 'ESP32 GPIO34', 'Faces daylight, shielded from corridor lamps'],
  ['HC-SR501 OUT', 'ESP32 GPIO27', 'At the washroom entrance'],
  ['Relay 1, NC contact', 'Corridor lighting circuit', 'Relay off = lights on'],
  ['Relay 2, NC contact', 'Washroom lighting circuit', 'Exhaust fans keep their own switch'],
  ['Common node: Relay 1, NO contact', '25 A contactor coil, in series with any existing float switch', 'Relay off = pump off'],
  ['JSN-SR04T TRIG / ECHO', 'ESP32 GPIO5 / GPIO18 (echo via divider)', '30 cm or more above the overflow level'],
];

const NODES = [
  {
    title: 'Wing node',
    count: (h: Hall) => `${h.floors * h.wingsPerFloor} per hall, one per wing board`,
    icon: Lightbulb,
    items: [
      'Meter on the wing feeder: voltage, current, power, power factor, energy.',
      'Heater detection from power steps, reported as an event.',
      'Corridor lights off after 10 min of steady daylight, back on after 2 min of dark. Never off between 18:00 and 06:00.',
      'Washroom lights on with motion, held 15 min. No motion for 6 h in daytime is treated as a sensor fault and the lights stay on.',
    ],
  },
  {
    title: 'Common node',
    count: () => 'One per hall, on the common/pump board',
    icon: Waves,
    items: [
      'Meter on the common feeder: pump, stairs, Wi-Fi.',
      'Pump starts below 40% tank level, stops at 95%.',
      'Locks out after 90 min of running, or if the level has not risen 5% after 20 min. A person must reset it at the board.',
      'No level reading means no automatic start; the existing manual starter stays in place.',
    ],
  },
];

export function Hardware({ hall, costs }: { hall: Hall; costs: CostOptions }) {
  const bom = bomTotal(hall, costs);
  const [check, setCheck] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const nodes = hall.floors * hall.wingsPerFloor + 1;

  const validateExample = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/telemetry?validate=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(EXAMPLE_SUMMARY) });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setCheck(j.ok ? { ok: true, text: `HTTP ${r.status}. The example is valid; nothing was stored.` } : { ok: false, text: `HTTP ${r.status}. ${j.error}` });
    } catch (e) {
      setCheck({ ok: false, text: `Could not reach the server: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hardware"
        description="Off-the-shelf parts available in Bangladesh. Each node runs its own control logic and keeps working without Wi-Fi."
        actions={
          <a
            href={`${REPO}/tree/main/firmware`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface px-3.5 text-[13px] font-medium text-ink shadow-card hover:bg-sunken"
          >
            Firmware source <ExternalLink size={14} aria-hidden />
          </a>
        }
      />

      <Note title="Not yet installed">
        The firmware compiles for ESP32, and its detection logic passes the same test cases as this dashboard. Nothing has been tested on a live distribution
        board yet.
      </Note>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={Cpu} tone="brand" label="Nodes" value={fmt(nodes)} sub={`${nodes - 1} wing + 1 common`} />
        <Kpi icon={Gauge} label="Hardware, installed" value={bdt(bom.total)} sub={`Includes ${CONTINGENCY * 100}% contingency`} />
        <Kpi icon={ShieldCheck} tone="good" label="Fail-safe" value="Lights on" sub="A dead node leaves lights on and the pump off" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {NODES.map(({ title, count, icon: Icon, items }) => (
          <Panel
            key={title}
            title={
              <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon size={15} aria-hidden />
                </span>
                {title}
              </span>
            }
            description={count(hall)}
          >
            <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink-2">
              {items.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-500" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <Panel title="Wiring" description="Work inside a distribution board must be done by a licensed electrician with the board isolated." flush>
        <Table align={['l', 'l', 'l']} head={['From', 'To', 'Why']} rows={WIRING.map((w) => [<span key="a" className="font-medium text-ink">{w[0]}</span>, w[1], <span key="n" className="text-ink-2">{w[2]}</span>])} />
      </Panel>

      <Panel title="Bill of materials" description={`For the hall on the Savings page. Prices checked 21 October 2026.`} flush>
        <Table
          align={['l', 'l', 'r', 'r', 'r', 'l']}
          head={['Item', 'Where', 'Unit', 'Qty', 'Total', 'Price basis']}
          rows={[
            ...bom.lines.map((l) => [
              <span key="i" className="text-ink">{l.item}</span>,
              <span key="s" className="text-ink-2">{l.source}</span>,
              bdt(l.unit),
              fmt(l.n),
              bdt(l.total),
              <Badge key="b" tone={l.basis === 'market' ? 'neutral' : 'warn'} icon={null}>
                {BASIS_LABEL[l.basis]}
              </Badge>,
            ]),
            [<span key="s" className="text-ink-2">Subtotal</span>, '', '', '', bdt(bom.subtotal), ''],
            [<span key="c" className="text-ink-2">Contingency ({CONTINGENCY * 100}%)</span>, '', '', '', bdt(bom.contingency), ''],
            [<b key="t">Total</b>, '', '', '', <b key="v">{bdt(bom.total)}</b>, ''],
          ]}
        />
      </Panel>

      <Panel
        title="Data format"
        description="Nodes send a summary every 60 s and events immediately. Each node has its own key in the X-Node-Key header."
        actions={
          <Button onClick={validateExample} disabled={busy}>
            {busy ? 'Checking…' : 'Validate example on this server'}
          </Button>
        }
      >
        {check && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] ring-1 ring-inset ${check.ok ? 'bg-good-bg text-good-ink ring-good-line' : 'bg-crit-bg text-crit-ink ring-crit-line'}`}>
            {check.ok ? <CheckCircle2 size={15} aria-hidden /> : <XCircle size={15} aria-hidden />}
            {check.text}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ['Summary', EXAMPLE_SUMMARY],
            ['Event', EXAMPLE_EVENT],
          ].map(([t, ex]) => (
            <div key={t as string}>
              <div className="mb-2 text-xs font-medium text-ink-2">{t as string}</div>
              <pre className="overflow-x-auto rounded-lg bg-side p-4 text-xs leading-relaxed text-side-ink">{JSON.stringify(ex, null, 2)}</pre>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          <code className="rounded bg-sunken px-1">n</code> is non-active power √(S² − P²) with S = V·I. It includes reactive and distortion power and has no sign.
        </p>
      </Panel>
    </div>
  );
}
