import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/assignments/[id] - Get specific assignment
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { 
          select: { 
            id: true, 
            title: true, 
            status: true,
            originalPdfPath: true,
          } 
        },
        org: { select: { id: true, name: true } },
        assigner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Check permissions
    const member = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: assignment.orgId } },
    });

    const canView = 
      member?.role === 'owner' || 
      member?.role === 'admin' || 
      assignment.userId === user.id;

    if (!canView) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignment' },
      { status: 500 }
    );
  }
}

// PUT /api/assignments/[id] - Update assignment
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes, dueDate } = body;

    // Get current assignment
    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Check permissions
    const member = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: assignment.orgId } },
    });

    const isAdmin = member?.role === 'owner' || member?.role === 'admin';
    const isAssignee = assignment.userId === user.id;

    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only assignee can update status to completed
    const updateData: any = {};
    
    if (status !== undefined) {
      if (status === 'completed' && !isAdmin) {
        if (!isAssignee) {
          return NextResponse.json(
            { error: 'Only assignee can mark as completed' },
            { status: 403 }
          );
        }
        updateData.completedAt = new Date();
      }
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Only admin can update due date
    if (dueDate !== undefined && isAdmin) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ assignment: updatedAssignment });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

// DELETE /api/assignments/[id] - Delete assignment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Only admin/owner can delete
    const member = await prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: assignment.orgId } },
    });

    if (member?.role !== 'owner' && member?.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await prisma.assignment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}
