import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;

    const membership = await db.organizationMember.findFirst({
      where: { userId },
      include: { org: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const org = membership.org;

    return NextResponse.json({
      logoUrl: org.logoUrl,
      brandColor: org.brandColor,
      customDomain: org.customDomain,
      orgName: org.name,
    });
  } catch (error) {
    console.error('Get branding error:', error);
    return NextResponse.json({ error: 'Failed to fetch branding settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;

    const membership = await db.organizationMember.findFirst({
      where: { userId },
      include: { org: true },
    });

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can update branding' }, { status: 403 });
    }

    const body = await req.json();
    const { logoUrl, brandColor, customDomain, name } = body;

    const updated = await db.organization.update({
      where: { id: membership.orgId },
      data: {
        ...(logoUrl !== undefined && { logoUrl }),
        ...(brandColor !== undefined && { brandColor }),
        ...(customDomain !== undefined && { customDomain }),
        ...(name !== undefined && { name }),
      },
    });

    return NextResponse.json({
      logoUrl: updated.logoUrl,
      brandColor: updated.brandColor,
      customDomain: updated.customDomain,
      orgName: updated.name,
    });
  } catch (error) {
    console.error('Update branding error:', error);
    return NextResponse.json({ error: 'Failed to update branding settings' }, { status: 500 });
  }
}
