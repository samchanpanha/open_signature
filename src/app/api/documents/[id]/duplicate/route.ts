import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getUserRole, hasPermission } from '@/lib/permissions';
import path from 'path';
import { copyFile } from 'fs/promises';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const original = await db.document.findFirst({
      where: { id },
      include: { fields: true },
    });
    if (!original) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Check access
    let hasAccess = original.ownerId === userId;
    if (!hasAccess && original.organizationId) {
      const role = await getUserRole(userId, original.organizationId);
      if (role === 'owner' || role === 'admin') {
        hasAccess = true;
      } else {
        hasAccess = await hasPermission(userId, original.organizationId, 'document', 'read');
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Copy the PDF file
    const newFileId = randomUUID();
    const newPdfPath = `${newFileId}.pdf`;
    await copyFile(path.join(UPLOADS_DIR, original.originalPdfPath), path.join(UPLOADS_DIR, newPdfPath));

    // Create duplicated document (owned by current user)
    const duplicated = await db.document.create({
      data: {
        title: `${original.title} (Copy)`,
        originalPdfPath: newPdfPath,
        ownerId: userId,
        status: 'Draft',
      },
    });

    // Copy field definitions (without values or signer assignments)
    for (const field of original.fields) {
      await db.documentField.create({
        data: {
          type: field.type,
          label: field.label,
          required: field.required,
          pageNumber: field.pageNumber,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          documentId: duplicated.id,
        },
      });
    }

    await db.auditLog.create({
      data: {
        action: 'DOCUMENT_DUPLICATED',
        documentId: duplicated.id,
        userId,
        details: `Duplicated from "${original.title}"`,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json({ id: duplicated.id, title: duplicated.title, status: duplicated.status });
  } catch (error) {
    console.error('Duplicate error:', error);
    return NextResponse.json({ error: 'Failed to duplicate document' }, { status: 500 });
  }
}
