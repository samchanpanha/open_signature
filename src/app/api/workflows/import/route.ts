import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';

// POST /api/workflows/import - Import workflow from template
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { template, orgId, nameOverride } = await req.json();

    if (!orgId) return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    if (!template?.steps || template.steps.length === 0) {
      return NextResponse.json({ error: 'Invalid workflow template' }, { status: 400 });
    }

    // Check role
    const role = await getUserRole(user.userId, orgId);
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can import workflows' }, { status: 403 });
    }

    // Map user emails to org member IDs
    const memberEmails = template.steps.map((s: any) => s.userEmail).filter(Boolean);
    const members = await db.organizationMember.findMany({
      where: { orgId, user: { email: { in: memberEmails } } },
      include: { user: { select: { id: true, email: true } } },
    });

    const emailToMember = new Map(members.map(m => [m.user.email, m.user.id]));

    // Check for missing users
    const missingUsers = memberEmails.filter((email: string) => !emailToMember.has(email));
    if (missingUsers.length > 0) {
      return NextResponse.json({
        error: `These users are not in the organization: ${missingUsers.join(', ')}`,
        missingUsers,
      }, { status: 400 });
    }

    const workflow = await db.signatureWorkflow.create({
      data: {
        name: nameOverride || template.name || 'Imported Workflow',
        description: template.description || null,
        orgId,
        createdBy: user.userId,
        steps: {
          create: template.steps.map((s: any, i: number) => ({
            name: s.name || `Step ${i + 1}`,
            order: s.order || i + 1,
            stepType: s.stepType || 'sign',
            userId: emailToMember.get(s.userEmail),
          })),
        },
      },
      include: {
        steps: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { order: 'asc' },
        },
        creator: { select: { id: true, email: true, name: true } },
      },
    });

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
      createdAt: workflow.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Import workflow error:', error);
    return NextResponse.json({ error: 'Failed to import workflow' }, { status: 500 });
  }
}
