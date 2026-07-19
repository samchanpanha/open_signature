import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


// Get single template
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, templateId } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const template = await db.formTemplate.findFirst({
      where: { id: templateId, orgId },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        fields: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      schema: JSON.parse(template.schema),
      createdBy: template.creator,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      fields: template.fields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder,
        required: f.required,
        options: f.options ? JSON.parse(f.options) : null,
        defaultValue: f.defaultValue,
        validation: f.validation ? JSON.parse(f.validation) : null,
      })),
    });
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}

// Update template
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, templateId } = await params;
    const userId = payload.userId as string;

    // Check membership - only owner or admin can update templates
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can update templates' }, { status: 403 });
    }

    const template = await db.formTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { name, description, schema, fields } = await req.json();

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (schema) updateData.schema = JSON.stringify(schema);

    await db.formTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    // Update fields if provided (delete existing and recreate)
    if (fields && Array.isArray(fields)) {
      await db.formField.deleteMany({
        where: { formTemplateId: templateId },
      });

      await db.formField.createMany({
        data: fields.map((field: any) => ({
          formTemplateId: templateId,
          type: field.type || 'text',
          label: field.label || '',
          placeholder: field.placeholder || null,
          required: field.required || false,
          options: field.options ? JSON.stringify(field.options) : null,
          defaultValue: field.defaultValue || null,
          validation: field.validation ? JSON.stringify(field.validation) : null,
        })),
      });
    }

    const updated = await db.formTemplate.findUnique({
      where: { id: templateId },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        fields: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({
      id: updated!.id,
      name: updated!.name,
      description: updated!.description,
      schema: JSON.parse(updated!.schema),
      createdBy: updated!.creator,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
      fieldCount: updated!.fields.length,
    });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// Delete template
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, templateId } = await params;
    const userId = payload.userId as string;

    // Check membership - only owner or admin can delete templates
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can delete templates' }, { status: 403 });
    }

    const template = await db.formTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await db.formTemplate.delete({ where: { id: templateId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
