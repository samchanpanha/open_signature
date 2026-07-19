import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { data, submitterEmail, submitterName } = body;

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Form data is required' }, { status: 400 });
    }

    const template = await db.formTemplate.findUnique({
      where: { shareToken: token },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Validate required fields
    const requiredFields = template.fields.filter(f => f.required);
    for (const field of requiredFields) {
      const value = data[field.id] || data[field.label];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return NextResponse.json(
          { error: `Field "${field.label}" is required` },
          { status: 400 }
        );
      }
    }

    // Store submission
    const submission = await db.formSubmission.create({
      data: {
        formTemplateId: template.id,
        data: JSON.stringify({
          ...data,
          _meta: {
            submittedAt: new Date().toISOString(),
            submitterEmail: submitterEmail || null,
            submitterName: submitterName || null,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          },
        }),
      },
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      message: 'Form submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    return NextResponse.json(
      { error: 'Failed to submit form' },
      { status: 500 }
    );
  }
}
