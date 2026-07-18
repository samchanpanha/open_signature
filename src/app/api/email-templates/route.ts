import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const templates = await db.emailTemplate.findMany({
      where: {
        OR: [
          { orgId },
          { isDefault: true, orgId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, subject, htmlBody, orgId } = body;

    if (!name || !subject || !htmlBody || !orgId) {
      return NextResponse.json(
        { error: 'Name, subject, HTML body, and organization ID are required' },
        { status: 400 }
      );
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const template = await db.emailTemplate.create({
      data: {
        name,
        subject,
        htmlBody,
        orgId,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating email template:', error);
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}
