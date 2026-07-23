import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

// GET /api/workflows?orgId=xxx - List workflows for an organization
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });

    const role = await getUserRole(user.userId, orgId);
    if (!role) return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });

    const workflows = await db.signatureWorkflow.findMany({
      where: { orgId },
      include: {
        steps: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { order: 'asc' },
        },
        edges: true,
        creator: { select: { id: true, email: true, name: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(workflows.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      isActive: w.isActive,
      createdBy: w.creator,
      documentCount: w._count.documents,
      departmentId: w.departmentId,
      positionId: w.positionId,
      department: w.department,
      position: w.position,
      steps: w.steps.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        stepType: s.stepType,
        user: s.user,
        x: s.positionX,
        y: s.positionY,
        config: s.nodeConfig ? JSON.parse(s.nodeConfig) : {},
        conditionRules: s.conditionRules ? JSON.parse(s.conditionRules) : null,
      })),
      edges: w.edges.map(e => ({
        id: e.id,
        source: e.sourceStepId,
        target: e.targetStepId,
        label: e.label,
        type: e.edgeType,
      })),
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })));
  } catch (error) {
    console.error('List workflows error:', error);
    return NextResponse.json({ error: 'Failed to list workflows' }, { status: 500 });
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, orgId, steps, edges, layoutConfig, departmentId, positionId } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: 'Workflow name is required' }, { status: 400 });
    if (!orgId) return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    if (!steps || steps.length === 0) return NextResponse.json({ error: 'At least one step is required' }, { status: 400 });

    // Check role - owner or admin only
    const role = await getUserRole(user.userId, orgId);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can create workflows' }, { status: 403 });
    }

    // Verify all step users are org members
    for (const step of steps) {
      if (step.userId) {
        const member = await db.organizationMember.findFirst({
          where: { userId: step.userId, orgId },
        });
        if (!member) {
          return NextResponse.json({ error: `User ${step.userId} is not a member of this organization` }, { status: 400 });
        }
      }
    }

    // Create workflow with steps and edges
    const workflow = await db.signatureWorkflow.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        orgId,
        createdBy: user.userId,
        layoutConfig: layoutConfig ? JSON.stringify(layoutConfig) : null,
        departmentId: departmentId || null,
        positionId: positionId || null,
        steps: {
          create: steps.map((s: any, i: number) => ({
            name: s.name || `Step ${i + 1}`,
            order: i + 1,
            stepType: s.type || s.stepType || 'sign',
            userId: s.userId || user.userId,
            positionX: s.x || s.positionX || 0,
            positionY: s.y || s.positionY || 0,
            conditionRules: s.conditionRules ? JSON.stringify(s.conditionRules) : null,
            nodeConfig: s.config ? JSON.stringify(s.config) : null,
          })),
        },
      },
      include: {
        steps: true,
        creator: { select: { id: true, email: true, name: true } },
      },
    });

    // Create edges if provided
    if (edges && Array.isArray(edges)) {
      const stepIdMap: Record<string, string> = {};
      workflow.steps.forEach((dbStep, i) => {
        const originalStep = steps[i];
        if (originalStep?.id) {
          stepIdMap[originalStep.id] = dbStep.id;
        }
      });

      for (const edge of edges) {
        const sourceId = stepIdMap[edge.source];
        const targetId = stepIdMap[edge.target];
        if (sourceId && targetId) {
          await db.workflowEdge.create({
            data: {
              sourceStepId: sourceId,
              targetStepId: targetId,
              label: edge.label || null,
              edgeType: edge.type || 'default',
              workflowId: workflow.id,
            },
          });
        }
      }
    }

    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      isActive: workflow.isActive,
      createdBy: workflow.creator,
      departmentId: workflow.departmentId,
      positionId: workflow.positionId,
      steps: workflow.steps.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order,
        stepType: s.stepType,
      })),
      createdAt: workflow.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Create workflow error:', error);
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}
