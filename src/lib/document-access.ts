import { db } from '@/lib/db';
import { hasPermission, getUserRole } from '@/lib/permissions';

/**
 * Check if user can access a document (owner OR org member with read permission)
 */
export async function canAccessDocument(
  userId: string,
  documentId: string
): Promise<{ allowed: boolean; role: string | null; isOwner: boolean }> {
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, organizationId: true },
  });

  if (!document) return { allowed: false, role: null, isOwner: false };

  // Owner always has access
  if (document.ownerId === userId) {
    return { allowed: true, role: 'owner', isOwner: true };
  }

  // If document has no org, only owner can access
  if (!document.organizationId) {
    return { allowed: false, role: null, isOwner: false };
  }

  // Check org membership
  const role = await getUserRole(userId, document.organizationId);
  if (!role) return { allowed: false, role: null, isOwner: false };

  // Owners and admins have full access
  if (role === 'owner' || role === 'admin') {
    return { allowed: true, role, isOwner: false };
  }

  // Check read permission
  const canRead = await hasPermission(userId, document.organizationId, 'document', 'read');
  return { allowed: canRead, role, isOwner: false };
}

/**
 * Check if user can modify a document (owner OR org member with update/delete permission)
 */
export async function canModifyDocument(
  userId: string,
  documentId: string,
  action: 'update' | 'delete'
): Promise<{ allowed: boolean; role: string | null; isOwner: boolean }> {
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, organizationId: true },
  });

  if (!document) return { allowed: false, role: null, isOwner: false };

  // Owner always has access
  if (document.ownerId === userId) {
    return { allowed: true, role: 'owner', isOwner: true };
  }

  // If document has no org, only owner can modify
  if (!document.organizationId) {
    return { allowed: false, role: null, isOwner: false };
  }

  // Check org membership
  const role = await getUserRole(userId, document.organizationId);
  if (!role) return { allowed: false, role: null, isOwner: false };

  // Owners and admins have full access
  if (role === 'owner' || role === 'admin') {
    return { allowed: true, role, isOwner: false };
  }

  // Check specific permission
  const canDo = await hasPermission(userId, document.organizationId, 'document', action);
  return { allowed: canDo, role, isOwner: false };
}

/**
 * Get all document IDs a user can access within an org
 */
export async function getAccessibleDocumentIds(
  userId: string,
  orgId: string
): Promise<string[]> {
  const role = await getUserRole(userId, orgId);

  // Owners and admins see all org documents
  if (role === 'owner' || role === 'admin') {
    const docs = await db.document.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    return docs.map(d => d.id);
  }

  // Check if user has read permission
  const canRead = await hasPermission(userId, orgId, 'document', 'read');
  if (!canRead) return [];

  // Members with read access see all org documents
  const docs = await db.document.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  return docs.map(d => d.id);
}

/**
 * Check if user can create documents in an org
 */
export async function canCreateDocument(
  userId: string,
  orgId: string
): Promise<boolean> {
  const role = await getUserRole(userId, orgId);

  // Owners and admins can always create
  if (role === 'owner' || role === 'admin') return true;

  // Check create permission
  return hasPermission(userId, orgId, 'document', 'create');
}

/**
 * Check if user can access a template (owner OR org member with read permission)
 */
export async function canAccessTemplate(
  userId: string,
  templateId: string
): Promise<{ allowed: boolean; isOwner: boolean }> {
  const template = await db.documentTemplate.findUnique({
    where: { id: templateId },
    select: { ownerId: true },
  });

  if (!template) return { allowed: false, isOwner: false };

  // Owner always has access
  if (template.ownerId === userId) {
    return { allowed: true, isOwner: true };
  }

  return { allowed: false, isOwner: false };
}
