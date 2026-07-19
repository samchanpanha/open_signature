import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// GET /api/reminders?documentId=xxx - List reminders for a document
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const documentId = url.searchParams.get('documentId');

    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });

    const reminders = await db.reminder.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reminders);
  } catch (error) {
    console.error('List reminders error:', error);
    return NextResponse.json({ error: 'Failed to list reminders' }, { status: 500 });
  }
}

// POST /api/reminders - Create a reminder
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { documentId, type, scheduledAt, message } = await req.json();

    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    if (!scheduledAt) return NextResponse.json({ error: 'scheduledAt required' }, { status: 400 });

    // Verify the document belongs to the user
    const doc = await db.document.findFirst({
      where: { id: documentId, ownerId: user.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const reminder = await db.reminder.create({
      data: {
        documentId,
        userId: user.userId as string,
        type: type || 'reminder',
        scheduledAt: new Date(scheduledAt),
        message: message || `Reminder: Please sign "${doc.title}"`,
      },
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    console.error('Create reminder error:', error);
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}

// DELETE /api/reminders?id=xxx - Delete a reminder
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Reminder ID required' }, { status: 400 });

    const reminder = await db.reminder.findFirst({ where: { id } });
    if (!reminder) return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });

    // Verify ownership
    const doc = await db.document.findFirst({
      where: { id: reminder.documentId, ownerId: user.userId as string },
    });
    if (!doc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await db.reminder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
  }
}
