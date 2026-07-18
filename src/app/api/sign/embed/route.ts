import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const signer = await db.signer.findUnique({
      where: { token },
      include: { document: true },
    });
    if (!signer) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

    if (signer.document.expiresAt && new Date() > signer.document.expiresAt) {
      return NextResponse.json({ error: 'Document expired', code: 'EXPIRED' }, { status: 400 });
    }
    if (signer.document.status === 'Completed') {
      return NextResponse.json({ error: 'Already completed', code: 'COMPLETED' }, { status: 400 });
    }

    const signerFields = await db.documentField.findMany({
      where: { signerId: signer.id },
      orderBy: { pageNumber: 'asc' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return new NextResponse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign: ${signer.document.title}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f3f4f6; }
    iframe { border: none; width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <iframe
    src="${baseUrl}/?sign=${token}&embedded=true"
    allow="clipboard-write"
    style="width:100%;height:100vh;border:none;"
  ></iframe>
</body>
</html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
