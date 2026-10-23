import { reportAlert } from '@/lib/messages';
import { ISSUES, SPOTS } from '@/lib/report';
import { isAdmin, json, pushCapped, rateLimited, sendTelegram, store } from '@/lib/server';

export const dynamic = 'force-dynamic';

// POST /api/report  public; used by the QR sticker page
export async function POST(req: Request) {
  if (rateLimited(req, 'report', 5, 10 * 60 * 1000)) {
    return json({ ok: false, error: 'Too many reports from this device. Please try again later.' }, 429);
  }
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Body is not valid JSON.' }, 400);
  }
  const zone = typeof b.zone === 'string' ? b.zone.trim().slice(0, 60) : '';
  const spot = typeof b.spot === 'string' ? b.spot : '';
  const issue = typeof b.issue === 'string' ? b.issue : '';
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) : '';
  if (!zone) return json({ ok: false, error: 'Location is missing.' }, 400);
  const spotDef = SPOTS.find((s) => s.id === spot);
  const issueDef = ISSUES.find((i) => i.id === issue);
  if (!spotDef) return json({ ok: false, error: 'Unknown location on the sticker.' }, 400);
  if (!issueDef) return json({ ok: false, error: 'Choose a problem from the list.' }, 400);

  const id = (store.reports[0]?.id ?? 1000) + 1;
  pushCapped(store.reports, { id, receivedAt: new Date().toISOString(), zone, spot, issue, note });

  const tg = await sendTelegram(['electrician'], reportAlert(id, issueDef.name, `${zone}, ${spotDef.name}`, note));
  return json({ ok: true, id, forwarded: tg.sent > 0 });
}

// GET /api/report  recent reports; admin only
export async function GET(req: Request) {
  if (!isAdmin(req)) return json({ ok: false, error: 'Admin key required.' }, 401);
  return json({ ok: true, reports: store.reports.slice(0, 100) });
}
