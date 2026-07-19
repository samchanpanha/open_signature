import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params;
    const template = await db.documentTemplate.findUnique({
      where: { id },
      select: { id: true, allowOfflineSign: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ allowOfflineSign: template.allowOfflineSign })
  } catch (error) {
    console.error('Error fetching offline signing status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params;
    const body = await request.json()
    const { allowOfflineSign } = body

    if (typeof allowOfflineSign !== 'boolean') {
      return NextResponse.json(
        { error: 'allowOfflineSign must be a boolean' },
        { status: 400 }
      )
    }

    const template = await db.documentTemplate.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await db.documentTemplate.update({
      where: { id },
      data: { allowOfflineSign },
      select: { id: true, allowOfflineSign: true },
    })

    return NextResponse.json({ allowOfflineSign: updated.allowOfflineSign })
  } catch (error) {
    console.error('Error updating offline signing status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
