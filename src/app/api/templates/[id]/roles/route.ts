import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const template = await db.documentTemplate.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const roles = JSON.parse(template.roles || "[]");
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Get template roles error:', error);
    return NextResponse.json({ error: 'Failed to get roles' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const template = await db.documentTemplate.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const { roles } = await req.json();
    if (!Array.isArray(roles)) {
      return NextResponse.json({ error: 'Roles must be an array' }, { status: 400 });
    }

    // Validate each role has required fields
    for (const role of roles) {
      if (!role.name || typeof role.order !== 'number') {
        return NextResponse.json(
          { error: 'Each role must have a name (string) and order (number)' },
          { status: 400 }
        );
      }
    }

    const updated = await db.documentTemplate.update({
      where: { id },
      data: { roles: JSON.stringify(roles) },
    });

    return NextResponse.json(JSON.parse(updated.roles || "[]"));
  } catch (error) {
    console.error('Update template roles error:', error);
    return NextResponse.json({ error: 'Failed to update roles' }, { status: 500 });
  }
}
