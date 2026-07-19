import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// List assignments for an organization
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { status, userId: assigneeId } = Object.fromEntries(req.nextUrl.searchParams);

    const where: any = { orgId };
    if (status) where.status = status;
    if (assigneeId) where.userId = assigneeId;

    const assignments = await db.assignment.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true } },
        document: { select: { id: true, title: true, status: true } },
        assigner: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('List assignments error:', error);
    return NextResponse.json({ error: 'Failed to list assignments' }, { status: 500 });
  }
}

// Create assignment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check membership and permissions
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can create assignments' }, { status: 403 });
    }

    const { documentId, userId: assigneeId, dueDate, notes } = await req.json();

    if (!documentId || !assigneeId) {
      return NextResponse.json({ error: 'Document ID and user ID are required' }, { status: 400 });
    }

    // Verify document belongs to org
    const document = await db.document.findFirst({
      where: { id: documentId, organizationId: orgId },
    });
    if (!document) {
      return NextResponse.json({ error: 'Document not found in this organization' }, { status: 404 });
    }

    // Verify assignee is a member of the org
    const assigneeMembership = await db.organizationMember.findFirst({
      where: { orgId, userId: assigneeId },
    });
    if (!assigneeMembership) {
      return NextResponse.json({ error: 'Assignee is not a member of this organization' }, { status: 400 });
    }

    // Check if assignment already exists
    const existing = await db.assignment.findFirst({
      where: { userId: assigneeId, documentId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Assignment already exists for this user and document' }, { status: 409 });
    }

    const assignment = await db.assignment.create({
      data: {
        userId: assigneeId,
        documentId,
        orgId,
        assignedBy: userId,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        status: 'pending',
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        document: { select: { id: true, title: true, status: true } },
        assigner: { select: { id: true, email: true, name: true } },
      },
    });

    // Create notification for the assignee
    await db.notification.create({
      data: {
        type: 'assignment',
        title: 'New Document Assigned',
        message: `You have been assigned to sign "${document.title}"`,
        userId: assigneeId,
        documentId,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Create assignment error:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}
