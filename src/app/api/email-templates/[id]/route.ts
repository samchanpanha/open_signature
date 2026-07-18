import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
    }

    if (template.orgId) {
      const role = await getUserRole(user.userId, template.orgId);
      if (!role) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching email template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
    }

    if (!existing.orgId) {
      return NextResponse.json({ error: 'Cannot modify default templates' }, { status: 403 });
    }

    const role = await getUserRole(user.userId, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, subject, htmlBody } = body;

    const updated = await db.emailTemplate.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        subject: subject !== undefined ? subject : undefined,
        htmlBody: htmlBody !== undefined ? htmlBody : undefined,
      },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    console.error('Error updating email template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Email template not found' }, { status: 404 });
    }

    if (existing.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default templates' }, { status: 403 });
    }

    if (!existing.orgId) {
      return NextResponse.json({ error: 'Cannot delete default templates' }, { status: 403 });
    }

    const role = await getUserRole(user.userId, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.emailTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting email template:', error);
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}
