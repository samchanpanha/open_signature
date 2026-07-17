import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { getAlertEngine } from '@/lib/alerts/alert-engine';

// GET /api/assignments - List assignments
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    // Get user's role in organization
    let role = 'member';
    if (orgId) {
      const member = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId } },
      });
      role = member?.role || 'member';
    }

    // Build where clause
    const where: any = {};

    // Filter by organization
    if (orgId) {
      where.orgId = orgId;
    }

    // Regular users can only see their own assignments
    if (role === 'member' && !searchParams.get('userId')) {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true, status: true } },
        org: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

// POST /api/assignments - Create assignment
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, documentId, orgId, dueDate, notes } = body;

    if (!userId || !documentId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, documentId, orgId' },
        { status: 400 }
      );
    }

    // Check permissions - only owner/admin can assign
    const member = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if assignment already exists
    const existing = await prisma.assignment.findUnique({
      where: { userId_documentId: { userId, documentId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Assignment already exists for this user and document' },
        { status: 409 }
      );
    }

    // Create assignment
    const assignment = await prisma.assignment.create({
      data: {
        userId,
        documentId,
        orgId,
        assignedBy: user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        status: 'pending',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true } },
        assigner: { select: { id: true, name: true } },
      },
    });

    // Trigger notification
    const alertEngine = getAlertEngine();
    await alertEngine['createNotification'](assignment, 'assignment');

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
