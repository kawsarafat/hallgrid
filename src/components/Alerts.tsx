'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { Hall } from '@/lib/model';
import { classReminder, heaterAlert, pumpLockAlert, pumpSensorAlert, reportAlert } from '@/lib/messages';
import { SPOTS } from '@/lib/report';
import { wingIds } from '@/lib/sim';
import { Printer, Radio, Send, Zap, type LucideIcon } from 'lucide-react';
import { Badge, Button, Card, PageHeader, Panel } from './ui';

export type Status = { telemetry: boolean; nodes: string[]; telegram: boolean; admin: boolean } | null;

const ROLES = [
  ['tutor', 'House tutors'],
  ['electrician', 'Electrician'],
  ['provost', 'Provost'],
  ['students', 'Students channel'],
] as const;

export function Alerts({ hall, status }: { hall: Hall; status: Status }) {
  const wings = wingIds(hall);
  const [wing, setWing] = useState(wings[0]?.label ?? '');
  const [origin, setOrigin] = useState('');
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [key, setKey] = useState('');
  const [roles, setRoles] = useState<string[]>(['electrician']);
  const [result, setResult] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    setKey(sessionStorage.getItem('hallgrid:admin') ?? '');
  }, []);

  useEffect(() => {
    if (!origin) return;
    let live = true;
    Promise.all(
      SPOTS.map(async (s) => [s.id, await QRCode.toString(`${origin}/report?${new URLSearchParams({ zone: wing, spot: s.id })}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })] as const),
    ).then((pairs) => live && setCodes(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [origin, wing]);

  const sendTest = async () => {
    sessionStorage.setItem('hallgrid:admin', key);
    setResult('Sending...');
    try {
      const r = await fetch('/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
        body: JSON.stringify({ roles, text: 'Test message from the HallGrid dashboard.' }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; sent?: number };
      setResult(j.ok ? `Delivered to ${j.sent} chat(s).` : j.error ?? `HTTP ${r.status}`);
    } catch (e) {
      setResult(String(e));
    }
  };

  const templates: [string, string, string][] = [
    ['Unauthorised appliance, 2+ min', 'Tutor, electrician', heaterAlert(`${wings[2]?.label ?? 'Floor 2 north'} wing`, 1200, 1)],
    ['Pump locked out', 'Electrician', pumpLockAlert('max_runtime')],
    ['Level sensor fault', 'Electrician', pumpSensorAlert()],
    ['QR report', 'Electrician', reportAlert(1001, 'Lights on in daylight', `${wings[0]?.label ?? 'Floor 1 north'}, Corridor switchboard`, '')],
    ['Class-time reminder', 'Students channel', classReminder()],
  ];

  const recipients: Record<string, string> = { 'Tutor, electrician': 'brand', Electrician: 'neutral', 'Students channel': 'good' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts and QR"
        description="Messages go through a Telegram bot owned by the hall. The bot token and chat IDs are set on the server, never in the browser."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatusRow icon={Send} label="Telegram bot" state={status === null ? null : status.telegram} on="Connected" off="Not configured on this server" />
        <StatusRow
          icon={Radio}
          label="Node telemetry"
          state={status === null ? null : status.telemetry}
          on={`${status?.nodes.length ?? 0} node key${status?.nodes.length === 1 ? '' : 's'} set`}
          off="Off: no node keys set"
        />
      </div>

      <Panel title="Messages" description="Exactly what each recipient receives.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map(([title, to, text]) => (
            <div key={title} className="flex flex-col rounded-lg ring-1 ring-inset ring-line">
              <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
                <span className="text-[13px] font-semibold text-ink">{title}</span>
                <Badge tone={(recipients[to] as 'brand' | 'neutral' | 'good') ?? 'neutral'} icon={null}>
                  {to}
                </Badge>
              </div>
              <p className="flex-1 whitespace-pre-line px-4 py-3 text-[13px] leading-relaxed text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </Panel>

      {status?.telegram && status.admin && (
        <Panel title="Send a test message" description="Requires the admin key set on the server.">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">Admin key</span>
              <input
                type="password"
                className="h-9 w-52 rounded-lg px-2.5 text-sm ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Recipients</legend>
              {ROLES.map(([id, label]) => (
                <label key={id} className="inline-flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={roles.includes(id)} onChange={(e) => setRoles(e.target.checked ? [...roles, id] : roles.filter((r) => r !== id))} />
                  {label}
                </label>
              ))}
            </fieldset>
            <Button primary icon={Send} onClick={sendTest} disabled={!key || roles.length === 0}>
              Send test
            </Button>
            {result && <span className="text-[13px] text-ink-2">{result}</span>}
          </div>
        </Panel>
      )}

      <Panel
        title="QR stickers"
        description="Print and place near switchboards, washrooms and taps. Scanning opens a report form for that exact spot."
        actions={
          <>
            <select
              className="h-9 rounded-lg bg-surface px-2.5 text-[13px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={wing}
              onChange={(e) => setWing(e.target.value)}
              aria-label="Wing"
            >
              {wings.map((w) => (
                <option key={w.id} value={w.label}>
                  {w.label}
                </option>
              ))}
            </select>
            <Button icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      >
        <div className="print-area grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SPOTS.map((s) => (
            <div key={s.id} className="flex flex-col items-center rounded-xl border-2 border-dashed border-line p-5 text-center">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                <Zap size={12} aria-hidden /> HallGrid
              </div>
              <div className="mt-1 text-[15px] font-semibold text-ink">Report a problem here</div>
              <div className="mt-3 h-36 w-36" dangerouslySetInnerHTML={{ __html: codes[s.id] ?? '' }} />
              <div className="mt-3 text-[13px] font-medium text-ink">
                {wing}, {s.name}
              </div>
              <div className="mt-0.5 text-xs text-ink-3">Scan with your phone camera</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-3">On this demo server, reports are kept in memory and lost when the server restarts.</p>
      </Panel>
    </div>
  );
}

function StatusRow({ icon: Icon, label, state, on, off }: { icon: LucideIcon; label: string; state: boolean | null; on: string; off: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sunken text-ink-2">
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        <div className="text-xs text-ink-3">{state === null ? 'Checking…' : state ? on : off}</div>
      </div>
      {state !== null && <Badge tone={state ? 'good' : 'warn'}>{state ? 'On' : 'Off'}</Badge>}
    </Card>
  );
}
