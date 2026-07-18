import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { getUserRole, hasPermission } from '@/lib/permissions';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.docx'];
const MIME_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const search = searchParams.get('search');
    const signerEmail = searchParams.get('signerEmail');
    const folderId = searchParams.get('folderId');
    const userId = payload.userId as string;

    let whereClause: any = {};

    if (orgId === 'null') {
      // Personal documents - only owned by user
      whereClause = { ownerId: userId, organizationId: null };
    } else if (orgId) {
      // Org documents - check permissions
      const role = await getUserRole(userId, orgId);

      if (!role) {
        return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
      }

      // Owners and admins see all org documents
      if (role === 'owner' || role === 'admin') {
        whereClause = { organizationId: orgId };
      } else {
        // Check read permission
        const canRead = await hasPermission(userId, orgId, 'document', 'read');
        if (!canRead) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        whereClause = { organizationId: orgId };
      }
    } else {
      // No org specified - show personal docs + all org docs the user has access to
      const userOrgs = await db.organizationMember.findMany({
        where: { userId, isActive: true },
        select: { orgId: true, role: true },
      });

      const orgIdsWithAccess: string[] = [];

      for (const membership of userOrgs) {
        if (membership.role === 'owner' || membership.role === 'admin') {
          orgIdsWithAccess.push(membership.orgId);
        } else {
          const canRead = await hasPermission(userId, membership.orgId, 'document', 'read');
          if (canRead) {
            orgIdsWithAccess.push(membership.orgId);
          }
        }
      }

      whereClause = {
        OR: [
          { ownerId: userId, organizationId: null },
          { organizationId: { in: orgIdsWithAccess } },
        ],
      };
    }

    if (search) {
      whereClause.title = { contains: search, mode: 'insensitive' };
    }

    if (signerEmail) {
      whereClause.signers = {
        some: { email: { contains: signerEmail, mode: 'insensitive' } },
      };
    }

    if (folderId) {
      whereClause.folderId = folderId;
    } else if (orgId && folderId === null) {
      // Show only root-level documents (not in any folder)
      whereClause.folderId = null;
    }

    const documents = await db.document.findMany({
      where: whereClause,
      include: {
        _count: { select: { signers: true } },
        signers: { where: { signedAt: { not: null } }, select: { id: true } },
        owner: { select: { id: true, name: true, email: true } },
        organization: orgId ? {
          select: {
            members: {
              select: { userId: true, role: true },
            },
          },
        } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build owner role lookup for org docs
    const ownerRoleMap = new Map<string, string>();
    if (orgId) {
      for (const doc of documents) {
        if (doc.organization?.members) {
          for (const m of doc.organization.members) {
            ownerRoleMap.set(`${doc.id}:${m.userId}`, m.role);
          }
        }
      }
    }

    return NextResponse.json(
      documents.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
        signerCount: d._count.signers,
        signedCount: d.signers.length,
        organizationId: d.organizationId,
        owner: d.owner,
        isOwner: d.ownerId === userId,
        ownerRole: ownerRoleMap.get(`${d.id}:${d.ownerId}`) || null,
      }))
    );
  } catch (error) {
    console.error('List documents error:', error);
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || 'Untitled Document';
    const userId = payload.userId as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` }, { status: 400 });
    }

    // Check for orgId in form data
    const orgIdStr = (formData.get('organizationId') as string) || null;

    // Verify org membership and create permission if orgId provided
    if (orgIdStr) {
      const memberCheck = await db.organizationMember.findFirst({
        where: { orgId: orgIdStr, userId },
      });
      if (!memberCheck) {
        return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
      }

      // Check create permission (owners/admins bypass)
      if (memberCheck.role !== 'owner' && memberCheck.role !== 'admin') {
        const canCreate = await hasPermission(userId, orgIdStr, 'document', 'create');
        if (!canCreate) {
          return NextResponse.json({ error: 'Insufficient permissions to create documents' }, { status: 403 });
        }
      }
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let filename = `${randomUUID()}.pdf`;

    // Convert non-PDF files to PDF
    if (ext !== '.pdf') {
      try {
        const pdfDoc = await PDFDocument.create();
        if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
          const imageBytes = new Uint8Array(buffer);
          let image;
          if (ext === '.png') {
            image = await pdfDoc.embedPng(imageBytes);
          } else {
            image = await pdfDoc.embedJpg(imageBytes);
          }
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        } else if (ext === '.docx') {
          const { rgb } = await import('pdf-lib');
          const page = pdfDoc.addPage([612, 792]);
          const font = await pdfDoc.embedFont('Helvetica');
          page.drawText(`Document: ${file.name}`, { x: 72, y: 720, size: 16, font, color: rgb(0, 0, 0) });
          page.drawText('DOCX files are converted to PDF. The original content requires a DOCX renderer.', { x: 72, y: 680, size: 11, font, color: rgb(0.5, 0.5, 0.5) });
        }
        buffer = Buffer.from(await pdfDoc.save());
      } catch (convErr) {
        console.error('File conversion error:', convErr);
        return NextResponse.json({ error: `Failed to convert ${ext} to PDF` }, { status: 500 });
      }
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filePath = path.join(UPLOADS_DIR, filename);
    await writeFile(filePath, buffer);

    const document = await db.document.create({
      data: {
        title,
        originalPdfPath: filename,
        ownerId: userId,
        status: 'Draft',
        ...(orgIdStr ? { organizationId: orgIdStr } : {}),
      },
    });

    await db.auditLog.create({
      data: {
        action: 'DOCUMENT_CREATED',
        documentId: document.id,
        userId,
        details: `Document "${title}" uploaded`,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || null,
      },
    });

    return NextResponse.json({
      id: document.id,
      title: document.title,
      status: document.status,
      createdAt: document.createdAt,
      originalPdfPath: document.originalPdfPath,
      signedPdfPath: document.signedPdfPath,
      ownerId: document.ownerId,
      signers: [],
      fields: [],
    });
  } catch (error) {
    console.error('Create document error:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
