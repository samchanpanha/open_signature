import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; branchId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, branchId } = await params;
    const data = await req.json();

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage branches' }, { status: 403 });
    }

    const branch = await db.branch.findFirst({ where: { id: branchId, orgId } });
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    if (data.name && data.name.trim() !== branch.name) {
      const duplicate = await db.branch.findFirst({
        where: { orgId, name: data.name.trim(), NOT: { id: branchId } },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'A branch with this name already exists' }, { status: 409 });
      }
    }

    const updated = await db.branch.update({
      where: { id: branchId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { _count: { select: { members: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; branchId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, branchId } = await params;

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage branches' }, { status: 403 });
    }

    const branch = await db.branch.findFirst({ where: { id: branchId, orgId } });
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    await db.branch.delete({ where: { id: branchId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 });
  }
}
