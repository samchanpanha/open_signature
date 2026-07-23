import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; departmentId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, departmentId } = await params;
    const data = await req.json();

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage departments' }, { status: 403 });
    }

    const dept = await db.department.findFirst({ where: { id: departmentId, orgId } });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    if (data.name && data.name.trim() !== dept.name) {
      const duplicate = await db.department.findFirst({
        where: { orgId, name: data.name.trim(), NOT: { id: departmentId } },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 });
      }
    }

    const updated = await db.department.update({
      where: { id: departmentId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code?.trim() || null }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { _count: { select: { members: true, workflows: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update department error:', error);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; departmentId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, departmentId } = await params;

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage departments' }, { status: 403 });
    }

    const dept = await db.department.findFirst({ where: { id: departmentId, orgId } });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

    await db.department.delete({ where: { id: departmentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete department error:', error);
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
  }
}
