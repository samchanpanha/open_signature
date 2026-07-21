import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    const where: any = { userId: user.userId };
    if (orgId) where.organizationId = orgId;

    const documents = await db.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        signers: { select: { signedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as any[];

    const total = documents.length;
    const completed = documents.filter(d => d.status === 'Completed').length;
    const pending = documents.filter(d => d.status === 'Sent' || d.status === 'Signing').length;
    const draft = documents.filter(d => d.status === 'Draft').length;
    const rejected = documents.filter(d => d.status === 'Rejected').length;
    const expired = documents.filter(d => d.status === 'Expired').length;

    // Document trends over last 30 days
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const trends: Record<string, { created: number; completed: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      trends[key] = { created: 0, completed: 0 };
    }

    documents.forEach(doc => {
      const createdDate = new Date(doc.createdAt).toISOString().split('T')[0];
      if (trends[createdDate]) trends[createdDate].created++;
      if (doc.status === 'Completed' && doc.updatedAt) {
        const completedDate = new Date(doc.updatedAt).toISOString().split('T')[0];
        if (trends[completedDate]) trends[completedDate].completed++;
      }
    });

    const trendData = Object.entries(trends).map(([date, data]) => ({
      date,
      created: data.created,
      completed: data.completed,
    }));

    // Weekly activity (last 8 weeks)
    const weeklyActivity: { week: string; created: number; completed: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now - (i * 7 + 6) * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
      const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const created = documents.filter(d => {
        const t = new Date(d.createdAt).getTime();
        return t >= weekStart.getTime() && t <= weekEnd.getTime();
      }).length;
      const completed = documents.filter(d => {
        if (d.status !== 'Completed' || !d.updatedAt) return false;
        const t = new Date(d.updatedAt).getTime();
        return t >= weekStart.getTime() && t <= weekEnd.getTime();
      }).length;
      weeklyActivity.push({ week: label, created, completed });
    }

    // Recent documents (last 10)
    const recentDocuments = documents.slice(0, 10).map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
      createdAt: d.createdAt,
      signerCount: d.signers.length,
      signedCount: d.signers.filter(s => s.signedAt !== null).length,
    }));

    // Status distribution
    const statusDistribution = [
      { name: 'Completed', value: completed, fill: '#10b981' },
      { name: 'Pending', value: pending, fill: '#f59e0b' },
      { name: 'Draft', value: draft, fill: '#94a3b8' },
      { name: 'Rejected', value: rejected, fill: '#ef4444' },
      { name: 'Expired', value: expired, fill: '#8b5cf6' },
    ].filter(s => s.value > 0);

    // Average completion time (hours)
    const completedDocs = documents.filter(d => d.status === 'Completed' && d.createdAt && d.updatedAt);
    let avgCompletionHours = 0;
    if (completedDocs.length > 0) {
      const totalHours = completedDocs.reduce((sum, d) => {
        const created = new Date(d.createdAt).getTime();
        const updated = new Date(d.updatedAt!).getTime();
        return sum + (updated - created) / (1000 * 60 * 60);
      }, 0);
      avgCompletionHours = Math.round(totalHours / completedDocs.length * 10) / 10;
    }

    return NextResponse.json({
      stats: { total, completed, pending, draft, rejected, expired, avgCompletionHours },
      trendData,
      weeklyActivity,
      statusDistribution,
      recentDocuments,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
