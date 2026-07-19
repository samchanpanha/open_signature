import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId || payload.id;
    const { avatar } = await req.json();

    if (!avatar) return NextResponse.json({ error: 'No avatar data provided' }, { status: 400 });

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await db.user.update({
      where: { id: userId },
      data: { avatarUrl: avatar },
    });

    return NextResponse.json({ avatarUrl: avatar });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId || payload.id;

    await db.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 });
  }
}
