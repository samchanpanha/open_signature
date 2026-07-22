import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

export interface AuditLogData {
  action: string;
  userId?: string;
  documentId?: string;
  signerId?: string;
  orgId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId || null,
        documentId: data.documentId || null,
        signerId: data.signerId || null,
        orgId: data.orgId || null,
        resourceType: data.resourceType || null,
        resourceId: data.resourceId || null,
        details: data.details || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        method: data.method || null,
        path: data.path || null,
        statusCode: data.statusCode || null,
        duration: data.duration || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export function auditFromRequest(req: NextRequest, data: AuditLogData): AuditLogData {
  return {
    ...data,
    ipAddress: data.ipAddress || getClientIp(req),
    userAgent: data.userAgent || req.headers.get('user-agent') || undefined,
    method: data.method || req.method,
    path: data.path || new URL(req.url).pathname,
  };
}
