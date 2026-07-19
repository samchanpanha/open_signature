import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const template = await db.formTemplate.findUnique({
      where: { shareToken: token },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        creator: {
          select: { id: true, name: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({
      form: {
        id: template.id,
        name: template.name,
        description: template.description,
        fields: template.fields.map(f => ({
          id: f.id,
          type: f.type,
          label: f.label,
          placeholder: f.placeholder,
          required: f.required,
          options: f.options ? JSON.parse(f.options) : null,
          defaultValue: f.defaultValue,
        })),
        createdAt: template.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching public form:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form' },
      { status: 500 }
    );
  }
}
