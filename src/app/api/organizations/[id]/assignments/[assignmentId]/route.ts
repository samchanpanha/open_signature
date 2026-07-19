import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// Update assignment (status, notes, due date)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, assignmentId } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { status, notes, dueDate } = await req.json();

    const assignment = await db.assignment.findFirst({
      where: { id: assignmentId, orgId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        document: { select: { id: true, title: true, status: true } },
        assigner: { select: { id: true, email: true, name: true } },
      },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Only assignee can update their own assignment status, or admin/owner can update any
    const canUpdate = 
      membership.role === 'owner' || 
      membership.role === 'admin' || 
      assignment.userId === userId;

    if (!canUpdate) {
      return NextResponse.json({ error: 'Not authorized to update this assignment' }, { status: 403 });
    }

    const updateData: any = {};
    if (status) {
      if (!['pending', 'in_progress', 'completed', 'overdue'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
      if (status === 'completed') {
        updateData.completedAt = new Date();
      }
    }
    if (notes !== undefined) updateData.notes = notes;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const updated = await db.assignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        user: { select: { id: true, email: true, name: true } },
        document: { select: { id: true, title: true, status: true } },
        assigner: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update assignment error:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

// Delete assignment
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, assignmentId } = await params;
    const userId = payload.userId as string;

    // Check membership - only owner or admin can delete assignments
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can delete assignments' }, { status: 403 });
    }

    const assignment = await db.assignment.findFirst({
      where: { id: assignmentId, orgId },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await db.assignment.delete({ where: { id: assignmentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete assignment error:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
