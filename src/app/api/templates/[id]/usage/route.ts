import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET - Get template usage stats
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const totalUses = await db.templateUsage.count({ where: { templateId: id } });
    
    const recentUses = await db.templateUsage.findMany({
      where: { templateId: id },
      include: { document: { select: { id: true, title: true, status: true, createdAt: true } } },
      orderBy: { usedAt: 'desc' },
      take: 10,
    });

    // Usage by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyUsage = await db.templateUsage.groupBy({
      by: ['usedAt'],
      where: {
        templateId: id,
        usedAt: { gte: sixMonthsAgo },
      },
      _count: true,
    });

    return NextResponse.json({
      totalUses,
      recentUses,
      monthlyUsage: monthlyUsage.map(m => ({
        date: m.usedAt.toISOString().slice(0, 7),
        count: m._count,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get usage stats' }, { status: 500 });
  }
}
