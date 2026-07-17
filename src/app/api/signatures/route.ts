import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const signatures = await db.savedSignature.findMany({
      where: { userId: payload.userId as string },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(signatures);
  } catch (error) {
    console.error('List signatures error:', error);
    return NextResponse.json({ error: 'Failed to list signatures' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, dataUrl } = await req.json();
    if (!name || !dataUrl) {
      return NextResponse.json({ error: 'Name and signature data required' }, { status: 400 });
    }

    const sig = await db.savedSignature.create({
      data: { name, dataUrl, userId: payload.userId as string },
    });

    return NextResponse.json(sig);
  } catch (error) {
    console.error('Save signature error:', error);
    return NextResponse.json({ error: 'Failed to save signature' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const sig = await db.savedSignature.findFirst({ where: { id, userId: payload.userId as string } });
    if (!sig) return NextResponse.json({ error: 'Signature not found' }, { status: 404 });

    await db.savedSignature.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete signature error:', error);
    return NextResponse.json({ error: 'Failed to delete signature' }, { status: 500 });
  }
}