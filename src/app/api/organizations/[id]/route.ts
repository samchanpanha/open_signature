import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId: id, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const org = await db.organization.findFirst({ where: { id } });
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const members = await db.organizationMember.findMany({
      where: { orgId: id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      ownerId: org.ownerId,
      createdAt: org.createdAt,
      members: members.map(m => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
    });
  } catch (error) {
    console.error('Get org error:', error);
    return NextResponse.json({ error: 'Failed to get organization' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const org = await db.organization.findFirst({ where: { id, ownerId: userId } });
    if (!org) return NextResponse.json({ error: 'Only the owner can delete' }, { status: 403 });

    await db.organization.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete org error:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}