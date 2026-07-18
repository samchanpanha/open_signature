import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// GET /api/organizations/[id]/permission-templates - List all templates
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;

    const templates = await db.permissionTemplate.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get permission templates error:', error);
    return NextResponse.json({ error: 'Failed to get permission templates' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/permission-templates - Create a new template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check if user is owner or admin
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can create templates' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Name and permissions array required' }, { status: 400 });
    }

    const template = await db.permissionTemplate.create({
      data: {
        name,
        description,
        orgId,
        permissions: JSON.stringify(permissions),
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Create permission template error:', error);
    return NextResponse.json({ error: 'Failed to create permission template' }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/permission-templates/[templateId] - Update a template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, templateId } = await params;
    const userId = payload.userId as string;

    // Check if user is owner or admin
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can update templates' }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, permissions } = body;

    const template = await db.permissionTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updated = await db.permissionTemplate.update({
      where: { id: templateId },
      data: {
        name: name || template.name,
        description: description !== undefined ? description : template.description,
        permissions: permissions ? JSON.stringify(permissions) : template.permissions,
      },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    console.error('Update permission template error:', error);
    return NextResponse.json({ error: 'Failed to update permission template' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/permission-templates/[templateId] - Delete a template
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, templateId } = await params;
    const userId = payload.userId as string;

    // Check if user is owner or admin
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can delete templates' }, { status: 403 });
    }

    const template = await db.permissionTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await db.permissionTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete permission template error:', error);
    return NextResponse.json({ error: 'Failed to delete permission template' }, { status: 500 });
  }
}
