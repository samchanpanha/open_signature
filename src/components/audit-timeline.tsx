'use client';

import React from 'react';
import {
  FileText, Send, CheckCircle2, XCircle, Clock, Shield,
  Eye, Edit3, Download, Mail, Key, AlertTriangle, Ban
} from 'lucide-react';

interface AuditEvent {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  user?: { name?: string; email?: string } | null;
  signer?: { name?: string; email?: string } | null;
}

interface AuditTimelineProps {
  events: AuditEvent[];
}

const actionConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  DOCUMENT_CREATED: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  DOCUMENT_SENT: { icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  SIGNER_COMPLETED: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  DOCUMENT_COMPLETED: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  DOCUMENT_REJECTED: { icon: Ban, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  DOCUMENT_REVOKED: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  OTP_REQUESTED: { icon: Key, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  OTP_VERIFIED: { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  DOCUMENT_VIEWED: { icon: Eye, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  DOCUMENT_DOWNLOADED: { icon: Download, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  EMAIL_SENT: { icon: Mail, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  DOCUMENT_EXPIRED: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No audit events yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {events.map((event, i) => {
          const config = actionConfig[event.action] || { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100' };
          const Icon = config.icon;
          const isFirst = i === 0;

          return (
            <div key={event.id} className="relative flex gap-3">
              {/* Icon */}
              <div className={`relative z-10 w-8 h-8 rounded-full ${config.bg} flex items-center justify-center shrink-0 ${isFirst ? 'ring-2 ring-emerald-500/30' : ''}`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-medium ${isFirst ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {event.action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.details}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(event.createdAt)}</span>
                </div>

                {/* Actor info */}
                {(event.user || event.signer) && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                      {(event.user?.name || event.signer?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {event.user?.name || event.signer?.name || event.user?.email || event.signer?.email || 'Unknown'}
                    </span>
                  </div>
                )}

                {/* IP Address */}
                {event.ipAddress && event.ipAddress !== 'unknown' && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">IP: {event.ipAddress}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
