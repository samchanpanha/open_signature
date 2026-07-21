'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Database, HardDrive, Clock, Cpu, Globe } from 'lucide-react';

export function SettingsSystem() {
  const { settings } = useSettings();
  const s = settings.system;

  const items = [
    { icon: Server, label: 'Node.js Version', value: s.nodeVersion || '—' },
    { icon: Globe, label: 'Next.js Version', value: s.nextVersion || '—' },
    { icon: Database, label: 'Prisma Version', value: s.prismaVersion || '—' },
    { icon: Database, label: 'Database Size', value: s.databaseSize },
    { icon: HardDrive, label: 'Storage Used', value: s.storageUsed },
    { icon: Clock, label: 'Uptime', value: s.uptime },
    { icon: Cpu, label: 'Active Sessions', value: String(s.activeSessions) },
    { icon: Globe, label: 'API Calls Today', value: s.apiCallsToday.toLocaleString() },
    { icon: HardDrive, label: 'Total Storage', value: s.storageTotal },
    { icon: Clock, label: 'Last Backup', value: s.lastBackup },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Runtime Information</CardTitle>
          <CardDescription>Read-only system information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium font-mono truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Platform Stats</CardTitle>
          <CardDescription>Document and user counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Documents', value: s.totalDocuments, color: 'text-blue-600' },
              { label: 'Users', value: s.totalUsers, color: 'text-emerald-600' },
              { label: 'Workflows', value: s.totalWorkflows, color: 'text-purple-600' },
              { label: 'API Calls', value: s.apiCallsToday, color: 'text-amber-600' },
            ].map(stat => (
              <div key={stat.label} className="text-center p-4 border rounded-lg">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
