import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

export interface PermissionCheck {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

/**
 * Extract authenticated user from request
 */
export function getAuthUser(req: NextRequest): AuthUser | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const payload = verifyToken(authHeader.slice(7));
  if (!payload || !payload.userId) return null;
  
  return {
    userId: payload.userId as string,
    email: payload.email as string,
    name: payload.name as string,
  };
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
  action: 'create' | 'read' | 'update' | 'delete'
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
  action: 'create' | 'read' | 'update' | 'delete',
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
