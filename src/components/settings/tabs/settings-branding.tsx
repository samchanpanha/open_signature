'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export function SettingsBranding() {
  const { settings, updateSetting } = useSettings();
  const s = settings.branding;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Visual Identity</CardTitle>
          <CardDescription>Logo, colors, and theme settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo URL</label>
              <Input placeholder="https://..." value={s.logoUrl} onChange={e => updateSetting('branding', 'logoUrl', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Favicon URL</label>
              <Input placeholder="https://..." value={s.faviconUrl} onChange={e => updateSetting('branding', 'faviconUrl', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand Color</label>
              <div className="flex gap-2">
                <input type="color" value={s.brandColor} onChange={e => updateSetting('branding', 'brandColor', e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                <Input value={s.brandColor} onChange={e => updateSetting('branding', 'brandColor', e.target.value)} className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Login Background</label>
              <Input placeholder="Image URL or CSS gradient" value={s.loginBackground} onChange={e => updateSetting('branding', 'loginBackground', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Allow users to switch to dark theme</p>
            </div>
            <Switch checked={s.darkModeEnabled} onCheckedChange={v => updateSetting('branding', 'darkModeEnabled', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Company Info</CardTitle>
          <CardDescription>Company details for emails and legal pages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={s.companyName} onChange={e => updateSetting('branding', 'companyName', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Support Email</label>
              <Input type="email" value={s.supportEmail} onChange={e => updateSetting('branding', 'supportEmail', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Terms URL</label>
              <Input placeholder="https://..." value={s.termsUrl} onChange={e => updateSetting('branding', 'termsUrl', e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Privacy URL</label>
              <Input placeholder="https://..." value={s.privacyUrl} onChange={e => updateSetting('branding', 'privacyUrl', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email Templates</CardTitle>
          <CardDescription>Customize email header and footer HTML</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Header HTML</label>
            <Textarea placeholder="<div>Your header HTML</div>" value={s.emailHeaderHtml} onChange={e => updateSetting('branding', 'emailHeaderHtml', e.target.value)} rows={3} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Footer HTML</label>
            <Textarea placeholder="<div>Your footer HTML</div>" value={s.emailFooterHtml} onChange={e => updateSetting('branding', 'emailFooterHtml', e.target.value)} rows={3} className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom CSS</label>
            <Textarea placeholder=".custom-class { color: red; }" value={s.customCss} onChange={e => updateSetting('branding', 'customCss', e.target.value)} rows={4} className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
