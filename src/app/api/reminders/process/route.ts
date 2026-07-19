import { NextRequest, NextResponse } from 'next/server';
import { getAlertEngine } from '@/lib/alerts/alert-engine';

/**
 * GET/POST /api/reminders/process
 *
 * Protected cron endpoint that flushes pending reminders and overdue
 * assignment escalations. Intended to be called by an external scheduler
 * (cron / Caddy / CI) on a fixed interval (e.g. every 15 minutes).
 *
 * Auth: header `x-cron-secret` must equal the CRON_SECRET env var.
 * When CRON_SECRET is unset the endpoint is disabled (returns 503) to avoid
 * accidental open invocation.
 */
function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get('x-cron-secret');
  return !!provided && provided === secret;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized or cron disabled' }, { status: 401 });
  }

  const engine = getAlertEngine();
  const result = await engine.processAlerts();
  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
