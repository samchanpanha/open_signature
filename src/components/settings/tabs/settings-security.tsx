'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export function SettingsSecurity() {
  const { settings, updateSetting } = useSettings();
  const s = settings.security;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Password Policy</CardTitle>
          <CardDescription>Enforce password complexity requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Minimum Length</label>
            <Input type="number" min={4} max={128} value={s.passwordMinLength} onChange={e => updateSetting('security', 'passwordMinLength', Math.max(4, Math.min(128, parseInt(e.target.value) || 6)))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'passwordRequireUppercase' as const, label: 'Require Uppercase', desc: 'At least one uppercase letter' },
              { key: 'passwordRequireNumbers' as const, label: 'Require Numbers', desc: 'At least one number' },
              { key: 'passwordRequireSymbols' as const, label: 'Require Symbols', desc: 'At least one special character' },
              { key: 'passwordRequireMixedCase' as const, label: 'Mixed Case', desc: 'Both upper and lowercase' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('security', item.key, v)} />
              </div>
            ))}
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password History</label>
              <Input type="number" min={0} max={24} value={s.passwordHistoryCount} onChange={e => updateSetting('security', 'passwordHistoryCount', Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Password Age (days)</label>
              <Input type="number" min={0} max={365} value={s.minPasswordAge} onChange={e => updateSetting('security', 'minPasswordAge', Math.max(0, Math.min(365, parseInt(e.target.value) || 0)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Password Age (days)</label>
              <Input type="number" min={30} max={365} value={s.maxPasswordAge} onChange={e => updateSetting('security', 'maxPasswordAge', Math.max(30, Math.min(365, parseInt(e.target.value) || 90)))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session & Login</CardTitle>
          <CardDescription>Session timeout and brute-force protection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Session Timeout (min)</label>
              <Input type="number" min={5} max={10080} value={s.sessionTimeoutMinutes} onChange={e => updateSetting('security', 'sessionTimeoutMinutes', Math.max(5, Math.min(10080, parseInt(e.target.value) || 1440)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Login Attempts</label>
              <Input type="number" min={1} max={100} value={s.maxLoginAttempts} onChange={e => updateSetting('security', 'maxLoginAttempts', Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Lockout Duration (min)</label>
              <Input type="number" min={1} max={1440} value={s.lockoutDurationMinutes} onChange={e => updateSetting('security', 'lockoutDurationMinutes', Math.max(1, Math.min(1440, parseInt(e.target.value) || 15)))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Access Controls</CardTitle>
          <CardDescription>Authentication and network security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'requireEmailVerification' as const, label: 'Email Verification', desc: 'Require email verification for new accounts' },
            { key: 'enable2FA' as const, label: 'Two-Factor Authentication', desc: 'Enable TOTP-based 2FA for all users' },
            { key: 'enforceHttps' as const, label: 'Enforce HTTPS', desc: 'Redirect all HTTP requests to HTTPS' },
            { key: 'csrfProtection' as const, label: 'CSRF Protection', desc: 'Enable cross-site request forgery protection' },
            { key: 'allowPasswordReset' as const, label: 'Password Reset', desc: 'Allow users to reset their password via email' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('security', item.key, v)} />
            </div>
          ))}
          <Separator />
          <div className="space-y-2">
            <label className="text-sm font-medium">IP Whitelist</label>
            <Input placeholder="Comma-separated IPs (empty = allow all)" value={s.ipWhitelist} onChange={e => updateSetting('security', 'ipWhitelist', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Limit (requests)</label>
              <Input type="number" min={1} max={10000} value={s.rateLimitRequests} onChange={e => updateSetting('security', 'rateLimitRequests', Math.max(1, Math.min(10000, parseInt(e.target.value) || 100)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rate Window (ms)</label>
              <Input type="number" min={1000} max={3600000} value={s.rateLimitWindowMs} onChange={e => updateSetting('security', 'rateLimitWindowMs', Math.max(1000, Math.min(3600000, parseInt(e.target.value) || 60000)))} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
