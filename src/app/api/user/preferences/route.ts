import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET - Get user preferences
export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    let prefs = await db.userPreferences.findUnique({ where: { userId } });
    
    if (!prefs) {
      prefs = await db.userPreferences.create({ data: { userId } });
    }

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 });
  }
}

// PUT - Update user preferences
export async function PUT(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const body = await req.json();

    const prefs = await db.userPreferences.upsert({
      where: { userId },
      update: {
        emailOnSent: body.emailOnSent,
        emailOnCompleted: body.emailOnCompleted,
        emailOnRejected: body.emailOnRejected,
        emailOnExpiring: body.emailOnExpiring,
        emailOnReminder: body.emailOnReminder,
      },
      create: {
        userId,
        emailOnSent: body.emailOnSent ?? true,
        emailOnCompleted: body.emailOnCompleted ?? true,
        emailOnRejected: body.emailOnRejected ?? true,
        emailOnExpiring: body.emailOnExpiring ?? true,
        emailOnReminder: body.emailOnReminder ?? true,
      },
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
