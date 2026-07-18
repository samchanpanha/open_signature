import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
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

    const templates = await db.publicTemplate.findMany({
      where: { orgId },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching public templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, fieldConfig, orgId } = body;

    if (!name || !orgId) {
      return NextResponse.json(
        { error: 'Name and organization ID are required' },
        { status: 400 }
      );
    }

    const role = await getUserRole(user.userId, orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shareToken = crypto.randomBytes(32).toString('hex');

    const template = await db.publicTemplate.create({
      data: {
        name,
        description: description || null,
        shareToken,
        fieldConfig: JSON.stringify(fieldConfig || []),
        orgId,
        createdBy: user.userId,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating public template:', error);
    return NextResponse.json(
      { error: 'Failed to create public template' },
      { status: 500 }
    );
  }
}
