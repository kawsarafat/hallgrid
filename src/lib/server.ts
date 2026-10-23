// Server-only helpers: node keys, admin key, in-memory store and Telegram.
//
// Storage is an in-memory map. On Vercel each serverless instance has its own
// memory and it is wiped on cold start, so this is enough for a demo and for
// bench testing, not for a pilot. A pilot needs a database (see README).

import { timingSafeEqual } from 'node:crypto';

export type NodeRecord = {
  nodeId: string;
  receivedAt: string;
  body: Record<string, unknown>;
};

export type EventRecord = {
  nodeId: string;
  receivedAt: string;
  event: Record<string, unknown>;
};

export type ReportRecord = {
  id: number;
  receivedAt: string;
  zone: string;
  spot: string;
  issue: string;
  note: string;
};

export type ViolationRecord = { nodeId: string; month: string; count: number; lastAt: string };

type Store = {
  nodes: Map<string, NodeRecord>;
  events: EventRecord[];
  reports: ReportRecord[];
  hits: Map<string, number[]>;
  violations: Map<string, ViolationRecord>;
};

const g = globalThis as unknown as { __hallgrid?: Store };
export const store: Store = (g.__hallgrid ??= { nodes: new Map(), events: [], reports: [], hits: new Map(), violations: new Map() });
store.violations ??= new Map();

// Calendar month in Bangladesh time, e.g. "2026-10". Counts reset each month.
export const monthKey = (d = new Date()) => new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 7);

// Records one unauthorised-load violation for a wing and returns this month's count.
export function countViolation(nodeId: string, at: string): number {
  const month = monthKey(new Date(at));
  const cur = store.violations.get(nodeId);
  const count = cur && cur.month === month ? cur.count + 1 : 1;
  store.violations.set(nodeId, { nodeId, month, count, lastAt: at });
  return count;
}

export function violationsThisMonth(): ViolationRecord[] {
  const m = monthKey();
  return Array.from(store.violations.values()).filter((v) => v.month === m);
}

export function pushCapped<T>(arr: T[], item: T, cap = 200) {
  arr.unshift(item);
  if (arr.length > cap) arr.length = cap;
}

// NODE_KEYS="f1-north:secret1,f1-south:secret2,common:secret9"
export function nodeKeys(): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of (process.env.NODE_KEYS ?? '').split(',')) {
    const [id, key] = pair.split(':').map((s) => s.trim());
    if (id && key) m.set(id, key);
  }
  return m;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAdmin(req: Request) {
  const key = process.env.ADMIN_KEY;
  const got = req.headers.get('x-admin-key') ?? '';
  return Boolean(key) && safeEqual(got, key!);
}

// Simple per-IP rate limit for public endpoints.
export function rateLimited(req: Request, bucket: string, max: number, windowMs: number) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip');
  if (!ip) return false; // no proxy header (local run): do not lump every client into one bucket
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (store.hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  store.hits.set(key, hits);
  return hits.length > max;
}

export type Role = 'tutor' | 'electrician' | 'provost' | 'students';

const chatEnv: Record<Role, string> = {
  tutor: 'TELEGRAM_CHAT_TUTOR',
  electrician: 'TELEGRAM_CHAT_ELECTRICIAN',
  provost: 'TELEGRAM_CHAT_PROVOST',
  students: 'TELEGRAM_CHAT_STUDENTS',
};

export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

export async function sendTelegram(roles: Role[], text: string): Promise<{ sent: number; skipped: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: 0, skipped: roles.length };
  const chats = Array.from(new Set(roles.map((r) => process.env[chatEnv[r]]).filter((x): x is string => Boolean(x))));
  let sent = 0;
  for (const chat_id of chats) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
      });
      if (r.ok) sent++;
    } catch {
      // network error: counted as not sent
    }
  }
  return { sent, skipped: roles.length - sent };
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
