import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const reminders = await db.documentReminder.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reminders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get reminders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { email, name, intervalDays } = await req.json();

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const nextSendAt = new Date();
    nextSendAt.setDate(nextSendAt.getDate() + (intervalDays || 3));

    const reminder = await db.documentReminder.create({
      data: {
        documentId: id,
        email,
        name,
        intervalDays: intervalDays || 3,
        nextSendAt,
      },
    });

    return NextResponse.json({ reminder });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { reminderId } = await req.json();

    await db.documentReminder.delete({
      where: { id: reminderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
  }
}
