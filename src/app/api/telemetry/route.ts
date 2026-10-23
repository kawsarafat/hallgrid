import { heaterAlert, pumpLockAlert, pumpSensorAlert } from '@/lib/messages';
import { nodeLabel, validate } from '@/lib/payload';
import { countViolation, json, nodeKeys, pushCapped, safeEqual, sendTelegram, store, violationsThisMonth } from '@/lib/server';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4096;

// POST /api/telemetry            message from a node, needs X-Node-Key
// POST /api/telemetry?validate=1 checks a message against the schema; stores nothing, needs no key
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ ok: false, error: 'Message too large.' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Body is not valid JSON.' }, 400);
  }
  const v = validate(body);
  if (new URL(req.url).searchParams.get('validate') === '1') {
    return v.ok ? json({ ok: true, stored: false }) : json({ ok: false, error: v.error }, 400);
  }
  if (!v.ok) return json({ ok: false, error: v.error }, 400);

  const keys = nodeKeys();
  if (keys.size === 0) return json({ ok: false, error: 'Telemetry is not enabled on this server (NODE_KEYS is not set).' }, 503);
  const expected = keys.get(v.msg.nodeId);
  const got = req.headers.get('x-node-key') ?? '';
  if (!expected || !safeEqual(got, expected)) return json({ ok: false, error: 'Unknown node or wrong key.' }, 401);

  const receivedAt = new Date().toISOString();
  const msg = v.msg;
  if (msg.kind === 'summary') {
    store.nodes.set(msg.nodeId, { nodeId: msg.nodeId, receivedAt, body: msg as unknown as Record<string, unknown> });
  } else if (msg.event) {
    pushCapped(store.events, { nodeId: msg.nodeId, receivedAt, event: msg.event });
    const count = msg.event.type === 'resistive_alert' ? countViolation(msg.nodeId, receivedAt) : 0;
    await notify(msg.nodeId, msg.event, count);
  }
  return json({ ok: true, receivedAt });
}

async function notify(nodeId: string, e: Record<string, unknown>, count: number) {
  if (e.type === 'resistive_alert') {
    await sendTelegram(['tutor', 'electrician'], heaterAlert(nodeLabel(nodeId), Number(e.dP), count));
  } else if (e.type === 'pump_stop' && (e.reason === 'max_runtime' || e.reason === 'no_rise')) {
    await sendTelegram(['electrician'], pumpLockAlert(e.reason));
  } else if (e.type === 'pump_stop' && e.reason === 'sensor_fault') {
    await sendTelegram(['electrician'], pumpSensorAlert());
  }
}

// GET /api/telemetry  latest summary per node and recent events. Keys are never returned.
export async function GET() {
  const now = Date.now();
  const nodes = Array.from(store.nodes.values()).map((n) => ({
    ...n,
    label: nodeLabel(n.nodeId),
    ageS: Math.round((now - Date.parse(n.receivedAt)) / 1000),
  }));
  return json({
    enabled: nodeKeys().size > 0,
    storage: 'in-memory, resets when the server restarts',
    nodes,
    events: store.events.slice(0, 50),
    violations: violationsThisMonth().map((v) => ({ ...v, label: nodeLabel(v.nodeId) })),
  });
}
