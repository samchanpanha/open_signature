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
  action: 'create' | 'read' | 'update' | 'delete' | 'sign' | 'comment' | 'share' | 'admin';
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

// Document-level permission roles
export const DOC_PERMISSION_ROLES = ['viewer', 'commenter', 'signer', 'editor', 'admin'] as const;
export const DOC_PERMISSION_ACTIONS = ['read', 'comment', 'sign', 'edit', 'delete', 'share'] as const;

/**
 * Parse multi-role from OrganizationMember.roles (JSON array)
 * Falls back to single role field for backward compatibility
 */
function parseRoles(member: { role: string; roles: string }): string[] {
  try {
    const parsed = JSON.parse(member.roles);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* ignore */ }
  return [member.role];
}

/**
 * Get all roles for a user in an organization (supports multi-role)
 */
export async function getUserRoles(userId: string, orgId: string): Promise<string[]> {
  const membership = await db.organizationMember.findFirst({
    where: { userId, orgId },
    select: { role: true, roles: true },
  });
  if (!membership) return [];
  return parseRoles(membership);
}

/**
 * Get user's primary role in an organization (backward compatible)
 */
export async function getUserRole(userId: string, orgId: string): Promise<string | null> {
  const roles = await getUserRoles(userId, orgId);
  return roles[0] || null;
}

/**
 * Check if user has ANY of the specified roles (multi-role aware)
 */
export async function hasAnyRole(userId: string, orgId: string, roles: string[]): Promise<boolean> {
  const userRoles = await getUserRoles(userId, orgId);
  return userRoles.some((r) => roles.includes(r));
}

/**
 * Check if user has a specific permission (multi-role aware)
 */
export async function hasPermission(
  userId: string,
  orgId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const userRoles = await getUserRoles(userId, orgId);

  // Owners and admins bypass all checks
  if (userRoles.includes('owner') || userRoles.includes('admin')) {
    return true;
  }

  // Check role presets - if ANY role grants this permission, allow
  for (const role of userRoles) {
    const preset = ROLE_PRESETS[role];
    if (preset && preset.permissions.length === 0) continue; // owner/admin bypass
    if (preset?.permissions.some((p) => p.resource === resource && p.action === action)) {
      return true;
    }
  }

  // Check explicit permission records
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
 * Check document-level permission
 */
export async function hasDocumentPermission(
  userId: string,
  documentId: string,
  action: string
): Promise<boolean> {
  // Check document owner
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, organizationId: true },
  });
  if (!doc) return false;
  if (doc.ownerId === userId) return true;

  // Check org-level owner/admin
  if (doc.organizationId) {
    const userRoles = await getUserRoles(userId, doc.organizationId);
    if (userRoles.includes('owner') || userRoles.includes('admin')) return true;
  }

  // Check document-level permission
  const docPerm = await db.documentPermission.findFirst({
    where: {
      documentId,
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (!docPerm) return false;

  // Check if the permission's role grants the action
  const roleActions = DOC_PERMISSION_ROLE_MAP[docPerm.role] || ['read'];
  if (roleActions.includes(action as any)) return true;

  // Check explicit permissions array
  try {
    const perms = JSON.parse(docPerm.permissions);
    if (Array.isArray(perms) && perms.includes(action)) return true;
  } catch { /* ignore */ }

  return false;
}

// Role-to-default-actions mapping for document permissions
const DOC_PERMISSION_ROLE_MAP: Record<string, string[]> = {
  admin: ['read', 'comment', 'sign', 'edit', 'delete', 'share'],
  editor: ['read', 'comment', 'sign', 'edit'],
  signer: ['read', 'comment', 'sign'],
  commenter: ['read', 'comment'],
  viewer: ['read'],
};

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
 * Get all effective permissions for a user in an org (roles + explicit)
 */
export async function getUserPermissions(
  userId: string,
  orgId: string
): Promise<{ roles: string[]; permissions: PermissionCheck[]; explicit: any[] }> {
  const roles = await getUserRoles(userId, orgId);
  const rolePerms: PermissionCheck[] = [];

  for (const role of roles) {
    const preset = ROLE_PRESETS[role];
    if (preset) {
      rolePerms.push(...preset.permissions);
    }
  }

  const explicit = await db.permission.findMany({
    where: {
      userId,
      orgId,
      granted: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  return { roles, permissions: rolePerms, explicit };
}

/**
 * Get all document-level permissions for a document
 */
export async function getDocumentPermissions(documentId: string): Promise<any[]> {
  return db.documentPermission.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Grant document-level permission
 */
export async function grantDocumentPermission(
  documentId: string,
  userId: string | null,
  email: string | null,
  role: string,
  permissions: string[],
  grantedBy: string,
  expiresAt?: Date | null
): Promise<any> {
  const data: any = {
    documentId,
    userId,
    email,
    role,
    permissions: JSON.stringify(permissions),
    grantedBy,
    expiresAt: expiresAt || null,
  };

  // Upsert based on documentId + userId or documentId + email
  if (userId) {
    const existing = await db.documentPermission.findFirst({
      where: { documentId, userId },
    });
    if (existing) {
      return db.documentPermission.update({
        where: { id: existing.id },
        data: { role, permissions: JSON.stringify(permissions), expiresAt: expiresAt || null },
      });
    }
  } else if (email) {
    const existing = await db.documentPermission.findFirst({
      where: { documentId, email },
    });
    if (existing) {
      return db.documentPermission.update({
        where: { id: existing.id },
        data: { role, permissions: JSON.stringify(permissions), expiresAt: expiresAt || null },
      });
    }
  }

  return db.documentPermission.create({ data });
}

/**
 * Revoke document-level permission
 */
export async function revokeDocumentPermission(permId: string): Promise<void> {
  await db.documentPermission.delete({ where: { id: permId } });
}

/**
 * Middleware factory for protecting routes with permission checks
 */
export function requirePermission(
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'sign'
) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const user = await getAuthUserAsync(req);
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

    return null;
  };
}

/**
 * Middleware factory for protecting routes with role checks (multi-role aware)
 */
export function requireRole(...roles: string[]) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const user = await getAuthUserAsync(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId') || req.headers.get('x-org-id');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const allowed = await hasAnyRole(user.userId, orgId, roles);
    if (!allowed) {
      return NextResponse.json(
        { error: `Forbidden: Requires one of roles [${roles.join(', ')}]` },
        { status: 403 }
      );
    }

    return null;
  };
}

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
 * Decorator-like function to wrap API handlers with auth check
 */
export function withAuth<T extends NextRequest>(
  handler: (req: T, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: T): Promise<NextResponse> => {
    const user = await getAuthUserAsync(req);
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
    const user = await getAuthUserAsync(req);
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
