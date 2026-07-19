import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';
import { deletePdfStorage } from '@/lib/s3';


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
      for (const doc of documents) {
        await deletePdfStorage(doc.originalPdfPath);
        if (doc.signedPdfPath) {
          await deletePdfStorage(doc.signedPdfPath);
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
