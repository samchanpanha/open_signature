import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

// GET /api/workflows/templates - List workflow templates
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const category = url.searchParams.get('category');

    const where: any = { isPublic: true };
    if (category && category !== 'all') {
      where.category = category;
    }

    const templates = await db.workflowTemplate.findMany({
      where,
      orderBy: { usageCount: 'desc' },
    });

    return NextResponse.json(templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      steps: JSON.parse(t.steps),
      edges: JSON.parse(t.edges),
      usageCount: t.usageCount,
    })));
  } catch (error) {
    console.error('List templates error:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

// POST /api/workflows/templates - Create a workflow from a template
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { templateId, orgId, workflowName } = await req.json();

    if (!templateId) return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });

    const role = await getUserRole(user.userId, orgId);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can create workflows' }, { status: 403 });
    }

    const template = await db.workflowTemplate.findUnique({ where: { id: templateId } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const steps = JSON.parse(template.steps);
    const edges = JSON.parse(template.edges);

    // Create workflow
    const workflow = await db.signatureWorkflow.create({
      data: {
        name: workflowName || template.name,
        description: template.description,
        orgId,
        createdBy: user.userId,
      },
    });

    // Create steps with mappings
    const stepIdMap: Record<string, string> = {};
    const createdSteps: any[] = [];

    for (const step of steps) {
      const newStep = await db.workflowStep.create({
        data: {
          name: step.name,
          order: step.order || createdSteps.length + 1,
          stepType: step.type || step.stepType || 'sign',
          userId: user.userId, // Default to creator
          workflowId: workflow.id,
          positionX: step.x || step.positionX || 0,
          positionY: step.y || step.positionY || 0,
          conditionRules: step.conditionRules ? JSON.stringify(step.conditionRules) : null,
          nodeConfig: step.config ? JSON.stringify(step.config) : null,
        },
      });
      stepIdMap[step.id] = newStep.id;
      createdSteps.push(newStep);
    }

    // Create edges with mapped IDs
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

    // Increment usage count
    await db.workflowTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
    }, { status: 201 });
  } catch (error) {
    console.error('Create from template error:', error);
    return NextResponse.json({ error: 'Failed to create workflow from template' }, { status: 500 });
  }
}
