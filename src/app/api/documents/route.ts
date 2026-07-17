import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const documents = await db.document.findMany({
      where: { ownerId: payload.userId as string },
      include: {
        _count: { select: { signers: true } },
        signers: { where: { signedAt: { not: null } }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      documents.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt,
        signerCount: d._count.signers,
        signedCount: d.signers.length,
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

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!file.name.endsWith('.pdf')) return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await mkdir(UPLOADS_DIR, { recursive: true });
    const fileId = randomUUID();
    const filePath = path.join(UPLOADS_DIR, `${fileId}.pdf`);
    await writeFile(filePath, buffer);

    const document = await db.document.create({
      data: {
        title,
        originalPdfPath: `${fileId}.pdf`,
        ownerId: payload.userId as string,
        status: 'Draft',
      },
    });

    await db.auditLog.create({
      data: {
        action: 'DOCUMENT_CREATED',
        documentId: document.id,
        userId: payload.userId as string,
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