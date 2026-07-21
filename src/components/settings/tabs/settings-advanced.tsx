'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle } from 'lucide-react';

export function SettingsAdvanced() {
  const { settings, updateSetting } = useSettings();
  const s = settings.advanced;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feature Toggles</CardTitle>
          <CardDescription>Enable or disable advanced features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'enableApiKeys' as const, label: 'API Keys', desc: 'Allow users to generate API keys' },
            { key: 'enableWebhooks' as const, label: 'Webhooks', desc: 'Enable webhook notifications' },
            { key: 'enablePublicForms' as const, label: 'Public Forms', desc: 'Allow public signing forms' },
            { key: 'enableDocumentComparison' as const, label: 'Document Comparison', desc: 'Compare document versions side-by-side' },
            { key: 'enableVersionControl' as const, label: 'Version Control', desc: 'Track document versions' },
            { key: 'enableBatchOperations' as const, label: 'Batch Operations', desc: 'Bulk actions on documents' },
            { key: 'enableAuditExport' as const, label: 'Audit Export', desc: 'Export audit logs as CSV/PDF' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('advanced', item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Performance</CardTitle>
          <CardDescription>Caching and upload settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cache TTL (seconds)</label>
              <Input type="number" min={0} max={86400} value={s.cacheTtlSeconds} onChange={e => updateSetting('advanced', 'cacheTtlSeconds', Math.max(0, Math.min(86400, parseInt(e.target.value) || 300)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Upload Size (MB)</label>
              <Input type="number" min={1} max={500} value={s.maxUploadSizeMb} onChange={e => updateSetting('advanced', 'maxUploadSizeMb', Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Allowed File Types</label>
            <Input placeholder="pdf,doc,docx,jpg,png" value={s.allowedFileTypes} onChange={e => updateSetting('advanced', 'allowedFileTypes', e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated file extensions</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Debug & Logging</CardTitle>
          <CardDescription>Development and troubleshooting settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Debug Mode</p>
              <p className="text-xs text-muted-foreground">Enable verbose logging and error details</p>
            </div>
            <Switch checked={s.enableDebugMode} onCheckedChange={v => updateSetting('advanced', 'enableDebugMode', v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Performance Metrics</p>
              <p className="text-xs text-muted-foreground">Track API response times and memory usage</p>
            </div>
            <Switch checked={s.enablePerformanceMetrics} onCheckedChange={v => updateSetting('advanced', 'enablePerformanceMetrics', v)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Log Level</label>
            <Select value={s.logLevel} onValueChange={v => updateSetting('advanced', 'logLevel', v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Backup</CardTitle>
          <CardDescription>Automated backup configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Enable Backups</p>
              <p className="text-xs text-muted-foreground">Automatically backup database and files</p>
            </div>
            <Switch checked={s.backupEnabled} onCheckedChange={v => updateSetting('advanced', 'backupEnabled', v)} />
          </div>
          {s.backupEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Frequency (hours)</label>
                <Input type="number" min={1} max={168} value={s.backupFrequencyHours} onChange={e => updateSetting('advanced', 'backupFrequencyHours', Math.max(1, Math.min(168, parseInt(e.target.value) || 24)))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Retention (days)</label>
                <Input type="number" min={1} max={365} value={s.backupRetentionDays} onChange={e => updateSetting('advanced', 'backupRetentionDays', Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
