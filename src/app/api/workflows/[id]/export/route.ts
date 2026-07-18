import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// GET /api/workflows/[id]/export - Export workflow as template
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
      },
    });

    if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    // Export as template with emails instead of IDs (for portability)
    return NextResponse.json({
      templateVersion: 1,
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps.map(s => ({
        name: s.name,
        stepType: s.stepType,
        userEmail: s.user.email,
        order: s.order,
      })),
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Export workflow error:', error);
    return NextResponse.json({ error: 'Failed to export workflow' }, { status: 500 });
  }
}
