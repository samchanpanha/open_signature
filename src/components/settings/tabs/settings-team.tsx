'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, Eye, Edit3, FileText } from 'lucide-react';

const ROLES = [
  {
    role: 'Owner',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Shield,
    description: 'Full access to all features and settings',
    permissions: ['All permissions', 'Manage billing', 'Delete organization', 'Manage members'],
  },
  {
    role: 'Admin',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Shield,
    description: 'Can manage members and most settings',
    permissions: ['Manage members', 'Manage documents', 'Manage workflows', 'View audit logs'],
  },
  {
    role: 'Editor',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: Edit3,
    description: 'Can create and edit documents',
    permissions: ['Create documents', 'Edit documents', 'Send for signing', 'View own documents'],
  },
  {
    role: 'Signer',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    icon: FileText,
    description: 'Can only sign documents assigned to them',
    permissions: ['Sign documents', 'View assigned documents', 'Download signed docs'],
  },
  {
    role: 'Viewer',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    icon: Eye,
    description: 'Read-only access to shared documents',
    permissions: ['View shared documents', 'Download documents', 'View audit trail'],
  },
];

export function SettingsTeam() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Role Definitions</CardTitle>
          <CardDescription>Configure permissions for each role. Manage members from the Team page.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ROLES.map(({ role, color, icon: Icon, description, permissions }) => (
              <div key={role} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={color}>{role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-11">
                  {permissions.map(p => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
