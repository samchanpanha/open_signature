import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

// GET /api/workflows/[id] - Get workflow details
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const workflow = await db.signatureWorkflow.findUnique({
      where: { id },
      include: {
        steps: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { order: 'asc' },
        },
        creator: { select: { id: true, email: true, name: true } },
        documents: {
          select: { id: true, title: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      createdBy: workflow.creator,
      steps: workflow.steps.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        stepType: s.stepType,
        user: s.user,
      })),
      documents: workflow.documents,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });
  } catch (error) {
    console.error('Get workflow error:', error);
    return NextResponse.json({ error: 'Failed to get workflow' }, { status: 500 });
  }
}

// PUT /api/workflows/[id] - Update workflow
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const existing = await db.signatureWorkflow.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const role = await getUserRole(user.userId, existing.orgId);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can update workflows' }, { status: 403 });
    }

    const { name, description, isActive, steps } = body;

    // If steps are provided, replace them
    if (steps && Array.isArray(steps)) {
      // Delete existing steps
      await db.workflowStep.deleteMany({ where: { workflowId: id } });

      // Create new steps
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        await db.workflowStep.create({
          data: {
            name: s.name || `Step ${i + 1}`,
            order: i + 1,
            stepType: s.stepType || 'sign',
            userId: s.userId,
            workflowId: id,
          },
        });
      }
    }

    const updated = await db.signatureWorkflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        steps: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isActive: updated.isActive,
      steps: updated.steps.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        stepType: s.stepType,
        user: s.user,
      })),
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('Update workflow error:', error);
    return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
  }
}

// DELETE /api/workflows/[id] - Delete workflow
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const existing = await db.signatureWorkflow.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const role = await getUserRole(user.userId, existing.orgId);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can delete workflows' }, { status: 403 });
    }

    // Check if workflow is in use
    const docsUsing = await db.document.count({ where: { workflowId: id } });
    if (docsUsing > 0) {
      return NextResponse.json({ error: `Cannot delete: ${docsUsing} document(s) use this workflow` }, { status: 400 });
    }

    await db.signatureWorkflow.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
  }
}
