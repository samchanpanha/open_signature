import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

// POST /api/workflows/[id]/edges - Create or update edges for a workflow
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { edges } = await req.json();

    if (!Array.isArray(edges)) return NextResponse.json({ error: 'Edges array required' }, { status: 400 });

    const existing = await db.signatureWorkflow.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const role = await getUserRole(user.userId, existing.orgId);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can update workflows' }, { status: 403 });
    }

    // Delete existing edges
    await db.workflowEdge.deleteMany({ where: { workflowId: id } });

    // Create new edges
    const created = await Promise.all(
      edges.map(async (edge: any) => {
        return db.workflowEdge.create({
          data: {
            sourceStepId: edge.source,
            targetStepId: edge.target,
            label: edge.label || null,
            edgeType: edge.type || 'default',
            workflowId: id,
          },
        });
      })
    );

    return NextResponse.json({ edges: created }, { status: 201 });
  } catch (error) {
    console.error('Create edges error:', error);
    return NextResponse.json({ error: 'Failed to create edges' }, { status: 500 });
  }
}

// GET /api/workflows/[id]/edges - Get edges for a workflow
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const edges = await db.workflowEdge.findMany({
      where: { workflowId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(edges.map(e => ({
      id: e.id,
      source: e.sourceStepId,
      target: e.targetStepId,
      label: e.label,
      type: e.edgeType,
    })));
  } catch (error) {
    console.error('Get edges error:', error);
    return NextResponse.json({ error: 'Failed to get edges' }, { status: 500 });
  }
}
