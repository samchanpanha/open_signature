import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// List templates for an organization
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const templates = await db.formTemplate.findMany({
      where: { orgId },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        fields: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      schema: JSON.parse(t.schema),
      createdBy: t.creator,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      fieldCount: t.fields.length,
    })));
  } catch (error) {
    console.error('List templates error:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

// Create template
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId } = await params;
    const userId = payload.userId as string;

    // Check membership
    const membership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { name, description, schema, fields } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!schema || typeof schema !== 'object') {
      return NextResponse.json({ error: 'Schema is required and must be an object' }, { status: 400 });
    }

    const template = await db.formTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        schema: JSON.stringify(schema),
        orgId,
        createdBy: userId,
      },
    });

    // Create fields if provided
    if (fields && Array.isArray(fields)) {
      await db.formField.createMany({
        data: fields.map((field: any) => ({
          formTemplateId: template.id,
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

    const created = await db.formTemplate.findUnique({
      where: { id: template.id },
      include: {
        creator: { select: { id: true, email: true, name: true } },
        fields: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({
      id: created!.id,
      name: created!.name,
      description: created!.description,
      schema: JSON.parse(created!.schema),
      createdBy: created!.creator,
      createdAt: created!.createdAt,
      updatedAt: created!.updatedAt,
      fieldCount: created!.fields.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
