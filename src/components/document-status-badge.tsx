'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Clock, CheckCircle, XCircle, Send, Eye,
  AlertTriangle, Archive, PenTool
} from 'lucide-react';

interface DocumentStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: FileText
  },
  pending: {
    label: 'Pending',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: Clock
  },
  sent: {
    label: 'Sent',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: Send
  },
  viewing: {
    label: 'Viewing',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    icon: Eye
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: CheckCircle
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: XCircle
  },
  expired: {
    label: 'Expired',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: AlertTriangle
  },
  archived: {
    label: 'Archived',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    icon: Archive
  },
};

export function DocumentStatusBadge({ status, showIcon = true, size = 'md' }: DocumentStatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    label: status,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: FileText,
  };
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <Badge
      variant="secondary"
      className={`${config.bgColor} ${config.color} border-0 font-medium ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      {config.label}
    </Badge>
  );
}
