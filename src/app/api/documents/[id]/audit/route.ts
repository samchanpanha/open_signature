import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const logs = await db.auditLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        createdAt: true,
        details: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Audit log error:', error);
    return NextResponse.json({ error: 'Failed to get audit log' }, { status: 500 });
  }
}