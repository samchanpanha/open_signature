import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const template = await db.publicTemplate.findUnique({
      where: { shareToken: token },
      include: {
        creator: {
          select: { id: true, name: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!template.isActive) {
      return NextResponse.json({ error: 'Template is no longer active' }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        fieldConfig: template.fieldConfig,
        createdAt: template.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching public template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public template' },
      { status: 500 }
    );
  }
}
