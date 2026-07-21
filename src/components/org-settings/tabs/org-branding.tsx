'use client';

import React from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrandLogo } from '@/components/brand-logo';
import { Palette, Loader2 } from 'lucide-react';

export function OrgBrandingTab() {
  const { brandingForm, setBrandingForm, brandingSaving, saveBranding } = useOrgSettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4" /> Brand Identity
          </CardTitle>
          <CardDescription>Customize how your organization appears to members and signers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Preview */}
          <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
            <BrandLogo className="w-14 h-14" textClassName="font-bold text-xl" />
            <div>
              <p className="text-sm font-medium">Live Preview</p>
              <p className="text-xs text-muted-foreground">This is how your branding appears across the platform</p>
            </div>
          </div>

          {/* Organization Name */}
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input
              value={brandingForm.name}
              onChange={(e) => setBrandingForm({ ...brandingForm, name: e.target.value })}
              placeholder="Organization name"
            />
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              value={brandingForm.logoUrl}
              onChange={(e) => setBrandingForm({ ...brandingForm, logoUrl: e.target.value })}
              placeholder="https://.../logo.png"
            />
          </div>

          {/* Brand Color */}
          <div className="space-y-2">
            <Label>Brand Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandingForm.brandColor}
                onChange={(e) => setBrandingForm({ ...brandingForm, brandColor: e.target.value })}
                className="w-12 h-10 rounded-lg border cursor-pointer"
              />
              <Input
                value={brandingForm.brandColor}
                onChange={(e) => setBrandingForm({ ...brandingForm, brandColor: e.target.value })}
                className="flex-1 font-mono"
              />
            </div>
          </div>

          {/* Custom Domain */}
          <div className="space-y-2">
            <Label>Custom Domain</Label>
            <Input
              value={brandingForm.customDomain}
              onChange={(e) => setBrandingForm({ ...brandingForm, customDomain: e.target.value })}
              placeholder="sign.yourcompany.com"
            />
          </div>

          {/* Save */}
          <Button
            className="w-full gradient-primary text-white"
            disabled={brandingSaving}
            onClick={saveBranding}
          >
            {brandingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Palette className="w-4 h-4 mr-2" /> Save Branding</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
