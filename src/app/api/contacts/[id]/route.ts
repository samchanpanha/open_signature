import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.contact.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.userId) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, phone, company } = body;

    const updated = await db.contact.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        email: email !== undefined ? email : undefined,
        phone: phone !== undefined ? phone : undefined,
        company: company !== undefined ? company : undefined,
      },
    });

    return NextResponse.json({ contact: updated });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.contact.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.userId) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await db.contact.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}
