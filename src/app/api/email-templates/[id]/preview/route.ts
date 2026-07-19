import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

// POST - Preview email template with sample data
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { variables } = await req.json();

    const template = await db.emailTemplate.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Replace variables with sample data if not provided
    const sampleData: Record<string, string> = {
      documentTitle: 'Sample Document',
      signerName: 'John Doe',
      signerEmail: 'john@example.com',
      ownerName: 'Jane Smith',
      ownerEmail: 'jane@example.com',
      completionDate: new Date().toLocaleDateString(),
      expiryDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString(),
      signingUrl: 'https://example.com/sign/sample-token',
      ...variables,
    };

    let previewHtml = template.htmlBody;
    for (const [key, value] of Object.entries(sampleData)) {
      previewHtml = previewHtml.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    let previewSubject = template.subject || '';
    for (const [key, value] of Object.entries(sampleData)) {
      previewSubject = previewSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return NextResponse.json({ 
      html: previewHtml, 
      subject: previewSubject,
      sampleData,
    });
  } catch (error) {
    console.error('Preview template error:', error);
    return NextResponse.json({ error: 'Failed to preview template' }, { status: 500 });
  }
}