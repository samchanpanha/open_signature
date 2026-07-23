import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const departments = await db.department.findMany({
      where: { orgId },
      include: { _count: { select: { members: true, workflows: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('List departments error:', error);
    return NextResponse.json({ error: 'Failed to list departments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const { name, code, description } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage departments' }, { status: 403 });
    }

    const existing = await db.department.findFirst({
      where: { orgId, name: name.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 });
    }

    const department = await db.department.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        description: description?.trim() || null,
        orgId,
      },
      include: { _count: { select: { members: true, workflows: true } } },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}
