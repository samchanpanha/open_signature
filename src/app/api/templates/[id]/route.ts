import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const template = await db.documentTemplate.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    return NextResponse.json({
      ...template,
      fieldConfig: JSON.parse(template.fieldConfig),
      roles: JSON.parse(template.roles || "[]"),
    });
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const template = await db.documentTemplate.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const { name, fieldConfig, roles } = await req.json();

    const updated = await db.documentTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(fieldConfig !== undefined && { fieldConfig: JSON.stringify(fieldConfig) }),
        ...(roles !== undefined && { roles: JSON.stringify(roles) }),
      },
    });

    return NextResponse.json({
      ...updated,
      fieldConfig: JSON.parse(updated.fieldConfig),
      roles: JSON.parse(updated.roles || "[]"),
    });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const template = await db.documentTemplate.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    await db.documentTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}