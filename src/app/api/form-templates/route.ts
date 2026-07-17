import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole, hasPermission } from '@/lib/permissions';

// GET /api/form-templates - List all form templates for an organization
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if user has access to this organization
    const role = await getUserRole(user.id, orgId);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const templates = await db.formTemplate.findMany({
      where: { orgId },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        fields: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching form templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form templates' },
      { status: 500 }
    );
  }
}

// POST /api/form-templates - Create a new form template
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, schema, orgId, fields } = body;

    if (!name || !orgId) {
      return NextResponse.json(
        { error: 'Name and organization ID are required' },
        { status: 400 }
      );
    }

    // Check permissions
    const role = await getUserRole(user.id, orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      const hasPerm = await hasPermission(user.id, orgId, 'form', 'create');
      if (!hasPerm) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Create the form template with fields
    const template = await db.formTemplate.create({
      data: {
        name,
        description: description || null,
        schema: JSON.stringify(schema || {}),
        orgId,
        createdBy: user.id,
        fields: fields
          ? {
              create: fields.map((field: any, index: number) => ({
                type: field.type,
                label: field.label,
                placeholder: field.placeholder || null,
                required: field.required || false,
                options: field.options ? JSON.stringify(field.options) : null,
                defaultValue: field.defaultValue || null,
                validation: field.validation ? JSON.stringify(field.validation) : null,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        fields: true,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating form template:', error);
    return NextResponse.json(
      { error: 'Failed to create form template' },
      { status: 500 }
    );
  }
}
