import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSignerToken } from '@/lib/auth'
import { getAuthUser, getUserRole, hasPermission } from '@/lib/permissions'


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const userId = payload.userId as string;

    const doc = await db.document.findFirst({
      where: { id },
      include: { fields: true },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Check access
    let hasAccess = doc.ownerId === userId;
    if (!hasAccess && doc.organizationId) {
      const role = await getUserRole(userId, doc.organizationId);
      if (role === 'owner' || role === 'admin') {
        hasAccess = true;
      } else {
        hasAccess = await hasPermission(userId, doc.organizationId, 'document', 'update');
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.status !== 'Draft') {
      return NextResponse.json({ error: 'Can only sign Draft documents' }, { status: 400 });
    }

    // Create a signer for the current user
    const token = generateSignerToken();
    const signer = await db.signer.create({
      data: {
        email: '',
        name: 'Self',
        order: 1,
        token,
        documentId: id,
      },
    });

    // Assign all unassigned fields to this signer
    for (const field of doc.fields) {
      if (!field.signerId) {
        await db.documentField.update({ where: { id: field.id }, data: { signerId: signer.id } });
      }
    }

    await db.document.update({
      where: { id },
      data: { status: 'Signing', signedSelf: true },
    });

    await db.auditLog.create({
      data: {
        action: 'SELF_SIGN_STARTED',
        documentId: id,
        userId,
        details: 'User started self-signing',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({
      signerToken: token,
      signerId: signer.id,
      documentId: id,
    });
  } catch (error) {
    console.error('Sign self error:', error);
    return NextResponse.json({ error: 'Failed to start self-signing' }, { status: 500 });
  }
}
