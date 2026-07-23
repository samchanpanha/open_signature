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

    const positions = await db.position.findMany({
      where: { orgId },
      include: { _count: { select: { members: true, workflows: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error('List positions error:', error);
    return NextResponse.json({ error: 'Failed to list positions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const { title, level, description } = await req.json();

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId: payload.userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can manage positions' }, { status: 403 });
    }

    const existing = await db.position.findFirst({
      where: { orgId, title: title.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: 'A position with this title already exists' }, { status: 409 });
    }

    const position = await db.position.create({
      data: {
        title: title.trim(),
        level: level?.trim() || null,
        description: description?.trim() || null,
        orgId,
      },
      include: { _count: { select: { members: true, workflows: true } } },
    });

    return NextResponse.json(position, { status: 201 });
  } catch (error) {
    console.error('Create position error:', error);
    return NextResponse.json({ error: 'Failed to create position' }, { status: 500 });
  }
}
