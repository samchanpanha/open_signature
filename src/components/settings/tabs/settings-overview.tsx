'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, Users, TrendingUp,
  Activity, Workflow, Building2,
} from 'lucide-react';

export function SettingsOverview() {
  const { settings } = useSettings();
  const { system } = settings;

  const stats = [
    { label: 'Total Documents', value: system.totalDocuments.toLocaleString(), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Total Users', value: system.totalUsers.toLocaleString(), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Workflows', value: system.totalWorkflows.toLocaleString(), icon: Workflow, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'API Calls Today', value: system.apiCallsToday.toLocaleString(), icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ];

  const systemInfo = [
    { label: 'Node.js', value: system.nodeVersion },
    { label: 'Next.js', value: system.nextVersion },
    { label: 'Prisma', value: system.prismaVersion },
    { label: 'Database', value: system.databaseSize },
    { label: 'Storage', value: system.storageUsed },
    { label: 'Uptime', value: system.uptime },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Info + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemInfo.map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium font-mono">{item.value || '—'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Email Notifications', active: settings.notifications.emailEnabled },
                { label: 'Telegram', active: settings.notifications.telegramEnabled },
                { label: '2FA', active: settings.security.enable2FA },
                { label: 'Webhooks', active: settings.advanced.enableWebhooks },
                { label: 'API Keys', active: settings.advanced.enableApiKeys },
                { label: 'Workflow Templates', active: settings.workflows.enableWorkflowTemplates },
                { label: 'SLA Tracking', active: settings.workflows.enableSLATracking },
                { label: 'Audit Export', active: settings.advanced.enableAuditExport },
                { label: 'GDPR Mode', active: settings.compliance.gdprModeEnabled },
                { label: 'HIPAA Mode', active: settings.compliance.hipaaModeEnabled },
              ].map(f => (
                <Badge
                  key={f.label}
                  variant={f.active ? 'default' : 'secondary'}
                  className={`text-xs ${f.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}`}
                >
                  {f.active ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                  {f.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Storage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Database</span>
                <span className="font-medium">{system.databaseSize} / {system.storageTotal}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                  style={{ width: '15%' }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">File Storage</span>
                <span className="font-medium">{system.storageUsed} / {system.storageTotal}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                  style={{ width: '8%' }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
