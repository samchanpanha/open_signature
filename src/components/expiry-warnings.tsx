'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface ExpiryWarningsProps {
  documents: Array<{
    id: string;
    title: string;
    status: string;
    expiresAt?: string | null;
  }>;
}

export function ExpiryWarnings({ documents }: ExpiryWarningsProps) {
  const now = new Date();

  const expiringSoon = documents.filter(d => {
    if (!d.expiresAt || d.status === 'completed' || d.status === 'expired') return false;
    const expires = new Date(d.expiresAt);
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 3 && daysLeft > 0;
  });

  const expired = documents.filter(d => {
    if (!d.expiresAt) return false;
    return new Date(d.expiresAt) < now && d.status !== 'completed' && d.status !== 'expired';
  });

  if (expiringSoon.length === 0 && expired.length === 0) return null;

  return (
    <div className="space-y-2">
      {expired.length > 0 && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              Expired ({expired.length})
            </span>
          </div>
          <div className="space-y-1">
            {expired.map(d => (
              <p key={d.id} className="text-xs text-red-600 dark:text-red-400">{d.title}</p>
            ))}
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Expiring Soon ({expiringSoon.length})
            </span>
          </div>
          <div className="space-y-1">
            {expiringSoon.map(d => {
              const daysLeft = Math.ceil((new Date(d.expiresAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <p className="text-xs text-amber-700 dark:text-amber-400">{d.title}</p>
                  <Badge variant="outline" className="text-[10px] text-amber-600">{daysLeft}d left</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
