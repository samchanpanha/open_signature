import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions'


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const original = await db.documentTemplate.findFirst({
      where: { id, ownerId: payload.userId as string },
    });
    if (!original) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const duplicated = await db.documentTemplate.create({
      data: {
        name: `${original.name} (Copy)`,
        fieldConfig: original.fieldConfig,
        ownerId: payload.userId as string,
        allowOfflineSign: original.allowOfflineSign,
      },
    });

    return NextResponse.json({ id: duplicated.id, name: duplicated.name });
  } catch (error) {
    console.error('Template duplicate error:', error);
    return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 });
  }
}
