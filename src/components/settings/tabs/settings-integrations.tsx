'use client';

import React, { useState } from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsIntegrations() {
  const { settings, updateSetting } = useSettings();
  const s = settings.integrations;
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'loading'>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const testIntegration = async (name: string) => {
    setTestResults(prev => ({ ...prev, [name]: 'loading' }));
    await new Promise(r => setTimeout(r, 1500));
    setTestResults(prev => ({ ...prev, [name]: Math.random() > 0.3 ? 'success' : 'error' }));
    toast[name === 'success' ? 'success' : 'error'](`${name} test ${name === 'success' ? 'passed' : 'failed'}`);
  };

  const Toggle = ({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Telegram */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Telegram Bot</CardTitle>
              <CardDescription>Configure Telegram notifications</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => testIntegration('Telegram')} disabled={testResults.Telegram === 'loading'}>
              {testResults.Telegram === 'loading' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {testResults.Telegram === 'success' ? <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" /> : null}
              {testResults.Telegram === 'error' ? <XCircle className="w-3 h-3 text-red-600 mr-1" /> : null}
              Test
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Token</label>
              <Input type="password" placeholder="123456:ABC-DEF..." value={s.telegramBotToken} onChange={e => updateSetting('integrations', 'telegramBotToken', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Username</label>
              <Input placeholder="@your_bot" value={s.telegramBotUsername} onChange={e => updateSetting('integrations', 'telegramBotUsername', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMTP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">SMTP Email</CardTitle>
              <CardDescription>Email server configuration</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => testIntegration('SMTP')} disabled={testResults.SMTP === 'loading'}>
              {testResults.SMTP === 'loading' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {testResults.SMTP === 'success' ? <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" /> : null}
              {testResults.SMTP === 'error' ? <XCircle className="w-3 h-3 text-red-600 mr-1" /> : null}
              Test
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SMTP Host</label>
              <Input placeholder="smtp.gmail.com" value={s.smtpHost} onChange={e => updateSetting('integrations', 'smtpHost', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Port</label>
              <Input type="number" value={s.smtpPort} onChange={e => updateSetting('integrations', 'smtpPort', parseInt(e.target.value) || 587)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input value={s.smtpUser} onChange={e => updateSetting('integrations', 'smtpUser', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input type="password" value={s.smtpPassword} onChange={e => updateSetting('integrations', 'smtpPassword', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Name</label>
              <Input value={s.smtpFromName} onChange={e => updateSetting('integrations', 'smtpFromName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From Email</label>
              <Input type="email" value={s.smtpFromEmail} onChange={e => updateSetting('integrations', 'smtpFromEmail', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">TLS/SSL</p>
              <p className="text-xs text-muted-foreground">Use secure connection</p>
            </div>
            <Switch checked={s.smtpSecure} onCheckedChange={v => updateSetting('integrations', 'smtpSecure', v)} />
          </div>
        </CardContent>
      </Card>

      {/* S3 Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">S3 Storage</CardTitle>
          <CardDescription>AWS S3 or compatible object storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Endpoint</label>
              <Input placeholder="s3.amazonaws.com" value={s.s3Endpoint} onChange={e => updateSetting('integrations', 's3Endpoint', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bucket</label>
              <Input value={s.s3Bucket} onChange={e => updateSetting('integrations', 's3Bucket', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Access Key</label>
              <Input type="password" value={s.s3AccessKey} onChange={e => updateSetting('integrations', 's3AccessKey', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Secret Key</label>
              <Input type="password" value={s.s3SecretKey} onChange={e => updateSetting('integrations', 's3SecretKey', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <Input placeholder="us-east-1" value={s.s3Region} onChange={e => updateSetting('integrations', 's3Region', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Webhook Settings</CardTitle>
          <CardDescription>Configure webhook retry and timeout</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Retry Attempts</label>
              <Input type="number" min={0} max={10} value={s.webhookRetryAttempts} onChange={e => updateSetting('integrations', 'webhookRetryAttempts', Math.max(0, Math.min(10, parseInt(e.target.value) || 3)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timeout (ms)</label>
              <Input type="number" min={1000} max={60000} value={s.webhookTimeoutMs} onChange={e => updateSetting('integrations', 'webhookTimeoutMs', Math.max(1000, Math.min(60000, parseInt(e.target.value) || 10000)))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Twilio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Twilio SMS</CardTitle>
          <CardDescription>SMS notification provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account SID</label>
              <Input type="password" value={s.twilioSid} onChange={e => updateSetting('integrations', 'twilioSid', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Auth Token</label>
              <Input type="password" value={s.twilioAuthToken} onChange={e => updateSetting('integrations', 'twilioAuthToken', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input placeholder="+1234567890" value={s.twilioPhone} onChange={e => updateSetting('integrations', 'twilioPhone', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
