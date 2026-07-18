import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.split(' ')[1]
  return verifyToken(token)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await db.documentTemplate.findUnique({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { allowOfflineSign } = body

    if (typeof allowOfflineSign !== 'boolean') {
      return NextResponse.json(
        { error: 'allowOfflineSign must be a boolean' },
        { status: 400 }
      )
    }

    const template = await db.documentTemplate.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await db.documentTemplate.update({
      where: { id: params.id },
      data: { allowOfflineSign },
      select: { id: true, allowOfflineSign: true },
    })

    return NextResponse.json({ allowOfflineSign: updated.allowOfflineSign })
  } catch (error) {
    console.error('Error updating offline signing status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
