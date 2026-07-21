'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export function SettingsNotifications() {
  const { settings, updateSetting } = useSettings();
  const s = settings.notifications;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notification Channels</CardTitle>
          <CardDescription>Enable or disable delivery channels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'emailEnabled' as const, label: 'Email Notifications', desc: 'Send notifications via SMTP' },
            { key: 'telegramEnabled' as const, label: 'Telegram Notifications', desc: 'Send notifications via Telegram bot' },
            { key: 'smsEnabled' as const, label: 'SMS Notifications', desc: 'Send notifications via Twilio SMS' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('notifications', item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Alert Events</CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'notifyOnDocumentSent' as const, label: 'Document Sent', desc: 'When a document is sent for signing' },
            { key: 'notifyOnDocumentCompleted' as const, label: 'Document Completed', desc: 'When all signatures are collected' },
            { key: 'notifyOnDocumentRejected' as const, label: 'Document Rejected', desc: 'When a signer rejects a document' },
            { key: 'notifyOnDocumentExpiring' as const, label: 'Document Expiring', desc: 'When a document is nearing expiration' },
            { key: 'notifyOnMemberJoined' as const, label: 'Member Joined', desc: 'When a new member joins the organization' },
            { key: 'notifyOnSystemAlerts' as const, label: 'System Alerts', desc: 'Critical system notifications' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('notifications', item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Digest & Schedule</CardTitle>
          <CardDescription>Configure daily digests and quiet hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Daily Digest</p>
              <p className="text-xs text-muted-foreground">Send a daily summary of activity</p>
            </div>
            <Switch checked={s.dailyDigestEnabled} onCheckedChange={v => updateSetting('notifications', 'dailyDigestEnabled', v)} />
          </div>
          {s.dailyDigestEnabled && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Digest Time</label>
              <Input type="time" value={s.digestTime} onChange={e => updateSetting('notifications', 'digestTime', e.target.value)} className="w-40" />
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Quiet Hours</p>
              <p className="text-xs text-muted-foreground">Suppress notifications during these hours</p>
            </div>
            <Switch checked={s.quietHoursEnabled} onCheckedChange={v => updateSetting('notifications', 'quietHoursEnabled', v)} />
          </div>
          {s.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start</label>
                <Input type="time" value={s.quietHoursStart} onChange={e => updateSetting('notifications', 'quietHoursStart', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End</label>
                <Input type="time" value={s.quietHoursEnd} onChange={e => updateSetting('notifications', 'quietHoursEnd', e.target.value)} />
              </div>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reminder Interval (days)</label>
              <Input type="number" min={1} max={30} value={s.reminderIntervalDays} onChange={e => updateSetting('notifications', 'reminderIntervalDays', Math.max(1, Math.min(30, parseInt(e.target.value) || 3)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Retention (days)</label>
              <Input type="number" min={1} max={365} value={s.notificationRetentionDays} onChange={e => updateSetting('notifications', 'notificationRetentionDays', Math.max(1, Math.min(365, parseInt(e.target.value) || 90)))} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
