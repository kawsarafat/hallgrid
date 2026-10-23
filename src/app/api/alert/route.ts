import { isAdmin, json, sendTelegram, telegramConfigured, type Role } from '@/lib/server';

export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['tutor', 'electrician', 'provost', 'students'];

// POST /api/alert  sends a message through the hall's Telegram bot; admin only
export async function POST(req: Request) {
  if (!isAdmin(req)) return json({ ok: false, error: 'Admin key required.' }, 401);
  if (!telegramConfigured()) return json({ ok: false, error: 'Telegram is not configured on this server.' }, 503);
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Body is not valid JSON.' }, 400);
  }
  const text = typeof b.text === 'string' ? b.text.trim().slice(0, 1000) : '';
  const roles = Array.isArray(b.roles) ? (b.roles.filter((r) => ROLES.includes(r as Role)) as Role[]) : [];
  if (!text || roles.length === 0) return json({ ok: false, error: 'Message text and at least one recipient group are required.' }, 400);
  const r = await sendTelegram(roles, text);
  return json({ ok: r.sent > 0, ...r });
}
