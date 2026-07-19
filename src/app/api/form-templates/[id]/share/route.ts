import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { randomBytes } from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const template = await db.formTemplate.findFirst({
      where: { id, createdBy: userId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Form template not found' }, { status: 404 });
    }

    // Generate share token if not exists
    let shareToken = template.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(16).toString('hex');
      await db.formTemplate.update({
        where: { id },
        data: { shareToken },
      });
    }

    return NextResponse.json({
      shareToken,
      shareUrl: `/public-form/${shareToken}`,
    });
  } catch (error) {
    console.error('Error sharing form template:', error);
    return NextResponse.json(
      { error: 'Failed to share form template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = getAuthUser(request);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const template = await db.formTemplate.findFirst({
      where: { id, createdBy: userId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Form template not found' }, { status: 404 });
    }

    await db.formTemplate.update({
      where: { id },
      data: { shareToken: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking form share:', error);
    return NextResponse.json(
      { error: 'Failed to revoke share' },
      { status: 500 }
    );
  }
}
