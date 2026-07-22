import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { user, error } = await requireSuperAdmin(req);
  if (error) return error;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { name: { contains: search } },
      { slug: { contains: search } },
    ],
  } : {};

  const [orgs, total] = await Promise.all([
    db.organization.findMany({
      where,
      select: {
        id: true, name: true, slug: true, createdAt: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { members: true, documents: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.organization.count({ where }),
  ]);

  return NextResponse.json({ orgs, total, page, limit });
}
