import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; positionId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, positionId } = await params;
    const data = await req.json();

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage positions' }, { status: 403 });
    }

    const pos = await db.position.findFirst({ where: { id: positionId, orgId } });
    if (!pos) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

    if (data.title && data.title.trim() !== pos.title) {
      const duplicate = await db.position.findFirst({
        where: { orgId, title: data.title.trim(), NOT: { id: positionId } },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'A position with this title already exists' }, { status: 409 });
      }
    }

    const updated = await db.position.update({
      where: { id: positionId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.level !== undefined && { level: data.level?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { _count: { select: { members: true, workflows: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update position error:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; positionId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, positionId } = await params;

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage positions' }, { status: 403 });
    }

    const pos = await db.position.findFirst({ where: { id: positionId, orgId } });
    if (!pos) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

    await db.position.delete({ where: { id: positionId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete position error:', error);
    return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 });
  }
}
