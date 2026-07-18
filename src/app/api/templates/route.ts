import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getUserRole, hasPermission } from '@/lib/permissions';

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function GET(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    let templates;

    if (orgId) {
      // Check org access
      const role = await getUserRole(userId, orgId);
      if (!role) {
        return NextResponse.json({ error: 'Not a member' }, { status: 403 });
      }

      // Owners/admins see all, others need read permission
      if (role !== 'owner' && role !== 'admin') {
        const canRead = await hasPermission(userId, orgId, 'template', 'read');
        if (!canRead) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
      }

      // Get user's own templates + org templates
      templates = await db.documentTemplate.findMany({
        where: {
          OR: [
            { ownerId: userId },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Personal templates only
      templates = await db.documentTemplate.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error('List templates error:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = payload.userId as string;
    const { name, fieldConfig, orgId } = await req.json();
    if (!name || !fieldConfig) {
      return NextResponse.json({ error: 'Name and field config required' }, { status: 400 });
    }

    // If creating in org context, check create permission
    if (orgId) {
      const role = await getUserRole(userId, orgId);
      if (!role) {
        return NextResponse.json({ error: 'Not a member' }, { status: 403 });
      }

      if (role !== 'owner' && role !== 'admin') {
        const canCreate = await hasPermission(userId, orgId, 'template', 'create');
        if (!canCreate) {
          return NextResponse.json({ error: 'Insufficient permissions to create templates' }, { status: 403 });
        }
      }
    }

    const template = await db.documentTemplate.create({
      data: {
        name,
        fieldConfig: JSON.stringify(fieldConfig),
        ownerId: userId,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
