import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// POST /api/documents/bulk - Bulk operations on documents
export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const body = await req.json();
    const { action, documentIds, folderId } = body;

    if (!action || !documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Action and document IDs required' }, { status: 400 });
    }

    // Verify user owns or has access to all documents
    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        OR: [
          { ownerId: userId },
          { organization: { members: { some: { userId } } } },
        ],
      },
    });

    if (documents.length !== documentIds.length) {
      return NextResponse.json({ error: 'Some documents not found or access denied' }, { status: 403 });
    }

    let affected = 0;

    if (action === 'move') {
      await db.document.updateMany({
        where: { id: { in: documentIds } },
        data: { folderId: folderId || null },
      });
      affected = documentIds.length;
    } else if (action === 'delete') {
      // Clean up files
      for (const doc of documents) {
        try { await unlink(path.join(UPLOADS_DIR, doc.originalPdfPath)); } catch {}
        if (doc.signedPdfPath) {
          try { await unlink(path.join(UPLOADS_DIR, doc.signedPdfPath)); } catch {}
        }
      }
      await db.document.deleteMany({
        where: { id: { in: documentIds } },
      });
      affected = documentIds.length;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ affected });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}
