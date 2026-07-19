import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserAsync } from '@/lib/permissions';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserAsync(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const apiKeys = await db.apiKey.findMany({
      where: {
        userId: user.userId,
        orgId,
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUserAsync(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, permissions, orgId, expiresAt } = body;

    if (!name || !orgId) {
      return NextResponse.json(
        { error: 'Name and organization ID are required' },
        { status: 400 }
      );
    }

    const key = crypto.randomBytes(48).toString('hex');

    const apiKey = await db.apiKey.create({
      data: {
        name,
        key,
        permissions: JSON.stringify(permissions || []),
        userId: user.userId,
        orgId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
