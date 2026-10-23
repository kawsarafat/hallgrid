// Validation for messages sent by the ESP32 nodes (firmware 2.x).
// Kept free of server imports so the dashboard can show the same rules.

export const EVENT_TYPES = ['step', 'resistive_alert', 'resistive_short', 'resistive_end', 'outage', 'restore', 'pump_stop'] as const;

export type NodeMessage = {
  nodeId: string;
  fw?: string;
  kind: 'summary' | 'event';
  up?: number;
  ts?: number;
  samples?: number;
  meter?: { v: number; p: number; n: number; pMax?: number; pf?: number; hz?: number; kwh?: number } | null;
  relays?: Record<string, boolean>;
  tank?: { pct: number; state: string; reason?: string };
  light?: { bright: number; night: boolean };
  faults?: string[];
  event?: { type: (typeof EVENT_TYPES)[number]; [k: string]: unknown };
};

const num = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

export function validate(body: unknown): { ok: true; msg: NodeMessage } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object.' };
  const b = body as Record<string, unknown>;
  if (typeof b.nodeId !== 'string' || !/^[a-z0-9-]{1,32}$/.test(b.nodeId)) return { ok: false, error: 'nodeId must be 1-32 characters: a-z, 0-9 or "-".' };
  if (b.kind !== 'summary' && b.kind !== 'event') return { ok: false, error: 'kind must be "summary" or "event".' };

  if (b.kind === 'summary') {
    if (b.meter !== null && b.meter !== undefined) {
      const m = b.meter as Record<string, unknown>;
      if (!num(m.v, 0, 300)) return { ok: false, error: 'meter.v must be 0-300 V.' };
      if (!num(m.p, 0, 25000)) return { ok: false, error: 'meter.p must be 0-25000 W.' };
      if (!num(m.n, 0, 25000)) return { ok: false, error: 'meter.n must be 0-25000 VA.' };
      if (m.pf !== undefined && m.pf !== null && !num(m.pf, 0, 1)) return { ok: false, error: 'meter.pf must be 0-1.' };
    }
    if (b.tank !== undefined) {
      const t = b.tank as Record<string, unknown>;
      if (!num(t.pct, -1, 100)) return { ok: false, error: 'tank.pct must be -1 (unknown) to 100.' };
    }
    if (b.faults !== undefined && (!Array.isArray(b.faults) || b.faults.some((f) => typeof f !== 'string'))) {
      return { ok: false, error: 'faults must be a list of strings.' };
    }
  } else {
    const e = b.event as Record<string, unknown> | undefined;
    if (!e || typeof e.type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(e.type)) {
      return { ok: false, error: `event.type must be one of: ${EVENT_TYPES.join(', ')}.` };
    }
  }
  return { ok: true, msg: b as unknown as NodeMessage };
}

export const EXAMPLE_SUMMARY: NodeMessage = {
  nodeId: 'f2-north',
  fw: '2.0.0',
  kind: 'summary',
  up: 86400,
  ts: 1792560000,
  samples: 60,
  meter: { v: 228.6, p: 1530, n: 905, pMax: 1610, pf: 0.86, hz: 50.0, kwh: 412.775 },
  relays: { corridor: false, washroom: true },
  light: { bright: 3100, night: false },
  faults: [],
};

export const EXAMPLE_EVENT: NodeMessage = {
  nodeId: 'f2-north',
  fw: '2.0.0',
  kind: 'event',
  up: 87010,
  ts: 1792560610,
  event: { type: 'resistive_alert', dP: 1004, dN: 12, cos: 1.0, startedAt: 86410, durationS: 0 },
};

// "f2-north" -> "Floor 2 north wing", "common" -> "Common / pump board"
export function nodeLabel(id: string) {
  const m = /^f(\d+)-(north|south|east|west)$/.exec(id);
  if (m) return `Floor ${m[1]} ${m[2]} wing`;
  if (id === 'common') return 'Common / pump board';
  return id;
}
