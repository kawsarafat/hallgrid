import { json, nodeKeys, telegramConfigured } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Which parts are switched on for this deployment, so the dashboard never shows
// a feature as working when it is not configured.
export async function GET() {
  return json({
    telemetry: nodeKeys().size > 0,
    nodes: Array.from(nodeKeys().keys()),
    telegram: telegramConfigured(),
    admin: Boolean(process.env.ADMIN_KEY),
  });
}
