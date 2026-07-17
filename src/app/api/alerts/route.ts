import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// POST /api/alerts/process - Manually trigger alert processing
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');

    if (orgId) {
      const member = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId } },
      });

      if (member?.role !== 'owner' && member?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Admin permissions required' },
          { status: 403 }
        );
      }
    }

    // Import and run alert engine
    const { getAlertEngine } = await import('@/lib/alerts/alert-engine');
    const alertEngine = getAlertEngine();
    
    const result = await alertEngine.processAlerts();

    return NextResponse.json({
      success: true,
      message: `Processed ${result.sent} notifications`,
      details: result,
    });
  } catch (error) {
    console.error('Error processing alerts:', error);
    return NextResponse.json(
      { error: 'Failed to process alerts' },
      { status: 500 }
    );
  }
}

// GET /api/alerts/stats - Get alert statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count recent notifications
    const recentNotifications = await prisma.notification.count({
      where: {
        createdAt: { gte: yesterday },
      },
    });

    const weekNotifications = await prisma.notification.count({
      where: {
        createdAt: { gte: lastWeek },
      },
    });

    // Count pending reminders
    const pendingReminders = await prisma.reminder.count({
      where: {
        sentAt: null,
        scheduledAt: { lte: now },
      },
    });

    // Count overdue assignments
    const overdueAssignments = await prisma.assignment.count({
      where: {
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lt: now },
      },
    });

    return NextResponse.json({
      stats: {
        recentNotifications,
        weekNotifications,
        pendingReminders,
        overdueAssignments,
      },
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert statistics' },
      { status: 500 }
    );
  }
}
