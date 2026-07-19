import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;

    // Get orgs where user is a member
    const memberships = await db.organizationMember.findMany({
      where: { userId },
      include: { org: true },
      orderBy: { joinedAt: 'desc' },
    });

    const orgs = memberships.map(m => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role,
      memberCount: 0, // will populate below
      documentCount: 0,
      createdAt: m.org.createdAt,
    }));

    // Also get user's owned orgs (already included in memberships as owner role)
    // Get member counts and document counts
    for (const org of orgs) {
      const memberCount = await db.organizationMember.count({ where: { orgId: org.id } });
      const docCount = await db.document.count({ where: { organizationId: org.id } });
      org.memberCount = memberCount;
      org.documentCount = docCount;
    }

    return NextResponse.json(orgs);
  } catch (error) {
    console.error('List orgs error:', error);
    return NextResponse.json({ error: 'Failed to list organizations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const { name } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check slug uniqueness
    const existing = await db.organization.findFirst({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Organization name already taken' }, { status: 409 });
    }

    const org = await db.organization.create({
      data: {
        name: name.trim(),
        slug,
        ownerId: userId,
      },
    });

    // Add owner as member
    await db.organizationMember.create({
      data: {
        userId,
        orgId: org.id,
        role: 'owner',
      },
    });

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: 'owner',
      createdAt: org.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Create org error:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}