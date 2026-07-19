import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export interface AuthUser {
  id: string;
  userId: string;
  email: string;
  name: string;
  apiKeyId?: string;
  scopes?: string[];
}

export interface PermissionCheck {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'sign';
}

// Role presets: what permissions each role gets by default
export const ROLE_PRESETS: Record<string, { label: string; description: string; permissions: PermissionCheck[] }> = {
  owner: {
    label: 'Owner',
    description: 'Full control over the organization',
    permissions: [], // bypasses all checks
  },
  admin: {
    label: 'Admin',
    description: 'Can manage members and all resources',
    permissions: [], // bypasses all checks
  },
  editor: {
    label: 'Editor',
    description: 'Can create, edit, and send documents and templates',
    permissions: [
      { resource: 'document', action: 'create' },
      { resource: 'document', action: 'read' },
      { resource: 'document', action: 'update' },
      { resource: 'document', action: 'delete' },
      { resource: 'template', action: 'create' },
      { resource: 'template', action: 'read' },
      { resource: 'template', action: 'update' },
      { resource: 'template', action: 'delete' },
      { resource: 'form', action: 'create' },
      { resource: 'form', action: 'read' },
      { resource: 'form', action: 'update' },
      { resource: 'report', action: 'read' },
    ],
  },
  signer: {
    label: 'Signer',
    description: 'Can view and sign documents assigned to them',
    permissions: [
      { resource: 'document', action: 'read' },
      { resource: 'document', action: 'sign' },
      { resource: 'template', action: 'read' },
    ],
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to documents and templates',
    permissions: [
      { resource: 'document', action: 'read' },
      { resource: 'template', action: 'read' },
      { resource: 'report', action: 'read' },
    ],
  },
  member: {
    label: 'Member',
    description: 'Basic member with limited access',
    permissions: [
      { resource: 'document', action: 'read' },
      { resource: 'template', action: 'read' },
    ],
  },
};

export const ALL_ROLES = ['owner', 'admin', 'editor', 'signer', 'viewer', 'member'];
export const MANAGEABLE_ROLES = ['admin', 'editor', 'signer', 'viewer', 'member'];

/**
 * Extract authenticated user from request (JWT Bearer only, synchronous).
 * For API-key auth, use getAuthUserAsync.
 */
export function getAuthUser(req: NextRequest): AuthUser | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const payload = verifyToken(authHeader.slice(7));
  if (!payload || !payload.userId) return null;

  return {
    id: payload.userId as string,
    userId: payload.userId as string,
    email: payload.email as string,
    name: payload.name as string,
  };
}

/**
 * Extract authenticated user supporting both JWT Bearer and x-api-key headers.
 * Async because API-key lookup hits the database.
 */
export async function getAuthUserAsync(req: NextRequest): Promise<AuthUser | null> {
  const jwtUser = getAuthUser(req);
  if (jwtUser) return jwtUser;

  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    const keyRecord = await db.apiKey.findFirst({
      where: {
        key: apiKey,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { user: true },
    });
    if (keyRecord?.user) {
      await db.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});
      return {
        id: keyRecord.userId,
        userId: keyRecord.userId,
        email: keyRecord.user.email,
        name: keyRecord.user.name,
        apiKeyId: keyRecord.id,
        scopes: safeParseScopes(keyRecord.permissions),
      };
    }
  }

  return null;
}

function safeParseScopes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Get user's role in an organization
 */
export async function getUserRole(userId: string, orgId: string): Promise<string | null> {
  const membership = await db.organizationMember.findFirst({
    where: { userId, orgId },
  });
  return membership?.role || null;
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string,
  orgId: string,
  resource: string,
  action: string
): Promise<boolean> {
  // Owners and admins have all permissions
  const role = await getUserRole(userId, orgId);
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  // Check explicit permissions
  const permission = await db.permission.findFirst({
    where: {
      userId,
      orgId,
      resource,
      action,
      granted: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  return !!permission;
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  orgId: string,
  permissions: PermissionCheck[]
): Promise<boolean> {
  for (const perm of permissions) {
    if (await hasPermission(userId, orgId, perm.resource, perm.action)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  orgId: string,
  permissions: PermissionCheck[]
): Promise<boolean> {
  for (const perm of permissions) {
    if (!(await hasPermission(userId, orgId, perm.resource, perm.action))) {
      return false;
    }
  }
  return true;
}

/**
 * Middleware factory for protecting routes with permission checks
 */
export function requirePermission(
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'sign'
) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract orgId from URL params or body
    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId') || req.headers.get('x-org-id');
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const allowed = await hasPermission(user.userId, orgId, resource, action);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Middleware factory for protecting routes with role checks
 */
export function requireRole(...roles: string[]) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId') || req.headers.get('x-org-id');
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const userRole = await getUserRole(user.userId, orgId);
    if (!userRole || !roles.includes(userRole)) {
      return NextResponse.json(
        { error: `Forbidden: Requires one of roles [${roles.join(', ')}]` },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Decorator-like function to wrap API handlers with auth check
 */
export function withAuth<T extends NextRequest>(
  handler: (req: T, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: T): Promise<NextResponse> => {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, user);
  };
}

/**
 * Decorator-like function to wrap API handlers with permission check
 */
export function withPermission(
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'sign',
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId') || req.headers.get('x-org-id');
    
    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const allowed = await hasPermission(user.userId, orgId, resource, action);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}
