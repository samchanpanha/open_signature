'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export function SettingsGeneral() {
  const { settings, updateSetting } = useSettings();
  const s = settings.general;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Application</CardTitle>
          <CardDescription>Basic application settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">App Name</label>
              <Input value={s.appName} onChange={e => updateSetting('general', 'appName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={s.appDescription} onChange={e => updateSetting('general', 'appDescription', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">Temporarily disable public access</p>
            </div>
            <Switch checked={s.maintenanceMode} onCheckedChange={v => updateSetting('general', 'maintenanceMode', v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Allow Registration</p>
              <p className="text-xs text-muted-foreground">Allow new users to create accounts</p>
            </div>
            <Switch checked={s.allowRegistration} onCheckedChange={v => updateSetting('general', 'allowRegistration', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Locale & Display</CardTitle>
          <CardDescription>Language, timezone, and date formatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Language</label>
              <Select value={s.defaultLanguage} onValueChange={v => updateSetting('general', 'defaultLanguage', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="km">Khmer</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timezone</label>
              <Select value={s.timezone} onValueChange={v => updateSetting('general', 'timezone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Asia/Phnom_Penh">Asia/Phnom_Penh (GMT+7)</SelectItem>
                  <SelectItem value="Asia/Shanghai">Asia/Shanghai (GMT+8)</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (GMT-5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Format</label>
              <Select value={s.dateFormat} onValueChange={v => updateSetting('general', 'dateFormat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Format</label>
              <Select value={s.timeFormat} onValueChange={v => updateSetting('general', 'timeFormat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Items Per Page</label>
              <Input type="number" min={5} max={100} value={s.itemsPerPage} onChange={e => updateSetting('general', 'itemsPerPage', Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Session Warning (minutes)</label>
              <Input type="number" min={1} max={60} value={s.sessionWarningMinutes} onChange={e => updateSetting('general', 'sessionWarningMinutes', Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
