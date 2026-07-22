import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole, hasPermission } from '@/lib/permissions';
import { deletePdfStorage } from '@/lib/s3';
import { createAuditLog, auditFromRequest } from '@/lib/audit';


async function checkDocumentAccess(userId: string, documentId: string, action: 'read' | 'update' | 'delete' = 'read') {
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, organizationId: true, originalPdfPath: true, signedPdfPath: true },
  });

  if (!document) return { allowed: false, document: null };

  // Owner always has access
  if (document.ownerId === userId) {
    return { allowed: true, document };
  }

  // If no org, only owner can access
  if (!document.organizationId) {
    return { allowed: false, document };
  }

  const role = await getUserRole(userId, document.organizationId);
  if (!role) return { allowed: false, document };

  // Owners and admins bypass permission checks
  if (role === 'owner' || role === 'admin') {
    return { allowed: true, document };
  }

  const canDo = await hasPermission(userId, document.organizationId, 'document', action);
  return { allowed: canDo, document };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const { allowed, document } = await checkDocumentAccess(userId, id, 'read');
    if (!allowed || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const fullDocument = await db.document.findFirst({
      where: { id },
      include: {
        signers: { orderBy: { order: 'asc' } },
        fields: { orderBy: { pageNumber: 'asc' } },
        workflow: {
          include: {
            steps: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { order: 'asc' } },
          },
        },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!fullDocument) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    return NextResponse.json({
      id: fullDocument.id,
      title: fullDocument.title,
      status: fullDocument.status,
      createdAt: fullDocument.createdAt,
      originalPdfPath: fullDocument.originalPdfPath,
      signedPdfPath: fullDocument.signedPdfPath,
      ownerId: fullDocument.ownerId,
      organizationId: fullDocument.organizationId,
      owner: fullDocument.owner,
      requireOtp: fullDocument.requireOtp,
      workflowId: fullDocument.workflowId,
      workflow: fullDocument.workflow ? {
        id: fullDocument.workflow.id,
        name: fullDocument.workflow.name,
        steps: fullDocument.workflow.steps.map(s => ({
          id: s.id,
          name: s.name,
          order: s.order,
          stepType: s.stepType,
          user: s.user,
        })),
      } : null,
      signers: fullDocument.signers.map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        order: s.order,
        role: s.role,
        signedAt: s.signedAt,
        rejectedAt: s.rejectedAt,
        rejectionReason: s.rejectionReason,
        token: s.token,
      })),
      fields: fullDocument.fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        options: f.options ? JSON.parse(f.options) : null,
        pageNumber: f.pageNumber,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value,
        signerId: f.signerId,
      })),
    });
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: 'Failed to get document' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const { allowed, document } = await checkDocumentAccess(userId, id, 'delete');
    if (!allowed || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Clean up files
    await deletePdfStorage(document.originalPdfPath);
    if (document.signedPdfPath) {
      await deletePdfStorage(document.signedPdfPath);
    }

    await db.document.delete({ where: { id } });

    await createAuditLog(auditFromRequest(req, {
      action: 'DOCUMENT_DELETE',
      userId,
      documentId: id,
      resourceType: 'document',
      resourceId: id,
      details: `Document ${id} deleted`,
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const { allowed, document } = await checkDocumentAccess(userId, id, 'update');
    if (!allowed || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await req.json();
    const { folderId, requireOtp } = body;

    const data: Record<string, unknown> = {};
    if (folderId !== undefined) data.folderId = folderId || null;
    if (requireOtp !== undefined) data.requireOtp = Boolean(requireOtp);

    const updated = await db.document.update({
      where: { id },
      data,
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
