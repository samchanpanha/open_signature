import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole, hasPermission } from '@/lib/permissions';

// GET /api/form-templates/[id] - Get a specific form template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await db.formTemplate.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if user has access to this organization
    const role = await getUserRole(user.id, template.orgId);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching form template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form template' },
      { status: 500 }
    );
  }
}

// PUT /api/form-templates/[id] - Update a form template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await db.formTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check permissions
    const role = await getUserRole(user.id, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      const hasPerm = await hasPermission(user.id, existing.orgId, 'form', 'update');
      if (!hasPerm) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { name, description, schema, fields } = body;

    // Update template
    const updated = await db.formTemplate.update({
      where: { id: params.id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        schema: schema ? JSON.stringify(schema) : existing.schema,
      },
    });

    // Update fields if provided
    if (fields) {
      // Delete existing fields
      await db.formField.deleteMany({
        where: { formTemplateId: params.id },
      });

      // Create new fields
      await db.formField.createMany({
        data: fields.map((field: any, index: number) => ({
          formTemplateId: params.id,
          type: field.type,
          label: field.label,
          placeholder: field.placeholder || null,
          required: field.required || false,
          options: field.options ? JSON.stringify(field.options) : null,
          defaultValue: field.defaultValue || null,
          validation: field.validation ? JSON.stringify(field.validation) : null,
          order: index,
        })),
      });
    }

    const final = await db.formTemplate.findUnique({
      where: { id: params.id },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({ template: final });
  } catch (error) {
    console.error('Error updating form template:', error);
    return NextResponse.json(
      { error: 'Failed to update form template' },
      { status: 500 }
    );
  }
}

// DELETE /api/form-templates/[id] - Delete a form template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await db.formTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check permissions
    const role = await getUserRole(user.id, existing.orgId);
    if (!role || !['owner', 'admin'].includes(role)) {
      const hasPerm = await hasPermission(user.id, existing.orgId, 'form', 'delete');
      if (!hasPerm) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await db.formTemplate.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form template:', error);
    return NextResponse.json(
      { error: 'Failed to delete form template' },
      { status: 500 }
    );
  }
}
