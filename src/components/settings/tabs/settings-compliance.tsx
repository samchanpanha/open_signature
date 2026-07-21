'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export function SettingsCompliance() {
  const { settings, updateSetting } = useSettings();
  const s = settings.compliance;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audit & Retention</CardTitle>
          <CardDescription>Configure audit log and data retention policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Audit Log Retention (days)</label>
              <Input type="number" min={30} max={3650} value={s.auditLogRetentionDays} onChange={e => updateSetting('compliance', 'auditLogRetentionDays', Math.max(30, Math.min(3650, parseInt(e.target.value) || 365)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Retention (days)</label>
              <Input type="number" min={30} max={3650} value={s.dataRetentionDays} onChange={e => updateSetting('compliance', 'dataRetentionDays', Math.max(30, Math.min(3650, parseInt(e.target.value) || 2555)))} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Tamper-Proof Audit</p>
              <p className="text-xs text-muted-foreground">Cryptographically signed audit entries</p>
            </div>
            <Switch checked={s.enableTamperProofAudit} onCheckedChange={v => updateSetting('compliance', 'enableTamperProofAudit', v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Signing Certificates</p>
              <p className="text-xs text-muted-foreground">Generate X.509 certificates for each signature</p>
            </div>
            <Switch checked={s.enableSigningCertificates} onCheckedChange={v => updateSetting('compliance', 'enableSigningCertificates', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Regulatory Compliance</CardTitle>
          <CardDescription>Enable compliance frameworks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'gdprModeEnabled' as const, label: 'GDPR Mode', desc: 'European data protection compliance', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
            { key: 'hipaaModeEnabled' as const, label: 'HIPAA Mode', desc: 'Health data protection compliance', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
            { key: 'soc2ModeEnabled' as const, label: 'SOC 2 Mode', desc: 'Service organization control compliance', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Badge className={`text-xs ${item.color}`}>{item.label.split(' ')[0]}</Badge>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('compliance', item.key, v)} />
            </div>
          ))}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Require Consent on Signing</p>
              <p className="text-xs text-muted-foreground">Show consent checkbox before signature</p>
            </div>
            <Switch checked={s.requireConsentOnSigning} onCheckedChange={v => updateSetting('compliance', 'requireConsentOnSigning', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Data Protection</CardTitle>
          <CardDescription>Encryption and data residency settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Residency</label>
              <Select value={s.dataResidency} onValueChange={v => updateSetting('compliance', 'dataResidency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="eu">European Union</SelectItem>
                  <SelectItem value="asia">Asia Pacific</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Encryption at Rest</p>
              <p className="text-xs text-muted-foreground">Encrypt stored documents and data</p>
            </div>
            <Switch checked={s.encryptionAtRest} onCheckedChange={v => updateSetting('compliance', 'encryptionAtRest', v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Auto-Anonymize Data</p>
              <p className="text-xs text-muted-foreground">Anonymize data after retention period</p>
            </div>
            <Switch checked={s.autoAnonymizeData} onCheckedChange={v => updateSetting('compliance', 'autoAnonymizeData', v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
